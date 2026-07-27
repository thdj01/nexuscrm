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

const getSuggestedEmployeeAccess = async (user = {}) => {
  if (user.role === ROLES.ADMIN) return [...ALL_EMPLOYEE_PERMISSIONS];

  const permissions = new Set(UNIVERSAL_EMPLOYEE_PERMISSIONS);
  const departments = await resolveDepartmentNames(user);

  if (departments.has('SALES') || departments.has('ESTIMATION')) {
    ALL_INQUIRY_PERMISSIONS.forEach((permission) => permissions.add(permission));
  }

  if (departments.has('SALES')) {
    ALL_CUSTOMER_PERMISSIONS.forEach((permission) => permissions.add(permission));
  }

  if (
    departments.has('DESIGN') ||
    departments.has('AUTOMATION') ||
    departments.has('PRODUCTION')
  ) {
    ALL_PROJECT_PERMISSIONS.forEach((permission) => permissions.add(permission));
  }

  return ALL_EMPLOYEE_PERMISSIONS.filter((permission) => permissions.has(permission));
};

// Backward-compatible export name retained for existing imports.
const getSuggestedInquiryAccess = getSuggestedEmployeeAccess;

const hasConfiguredEmployeeAccess = (user = {}) => Array.isArray(user.employeeAccess);

const resolveEffectiveEmployeeAccess = async (user = {}) => {
  if (user.role === ROLES.ADMIN) return [...ALL_EMPLOYEE_PERMISSIONS];
  if (hasConfiguredEmployeeAccess(user)) return cleanPermissionList(user.employeeAccess);
  return getSuggestedEmployeeAccess(user);
};

const userHasPermission = (user, permission) => {
  if (!user || !permission) return false;
  if (user.role === ROLES.ADMIN) return true;
  if (UNIVERSAL_EMPLOYEE_PERMISSIONS.includes(permission)) return true;
  return Array.isArray(user.employeeAccess) && user.employeeAccess.includes(permission);
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
};
