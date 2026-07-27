export const INQUIRY_TYPES = {
  PLC_AUTOMATION: 'PLC_AUTOMATION',
  VFD_PANEL: 'VFD_PANEL',
  MCC_PANEL: 'MCC_PANEL',
  MCC_CUM_PLC: 'MCC_CUM_PLC',
  LEGACY: 'LEGACY',
};

export const INQUIRY_TYPE_LABELS = {
  [INQUIRY_TYPES.PLC_AUTOMATION]: 'PLC',
  [INQUIRY_TYPES.VFD_PANEL]: 'VFD',
  [INQUIRY_TYPES.MCC_PANEL]: 'MCC',
  [INQUIRY_TYPES.MCC_CUM_PLC]: 'MCC cum PLC',
  [INQUIRY_TYPES.LEGACY]: 'Legacy Inquiry',
};

export const INQUIRY_TYPE_PRODUCT_TYPE_MAP = {
  [INQUIRY_TYPES.PLC_AUTOMATION]: 'PLC',
  [INQUIRY_TYPES.VFD_PANEL]: 'VFD',
  [INQUIRY_TYPES.MCC_PANEL]: 'MCC',
  [INQUIRY_TYPES.MCC_CUM_PLC]: 'PLC_MCC',
  [INQUIRY_TYPES.LEGACY]: 'MCC',
};

export const INQUIRY_TYPE_PANEL_TYPES_MAP = {
  [INQUIRY_TYPES.PLC_AUTOMATION]: ['PLC'],
  [INQUIRY_TYPES.VFD_PANEL]: ['VFD'],
  [INQUIRY_TYPES.MCC_PANEL]: ['MCC'],
  [INQUIRY_TYPES.MCC_CUM_PLC]: ['MCC cum PLC'],
  [INQUIRY_TYPES.LEGACY]: [],
};

export const YES_NO_OPTIONS = ['Yes', 'No'];

export const REQUIRED_NOT_REQUIRED_OPTIONS = ['Required', 'Not Required'];

export const PANEL_AREA_CLASSIFICATION_OPTIONS = ['Hazardous', 'Safe Area',];

export const INSTALLATION_TYPE_OPTIONS = ['Indoor', 'Outdoor'];

// export const PROTECTION_CLASS_OPTIONS = ['IP42', 'IP54', 'IP55', 'IP65'];

export const ENCLOSURE_MATERIAL_OPTIONS = ['CRCA / MS', 'SS304', 'SS316', 'FLP'];

export const CABLE_ENTRY_OPTIONS = ['Top', 'Bottom', 'Both'];

export const CERTIFICATION_OPTIONS = ['CE', 'UL', 'IS', 'None'];

export const PLC_COMMUNICATION_PROTOCOL_OPTIONS = [
  'Profibus',
  'Profinet',
  'EtherNet/IP',
  'Modbus',
];

export const PLC_NETWORK_TOPOLOGY_OPTIONS = ['Star', 'Ring', 'Line'];

export const SWITCHGEAR_MAKE_OPTIONS = ['Siemens', 'Schneider', 'L&K', 'ABB', 'Other'];

export const BARRIER_VARIANT_OPTIONS = [
  'DIGITAL INPUT BARRIER',
  'DIGITAL OUTPUT BARRIER',
  'ANALOG INPUT BARRIER',
  'ANALOG OUTPUT BARRIER',
];

export const MCC_INCOMER_TYPE_OPTIONS = ['ACB', 'MCCB', 'Fuse Switch', 'Bus Coupler'];

export const MCC_FEEDER_TYPE_OPTIONS = [
  'DOL',
  'Star-Delta',
  'Soft Starter',
  'VFD',
];

export const CONTROL_VOLTAGE_OPTIONS = ['110 V AC', '230 V AC', '24 V DC'];

// Backward-compatible export for older components that may still import this name.
export const MCC_CONTROL_VOLTAGE_OPTIONS = CONTROL_VOLTAGE_OPTIONS;

export const MCC_PANEL_STRUCTURE_OPTIONS = ['Single Front', 'Double Front', 'Back-to-Back'];

export const MCC_CABLE_ENTRY_MV_LV_OPTIONS = ['Top', 'Bottom'];

export const MCC_BUSBAR_ARRANGEMENT_OPTIONS = ['Top', 'Bottom'];


export const PROGRAMMING_DEVELOPMENT_SCOPE_OPTIONS = ['In Our Scope', 'Customer Scope'];

// Backward-compatible export for older components that may still import this name.
export const MCC_PROGRAMMING_SCOPE_OPTIONS = PROGRAMMING_DEVELOPMENT_SCOPE_OPTIONS;

export const PLC_COMPONENT_ROWS = [
  'PLC',
  'HMI / Touch Panel',
  'Motion Controller',
  'Servo Drive & Motor',
  'VFD (if any)',
  'Safety PLC / Safety Relay',
  'Remote I/O Modules',
  'IIoT Gateway',
  'SCADA Software',
  'Engineering Workstation (EWS)',
  'Operator Workstation (OWS)',
  'Industrial PC (IPC)',
  'Industrial Network Switch',
  'UPS / Industrial Power Supply',
];

export const VFD_COMPONENT_ROWS = [
  'MCCB / MCB (Incomer)',
  'Surge Protection Device (SPD)',
  'MFM (Multi Function Meter)',
  'Energy Meter',
  'HMI / Operator Panel',
  'PLC Interface',
  'Timer Base Control',
];

const makeComponentRequirementRows = (components = []) =>
  components.map((component) => ({
    component,
    required: 'No',
    preferredBrand: '',
    suggestedModelRange: '',
    remarks: '',
  }));

export const defaultVfdLoadRow = (srNo = 1) => ({
  srNo,
  loadDescription: '',
  qty: '',
  ratingKwHp: '',
  fullLoadCurrent: '',
  remarks: '',
});

export const defaultMccLoadRow = (srNo = 1) => ({
  srNo,
  loadDescription: '',
  qty: '',
  ratingKwHp: '',
  fullLoadCurrent: '',
  remarks: '',
});

export const defaultPlcDetails = () => ({
  switchgearMake: '',
  customSwitchgearMake: '',
  programmingDevelopmentScope: '',
  automationRequirements: makeComponentRequirementRows(PLC_COMPONENT_ROWS),
  supportRequirements: {
    onsiteSupportRequired: '',
    onsiteSupportDays: '',
    commissioningSupportRequired: '',
    commissioningSupportDays: '',
  },
  ioDetails: {
    digitalInputs: '',
    digitalOutputs: '',
    analogInputs: '',
    analogOutputs: '',
    thermocoupleRtdInputs: '',
    highSpeedCounterInputs: '',
    communicationProtocol: '',
    networkTopology: '',
    plcCpuRedundancyRequired: '',
    powerSupplyRedundancy: '',
    ioSpareCapacityPercent: '',
  },
});

export const defaultVfdDetails = () => ({
  panelType: '',
  switchgearMake: '',
  customSwitchgearMake: '',
  loadDetails: [
    defaultVfdLoadRow(1),
  ],
  additionalComponents: makeComponentRequirementRows(VFD_COMPONENT_ROWS),
  referenceBomAttached: '',
  onsiteSupportRequired: '',
  onsiteSupportDays: '',
  commissioningSupportRequired: '',
  commissioningSupportDays: '',
});

export const defaultMccDetails = () => ({
  incomerDetails: {
    incomerType: '',
    make: '',
    customMake: '',
    busbarMaterial: '',
    formOfSeparation: '',
    panelConstruction: '',
  },
  outgoingFeederDetails: {
    totalNoOfFeeders: '',
    feederTypes: [],
    noOfDolStarters: '',
    totalLoadKw: '',
    noOfStarDeltaStarters: '',
    switchgearMake: '',
    noOfSoftStarters: '',
    softStarterMake: '',
    noOfVfdFeeders: '',
    vfdMake: '',
    controlTransformerRequired: '',
  },
  loadDetails: [
    defaultMccLoadRow(1),
  ],
  layoutPreferences: {
    panelType: '',
    panelStructure: '',
    cableEntryMvLv: '',
    busbarArrangement: '',
    degreeOfProtection: '',
  },
  notesAndSupport: {
    onsiteSupportRequired: '',
    onsiteSupportDays: '',
    commissioningSupportRequired: '',
    commissioningSupportDays: '',
    trainingRequired: '',
    warrantyPeriodMonths: '',
    amcRequiredAfterWarranty: '',
    additionalComments: '',
  },
});

export const getProductTypeFromInquiryType = (inquiryType) =>
  INQUIRY_TYPE_PRODUCT_TYPE_MAP[inquiryType] || INQUIRY_TYPE_PRODUCT_TYPE_MAP[INQUIRY_TYPES.LEGACY];

export const getPanelTypesFromInquiryType = (inquiryType) =>
  INQUIRY_TYPE_PANEL_TYPES_MAP[inquiryType] || INQUIRY_TYPE_PANEL_TYPES_MAP[INQUIRY_TYPES.LEGACY];

const normalizeLegacyValue = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');

export const inferInquiryTypeFromLegacy = (productType, panelTypes = []) => {
  if (Object.values(INQUIRY_TYPES).includes(productType)) {
    return productType;
  }

  const values = [
    productType,
    ...(Array.isArray(panelTypes) ? panelTypes : [panelTypes]),
  ]
    .map(normalizeLegacyValue)
    .filter(Boolean);

  if (values.includes('PLC_MCC') || values.includes('MCC CUM PLC')) {
    return INQUIRY_TYPES.MCC_CUM_PLC;
  }

  if (values.includes('PLC')) {
    return INQUIRY_TYPES.PLC_AUTOMATION;
  }

  if (values.includes('VFD')) {
    return INQUIRY_TYPES.VFD_PANEL;
  }

  if (values.includes('MCC')) {
    return INQUIRY_TYPES.MCC_PANEL;
  }

  return INQUIRY_TYPES.LEGACY;
};