'use strict';

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  requirePermission,
  requireAnyPermission,
} = require('../middleware/permissionMiddleware');
const { INQUIRY_PERMISSIONS } = require('../constants/permissions');
const {
  requireInquiryEditAccess,
  requireKickoffCompletionAccess,
} = require('../middleware/inquiryAccessMiddleware');
const {
  scheduleKickoffMeeting,
  getInquiryKickoffWorkflow,
  completeKickoffMeeting,
  processDueKickoffs,
  kickoffFinalBomUpload,
} = require('../controllers/kickoffWorkflowController');

router.use(protect);

router.post('/:inquiryId/schedule', requirePermission(INQUIRY_PERMISSIONS.EDIT), requireInquiryEditAccess('inquiryId'), kickoffFinalBomUpload, scheduleKickoffMeeting);
router.post(
  '/:inquiryId/complete',
  requireKickoffCompletionAccess('inquiryId'),
  completeKickoffMeeting
);
router.get('/:inquiryId', requireAnyPermission(INQUIRY_PERMISSIONS.VIEW, INQUIRY_PERMISSIONS.EDIT), getInquiryKickoffWorkflow);
router.post('/process/due', authorize('admin'), processDueKickoffs);

module.exports = router;
