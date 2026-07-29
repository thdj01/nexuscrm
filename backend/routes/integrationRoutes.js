'use strict';

const express = require('express');
const {
  getIntegrationStatus,
  getEmailIntegration,
  updateEmailIntegration,
  verifyEmailIntegration,
  getWhatsappSettingsIntegration,
  updateWhatsappSettingsIntegration,
  getWhatsappIntegration,
  restartWhatsappIntegration,
  logoutWhatsappIntegration,
  testWhatsappNumber,
  testWhatsappGroup,
  getWhatsappGroups,
} = require('../controllers/integrationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required.',
    });
  }

  next();
};

router.use(protect, requireAdmin);

router.get('/status', getIntegrationStatus);

router.get('/email', getEmailIntegration);
router.put('/email', updateEmailIntegration);
router.post('/email/verify', verifyEmailIntegration);

router.get('/whatsapp/settings', getWhatsappSettingsIntegration);
router.put('/whatsapp/settings', updateWhatsappSettingsIntegration);
router.get('/whatsapp/status', getWhatsappIntegration);
router.post('/whatsapp/restart', restartWhatsappIntegration);
router.post('/whatsapp/logout', logoutWhatsappIntegration);
router.post('/whatsapp/test-number', testWhatsappNumber);
router.post('/whatsapp/test-group', testWhatsappGroup);
router.get('/whatsapp/groups', getWhatsappGroups);

module.exports = router;
