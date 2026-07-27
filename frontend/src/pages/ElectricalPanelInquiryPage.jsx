// ─────────────────────────────────────────────────────────────────────────────
// ElectricalPanelInquiryPage.jsx
// Route: /inquiries/new  and  /inquiries/:id/edit
// Drop into: frontend/src/pages/ElectricalPanelInquiryPage.jsx
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Building2, FolderOpen, Zap, Settings, Cpu, Shield,
  ChevronLeft, AlertCircle, CheckCircle2,
  ClipboardCheck, Info, Edit2, Download,
} from 'lucide-react';

import API from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { CUSTOMER_PERMISSIONS, INQUIRY_PERMISSIONS } from '../constants/permissions';
import Spinner from '../components/common/Spinner';
import Modal from '../components/common/Modal';
import CustomerForm from '../components/customer/CustomerForm';
import PageHeader from '../components/common/PageHeader';
import StickyActionBar from '../components/common/StickyActionBar';

import {
  Button,
  SectionCard,
  StepProgressBar,
} from '../components/common/FormComponents.extended';

import CommonInquirySections, { INQUIRY_STATUS_OPTIONS } from '../components/inquiry/forms/CommonInquirySections';
import VfdInquirySections from '../components/inquiry/forms/VfdInquirySections';

import {
  PANEL_TYPES,
  VOLTAGE_OPTIONS,
  DEFAULT_LOAD_ROW,
} from '../data/masterData';

import {
  INQUIRY_TYPES,
  defaultPlcDetails,
  defaultVfdDetails,
  defaultMccDetails,
  defaultFlpEnclosureDetails,
  defaultRioBoxDetails,
  RIO_IO_SIGNAL_ROWS,
  defaultVfdLoadRow,
  defaultMccLoadRow,
  getProductTypeFromInquiryType,
  getPanelTypesFromInquiryType,
  inferInquiryTypeFromLegacy,
  getInquiryTypeFromPanelTypes,
  getProductTypeFromPanelTypes,
  normalizeInquiryPanelTypes,
  hasInquiryPanelType,
} from '../data/inquiryMasterData';

import { validateInquiry } from '../utils/inquiryValidation';
import { getLiveCustomerId, getLiveCustomerName } from '../utils/customerUtils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_CONTACT = () => ({
  id: Date.now() + Math.random(),
  name: '',
  phone: '',
  email: '',
  designation: '',
});

const defaultForm = () => ({
  // Section 1 — Client & Project Information
  inquiryDate:    new Date().toISOString().split('T')[0],
  customerRef:    '',
  customerName:   '',
  companyType:    '',
  customCompanyType: '',
  contacts:       [DEFAULT_CONTACT()],
  siteAddress:    '',
  city:           '',

  // Project details are included in Section 1 (Budget + Priority are managed by estimator)
  projectName:          '',
  industryType:         '',
  customIndustryType:   '',   // shown when industryType === 'Other'
  offerType:            '',
  previousOrderRef: '',

  // Sprint 2 — Inquiry Type
  inquiryType: '',

  // Section 3 — Panel Type
  panelTypes:             [],
  customPanelType:        '',   // shown when panelTypes includes 'OTHER'
  applicationDescription: '',
  applicationProcess:     '',

  // Section 4 — Technical Specs
  supplyVoltage:              '',
  controlVoltage:             '',
  controlFeeder:              false,
  frequency:                  '50 Hz',
  panelAreaClassification:    '',
  panelAreaClass:             '',
  ipRating:                   '',
  installationType:           '',
  shortCircuitCapacity:       '',
  busbarMaterial:             'Aluminium',
  enclosureType:              '',
  enclosureMaterial:          '',
  enclosureStandard:          '',
  enclosureMake:              '',
  panelStructure:             '',
  switchgearMake:             '',
  customSwitchgearMake:       '',
  panelColourRal:             '',
  cableEntry:                 '',
  cableGlandMaterial:         '',

  // Section 5 — Variant
  barrierVariant:             '',

  // Section 5 — Load Details
  loadDetails: [DEFAULT_LOAD_ROW()],

  // Section 6 — Control & Monitoring
  controlType:   'Automatic',
  controlMatrix: {},

  // Section 7 — Standards & Compliance
  panelMounting:             '',
  certificationRequired:     false,
  certificationDetails:      '',
  drawingsSldAttached:       '',
  equipmentListAttached:     '',
  referenceBomAttached:      '',
  commissioningScope:        false,
  deliveryDate:              '',
  programmingScope:          'Customer Scope',
  onsiteSupport:             null,

  // Sprint 2 — Type-specific Details
  plcDetails: defaultPlcDetails(),
  vfdDetails: defaultVfdDetails(),
  mccDetails: defaultMccDetails(),
  flpEnclosureDetails: defaultFlpEnclosureDetails(),
  rioBoxDetails: defaultRioBoxDetails(),

  // Section 8 — Notes & Review
  additionalNotes:  '',
  internalRemarks:  '',

  // Meta (kept for backend compat — not editable by salesperson)
  status:           'New',
  statusDetails:    {},
  remarks:          '',
  bomSubmissionRemarks: '',
  productType:      '',
  nextFollowUpDate: '',
  reviewStatus:     '',
});


const isControlFeederSupplyVoltage = (value = '') => {
  const normalized = String(value || '')
    .toUpperCase()
    .replace(/[,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized || normalized.includes('NEUTRAL')) return false;

  return /^(415|440)\s*V\s*(AC\s*)?3\s*PHASE$/.test(normalized);
};

const BASE_INQUIRY_STEPPER_SECTIONS = {
  client: { label: 'Client & Project', color: 'emerald' },
  general: { label: 'General Inquiry', color: 'blue' },
  plc: { label: 'PLC Panel', color: 'indigo' },
  mcc: { label: 'MCC Panel', color: 'orange' },
  vfdPanel: { label: 'VFD Panel', color: 'orange' },
  flp: { label: 'FLP Enclosure', color: 'purple' },
  rio: { label: 'RIO Box', color: 'indigo' },
  technical: { label: 'Technical', color: 'cyan' },
  engineering: { label: 'Engineering', color: 'amber' },
  attachments: { label: 'Attachments', color: 'rose' },
  technicalBom: { label: 'Technical BoM', color: 'green' },
};

const hasSelectedPanelType = (panelTypes) => (
  normalizeInquiryPanelTypes(panelTypes).length > 0
);

const getInquirySectionIndexes = (panelTypes = []) => {
  const selected = normalizeInquiryPanelTypes(panelTypes);
  let nextIndex = 2;
  const indexes = {
    client: 0,
    general: 1,
    plc: -1,
    mcc: -1,
    vfdPanel: -1,
    flp: -1,
    rio: -1,
    technical: -1,
    engineering: -1,
  };

  const showPlc =
    hasInquiryPanelType(selected, 'PLC') ||
    hasInquiryPanelType(selected, 'MCC cum PLC');
  const showMcc =
    hasInquiryPanelType(selected, 'MCC') ||
    hasInquiryPanelType(selected, 'MCC cum PLC');
  const showVfdPanel = hasInquiryPanelType(selected, 'VFD');
  const showSharedTechnicalEngineering = hasInquiryPanelType(selected, 'VFD');

  if (showPlc) indexes.plc = nextIndex++;
  if (showMcc) indexes.mcc = nextIndex++;
  if (showVfdPanel) indexes.vfdPanel = nextIndex++;
  if (hasInquiryPanelType(selected, 'FLP')) indexes.flp = nextIndex++;
  if (hasInquiryPanelType(selected, 'RIO Box')) indexes.rio = nextIndex++;

  if (showSharedTechnicalEngineering) {
    indexes.technical = nextIndex++;
    indexes.engineering = nextIndex++;
  }

  indexes.attachments = nextIndex++;
  indexes.technicalBom = nextIndex++;

  return indexes;
};

const getSectionsForPanelTypes = (panelTypes) => {
  if (!hasSelectedPanelType(panelTypes)) {
    return [BASE_INQUIRY_STEPPER_SECTIONS.client, BASE_INQUIRY_STEPPER_SECTIONS.general];
  }

  const selected = normalizeInquiryPanelTypes(panelTypes);
  const sections = [
    BASE_INQUIRY_STEPPER_SECTIONS.client,
    BASE_INQUIRY_STEPPER_SECTIONS.general,
  ];

  const showPlc =
    hasInquiryPanelType(selected, 'PLC') ||
    hasInquiryPanelType(selected, 'MCC cum PLC');
  const showMcc =
    hasInquiryPanelType(selected, 'MCC') ||
    hasInquiryPanelType(selected, 'MCC cum PLC');
  const showVfdPanel = hasInquiryPanelType(selected, 'VFD');
  const showSharedTechnicalEngineering = hasInquiryPanelType(selected, 'VFD');

  if (showPlc) sections.push(BASE_INQUIRY_STEPPER_SECTIONS.plc);
  if (showMcc) sections.push(BASE_INQUIRY_STEPPER_SECTIONS.mcc);
  if (showVfdPanel) sections.push(BASE_INQUIRY_STEPPER_SECTIONS.vfdPanel);
  if (hasInquiryPanelType(selected, 'FLP')) sections.push(BASE_INQUIRY_STEPPER_SECTIONS.flp);
  if (hasInquiryPanelType(selected, 'RIO Box')) sections.push(BASE_INQUIRY_STEPPER_SECTIONS.rio);

  if (showSharedTechnicalEngineering) {
    sections.push(
      BASE_INQUIRY_STEPPER_SECTIONS.technical,
      BASE_INQUIRY_STEPPER_SECTIONS.engineering
    );
  }

  sections.push(
    BASE_INQUIRY_STEPPER_SECTIONS.attachments,
    BASE_INQUIRY_STEPPER_SECTIONS.technicalBom
  );

  return sections;
};

const getStepperTargetRefIndex = (_panelTypes, stepIndex) => stepIndex;

const getCurrentStepperIndex = (panelTypes, activeSection) => {
  const steps = getSectionsForPanelTypes(panelTypes);
  return Math.max(0, Math.min(activeSection, steps.length - 1));
};

const DRAFT_KEY = 'electrical_panel_inquiry_draft';

const STICKY_STEPPER_SCROLL_OFFSET = 132;

// Keep the V7 layout, but allow the sticky inquiry header to move up
// gently into the empty gap after the outer Add Inquiry page header while scrolling.
// This uses CSS sticky top instead of JS scroll state, so it works with
// window scroll, main scroll, and nested layout scroll containers.
const STICKY_STEPPER_TOP_OFFSET = '-20px';

// ─── File utility helpers ──────────────────────────────────────────────────────

const formatBytes = (bytes = 0) => {
  if (!bytes) return '';
  if (bytes < 1024)           return `${bytes} B`;
  if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fileEmoji = (fileOrMimeType = '', name = '') => {
  const mimeType = typeof fileOrMimeType === 'object'
    ? fileOrMimeType?.mimeType || fileOrMimeType?.type || ''
    : fileOrMimeType || '';

  const fileName = typeof fileOrMimeType === 'object'
    ? fileOrMimeType?.name || fileOrMimeType?.originalName || fileOrMimeType?.storedName || ''
    : name || '';

  const ext = (fileName || '').split('.').pop()?.toLowerCase();

  if (mimeType.includes('pdf') || ext === 'pdf') return '📄';
  if (mimeType.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️';
  if (mimeType.includes('excel') || ['xls', 'xlsx'].includes(ext)) return '📊';
  if (mimeType.includes('word') || ['doc', 'docx'].includes(ext)) return '📝';
  if (ext === 'zip' || mimeType.includes('zip')) return '🗜️';

  return '📎';
};

const inferInquiryTypeFromRecord = (record = {}) => {
  if (record.inquiryType && Object.values(INQUIRY_TYPES).includes(record.inquiryType)) {
    return record.inquiryType;
  }

  if (record.productType) {
    const fromProductType = inferInquiryTypeFromLegacy(record.productType, []);
    if (fromProductType && fromProductType !== INQUIRY_TYPES.LEGACY) {
      return fromProductType;
    }
  }

  if (Array.isArray(record.panelTypes) && record.panelTypes.length > 0) {
    const fromPanelTypes = inferInquiryTypeFromLegacy('', record.panelTypes);
    if (fromPanelTypes && fromPanelTypes !== INQUIRY_TYPES.LEGACY) {
      return fromPanelTypes;
    }
  }

  return INQUIRY_TYPES.LEGACY;
};

const normaliseInquiryLoadRows = (rows = [], type = 'VFD') => {
  const safeRows = Array.isArray(rows) ? rows : [];

  return safeRows.map((row, index) => {
    const baseRow = type === 'MCC'
      ? defaultMccLoadRow(index + 1)
      : defaultVfdLoadRow(index + 1);

    const ratingParts = [
      row?.kw ? `${row.kw} kW` : '',
      row?.hp ? `${row.hp} HP` : '',
    ].filter(Boolean);

    return {
      ...baseRow,
      srNo: index + 1,
      loadDescription: row?.loadDescription || row?.description || '',
      qty: row?.qty ?? '',
      ratingKwHp: row?.ratingKwHp || ratingParts.join(' / ') || '',
      fullLoadCurrent: row?.fullLoadCurrent || row?.ampere || '',
      remarks: row?.remarks || '',
    };
  });
};

const sanitizeComponentRequirementRows = (rows = []) => (
  (Array.isArray(rows) ? rows : []).map((row = {}) => {
    const required = row.required === 'Yes' ? 'Yes' : 'No';
    const base = {
      component: row.component || '',
      required,
    };

    if (required !== 'Yes') {
      return base;
    }

    return {
      ...base,
      preferredBrand: row.preferredBrand || '',
      suggestedModelRange: row.suggestedModelRange || '',
      remarks: row.remarks || '',
    };
  })
);

const toNonNegativeIntegerValue = (value, fallback = 0) => {
  if (value === '' || value === undefined || value === null) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const sanitizePlcIoRequirementForSubmit = (row = {}, fallbackQuantity = 0, allowHart = false) => ({
  quantity: toNonNegativeIntegerValue(row?.quantity, toNonNegativeIntegerValue(fallbackQuantity, 0)),
  relay: Boolean(row?.relay),
  isBarrier: Boolean(row?.isBarrier),
  conformalCoated: Boolean(row?.conformalCoated),
  isInput: Boolean(row?.isInput),
  hart: allowHart ? Boolean(row?.hart) : false,
});

const sanitizeMainIncomerForSubmit = (mainIncomer = {}) => {
  const make = String(mainIncomer.make || '').trim();
  const supplyVoltage = String(mainIncomer.supplyVoltage || '').trim();

  return {
    mainIncomerType: String(mainIncomer.mainIncomerType || '').trim(),
    supplyVoltage,
    customSupplyVoltage: supplyVoltage === 'Custom'
      ? String(mainIncomer.customSupplyVoltage || '').trim()
      : '',
    pole: String(mainIncomer.pole || '').trim(),
    frequency: String(mainIncomer.frequency || '').trim(),
    make,
    customMake: make.toUpperCase() === 'OTHER'
      ? String(mainIncomer.customMake || '').trim()
      : '',
    kaRating: String(mainIncomer.kaRating || '').trim(),
    controlFeeder: String(mainIncomer.controlFeeder || '').trim(),
    sameAsAbove: Boolean(mainIncomer.sameAsAbove),
  };
};

const sanitizePlcDetailsForSubmit = (plcDetails = {}) => {
  const defaults = defaultPlcDetails();
  const source = { ...defaults, ...(plcDetails || {}) };
  const legacyIo = { ...defaults.ioDetails, ...(source.ioDetails || {}) };
  const ioRequirements = source.ioRequirements || {};
  const mainIncomer = { ...defaults.mainIncomerFeeder, ...(source.mainIncomerFeeder || {}) };
  const plcSystem = { ...defaults.plcSystem, ...(source.plcSystem || {}) };
  const servoDetails = { ...defaults.servoDetails, ...(source.servoDetails || {}) };
  const redundancy = { ...defaults.redundancy, ...(source.redundancy || {}) };
  const support = { ...defaults.supportRequirements, ...(source.supportRequirements || {}) };

  const sanitizedIoRequirements = {
    di: sanitizePlcIoRequirementForSubmit(ioRequirements.di, legacyIo.digitalInputs, false),
    do: sanitizePlcIoRequirementForSubmit(ioRequirements.do, legacyIo.digitalOutputs, false),
    ai: sanitizePlcIoRequirementForSubmit(ioRequirements.ai, legacyIo.analogInputs, true),
    ao: sanitizePlcIoRequirementForSubmit(ioRequirements.ao, legacyIo.analogOutputs, true),
  };

  const hmiRequired = Boolean(plcSystem.hmiRequired);
  const ethernetSwitchRequired = Boolean(plcSystem.ethernetSwitchRequired);
  const plcRedundancy = ['Hot', 'Cold'].includes(redundancy.plcRedundancy)
    ? redundancy.plcRedundancy
    : '';

  return {
    ...source,
    mainIncomerFeeder: {
      ...mainIncomer,
      customSupplyVoltage: mainIncomer.supplyVoltage === 'Custom'
        ? String(mainIncomer.customSupplyVoltage || '').trim()
        : '',
      customMake: String(mainIncomer.make || '').trim().toUpperCase() === 'OTHER'
        ? String(mainIncomer.customMake || '').trim()
        : '',
    },
    plcSystem: {
      ...plcSystem,
      customMake: String(plcSystem.make || '').trim().toUpperCase() === 'OTHER'
        ? String(plcSystem.customMake || '').trim()
        : '',
      hmiRequired,
      hmiSize: hmiRequired ? plcSystem.hmiSize || '' : '',
      hmiMake: hmiRequired ? plcSystem.hmiMake || '' : '',
      ethernetSwitchRequired,
      ethernetSwitchPort: ethernetSwitchRequired ? plcSystem.ethernetSwitchPort || '' : '',
      ethernetSwitchType: ethernetSwitchRequired ? plcSystem.ethernetSwitchType || '' : '',
    },
    servoDetails: {
      ...servoDetails,
      customMake: String(servoDetails.make || '').trim().toUpperCase() === 'OTHER'
        ? String(servoDetails.customMake || '').trim()
        : '',
      motorCapacityKw: servoDetails.motorCapacityKw === '' || servoDetails.motorCapacityKw == null
        ? null
        : Number(servoDetails.motorCapacityKw),
      cableLengthMetres: servoDetails.cableLengthMetres === '' || servoDetails.cableLengthMetres == null
        ? null
        : Number(servoDetails.cableLengthMetres),
    },
    ioRequirements: sanitizedIoRequirements,
    redundancy: {
      plcRedundancy,
      networkRedundancy: Boolean(redundancy.networkRedundancy),
      communicationRedundancy: Boolean(redundancy.communicationRedundancy),
    },
    automationRequirements: sanitizeComponentRequirementRows(source.automationRequirements || []),
    supportRequirements: {
      onsiteSupportRequired: support.onsiteSupportRequired === 'Required'
        ? 'Required'
        : 'Not Required',
      onsiteSupportDays: support.onsiteSupportRequired === 'Required'
        ? toNonNegativeIntegerValue(support.onsiteSupportDays, 0)
        : 0,
      commissioningSupportRequired: support.commissioningSupportRequired === 'Required'
        ? 'Required'
        : 'Not Required',
      commissioningSupportDays: support.commissioningSupportRequired === 'Required'
        ? toNonNegativeIntegerValue(support.commissioningSupportDays, 0)
        : 0,
    },
    ioDetails: {
      ...legacyIo,
      digitalInputs: sanitizedIoRequirements.di.quantity,
      digitalOutputs: sanitizedIoRequirements.do.quantity,
      analogInputs: sanitizedIoRequirements.ai.quantity,
      analogOutputs: sanitizedIoRequirements.ao.quantity,
      communicationProtocol: plcSystem.communicationProtocol || legacyIo.communicationProtocol || '',
      networkTopology: plcSystem.networkTopology || legacyIo.networkTopology || '',
      plcCpuRedundancyRequired: plcRedundancy ? 'Yes' : 'No',
      thermocoupleRtdInputs: toNonNegativeIntegerValue(legacyIo.thermocoupleRtdInputs, 0),
      highSpeedCounterInputs: toNonNegativeIntegerValue(legacyIo.highSpeedCounterInputs, 0),
      ioSpareCapacityPercent: toNonNegativeIntegerValue(legacyIo.ioSpareCapacityPercent, 0),
      powerSupplyRedundancy: legacyIo.powerSupplyRedundancy === 'Yes' ? 'Yes' : 'No',
    },
  };
};

const normalizeMccFeederType = (value) => {
  const cleanValue = String(value || '').trim();
  const legacyMap = {
    DOL: 'DOL Starter',
    'Star-Delta': 'Star-Delta Starter',
    VFD: 'VFD Feeder',
    Servo: 'Servo Feeder',
  };

  return legacyMap[cleanValue] || cleanValue;
};

const sanitizeMccDetailsForSubmit = (mccDetails = {}, form = {}) => {
  const defaults = defaultMccDetails();
  const source = { ...defaults, ...(mccDetails || {}) };
  const rawIncomer = { ...defaults.incomerDetails, ...(source.incomerDetails || {}) };
  const mainIncomerType = String(rawIncomer.mainIncomerType || rawIncomer.incomerType || '').trim();
  const supplyVoltage = String(
    rawIncomer.supplyVoltage || rawIncomer.incomingVoltage || form.supplyVoltage || ''
  ).trim();
  const customSupplyVoltage = supplyVoltage === 'Custom'
    ? String(rawIncomer.customSupplyVoltage || rawIncomer.customIncomingVoltage || '').trim()
    : '';
  const incomer = {
    ...rawIncomer,
    mainIncomerType,
    supplyVoltage,
    customSupplyVoltage,
    pole: String(rawIncomer.pole || '').trim(),
    frequency: String(rawIncomer.frequency || form.frequency || '').trim(),
    make: String(rawIncomer.make || '').trim(),
    customMake: String(rawIncomer.make || '').trim().toUpperCase() === 'OTHER'
      ? String(rawIncomer.customMake || '').trim()
      : '',
    kaRating: String(rawIncomer.kaRating || form.shortCircuitCapacity || '').trim(),
    controlFeeder: String(rawIncomer.controlFeeder || '').trim(),
    sameAsAbove: Boolean(rawIncomer.sameAsAbove),
    incomingVoltage: supplyVoltage,
    customIncomingVoltage: customSupplyVoltage,
    incomerType: mainIncomerType,
  };
  const outgoing = { ...defaults.outgoingFeederDetails, ...(source.outgoingFeederDetails || {}) };
  const support = { ...defaults.notesAndSupport, ...(source.notesAndSupport || {}) };

  const commissioningScope = support.commissioningScope || (
    support.commissioningSupportRequired === 'Required'
      ? 'In Our Scope'
      : support.commissioningSupportRequired === 'Not Required'
        ? 'Customer Scope'
        : ''
  );

  return {
    ...source,
    incomerDetails: incomer,
    outgoingFeederDetails: {
      ...outgoing,
      feederTypes: Array.from(new Set(
        (Array.isArray(outgoing.feederTypes) ? outgoing.feederTypes : [])
          .map(normalizeMccFeederType)
          .filter(Boolean)
      )),
    },
    loadDetails: Array.isArray(source.loadDetails) ? source.loadDetails : [],
    layoutPreferences: {
      ...defaults.layoutPreferences,
      ...(source.layoutPreferences || {}),
    },
    notesAndSupport: {
      ...support,
      commissioningScope,
      commissioningSupportRequired: commissioningScope === 'In Our Scope'
        ? 'Required'
        : commissioningScope === 'Customer Scope'
          ? 'Not Required'
          : support.commissioningSupportRequired || '',
      commissioningSupportDays: 0,
    },
  };
};

const ensureNestedDefaults = (record = {}) => {
  const explicitPanelTypes = normalizeInquiryPanelTypes(record.panelTypes || []);
  const inquiryType = explicitPanelTypes.length > 0
    ? getInquiryTypeFromPanelTypes(explicitPanelTypes)
    : inferInquiryTypeFromRecord(record);

  const defaultPlc = defaultPlcDetails();
  const defaultVfd = defaultVfdDetails();
  const defaultMcc = defaultMccDetails();
  const defaultFlp = defaultFlpEnclosureDetails();
  const defaultRio = defaultRioBoxDetails();

  const legacyLoadRows = Array.isArray(record.loadDetails) ? record.loadDetails : [];

  const hasPlcAutomationRows =
    Array.isArray(record.plcDetails?.automationRequirements) &&
    record.plcDetails.automationRequirements.length > 0;

  const hasVfdLoadRows =
    Array.isArray(record.vfdDetails?.loadDetails) &&
    record.vfdDetails.loadDetails.length > 0;

  const hasMccLoadRows =
    Array.isArray(record.mccDetails?.loadDetails) &&
    record.mccDetails.loadDetails.length > 0;

  const legacyPlcIoDetails = record.plcDetails?.ioDetails || {};
  const existingPlcIoRequirements = record.plcDetails?.ioRequirements || {};
  const existingPlcSystem = record.plcDetails?.plcSystem || {};
  const existingMainIncomer = record.plcDetails?.mainIncomerFeeder || {};
  const existingRedundancy = record.plcDetails?.redundancy || {};

  const getLegacyAutomationRow = (component) => (
    Array.isArray(record.plcDetails?.automationRequirements)
      ? record.plcDetails.automationRequirements.find((row) => row.component === component)
      : undefined
  );

  const legacyHmiRow = getLegacyAutomationRow('HMI / Touch Panel') || {};
  const legacyNetworkSwitchRow = getLegacyAutomationRow('Industrial Network Switch') || {};
  const hasNewMainIncomerData = [
    'mainIncomerType', 'supplyVoltage', 'customSupplyVoltage', 'pole',
    'make', 'customMake', 'kaRating', 'controlFeeder',
  ].some((field) => String(existingMainIncomer?.[field] ?? '').trim() !== '') ||
    !['', '50 Hz'].includes(String(existingMainIncomer?.frequency ?? '').trim());
  const hasNewPlcSystemData = [
    'plcController', 'make', 'customMake', 'modelNumber',
    'communicationProtocol', 'networkTopology', 'hmiSize', 'hmiMake',
    'ethernetSwitchPort', 'ethernetSwitchType',
  ].some((field) => String(existingPlcSystem?.[field] ?? '').trim() !== '');

  const makeIoRequirementRow = (key, legacyQuantityKey) => {
    const existingRow = existingPlcIoRequirements?.[key] || {};
    const legacyQuantity = legacyPlcIoDetails?.[legacyQuantityKey];
    const existingQuantity = existingRow.quantity;
    const quantity =
      Number(existingQuantity) === 0 && Number(legacyQuantity) > 0
        ? legacyQuantity
        : existingQuantity ?? legacyQuantity ?? '';

    return {
      ...(defaultPlc.ioRequirements?.[key] || {}),
      ...existingRow,
      quantity,
    };
  };

  const plcDetails = {
    ...defaultPlc,
    ...(record.plcDetails || {}),
    automationRequirements: hasPlcAutomationRows
      ? record.plcDetails.automationRequirements
      : defaultPlc.automationRequirements,
    mainIncomerFeeder: hasNewMainIncomerData
      ? {
          ...defaultPlc.mainIncomerFeeder,
          ...existingMainIncomer,
        }
      : {
          ...defaultPlc.mainIncomerFeeder,
          supplyVoltage: record.supplyVoltage || defaultPlc.mainIncomerFeeder.supplyVoltage,
          frequency: record.frequency || defaultPlc.mainIncomerFeeder.frequency,
          make: record.switchgearMake || defaultPlc.mainIncomerFeeder.make,
          customMake: record.customSwitchgearMake || defaultPlc.mainIncomerFeeder.customMake,
          kaRating: record.shortCircuitCapacity || defaultPlc.mainIncomerFeeder.kaRating,
          controlFeeder: record.controlFeeder ? 'Required' : defaultPlc.mainIncomerFeeder.controlFeeder,
        },
    plcSystem: hasNewPlcSystemData
      ? {
          ...defaultPlc.plcSystem,
          ...existingPlcSystem,
        }
      : {
          ...defaultPlc.plcSystem,
          communicationProtocol: legacyPlcIoDetails.communicationProtocol || '',
          networkTopology: legacyPlcIoDetails.networkTopology || '',
          hmiRequired: legacyHmiRow.required === 'Yes',
          hmiMake: legacyHmiRow.preferredBrand || '',
          hmiSize: legacyHmiRow.suggestedModelRange || '',
          ethernetSwitchRequired: legacyNetworkSwitchRow.required === 'Yes',
          ethernetSwitchType: legacyNetworkSwitchRow.suggestedModelRange || '',
        },
    servoDetails: {
      ...defaultPlc.servoDetails,
      ...(record.plcDetails?.servoDetails || {}),
    },
    ioRequirements: {
      di: makeIoRequirementRow('di', 'digitalInputs'),
      do: makeIoRequirementRow('do', 'digitalOutputs'),
      ai: makeIoRequirementRow('ai', 'analogInputs'),
      ao: makeIoRequirementRow('ao', 'analogOutputs'),
    },
    redundancy: {
      ...defaultPlc.redundancy,
      plcRedundancy:
        legacyPlcIoDetails.plcCpuRedundancyRequired === 'Yes' ? 'Hot' : '',
      ...existingRedundancy,
    },
    supportRequirements: {
      ...defaultPlc.supportRequirements,
      ...(record.plcDetails?.supportRequirements || {}),
    },
    ioDetails: {
      ...defaultPlc.ioDetails,
      ...legacyPlcIoDetails,
    },
  };

  const existingVfdMainIncomer = record.vfdDetails?.mainIncomer || {};
  const vfdDetails = {
    ...defaultVfd,
    ...(record.vfdDetails || {}),
    mainIncomer: {
      ...defaultVfd.mainIncomer,
      ...existingVfdMainIncomer,
      sameAsAbove: Boolean(existingVfdMainIncomer.sameAsAbove),
    },
    loadDetails: hasVfdLoadRows
      ? record.vfdDetails.loadDetails
      : inquiryType === INQUIRY_TYPES.VFD_PANEL && legacyLoadRows.length > 0
        ? normaliseInquiryLoadRows(legacyLoadRows, 'VFD')
        : defaultVfd.loadDetails,
    additionalComponents:
      Array.isArray(record.vfdDetails?.additionalComponents) &&
      record.vfdDetails.additionalComponents.length > 0
        ? record.vfdDetails.additionalComponents
        : defaultVfd.additionalComponents,
  };

  const mccDetails = {
    ...defaultMcc,
    ...(record.mccDetails || {}),
    incomerDetails: (() => {
      const existing = record.mccDetails?.incomerDetails || {};
      const mainIncomerType = existing.mainIncomerType || existing.incomerType || '';
      const supplyVoltage = existing.supplyVoltage || existing.incomingVoltage || record.supplyVoltage || '';
      const customSupplyVoltage = existing.customSupplyVoltage || existing.customIncomingVoltage || '';

      return {
        ...defaultMcc.incomerDetails,
        ...existing,
        mainIncomerType,
        supplyVoltage,
        customSupplyVoltage,
        pole: existing.pole || '',
        frequency: existing.frequency || record.frequency || defaultMcc.incomerDetails.frequency,
        make: existing.make || '',
        customMake: existing.customMake || '',
        kaRating: existing.kaRating || record.shortCircuitCapacity || '',
        controlFeeder: existing.controlFeeder || '',
        sameAsAbove: Boolean(existing.sameAsAbove),
        incomingVoltage: supplyVoltage,
        customIncomingVoltage: customSupplyVoltage,
        incomerType: mainIncomerType,
      };
    })(),
    outgoingFeederDetails: {
      ...defaultMcc.outgoingFeederDetails,
      ...(record.mccDetails?.outgoingFeederDetails || {}),
      feederTypes: Array.isArray(record.mccDetails?.outgoingFeederDetails?.feederTypes)
        ? Array.from(new Set(
            record.mccDetails.outgoingFeederDetails.feederTypes
              .map(normalizeMccFeederType)
              .filter(Boolean)
          ))
        : defaultMcc.outgoingFeederDetails.feederTypes,
    },
    loadDetails: hasMccLoadRows
      ? record.mccDetails.loadDetails
      : (
          inquiryType === INQUIRY_TYPES.MCC_PANEL ||
          inquiryType === INQUIRY_TYPES.MCC_CUM_PLC
        ) && legacyLoadRows.length > 0
        ? normaliseInquiryLoadRows(legacyLoadRows, 'MCC')
        : defaultMcc.loadDetails,
    layoutPreferences: {
      ...defaultMcc.layoutPreferences,
      ...(record.mccDetails?.layoutPreferences || {}),
    },
    notesAndSupport: {
      ...defaultMcc.notesAndSupport,
      commissioningScope:
        record.mccDetails?.notesAndSupport?.commissioningScope ||
        (record.mccDetails?.notesAndSupport?.commissioningSupportRequired === 'Required'
          ? 'In Our Scope'
          : record.mccDetails?.notesAndSupport?.commissioningSupportRequired === 'Not Required'
            ? 'Customer Scope'
            : ''),
      ...(record.mccDetails?.notesAndSupport || {}),
    },
  };

  const flpEnclosureDetails = {
    ...defaultFlp,
    ...(record.flpEnclosureDetails || {}),
    enclosureSelection: {
      ...defaultFlp.enclosureSelection,
      ...(record.flpEnclosureDetails?.enclosureSelection || {}),
    },
    commonTechnical: {
      ...defaultFlp.commonTechnical,
      ...(record.flpEnclosureDetails?.commonTechnical || {}),
    },
    weatherproof: {
      ...defaultFlp.weatherproof,
      ...(record.flpEnclosureDetails?.weatherproof || {}),
    },
    flameproof: {
      ...defaultFlp.flameproof,
      ...(record.flpEnclosureDetails?.flameproof || {}),
    },
    preliminarySummary: {
      ...defaultFlp.preliminarySummary,
      ...(record.flpEnclosureDetails?.preliminarySummary || {}),
    },
  };

  const existingRioRows = Array.isArray(record.rioBoxDetails?.ioRequirements)
    ? record.rioBoxDetails.ioRequirements
    : [];
  const defaultRioRows = Array.isArray(defaultRio.ioRequirements)
    ? defaultRio.ioRequirements
    : [];

  const existingRioMainIncomer = record.rioBoxDetails?.mainIncomer || {};
  const rioBoxDetails = {
    ...defaultRio,
    ...(record.rioBoxDetails || {}),
    mainIncomer: {
      ...defaultRio.mainIncomer,
      ...existingRioMainIncomer,
      sameAsAbove: Boolean(existingRioMainIncomer.sameAsAbove),
    },
    application: {
      ...defaultRio.application,
      ...(record.rioBoxDetails?.application || {}),
    },
    ioRequirements: RIO_IO_SIGNAL_ROWS.map((definition) => {
      const existingRow = existingRioRows.find((row) => row.key === definition.key) || {};
      const defaultRow = defaultRioRows.find((row) => row.key === definition.key) || definition;
      const rawSparePercent = Number(existingRow.sparePercent ?? defaultRow.sparePercent ?? 20);

      return {
        ...defaultRow,
        ...existingRow,
        key: definition.key,
        label: definition.label,
        sparePercent: Number.isFinite(rawSparePercent) && rawSparePercent > 0 && rawSparePercent < 1
          ? rawSparePercent * 100
          : rawSparePercent,
      };
    }),
    enclosureConditions: {
      ...defaultRio.enclosureConditions,
      ...(record.rioBoxDetails?.enclosureConditions || {}),
    },
    accessories: {
      ...defaultRio.accessories,
      ...(record.rioBoxDetails?.accessories || {}),
    },
  };

  const mappedPanelTypes = getPanelTypesFromInquiryType(inquiryType);
  const resolvedPanelTypes = explicitPanelTypes.length > 0
    ? explicitPanelTypes
    : normalizeInquiryPanelTypes(mappedPanelTypes);
  const mappedProductType = resolvedPanelTypes.length > 0
    ? getProductTypeFromPanelTypes(resolvedPanelTypes)
    : getProductTypeFromInquiryType(inquiryType);
  const fallbackSwitchgearMake =
    record.switchgearMake ||
    record.plcDetails?.switchgearMake ||
    record.vfdDetails?.switchgearMake ||
    record.mccDetails?.outgoingFeederDetails?.switchgearMake ||
    '';
  const fallbackCustomSwitchgearMake =
    record.customSwitchgearMake ||
    record.plcDetails?.customSwitchgearMake ||
    record.vfdDetails?.customSwitchgearMake ||
    record.mccDetails?.outgoingFeederDetails?.customSwitchgearMake ||
    '';

  return {
    ...record,

    inquiryType,

    companyType: record.companyType || '',
    city: record.city || record.location || '',

    productType: mappedProductType || record.productType || 'MCC',
    panelTypes: resolvedPanelTypes,

    panelAreaClassification: record.panelAreaClassification || record.panelAreaClass || '',
    panelAreaClass: record.panelAreaClass || record.panelAreaClassification || '',

    enclosureType: record.enclosureType || record.enclosureMaterial || record.enclosureStandard || '',
    enclosureMaterial: record.enclosureMaterial || record.enclosureType || record.enclosureStandard || '',
    enclosureStandard: record.enclosureStandard || record.enclosureType || record.enclosureMaterial || '',
    enclosureMake: record.enclosureMake || '',
    panelStructure: record.panelStructure || record.mccDetails?.layoutPreferences?.panelStructure || '',
    switchgearMake: fallbackSwitchgearMake,
    customSwitchgearMake: fallbackCustomSwitchgearMake,

    panelColourRal: record.panelColourRal || '',
    controlVoltage: record.controlVoltage || record.mccDetails?.outgoingFeederDetails?.controlVoltage || '',
    cableEntry: record.cableEntry || '',
    cableGlandMaterial: record.cableGlandMaterial || '',

    drawingsSldAttached: record.drawingsSldAttached || '',
    equipmentListAttached: record.equipmentListAttached || '',
    referenceBomAttached: record.referenceBomAttached || '',

    applicationProcess: record.applicationProcess || '',

    loadDetails: Array.isArray(record.loadDetails) && record.loadDetails.length > 0
      ? record.loadDetails
      : inquiryType === INQUIRY_TYPES.VFD_PANEL
        ? normaliseInquiryLoadRows(vfdDetails.loadDetails, 'VFD')
        : (
            inquiryType === INQUIRY_TYPES.MCC_PANEL ||
            inquiryType === INQUIRY_TYPES.MCC_CUM_PLC
          )
          ? normaliseInquiryLoadRows(mccDetails.loadDetails, 'MCC')
          : [DEFAULT_LOAD_ROW()],

    controlMatrix: record.controlMatrix || {},

    plcDetails,
    vfdDetails,
    mccDetails,
    flpEnclosureDetails,
    rioBoxDetails,
  };
};

const updateInquiryType = (setForm, inquiryType) => {
  setForm((prev) =>
    ensureNestedDefaults({
      ...prev,
      inquiryType,
      productType: getProductTypeFromInquiryType(inquiryType),
      panelTypes: getPanelTypesFromInquiryType(inquiryType),
    })
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const ElectricalPanelInquiryPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id }   = useParams();
  const toast    = useToast();
  const { hasPermission, user } = useAuth();

  const canCreateInquiry = hasPermission(INQUIRY_PERMISSIONS.CREATE);
  const canViewInquiry = hasPermission(INQUIRY_PERMISSIONS.VIEW);
  const canEditInquiry = hasPermission(INQUIRY_PERMISSIONS.EDIT);
  const canCommercialSubmit = hasPermission(INQUIRY_PERMISSIONS.COMMERCIAL_SUBMIT);
  const canCreateCustomer = hasPermission(CUSTOMER_PERMISSIONS.CREATE);
  const canViewCustomer = hasPermission(CUSTOMER_PERMISSIONS.VIEW);
  const canEditCustomer = hasPermission(CUSTOMER_PERMISSIONS.EDIT);
  const inquiryReturnPath = canViewInquiry ? '/inquiries' : '/';

  const isExistingInquiry = Boolean(id);
  const isEdit = isExistingInquiry && location.pathname.endsWith('/edit');
  const isView = isExistingInquiry && !isEdit;

  const [form,        setForm]        = useState(() => ensureNestedDefaults(defaultForm()));
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [errors,      setErrors]      = useState({});
  const [submitting,  setSubmitting]  = useState(false);
  const [pageLoading, setPageLoading] = useState(isExistingInquiry);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const formDisabled = submitting || isView;
  const statusDisabled = formDisabled || (!isEdit && !canEditInquiry);
  const statusOptions = (
    canCommercialSubmit || form.status === 'Commercial BOM Submission'
      ? INQUIRY_STATUS_OPTIONS
      : INQUIRY_STATUS_OPTIONS.filter((option) => option.value !== 'Commercial BOM Submission')
  );

  // ── Attachment state ─────────────────────────────────────────────────────────
  // stagedFiles   : File objects selected by user, not yet on server
  // savedAttachments : attachment sub-docs already persisted on the server
  const [stagedFiles,      setStagedFiles]      = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [savedAttachments, setSavedAttachments] = useState([]);
  const [bomStagedFiles, setBomStagedFiles] = useState([]);
  const [savedBomAttachments, setSavedBomAttachments] = useState([]);
  const fileInputRef = useRef(null);
  const bomFileInputRef = useRef(null);

  // Customer master records
  const [customers, setCustomers] = useState([]);
  const [customerCreateOpen, setCustomerCreateOpen] = useState(false);
  const [customerDetailsOpen, setCustomerDetailsOpen] = useState(false);
  const [customerDetailsEditing, setCustomerDetailsEditing] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [updatingCustomer, setUpdatingCustomer] = useState(false);

  // Autocomplete suggestion pools kept for backward-compatible data hydration
  const [companySuggestions,     setCompanySuggestions]     = useState([]);
  const [contactNameSuggestions, setContactNameSuggestions] = useState([]);
  const [citySuggestions,        setCitySuggestions]        = useState([]);

  // Past inquiries for "Repeat Order" selector
  const [pastInquiries, setPastInquiries] = useState([]);

  // Step progress scroll tracking
  const [activeSection, setActiveSection] = useState(0);
  const sectionRefs = useRef([]);

const setSprint2Form = useCallback((updater) => {
  setForm((prev) => {
    const next = typeof updater === 'function'
      ? updater(prev)
      : { ...prev, ...(updater || {}) };

    return ensureNestedDefaults(next);
  });
}, []);

  

  // const selectedDate = new Date(form.inquiryDate);

useEffect(() => {
  if (!draftLoaded) return;
  if (isExistingInquiry) return;

  const timer = setTimeout(() => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify(ensureNestedDefaults(form))
    );
  }, 1000);

  return () => clearTimeout(timer);
}, [form, draftLoaded, isExistingInquiry]);


  // ── Load existing inquiry (view/edit mode) ──────────────────────────────────────
  useEffect(() => {
    if (!isExistingInquiry) return;
    (async () => {
      try {
        const { data } = await API.get(`/inquiries/${id}`);
        const d = data.data;

        // Normalise contacts: old single-contact records → array
        let contacts = d.contacts && d.contacts.length
          ? d.contacts.map(c => ({ ...c, id: c.id || Date.now() + Math.random() }))
          : [{ id: Date.now(), name: d.contactPerson || '', phone: d.mobileNumber || '', email: d.email || '', designation: d.designation || '' }];

        // Resolve "Other/Custom" back-fill for edit mode
        // If supplyVoltage stored is not in VOLTAGE_OPTIONS, it was a custom value
        const knownVoltages = Array.isArray(VOLTAGE_OPTIONS)
          ? VOLTAGE_OPTIONS.map(o => (typeof o === 'string' ? o : o.value))
          : [];
        const isCustomVoltage = d.supplyVoltage && !knownVoltages.includes(d.supplyVoltage) && d.supplyVoltage !== 'Custom';
        const displayVoltage  = isCustomVoltage ? 'Custom' : (d.supplyVoltage || '');
        const customVoltage   = isCustomVoltage ? (d.supplyVoltage || '') : '';

        const knownPanelTypes = Array.isArray(PANEL_TYPES)
          ? PANEL_TYPES.map(o => (typeof o === 'string' ? o : o.value))
          : [];
        const rawPanelTypes = Array.isArray(d.panelTypes) ? d.panelTypes : (d.productType ? [d.productType] : []);
        const panelTypes = rawPanelTypes.filter(pt => knownPanelTypes.includes(pt));
        const customPanelType = '';

        // Resolve industryType "Other" back-fill for edit mode.
        // If the stored value is not in the known INDUSTRY_TYPES list (excluding 'Other'),
        // it was a custom value saved as industryType — restore it into customIndustryType.
        const knownIndustryTypes = ['Automotive','Chemical & Pharma','Construction','Data Centre',
          'Food & Beverage','Infrastructure','Metal & Fabrication','Mining','Oil & Gas',
          'Paper & Pulp','Power Generation','Renewable Energy','Sugar & Distillery',
          'Textile','Water Treatment','Other'];
        const isCustomIndustry    = d.industryType && !knownIndustryTypes.includes(d.industryType);
        const displayIndustryType = isCustomIndustry ? 'Other' : (d.industryType || '');
        const customIndustryType  = isCustomIndustry ? d.industryType : (d.customIndustryType || '');

        const knownCompanyTypes = ['End User', 'OEM', 'Consultant', 'Contractor',
          'System Integrator', 'Panel Builder', 'Dealer / Trader', 'Other'];
        const isCustomCompanyType = d.companyType && !knownCompanyTypes.includes(d.companyType);
        const displayCompanyType = isCustomCompanyType ? 'Other' : (d.companyType || '');
        const customCompanyType = isCustomCompanyType ? d.companyType : '';

        setForm(prev => ensureNestedDefaults({
          ...prev,
          ...d,
          customerRef: getLiveCustomerId(d),
          customerName: getLiveCustomerName(d),
          inquiryDate:      d.inquiryDate      ? new Date(d.inquiryDate).toISOString().split('T')[0]      : prev.inquiryDate,
          city:             d.city || d.location || '',
          companyType:      displayCompanyType,
          customCompanyType,
          deliveryDate:     d.deliveryDate      ? new Date(d.deliveryDate).toISOString().split('T')[0]     : '',
          nextFollowUpDate: d.nextFollowUpDate  ? new Date(d.nextFollowUpDate).toISOString().split('T')[0] : '',
          loadDetails:      d.loadDetails?.length ? d.loadDetails : [DEFAULT_LOAD_ROW()],
          controlMatrix:    d.controlMatrix || {},
          panelTypes,
          customPanelType,
          supplyVoltage:    displayVoltage,
          customVoltage,
          industryType:     displayIndustryType,
          customIndustryType,
          contacts,
          // Ensure budget/priority not displayed (remove from loaded data)
          estimatedValue: undefined,
          priority:        undefined,
        }));

        // Load already-saved attachments (back-filled by controller)
        setSavedAttachments(
          (d.attachments || []).filter(a => a && (a.storedName || a.originalName))
        );
        setSavedBomAttachments(
          (d.bomAttachments || []).filter(a => a && (a.storedName || a.originalName))
        );
      } catch {
        toast.error('Failed to load inquiry');
        navigate(inquiryReturnPath);
      } finally {
        setPageLoading(false);
      }
    })();
  }, [id, inquiryReturnPath, isExistingInquiry, navigate, toast]);

  const buildContactsFromCustomer = useCallback((customer = {}) => {
    const contacts = Array.isArray(customer.contacts) ? customer.contacts : [];
    const cleaned = contacts
      .map((contact) => ({
        id: contact?._id || Date.now() + Math.random(),
        name: contact?.name || contact?.contactPerson || '',
        phone: contact?.phone || contact?.mobileNumber || contact?.contactNumber || '',
        email: contact?.email || '',
        designation: contact?.designation || '',
      }))
      .filter((contact) => contact.name || contact.phone || contact.email || contact.designation);

    if (cleaned.length) return cleaned;

    if (customer.contactPerson || customer.mobileNumber || customer.email) {
      return [{
        id: Date.now() + Math.random(),
        name: customer.contactPerson || '',
        phone: customer.mobileNumber || '',
        email: customer.email || '',
        designation: customer.designation || '',
      }];
    }

    return [DEFAULT_CONTACT()];
  }, []);

  const applyCustomerToInquiryForm = useCallback((customer = {}) => {
    const knownCompanyTypes = ['End User', 'OEM', 'Consultant', 'Contractor',
      'System Integrator', 'Panel Builder', 'Dealer / Trader', 'Other'];
    const isCustomCompanyType = customer.companyType && !knownCompanyTypes.includes(customer.companyType);

    setSprint2Form((prev) => ({
      ...prev,
      customerRef: customer._id || customer.id || '',
      customerName: customer.customerName || '',
      companyType: isCustomCompanyType ? 'Other' : (customer.companyType || ''),
      customCompanyType: isCustomCompanyType ? customer.companyType : '',
      contacts: buildContactsFromCustomer(customer),
      siteAddress: customer.address || customer.siteAddress || '',
      city: customer.city || '',
    }));

    setErrors((prev) => {
      const next = { ...prev };
      delete next.customerName;
      delete next.companyType;
      delete next.customCompanyType;
      delete next.siteAddress;
      delete next.city;
      Object.keys(next).forEach((key) => {
        if (key.startsWith('contacts.')) delete next[key];
      });
      return next;
    });
  }, [buildContactsFromCustomer, setSprint2Form]);

  const handleCustomerSelect = useCallback((customerId) => {
    if (!customerId) {
      setSprint2Form((prev) => ({
        ...prev,
        customerRef: '',
        customerName: '',
        companyType: '',
        customCompanyType: '',
        contacts: [DEFAULT_CONTACT()],
        siteAddress: '',
        city: '',
      }));
      return;
    }

    const customer = customers.find((item) => String(item._id || item.id) === String(customerId));
    if (customer) applyCustomerToInquiryForm(customer);
  }, [applyCustomerToInquiryForm, customers, setSprint2Form]);

  const loadCustomers = useCallback(async () => {
    if (!canViewCustomer) {
      setCustomers([]);
      return;
    }

    try {
      const { data } = await API.get('/customers', { params: { page: 1, limit: 1000 } });
      const rows = data.data || data.customers || [];
      setCustomers(rows);
      setCompanySuggestions([...new Set(rows.map(c => c.customerName || c.companyName).filter(Boolean))]);
      setContactNameSuggestions([...new Set(rows.map(c => c.contactPerson).filter(Boolean))]);
      setCitySuggestions([...new Set(rows.map(c => c.city).filter(Boolean))]);
    } catch { /* non-fatal */ }
  }, [canViewCustomer]);

  // ── Customer Master dropdown ───────────────────────────────────────────────
  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleCreateCustomerFromInquiry = useCallback(async (payload) => {
    if (!canCreateCustomer) {
      toast.error('You do not have permission to create customers');
      return;
    }

    setCreatingCustomer(true);
    try {
      const { data } = await API.post('/customers', payload);
      const customer = data.data || data.customer;
      if (customer?._id) {
        setCustomers((prev) => [customer, ...prev.filter((item) => String(item._id) !== String(customer._id))]);
        applyCustomerToInquiryForm(customer);
      }
      setCustomerCreateOpen(false);
      toast.success('Customer created and selected');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create customer');
    } finally {
      setCreatingCustomer(false);
    }
  }, [applyCustomerToInquiryForm, canCreateCustomer, toast]);

  const handleUpdateCustomerFromInquiry = useCallback(async (payload) => {
    const customerId = form.customerRef;
    if (!customerId) return;

    setUpdatingCustomer(true);
    try {
      const { data } = await API.put(`/customers/${customerId}`, payload);
      const customer = data?.data || data?.customer;

      if (customer?._id) {
        setCustomers((prev) => prev.map((item) => (
          String(item?._id || item?.id) === String(customer._id) ? customer : item
        )));
        applyCustomerToInquiryForm(customer);
      }

      setCustomerDetailsEditing(false);
      toast.success('Customer updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update customer');
    } finally {
      setUpdatingCustomer(false);
    }
  }, [applyCustomerToInquiryForm, form.customerRef, toast]);

  // ── Past inquiries (for Repeat Order selector) ─────────────────────────────
  useEffect(() => {
    if (form.offerType !== 'repeat') {
      setPastInquiries([]);
      return;
    }

    (async () => {
      try {
        const params = new URLSearchParams({
          limit: '100',
          status: 'Order Won',
        });

        if (form.customerRef) {
          params.set('customerRef', form.customerRef);
        }

        const { data } = await API.get(`/inquiries?${params.toString()}`);
        const currentInquiryId = id ? String(id) : '';
        const list = (data.data || []).filter((item) => {
          const itemId = String(item?._id || '');
          return !currentInquiryId || itemId !== currentInquiryId;
        });
        setPastInquiries(list);
      } catch {
        setPastInquiries([]);
      }
    })();
  }, [form.offerType, form.customerRef, id]);

  // ── Section scroll helper + tracker ─────────────────────────────────────────
  const scrollToSection = useCallback((index) => {
    const targetRefIndex = getStepperTargetRefIndex(form.panelTypes, index);
    const target = sectionRefs.current[targetRefIndex];
    if (!target) return;

    const main = document.querySelector('main');

    if (main) {
      const mainRect = main.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      main.scrollTo({
        top:
          main.scrollTop +
          targetRect.top -
          mainRect.top -
          STICKY_STEPPER_SCROLL_OFFSET,
        behavior: 'smooth',
      });

      return;
    }

    window.scrollTo({
      top:
        window.scrollY +
        target.getBoundingClientRect().top -
        STICKY_STEPPER_SCROLL_OFFSET,
      behavior: 'smooth',
    });
  }, [form.panelTypes]);

  useEffect(() => {
    const handler = () => {
      const stepCount = getSectionsForPanelTypes(form.panelTypes).length;
      const visibleSections = sectionRefs.current.slice(0, stepCount);

      // Pick the section heading nearest to the sticky stepper line.
      // This avoids one-step-late highlighting when the next section is already visible.
      const activationLine = STICKY_STEPPER_SCROLL_OFFSET + 130;

      let nextActive = 0;
      let bestDistance = Number.POSITIVE_INFINITY;

      visibleSections.forEach((section, index) => {
        if (!section) return;

        const top = section.getBoundingClientRect().top;
        const distance = Math.abs(top - activationLine);

        if (distance < bestDistance) {
          bestDistance = distance;
          nextActive = index;
        }
      });

      setActiveSection((prev) => (prev === nextActive ? prev : nextActive));
    };

    const main = document.querySelector('main');

    handler();

    main?.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('scroll', handler, { passive: true });

    return () => {
      main?.removeEventListener('scroll', handler);
      window.removeEventListener('scroll', handler);
    };
  }, [form.panelTypes]);

useEffect(() => {
  if (isEdit) {
    setDraftLoaded(true);
    return;
  }

  try {
    const savedDraft = localStorage.getItem(DRAFT_KEY);

    if (savedDraft) {
      const draft = JSON.parse(savedDraft);

      setForm(prev => ensureNestedDefaults({
        ...prev,
        ...draft,
        inquiryType: inferInquiryTypeFromRecord(draft),
        contacts: Array.isArray(draft.contacts) && draft.contacts.length > 0
          ? draft.contacts
          : prev.contacts,
        loadDetails: Array.isArray(draft.loadDetails) && draft.loadDetails.length > 0
          ? draft.loadDetails
          : prev.loadDetails,
        controlMatrix: draft.controlMatrix || prev.controlMatrix || {},
      }));
    }
  } catch (err) {
    console.error('Draft restore failed', err);
  }

  setDraftLoaded(true);
}, [isEdit]);

  // ── Generic field setter ────────────────────────────────────────────────────
 const set = useCallback((field) => (val) => {
  const value = val?.target !== undefined ? val.target.value : val;
  setSprint2Form(prev => ({ ...prev, [field]: value }));
  setErrors(prev => ({ ...prev, [field]: '' }));
}, [setSprint2Form]);

  // ── Contacts helpers ────────────────────────────────────────────────────────
const addContact = () => {
  setSprint2Form(prev => ({
    ...prev,
    contacts: [...(Array.isArray(prev.contacts) ? prev.contacts : []), DEFAULT_CONTACT()],
  }));
};

const removeContact = (idOrIndex) => {
  setSprint2Form(prev => {
    const contacts = Array.isArray(prev.contacts) ? prev.contacts : [];

    const nextContacts = typeof idOrIndex === 'number'
      ? contacts.filter((_, index) => index !== idOrIndex)
      : contacts.filter(c => c.id !== idOrIndex);

    return {
      ...prev,
      contacts: nextContacts.length > 0 ? nextContacts : [DEFAULT_CONTACT()],
    };
  });
};

const updateContact = (idOrIndex, field, value) => {
  setSprint2Form(prev => {
    const contacts = Array.isArray(prev.contacts) ? prev.contacts : [];

    return {
      ...prev,
      contacts: contacts.map((contact, index) => {
        const matched = typeof idOrIndex === 'number'
          ? index === idOrIndex
          : contact.id === idOrIndex;

        return matched ? { ...contact, [field]: value } : contact;
      }),
    };
  });
};

  // ── File attachment helpers ─────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length === 0) return;
    const totalCount = savedAttachments.length + stagedFiles.length + newFiles.length;
    if (totalCount > 10) {
      toast.error('Maximum 10 attachments allowed');
      return;
    }
    setStagedFiles(prev => [...prev, ...newFiles]);
    // Reset input so same file can be re-added after removal
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const handleDrag = (e) => {
  e.preventDefault();
  e.stopPropagation();

  if (e.type === 'dragenter' || e.type === 'dragover') {
    setDragActive(true);
  }

  if (e.type === 'dragleave') {
    setDragActive(false);
  }
};

const handleDrop = (e) => {
  e.preventDefault();
  e.stopPropagation();

  setDragActive(false);

  const files = Array.from(e.dataTransfer.files || []);

  if (!files.length) return;

  const totalCount =
    savedAttachments.length +
    stagedFiles.length +
    files.length;

  if (totalCount > 10) {
    toast.error('Maximum 10 attachments allowed');
    return;
  }

  setStagedFiles(prev => [...prev, ...files]);
};

  const removeStagedFile = (index) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeSavedAttachment = (index) => {
    setSavedAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleBomFileSelect = (e) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length === 0) return;

    const totalCount = savedBomAttachments.length + bomStagedFiles.length + newFiles.length;
    if (totalCount > 10) {
      toast.error('Maximum 10 BOM attachments allowed');
      return;
    }

    setBomStagedFiles(prev => [...prev, ...newFiles]);
    if (bomFileInputRef.current) bomFileInputRef.current.value = '';
  };

  const removeBomStagedFile = (index) => {
    setBomStagedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeSavedBomAttachment = (index) => {
    setSavedBomAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = () => validateInquiry(form).errors;

  const getFirstValidationMessage = (errorMap = {}) => {
    const firstKey = Object.keys(errorMap || {})[0];
    return firstKey ? errorMap[firstKey] : '';
  };

  const scrollToFirstValidationError = useCallback((firstErrorKey = '') => {
    const getFallbackSectionIndex = (key = '') => {
      const indexes = getInquirySectionIndexes(form.panelTypes);

      if (
        key === 'customerName' ||
        key.startsWith('contacts.') ||
        ['projectName', 'offerType', 'previousOrderRef'].includes(key)
      ) return indexes.client;
      if (
        [
          'inquiryType', 'panelTypes', 'inquiryDate', 'status',
          'panelAreaClassification', 'panelAreaClass', 'installationType',
          'ipRating', 'enclosureType', 'enclosureMaterial', 'enclosureMake',
          'panelStructure', 'cableEntry', 'switchgearMake', 'customSwitchgearMake',
        ].includes(key)
      ) return indexes.general;
      if (key.startsWith('plcDetails.')) return indexes.plc >= 0 ? indexes.plc : indexes.general;
      if (key.startsWith('vfdDetails.mainIncomer')) return indexes.vfdPanel >= 0 ? indexes.vfdPanel : indexes.general;
      if (key.startsWith('vfdDetails.')) {
        return indexes.engineering >= 0
          ? indexes.engineering
          : indexes.vfdPanel >= 0
            ? indexes.vfdPanel
            : indexes.general;
      }
      if (key.startsWith('mccDetails.')) return indexes.mcc >= 0 ? indexes.mcc : indexes.general;
      if (key.startsWith('flpEnclosureDetails.')) return indexes.flp >= 0 ? indexes.flp : indexes.general;
      if (key.startsWith('rioBoxDetails.')) return indexes.rio >= 0 ? indexes.rio : indexes.general;
      if (key === 'bomSubmissionRemarks') return indexes.technicalBom;
      if (
        key === 'supplyVoltage' ||
        key === 'controlVoltage' ||
        key === 'applicationProcess' ||
        key.includes('incomerDetails') ||
        key.includes('outgoingFeederDetails')
      ) {
        return indexes.technical >= 0 ? indexes.technical : indexes.general;
      }
      if (key.includes('supportRequirements') || key.includes('notesAndSupport')) {
        return indexes.engineering >= 0 ? indexes.engineering : indexes.general;
      }
      return indexes.client;
    };

    const scrollTarget =
      document.querySelector('[data-field-error="true"]') ||
      sectionRefs.current[getFallbackSectionIndex(firstErrorKey)];

    if (!scrollTarget) return;

    // Center the actual error field in the viewport. The previous section-top
    // scroll could leave the red field hidden behind the sticky Update bar.
    scrollTarget.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });

    const focusTarget = scrollTarget.querySelector?.(
      'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])'
    );

    setTimeout(() => focusTarget?.focus?.({ preventScroll: true }), 450);
  }, [form.panelTypes]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isView) return;

    if (isEdit && !canEditInquiry) {
      toast.error('You do not have permission to edit inquiries');
      return;
    }

    if (!isEdit && !canCreateInquiry) {
      toast.error('You do not have permission to create inquiries');
      return;
    }

    if (form.status === 'Commercial BOM Submission' && !canCommercialSubmit) {
      toast.error('Commercial Submit permission is required');
      return;
    }

    if (!isEdit && !canEditInquiry && form.status !== 'New') {
      toast.error('Edit Inquiry permission is required to create an inquiry with a non-New status');
      return;
    }

    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => scrollToFirstValidationError(Object.keys(errs)[0]));
      });
      toast.error(getFirstValidationMessage(errs) || 'Please fix the highlighted errors');
      return;
    }
    // <Button
    //   type="button"
    //   variant="outline"
    //   onClick={() => {
    //     localStorage.removeItem(DRAFT_KEY);
    //     navigate(inquiryReturnPath);
    //   }}
    // ></Button>
    setSubmitting(true);
    try {
      // Strip transient UI-only `id` field from each contact before sending
      const cleanContacts = form.contacts
        .filter(c => c.name || c.phone || c.email)
        .map(({ id, _id, ...rest }) => rest);

      // Resolve "Other/Custom" field values before sending
      const resolvedCompanyType = form.companyType === 'Other' ? form.customCompanyType : form.companyType;
      const resolvedIndustryType = form.industryType === 'Other' ? form.customIndustryType : form.industryType;
      const resolvedVoltage  = form.supplyVoltage === 'Custom' ? form.customVoltage  : form.supplyVoltage;
      const resolvedIpRating = form.ipRating      === 'OTHER'  ? form.ipRatingCustom : form.ipRating;

      // Build FormData so files can be sent alongside JSON fields
      const fd = new FormData();

      // Append new (staged) files under field name 'attachments' (multer array name)
      stagedFiles.forEach(f => fd.append('attachments', f));
      bomStagedFiles.forEach(f => fd.append('bomAttachments', f));

      // Build JSON payload — all scalar/array fields
            // Build JSON payload — Sprint 2 nested inquiry payload + legacy compatibility
      const compatibilityPanelTypes = normalizeInquiryPanelTypes(form.panelTypes || []);
      const resolvedInquiryType = getInquiryTypeFromPanelTypes(compatibilityPanelTypes);
      const compatibilityProductType = getProductTypeFromPanelTypes(compatibilityPanelTypes);
      const includesMcc = hasInquiryPanelType(compatibilityPanelTypes, 'MCC') ||
        hasInquiryPanelType(compatibilityPanelTypes, 'MCC cum PLC');
      const includesVfd = hasInquiryPanelType(compatibilityPanelTypes, 'VFD');
      const includesPlc = hasInquiryPanelType(compatibilityPanelTypes, 'PLC') ||
        hasInquiryPanelType(compatibilityPanelTypes, 'MCC cum PLC');
      const includesFlp = hasInquiryPanelType(compatibilityPanelTypes, 'FLP');
      const includesRio = hasInquiryPanelType(compatibilityPanelTypes, 'RIO Box');

      const compatibilityLoadDetails = includesMcc
        ? (form.mccDetails?.loadDetails || [])
        : includesVfd
          ? (form.vfdDetails?.loadDetails || [])
          : (form.loadDetails || []);

      const rawPlcDetails = form.plcDetails || defaultPlcDetails();
      const rawVfdDetails = form.vfdDetails || defaultVfdDetails();

      const sharedSwitchgearMake = form.switchgearMake ||
        rawPlcDetails.switchgearMake ||
        rawVfdDetails.switchgearMake ||
        form.mccDetails?.outgoingFeederDetails?.switchgearMake ||
        '';
      const sharedCustomSwitchgearMake = form.customSwitchgearMake ||
        rawPlcDetails.customSwitchgearMake ||
        rawVfdDetails.customSwitchgearMake ||
        form.mccDetails?.outgoingFeederDetails?.customSwitchgearMake ||
        '';

      const sanitizedPlcDetails = sanitizePlcDetailsForSubmit({
        ...rawPlcDetails,
        switchgearMake: includesPlc ? sharedSwitchgearMake : rawPlcDetails.switchgearMake,
        customSwitchgearMake: includesPlc
          ? sharedCustomSwitchgearMake
          : rawPlcDetails.customSwitchgearMake,
      });

      const sanitizedVfdDetails = {
        ...rawVfdDetails,
        mainIncomer: sanitizeMainIncomerForSubmit(rawVfdDetails.mainIncomer),
        switchgearMake: includesVfd ? sharedSwitchgearMake : rawVfdDetails.switchgearMake,
        customSwitchgearMake: includesVfd ? sharedCustomSwitchgearMake : rawVfdDetails.customSwitchgearMake,
        additionalComponents: sanitizeComponentRequirementRows(
          rawVfdDetails.additionalComponents || []
        ),
      };

      const sanitizedRioBoxDetails = includesRio
        ? {
            ...(form.rioBoxDetails || defaultRioBoxDetails()),
            mainIncomer: sanitizeMainIncomerForSubmit(
              form.rioBoxDetails?.mainIncomer || defaultRioBoxDetails().mainIncomer
            ),
          }
        : undefined;

      const sanitizedMccDetails = sanitizeMccDetailsForSubmit({
        ...(form.mccDetails || defaultMccDetails()),
        outgoingFeederDetails: {
          ...(form.mccDetails?.outgoingFeederDetails || {}),
          switchgearMake: includesMcc
            ? sharedSwitchgearMake
            : form.mccDetails?.outgoingFeederDetails?.switchgearMake,
          customSwitchgearMake: includesMcc
            ? sharedCustomSwitchgearMake
            : form.mccDetails?.outgoingFeederDetails?.customSwitchgearMake,
        },
        layoutPreferences: {
          ...(form.mccDetails?.layoutPreferences || {}),
          panelStructure: form.panelStructure || form.mccDetails?.layoutPreferences?.panelStructure || '',
        },
      }, form);

      const plcMainIncomer = sanitizedPlcDetails.mainIncomerFeeder || {};
      const resolvedPlcSupplyVoltage = plcMainIncomer.supplyVoltage === 'Custom'
        ? plcMainIncomer.customSupplyVoltage || ''
        : plcMainIncomer.supplyVoltage || '';
      const mccMainIncomer = sanitizedMccDetails.incomerDetails || {};
      const mccSupplyVoltage = mccMainIncomer.supplyVoltage || mccMainIncomer.incomingVoltage || '';
      const resolvedMccSupplyVoltage = mccSupplyVoltage === 'Custom'
        ? mccMainIncomer.customSupplyVoltage || mccMainIncomer.customIncomingVoltage || ''
        : mccSupplyVoltage;
      const compatibilityResolvedVoltage =
        resolvedVoltage ||
        (includesPlc ? resolvedPlcSupplyVoltage : '') ||
        (includesMcc ? resolvedMccSupplyVoltage : '');
      const compatibilityFrequency =
        form.frequency || (includesMcc ? mccMainIncomer.frequency || '' : '');
      const compatibilityShortCircuitCapacity =
        form.shortCircuitCapacity || (includesMcc ? mccMainIncomer.kaRating || '' : '');

      const resolvedEnclosureMaterial = String(
        form.enclosureType || form.enclosureMaterial || form.enclosureStandard || ''
      ).trim();
      const shouldSubmitPanelColour = Boolean(resolvedEnclosureMaterial) &&
        !['SS304', 'SS316'].includes(resolvedEnclosureMaterial.toUpperCase());

     const compatibilityControlMatrix =
        includesPlc
          ? {
              ...(form.controlMatrix || {}),
              automationRequirements: sanitizedPlcDetails.automationRequirements || [],
              ioDetails: sanitizedPlcDetails.ioDetails || {},
            }
          : (form.controlMatrix || {});

      const preparedPayload = ensureNestedDefaults({
        ...form,

        inquiryType: resolvedInquiryType,

        contacts: cleanContacts,
        customerRef: form.customerRef || '',
        customerName: form.customerName,
        companyType: resolvedCompanyType || '',
        city: form.city || '',
        location: form.city || form.siteAddress,

        productType: compatibilityProductType,
        panelTypes: compatibilityPanelTypes,
        loadDetails: compatibilityLoadDetails,
        controlMatrix: compatibilityControlMatrix,

        industryType: resolvedIndustryType,
        supplyVoltage: compatibilityResolvedVoltage,
        frequency: compatibilityFrequency,
        shortCircuitCapacity: compatibilityShortCircuitCapacity,
        ipRating: resolvedIpRating,

        applicationProcess: form.applicationProcess || '',

        panelAreaClassification: form.panelAreaClassification || form.panelAreaClass || '',
        panelAreaClass: form.panelAreaClass || form.panelAreaClassification || '',

        enclosureType: form.enclosureType || form.enclosureMaterial || form.enclosureStandard || '',
        enclosureMaterial: form.enclosureMaterial || form.enclosureType || form.enclosureStandard || '',
        enclosureStandard: form.enclosureStandard || form.enclosureType || form.enclosureMaterial || '',
        enclosureMake: form.enclosureMake || '',
        panelStructure: form.panelStructure || sanitizedMccDetails.layoutPreferences?.panelStructure || '',
        switchgearMake: sharedSwitchgearMake,
        customSwitchgearMake: sharedCustomSwitchgearMake,

        panelColourRal: shouldSubmitPanelColour ? (form.panelColourRal || '') : '',
        controlVoltage: form.controlVoltage || '',
        controlFeeder: isControlFeederSupplyVoltage(compatibilityResolvedVoltage) && Boolean(form.controlFeeder),
        cableEntry: form.cableEntry || '',
        cableGlandMaterial: form.cableGlandMaterial || '',
        barrierVariant: form.barrierVariant || '',

        drawingsSldAttached: form.drawingsSldAttached || '',
        equipmentListAttached: form.equipmentListAttached || '',
        referenceBomAttached: form.referenceBomAttached || '',

        plcDetails: sanitizedPlcDetails,
        vfdDetails: sanitizedVfdDetails,
        mccDetails: sanitizedMccDetails,
        flpEnclosureDetails: includesFlp
          ? (form.flpEnclosureDetails || defaultFlpEnclosureDetails())
          : undefined,
        rioBoxDetails: sanitizedRioBoxDetails,

        customPanelType: undefined,
        previousOrderRef: form.previousOrderRef || undefined,

        keptAttachments: savedAttachments,
        keptBomAttachments: savedBomAttachments,
        bomSubmissionRemarks: form.bomSubmissionRemarks || '',
      });

      const jsonPayload = {
        ...preparedPayload,

        inquiryType: resolvedInquiryType,

        plcDetails: preparedPayload.plcDetails,
        vfdDetails: preparedPayload.vfdDetails,
        mccDetails: sanitizedMccDetails,
        flpEnclosureDetails: preparedPayload.flpEnclosureDetails,
        rioBoxDetails: preparedPayload.rioBoxDetails,

        productType: compatibilityProductType,
        panelTypes: compatibilityPanelTypes,
        loadDetails: compatibilityLoadDetails,
        controlMatrix: compatibilityControlMatrix,

        contacts: cleanContacts,
        customerRef: preparedPayload.customerRef || '',
        customerName: preparedPayload.customerName,
        companyType: resolvedCompanyType || '',
        city: preparedPayload.city || '',
        location: preparedPayload.location,

        industryType: resolvedIndustryType,
        supplyVoltage: compatibilityResolvedVoltage,
        ipRating: resolvedIpRating,

        applicationProcess: preparedPayload.applicationProcess,

        panelAreaClassification: preparedPayload.panelAreaClassification,
        panelAreaClass: preparedPayload.panelAreaClass,

        enclosureType: preparedPayload.enclosureType,
        enclosureMaterial: preparedPayload.enclosureMaterial,
        enclosureStandard: preparedPayload.enclosureStandard,
        enclosureMake: preparedPayload.enclosureMake,
        panelStructure: preparedPayload.panelStructure,
        switchgearMake: preparedPayload.switchgearMake,
        customSwitchgearMake: preparedPayload.customSwitchgearMake,

        panelColourRal: preparedPayload.panelColourRal,
        controlVoltage: preparedPayload.controlVoltage,
        controlFeeder: isControlFeederSupplyVoltage(compatibilityResolvedVoltage) && Boolean(preparedPayload.controlFeeder),
        cableEntry: preparedPayload.cableEntry,
        cableGlandMaterial: preparedPayload.cableGlandMaterial,
        barrierVariant: preparedPayload.barrierVariant,

        drawingsSldAttached: preparedPayload.drawingsSldAttached,
        equipmentListAttached: preparedPayload.equipmentListAttached,
        referenceBomAttached: preparedPayload.referenceBomAttached,

        customPanelType: undefined,
        previousOrderRef: form.previousOrderRef || undefined,

        customCompanyType: undefined,
        customIndustryType: undefined,
        customVoltage: undefined,
        ipRatingCustom: undefined,

        estimatedValue: undefined,
        priority: undefined,

        keptAttachments: savedAttachments,
        keptBomAttachments: savedBomAttachments,
        bomSubmissionRemarks: preparedPayload.bomSubmissionRemarks || '',
      };

      delete jsonPayload._id;
      delete jsonPayload.__v;
      delete jsonPayload.inquiryId;
      delete jsonPayload.createdBy;
      delete jsonPayload.createdAt;
      delete jsonPayload.updatedAt;

      fd.append('_json', JSON.stringify(jsonPayload));


      const headers = { 'Content-Type': 'multipart/form-data' };

      if (isEdit) {
        await API.put(`/inquiries/${id}`, fd, { headers });
        toast.success('Inquiry updated successfully');
      } else {
        const { data } = await API.post('/inquiries', fd, { headers });
        toast.success(`Inquiry #${data.data.inquiryId} created successfully`);
      }
      localStorage.removeItem(DRAFT_KEY);
      navigate(inquiryReturnPath);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save inquiry');
    } finally {
      setSubmitting(false);
    }
  };

  const customerOptions = customers
    .map((customer) => {
      const value = customer?._id || customer?.id || '';
      const label = customer?.customerName || customer?.companyName || customer?.name || customer?.customerId || '';
      return value && label ? { value, label } : null;
    })
    .filter(Boolean);

  if (
    form.customerRef &&
    form.customerName &&
    !customerOptions.some((option) => String(option.value) === String(form.customerRef))
  ) {
    customerOptions.unshift({ value: form.customerRef, label: form.customerName });
  }

  const selectedCustomerForDetails = customers.find((customer) => (
    String(customer?._id || customer?.id || '') === String(form.customerRef || '')
  )) || {
    customerName: form.customerName || '',
    companyType: form.companyType === 'Other' ? form.customCompanyType : form.companyType,
    contacts: form.contacts || [],
    city: form.city || '',
    address: form.siteAddress || '',
  };

  const currentUserId = String(user?._id || user?.id || '');
  const selectedCustomerCreatorId = String(
    selectedCustomerForDetails?.createdBy?._id ||
    selectedCustomerForDetails?.createdBy?.id ||
    selectedCustomerForDetails?.createdBy ||
    ''
  );
  const canEditSelectedCustomer = Boolean(
    form.customerRef &&
    (canEditCustomer || (
      currentUserId &&
      selectedCustomerCreatorId &&
      currentUserId === selectedCustomerCreatorId
    ))
  );

  const handleDownloadPdf = async () => {
    if (!id || downloadingPdf) return;

    try {
      setDownloadingPdf(true);
      const response = await API.get(`/inquiries/${encodeURIComponent(id)}/pdf`, {
        responseType: 'arraybuffer',
        headers: { Accept: 'application/pdf' },
      });

      const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
      if (!contentType.includes('application/pdf')) {
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(response.data);
        let message = 'The server did not return a PDF file';
        try {
          const parsed = JSON.parse(text);
          message = parsed.message || message;
        } catch (_) {
          // Use the clear fallback message above.
        }
        throw new Error(message);
      }

      const bytes = new Uint8Array(response.data);
      const signature = String.fromCharCode(...bytes.slice(0, 5));
      if (signature !== '%PDF-') {
        throw new Error('The generated file is not a valid PDF');
      }

      const disposition = response.headers?.['content-disposition'] || '';
      const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const quotedName = disposition.match(/filename="([^"]+)"/i)?.[1];
      const plainName = disposition.match(/filename=([^;]+)/i)?.[1]?.trim();
      const fallbackName = form.inquiryId
        ? `Inquiry-${form.inquiryId}.pdf`
        : 'Inquiry.pdf';
      const fileName = encodedName
        ? decodeURIComponent(encodedName)
        : (quotedName || plainName || fallbackName);

      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName.replace(/[\/:*?"<>|]+/g, '-');
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 10_000);
      toast.success('Inquiry PDF downloaded successfully');
    } catch (error) {
      let message = error?.message || 'Failed to download inquiry PDF';
      const responseData = error.response?.data;

      if (responseData instanceof ArrayBuffer) {
        try {
          const parsed = JSON.parse(new TextDecoder('utf-8').decode(responseData));
          message = parsed.message || message;
        } catch (_) {
          // Keep the most useful available error message.
        }
      } else if (responseData instanceof Blob) {
        try {
          const parsed = JSON.parse(await responseData.text());
          message = parsed.message || message;
        } catch (_) {
          // Keep the most useful available error message.
        }
      } else if (responseData?.message) {
        message = responseData.message;
      }

      toast.error(message);
    } finally {
      setDownloadingPdf(false);
    }
  };

  // ─── Page loading ───────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white placeholder-gray-400';

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="fade-in min-w-0 max-w-none space-y-0 overflow-x-visible pb-0">

      {/* ── Sticky Page Header + Step Progress Bar ───────────────────────────── */}
      <PageHeader bleed="main" bleedTop={false} contentClassName="px-1 sm:px-2">
        <div className="flex min-w-0 flex-col items-start justify-between gap-2 xl:flex-row xl:items-start xl:gap-4">
          <div className="w-full min-w-0 xl:w-auto">
            <button
              onClick={() => navigate(inquiryReturnPath)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-2 transition-colors"
            >
              <ChevronLeft size={16} /> {canViewInquiry ? 'Back to Inquiries' : 'Back to Dashboard'}
            </button>
            <div className="flex min-w-0 items-center gap-2">
              <ClipboardCheck size={18} className="text-blue-600 shrink-0" />
              <h2 className="min-w-0 break-words text-lg font-bold text-gray-900 sm:text-xl">
                {isView ? 'View Inquiry' : isEdit ? 'Edit Inquiry' : 'New Electrical Panel Inquiry'}
              </h2>
            </div>
            <p className="mt-0.5 text-sm text-gray-500">
              {isView
                ? 'Review the inquiry details below'
                : isEdit
                  ? 'Update the inquiry details below'
                  : 'Complete all sections. Fields marked * are required.'}
            </p>
          </div>

          {isView && (
            <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadPdf}
                loading={downloadingPdf}
                disabled={downloadingPdf}
                className="w-full justify-center sm:w-auto"
              >
                {!downloadingPdf && <Download size={16} />}
                {downloadingPdf ? 'Generating PDF…' : 'Download PDF'}
              </Button>

              {canEditInquiry && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => navigate(`/inquiries/${id}/edit`)}
                  className="w-full justify-center sm:w-auto"
                >
                  <Edit2 size={16} /> Edit Inquiry
                </Button>
              )}
            </div>
          )}

          <div className="w-full min-w-0 overflow-hidden xl:flex-1">
            <StepProgressBar
              steps={getSectionsForPanelTypes(form.panelTypes)}
              currentStep={getCurrentStepperIndex(form.panelTypes, activeSection)}
              onStepClick={scrollToSection}
            />
          </div>
        </div>
      </PageHeader>

      <form onSubmit={handleSubmit} className="min-w-0 space-y-4" noValidate>


{false && (
  <>
    {/* ══════════════════════════════════════════════════════════════════════
        LEGACY SECTION 1 — CLIENT INFORMATION
        Kept for rollback only. Replaced by CommonInquirySections.
    ══════════════════════════════════════════════════════════════════════ */}
    <div ref={el => sectionRefs.current[0] = el}>
      <SectionCard number="1" title="Client Information" subtitle="Customer, site address, and contact persons" icon={Building2} color="blue">
        {/* Legacy UI isolated for Sprint 2 rollback */}
      </SectionCard>
    </div>

    {/* ══════════════════════════════════════════════════════════════════════
        LEGACY SECTION 2 — PROJECT DETAILS
        Kept for rollback only. Replaced by CommonInquirySections.
    ══════════════════════════════════════════════════════════════════════ */}
    <div ref={el => sectionRefs.current[1] = el}>
      <SectionCard number="2" title="Project Details" subtitle="Project name, industry type, and offer type" icon={FolderOpen} color="orange">
        {/* Legacy UI isolated for Sprint 2 rollback */}
      </SectionCard>
    </div>

    {/* ══════════════════════════════════════════════════════════════════════
        LEGACY SECTION 3 — PANEL TYPE & APPLICATION
        Kept for rollback only.
    ══════════════════════════════════════════════════════════════════════ */}
    <div ref={el => sectionRefs.current[2] = el}>
      <SectionCard number="3" title="Panel Type & Application" subtitle="Select one or more panel types required for this project" icon={Zap} color="amber">
        {/* Legacy UI isolated for Sprint 2 rollback */}
      </SectionCard>
    </div>

    {/* ══════════════════════════════════════════════════════════════════════
        LEGACY SECTION 4 — TECHNICAL SPECIFICATIONS
        Kept for rollback only.
    ══════════════════════════════════════════════════════════════════════ */}
    <div ref={el => sectionRefs.current[3] = el}>
      <SectionCard number="4" title="Technical Specifications" subtitle="Electrical parameters, protection class, and environment" icon={Settings} color="cyan">
        {/* Legacy UI isolated for Sprint 2 rollback */}
      </SectionCard>
    </div>

    {/* ══════════════════════════════════════════════════════════════════════
        LEGACY SECTION 5 — LOAD DETAILS
        Kept for rollback only.
    ══════════════════════════════════════════════════════════════════════ */}
    <div ref={el => sectionRefs.current[4] = el}>
      <SectionCard number="5" title="Load Details" subtitle="Legacy load table" icon={Cpu} color="violet">
        {/* Legacy UI isolated for Sprint 2 rollback */}
      </SectionCard>
    </div>

    {/* ══════════════════════════════════════════════════════════════════════
        LEGACY SECTION 6 — CONTROL & MONITORING REQUIREMENTS
        Kept for rollback only.
    ══════════════════════════════════════════════════════════════════════ */}
    <div ref={el => sectionRefs.current[5] = el}>
      <SectionCard number="6" title="Control & Monitoring Requirements" subtitle="Legacy control matrix" icon={Shield} color="green">
        {/* Legacy UI isolated for Sprint 2 rollback */}
      </SectionCard>
    </div>

    {/* ══════════════════════════════════════════════════════════════════════
        LEGACY SECTION 7 — STANDARDS & COMPLIANCE
        Kept for rollback only.
    ══════════════════════════════════════════════════════════════════════ */}
    <div ref={el => sectionRefs.current[6] = el}>
      <SectionCard number="7" title="Standards & Compliance" subtitle="Legacy compliance fields" icon={ClipboardCheck} color="purple">
        {/* Legacy UI isolated for Sprint 2 rollback */}
      </SectionCard>
    </div>

    {/* ══════════════════════════════════════════════════════════════════════
        LEGACY SECTION 8 — NOTES & ATTACHMENTS
        Kept for rollback only.
    ══════════════════════════════════════════════════════════════════════ */}
    <div ref={el => sectionRefs.current[7] = el}>
      <SectionCard number="8" title="Notes & Attachments" subtitle="Legacy notes and attachments" icon={Info} color="slate">
        {/* Legacy UI isolated for Sprint 2 rollback */}
      </SectionCard>
    </div>
  </>
)}

<div>
  <CommonInquirySections
    form={form}
    setForm={setSprint2Form}
    errors={errors}
    disabled={formDisabled}
    statusDisabled={statusDisabled}
    statusOptions={statusOptions}
    setSectionRef={(index, el) => {
      sectionRefs.current[index] = el;
    }}
    activeSection={activeSection}

    companySuggestions={companySuggestions}
    contactNameSuggestions={contactNameSuggestions}
    citySuggestions={citySuggestions}
    pastInquiries={pastInquiries}
    customerOptions={customerOptions}
    canCreateCustomer={canCreateCustomer}
    canViewCustomer={canViewCustomer}
    onCustomerSelect={handleCustomerSelect}
    onCreateCustomerClick={() => setCustomerCreateOpen(true)}
    onViewCustomerClick={() => {
      setCustomerDetailsEditing(false);
      setCustomerDetailsOpen(true);
    }}

    addContact={addContact}
    removeContact={removeContact}
    updateContact={updateContact}

    stagedFiles={stagedFiles}
    savedAttachments={savedAttachments}
    bomStagedFiles={bomStagedFiles}
    savedBomAttachments={savedBomAttachments}
    dragActive={dragActive}
    fileInputRef={fileInputRef}
    bomFileInputRef={bomFileInputRef}

    handleFileSelect={handleFileSelect}
    handleDrag={handleDrag}
    handleDrop={handleDrop}

    removeStagedFile={removeStagedFile}
    removeSavedAttachment={removeSavedAttachment}
    handleBomFileSelect={handleBomFileSelect}
    removeBomStagedFile={removeBomStagedFile}
    removeSavedBomAttachment={removeSavedBomAttachment}

    formatBytes={formatBytes}
    fileEmoji={fileEmoji}

    vfdPanelContent={hasInquiryPanelType(form.panelTypes, 'VFD') ? (
      <VfdInquirySections
        form={form}
        setForm={setSprint2Form}
        errors={errors}
        disabled={formDisabled}
        mode="panel"
      />
    ) : null}

    technicalContent={(
      <div className="space-y-4">
        {hasInquiryPanelType(form.panelTypes, 'VFD') && (
          <VfdInquirySections
            form={form}
            setForm={setSprint2Form}
            errors={errors}
            disabled={formDisabled}
            mode="technical"
          />
        )}
      </div>
    )}

    engineeringContent={(
      <div className="space-y-4">
        {hasInquiryPanelType(form.panelTypes, 'VFD') && (
          <VfdInquirySections
            form={form}
            setForm={setSprint2Form}
            errors={errors}
            disabled={formDisabled}
            mode="engineering"
          />
        )}
      </div>
    )}
  />
</div>


        {/* ── Sticky Submit Bar ─────────────────────────────────────────────── */}
        {!isView && (
        <StickyActionBar
          fullBleed
          bleedBottom={false}
          status={
            Object.keys(errors).length > 0 ? (
              <>
                <AlertCircle size={16} className="text-red-500" />
                <span className="text-red-600 font-medium">
                  {Object.keys(errors).length} error(s) to fix
                  {getFirstValidationMessage(errors) ? ` — ${getFirstValidationMessage(errors)}` : ''}
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span className="text-gray-400">
                  {stagedFiles.length + bomStagedFiles.length > 0
                    ? `${stagedFiles.length + bomStagedFiles.length} file(s) ready to upload`
                    : 'All sections ready to submit'}
                </span>
              </>
            )
          }
        >
            <Button type="button" variant="outline" className="w-full justify-center sm:w-auto" onClick={() => {
            localStorage.removeItem(DRAFT_KEY);
            navigate(inquiryReturnPath);
            }}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting} className="h-8 w-full justify-center sm:w-auto sm:min-w-[145px]">
              {submitting
                ? (isEdit ? 'Updating…' : 'Submitting…')
                : (isEdit ? 'Update Inquiry' : 'Submit Inquiry')}
            </Button>
        </StickyActionBar>
        )}

      </form>

      <Modal
        isOpen={canCreateCustomer && customerCreateOpen}
        onClose={() => {
          if (!creatingCustomer) setCustomerCreateOpen(false);
        }}
        title="Create New Customer"
        size="customer"
        topOffset="topbar"
        bodyMaxHeight="calc(100vh - 11rem)"
      >
        <CustomerForm
          onSubmit={handleCreateCustomerFromInquiry}
          loading={creatingCustomer}
        />
      </Modal>

      <Modal
        isOpen={canViewCustomer && customerDetailsOpen && Boolean(form.customerRef)}
        onClose={() => {
          if (updatingCustomer) return;
          setCustomerDetailsEditing(false);
          setCustomerDetailsOpen(false);
        }}
        title={customerDetailsEditing ? 'Edit Customer' : 'Customer Details'}
        size="xl"
        topOffset="topbar"
        bodyMaxHeight="none"
        bodyClassName="!overflow-visible"
      >
        {canEditSelectedCustomer && (
          <div className="mb-4 flex justify-end">
            {customerDetailsEditing ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCustomerDetailsEditing(false)}
                disabled={updatingCustomer}
              >
                Cancel Editing
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => setCustomerDetailsEditing(true)}
              >
                <Edit2 size={14} /> Edit Customer
              </Button>
            )}
          </div>
        )}
        <CustomerForm
          initialData={selectedCustomerForDetails}
          onSubmit={handleUpdateCustomerFromInquiry}
          loading={updatingCustomer}
          readOnly={!customerDetailsEditing}
          canChangeCreatedBy={canEditCustomer}
        />
      </Modal>
    </div>
  );
};

export default ElectricalPanelInquiryPage;