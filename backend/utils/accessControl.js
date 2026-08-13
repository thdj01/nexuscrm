'use strict';

const mongoose = require('mongoose');
const Department = require('../models/Department');
const { ROLES } = require('../models/User');
const {
  INQUIRY_PERMISSIONS,
  PROJECT_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  ALL_INQUIRY_PERMISSIONS,
  ALL_PROJECT_PERMISSIONS,
  ALL_CUSTOMER_PERMISSIONS,
  UNIVERSAL_EMPLOYEE_PERMISSIONS,
  ALL_EMPLOYEE_PERMISSIONS,
} = require('../constants/permissions');

const mergeUniversalPermissions = (permissions = []) => {
  const merged = new Set(UNIVERSAL_EMPLOYEE_PERMISSIONS);
  permissions.forEach((permission) => merged.add(permission));
  return ALL_EMPLOYEE_PERMISSIONS.filter((permission) => merged.has(permission));
};

// Project-planning ownership is role based. Admin can manage every department,
// while HOD/Team Lead/legacy Manager users are later restricted to their own
// department by projectController. Keeping these permissions effective here
// prevents a manually cleared Employee Access checklist from breaking the
// required leadership workflow.
const PLANNING_LEADERSHIP_PERMISSIONS = Object.freeze([
  PROJECT_PERMISSIONS.PLANNING_GRID,
  PROJECT_PERMISSIONS.ADD_DUPLICATE_PLANNING_GRID,
  PROJECT_PERMISSIONS.UPDATE_COMPLETION,
]);

const PROJECT_MANAGEMENT_PERMISSIONS = Object.freeze([
  PROJECT_PERMISSIONS.CREATE,
  PROJECT_PERMISSIONS.EDIT,
  PROJECT_PERMISSIONS.PLANNING_GRID,
  PROJECT_PERMISSIONS.ADD_DUPLICATE_PLANNING_GRID,
  PROJECT_PERMISSIONS.UPDATE_COMPLETION,
  PROJECT_PERMISSIONS.MARK_COMPLETED,
]);

// Employees participate in planning by viewing every project planning grid and
// updating only tasks assigned to them. Project creation and planning-structure
// changes are leadership actions even if those permissions were saved on an
// older user record.
const EMPLOYEE_RESTRICTED_PROJECT_PERMISSIONS = Object.freeze([
  PROJECT_PERMISSIONS.CREATE,
  PROJECT_PERMISSIONS.PLANNING_GRID,
  PROJECT_PERMISSIONS.ADD_DUPLICATE_PLANNING_GRID,
]);

const PROJECT_PLANNING_DEPARTMENTS = Object.freeze([
  'DESIGN',
  'PRODUCTION',
  'PURCHASE',
  'AUTOMATION',
  'STORE',
  'QC',
]);

const isAutomationHodRole = (role) => [ROLES.HOD, ROLES.MANAGER].includes(role);

const isPlanningLeadershipRole = (role) => [
  ROLES.ADMIN,
  ROLES.HOD,
  ROLES.TEAM_LEAD,
  ROLES.MANAGER,
].includes(role);

const mergeRoleRequiredPermissions = (user = {}, permissions = [], hasPlanningDepartment = false) => {
  const merged = new Set(permissions);
  if (isPlanningLeadershipRole(user.role) && hasPlanningDepartment) {
    PLANNING_LEADERSHIP_PERMISSIONS.forEach((permission) => merged.add(permission));
  }
  return ALL_EMPLOYEE_PERMISSIONS.filter((permission) => (
    merged.has(permission) && !(
      user.role === ROLES.EMPLOYEE &&
      EMPLOYEE_RESTRICTED_PROJECT_PERMISSIONS.includes(permission)
    )
  ));
};

const cleanPermissionList = (value) => {
  const allowed = new Set(ALL_EMPLOYEE_PERMISSIONS);
  const cleaned = Array.isArray(value)
    ? value
      .map((item) => String(item || '').trim())
      .filter((item) => allowed.has(item))
    : [];

  const normalized = new Set(cleaned);
  if (normalized.has(CUSTOMER_PERMISSIONS.EDIT)) {
    normalized.add(CUSTOMER_PERMISSIONS.VIEW);
  }

  // Customer Master is required specifically for creating an Inquiry.
  // Edit, follow-up, commercial-submit, and universal view permissions do not
  // automatically grant Customer access.
  if (normalized.has(INQUIRY_PERMISSIONS.CREATE)) {
    ALL_CUSTOMER_PERMISSIONS.forEach((permission) => normalized.add(permission));
  }

  return mergeUniversalPermissions([...normalized]);
};

const normalizeDepartmentToken = (value) => {
  if (!value) return '';
  if (typeof value === 'object') {
    return String(value.name || value.code || value._id || value.id || '').trim();
  }
  return String(value).trim();
};

const resolveDepartmentNames = async (user = {}) => {
  const rawValues = [
    user.department,
    ...(Array.isArray(user.hodDepartments) ? user.hodDepartments : []),
  ].filter(Boolean);

  const tokens = new Set();
  const ids = [];

  rawValues.forEach((value) => {
    if (typeof value === 'object' && (value.name || value.code)) {
      if (value.name) tokens.add(String(value.name).trim().toUpperCase());
      if (value.code) tokens.add(String(value.code).trim().toUpperCase());
      return;
    }

    const token = normalizeDepartmentToken(value);
    if (!token) return;
    if (mongoose.Types.ObjectId.isValid(token)) ids.push(token);
    else tokens.add(token.toUpperCase());
  });

  if (ids.length > 0) {
    const departments = await Department.find({ _id: { $in: ids } })
      .select('name code')
      .lean();

    departments.forEach((department) => {
      if (department.name) tokens.add(String(department.name).trim().toUpperCase());
      if (department.code) tokens.add(String(department.code).trim().toUpperCase());
    });
  }

  return tokens;
};

const mergeDepartmentRequiredPermissions = async (user = {}, permissions = []) => {
  const merged = new Set(permissions);
  const departments = await resolveDepartmentNames(user);
  const hasPlanningDepartment = PROJECT_PLANNING_DEPARTMENTS.some((department) => departments.has(department));

  // A non-planning department (for example Sales or Estimation) has Project
  // View only. Strip stale management permissions that may have been saved by
  // an earlier role-only access matrix.
  if (user.role !== ROLES.ADMIN && !hasPlanningDepartment) {
    PROJECT_MANAGEMENT_PERMISSIONS.forEach((permission) => merged.delete(permission));
  }

  if (isPlanningLeadershipRole(user.role) && hasPlanningDepartment) {
    PLANNING_LEADERSHIP_PERMISSIONS.forEach((permission) => merged.add(permission));
  }

  // Automation HODs need Customer Master visibility to select and inspect the
  // customer used by a ticket. Create/Edit remain controlled by the checklist.
  if (isAutomationHodRole(user.role) && departments.has('AUTOMATION')) {
    merged.add(CUSTOMER_PERMISSIONS.VIEW);
  }

  return ALL_EMPLOYEE_PERMISSIONS.filter((permission) => merged.has(permission));
};

const getSuggestedEmployeeAccess = async (user = {}) => {
  if (user.role === ROLES.ADMIN) return [...ALL_EMPLOYEE_PERMISSIONS];

  const permissions = new Set(UNIVERSAL_EMPLOYEE_PERMISSIONS);
  const departments = await resolveDepartmentNames(user);

  if (departments.has('SALES') || departments.has('ESTIMATION')) {
    ALL_INQUIRY_PERMISSIONS.forEach((permission) => permissions.add(permission));
    ALL_CUSTOMER_PERMISSIONS.forEach((permission) => permissions.add(permission));
  }

  if (isAutomationHodRole(user.role) && departments.has('AUTOMATION')) {
    permissions.add(CUSTOMER_PERMISSIONS.VIEW);
  }

  if (PROJECT_PLANNING_DEPARTMENTS.some((department) => departments.has(department))) {
    permissions.add(PROJECT_PERMISSIONS.VIEW);

    if (isPlanningLeadershipRole(user.role)) {
      ALL_PROJECT_PERMISSIONS.forEach((permission) => permissions.add(permission));
    }
  }

  return ALL_EMPLOYEE_PERMISSIONS.filter((permission) => permissions.has(permission));
};

// Backward-compatible export name retained for existing imports.
const getSuggestedInquiryAccess = getSuggestedEmployeeAccess;

const hasConfiguredEmployeeAccess = (user = {}) => Array.isArray(user.employeeAccess);

const resolveEffectiveEmployeeAccess = async (user = {}) => {
  if (user.role === ROLES.ADMIN) return [...ALL_EMPLOYEE_PERMISSIONS];
  if (hasConfiguredEmployeeAccess(user)) {
    return mergeDepartmentRequiredPermissions(
      user,
      mergeRoleRequiredPermissions(user, cleanPermissionList(user.employeeAccess), false)
    );
  }
  return mergeDepartmentRequiredPermissions(
    user,
    mergeRoleRequiredPermissions(user, await getSuggestedEmployeeAccess(user), false)
  );
};

const userHasPermission = (user, permission) => {
  if (!user || !permission) return false;
  if (user.role === ROLES.ADMIN) return true;
  if (
    user.role === ROLES.EMPLOYEE &&
    EMPLOYEE_RESTRICTED_PROJECT_PERMISSIONS.includes(permission)
  ) return false;
  if (UNIVERSAL_EMPLOYEE_PERMISSIONS.includes(permission)) return true;
  return Array.isArray(user.employeeAccess) && cleanPermissionList(user.employeeAccess).includes(permission);
};

const userHasAnyPermission = (user, permissions = []) => (
  permissions.some((permission) => userHasPermission(user, permission))
);

module.exports = {
  INQUIRY_PERMISSIONS,
  PROJECT_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  ALL_INQUIRY_PERMISSIONS,
  ALL_PROJECT_PERMISSIONS,
  ALL_CUSTOMER_PERMISSIONS,
  UNIVERSAL_EMPLOYEE_PERMISSIONS,
  ALL_EMPLOYEE_PERMISSIONS,
  cleanPermissionList,
  getSuggestedEmployeeAccess,
  getSuggestedInquiryAccess,
  hasConfiguredEmployeeAccess,
  resolveEffectiveEmployeeAccess,
  userHasPermission,
  userHasAnyPermission,
  PLANNING_LEADERSHIP_PERMISSIONS,
  EMPLOYEE_RESTRICTED_PROJECT_PERMISSIONS,
  PROJECT_PLANNING_DEPARTMENTS,
  isPlanningLeadershipRole,
};
