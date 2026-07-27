'use strict';

const fs = require('fs');
const path = require('path');

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 42;
const RIGHT = 42;
const HEADER_BOTTOM = 126;
const CONTENT_TOP = 142;
const FOOTER_TOP = 807;
const CONTENT_BOTTOM = 790;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT;
const LABEL_WIDTH = 170;
const VALUE_WIDTH = CONTENT_WIDTH - LABEL_WIDTH;
const DEFAULT_LOGO_PATH = path.join(__dirname, '..', 'assets', 'nexus-logo-full.jpg');

const INTERNAL_KEYS = new Set([
  '_id', '__v', 'storedName', 'storagePath', 'workflowReference',
  'updatedBy', 'scheduledBy',
  // Workflow/status information is intentionally excluded from inquiry PDFs.
  'status', 'reviewStatus', 'nextFollowUpDate', 'convertedToProject',
]);

const TOP_LEVEL_IGNORED_KEYS = new Set([
  '_id', '__v', 'customerRef', 'projectReference', 'createdBy',
  'inquiryId', 'inquiryDate', 'customerName', 'companyName', 'companyType',
  'contactPerson', 'mobileNumber', 'email', 'designation',
  'siteAddress', 'city', 'location', 'projectName',
  'attachments', 'attachment', 'bomAttachments', 'contacts',
  'plcDetails', 'vfdDetails', 'mccDetails', 'flpEnclosureDetails',
  'rioBoxDetails', 'loadDetails', 'controlMatrix', 'statusDetails',
  'kickoffMeeting', 'liveCustomer', 'createdAt', 'updatedAt',
  'status', 'reviewStatus', 'nextFollowUpDate', 'convertedToProject',
]);

const LABEL_OVERRIDES = {
  inquiryId: 'Inquiry Number',
  inquiryDate: 'Inquiry Date',
  customerId: 'Customer Number',
  customerName: 'Customer Name',
  companyName: 'Company Name',
  companyType: 'Company Type',
  contactPerson: 'Contact Person',
  mobileNumber: 'Mobile Number',
  siteAddress: 'Site Address',
  projectId: 'Project Number',
  projectName: 'Project Name',
  previousOrderRef: 'Previous Order Reference',
  inquiryType: 'Inquiry Type',
  panelTypes: 'Panel Types',
  productType: 'Product Type',
  applicationDescription: 'Application Description',
  applicationProcess: 'Application Process',
  supplyVoltage: 'Supply Voltage',
  controlVoltage: 'Control Voltage',
  controlFeeder: 'Control Feeder',
  panelAreaClassification: 'Panel Area Classification',
  panelAreaClass: 'Panel Area Classification (Legacy)',
  ipRating: 'IP Rating',
  shortCircuitCapacity: 'Short Circuit Capacity',
  busbarMaterial: 'Busbar Material',
  enclosureType: 'Enclosure Type',
  enclosureMaterial: 'Enclosure Material',
  enclosureStandard: 'Enclosure Standard',
  enclosureMake: 'Enclosure Make',
  panelStructure: 'Panel Structure / Cubicle Construction',
  switchgearMake: 'Switchgear Make',
  customSwitchgearMake: 'Custom Switchgear Make',
  panelColourRal: 'Enclosure Material Color / RAL',
  cableEntry: 'Cable Entry',
  cableGlandMaterial: 'Cable Gland Material',
  barrierVariant: 'Barrier Variant',
  controlType: 'Control Type',
  panelMounting: 'Panel Mounting',
  certificationRequired: 'Certification Required',
  certificationDetails: 'Certification Details',
  drawingsAttached: 'Drawings Attached',
  drawingsSldAttached: 'Drawings / SLD Attached',
  equipmentListAttached: 'Equipment List Attached',
  referenceBomAttached: 'Reference BOM Attached',
  commissioningScope: 'Commissioning Scope',
  deliveryDate: 'Required Delivery Date',
  programmingScope: 'Programming Scope',
  onsiteSupport: 'On-site Support',
  deliveryTerms: 'Delivery Terms',
  paymentTerms: 'Payment Terms',
  additionalNotes: 'Additional Notes',
  internalRemarks: 'Internal Remarks',
  preparedBy: 'Prepared By',
  reviewStatus: 'Review Status',
  nextFollowUpDate: 'Next Follow-up Date',
  convertedToProject: 'Converted to Project',
  createdAt: 'Created At',
  updatedAt: 'Updated At',
  mimeType: 'File Type',
  sizeBytes: 'File Size',
  uploadedAt: 'Uploaded At',
  uploadedBy: 'Uploaded By',
  revisionNumber: 'Revision Number',
  versionLabel: 'Version',
  srNo: 'Sr. No.',
  qty: 'Quantity',
  kw: 'kW',
  hp: 'HP',
  ampere: 'Current (A)',
  ratingKwHp: 'Rating (kW / HP)',
  fullLoadCurrent: 'Full Load Current',
  kaRating: 'kA Rating',
  cableLengthMetres: 'Cable Length (m)',
  motorCapacityKw: 'Motor Capacity (kW)',
  ratedRpm: 'Rated RPM',
  hmiRequired: 'HMI Required',
  hmiSize: 'HMI Size',
  hmiMake: 'HMI Make',
  ethernetSwitchRequired: 'Ethernet Switch Required',
  ethernetSwitchPort: 'Ethernet Switch Port',
  ethernetSwitchType: 'Ethernet Switch Type',
  ioRequirements: 'I/O Requirements',
  ioDetails: 'I/O Details',
  plcCpuRedundancyRequired: 'PLC CPU Redundancy Required',
  ioSpareCapacityPercent: 'I/O Spare Capacity (%)',
  noOfDolStarters: 'No. of DOL Starters',
  noOfStarDeltaStarters: 'No. of Star-Delta Starters',
  noOfSoftStarters: 'No. of Soft Starters',
  noOfVfdFeeders: 'No. of VFD Feeders',
  totalLoadKw: 'Total Load (kW)',
  totalNoOfFeeders: 'Total No. of Feeders',
  amcRequiredAfterWarranty: 'AMC Required After Warranty',
};

const SECTION_TITLES = {
  plcDetails: 'PLC Panel Details',
  vfdDetails: 'VFD Panel Details',
  mccDetails: 'MCC Panel Details',
  flpEnclosureDetails: 'FLP Enclosure Details',
  rioBoxDetails: 'RIO Box Details',
  loadDetails: 'Load Details',
  controlMatrix: 'Control & Monitoring Matrix',
  kickoffMeeting: 'Kick-off Meeting',
};

function safeText(value) {
  return String(value ?? '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '?');
}

function isEmpty(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isBinaryValue(value) {
  return Buffer.isBuffer(value) || value instanceof Uint8Array;
}

function isDatabaseIdentifier(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (typeof value.toHexString === 'function' || value._bsontype === 'ObjectId')
  );
}

function formatDate(value, includeTime = false) {
  if (isEmpty(value)) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return safeText(value);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '-';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatValue(value, key = '') {
  if (isEmpty(value)) return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '-';
  if (value instanceof Date) return formatDate(value, true);
  if (Array.isArray(value)) {
    if (value.length === 0) return '-';
    if (value.every((item) => ['string', 'number', 'boolean'].includes(typeof item))) {
      return value.map((item) => formatValue(item)).join(', ');
    }
    return `${value.length} item(s)`;
  }
  if (typeof value === 'object') {
    if (value.name) return safeText(value.name);
    if (value.email) return safeText(value.email);
    if (value.projectId) return safeText(value.projectId);
    if (value.customerId) return safeText(value.customerId);
    if (isDatabaseIdentifier(value) || isBinaryValue(value)) return '-';
    return '-';
  }

  const lowerKey = String(key).toLowerCase();
  if (lowerKey.includes('date') || lowerKey.endsWith('at') || lowerKey.includes('scheduledon')) {
    return formatDate(value, lowerKey.endsWith('at') || lowerKey.includes('scheduled'));
  }
  if (key === 'sizeBytes') return formatBytes(value);
  return safeText(value).trim() || '-';
}

function humanizeKey(key) {
  if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key];
  const text = String(key || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());

  return text
    .replace(/\bPlc\b/g, 'PLC')
    .replace(/\bVfd\b/g, 'VFD')
    .replace(/\bMcc\b/g, 'MCC')
    .replace(/\bRio\b/g, 'RIO')
    .replace(/\bFlp\b/g, 'FLP')
    .replace(/\bHmi\b/g, 'HMI')
    .replace(/\bIo\b/g, 'I/O')
    .replace(/\bDi\b/g, 'DI')
    .replace(/\bDo\b/g, 'DO')
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bAo\b/g, 'AO')
    .replace(/\bIp\b/g, 'IP')
    .replace(/\bKa\b/g, 'kA')
    .replace(/\bKw\b/g, 'kW')
    .replace(/\bHp\b/g, 'HP')
    .replace(/\bRpm\b/g, 'RPM')
    .replace(/\bBom\b/g, 'BOM')
    .replace(/\bSld\b/g, 'SLD')
    .replace(/\bAmc\b/g, 'AMC')
    .replace(/\bGst\b/g, 'GST')
    .replace(/\bMv\b/g, 'MV')
    .replace(/\bLv\b/g, 'LV')
    .replace(/\bRal\b/g, 'RAL')
    .replace(/\bAc\b/g, 'AC')
    .replace(/\bDc\b/g, 'DC')
    .replace(/\bPto\b/g, 'PTO');
}

function escapePdfText(text) {
  return safeText(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r?\n/g, ' ');
}

function approximateTextWidth(text, size = 9) {
  return Array.from(safeText(text)).reduce((total, char) => {
    if (char === ' ') return total + size * 0.28;
    if ('ilI.,:;!|\'`'.includes(char)) return total + size * 0.25;
    if ('MW@#%&'.includes(char)) return total + size * 0.85;
    if (/[A-Z0-9]/.test(char)) return total + size * 0.61;
    return total + size * 0.5;
  }, 0);
}

function wrapText(text, maxWidth, size = 9) {
  const source = formatValue(text);
  const paragraphs = source.split(/\r?\n/);
  const lines = [];

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
    } else {
      let line = '';
      words.forEach((word) => {
        if (approximateTextWidth(word, size) > maxWidth) {
          if (line) {
            lines.push(line);
            line = '';
          }
          let chunk = '';
          Array.from(word).forEach((char) => {
            const candidate = chunk + char;
            if (chunk && approximateTextWidth(candidate, size) > maxWidth) {
              lines.push(chunk);
              chunk = char;
            } else {
              chunk = candidate;
            }
          });
          line = chunk;
          return;
        }

        const candidate = line ? `${line} ${word}` : word;
        if (line && approximateTextWidth(candidate, size) > maxWidth) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      });
      if (line) lines.push(line);
    }
    if (paragraphIndex < paragraphs.length - 1) lines.push('');
  });

  return lines.length ? lines : ['-'];
}

function parseLoadRating(value) {
  const source = String(value || '').trim();
  if (!source) return { kw: '', hp: '' };

  const kwMatch = source.match(/([0-9]+(?:\.[0-9]+)?)\s*k\s*w/i);
  const hpMatch = source.match(/([0-9]+(?:\.[0-9]+)?)\s*h\s*p/i);
  let kw = kwMatch ? kwMatch[1] : '';
  let hp = hpMatch ? hpMatch[1] : '';

  if ((!kw || !hp) && source.includes('/')) {
    const [firstPart = '', secondPart = ''] = source.split('/');
    if (!kw) {
      const valueKw = Number(String(firstPart).replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(valueKw)) kw = String(valueKw);
    }
    if (!hp) {
      const valueHp = Number(String(secondPart).replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(valueHp)) hp = String(valueHp);
    }
  }

  if (!kw && !hp) {
    const numeric = Number(source.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(numeric)) kw = String(numeric);
  }

  return { kw, hp };
}

function parseFiniteNumber(value) {
  if (isEmpty(value)) return null;
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function roundLoadValue(value) {
  return String(Math.round((value + Number.EPSILON) * 100) / 100);
}

function calculateLoadAmpere(kwValue) {
  const kw = parseFiniteNumber(kwValue);
  if (kw === null) return '';
  return roundLoadValue((kw * 1000) / (1.732 * 415 * 0.8));
}

function calculateTotalAmpere(qtyValue, ampereValue) {
  const qty = parseFiniteNumber(qtyValue);
  const ampere = parseFiniteNumber(ampereValue);
  if (qty === null || ampere === null) return '';
  return roundLoadValue(qty * ampere);
}

function pdfColor(hex) {
  const normalized = String(hex).replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized.padEnd(6, '0').slice(0, 6);
  const channels = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
  return channels.map((channel) => channel.toFixed(3)).join(' ');
}

class InquiryPdfCanvas {
  constructor({ inquiry, logoBuffer, logoWidth = 831, logoHeight = 210, companyName }) {
    this.inquiry = inquiry;
    this.logoBuffer = logoBuffer;
    this.logoWidth = logoWidth;
    this.logoHeight = logoHeight;
    this.companyName = companyName;
    this.pages = [];
    this.page = null;
    this.y = CONTENT_TOP;
    this.addPage();
  }

  addPage() {
    this.page = { commands: [] };
    this.pages.push(this.page);
    this.y = CONTENT_TOP;
    this.drawHeader();
  }

  command(value) {
    this.page.commands.push(value);
  }

  rect(x, yTop, width, height, { fill = null, stroke = null, lineWidth = 0.5 } = {}) {
    const y = PAGE_HEIGHT - yTop - height;
    this.command('q');
    if (fill) this.command(`${pdfColor(fill)} rg`);
    if (stroke) this.command(`${pdfColor(stroke)} RG ${lineWidth} w`);
    this.command(`${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re`);
    this.command(fill && stroke ? 'B' : fill ? 'f' : 'S');
    this.command('Q');
  }

  line(x1, yTop1, x2, yTop2, { color = '#d1d5db', lineWidth = 0.5 } = {}) {
    const y1 = PAGE_HEIGHT - yTop1;
    const y2 = PAGE_HEIGHT - yTop2;
    this.command(`q ${pdfColor(color)} RG ${lineWidth} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q`);
  }

  text(text, x, yTop, { size = 9, bold = false, color = '#111827' } = {}) {
    const y = PAGE_HEIGHT - yTop - size;
    const font = bold ? 'F2' : 'F1';
    this.command(`BT /${font} ${size.toFixed(2)} Tf ${pdfColor(color)} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`);
  }

  image(x, yTop, width, height) {
    if (!this.logoBuffer) return;
    const y = PAGE_HEIGHT - yTop - height;
    this.command(`q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im1 Do Q`);
  }

  drawHeader() {
    this.rect(0, 0, PAGE_WIDTH, HEADER_BOTTOM, { fill: '#ffffff' });
    this.image(LEFT, 28, 142, 36);
    if (this.companyName) {
      this.text(this.companyName, LEFT, 70, { size: 9.5, bold: true, color: '#1f2937' });
    }
    this.text('INQUIRY DETAILS', PAGE_WIDTH - RIGHT - 152, 28, { size: 15, bold: true, color: '#1d4ed8' });

    const inquiryNumber = formatValue(this.inquiry.inquiryId);
    const projectNumber = formatValue(resolveProjectNumber(this.inquiry));
    const inquiryDate = formatDate(this.inquiry.inquiryDate);

    this.text(`Inquiry: ${inquiryNumber}`, PAGE_WIDTH - RIGHT - 210, 55, { size: 9, bold: true });
    this.text(`Project: ${projectNumber}`, PAGE_WIDTH - RIGHT - 210, 72, { size: 9 });
    this.text(`Date: ${inquiryDate}`, PAGE_WIDTH - RIGHT - 210, 89, { size: 9 });
    this.line(LEFT, 113, PAGE_WIDTH - RIGHT, 113, { color: '#2563eb', lineWidth: 1.2 });
  }

  ensureSpace(height) {
    if (this.y + height > CONTENT_BOTTOM) this.addPage();
  }

  section(title) {
    this.ensureSpace(31);
    this.rect(LEFT, this.y, CONTENT_WIDTH, 24, { fill: '#eff6ff', stroke: '#bfdbfe', lineWidth: 0.6 });
    this.text(title, LEFT + 10, this.y + 6, { size: 10.5, bold: true, color: '#1e40af' });
    this.y += 31;
  }

  subsection(title) {
    this.ensureSpace(24);
    this.text(title, LEFT + 2, this.y + 2, { size: 9.5, bold: true, color: '#374151' });
    this.line(LEFT, this.y + 17, PAGE_WIDTH - RIGHT, this.y + 17, { color: '#e5e7eb' });
    this.y += 23;
  }

  field(label, value) {
    const labelText = formatValue(label);
    const valueText = formatValue(value);
    const labelLines = wrapText(labelText, LABEL_WIDTH - 18, 8.5);
    const valueLines = wrapText(valueText, VALUE_WIDTH - 18, 9);
    const lineHeight = 12;
    const maxLinesPerPage = Math.max(1, Math.floor((CONTENT_BOTTOM - CONTENT_TOP - 14) / lineHeight));

    if (Math.max(labelLines.length, valueLines.length) > maxLinesPerPage) {
      this.longField(labelText, valueLines);
      return;
    }

    const height = Math.max(28, Math.max(labelLines.length, valueLines.length) * lineHeight + 12);
    this.ensureSpace(height);
    this.rect(LEFT, this.y, CONTENT_WIDTH, height, { fill: '#ffffff', stroke: '#e5e7eb', lineWidth: 0.5 });
    this.rect(LEFT, this.y, LABEL_WIDTH, height, { fill: '#f9fafb' });
    this.line(LEFT + LABEL_WIDTH, this.y, LEFT + LABEL_WIDTH, this.y + height, { color: '#e5e7eb' });

    labelLines.forEach((lineText, index) => {
      this.text(lineText || ' ', LEFT + 9, this.y + 7 + index * lineHeight, { size: 8.5, bold: true, color: '#4b5563' });
    });
    valueLines.forEach((lineText, index) => {
      this.text(lineText || ' ', LEFT + LABEL_WIDTH + 9, this.y + 7 + index * lineHeight, { size: 9, color: '#111827' });
    });
    this.y += height;
  }

  longField(label, valueLines) {
    let remaining = [...valueLines];
    let continued = false;
    while (remaining.length) {
      const headingHeight = 25;
      this.ensureSpace(headingHeight + 25);
      const availableLines = Math.max(1, Math.floor((CONTENT_BOTTOM - this.y - headingHeight - 8) / 12));
      const chunk = remaining.splice(0, availableLines);
      const height = headingHeight + chunk.length * 12 + 8;
      this.rect(LEFT, this.y, CONTENT_WIDTH, height, { fill: '#ffffff', stroke: '#e5e7eb', lineWidth: 0.5 });
      this.rect(LEFT, this.y, CONTENT_WIDTH, headingHeight, { fill: '#f9fafb' });
      this.text(`${label}${continued ? ' (continued)' : ''}`, LEFT + 9, this.y + 7, { size: 8.5, bold: true, color: '#4b5563' });
      chunk.forEach((lineText, index) => {
        this.text(lineText || ' ', LEFT + 9, this.y + headingHeight + 4 + index * 12, { size: 9 });
      });
      this.y += height;
      continued = true;
      if (remaining.length) this.addPage();
    }
  }

  table(columns, rows, options = {}) {
    const {
      fontSize = 7.4,
      headerFontSize = 7.2,
      lineHeight = 9.5,
      cellPadding = 5,
      headerHeight = 28,
      minRowHeight = 25,
    } = options;

    const normalizedColumns = columns.map((column) => ({
      ...column,
      width: Number(column.width) || 0,
    }));

    const totalWidth = normalizedColumns.reduce((sum, column) => sum + column.width, 0);
    if (Math.abs(totalWidth - CONTENT_WIDTH) > 0.5) {
      throw new Error(`PDF table width must equal content width (${CONTENT_WIDTH.toFixed(2)}). Received ${totalWidth.toFixed(2)}.`);
    }

    const drawHeaderRow = () => {
      this.ensureSpace(headerHeight + minRowHeight);
      let x = LEFT;
      normalizedColumns.forEach((column) => {
        this.rect(x, this.y, column.width, headerHeight, {
          fill: '#eef2ff',
          stroke: '#c7d2fe',
          lineWidth: 0.55,
        });
        const headerLines = wrapText(column.label, column.width - cellPadding * 2, headerFontSize)
          .slice(0, 2);
        headerLines.forEach((lineText, index) => {
          this.text(lineText || ' ', x + cellPadding, this.y + 5 + index * 9, {
            size: headerFontSize,
            bold: true,
            color: '#3730a3',
          });
        });
        x += column.width;
      });
      this.y += headerHeight;
    };

    if (!Array.isArray(rows) || rows.length === 0) {
      this.field('Details', '-');
      return;
    }

    drawHeaderRow();

    rows.forEach((row) => {
      const cellLines = normalizedColumns.map((column) => wrapText(
        formatValue(row?.[column.key], column.key),
        column.width - cellPadding * 2,
        fontSize
      ));

      let lineOffset = 0;
      const totalLines = Math.max(...cellLines.map((lines) => lines.length));

      while (lineOffset < totalLines) {
        const availableHeight = CONTENT_BOTTOM - this.y;
        const availableLines = Math.floor((availableHeight - cellPadding * 2) / lineHeight);

        if (availableLines < 1) {
          this.addPage();
          drawHeaderRow();
          continue;
        }

        const chunkLineCount = Math.min(totalLines - lineOffset, availableLines);
        const rowHeight = Math.max(minRowHeight, chunkLineCount * lineHeight + cellPadding * 2);

        if (this.y + rowHeight > CONTENT_BOTTOM) {
          this.addPage();
          drawHeaderRow();
          continue;
        }

        let x = LEFT;
        normalizedColumns.forEach((column, columnIndex) => {
          this.rect(x, this.y, column.width, rowHeight, {
            fill: '#ffffff',
            stroke: '#e5e7eb',
            lineWidth: 0.5,
          });

          let lines = cellLines[columnIndex].slice(lineOffset, lineOffset + chunkLineCount);
          if (lineOffset > 0 && columnIndex === 0 && lines.length === 0) {
            lines = [`${formatValue(row?.[column.key])} (continued)`];
          }

          lines.forEach((lineText, index) => {
            this.text(lineText || ' ', x + cellPadding, this.y + cellPadding + index * lineHeight, {
              size: fontSize,
              color: '#111827',
            });
          });
          x += column.width;
        });

        this.y += rowHeight;
        lineOffset += chunkLineCount;

        if (lineOffset < totalLines) {
          this.addPage();
          drawHeaderRow();
        }
      }
    });
  }

  loadDetailsTable(rows) {
    const normalizedRows = (Array.isArray(rows) ? rows : []).map((row = {}, index) => {
      const rating = parseLoadRating(row.ratingKwHp);
      const kw = !isEmpty(row.kw) ? row.kw : rating.kw;
      const hp = !isEmpty(row.hp) ? row.hp : rating.hp;
      const ampere = !isEmpty(row.ampere)
        ? row.ampere
        : (!isEmpty(row.fullLoadCurrent) ? row.fullLoadCurrent : calculateLoadAmpere(kw));
      const totalAmpere = calculateTotalAmpere(row.qty, ampere);
      const detailNotes = [
        !isEmpty(row.startingMethod) ? `Starting Method: ${formatValue(row.startingMethod)}` : '',
        !isEmpty(row.remarks) ? formatValue(row.remarks) : '',
      ].filter(Boolean).join(' | ');

      return {
        srNo: !isEmpty(row.srNo) && Number(row.srNo) > 0 ? row.srNo : index + 1,
        loadDescription: row.loadDescription || row.description || '',
        qty: row.qty,
        kw,
        hp,
        ampere,
        totalAmpere,
        remarks: detailNotes,
      };
    });

    const columns = [
      { key: 'srNo', label: 'No.', width: 28 },
      { key: 'loadDescription', label: 'Load Description', width: 137 },
      { key: 'qty', label: 'Qty', width: 38 },
      { key: 'kw', label: 'kW', width: 40 },
      { key: 'hp', label: 'HP', width: 40 },
      { key: 'ampere', label: 'Ampere', width: 56 },
      { key: 'totalAmpere', label: 'Total A', width: 58 },
      { key: 'remarks', label: 'Remarks / Starting Method', width: CONTENT_WIDTH - 397 },
    ];

    this.table(columns, normalizedRows, {
      fontSize: 6.9,
      headerFontSize: 6.7,
      lineHeight: 9,
      cellPadding: 4,
      headerHeight: 27,
      minRowHeight: 24,
    });
  }

  componentRequirementsTable(rows) {
    const columns = [
      { key: 'component', label: 'Component', width: 142 },
      { key: 'required', label: 'Required', width: 54 },
      { key: 'preferredBrand', label: 'Preferred Brand', width: 88 },
      { key: 'suggestedModelRange', label: 'Suggested Model / Range', width: 111 },
      { key: 'remarks', label: 'Remarks', width: CONTENT_WIDTH - 395 },
    ];
    this.table(columns, rows);
  }

  gap(height = 8) {
    this.y += height;
  }

  renderObject(object, options = {}) {
    const {
      pathPrefix = '',
      includeEmpty = true,
      depth = 0,
      seen = new WeakSet(),
    } = options;

    if (!object || typeof object !== 'object') {
      this.field('Details', formatValue(object));
      return;
    }

    if (depth > 10 || isBinaryValue(object) || isDatabaseIdentifier(object) || (!Array.isArray(object) && !isPlainObject(object))) {
      this.field('Details', formatValue(object));
      return;
    }

    if (seen.has(object)) {
      this.field('Details', '-');
      return;
    }
    seen.add(object);

    const entries = Object.entries(object)
      .filter(([key]) => !INTERNAL_KEYS.has(key));

    if (entries.length === 0) {
      this.field('Details', '-');
      return;
    }

    entries.forEach(([key, value]) => {
      const label = humanizeKey(key);
      const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;

      if (Array.isArray(value)) {
        if (value.length === 0) {
          if (includeEmpty) this.field(label, '-');
          return;
        }
        if (value.every((item) => item === null || ['string', 'number', 'boolean'].includes(typeof item))) {
          this.field(label, value.map((item) => formatValue(item)).join(', '));
          return;
        }

        if (key === 'loadDetails') {
          this.subsection(label);
          this.loadDetailsTable(value);
          return;
        }

        if (key === 'additionalComponents') {
          this.subsection(label);
          this.componentRequirementsTable(value);
          return;
        }

        this.subsection(label);
        value.forEach((item, index) => {
          if (item && typeof item === 'object' && isPlainObject(item)) {
            this.subsection(`${humanizeKey(key).replace(/s$/, '')} ${index + 1}`);
            this.renderObject(item, {
              pathPrefix: `${fullPath}.${index}`,
              includeEmpty,
              depth: depth + 1,
              seen,
            });
          } else {
            this.field(`Item ${index + 1}`, formatValue(item));
          }
        });
        return;
      }

      if (value && typeof value === 'object' && !(value instanceof Date)) {
        if (isBinaryValue(value) || isDatabaseIdentifier(value) || !isPlainObject(value)) {
          if (includeEmpty || !isEmpty(value)) this.field(label, formatValue(value, key));
          return;
        }
        this.subsection(label);
        this.renderObject(value, {
          pathPrefix: fullPath,
          includeEmpty,
          depth: depth + 1,
          seen,
        });
        return;
      }

      if (!includeEmpty && isEmpty(value)) return;
      this.field(label, formatValue(value, key));
    });
  }

  renderFooter(pageIndex, pageCount) {
    const page = this.pages[pageIndex];
    const originalPage = this.page;
    this.page = page;
    this.line(LEFT, FOOTER_TOP, PAGE_WIDTH - RIGHT, FOOTER_TOP, { color: '#d1d5db' });
    this.text(`Generated ${formatDate(new Date(), true)}`, LEFT, FOOTER_TOP + 10, { size: 7.5, color: '#6b7280' });
    this.text(`Page ${pageIndex + 1} of ${pageCount}`, PAGE_WIDTH - RIGHT - 72, FOOTER_TOP + 10, { size: 7.5, color: '#6b7280' });
    this.page = originalPage;
  }
}

function resolveProjectNumber(inquiry = {}) {
  return inquiry.projectReference?.projectId
    || inquiry.projectReference?.projectNumber
    || inquiry.projectNumber
    || '';
}

function resolveProjectName(inquiry = {}) {
  return inquiry.projectReference?.projectName || inquiry.projectName || '';
}

function hasPanelType(inquiry, expected) {
  const types = Array.isArray(inquiry.panelTypes) ? inquiry.panelTypes : [];
  const normalized = types.map((value) => String(value || '').toUpperCase());
  return normalized.some((value) => value.includes(expected));
}

function getCustomerSnapshot(inquiry = {}) {
  const customer = inquiry.customerRef && typeof inquiry.customerRef === 'object'
    ? inquiry.customerRef
    : {};
  return {
    customerId: customer.customerId || '',
    customerName: inquiry.customerName || customer.customerName || '',
    companyName: inquiry.companyName || customer.companyName || '',
    companyType: inquiry.companyType || customer.companyType || '',
    gstNumber: customer.gstNumber || '',
    siteAddress: inquiry.siteAddress || customer.address || '',
    city: inquiry.city || inquiry.location || customer.city || '',
    customerNotes: customer.notes || '',
  };
}

function getContacts(inquiry = {}) {
  if (Array.isArray(inquiry.contacts) && inquiry.contacts.length) return inquiry.contacts;
  if (inquiry.contactPerson || inquiry.mobileNumber || inquiry.email || inquiry.designation) {
    return [{
      name: inquiry.contactPerson || '',
      phone: inquiry.mobileNumber || '',
      email: inquiry.email || '',
      designation: inquiry.designation || '',
    }];
  }
  return [];
}

function getGeneralInquiryFields(inquiry = {}) {
  const result = {};
  Object.entries(inquiry).forEach(([key, value]) => {
    if (TOP_LEVEL_IGNORED_KEYS.has(key)) return;
    result[key] = value;
  });
  return result;
}

function renderContacts(canvas, contacts) {
  if (!contacts.length) {
    canvas.field('Contacts', '-');
    return;
  }
  contacts.forEach((contact, index) => {
    canvas.subsection(`Contact ${index + 1}${index === 0 ? ' (Primary)' : ''}`);
    canvas.field('Name', contact.name);
    canvas.field('Phone', contact.phone);
    canvas.field('Email', contact.email);
    canvas.field('Designation', contact.designation);
  });
}

function renderAttachments(canvas, attachments, bomAttachments, legacyAttachment) {
  canvas.section('Attachments');
  const general = Array.isArray(attachments) ? attachments : [];
  const bom = Array.isArray(bomAttachments) ? bomAttachments : [];

  if (general.length === 0 && !legacyAttachment) {
    canvas.field('General Attachments', '-');
  } else {
    canvas.subsection('General Attachments');
    general.forEach((file, index) => {
      canvas.subsection(`Attachment ${index + 1}`);
      canvas.field('File Name', file.name || file.originalName || file.storedName);
      canvas.field('File Type', file.mimeType);
      canvas.field('File Size', formatBytes(file.sizeBytes));
      canvas.field('Uploaded At', formatDate(file.uploadedAt, true));
    });
    if (legacyAttachment) canvas.field('Legacy Attachment', path.basename(String(legacyAttachment)));
  }

  if (bom.length === 0) {
    canvas.field('Technical BOM Attachments', '-');
  } else {
    canvas.subsection('Technical BOM Attachments');
    bom.forEach((file, index) => {
      canvas.subsection(`BOM Attachment ${index + 1}`);
      canvas.field('File Name', file.name || file.originalName || file.storedName);
      canvas.field('Version', file.versionLabel || `Revision ${file.revisionNumber ?? 0}`);
      canvas.field('Revision Number', file.revisionNumber);
      canvas.field('Remarks', file.remarks);
      canvas.field('Uploaded By', file.uploadedBy?.name || file.uploadedBy?.email || '-');
      canvas.field('File Type', file.mimeType);
      canvas.field('File Size', formatBytes(file.sizeBytes));
      canvas.field('Uploaded At', formatDate(file.uploadedAt, true));
    });
  }
}

function buildPdfObjects(canvas) {
  const objects = [];
  const addObject = (buffer) => {
    objects.push(Buffer.isBuffer(buffer) ? buffer : Buffer.from(String(buffer), 'latin1'));
    return objects.length;
  };

  const catalogId = addObject('');
  const pagesId = addObject('');
  const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  let imageId = null;
  if (canvas.logoBuffer) {
    const imageHeader = Buffer.from(
      `<< /Type /XObject /Subtype /Image /Width ${canvas.logoWidth} /Height ${canvas.logoHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${canvas.logoBuffer.length} >>\nstream\n`,
      'latin1'
    );
    imageId = addObject(Buffer.concat([imageHeader, canvas.logoBuffer, Buffer.from('\nendstream', 'latin1')]));
  }

  const pageIds = [];
  canvas.pages.forEach((page) => {
    const contentBuffer = Buffer.from(`${page.commands.join('\n')}\n`, 'latin1');
    const contentId = addObject(Buffer.concat([
      Buffer.from(`<< /Length ${contentBuffer.length} >>\nstream\n`, 'latin1'),
      contentBuffer,
      Buffer.from('endstream', 'latin1'),
    ]));

    const xObjectPart = imageId ? `/XObject << /Im1 ${imageId} 0 R >>` : '';
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(2)}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> ${xObjectPart} >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  });

  objects[catalogId - 1] = Buffer.from(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`, 'latin1');
  objects[pagesId - 1] = Buffer.from(
    `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`,
    'latin1'
  );

  const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary')];
  const offsets = [0];
  let currentOffset = chunks[0].length;

  objects.forEach((objectBuffer, index) => {
    offsets.push(currentOffset);
    const prefix = Buffer.from(`${index + 1} 0 obj\n`, 'latin1');
    const suffix = Buffer.from('\nendobj\n', 'latin1');
    chunks.push(prefix, objectBuffer, suffix);
    currentOffset += prefix.length + objectBuffer.length + suffix.length;
  });

  const xrefOffset = currentOffset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    xref += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(chunks);
}

function buildInquiryPdf(inquiryInput, options = {}) {
  const inquiry = inquiryInput && typeof inquiryInput.toObject === 'function'
    ? inquiryInput.toObject()
    : { ...(inquiryInput || {}) };

  const logoPath = options.logoPath || DEFAULT_LOGO_PATH;
  const logoBuffer = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null;
  const canvas = new InquiryPdfCanvas({
    inquiry,
    logoBuffer,
    companyName: options.companyName || process.env.COMPANY_NAME || 'Nexus Dashboard',
  });

  canvas.section('Customer / Company Details');
  canvas.renderObject(getCustomerSnapshot(inquiry));

  canvas.section('Contact Information');
  renderContacts(canvas, getContacts(inquiry));

  canvas.section('Inquiry, Project & General Details');
  canvas.field('Inquiry Number', inquiry.inquiryId);
  canvas.field('Inquiry Date', formatDate(inquiry.inquiryDate));
  canvas.field('Project Number', resolveProjectNumber(inquiry));
  canvas.field('Project Name', resolveProjectName(inquiry));
  canvas.renderObject(getGeneralInquiryFields(inquiry));

  if (Array.isArray(inquiry.loadDetails) && inquiry.loadDetails.length) {
    canvas.section(SECTION_TITLES.loadDetails);
    canvas.loadDetailsTable(inquiry.loadDetails);
  }

  if (inquiry.controlMatrix && Object.keys(inquiry.controlMatrix).length) {
    canvas.section(SECTION_TITLES.controlMatrix);
    canvas.renderObject(inquiry.controlMatrix);
  }

  const showPlc = hasPanelType(inquiry, 'PLC') || ['PLC_AUTOMATION', 'MCC_CUM_PLC'].includes(inquiry.inquiryType);
  const showVfd = hasPanelType(inquiry, 'VFD') || inquiry.inquiryType === 'VFD_PANEL';
  const showMcc = hasPanelType(inquiry, 'MCC') || ['MCC_PANEL', 'MCC_CUM_PLC'].includes(inquiry.inquiryType);
  const showFlp = hasPanelType(inquiry, 'FLP');
  const showRio = hasPanelType(inquiry, 'RIO');

  [
    ['plcDetails', showPlc],
    ['vfdDetails', showVfd],
    ['mccDetails', showMcc],
    ['flpEnclosureDetails', showFlp],
    ['rioBoxDetails', showRio],
  ].forEach(([key, shouldShow]) => {
    if (!shouldShow) return;
    canvas.section(SECTION_TITLES[key]);
    canvas.renderObject(inquiry[key] || {});
  });

  if (inquiry.kickoffMeeting && Object.keys(inquiry.kickoffMeeting).length) {
    canvas.section(SECTION_TITLES.kickoffMeeting);
    canvas.renderObject(inquiry.kickoffMeeting);
  }

  renderAttachments(canvas, inquiry.attachments, inquiry.bomAttachments, inquiry.attachment);

  canvas.section('Record Information');
  canvas.field('Created By', inquiry.createdBy?.name || inquiry.createdBy?.email || inquiry.preparedBy || '-');
  canvas.field('Created At', formatDate(inquiry.createdAt, true));
  canvas.field('Updated At', formatDate(inquiry.updatedAt, true));
  canvas.field('Project Number', resolveProjectNumber(inquiry));

  canvas.pages.forEach((_page, index) => canvas.renderFooter(index, canvas.pages.length));

  return buildPdfObjects(canvas);
}

function sanitizeFileSegment(value) {
  return safeText(value)
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildInquiryPdfFileName(inquiry = {}) {
  const inquiryNumber = sanitizeFileSegment(inquiry.inquiryId || 'Inquiry');
  const projectNumber = sanitizeFileSegment(resolveProjectNumber(inquiry));
  return projectNumber
    ? `Inquiry-${inquiryNumber}-${projectNumber}.pdf`
    : `Inquiry-${inquiryNumber}.pdf`;
}

module.exports = {
  buildInquiryPdf,
  buildInquiryPdfFileName,
  resolveProjectNumber,
};
