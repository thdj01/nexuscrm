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
  downloadInquiryPdf,
  downloadInquiryAttachment,
  uploadMiddleware,
} = require('../controllers/inquiryController');
const { protect } = require('../middleware/authMiddleware');
const {
  requirePermission,
  requireAnyPermission,
} = require('../middleware/permissionMiddleware');
const { INQUIRY_PERMISSIONS } = require('../constants/permissions');
const { requireInquiryEditAccess } = require('../middleware/inquiryAccessMiddleware');

router.use(protect);

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

router.get(
  '/:id/attachments/:fileKey',
  requireAnyPermission(
    INQUIRY_PERMISSIONS.VIEW,
    INQUIRY_PERMISSIONS.EDIT
  ),
  downloadInquiryAttachment
);

router.patch(
  '/:id/status',
  requirePermission(INQUIRY_PERMISSIONS.EDIT),
  requireInquiryEditAccess('id'),
  uploadMiddleware,
  updateInquiryStatus
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
    requireInquiryEditAccess('id'),
    uploadMiddleware,
    updateInquiry
  );

module.exports = router;
