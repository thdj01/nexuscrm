// ─────────────────────────────────────────────────────────────────────────────
// masterData.js  ·  Centralised master data for the Electrical Panel Inquiry Form
// Drop this file into:  frontend/src/data/masterData.js
// ─────────────────────────────────────────────────────────────────────────────

export const PANEL_TYPES = [
  { value: 'PLC', label: 'PLC Panel' },
  { value: 'MCC', label: 'MCC Panel' },
  { value: 'MCC cum PLC', label: 'MCC Cum PLC Panel' },
  { value: 'VFD', label: 'VFD Panel' },
  { value: 'FLP', label: 'FLP Panel' },
  { value: 'RIO Box', label: 'RI/O Box Panel' },
];

export const INDUSTRY_TYPES = [
  'Automotive',
  'OEM',
  'Chemical & Pharma',
  'Construction',
  'Data Centre',
  'Food & Beverage',
  'Infrastructure',
  'Metal & Fabrication',
  'Mining',
  'Oil & Gas',
  'Paper & Pulp',
  'Power Generation',
  'Renewable Energy',
  'Sugar & Distillery',
  'Textile',
  'Water Treatment',
  'Other',
];

export const OFFER_TYPES = [
  { value: 'budgetary',        label: 'Budgetary Offer' },
  { value: 'firm',             label: 'Firm Price Offer' },
  { value: 'techno_commercial', label: 'Techno-Commercial Offer' },
  { value: 'repeat',           label: 'Repeat Order' },
];

export const VOLTAGE_OPTIONS = [
  '415V AC, 3 Phase',
  '440V AC, 3 Phase',
  '230V AC, 1 Phase',
  '110V AC, 1 Phase',
  '24V DC',
];

export const FREQUENCY_OPTIONS = ['50 Hz', '60 Hz'];

export const IP_RATINGS = [
  { value: 'IP21',  label: 'IP21 – Indoor, drip-proof' },
  { value: 'IP42',  label: 'IP42 – Indoor, standard' },
  { value: 'IP54',  label: 'IP54 – Dust & splash protected' },
  { value: 'IP55',  label: 'IP55 – Dust & jet-water protected' },
  { value: 'IP65',  label: 'IP65 – Dust-tight & low-pressure jet' },
  { value: 'IP66',  label: 'IP66 – Dust-tight & powerful jet' },
  { value: 'IP67',  label: 'IP67 – Immersion proof (1m/30min)' },
];

export const INSTALLATION_TYPES = [
  'Indoor',
  'Outdoor',
  'Plate Mounting',
  'Hazardous',
  'Weatherproof',
];

export const SHORT_CIRCUIT_OPTIONS = [
  '10 kA', '16 kA', '25 kA', '36 kA', '50 kA', '65 kA', '85 kA', '100 kA',
];

export const PANEL_MOUNTING_TYPES = [
  'Hazardous',
  'Wall Mount',
  'Floor Standing',
  'Compartmental',
  'Non-Compartmental',
];

// ─── Control Components ───────────────────────────────────────────────────────

export const CONTROL_COMPONENTS = [
  { key: 'plc',         label: 'PLC',                           brands: ['Siemens', 'Allen-Bradley', 'Mitsubishi', 'Yaskawa', 'Schneider', 'Omron', 'ABB', 'Delta'] },
  { key: 'hmi',         label: 'HMI',                           brands: ['Siemens', 'Allen-Bradley', 'Weintek', 'EXOR', 'Schneider', 'Mitsubishi', 'Delta', 'Pro-face'] },
  { key: 'motion',      label: 'Motion Controller',             brands: ['Yaskawa', 'Allen-Bradley', 'Siemens', 'Mitsubishi', 'Bosch Rexroth'] },
  { key: 'vfd',         label: 'VFD / Drive',                   brands: ['Yaskawa', 'ABB', 'Siemens', 'Schneider', 'Danfoss', 'Delta', 'Mitsubishi', 'Allen-Bradley'] },
  { key: 'softStarter', label: 'Soft Starter',                  brands: ['ABB', 'Siemens', 'Schneider', 'Eaton', 'Allen-Bradley'] },
  { key: 'servo',       label: 'Servo Drive & Motor',           brands: ['Yaskawa', 'Siemens', 'Mitsubishi', 'Delta', 'Panasonic', 'Allen-Bradley'] },
  { key: 'scada',       label: 'SCADA Software',                brands: ['Wonderware', 'Ignition', 'WinCC', 'iFIX', 'Citect', 'FactoryTalk'] },
  { key: 'ews',         label: 'EWS (Engineering Workstation)',  brands: [] },
  { key: 'ows',         label: 'OWS (Operator Workstation)',    brands: [] },
  { key: 'ipc',         label: 'IPC (Industrial PC)',           brands: ['Advantech', 'Beckhoff', 'Siemens', 'Kontron'] },
  { key: 'switchgear',  label: 'Switchgear / ACB / MCCB',       brands: ['Schneider', 'ABB', 'Siemens', 'L&T', 'Havells', 'Eaton', 'Legrand'] },
  { key: 'remoteIO',    label: 'Remote I/O Modules',            brands: ['Siemens', 'Allen-Bradley', 'Phoenix Contact', 'Beckhoff', 'Wago'] },
  { key: 'iiot',        label: 'IIoT Gateway',                  brands: ['Cisco', 'Moxa', 'HMS', 'Ewon'] },
  { key: 'safetyPLC',   label: 'Safety PLC / Safety Relay',     brands: ['Pilz', 'Sick', 'ABB', 'Siemens', 'Allen-Bradley'] },
  { key: 'ups',         label: 'UPS / Industrial Power Supply',  brands: ['APC', 'Eaton', 'Socomec', 'Phoenix Contact', 'Delta'] },
  { key: 'netSwitch',   label: 'Industrial Network Switch',     brands: ['Cisco', 'Moxa', 'Hirschmann', 'Phoenix Contact'] },
  { key: 'sensors',     label: 'Field Sensors (Analog/Digital)', brands: ['Sick', 'Balluff', 'Banner', 'LVDT', 'Turck', 'IFM'] },
  { key: 'others',      label: 'Others',                        brands: [] },
];

// ─── Brands per category (for global suggestions) ─────────────────────────────
export const ALL_BRANDS = [
  'ABB', 'Allen-Bradley', 'Advantech', 'APC', 'Balluff', 'Banner', 'Beckhoff',
  'Bosch Rexroth', 'Citect', 'Cisco', 'Danfoss', 'Delta', 'Eaton', 'Ewon',
  'EXOR', 'FactoryTalk', 'Havells', 'Hirschmann', 'HMS', 'iFIX', 'IFM',
  'Ignition', 'Kontron', 'L&T', 'Legrand', 'LVDT', 'Mitsubishi', 'Moxa',
  'Omron', 'Panasonic', 'Phoenix Contact', 'Pilz', 'Pro-face', 'Schneider',
  'Sick', 'Siemens', 'Socomec', 'Turck', 'Wago', 'Weintek', 'WinCC',
  'Wonderware', 'Yaskawa',
].sort();

export const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];

// Updated DEFAULT_LOAD_ROW — uses kW/HP/ampere columns, no unit selector
export const DEFAULT_LOAD_ROW = () => ({
  id: Date.now() + Math.random(),
  description: '',
  qty: '',
  kw: '',
  hp: '',
  ampere: '',
});

export const DELIVERY_TERMS = [
  'Ex-Works',
  'FOR Destination',
  'FOR Site',
  'Door Delivery',
  'CIF',
];

export const PAYMENT_TERMS = [
  '100% Advance',
  '50% Advance, 50% on Delivery',
  '30% Advance, 60% on Dispatch, 10% on Commissioning',
  'Against LC',
  'Net 30 Days',
  'Net 45 Days',
  'Net 60 Days',
];

export const CONTROL_TYPE_OPTIONS = ['Automatic', 'Manual', 'Semi-Automatic'];

// Busbar material options — Copper and Aluminium only
export const BUSBAR_MATERIALS = ['Copper', 'Aluminium'];

// Designation suggestions for contact persons
export const DESIGNATION_OPTIONS = [
  'Director', 'Purchase Manager', 'Project Manager', 'Electrical Engineer',
  'Plant Manager', 'CEO', 'GM', 'DGM', 'AGM', 'Manager', 'Engineer', 'Consultant', 'HOD'
];

// ─────────────────────────────────────────────────────────────────────────────
// Ticket Module — master data (mirrors backend enums exactly)
// ─────────────────────────────────────────────────────────────────────────────

export const TICKET_STATUSES = [
  'New',
  'Assigned',
  'Working',
  'Customer Side Pending',
  'Closed',
  'Void',
];

export const TICKET_TYPES = [
  'Support',
  'Repairing & Replacement',
];

export const TICKET_PRIORITIES = [
  'Low',
  'Medium',
  'High',
  'Critical',
];

// Ticket departments are loaded dynamically from /api/departments.
export const TICKET_DEPARTMENTS = [];

export const TICKET_SOURCES = [
  'Call',
  'Mail',
  'WhatsApp',
  'Internal',
  'Other',
];

export const TICKET_SUPPORT_TYPES = [
  'Free',
  'Paid',
  'Warranty',
  'Comprehensive AMC',
  'Non Comprehensive AMC',
  'Other',
];

export const TICKET_RR_SOLUTION_STATUSES = [
  'N/A',
  'Repair Done',
  'Replacement Done',
  'Vendor Return',
  'Scrap',
  'Awaiting Approval',
  'Awaiting Material',
];