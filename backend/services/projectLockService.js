'use strict';

const mongoose = require('mongoose');
const Project = require('../models/Project');
const Inquiry = require('../models/Inquiry');

const LOCKED_INQUIRY_STATUSES = new Set([
  'order lost',
  'project lost',
  'inquiry lost',
  'inq. lost',
  'inquiry hold',
  'hold',
]);

const normalizeStatus = (value) => String(value || '').trim().toLowerCase();

const isInquiryStatusProjectLocked = (status) => LOCKED_INQUIRY_STATUSES.has(normalizeStatus(status));

const hasInquirySource = (project = {}) => Boolean(
  project?.inquiryReference
  || (
    project?.sourceInquirySnapshot
    && typeof project.sourceInquirySnapshot === 'object'
    && Object.keys(project.sourceInquirySnapshot).length > 0
  )
);

const getPopulatedInquiryStatus = (project = {}) => {
  const inquiryReference = project?.inquiryReference;
  if (inquiryReference && typeof inquiryReference === 'object') {
    return String(inquiryReference.status || '').trim();
  }
  return '';
};

const getProjectLockStateFromProject = (project = {}) => {
  const linkedToInquiry = hasInquirySource(project);
  const sourceStatus = getPopulatedInquiryStatus(project);
  const locked = Boolean(linkedToInquiry && sourceStatus && isInquiryStatusProjectLocked(sourceStatus));

  return {
    locked,
    source: linkedToInquiry ? 'INQUIRY' : 'DIRECT',
    status: sourceStatus,
    reason: locked
      ? `Linked inquiry status is ${sourceStatus}. Change the inquiry status back to Project Won to unlock this project.`
      : '',
  };
};

const resolveLinkedInquiry = async (project = {}) => {
  const inquiryReference = project?.inquiryReference;
  let inquiryId = inquiryReference;

  if (
    inquiryReference
    && typeof inquiryReference === 'object'
    && !(inquiryReference instanceof mongoose.Types.ObjectId)
  ) {
    inquiryId = inquiryReference._id || inquiryReference.id || inquiryReference;
  }

  if (inquiryId && mongoose.Types.ObjectId.isValid(inquiryId)) {
    const inquiry = await Inquiry.findById(inquiryId).select('_id inquiryId status').lean();
    if (inquiry) return inquiry;
  }

  const snapshotInquiryId = String(project?.sourceInquirySnapshot?.inquiryId || '').trim();
  if (snapshotInquiryId) {
    const inquiry = await Inquiry.findOne({ inquiryId: snapshotInquiryId }).select('_id inquiryId status').lean();
    if (inquiry) return inquiry;
  }

  return null;
};

const resolveProjectLockState = async (projectOrId) => {
  let project = projectOrId;
  const isObjectIdValue = projectOrId instanceof mongoose.Types.ObjectId;
  const looksLikeProject = Boolean(
    projectOrId
    && typeof projectOrId === 'object'
    && !Array.isArray(projectOrId)
    && !isObjectIdValue
    && (
      Object.prototype.hasOwnProperty.call(projectOrId, 'inquiryReference')
      || Object.prototype.hasOwnProperty.call(projectOrId, 'sourceInquirySnapshot')
      || Object.prototype.hasOwnProperty.call(projectOrId, 'projectId')
    )
  );

  if (!looksLikeProject) {
    if (!projectOrId || !mongoose.Types.ObjectId.isValid(String(projectOrId))) {
      return { locked: false, source: 'DIRECT', status: '', reason: '' };
    }
    project = await Project.findById(projectOrId)
      .select('_id inquiryReference sourceInquirySnapshot')
      .lean();
  }

  if (!project || !hasInquirySource(project)) {
    return { locked: false, source: 'DIRECT', status: '', reason: '' };
  }

  const inquiry = await resolveLinkedInquiry(project);
  const sourceStatus = String(inquiry?.status || getPopulatedInquiryStatus(project) || '').trim();
  const locked = Boolean(sourceStatus && isInquiryStatusProjectLocked(sourceStatus));

  return {
    locked,
    source: 'INQUIRY',
    status: sourceStatus,
    inquiryId: inquiry?.inquiryId || project?.sourceInquirySnapshot?.inquiryId || '',
    reason: locked
      ? `Linked inquiry status is ${sourceStatus}. Change the inquiry status back to Project Won to unlock this project.`
      : '',
  };
};

const requireUnlockedProject = async (req, res, next) => {
  try {
    const state = await resolveProjectLockState(req.params?.id);
    req.projectLockState = state;

    if (!state.locked) return next();

    return res.status(423).json({
      success: false,
      code: 'PROJECT_LOCKED_BY_INQUIRY_STATUS',
      message: state.reason,
      projectLock: state,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  LOCKED_INQUIRY_STATUSES,
  isInquiryStatusProjectLocked,
  getProjectLockStateFromProject,
  resolveProjectLockState,
  requireUnlockedProject,
};
