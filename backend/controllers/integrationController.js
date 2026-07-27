'use strict';

const IntegrationSettings = require('../models/IntegrationSettings');
const {
  encryptSecret,
  decryptSecret,
  getEmailSettings,
  sanitizeEmailSettings,
  verifyEmailConfig,
} = require('../services/emailSettingsService');
const {
  getWhatsAppStatus,
  restartWhatsApp,
  logoutWhatsApp,
} = require('../services/whatsappService');

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
}

async function getIntegrationStatus(_req, res, next) {
  try {
    const email = await getEmailSettings({ includeSecret: true });

    res.json({
      success: true,
      data: {
        whatsapp: getWhatsAppStatus(),
        email: sanitizeEmailSettings(email),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getEmailIntegration(_req, res, next) {
  try {
    const email = await getEmailSettings({ includeSecret: true });
    res.json({ success: true, data: sanitizeEmailSettings(email) });
  } catch (err) {
    next(err);
  }
}

async function updateEmailIntegration(req, res, next) {
  try {
    const body = req.body || {};
    const port = Number(body.port || 587);

    if (!body.username && body.isEnabled) {
      return next(createError('Email username is required when email integration is enabled.', 400));
    }

    if (!Number.isFinite(port) || port <= 0) {
      return next(createError('Email SMTP port is invalid.', 400));
    }

    const settings = await IntegrationSettings.findOne({ singletonKey: 'default' })
      .select('+email.passwordEncrypted');

    const update = {
      'email.isEnabled': Boolean(body.isEnabled),
      'email.provider': body.provider || 'outlook',
      'email.host': body.host || 'smtp.office365.com',
      'email.port': port,
      'email.secure': Boolean(body.secure),
      'email.username': String(body.username || '').trim().toLowerCase(),
      'email.fromEmail': String(body.fromEmail || body.username || '').trim().toLowerCase(),
      updatedBy: req.user?._id,
    };

    if (String(body.password || '').trim()) {
      update['email.passwordEncrypted'] = encryptSecret(body.password);
      update['email.lastVerificationStatus'] = 'Pending';
      update['email.lastVerificationError'] = '';
    } else if (!settings?.email?.passwordEncrypted && body.isEnabled) {
      return next(createError('Email password/app password is required when enabling email integration.', 400));
    }

    const saved = await IntegrationSettings.findOneAndUpdate(
      { singletonKey: 'default' },
      { $set: update, $setOnInsert: { singletonKey: 'default' } },
      { new: true, upsert: true }
    ).select('+email.passwordEncrypted');

    res.json({
      success: true,
      message: 'Email integration settings saved successfully.',
      data: sanitizeEmailSettings(saved.email),
    });
  } catch (err) {
    next(err);
  }
}

async function verifyEmailIntegration(req, res, next) {
  try {
    const body = req.body || {};
    const hasBodyConfig = Object.keys(body).length > 0;

    const settings = await IntegrationSettings.findOne({ singletonKey: 'default' })
      .select('+email.passwordEncrypted');

    const email = settings?.email || {};
    const savedPassword = decryptSecret(email.passwordEncrypted);
    const password = String(body.password || '').trim() || savedPassword;

    const testConfig = {
      host: body.host || email.host || 'smtp.office365.com',
      port: Number(body.port || email.port || 587),
      secure: hasBodyConfig ? Boolean(body.secure) : Boolean(email.secure),
      username: String(body.username || email.username || '').trim().toLowerCase(),
      password,
      fromEmail: String(body.fromEmail || email.fromEmail || body.username || email.username || '').trim().toLowerCase(),
    };

    if (!testConfig.username || !testConfig.password) {
      return next(createError('Email/Login ID and password/app password are required for verification.', 400));
    }

    const result = await verifyEmailConfig(testConfig);

    const statusUpdate = {
      'email.lastVerifiedAt': new Date(),
      'email.lastVerificationStatus': result.success ? 'Success' : 'Failed',
      'email.lastVerificationError': result.error || '',
      updatedBy: req.user?._id,
    };

    const saved = await IntegrationSettings.findOneAndUpdate(
      { singletonKey: 'default' },
      { $set: statusUpdate, $setOnInsert: { singletonKey: 'default' } },
      { new: true, upsert: true }
    ).select('+email.passwordEncrypted');

    res.status(result.success ? 200 : 400).json({
      success: result.success,
      message: result.success
        ? 'Email login verified successfully.'
        : 'Email verification failed.',
      error: result.error || '',
      code: result.code || '',
      command: result.command || '',
      responseCode: result.responseCode || null,
      data: sanitizeEmailSettings(saved.email),
    });
  } catch (err) {
    next(err);
  }
}

function getWhatsappIntegration(_req, res) {
  res.json({ success: true, data: getWhatsAppStatus() });
}

async function restartWhatsappIntegration(_req, res, next) {
  try {
    const status = await restartWhatsApp({ clearSession: false });
    res.json({
      success: true,
      message: 'WhatsApp client restart requested.',
      data: status,
    });
  } catch (err) {
    next(err);
  }
}

async function logoutWhatsappIntegration(_req, res, next) {
  try {
    const status = await logoutWhatsApp({ clearSession: true });
    res.json({
      success: true,
      message: 'WhatsApp session cleared. Scan the new QR when it appears.',
      data: status,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getIntegrationStatus,
  getEmailIntegration,
  updateEmailIntegration,
  verifyEmailIntegration,
  getWhatsappIntegration,
  restartWhatsappIntegration,
  logoutWhatsappIntegration,
};
