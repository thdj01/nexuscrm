'use strict';

const fs = require('fs');
const path = require('path');

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 34;
const RIGHT = 34;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT;
const FIRST_PAGE_TOP = 82;
const CONTINUATION_TOP = 24;
const CONTENT_BOTTOM = 806;
const FOOTER_Y = 820;

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'nexus-logo-full.jpg');
const LOGO_WIDTH_PX = 831;
const LOGO_HEIGHT_PX = 210;

const OMIT_KEYS = new Set([
  '_id', '__v', 'customerRef', 'projectReference', 'createdBy', 'updatedBy',
  'attachments', 'attachment', 'bomAttachments', 'status', 'statusDetails',
  'reviewStatus', 'priority', 'estimatedValue',
  'convertedToProject', 'kickoffMeeting', 'storedName', 'storagePath',
  'workflowReference', 'scheduledBy', 'scheduledAt', 'scheduledOn',
  'enclosureMaterial', 'enclosureStandard', 'notes', 'key',
]);

const LABEL_OVERRIDES = {
  inquiryId: 'Inquiry Number',
  customerId: 'Customer Number',
  customerName: 'Customer Name',
  companyName: 'Company Name',
  companyType: 'Company Type',
  gstNumber: 'GST Number',
  inquiryDate: 'Inquiry Date',
  projectId: 'Project Number',
  projectName: 'Project Name',
  inquiryType: 'Inquiry Type',
  productType: 'Product Type',
  panelTypes: 'Panel Types',
  customPanelType: 'Other Panel Type',
  applicationDescription: 'Application Description',
  applicationProcess: 'Application / Process',
  supplyVoltage: 'Supply Voltage',
  customSupplyVoltage: 'Custom Supply Voltage',
  controlVoltage: 'Control Voltage',
  controlFeeder: 'Control Feeder Details',
  panelAreaClassification: 'Panel Area Classification',
  panelAreaClass: 'Panel Area Classification',
  ipRating: 'IP Rating',
  installationType: 'Installation',
  hazardousArea: 'Hazardous Area',
  outdoorInstallation: 'Outdoor Installation',
  shortCircuitCapacity: 'Short Circuit Capacity',
  busbarMaterial: 'Busbar Material',
  enclosureType: 'Enclosure Type',
  enclosureMake: 'Enclosure Make',
  panelStructure: 'Panel Structure / Cubicle Construction',
  switchgearMake: 'Switchgear Make',
  customSwitchgearMake: 'Other Switchgear Make',
  panelColourRal: 'Enclosure Material Color / RAL',
  cableEntry: 'Cable Entry',
  cableGlandMaterial: 'Cable Gland Material',
  drawingsSldAttached: 'Drawings / SLD Attached',
  referenceBomAttached: 'Reference BOM Attached',
  commissioningScope: 'Commissioning Scope',
  deliveryDate: 'Required Delivery Date',
  orderEndDate: 'Order End Date',
  deliveryTerms: 'Delivery Terms',
  paymentTerms: 'Payment Terms',
  additionalNotes: 'Additional Notes',
  internalRemarks: 'Internal Remarks',
  plcDetails: 'PLC Panel Details',
  vfdDetails: 'VFD Panel Details',
  mccDetails: 'MCC Panel Details',
  flpEnclosureDetails: 'FLP Enclosure Details',
  commonTechnical: 'Internal Component Technical Details',
  weatherproof: 'Weatherproof Enclosure Details',
  flameproof: 'Flameproof Enclosure Details',
  rioBoxDetails: 'RIO Box Details',
  mainIncomer: 'Main Incomer',
  mainIncomerFeeder: 'Main Incomer',
  incomerDetails: 'Main Incomer',
  outgoingFeederDetails: 'Outgoing Feeder Details',
  automationRequirements: 'Automation Requirements',
  additionalComponents: 'Additional Components',
  ioRequirements: 'I/O Requirements',
  loadDetails: 'Load Details',
  vfdOptions: 'VFD Options',
  options: 'Options',
  softStarter: 'Soft Starter',
  supportRequirements: 'Support Requirements',
  notesAndSupport: 'Notes & Support',
  otherMaterialRequirement: 'Other Material Requirement',
  otherMaterialRequirements: 'Other Material Requirement',
  sameAsAbove: 'Same as Above',
  kaRating: 'kA Rating',
  pole: 'Poles',
  make: 'Preferred Make',
  customMake: 'Other Make',
  bop: 'BOP',
  di: 'Digital Input (DI)',
  do: 'Digital Output (DO)',
  ai: 'Analog Input (AI)',
  ao: 'Analog Output (AO)',
  requiredQty: 'Required Quantity',
  sparePercent: 'Spare %',
  selectedCapacity: 'Selected Capacity',
  fullLoadCurrent: 'Full Load Current',
  ratingKwHp: 'Rating (kW / HP)',
  srNo: 'Sr. No.',
  loadDescription: 'Load Description',
  preferredBrand: 'Preferred Brand',
  suggestedModelRange: 'Suggested Model / Range',
};

const TOP_GENERAL_FIELDS = [
  'inquiryId', 'inquiryDate', 'projectName', 'industryType', 'offerType',
  'previousOrderRef', 'inquiryType', 'panelTypes', 'customPanelType',
  'productType', 'applicationDescription', 'applicationProcess',
];

const TOP_TECHNICAL_FIELDS = [
  'supplyVoltage', 'customVoltage', 'controlVoltage', 'controlFeeder',
  'frequency', 'panelAreaClassification', 'panelAreaClass', 'ipRating',
  'installationType', 'hazardousArea', 'outdoorInstallation',
  'shortCircuitCapacity', 'busbarMaterial',
  'enclosureType', 'enclosureMake', 'panelStructure', 'switchgearMake',
  'customSwitchgearMake', 'panelColourRal', 'cableEntry',
  'cableGlandMaterial', 'controlType', 'controlMatrix', 'panelMounting',
  'certificationRequired', 'certificationDetails', 'drawingsAttached',
  'drawingsSldAttached', 'equipmentListAttached', 'referenceBomAttached',
  'commissioningScope', 'deliveryDate', 'programmingScope', 'onsiteSupport',
  'deliveryTerms', 'paymentTerms', 'additionalNotes', 'internalRemarks',
  'preparedBy', 'remarks',
];

const NESTED_SECTIONS = [
  'plcDetails', 'vfdDetails', 'mccDetails', 'flpEnclosureDetails', 'rioBoxDetails',
];

function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (isPlainObject(value)) return Object.keys(value).length === 0;
  return false;
}

function hasMeaningfulValue(value) {
  if (isEmpty(value)) return false;
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (isPlainObject(value)) {
    return Object.entries(value).some(([key, item]) => !OMIT_KEYS.has(key) && hasMeaningfulValue(item));
  }
  return true;
}

function asciiText(value) {
  const source = String(value ?? '')
    .replace(/[–—−]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/•/g, '*')
    .replace(/…/g, '...')
    .replace(/×/g, 'x')
    .replace(/µ/g, 'u')
    .replace(/Ω/g, 'Ohm')
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    .replace(/₹/g, 'Rs.');
  return source.normalize('NFKD').replace(/[^\x20-\x7E°]/g, '');
}

function isDateFieldKey(key = '') {
  const value = String(key || '');
  return /Date$/i.test(value) || /^(createdAt|updatedAt|uploadedAt|scheduledAt|completedAt|submittedAt|approvedAt)$/i.test(value);
}

function safeText(value, key = '') {
  if (value === null || value === undefined || value === '') return '-';
  if (value instanceof Date || isDateFieldKey(key)) return formatDate(value, /At$/i.test(String(key || '')));
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    const items = value.map((item) => safeText(item)).filter((item) => item !== '-');
    return items.length ? items.join(', ') : '-';
  }
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '-';
  if (typeof value === 'object') {
    if (value.name) return safeText(value.name);
    if (value.email) return safeText(value.email);
    if (value.projectId) return safeText(value.projectId);
    if (value.customerId) return safeText(value.customerId);
    return '-';
  }
  const text = asciiText(value).trim();
  if (!text || text === 'null' || text === 'undefined' || text === '[object Object]') return '-';
  return text;
}

function formatDate(value, withTime = false) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return safeText(value);
  const options = {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: true } : {}),
  };
  return asciiText(new Intl.DateTimeFormat('en-IN', options).format(date));
}

function humanizeKey(key) {
  if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key];
  return asciiText(String(key || ''))
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function escapePdfText(text) {
  return asciiText(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function approximateTextWidth(text, fontSize, bold = false) {
  const clean = asciiText(text);
  let units = 0;
  for (const char of clean) {
    if ('ilI1.,:;|!'.includes(char)) units += 0.25;
    else if ('mwMW@%&'.includes(char)) units += 0.85;
    else if (char === ' ') units += 0.28;
    else units += 0.52;
  }
  return units * fontSize * (bold ? 1.04 : 1);
}

function wrapText(value, width, fontSize, bold = false, maxLines = 0) {
  const text = safeText(value);
  const paragraphs = text.split(/\r?\n/);
  const lines = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push(' ');
      continue;
    }
    let line = '';
    for (let word of words) {
      if (approximateTextWidth(word, fontSize, bold) > width) {
        const pieces = [];
        let piece = '';
        for (const char of word) {
          if (piece && approximateTextWidth(piece + char, fontSize, bold) > width) {
            pieces.push(piece);
            piece = char;
          } else piece += char;
        }
        if (piece) pieces.push(piece);
        for (const longPiece of pieces) {
          if (line) {
            lines.push(line);
            line = '';
          }
          lines.push(longPiece);
        }
        continue;
      }
      const candidate = line ? `${line} ${word}` : word;
      if (line && approximateTextWidth(candidate, fontSize, bold) > width) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    if (line) lines.push(line);
  }
  if (maxLines && lines.length > maxLines) {
    const trimmed = lines.slice(0, maxLines);
    const last = trimmed.length - 1;
    while (trimmed[last] && approximateTextWidth(`${trimmed[last]}...`, fontSize, bold) > width) {
      trimmed[last] = trimmed[last].slice(0, -1);
    }
    trimmed[last] = `${trimmed[last]}...`;
    return trimmed;
  }
  return lines.length ? lines : ['-'];
}

function pdfColor(hex) {
  const clean = String(hex || '#000000').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((x) => x + x).join('') : clean.padEnd(6, '0');
  return [0, 2, 4].map((index) => (parseInt(full.slice(index, index + 2), 16) / 255).toFixed(3)).join(' ');
}

function resolveProjectNumber(inquiry = {}) {
  return inquiry.projectReference?.projectId || inquiry.projectId || inquiry.projectNumber || '-';
}

function parseRating(value) {
  const source = safeText(value);
  if (source === '-') return { kw: '', hp: '' };
  const kw = source.match(/([0-9]+(?:\.[0-9]+)?)\s*k\s*w/i)?.[1] || '';
  const hp = source.match(/([0-9]+(?:\.[0-9]+)?)\s*h\s*p/i)?.[1] || '';
  if (kw || hp) return { kw, hp };
  if (source.includes('/')) {
    const [a = '', b = ''] = source.split('/');
    return {
      kw: a.replace(/[^0-9.]/g, ''),
      hp: b.replace(/[^0-9.]/g, ''),
    };
  }
  return { kw: source.replace(/[^0-9.]/g, ''), hp: '' };
}

function numberFrom(value) {
  if (isEmpty(value)) return null;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function roundNumber(value) {
  return String(Math.round((value + Number.EPSILON) * 100) / 100);
}

function normalizeLoadRows(rows = []) {
  return rows.map((row = {}, index) => {
    const rating = parseRating(row.ratingKwHp);
    const kw = !isEmpty(row.kw) ? row.kw : rating.kw;
    const hp = !isEmpty(row.hp) ? row.hp : rating.hp;
    let ampere = !isEmpty(row.ampere) ? row.ampere : row.fullLoadCurrent;
    if (isEmpty(ampere)) {
      const kwNumber = numberFrom(kw);
      if (kwNumber !== null) ampere = roundNumber((kwNumber * 1000) / (1.732 * 415 * 0.8));
    }
    const qty = numberFrom(row.qty);
    const ampereNumber = numberFrom(ampere);
    const totalAmpere = qty !== null && ampereNumber !== null ? roundNumber(qty * ampereNumber) : '';
    const remarks = [
      row.startingMethod ? `Starting: ${safeText(row.startingMethod)}` : '',
      row.remarks ? safeText(row.remarks) : '',
    ].filter(Boolean).join(' | ');
    return {
      no: numberFrom(row.srNo) > 0 ? row.srNo : index + 1,
      loadDescription: row.loadDescription || row.description,
      qty: row.qty,
      kw,
      hp,
      ampere,
      totalAmpere,
      remarks,
    };
  });
}

function normalizeComponentRows(rows = []) {
  return rows.map((row = {}) => ({
    component: row.component,
    required: row.required,
    preferredBrand: row.preferredBrand,
    suggestedModelRange: row.suggestedModelRange,
    remarks: row.remarks,
  }));
}

function isBooleanOptionsObject(value) {
  if (!isPlainObject(value)) return false;
  const entries = Object.entries(value).filter(([key]) => !OMIT_KEYS.has(key));
  return entries.length >= 2 && entries.every(([, item]) => typeof item === 'boolean');
}

class InquiryPdfCanvas {
  constructor(inquiry, options = {}) {
    this.inquiry = inquiry || {};
    this.companyName = options.companyName || process.env.COMPANY_NAME || 'Nexus Dashboard';
    this.pages = [];
    this.page = null;
    this.y = FIRST_PAGE_TOP;
    this.addPage();
  }

  addPage() {
    const first = this.pages.length === 0;
    this.page = { commands: [] };
    this.pages.push(this.page);
    this.y = first ? FIRST_PAGE_TOP : CONTINUATION_TOP;
    if (first) this.drawHeader();
  }

  command(value) {
    this.page.commands.push(value);
  }

  text(value, x, top, options = {}) {
    const size = options.size || 7;
    const bold = Boolean(options.bold);
    const color = options.color || '#111827';
    const baseline = PAGE_HEIGHT - top - size;
    this.command(`BT /${bold ? 'F2' : 'F1'} ${size.toFixed(2)} Tf ${pdfColor(color)} rg 1 0 0 1 ${x.toFixed(2)} ${baseline.toFixed(2)} Tm (${escapePdfText(value)}) Tj ET`);
  }

  rect(x, top, width, height, options = {}) {
    const y = PAGE_HEIGHT - top - height;
    const parts = ['q'];
    if (options.fill) parts.push(`${pdfColor(options.fill)} rg`);
    if (options.stroke) parts.push(`${pdfColor(options.stroke)} RG ${(options.lineWidth || 0.5).toFixed(2)} w`);
    parts.push(`${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re`);
    parts.push(options.fill && options.stroke ? 'B' : options.fill ? 'f' : 'S', 'Q');
    this.command(parts.join(' '));
  }

  line(x1, top1, x2, top2, options = {}) {
    const y1 = PAGE_HEIGHT - top1;
    const y2 = PAGE_HEIGHT - top2;
    this.command(`q ${pdfColor(options.color || '#d1d5db')} RG ${(options.lineWidth || 0.5).toFixed(2)} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q`);
  }

  image(x, top, width, height) {
    const y = PAGE_HEIGHT - top - height;
    this.command(`q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im1 Do Q`);
  }

  drawHeader() {
    this.rect(0, 0, PAGE_WIDTH, 75, { fill: '#ffffff' });
    this.image(LEFT, 12, 107, 27);
    this.text(this.companyName, LEFT, 42, { size: 6.8, bold: true, color: '#374151' });
    const title = 'INQUIRY DETAILS';
    const titleSize = 12;
    this.text(title, (PAGE_WIDTH - approximateTextWidth(title, titleSize, true)) / 2, 11, { size: titleSize, bold: true, color: '#1d4ed8' });
    const ref = `Inquiry: ${safeText(this.inquiry.inquiryId)} | Project: ${safeText(resolveProjectNumber(this.inquiry))} | Date: ${formatDate(this.inquiry.inquiryDate)}`;
    this.text(ref, Math.max(LEFT + 118, (PAGE_WIDTH - approximateTextWidth(ref, 7.1, true)) / 2), 35, { size: 7.1, bold: true, color: '#374151' });
    this.line(LEFT, 66, PAGE_WIDTH - RIGHT, 66, { color: '#2563eb', lineWidth: 0.9 });
  }

  ensureSpace(height) {
    if (this.y + height > CONTENT_BOTTOM) this.addPage();
  }

  section(title) {
    const height = 18;
    this.ensureSpace(height);
    this.rect(LEFT, this.y, CONTENT_WIDTH, height, { fill: '#eff6ff', stroke: '#bfdbfe', lineWidth: 0.45 });
    this.text(title, LEFT + 7, this.y + 4, { size: 8.2, bold: true, color: '#1e40af' });
    this.y += height;
  }

  subsection(title) {
    const height = 15;
    this.ensureSpace(height);
    this.rect(LEFT, this.y, CONTENT_WIDTH, height, { fill: '#f3f4f6', stroke: '#e5e7eb', lineWidth: 0.4 });
    this.text(title, LEFT + 6, this.y + 3.5, { size: 7, bold: true, color: '#374151' });
    this.y += height;
  }

  gap(height = 4) {
    this.y += height;
  }

  keyValueTable(rows = []) {
    const cleanRows = rows.filter((row) => row && hasMeaningfulValue(row.value));
    if (!cleanRows.length) return;
    const paired = [];
    for (let index = 0; index < cleanRows.length; index += 2) paired.push([cleanRows[index], cleanRows[index + 1] || null]);
    const labelWidth = 88;
    const valueWidth = (CONTENT_WIDTH - labelWidth * 2) / 2;
    const widths = [labelWidth, valueWidth, labelWidth, valueWidth];
    const starts = [LEFT, LEFT + widths[0], LEFT + widths[0] + widths[1], LEFT + widths[0] + widths[1] + widths[2]];
    const fontSize = 6.5;
    const labelSize = 6.2;
    const lineHeight = 8;
    for (const pair of paired) {
      const hasSecondPair = Boolean(pair[1]);
      const cells = [pair[0]?.label || '', pair[0]?.value || '-', pair[1]?.label || '', pair[1]?.value || ''];
      const lineSets = cells.map((cell, idx) => {
        if (!hasSecondPair && idx >= 2) return [];
        return wrapText(cell, widths[idx] - 8, idx % 2 === 0 ? labelSize : fontSize, idx % 2 === 0);
      });
      const height = Math.max(17, Math.max(...lineSets.map((lines) => lines.length)) * lineHeight + 6);
      this.ensureSpace(height);
      for (let col = 0; col < 4; col += 1) {
        this.rect(starts[col], this.y, widths[col], height, {
          fill: col % 2 === 0 ? '#f9fafb' : '#ffffff',
          stroke: '#e5e7eb', lineWidth: 0.35,
        });
        lineSets[col].forEach((lineText, lineIndex) => {
          this.text(lineText, starts[col] + 4, this.y + 3 + lineIndex * lineHeight, {
            size: col % 2 === 0 ? labelSize : fontSize,
            bold: col % 2 === 0,
            color: col % 2 === 0 ? '#4b5563' : '#111827',
          });
        });
      }
      this.y += height;
    }
  }

  optionSummary(object) {
    const entries = Object.entries(object || {}).filter(([key]) => !OMIT_KEYS.has(key));
    const selected = entries.filter(([, value]) => value === true).map(([key]) => humanizeKey(key));
    const notSelected = entries.filter(([, value]) => value === false).map(([key]) => humanizeKey(key));
    const rows = [{ selection: 'Selected', values: selected.length ? selected.join(', ') : 'None' }];
    if (notSelected.length) rows.push({ selection: 'Not Selected', values: notSelected.join(', ') });
    this.table([
      { key: 'selection', label: 'Option Status', width: 92 },
      { key: 'values', label: 'Options', width: CONTENT_WIDTH - 92 },
    ], rows, {
      fontSize: 6.1,
      headerFontSize: 5.9,
      lineHeight: 7.4,
      padding: 2.7,
      headerHeight: 18,
      minRowHeight: 16,
      maxLines: 2,
    });
  }

  table(columns, rows = [], options = {}) {
    if (!rows.length) return;
    const fontSize = options.fontSize || 5.9;
    const headerFontSize = options.headerFontSize || 5.7;
    const lineHeight = options.lineHeight || 7.2;
    const padding = options.padding || 3;
    const headerHeight = options.headerHeight || 19;
    const minRowHeight = options.minRowHeight || 17;
    const totalRequested = columns.reduce((sum, col) => sum + (col.width || 1), 0);
    const normalizedColumns = columns.map((col) => ({ ...col, width: CONTENT_WIDTH * (col.width || 1) / totalRequested }));

    const drawHeader = () => {
      this.ensureSpace(headerHeight + minRowHeight);
      let x = LEFT;
      normalizedColumns.forEach((column) => {
        this.rect(x, this.y, column.width, headerHeight, { fill: '#eaf2ff', stroke: '#bfdbfe', lineWidth: 0.4 });
        const lines = wrapText(column.label, column.width - padding * 2, headerFontSize, true, 2);
        lines.forEach((lineText, index) => this.text(lineText, x + padding, this.y + 3 + index * (lineHeight - 0.4), { size: headerFontSize, bold: true, color: '#1e3a8a' }));
        x += column.width;
      });
      this.y += headerHeight;
    };

    drawHeader();
    for (const row of rows) {
      const lineSets = normalizedColumns.map((column) => wrapText(safeText(row?.[column.key], column.key), column.width - padding * 2, fontSize, false, options.maxLines || 0));
      const height = Math.max(minRowHeight, Math.max(...lineSets.map((lines) => lines.length)) * lineHeight + padding * 2);
      if (this.y + height > CONTENT_BOTTOM) {
        this.addPage();
        drawHeader();
      }
      let x = LEFT;
      normalizedColumns.forEach((column, columnIndex) => {
        this.rect(x, this.y, column.width, height, { fill: '#ffffff', stroke: '#e5e7eb', lineWidth: 0.35 });
        lineSets[columnIndex].forEach((lineText, index) => this.text(lineText, x + padding, this.y + padding + index * lineHeight, { size: fontSize, color: '#111827' }));
        x += column.width;
      });
      this.y += height;
    }
  }

  loadDetailsTable(rows) {
    this.table([
      { key: 'no', label: 'No.', width: 28 },
      { key: 'loadDescription', label: 'Load Description', width: 140 },
      { key: 'qty', label: 'Qty', width: 38 },
      { key: 'kw', label: 'kW', width: 40 },
      { key: 'hp', label: 'HP', width: 40 },
      { key: 'ampere', label: 'Ampere', width: 56 },
      { key: 'totalAmpere', label: 'Total A', width: 56 },
      { key: 'remarks', label: 'Remarks / Starting Method', width: 135 },
    ], normalizeLoadRows(rows), { fontSize: 5.7, headerFontSize: 5.5, lineHeight: 7, padding: 2.7 });
  }

  componentRequirementsTable(rows) {
    this.table([
      { key: 'component', label: 'Component', width: 145 },
      { key: 'required', label: 'Required', width: 57 },
      { key: 'preferredBrand', label: 'Preferred Brand', width: 92 },
      { key: 'suggestedModelRange', label: 'Suggested Model / Range', width: 122 },
      { key: 'remarks', label: 'Remarks', width: 111 },
    ], normalizeComponentRows(rows), { fontSize: 5.9, headerFontSize: 5.7, lineHeight: 7.2, padding: 3 });
  }

  plcIoTable(io = {}) {
    const rows = Object.entries(io)
      .filter(([, value]) => isPlainObject(value) && hasMeaningfulValue(value))
      .map(([key, value]) => ({ signal: humanizeKey(key), ...value }));
    if (!rows.length) return;
    this.table([
      { key: 'signal', label: 'Signal Type', width: 112 },
      { key: 'quantity', label: 'Quantity', width: 72 },
      { key: 'relay', label: 'Relay', width: 68 },
      { key: 'isBarrier', label: 'Barrier', width: 68 },
      { key: 'conformalCoated', label: 'Conformal Coated', width: 88 },
      { key: 'isInput', label: 'Input', width: 55 },
      { key: 'hart', label: 'HART', width: 64 },
    ], rows, { fontSize: 5.8, headerFontSize: 5.6, lineHeight: 7, padding: 2.8 });
  }

  rioIoTable(rows) {
    const normalized = (Array.isArray(rows) ? rows : []).map((row = {}) => {
      const requiredQty = Math.max(0, numberFrom(row.requiredQty) || 0);
      const rawSpare = Math.max(0, numberFrom(row.sparePercent) || 0);
      const sparePercent = rawSpare > 0 && rawSpare < 1 ? rawSpare * 100 : rawSpare;
      return {
        label: row.label || humanizeKey(row.key),
        requiredQty,
        sparePercent,
        selectedCapacity: Math.ceil(requiredQty * (1 + sparePercent / 100)),
        remarks: row.remarks,
      };
    });
    this.table([
      { key: 'label', label: 'Signal Type', width: 160 },
      { key: 'requiredQty', label: 'Required Qty', width: 88 },
      { key: 'sparePercent', label: 'Spare %', width: 74 },
      { key: 'selectedCapacity', label: 'Selected Capacity', width: 100 },
      { key: 'remarks', label: 'Remarks', width: 105 },
    ], normalized, { fontSize: 5.8, headerFontSize: 5.6, lineHeight: 7, padding: 2.8 });
  }

  genericObjectArrayTable(rows) {
    const keys = [];
    rows.forEach((row) => Object.keys(row || {}).forEach((key) => {
      if (!OMIT_KEYS.has(key) && !keys.includes(key) && rows.some((item) => hasMeaningfulValue(item?.[key]))) keys.push(key);
    }));
    if (!keys.length) return;
    const weight = Math.max(1, 100 / keys.length);
    const columns = keys.map((key) => ({ key, label: humanizeKey(key), width: ['remarks', 'description', 'loadDescription'].includes(key) ? weight * 1.7 : weight }));
    const normalized = rows.map((row) => Object.fromEntries(keys.map((key) => [key, safeText(row?.[key], key)])));
    this.table(columns, normalized, { fontSize: keys.length > 7 ? 5.1 : 5.7, headerFontSize: keys.length > 7 ? 5 : 5.5, lineHeight: 6.8, padding: 2.5 });
  }

  renderArray(key, value) {
    if (!Array.isArray(value) || !value.length) return;
    if (value.every((item) => item === null || ['string', 'number', 'boolean'].includes(typeof item))) {
      this.keyValueTable([{ label: humanizeKey(key), value: value.map((item) => safeText(item)).join(', ') }]);
      return;
    }
    if (key === 'feederLoadDetails') {
      this.subsection('Outgoing Feeder Load Lists');
      value.forEach((group = {}) => {
        if (!group.feederType || !Array.isArray(group.loadDetails)) return;
        this.subsection(`${safeText(group.feederType)} Load List`);
        this.loadDetailsTable(group.loadDetails);
      });
      return;
    }
    this.subsection(humanizeKey(key));
    if (key === 'loadDetails') this.loadDetailsTable(value);
    else if (key === 'automationRequirements' || key === 'additionalComponents') this.componentRequirementsTable(value);
    else if (key === 'ioRequirements') this.rioIoTable(value);
    else this.genericObjectArrayTable(value.filter(isPlainObject));
  }

  renderObject(object, options = {}) {
    if (!isPlainObject(object)) return;
    const scalarRows = [];
    const nested = [];
    const hasFeederLoadDetails = Array.isArray(object.feederLoadDetails) && object.feederLoadDetails.length > 0;
    for (const [key, value] of Object.entries(object)) {
      if (OMIT_KEYS.has(key) || !hasMeaningfulValue(value)) continue;
      if (hasFeederLoadDetails && ['loadDetails', 'vfdOptions', 'softStarter'].includes(key)) continue;
      if (Array.isArray(value)) nested.push({ key, value, kind: 'array' });
      else if (isPlainObject(value)) nested.push({ key, value, kind: 'object' });
      else scalarRows.push({ label: humanizeKey(key), value: safeText(value, key) });
    }
    this.keyValueTable(scalarRows);
    for (const item of nested) {
      if (item.kind === 'array') {
        this.renderArray(item.key, item.value);
        continue;
      }
      this.subsection(humanizeKey(item.key));
      if (item.key === 'ioRequirements' && Object.values(item.value).some(isPlainObject)) this.plcIoTable(item.value);
      else if (isBooleanOptionsObject(item.value)) this.optionSummary(item.value);
      else this.renderObject(item.value, { depth: (options.depth || 0) + 1 });
    }
  }

  addFooter(page, pageIndex, pageCount) {
    const commands = this.page.commands;
    this.page = page;
    this.line(LEFT, FOOTER_Y - 5, PAGE_WIDTH - RIGHT, FOOTER_Y - 5, { color: '#e5e7eb', lineWidth: 0.4 });
    this.text(`Generated ${formatDate(new Date(), true)}`, LEFT, FOOTER_Y, { size: 6, color: '#6b7280' });
    this.text(`Page ${pageIndex + 1} of ${pageCount}`, PAGE_WIDTH - RIGHT - 56, FOOTER_Y, { size: 6, color: '#6b7280' });
    page.commands = this.page.commands;
    this.page = { commands };
  }

  toBuffer() {
    const originalPage = this.page;
    this.pages.forEach((page, index) => {
      this.page = page;
      this.line(LEFT, FOOTER_Y - 5, PAGE_WIDTH - RIGHT, FOOTER_Y - 5, { color: '#e5e7eb', lineWidth: 0.4 });
      this.text(`Generated ${formatDate(new Date(), true)}`, LEFT, FOOTER_Y, { size: 6, color: '#6b7280' });
      this.text(`Page ${index + 1} of ${this.pages.length}`, PAGE_WIDTH - RIGHT - 56, FOOTER_Y, { size: 6, color: '#6b7280' });
    });
    this.page = originalPage;
    return buildPdfBuffer(this.pages);
  }
}

function buildPdfBuffer(pages) {
  const logo = fs.existsSync(LOGO_PATH) ? fs.readFileSync(LOGO_PATH) : null;
  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject('');
  const pagesId = addObject('');
  const fontNormalId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  let imageId = null;
  if (logo) {
    imageId = addObject(Buffer.concat([
      Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${LOGO_WIDTH_PX} /Height ${LOGO_HEIGHT_PX} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.length} >>\nstream\n`, 'latin1'),
      logo,
      Buffer.from('\nendstream', 'latin1'),
    ]));
  }

  const pageIds = [];
  pages.forEach((page) => {
    const stream = Buffer.from(page.commands.join('\n'), 'latin1');
    const contentId = addObject(Buffer.concat([
      Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, 'latin1'),
      stream,
      Buffer.from('\nendstream', 'latin1'),
    ]));
    const resources = `<< /Font << /F1 ${fontNormalId} 0 R /F2 ${fontBoldId} 0 R >>${imageId ? ` /XObject << /Im1 ${imageId} 0 R >>` : ''} >>`;
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(2)}] /Resources ${resources} /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
  const offsets = [0];
  let length = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(length);
    const header = Buffer.from(`${index + 1} 0 obj\n`, 'latin1');
    const body = Buffer.isBuffer(object) ? object : Buffer.from(object, 'latin1');
    const footer = Buffer.from('\nendobj\n', 'latin1');
    chunks.push(header, body, footer);
    length += header.length + body.length + footer.length;
  });
  const xrefOffset = length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) xref += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref + trailer, 'latin1'));
  return Buffer.concat(chunks);
}

function pickFields(source, keys, extras = {}) {
  const result = {};
  for (const key of keys) {
    if (key === 'panelAreaClass' && hasMeaningfulValue(source.panelAreaClassification)) continue;
    if (hasMeaningfulValue(source[key])) result[key] = source[key];
  }
  return { ...result, ...extras };
}

function normalizeFlpTextArray(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  return Array.from(new Set(values.map((item) => String(item || '').trim()).filter(Boolean)));
}

function normalizeFlpDetailsForPdf(details = {}) {
  const commonTechnical = pickFields(details.commonTechnical || {}, [
    'equipmentMounted', 'makeModel', 'voltage', 'currentRating',
    'controlVoltage', 'glandType',
  ]);
  const weatherproof = pickFields(details.weatherproof || {}, [
    'material', 'ipRating', 'mounting', 'makeModel',
    'windowRequired', 'specialRequirement',
  ]);
  const sourceFlameproof = details.flameproof || {};
  const areaClassification = /^safe\s*area$/i.test(String(sourceFlameproof.areaClassification || '').trim())
    ? 'Hazardous Area'
    : (String(sourceFlameproof.areaClassification || '').trim() || 'Hazardous Area');
  const flameproof = {
    ...pickFields(sourceFlameproof, [
      'temperatureClass', 'protectionConcept', 'material', 'ipRating',
    ]),
    areaClassification,
    zoneDivision: normalizeFlpTextArray(sourceFlameproof.zoneDivision),
    gasGroup: normalizeFlpTextArray(sourceFlameproof.gasGroup),
    certification: normalizeFlpTextArray(sourceFlameproof.certification)
      .filter((item) => item !== 'IECEx'),
  };

  return {
    commonTechnical,
    weatherproof,
    flameproof,
  };
}

function inquiryIncludesFlp(inquiry = {}) {
  const values = Array.isArray(inquiry.panelTypes) ? inquiry.panelTypes : [inquiry.panelTypes];
  return values.some((value) => String(value || '').trim().toUpperCase() === 'FLP');
}

function buildInquiryPdf(inquiry = {}, options = {}) {
  const canvas = new InquiryPdfCanvas(inquiry, options);
  const customer = isPlainObject(inquiry.customerRef) ? inquiry.customerRef : {};

  canvas.section('Customer / Company Details');
  canvas.keyValueTable([
    { label: 'Customer Number', value: customer.customerId },
    { label: 'Created By', value: inquiry.createdBy?.name || inquiry.createdBy?.email || inquiry.createdByName },
    { label: 'Customer Name', value: inquiry.customerName || customer.customerName },
    { label: 'Company Name', value: inquiry.companyName || customer.companyName },
    { label: 'Company Type', value: inquiry.companyType || customer.companyType },
    { label: 'GST Number', value: customer.gstNumber },
    { label: 'Site Address', value: inquiry.siteAddress || customer.address },
    { label: 'City', value: inquiry.city || customer.city },
  ]);

  const contacts = Array.isArray(inquiry.contacts) && inquiry.contacts.length
    ? inquiry.contacts
    : ((inquiry.contactPerson || inquiry.mobileNumber || inquiry.email) ? [{
      name: inquiry.contactPerson,
      phone: inquiry.mobileNumber,
      email: inquiry.email,
      designation: inquiry.designation,
    }] : []);
  if (contacts.length) {
    canvas.section('Contact Information');
    canvas.table([
      { key: 'no', label: 'No.', width: 30 },
      { key: 'name', label: 'Name', width: 130 },
      { key: 'phone', label: 'Phone', width: 92 },
      { key: 'email', label: 'Email', width: 170 },
      { key: 'designation', label: 'Designation', width: 105 },
    ], contacts.map((contact, index) => ({ no: index + 1, ...contact })), { fontSize: 6.1, headerFontSize: 5.9, lineHeight: 7.5 });
  }

  canvas.section('Inquiry, Project & General Details');
  const general = pickFields(inquiry, TOP_GENERAL_FIELDS, { projectId: resolveProjectNumber(inquiry) });
  canvas.renderObject(general);

  const technical = pickFields(inquiry, TOP_TECHNICAL_FIELDS);
  if (inquiryIncludesFlp(inquiry)) {
    delete technical.certificationRequired;
    delete technical.certificationDetails;
  }
  if (hasMeaningfulValue(technical)) {
    canvas.section('Technical, Commercial & Notes');
    canvas.renderObject(technical);
  }

  if (Array.isArray(inquiry.loadDetails) && inquiry.loadDetails.length) {
    canvas.section('Load Details');
    canvas.loadDetailsTable(inquiry.loadDetails);
  }

  for (const key of NESTED_SECTIONS) {
    const value = key === 'flpEnclosureDetails'
      ? normalizeFlpDetailsForPdf(inquiry[key] || {})
      : inquiry[key];
    if (!hasMeaningfulValue(value)) continue;
    canvas.section(humanizeKey(key));
    canvas.renderObject(value);
  }

  canvas.section('Record Information');
  canvas.keyValueTable([
    { label: 'Created At', value: formatDate(inquiry.createdAt, true) },
    { label: 'Updated At', value: formatDate(inquiry.updatedAt, true) },
    { label: 'Project Number', value: resolveProjectNumber(inquiry) },
  ]);

  return canvas.toBuffer();
}

function safeFilePart(value) {
  return asciiText(value).trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

function buildInquiryPdfFileName(inquiry = {}) {
  const inquiryNumber = safeFilePart(inquiry.inquiryId || 'Inquiry');
  const projectNumber = safeFilePart(resolveProjectNumber(inquiry));
  return projectNumber && projectNumber !== '-' ? `Inquiry-${inquiryNumber}-${projectNumber}.pdf` : `Inquiry-${inquiryNumber}.pdf`;
}

module.exports = {
  buildInquiryPdf,
  buildInquiryPdfFileName,
  _private: {
    humanizeKey,
    normalizeLoadRows,
    normalizeComponentRows,
    hasMeaningfulValue,
    normalizeFlpDetailsForPdf,
  },
};
