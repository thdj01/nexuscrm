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
  getWhatsAppSettings,
  getActiveWhatsAppConfig,
  refreshWhatsAppRuntimeConfig,
  sanitizeWhatsAppSettings,
  normalizePhoneNumber,
  normalizeGroupId,
  normalizeClientId,
} = require('../services/whatsappSettingsService');
const {
  getWhatsAppStatus,
  restartWhatsApp,
  logoutWhatsApp,
  listWhatsAppGroups,
  sendTestMessage,
  sendTestGroupMessage,
} = require('../services/whatsappService');

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
}

async function getIntegrationStatus(_req, res, next) {
  try {
    const [email, whatsappSettings] = await Promise.all([
      getEmailSettings({ includeSecret: true }),
      getWhatsAppSettings(),
    ]);

    res.json({
      success: true,
      data: {
        whatsapp: getWhatsAppStatus(),
        whatsappSettings: sanitizeWhatsAppSettings(whatsappSettings),
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

async function getWhatsappSettingsIntegration(_req, res, next) {
  try {
    const settings = await getWhatsAppSettings();
    res.json({ success: true, data: sanitizeWhatsAppSettings(settings) });
  } catch (err) {
    next(err);
  }
}

async function updateWhatsappSettingsIntegration(req, res, next) {
  try {
    const body = req.body || {};
    const notifyNumber = normalizePhoneNumber(body.notifyNumber || '');
    const groupId = normalizeGroupId(body.groupId || '');
    const clientId = normalizeClientId(body.clientId || 'nexus-session');
    const isEnabled = Boolean(body.isEnabled);

    if (body.notifyNumber && (notifyNumber.length < 10 || notifyNumber.length > 15)) {
      return next(createError('WhatsApp notification number must contain 10 to 15 digits including country code.', 400));
    }

    if (body.groupId && !groupId) {
      return next(createError('WhatsApp group ID is invalid. Load groups and select a valid group.', 400));
    }

    const previousConfig = getActiveWhatsAppConfig();

    const saved = await IntegrationSettings.findOneAndUpdate(
      { singletonKey: 'default' },
      {
        $set: {
          'whatsapp.isConfigured': true,
          'whatsapp.isEnabled': isEnabled,
          'whatsapp.notifyNumber': notifyNumber,
          'whatsapp.groupId': groupId,
          'whatsapp.groupName': String(body.groupName || '').trim(),
          'whatsapp.allowUnknownSenders': Boolean(body.allowUnknownSenders),
          'whatsapp.clientId': clientId,
          'whatsapp.lastSavedAt': new Date(),
          updatedBy: req.user?._id,
        },
        $setOnInsert: { singletonKey: 'default' },
      },
      { new: true, upsert: true }
    ).lean();

    const activeConfig = await refreshWhatsAppRuntimeConfig();
    const statusBeforeRestart = getWhatsAppStatus();
    const restartRequired =
      previousConfig.isEnabled !== activeConfig.isEnabled ||
      previousConfig.clientId !== activeConfig.clientId ||
      (activeConfig.isEnabled && !statusBeforeRestart.hasClient);

    const whatsappStatus = restartRequired
      ? await restartWhatsApp({ clearSession: false })
      : getWhatsAppStatus();

    res.json({
      success: true,
      message: restartRequired
        ? 'WhatsApp settings saved and client restarted.'
        : 'WhatsApp settings saved successfully.',
      data: {
        settings: sanitizeWhatsAppSettings(activeConfig),
        whatsapp: whatsappStatus,
      },
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

async function testWhatsappNumber(req, res, next) {
  try {
    const result = await sendTestMessage();

    return res.status(result.ok ? 200 : 400).json({
      success: result.ok,
      message: result.ok
        ? 'WhatsApp direct test message sent successfully.'
        : 'WhatsApp direct test failed.',
      data: result,
      error: result.error || '',
    });
  } catch (err) {
    next(err);
  }
}

async function testWhatsappGroup(req, res, next) {
  try {
    const result = await sendTestGroupMessage();

    return res.status(result.ok ? 200 : 400).json({
      success: result.ok,
      message: result.ok
        ? 'WhatsApp group test message sent successfully.'
        : 'WhatsApp group test failed.',
      data: result,
      error: result.error || '',
    });
  } catch (err) {
    next(err);
  }
}

async function getWhatsappGroups(_req, res, next) {
  try {
    const result = await listWhatsAppGroups();
    const message = result.ok
      ? (result.groups.length > 0
          ? `${result.groups.length} WhatsApp group(s) loaded.`
          : (result.warning || 'WhatsApp is connected, but no groups were found.'))
      : 'Could not load WhatsApp groups.';

    return res.status(result.ok ? 200 : 400).json({
      success: result.ok,
      message,
      data: result,
      warning: result.warning || '',
      error: result.error || '',
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
  getWhatsappSettingsIntegration,
  updateWhatsappSettingsIntegration,
  getWhatsappIntegration,
  restartWhatsappIntegration,
  logoutWhatsappIntegration,
  testWhatsappNumber,
  testWhatsappGroup,
  getWhatsappGroups,
};
