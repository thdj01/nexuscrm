'use strict';

const fs = require('fs');
const path = require('path');
const multer = require('multer');

const KICKOFF_PROJECT_DOCUMENT_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'projects');
fs.mkdirSync(KICKOFF_PROJECT_DOCUMENT_UPLOAD_DIR, { recursive: true });

const kickoffFinalBomStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, KICKOFF_PROJECT_DOCUMENT_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const base = path.basename(file.originalname || 'final-technical-bom', ext)
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'final-technical-bom';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${base}${ext}`);
  },
});

const kickoffFinalBomUpload = multer({
  storage: kickoffFinalBomStorage,
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
}).single('finalTechnicalBomDocument');

const parseAttendees = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }
};

const mapFinalBomDocument = (file, userId) => {
  if (!file) return undefined;

  return {
    name: file.originalname || file.filename,
    storedName: file.filename,
    storagePath: `projects/${file.filename}`,
    mimeType: file.mimetype || '',
    sizeBytes: Number(file.size || 0),
    uploadedBy: userId,
    uploadedAt: new Date(),
  };
};

const {
  scheduleKickoffForInquiry,
  processDueKickoffWorkflows,
  completeKickoffMeetingAndCreateProject,
  getWorkflowForInquiry,
} = require('../services/kickoffWorkflowService');

const scheduleKickoffMeeting = async (req, res, next) => {
  try {
    const payload = {
      ...(req.body || {}),
      attendees: parseAttendees(req.body?.attendees),
    };

    const finalTechnicalBomDocument = mapFinalBomDocument(req.file, req.user?._id);
    if (finalTechnicalBomDocument) {
      payload.finalTechnicalBomDocument = finalTechnicalBomDocument;
    }

    const workflow = await scheduleKickoffForInquiry({
      inquiryId: req.params.inquiryId,
      payload,
      user: req.user,
    });

    return res.status(201).json({
      success: true,
      message: 'Kick-off Meeting scheduled. Notifications are being sent in the background. Open the Kick-off popup after the meeting and click Kickoff Meeting Done to create the project.',
      data: workflow,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

const getInquiryKickoffWorkflow = async (req, res, next) => {
  try {
    const workflow = await getWorkflowForInquiry(req.params.inquiryId);
    return res.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    next(error);
  }
};


const completeKickoffMeeting = async (req, res, next) => {
  try {
    const result = await completeKickoffMeetingAndCreateProject({
      inquiryId: req.params.inquiryId,
      user: req.user,
    });

    return res.json({
      success: true,
      message: 'Kick-off Meeting marked done and project created successfully.',
      data: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

const processDueKickoffs = async (_req, res, next) => {
  try {
    const result = await processDueKickoffWorkflows();
    return res.json({
      success: true,
      message: `Marked ${result.processed} Kick-off workflow(s) as ready for completion`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  scheduleKickoffMeeting,
  getInquiryKickoffWorkflow,
  completeKickoffMeeting,
  processDueKickoffs,
  kickoffFinalBomUpload,
};
