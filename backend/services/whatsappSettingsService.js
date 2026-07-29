'use strict';

const IntegrationSettings = require('../models/IntegrationSettings');

const DEFAULT_CLIENT_ID = 'nexus-session';

function isTruthy(value) {
  return ['true', '1', 'yes', 'y', 'on'].includes(String(value || '').trim().toLowerCase());
}

function isEnabledValue(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  return !['false', '0', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

function normalizePhoneNumber(value = '') {
  return String(value || '').replace(/\D/g, '').slice(0, 15);
}

function normalizeGroupId(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d+@g\.us$/i.test(raw)) return raw.toLowerCase();

  const digits = raw.replace(/\D/g, '');
  return digits ? `${digits}@g.us` : '';
}

function normalizeClientId(value = '') {
  const normalized = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

  return normalized || DEFAULT_CLIENT_ID;
}

function buildEnvWhatsAppConfig() {
  return {
    source: 'env',
    isConfigured: false,
    isEnabled: isEnabledValue(process.env.WHATSAPP_ENABLED, true),
    notifyNumber: normalizePhoneNumber(process.env.WHATSAPP_NOTIFY_NUMBER || ''),
    groupId: normalizeGroupId(process.env.WHATSAPP_GROUP_ID || ''),
    groupName: '',
    allowUnknownSenders: isTruthy(process.env.WHATSAPP_ALLOW_UNKNOWN_SENDERS),
    clientId: normalizeClientId(process.env.WHATSAPP_CLIENT_ID || DEFAULT_CLIENT_ID),
    lastSavedAt: null,
  };
}

function normalizeDatabaseConfig(whatsapp = {}) {
  return {
    source: 'database',
    isConfigured: true,
    isEnabled: Boolean(whatsapp.isEnabled),
    notifyNumber: normalizePhoneNumber(whatsapp.notifyNumber || ''),
    groupId: normalizeGroupId(whatsapp.groupId || ''),
    groupName: String(whatsapp.groupName || '').trim(),
    allowUnknownSenders: Boolean(whatsapp.allowUnknownSenders),
    clientId: normalizeClientId(whatsapp.clientId || DEFAULT_CLIENT_ID),
    lastSavedAt: whatsapp.lastSavedAt || null,
  };
}

let runtimeConfig = buildEnvWhatsAppConfig();

async function getWhatsAppSettings() {
  const settings = await IntegrationSettings.findOne({ singletonKey: 'default' })
    .select('whatsapp')
    .lean();

  if (settings?.whatsapp?.isConfigured) {
    return normalizeDatabaseConfig(settings.whatsapp);
  }

  return buildEnvWhatsAppConfig();
}

async function refreshWhatsAppRuntimeConfig() {
  runtimeConfig = await getWhatsAppSettings();
  return { ...runtimeConfig };
}

function getActiveWhatsAppConfig() {
  return { ...runtimeConfig };
}

function setActiveWhatsAppConfig(config = {}) {
  runtimeConfig = config?.source === 'database' || config?.isConfigured
    ? normalizeDatabaseConfig(config)
    : buildEnvWhatsAppConfig();
  return { ...runtimeConfig };
}

function sanitizeWhatsAppSettings(config = {}) {
  const normalized = config?.source === 'database' || config?.isConfigured
    ? normalizeDatabaseConfig(config)
    : {
        ...buildEnvWhatsAppConfig(),
        ...config,
        notifyNumber: normalizePhoneNumber(config.notifyNumber || ''),
        groupId: normalizeGroupId(config.groupId || ''),
        clientId: normalizeClientId(config.clientId || DEFAULT_CLIENT_ID),
      };

  return {
    source: normalized.source || 'env',
    isConfigured: Boolean(normalized.isConfigured),
    isEnabled: Boolean(normalized.isEnabled),
    notifyNumber: normalized.notifyNumber || '',
    groupId: normalized.groupId || '',
    groupName: normalized.groupName || '',
    allowUnknownSenders: Boolean(normalized.allowUnknownSenders),
    clientId: normalized.clientId || DEFAULT_CLIENT_ID,
    lastSavedAt: normalized.lastSavedAt || null,
  };
}

module.exports = {
  DEFAULT_CLIENT_ID,
  normalizePhoneNumber,
  normalizeGroupId,
  normalizeClientId,
  buildEnvWhatsAppConfig,
  getWhatsAppSettings,
  refreshWhatsAppRuntimeConfig,
  getActiveWhatsAppConfig,
  setActiveWhatsAppConfig,
  sanitizeWhatsAppSettings,
};
