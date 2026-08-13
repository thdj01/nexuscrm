'use strict';

const mongoose = require('mongoose');
const Department = require('../models/Department');
const Team = require('../models/Team');
const User = require('../models/User');
const { departmentTokens } = require('../utils/departmentUtils');
const {
  buildInquiryEmailHtml,
  buildInquiryChangedWhatsAppMessage,
} = require('./notificationTemplates');
const { dispatchNotificationsToUsers } = require('./userNotificationDispatchService');
const {
  combineUsers,
  getAdminUsers,
  getDepartmentLeadershipUsers,
  getEstimationUsers,
  idString,
} = require('./notificationRecipientService');

const ESTIMATION_TOKEN = 'estimation';
const INQUIRY_OWNER_DEPARTMENTS = ['sales'];

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

async function resolveEstimationLeadershipIds() {
  // Kept for compatibility with older callers. The new rule intentionally
  // includes every active Estimation user, not only HOD/TL.
  const users = await getEstimationUsers();
  return users.map((user) => idString(user)).filter(Boolean);
}

async function resolveInquiryChangeRecipientUsers(inquiry = {}, { includeEstimation = false } = {}) {
  const creatorId = extractId(inquiry.createdBy);
  const [admins, inquiryLeadership, estimationUsers, creator] = await Promise.all([
    getAdminUsers(),
    getDepartmentLeadershipUsers(INQUIRY_OWNER_DEPARTMENTS),
    includeEstimation ? getEstimationUsers() : Promise.resolve([]),
    creatorId && mongoose.Types.ObjectId.isValid(creatorId)
      ? User.findOne({ _id: creatorId, isActive: { $ne: false } })
          .select('_id name email phone mobileNumber whatsappNumber mobile role department hodDepartments teamId')
          .lean()
      : Promise.resolve(null),
  ]);

  // Employees receive notifications only for their own inquiry. Sales HOD/TL
  // receive every inquiry update because Sales owns the inquiry workflow.
  // Estimation receives status changes as required by the inquiry hand-off.
  return combineUsers(
    admins,
    inquiryLeadership,
    estimationUsers,
    creator ? [creator] : []
  );
}

async function resolveInquiryChangeRecipientIds(inquiry = {}, options = {}) {
  const users = await resolveInquiryChangeRecipientUsers(inquiry, options);
  return users.map((user) => idString(user)).filter(Boolean);
}

async function notifyInquiryStakeholdersOfChange({
  beforeInquiry,
  afterInquiry,
  actor,
  actionLabel = '',
}) {
  try {
    const before = toPlain(beforeInquiry) || {};
    const after = toPlain(afterInquiry) || {};
    const inquiryId = after.inquiryId || '-';
    const actorName = actor?.name || actor?.email || 'A user';
    const items = buildInquiryChangeItems(before, after, { actionLabel });
    const previousStatus = String(before.status || 'New');
    const currentStatus = String(after.status || 'New');
    const statusChanged = previousStatus !== currentStatus;
    const recipientUsers = await resolveInquiryChangeRecipientUsers(after, {
      includeEstimation: statusChanged,
    });
    const recipientIds = recipientUsers.map((user) => idString(user)).filter(Boolean);

    if (recipientUsers.length === 0) {
      console.warn(`[inquiryChangeNotification] No recipients found for inquiry ${inquiryId}`);
      return { recipientIds: [], items };
    }

    const creatorId = extractId(after.createdBy);
    const creator = recipientUsers.find((user) => idString(user) === creatorId);
    const notificationInquiry = {
      ...after,
      createdBy: after.createdBy?.name ? after.createdBy : (creator || after.createdBy),
    };
    const message = `${actorName} changed inquiry ${inquiryId}: ${items.join('; ')}.`;
    const eventType = statusChanged ? 'inquiry_status_changed' : 'inquiry_updated';

    await dispatchNotificationsToUsers({
      users: recipientUsers,
      excludeUserIds: [actor?._id || actor?.id],
      title: `Inquiry ${inquiryId} Updated`,
      message,
      type: statusChanged ? 'status' : 'info',
      priority: 'Medium',
      relatedInquiry: after._id,
      emailSubject: statusChanged
        ? `Inquiry Status Changed - ${inquiryId}`
        : `Inquiry Updated - ${inquiryId}`,
      emailHtml: (user) => buildInquiryEmailHtml(notificationInquiry, {
        eventType,
        previousStatus,
        actorName,
        recipientName: user?.name,
      }),
      whatsappMessage: buildInquiryChangedWhatsAppMessage(notificationInquiry, {
        eventType,
        previousStatus,
        actorName,
      }),
    });

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
  resolveInquiryChangeRecipientUsers,
  resolveInquiryChangeRecipientIds,
  notifyInquiryStakeholdersOfChange,
};
