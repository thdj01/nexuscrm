'use strict';

const mongoose = require('mongoose');
const User = require('../models/User');
const Team = require('../models/Team');
const Department = require('../models/Department');
const { ROLES } = require('../models/User');
const { departmentMatchesUserTeam } = require('../utils/departmentUtils');
const { buildUploadedAvatarPath, deleteLocalUploadByUrl } = require('../utils/avatarUpload');
const {
  cleanPermissionList,
  resolveEffectiveEmployeeAccess,
  EMPLOYEE_RESTRICTED_PROJECT_PERMISSIONS,
} = require('../utils/accessControl');
const { syncUserHierarchyToDepartments } = require('../services/userDepartmentHierarchyService');

const ok = (res, data, status = 200) =>
  res.status(status).json({ success: true, ...data });

const fail = (res, message, status = 400) =>
  res.status(status).json({ success: false, message });

const ROLE_ALIASES = Object.freeze({
  administrator: ROLES.ADMIN,
  admin: ROLES.ADMIN,
  hod: ROLES.HOD,
  head_of_department: ROLES.HOD,
  department_head: ROLES.HOD,
  manager: ROLES.MANAGER,
  team_lead: ROLES.TEAM_LEAD,
  teamleader: ROLES.TEAM_LEAD,
  tl: ROLES.TEAM_LEAD,
  employee: ROLES.EMPLOYEE,
  staff: ROLES.EMPLOYEE,
});

const normalizeRole = (role = '') => {
  const normalized = String(role)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return ROLE_ALIASES[normalized] || normalized;
};

const effectiveRole = (role = '') => {
  const normalized = normalizeRole(role);
  return normalized === ROLES.MANAGER ? ROLES.HOD : normalized;
};

const cleanString = (value) =>
  value === undefined || value === null ? '' : String(value).trim();

const isObjectIdLike = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));

const normalizeDepartmentValue = (value) => {
  if (!value) return '';

  if (typeof value === 'object') {
    return cleanString(value._id || value.id || value.value || value.name || value.code || '');
  }

  return cleanString(value);
};

const normalizeDepartmentArray = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => normalizeDepartmentValue(item)).filter(Boolean);
  }

  return String(value)
    .split(',')
    .map((item) => normalizeDepartmentValue(item))
    .filter(Boolean);
};

const findActiveDepartment = async (value) => {
  const key = normalizeDepartmentValue(value);
  if (!key) return null;

  if (isObjectIdLike(key)) {
    return Department.findOne({ _id: key, isActive: true })
      .select('_id name code isActive')
      .lean();
  }

  const upperKey = key.toUpperCase();
  return Department.findOne({
    isActive: true,
    $or: [{ name: upperKey }, { code: upperKey }],
  })
    .select('_id name code isActive')
    .lean();
};

const resolveDepartmentIdsFromMaster = async (values = [], fieldLabel = 'Department') => {
  const ids = [];
  const seen = new Set();

  for (const value of values) {
    const normalized = normalizeDepartmentValue(value);
    if (!normalized) continue;

    const department = await findActiveDepartment(normalized);
    if (!department) {
      return {
        error: `${fieldLabel} must be selected from active Department Master`,
        ids: [],
      };
    }

    const id = department._id.toString();
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }

  return { ids, error: null };
};

const normalizeUserDepartmentAssignments = async (payload, { existingUser = null } = {}) => {
  const role = effectiveRole(payload.role || existingUser?.role || ROLES.EMPLOYEE);

  if (role === ROLES.ADMIN) {
    payload.department = '';
    payload.hodDepartments = [];
    return null;
  }

  if (role === ROLES.HOD) {
    const sourceDepartments = Object.prototype.hasOwnProperty.call(payload, 'hodDepartments')
      ? payload.hodDepartments
      : existingUser?.hodDepartments || [];

    if (!Array.isArray(sourceDepartments) || sourceDepartments.length === 0) {
      return 'At least one HOD Department is required';
    }

    const { ids, error } = await resolveDepartmentIdsFromMaster(sourceDepartments, 'HOD Departments');
    if (error) return error;
    if (ids.length === 0) return 'At least one HOD Department is required';

    payload.department = '';
    payload.hodDepartments = ids;
    return null;
  }

  if (role === ROLES.TEAM_LEAD || role === ROLES.EMPLOYEE) {
    const sourceDepartment = Object.prototype.hasOwnProperty.call(payload, 'department')
      ? payload.department
      : existingUser?.department || '';

    if (!sourceDepartment) {
      return 'Department / Team is required';
    }

    const { ids, error } = await resolveDepartmentIdsFromMaster([sourceDepartment], 'Department / Team');
    if (error) return error;
    if (!ids[0]) return 'Department / Team is required';

    payload.department = ids[0];
    payload.hodDepartments = [];
    return null;
  }

  return null;
};

const syncDepartmentHodOwnership = async (user) => {
  if (!user?._id) return;

  const userId = user._id;
  const role = effectiveRole(user.role);
  const selectedDepartmentIds = role === ROLES.HOD && user.isActive !== false
    ? normalizeDepartmentArray(user.hodDepartments).filter(isObjectIdLike)
    : [];

  const selectedSet = new Set(selectedDepartmentIds.map(String));
  const selectedObjectIds = [...selectedSet].map((id) => new mongoose.Types.ObjectId(id));

  await Department.updateMany(
    {
      hods: userId,
      ...(selectedObjectIds.length ? { _id: { $nin: selectedObjectIds } } : {}),
    },
    { $pull: { hods: userId } }
  );

  await Department.updateMany(
    {
      hod: userId,
      ...(selectedObjectIds.length ? { _id: { $nin: selectedObjectIds } } : {}),
    },
    { $set: { hod: null } }
  );

  if (selectedObjectIds.length === 0) return;

  await Department.updateMany(
    { _id: { $in: selectedObjectIds }, isActive: true },
    { $addToSet: { hods: userId } }
  );

  await Department.updateMany(
    {
      _id: { $in: selectedObjectIds },
      isActive: true,
      $or: [{ hod: null }, { hod: { $exists: false } }],
    },
    { $set: { hod: userId } }
  );
};

const getDepartmentKey = (value) => {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || value.value || value.name || value.code || '').trim();
  return String(value).trim();
};

const enrichUsersWithDepartmentInfo = async (users = []) => {
  if (!users.length) return users;

  const departmentIds = new Set();
  const legacyValues = new Set();

  users.forEach((user) => {
    const values = [user.department, ...(Array.isArray(user.hodDepartments) ? user.hodDepartments : [])];
    values.forEach((value) => {
      const key = getDepartmentKey(value);
      if (!key) return;
      if (isObjectIdLike(key)) departmentIds.add(key);
      else legacyValues.add(key.toUpperCase());
    });
  });

  const departmentConditions = [
    departmentIds.size ? { _id: { $in: [...departmentIds] } } : null,
    legacyValues.size ? { name: { $in: [...legacyValues] } } : null,
    legacyValues.size ? { code: { $in: [...legacyValues] } } : null,
  ].filter(Boolean);

  const departments = departmentConditions.length > 0
    ? await Department.find({ $or: departmentConditions })
      .select('_id name code hod hods isActive')
      .lean()
    : [];

  const byId = new Map();
  const byName = new Map();
  const byCode = new Map();

  departments.forEach((dept) => {
    byId.set(String(dept._id), dept);
    byName.set(String(dept.name || '').toUpperCase(), dept);
    byCode.set(String(dept.code || '').toUpperCase(), dept);
  });

  const resolveDept = (value) => {
    const key = getDepartmentKey(value);
    if (!key) return null;
    return byId.get(key) || byName.get(key.toUpperCase()) || byCode.get(key.toUpperCase()) || null;
  };

  const displayDept = (value) => {
    const dept = resolveDept(value);
    return dept?.name || getDepartmentKey(value);
  };

  return users.map((user) => {
    const departmentInfo = resolveDept(user.department);
    const hodDepartmentInfo = (Array.isArray(user.hodDepartments) ? user.hodDepartments : [])
      .map(resolveDept)
      .filter(Boolean);

    return {
      ...user,
      departmentInfo,
      departmentName: departmentInfo?.name || displayDept(user.department),
      departmentCode: departmentInfo?.code || '',
      hodDepartmentInfo,
      hodDepartmentNames: (Array.isArray(user.hodDepartments) ? user.hodDepartments : []).map(displayDept),
      // Backward-compatible designation alias for screens/integrations that use
      // designation terminology while permissions continue using `role`.
      designation: user.role,
    };
  });
};


const enrichUsersWithPermissionInfo = async (users = []) => Promise.all(
  users.map(async (user) => ({
    ...user,
    effectiveEmployeeAccess: await resolveEffectiveEmployeeAccess(user),
    employeeAccessConfigured: Array.isArray(user.employeeAccess),
  }))
);

const buildUserPayload = (body = {}, { isCreate = false } = {}) => {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    payload.name = cleanString(body.name);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'email')) {
    payload.email = cleanString(body.email).toLowerCase();
  }

  if (Object.prototype.hasOwnProperty.call(body, 'phone')) {
    payload.phone = cleanString(body.phone);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'avatar')) {
    payload.avatar = cleanString(body.avatar);
  }

  if (
    Object.prototype.hasOwnProperty.call(body, 'role') ||
    Object.prototype.hasOwnProperty.call(body, 'designation')
  ) {
    const requestedRole = Object.prototype.hasOwnProperty.call(body, 'role')
      ? body.role
      : body.designation;
    payload.role = normalizeRole(requestedRole);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'department')) {
    payload.department = normalizeDepartmentValue(body.department);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'hodDepartments')) {
    payload.hodDepartments = normalizeDepartmentArray(body.hodDepartments);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'isActive')) {
    payload.isActive = body.isActive === true || body.isActive === 'true';
  }

  if (Object.prototype.hasOwnProperty.call(body, 'teamId')) {
    payload.teamId = body.teamId || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'reportsTo')) {
    payload.reportsTo = body.reportsTo || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'employeeAccess')) {
    payload.employeeAccess = cleanPermissionList(body.employeeAccess);
  }

  if (isCreate || body.password) {
    if (body.password) payload.password = String(body.password);
  }

  return payload;
};

const validateUserPayload = (payload, { isCreate = false, existingUser = null } = {}) => {
  const role = effectiveRole(payload.role || existingUser?.role || ROLES.EMPLOYEE);

  if (isCreate && !payload.password) {
    return 'Password is required';
  }

  if (payload.password && payload.password.length < 8) {
    return 'Password must be at least 8 characters';
  }

  if (payload.role && !Object.values(ROLES).includes(payload.role)) {
    return `Role must be one of: ${Object.values(ROLES).join(', ')}`;
  }

  return null;
};

const applyRoleOwnershipRules = (payload, existingUser = null) => {
  const role = effectiveRole(payload.role || existingUser?.role || ROLES.EMPLOYEE);

  if (role === ROLES.ADMIN) {
    payload.department = '';
    payload.hodDepartments = [];
    return payload;
  }

  if (role === ROLES.HOD) {
    payload.department = '';
    payload.hodDepartments = Array.from(new Set(payload.hodDepartments || existingUser?.hodDepartments || []));
    return payload;
  }

  if (role === ROLES.TEAM_LEAD || role === ROLES.EMPLOYEE) {
    payload.hodDepartments = [];
    if (role === ROLES.EMPLOYEE) {
      const accessSource = payload.employeeAccess ?? existingUser?.employeeAccess;
      if (Array.isArray(accessSource)) {
        payload.employeeAccess = cleanPermissionList(accessSource).filter(
          (permission) => !EMPLOYEE_RESTRICTED_PROJECT_PERMISSIONS.includes(permission)
        );
      }
    }
    return payload;
  }

  return payload;
};

const userPopulate = [
  { path: 'teamId', select: 'name description hod teamLead isActive' },
  { path: 'reportsTo', select: 'name email role avatar department hodDepartments' },
];

const userPublicSelect = '-password -passwordResetToken -passwordResetExpires';

const buildTeamOption = (team) => ({
  _id: team._id,
  name: team.name,
});

const enrichUsersWithTeamMembership = async (users = []) => {
  if (!users.length) return users;

  const userIds = users.map((user) => user._id).filter(Boolean);
  const teams = await Team.find({
    isActive: true,
    $or: [
      { teamLead: { $in: userIds } },
      { members:  { $in: userIds } },
    ],
  })
    .select('_id name teamLead members')
    .lean();

  const teamByUserId = new Map();

  teams.forEach((team) => {
    const teamOption = buildTeamOption(team);

    if (team.teamLead) {
      teamByUserId.set(team.teamLead.toString(), teamOption);
    }

    (team.members ?? []).forEach((memberId) => {
      const key = memberId.toString();
      if (!teamByUserId.has(key)) {
        teamByUserId.set(key, teamOption);
      }
    });
  });

  return users.map((user) => {
    const userId = user._id?.toString?.();
    const membershipTeam = teamByUserId.get(userId);

    if (!membershipTeam) return user;

    const populatedTeamName = user.teamId?.name;
    if (populatedTeamName) return user;

    return {
      ...user,
      teamId: membershipTeam,
    };
  });
};


// Get all users
const getUsers = async (req, res, next) => {
  try {
    const users = await User.find()
      .select(userPublicSelect)
      .populate(userPopulate)
      .sort({ createdAt: -1 })
      .lean();

    const departmentUsers = await enrichUsersWithDepartmentInfo(users);
    const enrichedUsers = await enrichUsersWithPermissionInfo(departmentUsers);

    res.json({ success: true, data: enrichedUsers });
  } catch (err) {
    next(err);
  }
};

// Get single user
const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select(userPublicSelect)
      .populate(userPopulate)
      .lean();

    if (!user) {
      return fail(res, 'User not found', 404);
    }

    const [departmentUser] = await enrichUsersWithDepartmentInfo([user]);
    const [enrichedUser] = await enrichUsersWithPermissionInfo([departmentUser]);

    res.json({ success: true, data: enrichedUser });
  } catch (err) {
    next(err);
  }
};

// Create user
const createUser = async (req, res, next) => {
  try {
    const payload = buildUserPayload(req.body, { isCreate: true });

    const validationError = validateUserPayload(payload, { isCreate: true });
    if (validationError) return fail(res, validationError);

    const departmentError = await normalizeUserDepartmentAssignments(payload);
    if (departmentError) return fail(res, departmentError);

    applyRoleOwnershipRules(payload);

    const user = await User.create(payload);
    await syncUserHierarchyToDepartments(user);

    const savedUser = await User.findById(user._id)
      .select(userPublicSelect)
      .populate(userPopulate)
      .lean();

    const [departmentUser] = await enrichUsersWithDepartmentInfo([savedUser]);
    const [enrichedUser] = await enrichUsersWithPermissionInfo([departmentUser]);

    res.status(201).json({
      success: true,
      data: enrichedUser,
    });
  } catch (err) {
    next(err);
  }
};

// Update user
const updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('+password');

    if (!user) {
      return fail(res, 'User not found', 404);
    }

    const payload = buildUserPayload(req.body, { isCreate: false });

    const validationError = validateUserPayload(payload, {
      isCreate: false,
      existingUser: user,
    });

    if (validationError) return fail(res, validationError);

    const departmentError = await normalizeUserDepartmentAssignments(payload, { existingUser: user });
    if (departmentError) return fail(res, departmentError);

    applyRoleOwnershipRules(payload, user);

    Object.entries(payload).forEach(([key, value]) => {
      user[key] = value;
    });

    await user.save();
    await syncUserHierarchyToDepartments(user);

    const savedUser = await User.findById(user._id)
      .select(userPublicSelect)
      .populate(userPopulate)
      .lean();

    const [departmentUser] = await enrichUsersWithDepartmentInfo([savedUser]);
    const [enrichedUser] = await enrichUsersWithPermissionInfo([departmentUser]);

    res.json({ success: true, data: enrichedUser });
  } catch (err) {
    next(err);
  }
};


// Upload/update user profile photo from User Management
const updateUserAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return fail(res, 'Profile photo is required', 400);
    }

    const avatar = buildUploadedAvatarPath(req.file);
    const user = await User.findById(req.params.id);

    if (!user) {
      await deleteLocalUploadByUrl(avatar);
      return fail(res, 'User not found', 404);
    }

    const previousAvatar = user.avatar;
    user.avatar = avatar;
    await user.save();

    if (previousAvatar && previousAvatar !== avatar) {
      await deleteLocalUploadByUrl(previousAvatar);
    }

    const savedUser = await User.findById(user._id)
      .select(userPublicSelect)
      .populate(userPopulate)
      .lean();

    const [departmentUser] = await enrichUsersWithDepartmentInfo([savedUser]);
    const [enrichedUser] = await enrichUsersWithPermissionInfo([departmentUser]);

    res.json({ success: true, data: enrichedUser });
  } catch (err) {
    if (req.file) {
      await deleteLocalUploadByUrl(buildUploadedAvatarPath(req.file));
    }
    next(err);
  }
};

// Get all active users for inquiry kick-off attendee selection.
// This deliberately does not use hierarchy scoping because a kick-off can
// include participants from any department in User Management.
const getKickoffAttendeeUsers = async (_req, res, next) => {
  try {
    let users = await User.find({ isActive: true })
      .select('_id name email role teamId avatar department hodDepartments isActive')
      .populate('teamId', 'name')
      .sort({ name: 1, role: 1 })
      .lean();

    users = await enrichUsersWithTeamMembership(users);
    users = await enrichUsersWithDepartmentInfo(users);

    return ok(res, { users });
  } catch (err) {
    next(err);
  }
};

// Get assignable users
const getAssignableUsers = async (req, res, next) => {
  try {
    const { allowedEmployeeIds } = req;
    const { department } = req.query;

    let query;

    if (allowedEmployeeIds === null || allowedEmployeeIds === undefined) {
      query = User.find({ isActive: true });
    } else if (allowedEmployeeIds.length === 0) {
      query = User.find({
        _id: req.user._id,
        isActive: true,
      });
    } else {
      query = User.find({
        _id: { $in: allowedEmployeeIds },
        isActive: true,
      });
    }

    let users = await query
      .select('_id name email role teamId avatar department hodDepartments isActive')
      .populate('teamId', 'name')
      .sort({ role: 1, name: 1 })
      .lean();

    users = await enrichUsersWithTeamMembership(users);
    users = await enrichUsersWithDepartmentInfo(users);

    if (department) {
      const requestedDepartment = String(department || '').trim();
      const requestedDepartmentUpper = requestedDepartment.toUpperCase();
      users = users.filter((user) => {
        const userDepartmentKeys = [
          getDepartmentKey(user.department),
          user.departmentName,
          user.departmentCode,
          ...(user.hodDepartments || []).map(getDepartmentKey),
          ...(user.hodDepartmentNames || []),
          ...(user.hodDepartmentInfo || []).flatMap((dept) => [dept?._id?.toString?.(), dept?.name, dept?.code]),
        ].filter(Boolean);

        return userDepartmentKeys.some((key) => String(key).toUpperCase() === requestedDepartmentUpper) ||
          departmentMatchesUserTeam(requestedDepartment, user.teamId?.name);
      });
    }

    return ok(res, { users });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  updateUserAvatar,
  getKickoffAttendeeUsers,
  getAssignableUsers,
};
