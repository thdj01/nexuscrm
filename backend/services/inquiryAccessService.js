'use strict';

const mongoose = require('mongoose');
const Department = require('../models/Department');
const Team = require('../models/Team');
const { INQUIRY_PERMISSIONS, userHasPermission } = require('../utils/accessControl');

const extractId = (value) => {
  if (!value) return '';
  if (typeof value === 'object') {
    return String(value._id || value.id || value.value || '');
  }
  return String(value);
};

const normalizeToken = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const addDepartmentTokens = (target, value) => {
  if (!value) return;

  if (typeof value === 'object') {
    [value.name, value.code, value.departmentName, value.departmentCode]
      .filter(Boolean)
      .forEach((item) => target.add(normalizeToken(item)));
    return;
  }

  const text = String(value).trim();
  if (!text || mongoose.Types.ObjectId.isValid(text)) return;
  target.add(normalizeToken(text));
};

const resolveInquiryEditContext = async (user = {}) => {
  const tokens = new Set();
  const departmentIds = [];

  const values = [
    user.department,
    ...(Array.isArray(user.hodDepartments) ? user.hodDepartments : []),
  ].filter(Boolean);

  values.forEach((value) => {
    addDepartmentTokens(tokens, value);
    const id = extractId(value);
    if (mongoose.Types.ObjectId.isValid(id)) departmentIds.push(id);
  });

  if (departmentIds.length > 0) {
    const departments = await Department.find({ _id: { $in: departmentIds } })
      .select('name code')
      .lean();

    departments.forEach((department) => addDepartmentTokens(tokens, department));
  }

  const teamId = extractId(user.teamId);
  if (mongoose.Types.ObjectId.isValid(teamId)) {
    const team = await Team.findById(teamId).select('name').lean();
    if (team?.name) tokens.add(normalizeToken(team.name));
  } else if (user.teamId && typeof user.teamId === 'object') {
    addDepartmentTokens(tokens, user.teamId);
  }

  const isEstimationUser = [...tokens].some((token) => (
    token === 'estimation' ||
    token === 'estimator' ||
    token.startsWith('estimation') ||
    token.startsWith('estimator')
  ));

  const isSalesUser = [...tokens].some((token) => (
    token === 'sales' || token.startsWith('sales')
  ));

  return {
    isAdmin: user?.role === 'admin',
    isEstimationUser,
    isSalesUser,
    departmentTokens: [...tokens],
  };
};

const isInquiryCreator = (user, inquiry) => {
  const userId = extractId(user?._id || user?.id);
  const creatorId = extractId(inquiry?.createdBy);
  return Boolean(userId && creatorId && userId === creatorId);
};

const canUserEditInquiry = (user, inquiry, context = {}) => {
  if (!user || !inquiry) return false;
  if (!userHasPermission(user, INQUIRY_PERMISSIONS.EDIT)) return false;
  if (user.role === 'admin' || context.isAdmin) return true;
  if (context.isEstimationUser) return true;
  return isInquiryCreator(user, inquiry);
};

const canUserCompleteKickoff = (user, inquiry, context = {}) => {
  if (!user || !inquiry) return false;
  if (user.role === 'admin' || context.isAdmin) return true;
  if (context.isEstimationUser) return true;
  const effectiveRole = user.role === 'manager' ? 'hod' : user.role;
  if (context.isSalesUser && ['hod', 'team_lead'].includes(effectiveRole)) return true;
  return isInquiryCreator(user, inquiry);
};

const assertUserCanCompleteKickoff = async (user, inquiry, context) => {
  const resolvedContext = context || await resolveInquiryEditContext(user);

  if (canUserCompleteKickoff(user, inquiry, resolvedContext)) {
    return resolvedContext;
  }

  const error = new Error(
    'Only Sales HOD/TL, the inquiry creator, an Estimation user, or an Admin can complete the kickoff'
  );
  error.statusCode = 403;
  error.isOperational = true;
  throw error;
};

const assertUserCanEditInquiry = async (user, inquiry, context) => {
  const resolvedContext = context || await resolveInquiryEditContext(user);

  if (canUserEditInquiry(user, inquiry, resolvedContext)) {
    return resolvedContext;
  }

  const error = new Error(
    'Only the inquiry creator, an Estimation user, or an Admin can modify this inquiry'
  );
  error.statusCode = 403;
  error.isOperational = true;
  throw error;
};

module.exports = {
  extractId,
  resolveInquiryEditContext,
  isInquiryCreator,
  canUserEditInquiry,
  assertUserCanEditInquiry,
  canUserCompleteKickoff,
  assertUserCanCompleteKickoff,
};
