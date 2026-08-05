'use strict';

const mongoose = require('mongoose');
const Department = require('../models/Department');
const Team = require('../models/Team');
const User = require('../models/User');
const { departmentTokens } = require('../utils/departmentUtils');

const USER_NOTIFICATION_FIELDS = [
  '_id',
  'name',
  'email',
  'phone',
  'mobileNumber',
  'whatsappNumber',
  'mobile',
  'role',
  'department',
  'hodDepartments',
  'teamId',
  'isActive',
].join(' ');

const ADMIN_ROLE = 'admin';
const HOD_ROLES = new Set(['hod', 'manager']);
const LEADERSHIP_ROLES = new Set(['hod', 'manager', 'team_lead']);

function idString(value) {
  if (!value) return '';
  const candidate = value?._id || value?.id || value;
  if (!candidate) return '';
  if (typeof candidate.toHexString === 'function') return candidate.toHexString();
  return String(candidate).trim();
}

function normalizeRole(value = '') {
  const role = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (role === 'tl' || role === 'teamlead') return 'team_lead';
  if (role === 'head_of_department' || role === 'department_head') return 'hod';
  return role;
}

function valuesArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function tokenSet(values = []) {
  const result = new Set();
  for (const value of valuesArray(values)) {
    for (const token of departmentTokens(value)) {
      if (token) result.add(token);
    }
  }
  return result;
}

function tokensOverlap(leftTokens = new Set(), rightTokens = new Set()) {
  for (const left of leftTokens) {
    for (const right of rightTokens) {
      if (!left || !right) continue;
      if (left === right || left.includes(right) || right.includes(left)) return true;
    }
  }
  return false;
}

function combineUsers(...groups) {
  const map = new Map();
  for (const group of groups) {
    for (const user of valuesArray(group)) {
      const id = idString(user);
      if (!id || !mongoose.Types.ObjectId.isValid(id)) continue;
      if (!map.has(id)) map.set(id, user);
    }
  }
  return [...map.values()];
}

function getUserNotificationPhone(user = {}) {
  return String(
    user.whatsappNumber ||
    user.mobileNumber ||
    user.phone ||
    user.mobile ||
    ''
  ).trim();
}

async function getActiveUsers() {
  return User.find({ isActive: { $ne: false } })
    .select(USER_NOTIFICATION_FIELDS)
    .lean();
}

async function getActiveUserById(userId) {
  const id = idString(userId);
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return User.findOne({ _id: id, isActive: { $ne: false } })
    .select(USER_NOTIFICATION_FIELDS)
    .lean();
}

async function loadDepartmentContext(targetValues = []) {
  const rawValues = valuesArray(targetValues).filter(Boolean);
  const explicitIds = new Set(
    rawValues
      .map(idString)
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
  );
  const requestedTokens = tokenSet(rawValues);

  const departments = await Department.find({ isActive: { $ne: false } })
    .select('_id name code hod hods teamLead')
    .lean();

  const matchedDepartments = departments.filter((department) => {
    const departmentId = idString(department._id);
    if (explicitIds.has(departmentId)) return true;
    const masterTokens = tokenSet([department.name, department.code]);
    return tokensOverlap(requestedTokens, masterTokens);
  });

  const targetIds = new Set(explicitIds);
  const targetTokens = new Set(requestedTokens);
  for (const department of matchedDepartments) {
    targetIds.add(idString(department._id));
    for (const token of tokenSet([department.name, department.code])) targetTokens.add(token);
  }

  return { departments, matchedDepartments, targetIds, targetTokens };
}

function userDepartmentValuesByRole(user = {}) {
  const role = normalizeRole(user.role);

  // This is the organisation hierarchy used by User Management:
  // - HOD/legacy Manager: one or more values in hodDepartments[]
  // - Team Lead: exactly one value in department
  // - Employee: exactly one value in department
  // A legacy HOD department value is accepted only when hodDepartments[] is empty.
  if (HOD_ROLES.has(role)) {
    const owned = valuesArray(user.hodDepartments).filter(Boolean);
    return owned.length ? owned : valuesArray(user.department).filter(Boolean);
  }

  if (role === 'team_lead' || role === 'employee') {
    return valuesArray(user.department).filter(Boolean);
  }

  return [];
}

function valueMatchesDepartment(value, context = {}) {
  const { targetIds = new Set(), targetTokens = new Set() } = context;
  const valueId = idString(value);
  if (valueId && targetIds.has(valueId)) return true;
  return tokensOverlap(tokenSet(value), targetTokens);
}

function userMatchesDepartment(user = {}, context = {}, teamMap = new Map()) {
  const roleValues = userDepartmentValuesByRole(user);
  if (roleValues.some((value) => valueMatchesDepartment(value, context))) return true;

  // Legacy Team membership remains a fallback for old records. It never expands
  // an HOD beyond hodDepartments[] when that array is populated.
  const role = normalizeRole(user.role);
  const team = teamMap.get(idString(user.teamId));
  if (team && (role === 'team_lead' || role === 'employee')) {
    return tokensOverlap(tokenSet([team.name, team.description]), context.targetTokens || new Set());
  }

  return false;
}

async function getExplicitDepartmentLeadership(context, allowedRoles = LEADERSHIP_ROLES) {
  const leadershipIds = new Set();

  for (const department of context.matchedDepartments || []) {
    for (const value of [department.hod, ...(department.hods || []), department.teamLead]) {
      const id = idString(value);
      if (id && mongoose.Types.ObjectId.isValid(id)) leadershipIds.add(id);
    }
  }

  const teams = await Team.find({ isActive: { $ne: false } })
    .select('_id name description hod teamLead')
    .lean();

  for (const team of teams) {
    if (!tokensOverlap(tokenSet([team.name, team.description]), context.targetTokens || new Set())) continue;
    for (const value of [team.hod, team.teamLead]) {
      const id = idString(value);
      if (id && mongoose.Types.ObjectId.isValid(id)) leadershipIds.add(id);
    }
  }

  if (!leadershipIds.size) return [];

  const normalizedAllowedRoles = new Set([...allowedRoles].map(normalizeRole));

  // Do not filter linked users by the raw MongoDB role value. Older records may
  // contain values such as "TL", "teamlead" or different casing even though
  // the current schema uses "team_lead". Fetch the explicitly linked users first
  // and apply the same role normalisation used everywhere else in this service.
  const linkedUsers = await User.find({
    _id: { $in: [...leadershipIds] },
    isActive: { $ne: false },
  })
    .select(USER_NOTIFICATION_FIELDS)
    .lean();

  return linkedUsers.filter((user) => normalizedAllowedRoles.has(normalizeRole(user.role)));
}

async function getUsersByDepartments(departmentValues = [], { roles = null } = {}) {
  const context = await loadDepartmentContext(departmentValues);
  if (context.targetIds.size === 0 && context.targetTokens.size === 0) return [];

  const [users, teams] = await Promise.all([
    getActiveUsers(),
    Team.find({ isActive: { $ne: false } }).select('_id name description').lean(),
  ]);
  const teamMap = new Map(teams.map((team) => [idString(team._id), team]));
  const allowedRoles = roles ? new Set(valuesArray(roles).map(normalizeRole)) : null;

  const fieldMatchedUsers = users.filter((user) => {
    const role = normalizeRole(user.role);
    if (role === ADMIN_ROLE) return false; // Admins are added globally by event routing.
    if (allowedRoles && !allowedRoles.has(role)) return false;
    return userMatchesDepartment(user, context, teamMap);
  });

  const requestedLeadershipRoles = allowedRoles
    ? new Set([...allowedRoles].filter((role) => LEADERSHIP_ROLES.has(role)))
    : LEADERSHIP_ROLES;
  const explicitLeadership = requestedLeadershipRoles.size
    ? await getExplicitDepartmentLeadership(context, requestedLeadershipRoles)
    : [];

  return combineUsers(fieldMatchedUsers, explicitLeadership);
}

async function getDepartmentLeadershipUsers(departmentValues = []) {
  return getUsersByDepartments(departmentValues, { roles: [...LEADERSHIP_ROLES] });
}

async function getDepartmentAudienceUsers(departmentValues = []) {
  return getUsersByDepartments(departmentValues, {
    roles: ['hod', 'manager', 'team_lead', 'employee'],
  });
}

async function getAdminUsers() {
  return User.find({ role: ADMIN_ROLE, isActive: { $ne: false } })
    .select(USER_NOTIFICATION_FIELDS)
    .lean();
}

async function getSalesLeadershipUsers() {
  return getDepartmentLeadershipUsers(['sales']);
}

async function getEstimationUsers() {
  return getDepartmentAudienceUsers(['estimation']);
}

function getProjectDepartmentValues(project = {}) {
  const values = [];

  values.push(...valuesArray(project.selectedDepartments));
  for (const grid of valuesArray(project.planningGrids)) values.push(grid?.department);
  for (const selection of valuesArray(project.panelSelections)) values.push(selection?.department);
  for (const task of valuesArray(project.planningTasks)) values.push(task?.department || task?.taskType);

  const seen = new Set();
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function getProjectDepartmentUsers(project = {}) {
  return getUsersByDepartments(getProjectDepartmentValues(project));
}

module.exports = {
  USER_NOTIFICATION_FIELDS,
  idString,
  normalizeRole,
  combineUsers,
  getUserNotificationPhone,
  getActiveUserById,
  getAdminUsers,
  getSalesLeadershipUsers,
  getEstimationUsers,
  getUsersByDepartments,
  getDepartmentLeadershipUsers,
  getDepartmentAudienceUsers,
  getProjectDepartmentValues,
  getProjectDepartmentUsers,
};
