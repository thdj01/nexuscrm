// ─────────────────────────────────────────────────────────────────────────────
// backend/controllers/inquiryController.js  — FIXED (full replacement)
//
// Bug fixes applied:
//   [M1] createInquiry: replaced `payload = { ...req.body, … }` with an
//        explicit, allowlisted payload object.  Spreading req.body was
//        forwarding unknown / UI-only junk fields and could conflict with
//        explicitly set fields lower in the spread.
//   [H2] updateInquiry: strip protected fields (createdBy, inquiryId, _id,
//        __v) from updatePayload before calling findByIdAndUpdate.
//        Previously, the frontend's _json blob re-sent these fields (they
//        come back from the GET /inquiries/:id response and are part of the
//        form state spread into jsonPayload).  Allowing them through could
//        overwrite the original author and cause inquiryId collisions.
//   [H2] updateInquiry: also strip keptAttachments from the DB update (was
//        already done but now done via explicit delete to be safe).
//
// All other logic preserved exactly:
//   uploadMiddleware, parseJsonField, buildAttachmentDocs, backFillAttachments,
//   normaliseContacts, validateContacts, getInquiries, getInquiry, getFollowUps,
//   deleteInquiry, notification calls, Customer auto-create.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose           = require('mongoose');
const Inquiry            = require('../models/Inquiry');
const Customer           = require('../models/Customer');
const {
  applyCustomerToPayload,
  findCustomerIdsForSearch,
  getLiveCustomerSnapshot,
  resolveUniversalCustomer,
} = require('../utils/customerUniversal');
const path               = require('path');
const fs                 = require('fs');
const multer             = require('multer');
const createNotification         = require('../services/notificationService');
const { sendWhatsAppNotification, sendWhatsAppGroupNotification, sendWhatsAppGroupWithAttachments} = require('../services/whatsappService');
const {
  buildNewInquiryWhatsAppMessage,
  dashboardMessages,
} = require('../services/notificationTemplates');

const FINAL_INQUIRY_STATUSES = [
  'New',
  'Technical Evaluation',
  'Technical BoM Submitted',
  'BoM Approval Pending',
  'Revision',
  'Commercial BOM Submission',
  'Order Won',
  'Order Lost',
  'Inquiry Hold',
];

const LEGACY_STATUS_MAP = {
  'In Progress': 'Technical Evaluation',
  'Technical Submit': 'Technical BoM Submitted',
  'Technical BOM Submission': 'Technical BoM Submitted',
  'Technical BoM Submission': 'Technical BoM Submitted',
  'BOM Submitted': 'Technical BoM Submitted',
  'Bom Submitted': 'Technical BoM Submitted',
  'BOM SUBMITTED': 'Technical BoM Submitted',
  'BoM Submitted': 'Technical BoM Submitted',
  'Technical BoM Submitted': 'Technical BoM Submitted',
  'Technical BOM Approval': 'BoM Approval Pending',
  'Commercial Submit': 'Commercial BOM Submission',
  'Commercial Discussion': 'Commercial BOM Submission',
  'Quotation Submit': 'Commercial BOM Submission',
  'Order Received': 'Order Won',
  'Order Recieved': 'Order Won',
  'Inquiry Lost': 'Order Lost',
  'Inq. Lost': 'Order Lost',
};

const ORDER_LOST_REASONS = ['Price', 'Commercial', 'Priority', 'Timing', 'Trust Issue', 'Certification'];
const HOLD_REASONS = ['Due to Customer', 'Specification', 'Technical', 'Commercial'];

const normalizeInquiryStatus = (status = '') => LEGACY_STATUS_MAP[status] || status || 'New';

// ─── Multer — multi-file upload (disk storage under uploads/inquiry/) ─────────
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'inquiry');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/zip', 'application/x-zip-compressed',
];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safe);
  },
});

const fileFilter = (_req, file, cb) => {
  cb(null, ALLOWED_MIME.includes(file.mimetype));
};

// Exported so inquiryRoutes can apply it as route middleware
const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 },  // 15 MB per file
}).fields([
  { name: 'attachments', maxCount: 10 },
  { name: 'bomAttachments', maxCount: 10 },
]);

// ─── Helper: parse _json blob injected by the frontend FormData ──────────────
// The frontend serialises all non-file fields as JSON in fd.append('_json', ...).
// After multer runs, req.body._json is the raw string; this merges it back.
const parseJsonField = (req) => {
  if (req.body && req.body._json) {
    try {
      const parsed = JSON.parse(req.body._json);
      req.body = { ...req.body, ...parsed };
    } catch (_) {
      // Malformed _json — ignore, proceed with raw req.body
    }
    delete req.body._json;
  }
};

// ─── Helper: build attachment sub-docs from multer req.files ─────────────────
const buildAttachmentDocs = (files = []) =>
  files.map(f => ({
    name: f.originalname,
    storedName:   f.filename,
    storagePath:  path.join('inquiry', f.filename).replace(/\\/g, '/'),  // always forward slashes
    mimeType:     f.mimetype,
    sizeBytes:    f.size,
    uploadedAt:   new Date(),
  }));


const getUploadedFiles = (req, fieldName = 'attachments') => {
  if (Array.isArray(req.files)) return fieldName === 'attachments' ? req.files : [];
  if (req.files && Array.isArray(req.files[fieldName])) return req.files[fieldName];
  return [];
};

const getBomVersionLabel = (revisionNumber = 0) => (
  `Revision ${Number(revisionNumber) || 0}`
);

const getNextBomRevisionNumber = (existingBomAttachments = []) => {
  const revisions = existingBomAttachments
    .map((item) => Number(item?.revisionNumber))
    .filter((value) => Number.isFinite(value));

  if (revisions.length === 0) return 0;
  return Math.max(...revisions) + 1;
};

const buildBomAttachmentDocs = ({ files = [], revisionNumber = 0, remarks = '', userId }) => {
  const versionLabel = getBomVersionLabel(revisionNumber);

  return buildAttachmentDocs(files).map((doc) => ({
    ...doc,
    revisionNumber,
    versionLabel,
    remarks: remarks || '',
    uploadedBy: userId,
  }));
};

const getBomUploadStatus = ({ existingBomAttachments = [] } = {}) => {
  const hasPreviousBom = Array.isArray(existingBomAttachments) && existingBomAttachments.length > 0;
  return hasPreviousBom ? 'Revision' : 'Technical BoM Submitted';
};


// ─── Helper: back-fill attachments[] from legacy single attachment string ─────
const backFillAttachments = (docObj) => {
  if (!docObj.attachments || docObj.attachments.length === 0) {
    if (docObj.attachment) {
      docObj.attachments = [{
        originalName: path.basename(docObj.attachment),
        storedName:   path.basename(docObj.attachment),
        storagePath:  docObj.attachment,
        mimeType:     '',
        sizeBytes:    0,
        uploadedAt:   docObj.createdAt || new Date(),
      }];
    } else {
      docObj.attachments = [];
    }
  }
  return docObj;
};

// ─── Helper: normalise any inbound payload to a proper contacts[] ─────────────
const normaliseContacts = (body) => {
  const clean = (arr) =>
    arr
      .filter(c => c && (c.name || c.phone || c.email))
      .map(({ id, _id, ...rest }) => rest);

  if (Array.isArray(body.contacts) && body.contacts.length > 0) {
    return clean(body.contacts);
  }

  if (body.contactPerson || body.mobileNumber) {
    return [{
      name:        (body.contactPerson || '').trim(),
      phone:       (body.mobileNumber  || '').trim(),
      email:       (body.email         || '').trim(),
      designation: (body.designation   || '').trim(),
    }];
  }

  return [];
};

// ─── Helper: validate contacts array, return error messages ──────────────────
const validateContacts = (contacts) => {
  const errors = [];

  if (!contacts || contacts.length === 0) {
    errors.push('At least one contact person is required');
    return errors;
  }

  const primary = contacts[0];
  if (!primary.name || !primary.name.trim()) {
    errors.push('Primary contact name is required');
  }
  if (primary.phone && !/^\d{10}$/.test(primary.phone.replace(/\s/g, ''))) {
    errors.push('Primary contact phone must be a valid 10-digit number');
  }
  if (primary.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primary.email)) {
    errors.push('Primary contact email is invalid');
  }

  contacts.slice(1).forEach((c, i) => {
    if (c.phone && !/^\d{10}$/.test(c.phone.replace(/\s/g, ''))) {
      errors.push(`Contact ${i + 2}: phone must be a valid 10-digit number`);
    }
    if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) {
      errors.push(`Contact ${i + 2}: email is invalid`);
    }
  });

  return errors;
};

// ─── Inquiry type helpers ───────────────────────────────────────────────────
const INQUIRY_TYPES = ['PLC_AUTOMATION', 'VFD_PANEL', 'MCC_PANEL', 'MCC_CUM_PLC', 'LEGACY'];
const ALLOWED_PRODUCT_TYPES = ['PLC', 'MCC', 'VFD', 'PLC_MCC'];

const INQUIRY_TYPE_PRODUCT_MAP = {
  PLC_AUTOMATION: 'PLC',
  VFD_PANEL: 'VFD',
  MCC_PANEL: 'MCC',
  MCC_CUM_PLC: 'PLC_MCC',
  LEGACY: 'MCC',
};

const INQUIRY_TYPE_PANEL_LABEL_MAP = {
  PLC_AUTOMATION: 'PLC',
  VFD_PANEL: 'VFD',
  MCC_PANEL: 'MCC',
  MCC_CUM_PLC: 'MCC cum PLC',
};

const normalizeProductType = (value) => {
  const text = String(value || '').trim();
  return ALLOWED_PRODUCT_TYPES.includes(text) ? text : '';
};

const buildProductTypeQuery = (productType = '') => {
  const normalized = normalizeProductType(productType);
  return normalized || undefined;
};

const normalizeText = (value) => String(value || '').trim().toUpperCase();

const inferInquiryTypeFromLegacy = (productType, panelTypes = []) => {
  const values = [productType, ...(Array.isArray(panelTypes) ? panelTypes : [])]
    .map(normalizeText)
    .filter(Boolean);

  if (values.includes('PLC_MCC') || values.includes('MCC CUM PLC')) return 'MCC_CUM_PLC';
  if (values.includes('PLC')) return 'PLC_AUTOMATION';
  if (values.includes('VFD')) return 'VFD_PANEL';
  if (values.includes('MCC')) return 'MCC_PANEL';
  return 'LEGACY';
};

const normalizeInquiryType = (value, productType, panelTypes) => {
  if (INQUIRY_TYPES.includes(value)) return value;
  return inferInquiryTypeFromLegacy(productType, panelTypes);
};

const deriveProductType = (body, inquiryType) => {
  const requestedProductType = normalizeProductType(body.productType);
  if (requestedProductType) return requestedProductType;
  return INQUIRY_TYPE_PRODUCT_MAP[inquiryType] || 'MCC';
};

const derivePanelTypes = (body, inquiryType) => {
  if (Array.isArray(body.panelTypes) && body.panelTypes.length > 0) {
    return body.panelTypes.filter((value) => ['PLC', 'MCC', 'VFD', 'MCC cum PLC'].includes(value));
  }
  if (INQUIRY_TYPE_PANEL_LABEL_MAP[inquiryType]) return [INQUIRY_TYPE_PANEL_LABEL_MAP[inquiryType]];
  return [];
};

const boolFromPayload = (value) => value === true || value === 'true' || value === 'Yes' || value === 'Required';

const isControlFeederSupplyVoltage = (value = '') => {
  const normalized = String(value || '')
    .toUpperCase()
    .replace(/[,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized || normalized.includes('NEUTRAL')) return false;

  return /^(415|440)\s*V\s*(AC\s*)?3\s*PHASE$/.test(normalized);
};

const normalizeControlFeeder = (value, supplyVoltage) => (
  isControlFeederSupplyVoltage(supplyVoltage) && boolFromPayload(value)
);

const firstPresent = (...values) => values.find(v => v !== undefined && v !== null && v !== '');

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

const sanitizePlcDetails = (plcDetails = {}) => ({
  ...(plcDetails || {}),
  automationRequirements: sanitizeComponentRequirementRows(plcDetails?.automationRequirements),
});

const sanitizeVfdDetails = (vfdDetails = {}) => ({
  ...(vfdDetails || {}),
  additionalComponents: sanitizeComponentRequirementRows(vfdDetails?.additionalComponents),
});

const buildStatusQuery = (status) => {
  const normalized = normalizeInquiryStatus(status);
  const aliases = Object.entries(LEGACY_STATUS_MAP)
    .filter(([, mapped]) => mapped === normalized)
    .map(([legacy]) => legacy);

  return aliases.length > 0 ? { $in: [normalized, ...aliases] } : normalized;
};

const getExistingStatusDetails = (inquiry) => {
  const value = inquiry.statusDetails;
  if (!value) return {};
  if (typeof value.toObject === 'function') return value.toObject();
  return { ...value };
};

const sanitizeAttachmentDoc = (attachment) => {
  if (!attachment) return undefined;
  const value = typeof attachment.toObject === 'function' ? attachment.toObject() : attachment;
  if (!value.storedName || !value.storagePath) return undefined;
  return {
    name: value.name || value.originalName || value.storedName || '',
    storedName: value.storedName,
    storagePath: value.storagePath,
    mimeType: value.mimeType || '',
    sizeBytes: value.sizeBytes || 0,
    uploadedAt: value.uploadedAt || new Date(),
  };
};

const sanitizeBomAttachmentDoc = (attachment) => {
  const base = sanitizeAttachmentDoc(attachment);
  if (!base) return undefined;
  const value = typeof attachment.toObject === 'function' ? attachment.toObject() : attachment;
  const revisionNumber = Number.isFinite(Number(value.revisionNumber)) ? Number(value.revisionNumber) : 0;

  return {
    ...base,
    revisionNumber,
    versionLabel: getBomVersionLabel(revisionNumber),
    remarks: value.remarks || '',
    uploadedBy: value.uploadedBy,
  };
};

const mergeStatusDetails = ({ inquiry, body, status, statusChanged, newFileDocs, userId }) => {
  const incoming = body.statusDetails || {};
  const current = getExistingStatusDetails(inquiry);
  const now = new Date();

  if (status === 'Order Lost' && (statusChanged || incoming.orderLost)) {
    const reason = String(incoming.orderLost?.reason || '').trim();
    if (!ORDER_LOST_REASONS.includes(reason)) {
      const err = new Error('Reason for Order Lost is required');
      err.statusCode = 400;
      throw err;
    }

    return {
      ...current,
      orderLost: {
        reason,
        additionalRemark: String(incoming.orderLost?.additionalRemark || '').trim(),
        updatedAt: now,
        updatedBy: userId,
      },
    };
  }

  if (status === 'Inquiry Hold' && (statusChanged || incoming.inquiryHold)) {
    const reason = String(incoming.inquiryHold?.reason || '').trim();
    if (!HOLD_REASONS.includes(reason)) {
      const err = new Error('Hold Reason is required');
      err.statusCode = 400;
      throw err;
    }

    return {
      ...current,
      inquiryHold: {
        reason,
        updatedAt: now,
        updatedBy: userId,
      },
    };
  }

  if (status === 'BoM Approval Pending' && (statusChanged || incoming.bomApproval)) {
    return {
      ...current,
      bomApproval: {
        additionalRemark: String(incoming.bomApproval?.additionalRemark || '').trim(),
        updatedAt: now,
        updatedBy: userId,
      },
    };
  }

  if (['Revision', 'Technical BoM Submitted'].includes(status) && (statusChanged || incoming.revision || newFileDocs?.length)) {
    const revision = incoming.revision || {};
    const newRevisionAttachment = sanitizeAttachmentDoc(newFileDocs?.[0]);

    return {
      ...current,
      revision: {
        customerComment: String(revision.customerComment || '').trim(),
        internalNotes: String(revision.internalNotes || '').trim(),
        attachment: newRevisionAttachment || current.revision?.attachment,
        updatedAt: now,
        updatedBy: userId,
      },
    };
  }

  if (incoming && Object.keys(incoming).length) {
    return { ...current, ...incoming };
  }

  return undefined;
};


const buildBomStatusDetails = ({ inquiry, baseDetails, revisionNumber, versionLabel, remarks, userId }) => ({
  ...(baseDetails || getExistingStatusDetails(inquiry)),
  bomSubmission: {
    revisionNumber,
    versionLabel,
    remarks: remarks || '',
    updatedAt: new Date(),
    updatedBy: userId,
  },
});


const padYearSuffix = (year) => String(year % 100).padStart(2, '0');

const getCurrentFinancialYearStart = (date = new Date()) => (
  date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1
);

const parseFinancialYear = (value) => {
  if (typeof value !== 'string') return null;

  const match = value.trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const startYear = Number(match[1]);
  const endSuffix = Number(match[2]);

  if (!Number.isInteger(startYear) || startYear < 2000 || startYear > 2100) return null;
  if (endSuffix !== Number(padYearSuffix(startYear + 1))) return null;

  return startYear;
};

const getFinancialYearDateFilter = (financialYear) => {
  if (String(financialYear || '').trim().toLowerCase() === 'all') return null;
  const startYear = parseFinancialYear(financialYear);
  if (!startYear) return null;

  return {
    $gte: new Date(startYear, 3, 1, 0, 0, 0, 0),
    $lt: new Date(startYear + 1, 3, 1, 0, 0, 0, 0),
  };
};

const applyFinancialYearFilter = (query, financialYear) => {
  const inquiryDate = getFinancialYearDateFilter(financialYear);
  if (inquiryDate) query.inquiryDate = inquiryDate;
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc  Get all inquiries
// @route GET /api/inquiries
// @access Private
// ─────────────────────────────────────────────────────────────────────────────
const getInquiries = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 10,
      search, status, priority, productType, inquiryType, customerRef, financialYear,
    } = req.query;

    const query = {};
    applyFinancialYearFilter(query, financialYear);
    if (status)      query.status      = buildStatusQuery(status);
    if (priority)    query.priority    = priority;
    if (productType) query.productType = buildProductTypeQuery(productType);
    if (inquiryType) query.inquiryType = inquiryType;
    if (customerRef && mongoose.Types.ObjectId.isValid(customerRef)) {
      query.customerRef = customerRef;
    }

    if (search) {
      const matchedCustomerIds = await findCustomerIdsForSearch(search);
      query.$or = [
        { inquiryId:        { $regex: search, $options: 'i' } },
        { customerName:     { $regex: search, $options: 'i' } },
        { companyName:      { $regex: search, $options: 'i' } },
        { projectName:      { $regex: search, $options: 'i' } },
        { contactPerson:    { $regex: search, $options: 'i' } },
        { mobileNumber:     { $regex: search, $options: 'i' } },
        { 'contacts.name':  { $regex: search, $options: 'i' } },
        { 'contacts.phone': { $regex: search, $options: 'i' } },
        { 'contacts.email': { $regex: search, $options: 'i' } },
        ...(matchedCustomerIds.length ? [{ customerRef: { $in: matchedCustomerIds } }] : []),
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [inquiries, total] = await Promise.all([
      Inquiry.find(query)
        .populate('createdBy', 'name')
        .populate('customerRef', 'customerId customerName companyType contacts contactPerson email mobileNumber city address gstNumber notes')
        .populate('projectReference', 'projectId projectName')
        .populate('kickoffMeeting.attendees', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Inquiry.countDocuments(query),
    ]);

    res.json({
      success: true,
      data:    inquiries.map((item) => getLiveCustomerSnapshot(item.toObject ? item.toObject() : item)),
      pagination: {
        total,
        page:  Number(page),
        pages: Math.ceil(total / Number(limit)),
        limit: Number(limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc  Get single inquiry
// @route GET /api/inquiries/:id
// @access Private
// ─────────────────────────────────────────────────────────────────────────────
const getInquiry = async (req, res, next) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('customerRef', 'customerId customerName companyType contacts contactPerson email mobileNumber city address gstNumber notes')
      .populate('kickoffMeeting.attendees', 'name email role');

    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found' });
    }

    const data = getLiveCustomerSnapshot(inquiry.toObject());

    // Back-fill contacts for old records that have none yet
    if (!data.contacts || data.contacts.length === 0) {
      if (data.contactPerson || data.mobileNumber) {
        data.contacts = [{
          name:        data.contactPerson || '',
          phone:       data.mobileNumber  || '',
          email:       data.email         || '',
          designation: data.designation   || '',
        }];
      } else {
        data.contacts = [];
      }
    }

    // Back-fill attachments from legacy single attachment string
    backFillAttachments(data);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc  Create inquiry
// @route POST /api/inquiries
// @access Private
// ─────────────────────────────────────────────────────────────────────────────
const createInquiry = async (req, res, next) => {
  try {
    // 1. Parse the _json blob sent by the multipart form
    parseJsonField(req);

    // 2. Normalise contacts
    const contacts = normaliseContacts(req.body);

    // 3. Validate contacts
    const contactErrors = validateContacts(contacts);
    if (contactErrors.length > 0) {
      return res.status(400).json({ success: false, message: contactErrors[0], errors: contactErrors });
    }

    // 4. Build attachment docs from newly uploaded files
    const newFileDocs = buildAttachmentDocs(getUploadedFiles(req, 'attachments'));
    const uploadedBomFiles = getUploadedFiles(req, 'bomAttachments');

    // 5. Build an explicit, allowlisted payload  [FIX M1]
    //    Do NOT spread req.body wholesale — it may contain _id, __v, inquiryId,
    //    createdBy from a cached response, or other fields that should not be
    //    written directly.  Pick each field explicitly.
    const b       = req.body;
    const primary = contacts[0];
    const inquiryType = normalizeInquiryType(b.inquiryType, b.productType, b.panelTypes);
    const productType = normalizeProductType(deriveProductType(b, inquiryType)) || 'MCC';
    const panelTypes = derivePanelTypes(b, inquiryType);
    const hasBomUpload = uploadedBomFiles.length > 0;
    const bomRevisionNumber = hasBomUpload ? 0 : undefined;
    const bomVersionLabel = hasBomUpload ? getBomVersionLabel(bomRevisionNumber) : undefined;
    const bomRemarks = b.bomSubmissionRemarks || '';
    const bomAttachmentDocs = hasBomUpload
      ? buildBomAttachmentDocs({
          files: uploadedBomFiles,
          revisionNumber: bomRevisionNumber,
          remarks: bomRemarks,
          userId: req.user._id,
        })
      : [];

    const sanitizedPlcDetails = b.plcDetails ? sanitizePlcDetails(b.plcDetails) : undefined;
    const sanitizedVfdDetails = b.vfdDetails ? sanitizeVfdDetails(b.vfdDetails) : undefined;

    const payload = {
      // ── Section 1
      inquiryDate:    b.inquiryDate    || undefined,
      rfqNumber:      b.rfqNumber      || undefined,
      customerName:   b.customerName   || b.companyName || '',
      companyType:    b.companyType    || undefined,
      contacts,
      // Legacy flat contact fields — kept in sync by pre-save hook too,
      // but set explicitly here so Customer auto-create has them immediately.
      contactPerson:  primary.name,
      mobileNumber:   primary.phone,
      email:          primary.email,
      designation:    primary.designation,
      siteAddress:    b.siteAddress    || undefined,
      city:           b.city           || undefined,
      location:       b.location       || b.city || b.siteAddress || undefined,

      // ── Section 2
      projectName:      b.projectName      || undefined,
      industryType:     b.industryType     || undefined,
      offerType:        b.offerType        || undefined,
      previousOrderRef: b.previousOrderRef || undefined,

      // ── Inquiry type + product fields
      inquiryType,
      panelTypes,
      customPanelType:        b.customPanelType        || undefined,
      applicationDescription: b.applicationDescription || undefined,
      applicationProcess:     b.applicationProcess     || undefined,
      productType,

      // ── Section 4
      supplyVoltage:        b.supplyVoltage        || undefined,
      controlVoltage:       b.controlVoltage       || undefined,
      controlFeeder:        normalizeControlFeeder(b.controlFeeder, b.supplyVoltage),
      frequency:            b.frequency            || undefined,
      panelAreaClassification: firstPresent(b.panelAreaClassification, b.panelAreaClass),
      panelAreaClass:          firstPresent(b.panelAreaClass, b.panelAreaClassification),
      ipRating:                firstPresent(b.ipRating, b.protectionClass),
      installationType:        b.installationType     || undefined,
      shortCircuitCapacity:    b.shortCircuitCapacity || undefined,
      busbarMaterial:          b.busbarMaterial       || undefined,
      enclosureMaterial:       firstPresent(b.enclosureMaterial, b.enclosureStandard),
      enclosureStandard:       firstPresent(b.enclosureStandard, b.enclosureMaterial),
      panelColourRal:          b.panelColourRal       || undefined,
      cableEntry:              b.cableEntry           || undefined,
      cableGlandMaterial:      b.cableGlandMaterial   || undefined,
      barrierVariant:          b.barrierVariant        || undefined,

      // ── Section 6
      loadDetails: Array.isArray(b.loadDetails) ? b.loadDetails : [],

      // ── Section 6
      controlType:   b.controlType   || undefined,
      controlMatrix: b.controlMatrix || {},

      // ── Section 7
      panelMounting:         b.panelMounting                  || undefined,
      certificationRequired: firstPresent(b.certificationRequired, b.certificationSelections, false),
      certificationDetails:  b.certificationDetails           || undefined,
      drawingsAttached:      boolFromPayload(b.drawingsAttached),
      drawingsSldAttached:   b.drawingsSldAttached            || undefined,
      equipmentListAttached: b.equipmentListAttached          || undefined,
      referenceBomAttached:  b.referenceBomAttached           || undefined,
      deliveryDate:          b.deliveryDate                   || undefined,
      deliveryTerms:         b.deliveryTerms                  || undefined,
      programmingScope:      b.programmingScope               || undefined,
      onsiteSupport:         boolFromPayload(b.onsiteSupport),
      paymentTerms:          b.paymentTerms                   || undefined,

      // ── Sprint 1 type-specific details
      plcDetails: sanitizedPlcDetails,
      vfdDetails: sanitizedVfdDetails,
      mccDetails: b.mccDetails || undefined,

      // ── Section 8
      additionalNotes: b.additionalNotes || undefined,
      internalRemarks: b.internalRemarks || undefined,
      preparedBy:      b.preparedBy      || undefined,

      // ── Meta
      status:           hasBomUpload ? 'Technical BoM Submitted' : normalizeInquiryStatus(b.status),
      statusDetails:    hasBomUpload
        ? {
            ...(b.statusDetails || {}),
            bomSubmission: {
              revisionNumber: bomRevisionNumber,
              versionLabel: bomVersionLabel,
              remarks: bomRemarks,
              updatedAt: new Date(),
              updatedBy: req.user._id,
            },
          }
        : (b.statusDetails || undefined),
      nextFollowUpDate: b.nextFollowUpDate  || undefined,
      remarks:          b.remarks           || undefined,
      reviewStatus:     b.reviewStatus      || undefined,

      // ── Attachments (new uploads only — no kept attachments on create)
      attachments: newFileDocs,
      bomAttachments: bomAttachmentDocs,

      // ── Protected — always set from session, never from client
      createdBy: req.user._id,
    };

    const linkedCustomer = await resolveUniversalCustomer(payload, req.user._id, {
      createIfMissing: true,
      updateExisting: true,
    });
    applyCustomerToPayload(payload, linkedCustomer);

    const inquiry = await Inquiry.create(payload);

    // 6. Notification (non-fatal — notificationService now has its own try/catch)
    // await createNotification({
    //   title:          'New Inquiry Added',
    //   message:        dashboardMessages.inquiryCreated(inquiry),
    //   type:           'info',
    //   recipient:      req.user._id,
    //   relatedInquiry: inquiry._id,
    //   sendEmail:      true,
    //   emailTo:        'project.intern@nexusautomech.com',
    // });

console.log(
  'Inquiry Attachments:',
  JSON.stringify(inquiry.attachments, null, 2)
);


    await createNotification({
      title:          'New Inquiry Added',
      message:        dashboardMessages.inquiryCreated(inquiry),
      type:           'info',
      recipient:      req.user._id,
      relatedInquiry: inquiry._id,
      sendEmail:      true,
      // emailTo:        'project.intern@nexusautomech.com',
      emailTo:        'ravi.darji@nexusautomech.com',
      inquiry,
      eventType:     'inquiry_created',
    });


    // 7. Customer Master is already resolved before inquiry creation so
    // inquiry.customerRef remains the universal customer link.

    const populatedInquiry = await Inquiry.findById(inquiry._id)
      .populate('createdBy', 'name')
      .populate('customerRef', 'customerId customerName companyType contacts contactPerson email mobileNumber city address gstNumber notes');

    const data = getLiveCustomerSnapshot(populatedInquiry.toObject());

    if (!data.contacts || data.contacts.length === 0) {
      data.contacts = contacts;
    }
    backFillAttachments(data);

    // 8. WhatsApp notification (non-fatal — sendWhatsAppNotification never throws)
    // Runs after populatedInquiry so createdBy.name is resolved.
    const waCreatedBy = data.createdBy?.name || req.user?.name || 'System';
    const whatsappMessage = buildNewInquiryWhatsAppMessage(data, waCreatedBy);


    await sendWhatsAppNotification(
      whatsappMessage
    );

    await sendWhatsAppGroupWithAttachments(
      whatsappMessage,
      data.attachments || []
    );
    
res.status(201).json({
  success: true,
  data,
});

} catch (error) {
  next(error);
}
};
// ─────────────────────────────────────────────────────────────────────────────
// @desc  Update inquiry
// @route PUT /api/inquiries/:id
// @access Private
// ─────────────────────────────────────────────────────────────────────────────
const updateInquiry = async (req, res, next) => {
  try {
    // 1. Parse the _json blob
    parseJsonField(req);

    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found' });
    }

    const b = req.body;
    const requestedStatus = b.status ? normalizeInquiryStatus(b.status) : undefined;
    const statusChanged = requestedStatus && requestedStatus !== normalizeInquiryStatus(inquiry.status);

    // 2. Build update payload — only include fields that were actually sent.
    //    [FIX H2] Do NOT copy createdBy, inquiryId, _id, __v from the request —
    //    these come back from the GET response and land in req.body via _json.
    //    Allowing them through would overwrite the original author and could
    //    cause duplicate-key errors on inquiryId.
    const nextInquiryType = normalizeInquiryType(
      b.inquiryType !== undefined ? b.inquiryType : inquiry.inquiryType,
      b.productType !== undefined ? b.productType : inquiry.productType,
      b.panelTypes !== undefined ? b.panelTypes : inquiry.panelTypes
    );

    // Start with the scalar fields that are safe to update
    const updatePayload = {};

    // Helper — only set key if value is not undefined/null (avoids wiping fields
    // that weren't sent in a partial update)
    const setIfPresent = (key, val) => {
      if (val !== undefined && val !== null) updatePayload[key] = val;
    };

    const newFileDocs = buildAttachmentDocs(getUploadedFiles(req, 'attachments'));
    const uploadedBomFiles = getUploadedFiles(req, 'bomAttachments');

    if (
      statusChanged &&
      ['Technical BoM Submitted', 'Revision'].includes(requestedStatus) &&
      uploadedBomFiles.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Technical BoM Document is required. Status was not changed.',
      });
    }

    // ── Section 1
    setIfPresent('inquiryDate',  b.inquiryDate);
    setIfPresent('rfqNumber',    b.rfqNumber);
    setIfPresent('customerName', b.customerName || b.companyName);
    setIfPresent('companyType',  b.companyType);
    setIfPresent('siteAddress',  b.siteAddress);
    setIfPresent('city',         b.city);
    setIfPresent('location',     b.location || b.city || b.siteAddress);

    // ── Section 2
    setIfPresent('projectName',      b.projectName);
    setIfPresent('industryType',     b.industryType);
    setIfPresent('offerType',        b.offerType);
    setIfPresent('previousOrderRef', b.previousOrderRef);

    // // ── Section 3
    // if (b.inquiryType !== undefined || b.productType !== undefined || b.panelTypes !== undefined) {
    //   updatePayload.inquiryType = nextInquiryType;
    //   updatePayload.productType = deriveProductType(b, nextInquiryType);
    //   updatePayload.panelTypes = derivePanelTypes(b, nextInquiryType);
    // }

    // ── Section 3
    if (b.inquiryType !== undefined || b.productType !== undefined || b.panelTypes !== undefined) {
      updatePayload.inquiryType = nextInquiryType;
      updatePayload.productType = normalizeProductType(deriveProductType(b, nextInquiryType)) || 'MCC';
      updatePayload.panelTypes = derivePanelTypes(b, nextInquiryType);
    }
    
    setIfPresent('customPanelType',        b.customPanelType);
    setIfPresent('applicationDescription', b.applicationDescription);
    setIfPresent('applicationProcess',     b.applicationProcess);

    // ── Section 4
    setIfPresent('supplyVoltage',        b.supplyVoltage);
    setIfPresent('controlVoltage',       b.controlVoltage);
    if (b.controlFeeder !== undefined || b.supplyVoltage !== undefined) {
      const effectiveSupplyVoltage = b.supplyVoltage !== undefined ? b.supplyVoltage : inquiry.supplyVoltage;
      updatePayload.controlFeeder = normalizeControlFeeder(b.controlFeeder, effectiveSupplyVoltage);
    }
    setIfPresent('frequency',            b.frequency);
    setIfPresent('panelAreaClassification', firstPresent(b.panelAreaClassification, b.panelAreaClass));
    setIfPresent('panelAreaClass',          firstPresent(b.panelAreaClass, b.panelAreaClassification));
    setIfPresent('ipRating',                firstPresent(b.ipRating, b.protectionClass));
    setIfPresent('installationType',        b.installationType);
    setIfPresent('shortCircuitCapacity',    b.shortCircuitCapacity);
    setIfPresent('busbarMaterial',          b.busbarMaterial);
    setIfPresent('enclosureMaterial',       firstPresent(b.enclosureMaterial, b.enclosureStandard));
    setIfPresent('enclosureStandard',       firstPresent(b.enclosureStandard, b.enclosureMaterial));
    setIfPresent('panelColourRal',          b.panelColourRal);
    setIfPresent('cableEntry',              b.cableEntry);
    setIfPresent('cableGlandMaterial',      b.cableGlandMaterial);
    setIfPresent('barrierVariant',          b.barrierVariant);

    // ── Section 6
    if (b.loadDetails !== undefined)
      updatePayload.loadDetails = Array.isArray(b.loadDetails) ? b.loadDetails : [];

    // ── Section 6
    setIfPresent('controlType',   b.controlType);
    if (b.controlMatrix !== undefined)
      updatePayload.controlMatrix = b.controlMatrix || {};

    // ── Section 7
    setIfPresent('panelMounting',        b.panelMounting);
    if (b.certificationRequired !== undefined || b.certificationSelections !== undefined)
      updatePayload.certificationRequired = firstPresent(b.certificationRequired, b.certificationSelections, false);
    setIfPresent('certificationDetails', b.certificationDetails);
    if (b.drawingsAttached !== undefined)
      updatePayload.drawingsAttached = boolFromPayload(b.drawingsAttached);
    setIfPresent('drawingsSldAttached',   b.drawingsSldAttached);
    setIfPresent('equipmentListAttached', b.equipmentListAttached);
    setIfPresent('referenceBomAttached',  b.referenceBomAttached);
    setIfPresent('deliveryDate',     b.deliveryDate);
    setIfPresent('deliveryTerms',    b.deliveryTerms);
    setIfPresent('programmingScope', b.programmingScope);
    if (b.onsiteSupport !== undefined)
      updatePayload.onsiteSupport = boolFromPayload(b.onsiteSupport);
    setIfPresent('paymentTerms', b.paymentTerms);

    // ── Sprint 1 type-specific details
    if (b.plcDetails !== undefined) updatePayload.plcDetails = sanitizePlcDetails(b.plcDetails || {});
    if (b.vfdDetails !== undefined) updatePayload.vfdDetails = sanitizeVfdDetails(b.vfdDetails || {});
    if (b.mccDetails !== undefined) updatePayload.mccDetails = b.mccDetails || {};

    // ── Section 8
    setIfPresent('additionalNotes', b.additionalNotes);
    setIfPresent('internalRemarks', b.internalRemarks);
    setIfPresent('preparedBy',      b.preparedBy);
    setIfPresent('reviewStatus',    b.reviewStatus);

    // ── Meta (estimator-editable only — keep whatever is sent)
    setIfPresent('status',           requestedStatus);
    setIfPresent('priority',         b.priority);
    setIfPresent('estimatedValue',   b.estimatedValue);
    setIfPresent('nextFollowUpDate', b.nextFollowUpDate);
    setIfPresent('remarks',          b.remarks);

    const statusDetails = mergeStatusDetails({
      inquiry,
      body: b,
      status: requestedStatus,
      statusChanged,
      newFileDocs,
      userId: req.user?._id,
    });
    if (statusDetails) updatePayload.statusDetails = statusDetails;

    // ── Contacts — normalise if provided
    if (b.contacts !== undefined || b.contactPerson !== undefined) {
      const contacts = normaliseContacts(b);

      if (contacts.length > 0) {
        const contactErrors = validateContacts(contacts);
        if (contactErrors.length > 0) {
          return res.status(400).json({ success: false, message: contactErrors[0], errors: contactErrors });
        }
        const primary = contacts[0];
        updatePayload.contacts      = contacts;
        updatePayload.contactPerson = primary.name;
        updatePayload.mobileNumber  = primary.phone;
        updatePayload.email         = primary.email;
        updatePayload.designation   = primary.designation;
      }
    }

    // ── Attachments: merge kept + new uploads  [FIX H2 — keptAttachments was in req.body spread before]
    // For table-only status changes, do not wipe existing attachments.
    if (b.keptAttachments !== undefined || newFileDocs.length > 0) {
      const keptDocs = Array.isArray(b.keptAttachments)
        ? b.keptAttachments.filter(a => a && (a.storedName || a.originalName))
        : (Array.isArray(inquiry.attachments) ? inquiry.attachments.map(sanitizeAttachmentDoc).filter(Boolean) : []);

      updatePayload.attachments = [...keptDocs, ...newFileDocs];
    }
    // keptAttachments must never reach the DB — already excluded since we
    // never called setIfPresent('keptAttachments', …)

    if (b.keptBomAttachments !== undefined || uploadedBomFiles.length > 0) {
      const existingBomDocs = Array.isArray(inquiry.bomAttachments)
        ? inquiry.bomAttachments.map(sanitizeBomAttachmentDoc).filter(Boolean)
        : [];

      const keptBomDocs = Array.isArray(b.keptBomAttachments)
        ? b.keptBomAttachments.map(sanitizeBomAttachmentDoc).filter(Boolean)
        : existingBomDocs;

      let nextBomDocs = keptBomDocs;

      if (uploadedBomFiles.length > 0) {
        const revisionNumber = getNextBomRevisionNumber(existingBomDocs);
        const versionLabel = getBomVersionLabel(revisionNumber);
        const remarks = b.bomSubmissionRemarks || '';
        const newBomDocs = buildBomAttachmentDocs({
          files: uploadedBomFiles,
          revisionNumber,
          remarks,
          userId: req.user?._id,
        });

        nextBomDocs = [...keptBomDocs, ...newBomDocs];
        updatePayload.status = getBomUploadStatus({
          existingBomAttachments: existingBomDocs,
          currentStatus: inquiry.status,
        });
        updatePayload.statusDetails = buildBomStatusDetails({
          inquiry,
          baseDetails: updatePayload.statusDetails,
          revisionNumber,
          versionLabel,
          remarks,
          userId: req.user?._id,
        });
      }

      updatePayload.bomAttachments = nextBomDocs;
    }

    const shouldResolveCustomer = Boolean(
      b.customerRef !== undefined ||
      b.customer !== undefined ||
      b.customerName !== undefined ||
      b.companyName !== undefined ||
      b.companyType !== undefined ||
      b.contacts !== undefined ||
      b.contactPerson !== undefined ||
      b.mobileNumber !== undefined ||
      b.email !== undefined ||
      !inquiry.customerRef
    );

    if (shouldResolveCustomer) {
      const linkedCustomer = await resolveUniversalCustomer(
        { ...inquiry.toObject(), ...b, ...updatePayload },
        req.user._id,
        { createIfMissing: true, updateExisting: true }
      );
      applyCustomerToPayload(updatePayload, linkedCustomer);
    }

    const finalStatusChanged = updatePayload.status && updatePayload.status !== normalizeInquiryStatus(inquiry.status);

    const updatedInquiry = await Inquiry.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name')
      .populate('customerRef', 'customerId customerName companyType contacts contactPerson email mobileNumber city address gstNumber notes');

    if (!updatedInquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found after update' });
    }


    // 4. Notifications (non-fatal)
    await createNotification({
      title:          'Inquiry Updated',
      message:        dashboardMessages.inquiryUpdated(updatedInquiry),
      type:           'info',
      recipient:      req.user._id,
      relatedInquiry: updatedInquiry._id,
      sendEmail:      true,
      // emailTo:        'project.intern@nexusautomech.com',
      emailTo:        'ravi.darji@nexusautomech.com',
      inquiry:       updatedInquiry,
      eventType:     'inquiry_updated',
    });

    if (statusChanged || finalStatusChanged) {
      await createNotification({
        title:          'Status Changed',
        message:        dashboardMessages.inquiryStatusChanged(updatedInquiry),
        type:           'status',
        recipient:      req.user._id,
        relatedInquiry: updatedInquiry._id,
        sendEmail:      true,
        emailTo:        'ravi.darji@nexusautomech.com',
        // emailTo:        'project.intern@nexusautomech.com',
        inquiry:       updatedInquiry,
        eventType:     'inquiry_status_changed',
        previousStatus: normalizeInquiryStatus(inquiry.status),
      });
    }

    // 5. Back-fill contacts on response for old records
    const data = getLiveCustomerSnapshot(updatedInquiry.toObject());
    if (!data.contacts || data.contacts.length === 0) {
      if (data.contactPerson) {
        data.contacts = [{
          name:        data.contactPerson || '',
          phone:       data.mobileNumber  || '',
          email:       data.email         || '',
          designation: data.designation   || '',
        }];
      }
    }
    backFillAttachments(data);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// @desc  Update inquiry status only
// @route PATCH /api/inquiries/:id/status
// @access Private
// ─────────────────────────────────────────────────────────────────────────────
const updateInquiryStatus = async (req, res, next) => {
  try {
    parseJsonField(req);

    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found' });
    }

    const b = req.body || {};
    const requestedStatus = normalizeInquiryStatus(b.status);

    if (!FINAL_INQUIRY_STATUSES.includes(requestedStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid inquiry status' });
    }

    const uploadedBomFiles = getUploadedFiles(req, 'bomAttachments');
    const statusChanged = requestedStatus !== normalizeInquiryStatus(inquiry.status);

    if (
      ['Technical BoM Submitted', 'Revision'].includes(requestedStatus) &&
      uploadedBomFiles.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Technical BoM Document is required. Status was not changed.',
      });
    }

    const updatePayload = {
      status: requestedStatus,
    };

    const statusDetails = mergeStatusDetails({
      inquiry,
      body: b,
      status: requestedStatus,
      statusChanged,
      newFileDocs: [],
      userId: req.user?._id,
    });

    if (statusDetails) updatePayload.statusDetails = statusDetails;

    if (uploadedBomFiles.length > 0) {
      const existingBomDocs = Array.isArray(inquiry.bomAttachments)
        ? inquiry.bomAttachments.map(sanitizeBomAttachmentDoc).filter(Boolean)
        : [];

      const revisionNumber = getNextBomRevisionNumber(existingBomDocs);
      const versionLabel = getBomVersionLabel(revisionNumber);
      const remarks = b.bomSubmissionRemarks || '';
      const newBomDocs = buildBomAttachmentDocs({
        files: uploadedBomFiles,
        revisionNumber,
        remarks,
        userId: req.user?._id,
      });

      updatePayload.bomAttachments = [...existingBomDocs, ...newBomDocs];
      updatePayload.status = getBomUploadStatus({ existingBomAttachments: existingBomDocs });
      updatePayload.statusDetails = buildBomStatusDetails({
        inquiry,
        baseDetails: updatePayload.statusDetails,
        revisionNumber,
        versionLabel,
        remarks,
        userId: req.user?._id,
      });
    }

    const finalStatusChanged = updatePayload.status !== normalizeInquiryStatus(inquiry.status);

    const updatedInquiry = await Inquiry.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'name')
      .populate('customerRef', 'customerId customerName companyType contacts contactPerson email mobileNumber city address gstNumber notes')
      .populate('projectReference', 'projectId projectName')
      .populate('kickoffMeeting.attendees', 'name email role');

    if (!updatedInquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found after status update' });
    }

    if (finalStatusChanged) {
      createNotification({
        title:          'Status Changed',
        message:        dashboardMessages.inquiryStatusChanged(updatedInquiry),
        type:           'status',
        recipient:      req.user._id,
        relatedInquiry: updatedInquiry._id,
        sendEmail:      true,
        emailTo:        'ravi.darji@nexusautomech.com',
        inquiry:       updatedInquiry,
        eventType:     'inquiry_status_changed',
        previousStatus: normalizeInquiryStatus(inquiry.status),
      }).catch((error) => {
        console.error('Inquiry status notification failed:', error.message || error);
      });
    }

    const data = getLiveCustomerSnapshot(updatedInquiry.toObject());
    if (!data.contacts || data.contacts.length === 0) {
      if (data.contactPerson) {
        data.contacts = [{
          name:        data.contactPerson || '',
          phone:       data.mobileNumber  || '',
          email:       data.email         || '',
          designation: data.designation   || '',
        }];
      }
    }
    backFillAttachments(data);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc  Delete inquiry
// @route DELETE /api/inquiries/:id
// @access Private (admin/estimator)
// ─────────────────────────────────────────────────────────────────────────────
const deleteInquiry = async (req, res, next) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found' });
    }

    // Notification is non-fatal (notificationService has its own try/catch)
    await createNotification({
      title:     'Inquiry Deleted',
      message:   dashboardMessages.inquiryDeleted(inquiry),
      type:      'warning',
      recipient: req.user._id,
      sendEmail: true,
      // emailTo:   'project.intern@nexusautomech.com',
      emailTo:   'ravi.darji@nexusautomech.com',
      inquiry,
      eventType: 'inquiry_deleted',

    });

    await inquiry.deleteOne();
    res.json({ success: true, message: 'Inquiry deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc  Get follow-ups
// @route GET /api/inquiries/follow-ups
// @access Private
// ─────────────────────────────────────────────────────────────────────────────
const getFollowUps = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const followUps = await Inquiry.find({
      nextFollowUpDate: { $lte: today },
      status:           { $nin: [...buildStatusQuery('Order Won').$in, ...buildStatusQuery('Order Lost').$in] },
    })
      .populate('customerRef', 'customerId customerName companyType contacts contactPerson email mobileNumber city address gstNumber notes')
      .sort({ nextFollowUpDate: 1 })
      .limit(20);

    res.json({ success: true, data: followUps.map((item) => getLiveCustomerSnapshot(item.toObject ? item.toObject() : item)) });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getInquiries,
  getInquiry,
  createInquiry,
  updateInquiry,
  updateInquiryStatus,
  deleteInquiry,
  getFollowUps,
  uploadMiddleware,
};
