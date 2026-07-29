// backend/routes/inquiryRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const {
  getInquiries,
  getInquiry,
  createInquiry,
  updateInquiry,
  updateInquiryStatus,
  updateInquiryFollowUp,
  getFollowUps,
  downloadInquiryPdf,
  uploadMiddleware,
} = require('../controllers/inquiryController');
const { protect } = require('../middleware/authMiddleware');
const {
  requirePermission,
  requireAnyPermission,
} = require('../middleware/permissionMiddleware');
const { INQUIRY_PERMISSIONS } = require('../constants/permissions');

router.use(protect);

router.get(
  '/follow-ups',
  requirePermission(INQUIRY_PERMISSIONS.FOLLOW_UP),
  getFollowUps
);

router.route('/')
  .get(requirePermission(INQUIRY_PERMISSIONS.VIEW), getInquiries)
  .post(
    requirePermission(INQUIRY_PERMISSIONS.CREATE),
    uploadMiddleware,
    createInquiry
  );

router.get(
  '/:id/pdf',
  requireAnyPermission(
    INQUIRY_PERMISSIONS.VIEW,
    INQUIRY_PERMISSIONS.EDIT
  ),
  downloadInquiryPdf
);

router.patch(
  '/:id/status',
  requirePermission(INQUIRY_PERMISSIONS.EDIT),
  uploadMiddleware,
  updateInquiryStatus
);

router.patch(
  '/:id/follow-up',
  requirePermission(INQUIRY_PERMISSIONS.FOLLOW_UP),
  updateInquiryFollowUp
);

router.route('/:id')
  .get(
    requireAnyPermission(
      INQUIRY_PERMISSIONS.VIEW,
      INQUIRY_PERMISSIONS.EDIT
    ),
    getInquiry
  )
  .put(
    requirePermission(INQUIRY_PERMISSIONS.EDIT),
    uploadMiddleware,
    updateInquiry
  );

module.exports = router;
