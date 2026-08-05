'use strict';

const mongoose = require('mongoose');
const Department = require('../models/Department');
const Team = require('../models/Team');
const User = require('../models/User');
const { ROLES } = require('../models/User');

const effectiveRole = (role = '') => (
  String(role || '').trim().toLowerCase() === ROLES.MANAGER
    ? ROLES.HOD
    : String(role || '').trim().toLowerCase()
);

const idString = (value) => {
  if (!value) return '';
  const candidate = value?._id || value?.id || value?.value || value;
  if (!candidate) return '';
  if (typeof candidate.toHexString === 'function') return candidate.toHexString();
  return String(candidate).trim();
};

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const uniqueObjectIds = (values = []) => {
  const seen = new Set();
  const output = [];

  for (const value of values) {
    const id = idString(value);
    if (!mongoose.Types.ObjectId.isValid(id) || seen.has(id)) continue;
    seen.add(id);
    output.push(new mongoose.Types.ObjectId(id));
  }

  return output;
};

const uniqueStrings = (values = []) => {
  const seen = new Set();
  const output = [];

  for (const value of values) {
    const text = idString(value);
    if (!text) continue;
    const key = text.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(text);
  }

  return output;
};

const buildDepartmentLookupConditions = (values = []) => {
  const ids = uniqueObjectIds(values);
  const legacyValues = uniqueStrings(values)
    .filter((value) => !mongoose.Types.ObjectId.isValid(value));

  const conditions = [];
  if (ids.length) conditions.push({ _id: { $in: ids } });

  for (const value of legacyValues) {
    const exact = new RegExp(`^${escapeRegex(value)}$`, 'i');
    conditions.push({ name: exact }, { code: exact });
  }

  return conditions;
};

const getManagedDepartments = async (user) => {
  const role = effectiveRole(user?.role);
  const userId = idString(user?._id);
  if (!mongoose.Types.ObjectId.isValid(userId)) return [];

  if (role === ROLES.ADMIN) {
    return Department.find({ isActive: { $ne: false } })
      .select('_id name code hod hods teamLead')
      .sort({ name: 1 })
      .lean();
  }

  const explicitValues = role === ROLES.HOD
    ? (Array.isArray(user.hodDepartments) ? user.hodDepartments : [])
    : role === ROLES.TEAM_LEAD
      ? [user.department]
      : [];

  const conditions = buildDepartmentLookupConditions(explicitValues);
  const objectUserId = new mongoose.Types.ObjectId(userId);

  if (role === ROLES.HOD) {
    conditions.push({ hod: objectUserId }, { hods: objectUserId });
  } else if (role === ROLES.TEAM_LEAD) {
    conditions.push({ teamLead: objectUserId });
  }

  if (!conditions.length) return [];

  const departments = await Department.find({
    isActive: { $ne: false },
    $or: conditions,
  })
    .select('_id name code hod hods teamLead')
    .sort({ name: 1 })
    .lean();

  // A Team Lead is allowed to control one department only. Prefer the user's
  // explicit department assignment, otherwise use the first Department Master
  // record that names them as teamLead. This avoids accidental cross-department
  // access when old data contains duplicate lead mappings.
  if (role === ROLES.TEAM_LEAD && departments.length > 1) {
    const explicitKey = idString(user.department).toUpperCase();
    const selected = departments.find((department) => (
      idString(department._id).toUpperCase() === explicitKey ||
      String(department.name || '').toUpperCase() === explicitKey ||
      String(department.code || '').toUpperCase() === explicitKey
    ));
    return [selected || departments[0]];
  }

  return departments;
};

const buildUserDepartmentMatch = (departments = [], explicitValues = []) => {
  const objectIds = uniqueObjectIds([
    ...departments.map((department) => department._id),
    ...explicitValues,
  ]);

  const idStrings = objectIds.map((id) => id.toString());
  const legacyTokens = uniqueStrings([
    ...departments.flatMap((department) => [department.name, department.code]),
    ...explicitValues.filter((value) => !mongoose.Types.ObjectId.isValid(idString(value))),
  ]);

  const mixedValues = [...objectIds, ...idStrings];
  const conditions = [];

  if (mixedValues.length) {
    conditions.push({ department: { $in: mixedValues } });
    conditions.push({ hodDepartments: { $in: mixedValues } });
  }

  for (const value of legacyTokens) {
    const exact = new RegExp(`^${escapeRegex(value)}$`, 'i');
    conditions.push({ department: exact });
    conditions.push({ hodDepartments: exact });
  }

  return conditions;
};

const getLegacyTeamMemberIds = async (user) => {
  const role = effectiveRole(user?.role);
  const userId = idString(user?._id);
  if (!mongoose.Types.ObjectId.isValid(userId)) return [];

  const objectUserId = new mongoose.Types.ObjectId(userId);
  let teams = [];

  if (role === ROLES.HOD) {
    teams = await Team.find({ hod: objectUserId, isActive: { $ne: false } })
      .select('members teamLead hod')
      .lean();
  } else if (role === ROLES.TEAM_LEAD) {
    teams = await Team.find({ teamLead: objectUserId, isActive: { $ne: false } })
      .select('members teamLead hod')
      .lean();
  }

  return uniqueObjectIds(
    teams.flatMap((team) => [team.hod, team.teamLead, ...(team.members || [])])
  );
};

const getDepartmentEmployeeIds = async (departmentId) => {
  const departmentKey = idString(departmentId);
  if (!mongoose.Types.ObjectId.isValid(departmentKey)) return [];

  const department = await Department.findOne({
    _id: new mongoose.Types.ObjectId(departmentKey),
    isActive: { $ne: false },
  })
    .select('_id name code hod hods teamLead')
    .lean();

  if (!department) return [];

  const userConditions = buildUserDepartmentMatch([department], [department._id]);
  if (!userConditions.length) return [];

  const users = await User.find({
    isActive: { $ne: false },
    $or: userConditions,
  })
    .select('_id')
    .lean();

  return uniqueObjectIds([
    ...users.map((user) => user._id),
    department.hod,
    ...(department.hods || []),
    department.teamLead,
  ]);
};

const resolveDepartmentHierarchyScope = async (user) => {
  const role = effectiveRole(user?.role);
  const userId = idString(user?._id);

  if (role === ROLES.ADMIN) {
    const departments = await getManagedDepartments(user);
    return {
      role,
      employeeIds: null,
      departments,
      isSelfOnly: false,
    };
  }

  if (![ROLES.HOD, ROLES.TEAM_LEAD].includes(role)) {
    return {
      role,
      employeeIds: uniqueObjectIds([userId]),
      departments: [],
      isSelfOnly: true,
    };
  }

  const explicitValues = role === ROLES.HOD
    ? (Array.isArray(user.hodDepartments) ? user.hodDepartments : [])
    : [user.department];

  const departments = await getManagedDepartments(user);
  const userConditions = buildUserDepartmentMatch(departments, explicitValues);

  const departmentUsers = userConditions.length
    ? await User.find({
        isActive: { $ne: false },
        $or: userConditions,
      })
        .select('_id')
        .lean()
    : [];

  const legacyTeamIds = await getLegacyTeamMemberIds(user);
  const employeeIds = uniqueObjectIds([
    userId,
    ...departmentUsers.map((member) => member._id),
    ...departments.flatMap((department) => [
      department.hod,
      ...(department.hods || []),
      department.teamLead,
    ]),
    ...legacyTeamIds,
  ]);

  return {
    role,
    employeeIds,
    departments,
    isSelfOnly: employeeIds.length <= 1,
  };
};

module.exports = {
  effectiveRole,
  idString,
  getDepartmentEmployeeIds,
  resolveDepartmentHierarchyScope,
};
