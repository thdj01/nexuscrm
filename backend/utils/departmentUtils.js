'use strict';

const ALIASES = Object.freeze({
  programmer: 'automation',
  program: 'automation',
  programs: 'automation',
  software: 'automation',
  developer: 'automation',
  development: 'automation',
  prod: 'production',
  manufacturing: 'production',
  mfg: 'production',
  admin: 'admin',
  administration: 'admin',
  sales: 'sales',
  sale: 'sales',
  estimation: 'estimation',
  estimate: 'estimation',
  estimator: 'estimation',
  estimates: 'estimation',
  design: 'design',
  designer: 'design',
  electrical: 'electrical',
  electric: 'electrical',
  automation: 'automation',
  purchase: 'purchase',
  procurement: 'purchase',
  qc: 'qc',
  quality: 'qc',
  qualitycontrol: 'qc',
  qa: 'qc',
  production: 'production',
  store: 'store',
  stores: 'store',
  dispatch: 'store',
  despatch: 'store',
  pm: 'pm',
  projectmanagement: 'pm',
  projectmanager: 'pm',
  customer: 'customer',
  all: 'all',
});

function normalizeToken(value) {
  const key = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return ALIASES[key] || key;
}

function departmentTokens(value) {
  if (!value) return [];
  const raw = typeof value === 'object'
    ? (value.name || value.code || value._id || value.id || '')
    : value;
  return String(raw)
    .split(/[\/,+&|]/)
    .map((part) => normalizeToken(part.trim()))
    .filter(Boolean);
}

function departmentAllowsAll(value) {
  return departmentTokens(value).includes('all');
}

function departmentMatchesUserTeam(department, teamName) {
  if (!department) return true; // legacy/custom rows without a department remain assignable
  const deptTokens = departmentTokens(department);
  if (deptTokens.length === 0 || deptTokens.includes('all')) return true;
  const teamTokens = departmentTokens(teamName);
  if (teamTokens.length === 0) return false;
  return deptTokens.some((token) => teamTokens.includes(token));
}

module.exports = {
  normalizeToken,
  departmentTokens,
  departmentAllowsAll,
  departmentMatchesUserTeam,
};