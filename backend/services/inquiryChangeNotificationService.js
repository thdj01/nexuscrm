'use strict';

const mongoose = require('mongoose');
const Department = require('../models/Department');
const Team = require('../models/Team');
const User = require('../models/User');
const createNotification = require('./notificationService');
const { departmentTokens } = require('../utils/departmentUtils');

const ESTIMATION_TOKEN = 'estimation';

const CHANGE_IGNORED_FIELDS = new Set([
  '_id',
  '__v',
  'createdAt',
  'updatedAt',
  'createdBy',
  'customerRef',
  'projectReference',
  'attachments',
  'bomAttachments',
  'status',
  'statusDetails',
  'nextFollowUpDate',
]);

function toPlain(value) {
  if (!value) return value;
  if (typeof value.toObject === 'function') {
    return value.toObject({ depopulate: true, virtuals: false });
  }
  return value;
}

function extractId(value) {
  if (!value) return '';
  const candidate = value._id || value.id || value;
  if (!candidate) return '';
  if (typeof candidate.toHexString === 'function') return candidate.toHexString();
  return String(candidate);
}

function isObjectIdLike(value) {
  if (!value || typeof value !== 'object') return false;
  return typeof value.toHexString === 'function' || value._bsontype === 'ObjectId';
}

function normalizeDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

function formatDate(value) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function attachmentKey(file = {}) {
  return String(
    file.storedName ||
    file.storagePath ||
    file.originalName ||
    file.name ||
    ''
  ).trim();
}

function attachmentName(file = {}) {
  return String(file.name || file.originalName || file.storedName || 'Document').trim();
}

function getAttachmentChanges(beforeFiles = [], afterFiles = []) {
  const beforeMap = new Map(
    (Array.isArray(beforeFiles) ? beforeFiles : [])
      .map((file) => [attachmentKey(file), file])
      .filter(([key]) => key)
  );
  const afterMap = new Map(
    (Array.isArray(afterFiles) ? afterFiles : [])
      .map((file) => [attachmentKey(file), file])
      .filter(([key]) => key)
  );

  return {
    added: [...afterMap.entries()]
      .filter(([key]) => !beforeMap.has(key))
      .map(([, file]) => attachmentName(file)),
    removed: [...beforeMap.entries()]
      .filter(([key]) => !afterMap.has(key))
      .map(([, file]) => attachmentName(file)),
  };
}

function cleanForComparison(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (isObjectIdLike(value)) return extractId(value);
  if (Array.isArray(value)) return value.map(cleanForComparison);
  if (typeof value !== 'object') return value;

  return Object.keys(value)
    .filter((key) => !CHANGE_IGNORED_FIELDS.has(key))
    .sort()
    .reduce((result, key) => {
      const cleaned = cleanForComparison(value[key]);
      if (cleaned !== undefined) result[key] = cleaned;
      return result;
    }, {});
}

function hasGeneralDetailsChanged(beforeInquiry = {}, afterInquiry = {}) {
  const beforeValue = cleanForComparison(toPlain(beforeInquiry) || {});
  const afterValue = cleanForComparison(toPlain(afterInquiry) || {});
  return JSON.stringify(beforeValue) !== JSON.stringify(afterValue);
}

function truncateNames(names = [], max = 3) {
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}

function buildInquiryChangeItems(beforeInquiry = {}, afterInquiry = {}, options = {}) {
  const before = toPlain(beforeInquiry) || {};
  const after = toPlain(afterInquiry) || {};
  const items = [];

  const beforeStatus = String(before.status || 'New');
  const afterStatus = String(after.status || 'New');
  if (beforeStatus !== afterStatus) {
    items.push(`status changed from ${beforeStatus} to ${afterStatus}`);
  }

  const generalDocuments = getAttachmentChanges(before.attachments, after.attachments);
  if (generalDocuments.added.length) {
    items.push(`attached document${generalDocuments.added.length === 1 ? '' : 's'}: ${truncateNames(generalDocuments.added)}`);
  }
  if (generalDocuments.removed.length) {
    items.push(`removed document${generalDocuments.removed.length === 1 ? '' : 's'}: ${truncateNames(generalDocuments.removed)}`);
  }

  const bomDocuments = getAttachmentChanges(before.bomAttachments, after.bomAttachments);
  if (bomDocuments.added.length) {
    items.push(`attached Technical BOM document${bomDocuments.added.length === 1 ? '' : 's'}: ${truncateNames(bomDocuments.added)}`);
  }
  if (bomDocuments.removed.length) {
    items.push(`removed Technical BOM document${bomDocuments.removed.length === 1 ? '' : 's'}: ${truncateNames(bomDocuments.removed)}`);
  }

  const beforeFollowUp = normalizeDate(before.nextFollowUpDate);
  const afterFollowUp = normalizeDate(after.nextFollowUpDate);
  if (beforeFollowUp !== afterFollowUp) {
    items.push(after.nextFollowUpDate
      ? `follow-up date changed to ${formatDate(after.nextFollowUpDate)}`
      : 'follow-up reminder cleared');
  }

  if (hasGeneralDetailsChanged(before, after)) {
    items.push('inquiry details updated');
  }

  if (options.actionLabel && items.length === 0) {
    items.push(options.actionLabel);
  }

  if (items.length === 0) items.push('inquiry updated');
  return items;
}

function valueMatchesEstimation(value, estimationDepartmentIds = new Set()) {
  if (!value) return false;
  if (Array.isArray(value)) {
    return value.some((item) => valueMatchesEstimation(item, estimationDepartmentIds));
  }

  const id = extractId(value);
  if (id && estimationDepartmentIds.has(id)) return true;
  return departmentTokens(value).some((token) => (
    token === ESTIMATION_TOKEN || token.includes(ESTIMATION_TOKEN)
  ));
}

async function resolveEstimationLeadershipIds() {
  const recipientIds = new Set();

  const departments = await Department.find({ isActive: { $ne: false } })
    .select('_id name code hod hods teamLead')
    .lean();

  const estimationDepartments = departments.filter((department) => (
    valueMatchesEstimation(department.name) || valueMatchesEstimation(department.code)
  ));
  const estimationDepartmentIds = new Set(estimationDepartments.map((department) => extractId(department._id)));

  for (const department of estimationDepartments) {
    [department.hod, ...(department.hods || []), department.teamLead]
      .map(extractId)
      .filter(Boolean)
      .forEach((id) => recipientIds.add(id));
  }

  const teams = await Team.find({ isActive: { $ne: false } })
    .select('_id name description hod teamLead')
    .lean();

  const estimationTeams = teams.filter((team) => (
    valueMatchesEstimation(team.name) || valueMatchesEstimation(team.description)
  ));
  const estimationTeamIds = new Set(estimationTeams.map((team) => extractId(team._id)));

  for (const team of estimationTeams) {
    [team.hod, team.teamLead]
      .map(extractId)
      .filter(Boolean)
      .forEach((id) => recipientIds.add(id));
  }

  // Backward-compatible fallback for databases where hierarchy is saved on
  // User records but Department/Team masters are incomplete.
  const leaders = await User.find({
    isActive: { $ne: false },
    role: { $in: ['hod', 'team_lead'] },
  })
    .select('_id role department hodDepartments teamId')
    .lean();

  for (const leader of leaders) {
    const matchesDepartment = valueMatchesEstimation(leader.department, estimationDepartmentIds) ||
      valueMatchesEstimation(leader.hodDepartments, estimationDepartmentIds);
    const matchesTeam = estimationTeamIds.has(extractId(leader.teamId));
    if (matchesDepartment || matchesTeam) recipientIds.add(extractId(leader._id));
  }

  return [...recipientIds].filter((id) => mongoose.Types.ObjectId.isValid(id));
}

async function resolveInquiryChangeRecipientIds(inquiry = {}) {
  const recipientIds = new Set();
  const creatorId = extractId(inquiry.createdBy);
  if (creatorId && mongoose.Types.ObjectId.isValid(creatorId)) recipientIds.add(creatorId);

  const estimationLeaders = await resolveEstimationLeadershipIds();
  estimationLeaders.forEach((id) => recipientIds.add(id));

  return [...recipientIds];
}

async function notifyInquiryStakeholdersOfChange({
  beforeInquiry,
  afterInquiry,
  actor,
  actionLabel = '',
}) {
  try {
    const after = toPlain(afterInquiry) || {};
    const inquiryId = after.inquiryId || '-';
    const actorName = actor?.name || actor?.email || 'A user';
    const items = buildInquiryChangeItems(beforeInquiry, afterInquiry, { actionLabel });
    const recipientIds = await resolveInquiryChangeRecipientIds(after);

    if (recipientIds.length === 0) {
      console.warn(`[inquiryChangeNotification] No recipients found for inquiry ${inquiryId}`);
      return { recipientIds: [], items };
    }

    const message = `${actorName} changed inquiry ${inquiryId}: ${items.join('; ')}.`;
    const isOnlyStatusChange = items.length === 1 && items[0].startsWith('status changed');

    await Promise.all(recipientIds.map((recipient) => createNotification({
      title: `Inquiry ${inquiryId} Updated`,
      message,
      type: isOnlyStatusChange ? 'status' : 'info',
      priority: 'Medium',
      recipient,
      relatedInquiry: after._id,
    })));

    return { recipientIds, items, message };
  } catch (error) {
    console.error('[inquiryChangeNotification] Failed:', error.message || error);
    return { recipientIds: [], items: [], error: error.message || String(error) };
  }
}

module.exports = {
  buildInquiryChangeItems,
  hasGeneralDetailsChanged,
  resolveEstimationLeadershipIds,
  resolveInquiryChangeRecipientIds,
  notifyInquiryStakeholdersOfChange,
};
