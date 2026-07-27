'use strict';

const crypto = require('crypto');
const nodemailer = require('nodemailer');
const IntegrationSettings = require('../models/IntegrationSettings');

const FALLBACK_HOST = 'smtp.office365.com';
const FALLBACK_PORT = 587;

function getSecretKey() {
  const seed =
    process.env.INTEGRATION_SETTINGS_SECRET ||
    process.env.JWT_SECRET ||
    'nexus-dashboard-integration-settings-secret';

  return crypto.createHash('sha256').update(seed).digest();
}

function encryptSecret(value = '') {
  const plain = String(value || '');
  if (!plain) return '';

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getSecretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

function decryptSecret(value = '') {
  const encryptedValue = String(value || '');
  if (!encryptedValue) return '';

  try {
    const [ivText, tagText, encryptedText] = encryptedValue.split(':');
    if (!ivText || !tagText || !encryptedText) return '';

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getSecretKey(),
      Buffer.from(ivText, 'base64')
    );
    decipher.setAuthTag(Buffer.from(tagText, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedText, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch (err) {
    console.error('[emailSettingsService] Failed to decrypt email password:', err.message);
    return '';
  }
}

async function getSettingsDocument() {
  return IntegrationSettings.findOneAndUpdate(
    { singletonKey: 'default' },
    { $setOnInsert: { singletonKey: 'default' } },
    { new: true, upsert: true }
  );
}

async function getEmailSettings({ includeSecret = false } = {}) {
  const query = IntegrationSettings.findOne({ singletonKey: 'default' });
  if (includeSecret) query.select('+email.passwordEncrypted');

  let settings = await query.lean();
  if (!settings) {
    const created = await getSettingsDocument();
    settings = created.toObject();
  }

  return settings?.email || {};
}

function buildEnvEmailConfig() {
  const username = process.env.OUTLOOK_EMAIL || '';
  const password = process.env.OUTLOOK_PASS || '';

  if (!username || !password) return null;

  return {
    source: 'env',
    host: process.env.OUTLOOK_HOST || FALLBACK_HOST,
    port: Number(process.env.OUTLOOK_PORT || FALLBACK_PORT),
    secure: String(process.env.OUTLOOK_SECURE || 'false') === 'true',
    username,
    password,
    fromEmail: username,
  };
}

async function getActiveEmailConfig() {
  const email = await getEmailSettings({ includeSecret: true });
  const dynamicPassword = decryptSecret(email.passwordEncrypted);

  if (email.isEnabled && email.username && dynamicPassword) {
    return {
      source: 'database',
      host: email.host || FALLBACK_HOST,
      port: Number(email.port || FALLBACK_PORT),
      secure: Boolean(email.secure),
      username: email.username,
      password: dynamicPassword,
      fromEmail: email.fromEmail || email.username,
    };
  }

  return buildEnvEmailConfig();
}

function createTransporter(config) {
  if (!config?.username || !config?.password) return null;

  const port = Number(config.port || FALLBACK_PORT);
  const host = config.host || FALLBACK_HOST;
  const directSsl = port === 465;
  const startTls = port === 587 || Boolean(config.secure);

  return nodemailer.createTransport({
    host,
    port,
    // 465 = direct SSL/TLS. 587 = STARTTLS, so secure must stay false.
    secure: directSsl,
    requireTLS: startTls,
    auth: {
      user: config.username,
      pass: config.password,
    },
    tls: {
      servername: host,
    },
  });
}

async function verifyEmailConfig(config) {
  const transporter = createTransporter(config);
  if (!transporter) {
    return {
      success: false,
      error: 'Email username/password is not configured',
    };
  }

  try {
    await transporter.verify();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      code: err.code || '',
      command: err.command || '',
      responseCode: err.responseCode || null,
    };
  }
}

function sanitizeEmailSettings(email = {}) {
  return {
    isEnabled: Boolean(email.isEnabled),
    provider: email.provider || 'outlook',
    host: email.host || FALLBACK_HOST,
    port: Number(email.port || FALLBACK_PORT),
    secure: Boolean(email.secure),
    username: email.username || '',
    fromEmail: email.fromEmail || email.username || '',
    passwordConfigured: Boolean(email.passwordEncrypted),
    lastVerifiedAt: email.lastVerifiedAt || null,
    lastVerificationStatus: email.lastVerificationStatus || 'Pending',
    lastVerificationError: email.lastVerificationError || '',
  };
}

module.exports = {
  encryptSecret,
  decryptSecret,
  getSettingsDocument,
  getEmailSettings,
  getActiveEmailConfig,
  createTransporter,
  verifyEmailConfig,
  sanitizeEmailSettings,
};
