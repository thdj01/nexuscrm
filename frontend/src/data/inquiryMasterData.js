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

export const GENERAL_INQUIRY_PANEL_TYPE_OPTIONS = [
  { value: 'PLC', label: 'PLC Panel' },
  { value: 'MCC', label: 'MCC Panel' },
  { value: 'MCC cum PLC', label: 'MCC Cum PLC Panel' },
  { value: 'VFD', label: 'VFD Panel' },
  { value: 'FLP', label: 'FLP Panel' },
  { value: 'RIO Box', label: 'RI/O Box Panel' },
];

const PANEL_TYPE_ALIASES = {
  PLC: 'PLC',
  'PLC PANEL': 'PLC',
  MCC: 'MCC',
  'MCC PANEL': 'MCC',
  PLC_MCC: 'MCC cum PLC',
  'MCC CUM PLC': 'MCC cum PLC',
  'MCC CUM PLC PANEL': 'MCC cum PLC',
  VFD: 'VFD',
  'VFD PANEL': 'VFD',
  FLP: 'FLP',
  'FLP PANEL': 'FLP',
  'RIO BOX': 'RIO Box',
  'RI/O BOX': 'RIO Box',
  'RIO BOX PANEL': 'RIO Box',
  'RI/O BOX PANEL': 'RIO Box',
};

export const normalizeInquiryPanelType = (value) => {
  const key = String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  return PANEL_TYPE_ALIASES[key] || '';
};

export const normalizeInquiryPanelTypes = (values = []) => {
  const source = Array.isArray(values) ? values : [values];
  return Array.from(new Set(source.map(normalizeInquiryPanelType).filter(Boolean)));
};

export const getInquiryTypeFromPanelTypes = (values = []) => {
  const selected = normalizeInquiryPanelTypes(values);

  if (selected.includes('MCC cum PLC')) return INQUIRY_TYPES.MCC_CUM_PLC;
  if (selected.includes('PLC')) return INQUIRY_TYPES.PLC_AUTOMATION;
  if (selected.includes('MCC')) return INQUIRY_TYPES.MCC_PANEL;
  if (selected.includes('VFD')) return INQUIRY_TYPES.VFD_PANEL;

  return INQUIRY_TYPES.LEGACY;
};

export const getProductTypeFromPanelTypes = (values = []) => {
  const selected = normalizeInquiryPanelTypes(values);

  if (selected.includes('MCC cum PLC')) return 'PLC_MCC';
  if (selected.includes('PLC')) return 'PLC';
  if (selected.includes('MCC')) return 'MCC';
  if (selected.includes('VFD')) return 'VFD';

  // The legacy productType field cannot represent FLP or RI/O Box.
  // Keep MCC as the backward-compatible database value while panelTypes
  // remains the source of truth for the selected panel categories.
  return 'MCC';
};

export const hasInquiryPanelType = (values = [], panelType) => (
  normalizeInquiryPanelTypes(values).includes(normalizeInquiryPanelType(panelType))
);

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

export const MCC_INCOMER_TYPE_OPTIONS = ['MCB', 'MCCB', 'ACB'];

export const MCC_FEEDER_TYPE_OPTIONS = [
  'DOL Starter',
  'Star-Delta Starter',
  'Soft Starter',
  'VFD Feeder',
  'Servo Feeder',
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

const defaultPlcIoRequirementRow = () => ({
  quantity: '',
  relay: false,
  isBarrier: false,
  conformalCoated: false,
  isInput: false,
  hart: false,
});

const defaultVfdSelectionOptions = () => ({
  inputChoke: false,
  outputChoke: false,
  heavyDuty: false,
  normalDuty: false,
  bop: false,
});

export const defaultMainIncomerDetails = () => ({
  mainIncomerType: '',
  supplyVoltage: '',
  customSupplyVoltage: '',
  pole: '',
  frequency: '50 Hz',
  make: '',
  customMake: '',
  kaRating: '',
  controlFeeder: '',
  sameAsAbove: false,
});

export const defaultPlcDetails = () => ({
  // Legacy fields are retained so existing inquiry records remain compatible.
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
  mainIncomerFeeder: defaultMainIncomerDetails(),
  plcSystem: {
    plcController: '',
    make: '',
    customMake: '',
    modelNumber: '',
    communicationProtocol: '',
    networkTopology: '',
    hmiRequired: false,
    hmiSize: '',
    hmiMake: '',
    ethernetSwitchRequired: false,
    ethernetSwitchPort: '',
    ethernetSwitchType: '',
  },
  servoDetails: {
    make: '',
    customMake: '',
    inputVoltage: '',
    motorCapacityKw: '',
    encoderType: '',
    brake: '',
    ratedRpm: '',
    amplifierCommunication: '',
    communicationProtocol: '',
    cableLengthMetres: '',
  },
  ioRequirements: {
    di: defaultPlcIoRequirementRow(),
    do: defaultPlcIoRequirementRow(),
    ai: defaultPlcIoRequirementRow(),
    ao: defaultPlcIoRequirementRow(),
  },
  redundancy: {
    plcRedundancy: '',
    networkRedundancy: false,
    communicationRedundancy: false,
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
  mainIncomer: {
    ...defaultMainIncomerDetails(),
    sameAsAbove: false,
  },
  switchgearMake: '',
  customSwitchgearMake: '',
  loadDetails: [
    defaultVfdLoadRow(1),
  ],
  vfdOptions: defaultVfdSelectionOptions(),
  softStarter: {
    loadDetails: [defaultVfdLoadRow(1)],
    options: defaultVfdSelectionOptions(),
  },
  additionalComponents: makeComponentRequirementRows(VFD_COMPONENT_ROWS),
  referenceBomAttached: '',
  onsiteSupportRequired: '',
  onsiteSupportDays: '',
  commissioningSupportRequired: '',
  commissioningSupportDays: '',
});

export const defaultMccDetails = () => ({
  incomerDetails: {
    ...defaultMainIncomerDetails(),
    // Legacy aliases are retained for existing records and reports.
    incomingVoltage: '',
    customIncomingVoltage: '',
    incomerType: '',
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
    commissioningScope: '',
    trainingRequired: '',
    warrantyPeriodMonths: '',
    amcRequiredAfterWarranty: '',
    additionalComments: '',
  },
});


// ── Weatherproof / FLP enclosure selection sheet options ────────────────────
export const FLP_ENCLOSURE_TYPE_OPTIONS = ['Weatherproof', 'Flameproof (FLP)'];
export const FLP_MATERIAL_OPTIONS = ['CRCA', 'SS304', 'SS316', 'Aluminium'];
export const FLP_IP_RATING_OPTIONS = ['IP54', 'IP55', 'IP65', 'IP66'];
export const FLP_YES_NO_OPTIONS = ['Yes', 'No'];
export const FLP_MOUNTING_OPTIONS = ['Wall', 'Floor', 'Pole'];
export const FLP_ZONE_DIVISION_OPTIONS = [
  'Safe Area',
  'Zone 1',
  'Zone 2',
  'Class I Div 1',
  'Class I Div 2',
];
export const FLP_GAS_GROUP_OPTIONS = ['IIA', 'IIB', 'IIC'];
export const FLP_TEMPERATURE_CLASS_OPTIONS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
export const FLP_CERTIFICATION_OPTIONS = ['ATEX', 'IECEx', 'PESO', 'Customer Standard'];

export const defaultFlpEnclosureDetails = () => ({
  enclosureSelection: {
    enclosureType: '',
    application: '',
    installation: '',
    hazardousArea: '',
    outdoorInstallation: '',
    remarks: '',
  },
  commonTechnical: {
    equipmentMounted: '',
    makeModel: '',
    voltage: '',
    currentRating: '',
    controlVoltage: '',
    cableEntryDirection: '',
    glandType: '',
    ambientTemperature: '',
    humidity: '',
    corrosiveAtmosphere: '',
  },
  weatherproof: {
    material: '',
    ipRating: '',
    mounting: '',
    doorType: '',
    sunshadeCanopy: '',
    makeModel: '',
    thermostat: '',
    windowRequired: '',
    breatherDrain: '',
    paintingRal: '',
    corrosionClass: '',
    specialRequirement: '',
  },
  flameproof: {
    areaClassification: '',
    zoneDivision: '',
    gasGroup: '',
    temperatureClass: '',
    gasName: '',
    certification: '',
    protectionConcept: '',
    material: '',
    ipRating: '',
    internalDevice: '',
    makeModel: '',
    breather: '',
    windowRequired: '',
    numberOfGlands: '',
    cableType: '',
  },
  preliminarySummary: {
    selectedEnclosureType: '',
    material: '',
    ipRating: '',
    areaRequirement: '',
    sizeRequirement: '',
    remarks: '',
  },
});

// ── RIO box inquiry-stage selection sheet options ────────────────────────────
export const RIO_PROTOCOL_OPTIONS = [
  'PROFINET',
  'EtherNet/IP',
  'Modbus TCP',
  'Modbus RTU',
  'Profibus DP',
  'EtherCAT',
  'Other',
];
export const RIO_NETWORK_MEDIUM_OPTIONS = ['Copper RJ45', 'Fiber Optic', 'RS485', 'Wireless'];
export const RIO_TOPOLOGY_OPTIONS = ['Star', 'Ring', 'Line', 'Daisy Chain', 'Other'];
export const RIO_ENCLOSURE_MATERIAL_OPTIONS = [
  'CRCA Painted',
  'SS304',
  'SS316',
  'FRP',
  'FLP/Ex-d',
  'Customer Standard',
];
export const RIO_IP_RATING_OPTIONS = ['IP54', 'IP55', 'IP65', 'IP66', 'IP67'];
export const RIO_AREA_CLASSIFICATION_OPTIONS = [
  'Safe Area',
  'Zone 1',
  'Zone 2',
  'Class I Div 1',
  'Class I Div 2',
  'Outdoor Non-Hazardous',
];
export const RIO_POWER_SUPPLY_OPTIONS = ['230 VAC', '110 VAC', '24 VDC'];
export const RIO_REDUNDANCY_OPTIONS = ['No', 'CPU', 'Network', 'Power', 'Full'];
export const RIO_MOUNTING_OPTIONS = ['Wall Mount', 'Floor Stand', 'Pole Mount'];
export const RIO_CABLE_ENTRY_OPTIONS = ['Bottom', 'Top', 'Side', 'Mixed'];
export const RIO_YES_NO_OPTIONS = ['Yes', 'No'];

export const RIO_IO_SIGNAL_ROWS = [
  { key: 'digitalInputs', label: 'Digital Inputs (DI)', remarks: 'Potential-free / PNP / NPN' },
  { key: 'digitalOutputs', label: 'Digital Outputs (DO)', remarks: 'Relay / Transistor' },
  { key: 'analogInputs', label: 'Analog Inputs (AI)', remarks: '4–20 mA / 0–10 V' },
  { key: 'analogOutputs', label: 'Analog Outputs (AO)', remarks: '4–20 mA / 0–10 V' },
  { key: 'rtdThermocouple', label: 'RTD / Thermocouple', remarks: 'Pt100 / TC type' },
  { key: 'highSpeedPulse', label: 'High-Speed / Pulse', remarks: 'Frequency / Counter' },
];

export const defaultRioBoxDetails = () => ({
  mainIncomer: {
    ...defaultMainIncomerDetails(),
    sameAsAbove: false,
  },
  application: {
    tagName: '',
    plantAreaLocation: '',
    mounting: 'Wall Mount',
    mainPlcDcsMake: '',
    plcDcsModel: '',
    systemVoltage: '24 VDC',
    communicationProtocol: 'PROFINET',
    networkMedium: 'Copper RJ45',
    topology: 'Star',
    distanceFromMainPlc: '',
    redundancyRequired: 'No',
    localHmiRequired: 'No',
  },
  ioRequirements: RIO_IO_SIGNAL_ROWS.map((row) => ({
    ...row,
    requiredQty: 0,
    sparePercent: 20,
    remarks: row.remarks,
  })),
  enclosureConditions: {
    enclosureMaterial: 'CRCA Painted',
    ipRating: 'IP54',
    areaClassification: 'Safe Area',
    indoorOutdoor: 'Indoor',
    ambientTemperature: '0 to 50 °C',
    canopyRequired: 'No',
    cableEntry: 'Bottom',
    approximateCableQuantity: '',
    glandPlateRequired: 'Yes',
    powerSupplyAvailable: '230 VAC',
    upsSupplyAvailable: 'No',
    spaceHeaterRequired: 'No',
  },
  accessories: {
    networkSwitch: 'Yes',
    fiberConverter: 'No',
    powerSupply24Vdc: 'No',
    redundantPsu: 'No',
    marshallingTerminals: 'Yes',
    interposingRelays: 'As Required',
    intrinsicSafetyBarriers: 'No',
    localIsolator: 'No',
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