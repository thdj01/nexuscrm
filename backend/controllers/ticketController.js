'use strict';

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const Ticket = require('../models/Ticket');
const TicketActivity = require('../models/TicketActivity');
const TicketComment = require('../models/TicketComment');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Project = require('../models/Project');
const Inquiry = require('../models/Inquiry');
const Department = require('../models/Department');
const { dispatchNotificationsToUsers } = require('../services/userNotificationDispatchService');
const {
  combineUsers,
  getAdminUsers,
  getDepartmentLeadershipUsers,
} = require('../services/notificationRecipientService');
const {
  buildTicketCreatedWhatsAppMessage,
  buildTicketAssignedWhatsAppMessage,
  buildTicketEmailHtml,
} = require('../services/notificationTemplates');

const ok = (res, data, statusCode = 200) =>
  res.status(statusCode).json({ success: true, ...data });

const fail = (res, message, statusCode = 400) =>
  res.status(statusCode).json({ success: false, message });

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const normalizeRole = (role = '') =>
  String(role).trim().toLowerCase().replace(/\s+/g, '_');

const TICKET_MANAGER_ROLES = Object.freeze(['admin', 'hod', 'manager', 'team_lead']);
const TICKET_ASSIGNABLE_ROLES = Object.freeze(['employee']);

const isTicketManagerRole = (role = '') => TICKET_MANAGER_ROLES.includes(normalizeRole(role));

const canManageTickets = (req) => isTicketManagerRole(req.user?.role);

const canCreateTicket = canManageTickets;
const canAssignTicket = canManageTickets;

const isAssignableTicketUser = (user) => TICKET_ASSIGNABLE_ROLES.includes(normalizeRole(user?.role));

const isAssignedEmployee = (req, ticket) => {
  if (!ticket?.assignedTo || !req.user?._id) return false;
  return ticket.assignedTo.toString() === req.user._id.toString();
};

// Move To Working: ticket managers or the assigned employee
const canStartWork = (req, ticket) => canManageTickets(req) || isAssignedEmployee(req, ticket);

// Customer Side Pending: ticket managers or the assigned employee
const canSetCustomerPending = (req, ticket) => canManageTickets(req) || isAssignedEmployee(req, ticket);

// Close Ticket: ticket managers or the assigned employee
const canCloseTicket = (req, ticket) => canManageTickets(req) || isAssignedEmployee(req, ticket);

// Reopen Ticket: ticket managers only
const canReopenTicket = canManageTickets;

// Void Ticket: ticket managers only
const canVoidTicket = canManageTickets;

// Add Comment / Upload Attachment: Everyone (any authenticated user)
const canAddComment = (_req) => true;
const canUploadAttachment = (_req) => true;

// Comment edit/delete: original author, or anyone who can manage tickets
const canModifyComment = (req, comment) => {
  if (canManageTickets(req)) return true;
  return comment.author?.toString?.() === req.user._id.toString();
};

// Attachment delete: uploader, or anyone who can manage tickets
const canDeleteAttachment = (req, attachment) => {
  if (canManageTickets(req)) return true;
  return attachment.uploadedBy?.toString?.() === req.user._id.toString();
};

const TICKET_POPULATE = [
  {
    path: 'customer',
    select: 'customerId customerName companyType contacts contactPerson email mobileNumber city address gstNumber notes',
  },
  {
    path: 'project',
    select: 'projectId projectName projectStatus quantity selectedDepartments panelSelections',
  },
  {
    path: 'inquiry',
    select: 'inquiryId customerName projectName status',
  },
  {
    path: 'assignedTo',
    select: 'name email phone mobileNumber whatsappNumber mobile avatar role teamId department hodDepartments',
  },
  {
    path: 'assignedBy',
    select: 'name email role',
  },
  {
    path: 'createdBy',
    select: 'name email role',
  },
  {
    path: 'updatedBy',
    select: 'name email role',
  },
];

const PROTECTED_UPDATE_FIELDS = [
  '_id',
  '__v',
  'ticketId',
  'status',
  'assignedTo',
  'assignedBy',
  'assignedAt',
  'createdBy',
  'createdAt',
  'closedBy',
  'closedAt',
  'reopenedBy',
  'reopenedAt',
  'voidedBy',
  'voidedAt',
  'attachments',
];

const ALLOWED_UPDATE_FIELDS = [
  'title',
  'description',
  'additionalDescription',
  'ticketType',
  'priority',
  'source',
  'supportType',
  'department',
  'contactPerson',
  'contactNumber',
  'customer',
  'project',
  'inquiry',
  'product',
  'repairReplacement',
  'resolution',
  'voidReason',
  'isActive',
];

const buildTicketPayload = (body) => {
  const payload = {};

  ALLOWED_UPDATE_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      payload[field] = body[field];
    }
  });

  PROTECTED_UPDATE_FIELDS.forEach((field) => {
    delete payload[field];
  });

  return payload;
};

const validateOptionalObjectId = (value, label) => {
  if (value === undefined || value === null || value === '') return null;
  if (!isValidId(value)) return `${label} is invalid`;
  return null;
};

const normalizeMultiValue = (value) => {
  if (value === undefined || value === null || value === '') return [];

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(','))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const applyMultiFilter = (filter, field, value) => {
  const values = normalizeMultiValue(value);
  if (!values.length) return;
  filter[field] = values.length === 1 ? values[0] : { $in: values };
};

const buildStatusCounts = async (baseFilter) => {
  const rows = await Ticket.aggregate([
    { $match: baseFilter },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const statusCounts = {
    Total: 0,
    New: 0,
    Assigned: 0,
    Working: 0,
    'Customer Side Pending': 0,
    Closed: 0,
    Void: 0,
  };

  rows.forEach((row) => {
    if (row?._id && Object.prototype.hasOwnProperty.call(statusCounts, row._id)) {
      statusCounts[row._id] = row.count;
    }
    statusCounts.Total += row.count || 0;
  });

  return statusCounts;
};

const normalizeDepartmentInput = (value) => String(value || '').trim();

const resolveTicketDepartment = async (value) => {
  const departmentValue = normalizeDepartmentInput(value);

  if (!departmentValue) {
    return { error: 'Department is required' };
  }

  const activeDepartmentCount = await Department.countDocuments({ isActive: true });

  // Do not block older deployments where Department Master has not been seeded yet.
  if (activeDepartmentCount === 0) {
    return { value: departmentValue };
  }

  const normalizedUpper = departmentValue.toUpperCase();
  const lookup = [
    { name: normalizedUpper },
    { code: normalizedUpper },
  ];

  if (isValidId(departmentValue)) {
    lookup.push({ _id: departmentValue });
  }

  const department = await Department.findOne({
    isActive: true,
    $or: lookup,
  }).select('name').lean();

  if (!department) {
    return { error: 'Department must be selected from Department Master' };
  }

  return { value: department.name };
};

const syncTicketCustomerContact = async (customerId, payload = {}) => {
  if (!customerId || !isValidId(customerId)) return;

  const existing = await Customer.findById(customerId).select('contacts contactPerson mobileNumber email').lean();
  if (!existing) return;

  const contactPerson = String(payload.contactPerson || existing.contactPerson || '').trim();
  const contactNumber = String(payload.contactNumber || existing.mobileNumber || '').trim();

  const update = {};
  if (Object.prototype.hasOwnProperty.call(payload, 'contactPerson')) update.contactPerson = contactPerson;
  if (Object.prototype.hasOwnProperty.call(payload, 'contactNumber')) update.mobileNumber = contactNumber;

  if (contactPerson || contactNumber || existing.email) {
    const contacts = Array.isArray(existing.contacts) && existing.contacts.length
      ? [...existing.contacts]
      : [{ name: '', phone: '', email: existing.email || '', designation: '' }];

    contacts[0] = {
      ...contacts[0],
      name: contactPerson || contacts[0].name || '',
      phone: contactNumber || contacts[0].phone || '',
      email: contacts[0].email || existing.email || '',
    };
    update.contacts = contacts;
  }

  if (Object.keys(update).length > 0) {
    await Customer.findByIdAndUpdate(customerId, { $set: update }, { new: false });
  }
};

const validateReferences = async ({ customer, project, inquiry }) => {
  if (!customer) return 'Customer is required';
  if (!isValidId(customer)) return 'Customer is invalid';

  const customerExists = await Customer.exists({
    _id: customer,
    isActive: { $ne: false },
  });

  if (!customerExists) return 'Customer not found';

  if (project) {
    if (!isValidId(project)) return 'Project is invalid';

    const projectExists = await Project.exists({ _id: project });
    if (!projectExists) return 'Project not found';
  }

  if (inquiry) {
    if (!isValidId(inquiry)) return 'Inquiry is invalid';

    const inquiryExists = await Inquiry.exists({ _id: inquiry });
    if (!inquiryExists) return 'Inquiry not found';
  }

  return null;
};

const logTicketActivity = async ({
  ticket,
  user,
  actionType,
  fieldChanged = '',
  oldValue = '',
  newValue = '',
  description = '',
  metadata = {},
}) => {
  try {
    await TicketActivity.create({
      ticket: ticket._id,
      ticketId: ticket.ticketId,
      userId: user?._id ?? null,
      userName: user?.name || 'System',
      actionType,
      fieldChanged,
      oldValue: oldValue === undefined || oldValue === null ? '' : String(oldValue),
      newValue: newValue === undefined || newValue === null ? '' : String(newValue),
      description,
      metadata,
    });
  } catch (err) {
    console.error('logTicketActivity:', err.message);
  }
};

const populateTicket = async (ticket) => {
  await ticket.populate(TICKET_POPULATE);
  return ticket;
};

// ─────────────────────────────────────────────────────────────────────────────
// Attachment upload — multer (disk storage under uploads/tickets/)
// Reuses the same pattern as inquiryController's uploadMiddleware.
// ─────────────────────────────────────────────────────────────────────────────

const TICKET_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'tickets');
if (!fs.existsSync(TICKET_UPLOAD_DIR)) fs.mkdirSync(TICKET_UPLOAD_DIR, { recursive: true });

const TICKET_ATTACHMENT_ALLOWED_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/zip', 'application/x-zip-compressed',
];

const ticketAttachmentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TICKET_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safe);
  },
});

const ticketAttachmentFileFilter = (_req, file, cb) => {
  cb(null, TICKET_ATTACHMENT_ALLOWED_MIME.includes(file.mimetype));
};

// Exported so ticketRoutes can apply it as route middleware
const ticketAttachmentUpload = multer({
  storage: ticketAttachmentStorage,
  fileFilter: ticketAttachmentFileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB per file
}).array('attachments', 10); // field name: 'attachments', max 10 files

const buildTicketAttachmentDocs = (files = [], uploadedBy) =>
  files.map((f) => ({
    name: f.originalname,
    storedName: f.filename,
    storagePath: path.join('tickets', f.filename).replace(/\\/g, '/'),
    mimeType: f.mimetype,
    sizeBytes: f.size,
    uploadedBy,
    uploadedAt: new Date(),
  }));

// ─────────────────────────────────────────────────────────────────────────────
// Ticket Comments — populate option
// ─────────────────────────────────────────────────────────────────────────────

const COMMENT_POPULATE = { path: 'author', select: 'name email avatar role' };

async function getTicketCreatorNotificationUser(ticket = {}) {
  const creatorId = ticket.createdBy?._id || ticket.createdBy;
  if (!creatorId || !isValidId(creatorId)) return null;

  return User.findOne({ _id: creatorId, isActive: { $ne: false } })
    .select('_id name email phone mobileNumber whatsappNumber mobile role department hodDepartments teamId')
    .lean();
}

async function notifyTicketCreated(ticket, actor = {}) {
  const [admins, departmentLeadership, creator] = await Promise.all([
    getAdminUsers(),
    getDepartmentLeadershipUsers([ticket.department]),
    getTicketCreatorNotificationUser(ticket),
  ]);
  const recipients = combineUsers(
    admins,
    departmentLeadership,
    creator ? [creator] : []
  );
  const createdMessage = buildTicketCreatedWhatsAppMessage(ticket);

  await dispatchNotificationsToUsers({
    users: recipients,
    title: `New Ticket Created - ${ticket.ticketId || 'Ticket'}`,
    message: `${actor?.name || 'A user'} created ticket ${ticket.ticketId || '-'} - ${ticket.title || '-'}.`,
    type: 'ticket_created',
    priority: ticket.priority === 'Critical' ? 'High' : 'Medium',
    relatedTicket: ticket._id,
    relatedInquiry: ticket.inquiry?._id || ticket.inquiry || null,
    relatedProject: ticket.project?._id || ticket.project || null,
    emailSubject: `New Ticket Created - ${ticket.ticketId || 'Ticket'}`,
    emailHtml: (user) => buildTicketEmailHtml(ticket, {
      userName: user?.name || 'Team Member',
      eventType: 'ticket_created',
    }),
    whatsappMessage: createdMessage,
  });
}

async function notifyTicketAssigned(ticket, actor = {}) {
  const assignee = ticket.assignedTo && typeof ticket.assignedTo === 'object'
    ? ticket.assignedTo
    : null;
  if (!assignee?._id) return;

  const [admins, departmentLeadership, creator] = await Promise.all([
    getAdminUsers(),
    getDepartmentLeadershipUsers([ticket.department, assignee.department]),
    getTicketCreatorNotificationUser(ticket),
  ]);
  const recipients = combineUsers(
    [assignee],
    admins,
    departmentLeadership,
    creator ? [creator] : []
  );
  const assigneeId = String(assignee._id);

  await dispatchNotificationsToUsers({
    users: recipients,
    title: (user) => String(user?._id) === assigneeId
      ? `Ticket Assigned - ${ticket.ticketId || 'Ticket'}`
      : `Ticket Assignment Updated - ${ticket.ticketId || 'Ticket'}`,
    message: (user) => String(user?._id) === assigneeId
      ? `${actor?.name || 'A user'} assigned ticket ${ticket.ticketId || '-'} - ${ticket.title || '-'} to you.`
      : `${actor?.name || 'A user'} assigned ticket ${ticket.ticketId || '-'} - ${ticket.title || '-'} to ${assignee.name || 'an employee'}.`,
    type: 'ticket_assigned',
    priority: ticket.priority === 'Critical' ? 'High' : 'Medium',
    relatedTicket: ticket._id,
    relatedInquiry: ticket.inquiry?._id || ticket.inquiry || null,
    relatedProject: ticket.project?._id || ticket.project || null,
    emailSubject: (user) => String(user?._id) === assigneeId
      ? `Ticket Assigned - ${ticket.ticketId || 'Ticket'}`
      : `Ticket Assignment Updated - ${ticket.ticketId || 'Ticket'}`,
    emailHtml: (user) => {
      const isAssignee = String(user?._id) === assigneeId;
      return buildTicketEmailHtml(ticket, {
        userName: user?.name || 'Team Member',
        eventType: 'ticket_assigned',
        isAssignee,
        assignedToName: assignee.name || 'an employee',
      });
    },
    whatsappMessage: (user) => String(user?._id) === assigneeId
      ? buildTicketAssignedWhatsAppMessage(ticket, assignee.name)
      : buildTicketCreatedWhatsAppMessage(ticket),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tickets
// ─────────────────────────────────────────────────────────────────────────────

const createTicket = async (req, res) => {
  try {
    if (!canCreateTicket(req)) {
      return fail(res, 'Forbidden: insufficient permission to create ticket', 403);
    }

    const {
      title,
      ticketType,
      customer,
      project,
      inquiry,
      assignedTo,
      product,
    } = req.body;

    if (!title?.trim()) return fail(res, 'Ticket title is required');
    if (!ticketType) return fail(res, 'Ticket type is required');
    if (!customer) return fail(res, 'Customer is required');
    if (!product) return fail(res, 'Product details are required');

    const referenceError = await validateReferences({ customer, project, inquiry });
    if (referenceError) return fail(res, referenceError);

    const departmentResult = await resolveTicketDepartment(req.body.department);
    if (departmentResult.error) return fail(res, departmentResult.error);

    const payload = {
      title: req.body.title,
      description: req.body.description,
      additionalDescription: req.body.additionalDescription,
      ticketType: req.body.ticketType,
      priority: req.body.priority,
      source: req.body.source,
      supportType: req.body.supportType,
      department: departmentResult.value,
      contactPerson: req.body.contactPerson,
      contactNumber: req.body.contactNumber,
      customer: req.body.customer,
      project: req.body.project || null,
      inquiry: req.body.inquiry || null,
      product: req.body.product,
      repairReplacement: req.body.repairReplacement,
      resolution: req.body.resolution,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    };

    if (assignedTo) {
      if (!isValidId(assignedTo)) return fail(res, 'Assigned employee is invalid');

      const assignee = await User.findOne({
        _id: assignedTo,
        isActive: true,
      }).lean();

      if (!assignee) return fail(res, 'Assigned employee not found');
      if (!isAssignableTicketUser(assignee)) {
        return fail(res, 'Ticket can only be assigned to an active employee');
      }

      payload.assignedTo = assignedTo;
      payload.assignedBy = req.user._id;
      payload.assignedAt = new Date();
      payload.status = 'Assigned';
    }

    await syncTicketCustomerContact(payload.customer, payload);

    const ticket = await Ticket.create(payload);
    await populateTicket(ticket);

    await logTicketActivity({
      ticket,
      user: req.user,
      actionType: 'created',
      description: `Ticket ${ticket.ticketId} created`,
    });

    if (assignedTo) {
      await logTicketActivity({
        ticket,
        user: req.user,
        actionType: 'assigned',
        fieldChanged: 'Assigned Engineer',
        oldValue: '',
        newValue: ticket.assignedTo?.name || assignedTo,
        description: `Ticket ${ticket.ticketId} assigned`,
      });
    }

    ok(res, { ticket }, 201);

    const actor = { _id: req.user._id, name: req.user.name };
    setImmediate(async () => {
      try {
        await notifyTicketCreated(ticket, actor);
        if (ticket.assignedTo?._id) await notifyTicketAssigned(ticket, actor);
      } catch (notificationError) {
        console.error('[ticketController] Ticket creation notification failed:', notificationError?.message || notificationError);
      }
    });
    return;
  } catch (err) {
    console.error('createTicket:', err);

    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return fail(res, message);
    }

    if (err.code === 11000) {
      return fail(res, 'Duplicate ticket ID generated. Please try again.', 409);
    }

    return fail(res, 'Server error creating ticket', 500);
  }
};


const padYearSuffix = (year) => String(year % 100).padStart(2, '0');

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

const applyFinancialYearFilter = (filter, financialYear) => {
  const createdAt = getFinancialYearDateFilter(financialYear);
  if (createdAt) filter.createdAt = createdAt;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tickets
// ─────────────────────────────────────────────────────────────────────────────

const getTickets = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      ticketType,
      source,
      supportType,
      department,
      customer,
      project,
      inquiry,
      assignedTo,
      from,
      to,
      search,
      isActive,
      financialYear,
    } = req.query;

    const currentPage = Math.max(1, Number(page) || 1);
    const lim = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (currentPage - 1) * lim;

    const filter = {};
    applyFinancialYearFilter(filter, financialYear);

    applyMultiFilter(filter, 'status', status);
    applyMultiFilter(filter, 'priority', priority);
    applyMultiFilter(filter, 'ticketType', ticketType);
    applyMultiFilter(filter, 'source', source);
    applyMultiFilter(filter, 'supportType', supportType);
    applyMultiFilter(filter, 'department', department);

    if (isActive !== undefined) {
      filter.isActive = isActive === true || isActive === 'true';
    } else {
      filter.isActive = true;
    }

    const customerIdError = validateOptionalObjectId(customer, 'Customer');
    if (customerIdError) return fail(res, customerIdError);
    if (customer) filter.customer = customer;

    const projectIdError = validateOptionalObjectId(project, 'Project');
    if (projectIdError) return fail(res, projectIdError);
    if (project) filter.project = project;

    const inquiryIdError = validateOptionalObjectId(inquiry, 'Inquiry');
    if (inquiryIdError) return fail(res, inquiryIdError);
    if (inquiry) filter.inquiry = inquiry;

    const assignedToValues = normalizeMultiValue(assignedTo);
    for (const assignedToId of assignedToValues) {
      const assignedToIdError = validateOptionalObjectId(assignedToId, 'Assigned employee');
      if (assignedToIdError) return fail(res, assignedToIdError);
    }
    if (assignedToValues.length === 1) {
      filter.assignedTo = assignedToValues[0];
    } else if (assignedToValues.length > 1) {
      filter.assignedTo = { $in: assignedToValues };
    }

    if (from || to) {
      filter.createdAt = { ...(filter.createdAt || {}) };

      if (from) {
        const fromDate = new Date(from);
        if (Number.isNaN(fromDate.getTime())) return fail(res, 'From date is invalid');
        fromDate.setUTCHours(0, 0, 0, 0);
        filter.createdAt.$gte = fromDate;
      }

      if (to) {
        const toDate = new Date(to);
        if (Number.isNaN(toDate.getTime())) return fail(res, 'To date is invalid');
        toDate.setUTCHours(23, 59, 59, 999);
        filter.createdAt.$lte = toDate;
      }
    }

    if (search?.trim()) {
      filter.$text = { $search: search.trim() };
    }

    const statusCountFilter = { ...filter };
    delete statusCountFilter.status;

    const [tickets, total, statusCounts] = await Promise.all([
      Ticket.find(filter)
        .populate(TICKET_POPULATE)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      Ticket.countDocuments(filter),
      buildStatusCounts(statusCountFilter),
    ]);

    return ok(res, {
      tickets,
      statusCounts,
      pagination: {
        total,
        page: currentPage,
        limit: lim,
        totalPages: Math.ceil(total / lim),
      },
    });
  } catch (err) {
    console.error('getTickets:', err);
    return fail(res, 'Server error fetching tickets', 500);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tickets/:id
// ─────────────────────────────────────────────────────────────────────────────

const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;

    const filter = isValidId(id)
      ? { _id: id }
      : { ticketId: String(id).trim() };

    const ticket = await Ticket.findOne(filter)
      .populate(TICKET_POPULATE)
      .lean();

    if (!ticket) return fail(res, 'Ticket not found', 404);

    return ok(res, { ticket });
  } catch (err) {
    console.error('getTicketById:', err);
    return fail(res, 'Server error fetching ticket', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/tickets/:id
// ─────────────────────────────────────────────────────────────────────────────

const updateTicket = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) return fail(res, 'Invalid ticket ID');

    const oldTicket = await Ticket.findById(id).lean();
    if (!oldTicket) return fail(res, 'Ticket not found', 404);

    if (oldTicket.status === 'Closed') {
      return fail(res, 'Closed ticket cannot be updated. Reopen ticket first.', 400);
    }

    if (oldTicket.status === 'Void') {
      return fail(res, 'Void ticket cannot be updated.', 400);
    }

    const payload = buildTicketPayload(req.body);

    if (Object.prototype.hasOwnProperty.call(req.body, 'status')) {
      return fail(res, 'Status cannot be changed from updateTicket. Use ticket workflow action APIs.', 400);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'assignedTo')) {
      return fail(res, 'Assigned employee cannot be changed from updateTicket. Use assignTicket.', 400);
    }

    if (
      Object.prototype.hasOwnProperty.call(payload, 'priority') ||
      Object.prototype.hasOwnProperty.call(payload, 'department')
    ) {
      if (!canManageTickets(req)) {
        return fail(res, 'Forbidden: insufficient permission to change priority or department', 403);
      }
    }

    if (!canManageTickets(req)) {
      return fail(res, 'Forbidden: insufficient permission to update ticket', 403);
    }

    const nextCustomer = payload.customer ?? oldTicket.customer;
    const nextProject = Object.prototype.hasOwnProperty.call(payload, 'project')
      ? payload.project
      : oldTicket.project;
    const nextInquiry = Object.prototype.hasOwnProperty.call(payload, 'inquiry')
      ? payload.inquiry
      : oldTicket.inquiry;

    const referenceError = await validateReferences({
      customer: nextCustomer,
      project: nextProject,
      inquiry: nextInquiry,
    });

    if (referenceError) return fail(res, referenceError);

    if (Object.prototype.hasOwnProperty.call(payload, 'department')) {
      const departmentResult = await resolveTicketDepartment(payload.department);
      if (departmentResult.error) return fail(res, departmentResult.error);
      payload.department = departmentResult.value;
    }

    payload.updatedBy = req.user._id;

    await syncTicketCustomerContact(nextCustomer, payload);

    const ticket = await Ticket.findByIdAndUpdate(
      id,
      { $set: payload },
      {
        new: true,
        runValidators: true,
      }
    ).populate(TICKET_POPULATE);

    if (!ticket) return fail(res, 'Ticket not found', 404);

    const trackedFields = [
      'title',
      'description',
      'additionalDescription',
      'ticketType',
      'priority',
      'source',
      'supportType',
      'department',
      'contactPerson',
      'contactNumber',
      'customer',
      'project',
      'inquiry',
      'resolution',
      'voidReason',
      'isActive',
    ];

    await Promise.all(
      trackedFields
        .filter((field) => Object.prototype.hasOwnProperty.call(payload, field))
        .map((field) =>
          logTicketActivity({
            ticket,
            user: req.user,
            actionType:
              field === 'priority'
                ? 'priority_changed'
                : field === 'department'
                  ? 'department_changed'
                  : 'updated',
            fieldChanged: field,
            oldValue: oldTicket[field],
            newValue: payload[field],
            description: `Ticket ${ticket.ticketId} ${field} updated`,
          })
        )
    );

    if (Object.prototype.hasOwnProperty.call(payload, 'product')) {
      await logTicketActivity({
        ticket,
        user: req.user,
        actionType: 'updated',
        fieldChanged: 'product',
        oldValue: JSON.stringify(oldTicket.product || {}),
        newValue: JSON.stringify(payload.product || {}),
        description: `Ticket ${ticket.ticketId} product updated`,
      });
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'repairReplacement')) {
      await logTicketActivity({
        ticket,
        user: req.user,
        actionType: 'updated',
        fieldChanged: 'repairReplacement',
        oldValue: JSON.stringify(oldTicket.repairReplacement || {}),
        newValue: JSON.stringify(payload.repairReplacement || {}),
        description: `Ticket ${ticket.ticketId} repairing & replacement details updated`,
      });
    }

    return ok(res, { ticket });
  } catch (err) {
    console.error('updateTicket:', err);

    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return fail(res, message);
    }

    return fail(res, 'Server error updating ticket', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/tickets/:id/assign
// ─────────────────────────────────────────────────────────────────────────────

const assignTicket = async (req, res) => {
  try {
    if (!canAssignTicket(req)) {
      return fail(res, 'Forbidden: insufficient permission to assign ticket', 403);
    }

    const { id } = req.params;
    const { assignedTo } = req.body;

    if (!isValidId(id)) return fail(res, 'Invalid ticket ID');
    if (!assignedTo) return fail(res, 'Assigned employee is required');
    if (!isValidId(assignedTo)) return fail(res, 'Assigned employee is invalid');

    const ticket = await Ticket.findById(id);
    if (!ticket) return fail(res, 'Ticket not found', 404);

    if (ticket.status === 'Closed') {
      return fail(res, 'Closed ticket cannot be assigned. Reopen ticket first.', 400);
    }

    if (ticket.status === 'Void') {
      return fail(res, 'Void ticket cannot be assigned.', 400);
    }

    const assignee = await User.findOne({
      _id: assignedTo,
      isActive: true,
    }).lean();

    if (!assignee) return fail(res, 'Assigned employee not found');

    if (!isAssignableTicketUser(assignee)) {
      return fail(res, 'Ticket can only be assigned to an active employee');
    }

    const previousAssignee = ticket.assignedTo;

    ticket.assignedTo = assignedTo;
    ticket.assignedBy = req.user._id;
    ticket.assignedAt = new Date();
    ticket.updatedBy = req.user._id;

    if (ticket.status === 'New') {
      ticket.status = 'Assigned';
    }

    await ticket.save();
    await populateTicket(ticket);

    await logTicketActivity({
      ticket,
      user: req.user,
      actionType: previousAssignee ? 'reassigned' : 'assigned',
      fieldChanged: 'Assigned Engineer',
      oldValue: previousAssignee || '',
      newValue: assignedTo,
      description: previousAssignee
        ? `Ticket ${ticket.ticketId} reassigned`
        : `Ticket ${ticket.ticketId} assigned`,
      metadata: {
        previousAssignee,
        assignedTo,
      },
    });

    // if (previousAssignee && ticket.status === 'Assigned') {
    if (!previousAssignee && ticket.status === 'Assigned') {
      await logTicketActivity({
        ticket,
        user: req.user,
        actionType: 'status_changed',
        fieldChanged: 'Status',
        oldValue: 'New',
        newValue: 'Assigned',
        description: `Ticket ${ticket.ticketId} moved to Assigned`,
      });
    }

    ok(res, { ticket });

    const actor = { _id: req.user._id, name: req.user.name };
    setImmediate(() => {
      notifyTicketAssigned(ticket, actor)
        .catch((notificationError) => console.error('[ticketController] Ticket assignment notification failed:', notificationError?.message || notificationError));
    });
    return;
  } catch (err) {
    console.error('assignTicket:', err);

    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return fail(res, message);
    }

    return fail(res, 'Server error assigning ticket', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/tickets/:id/start-work  (New/Assigned/Customer Side Pending → Working)
// Permission: ticket managers or assigned employee
// ─────────────────────────────────────────────────────────────────────────────

const startWork = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) return fail(res, 'Invalid ticket ID');

    const ticket = await Ticket.findById(id);
    if (!ticket) return fail(res, 'Ticket not found', 404);

    if (ticket.status === 'Closed') {
      return fail(res, 'Closed ticket cannot be moved to Working. Reopen ticket first.', 400);
    }

    if (ticket.status === 'Void') {
      return fail(res, 'Void ticket cannot be moved to Working.', 400);
    }

    if (!canStartWork(req, ticket)) {
      return fail(res, 'Forbidden: only Admin, HOD, Manager, Team Lead, or the assigned employee can move the ticket to Working', 403);
    }

    if (!['Assigned', 'Customer Side Pending'].includes(ticket.status)) {
      return fail(
        res,
        `Ticket cannot be moved to Working from status "${ticket.status}". Ticket must be Assigned (or Customer Side Pending to resume work) first.`,
        400
      );
    }

    if (!ticket.assignedTo) {
      return fail(res, 'Ticket must be assigned to an employee before starting work', 400);
    }

    const oldStatus = ticket.status;

    ticket.status = 'Working';
    ticket.updatedBy = req.user._id;

    await ticket.save();
    await populateTicket(ticket);

    await logTicketActivity({
      ticket,
      user: req.user,
      actionType: 'started_work',
      fieldChanged: 'Status',
      oldValue: oldStatus,
      newValue: 'Working',
      description: `Ticket ${ticket.ticketId} moved to Working`,
    });

    return ok(res, { ticket });
  } catch (err) {
    console.error('startWork:', err);

    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return fail(res, message);
    }

    return fail(res, 'Server error starting work on ticket', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/tickets/:id/customer-pending  (Working → Customer Side Pending)
// Permission: Admin, HOD, Technical Communication, Assigned Engineer
// ─────────────────────────────────────────────────────────────────────────────

const customerPending = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!isValidId(id)) return fail(res, 'Invalid ticket ID');

    const ticket = await Ticket.findById(id);
    if (!ticket) return fail(res, 'Ticket not found', 404);

    if (ticket.status === 'Closed') {
      return fail(res, 'Closed ticket cannot be moved to Customer Side Pending. Reopen ticket first.', 400);
    }

    if (ticket.status === 'Void') {
      return fail(res, 'Void ticket cannot be moved to Customer Side Pending.', 400);
    }

    if (!canSetCustomerPending(req, ticket)) {
      return fail(res, 'Forbidden: insufficient permission to move ticket to Customer Side Pending', 403);
    }

    if (ticket.status !== 'Working') {
      return fail(
        res,
        `Ticket cannot be moved to Customer Side Pending from status "${ticket.status}". Ticket must be Working first.`,
        400
      );
    }

    const oldStatus = ticket.status;

    ticket.status = 'Customer Side Pending';
    ticket.updatedBy = req.user._id;

    await ticket.save();
    await populateTicket(ticket);

    await logTicketActivity({
      ticket,
      user: req.user,
      actionType: 'customer_pending',
      fieldChanged: 'Status',
      oldValue: oldStatus,
      newValue: 'Customer Side Pending',
      description: note?.trim()
        ? `Ticket ${ticket.ticketId} moved to Customer Side Pending: ${note.trim()}`
        : `Ticket ${ticket.ticketId} moved to Customer Side Pending`,
    });

    return ok(res, { ticket });
  } catch (err) {
    console.error('customerPending:', err);

    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return fail(res, message);
    }

    return fail(res, 'Server error moving ticket to Customer Side Pending', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/tickets/:id/close  (Working/Customer Side Pending → Closed)
// Permission: ticket managers or assigned employee
// Resolution required before close.
// ─────────────────────────────────────────────────────────────────────────────

const closeTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body;

    if (!isValidId(id)) return fail(res, 'Invalid ticket ID');

    const ticket = await Ticket.findById(id);
    if (!ticket) return fail(res, 'Ticket not found', 404);

    if (ticket.status === 'Closed') return fail(res, 'Ticket is already closed', 400);
    if (ticket.status === 'Void') return fail(res, 'Void ticket cannot be closed.', 400);

    if (!canCloseTicket(req, ticket)) {
      return fail(res, 'Forbidden: only Admin, HOD, Manager, Team Lead, or the assigned employee can close this ticket', 403);
    }

    if (!['Working', 'Customer Side Pending'].includes(ticket.status)) {
      return fail(
        res,
        `Ticket cannot be closed from status "${ticket.status}". Ticket must be Working or Customer Side Pending first.`,
        400
      );
    }

    const resolutionText = (resolution ?? ticket.resolution ?? '').toString().trim();
    if (!resolutionText) {
      return fail(res, 'Resolution is required before closing a ticket', 400);
    }

    const oldStatus = ticket.status;

    ticket.resolution = resolutionText;
    ticket.status = 'Closed';
    ticket.closedBy = req.user._id;
    ticket.closedAt = new Date();
    ticket.updatedBy = req.user._id;

    await ticket.save();
    await populateTicket(ticket);

    await logTicketActivity({
      ticket,
      user: req.user,
      actionType: 'closed',
      fieldChanged: 'Status',
      oldValue: oldStatus,
      newValue: 'Closed',
      description: `Ticket ${ticket.ticketId} closed`,
      metadata: { resolution: resolutionText },
    });

    return ok(res, { ticket });
  } catch (err) {
    console.error('closeTicket:', err);

    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return fail(res, message);
    }

    return fail(res, 'Server error closing ticket', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/tickets/:id/reopen  (Closed → Assigned)
// Permission: Admin, HOD, Technical Communication
// ─────────────────────────────────────────────────────────────────────────────

const reopenTicket = async (req, res) => {
  try {
    if (!canReopenTicket(req)) {
      return fail(res, 'Forbidden: only Admin, HOD, or Technical Communication can reopen a ticket', 403);
    }

    const { id } = req.params;
    const { reason } = req.body;

    if (!isValidId(id)) return fail(res, 'Invalid ticket ID');

    const ticket = await Ticket.findById(id);
    if (!ticket) return fail(res, 'Ticket not found', 404);

    if (ticket.status !== 'Closed') {
      return fail(res, 'Only closed tickets can be reopened', 400);
    }

    if (!ticket.assignedTo) {
      return fail(res, 'Ticket cannot be reopened without an assigned employee. Assign an employee first.', 400);
    }

    const oldStatus = ticket.status;

    ticket.status = 'Assigned';
    ticket.reopenedBy = req.user._id;
    ticket.reopenedAt = new Date();
    ticket.closedBy = null;
    ticket.closedAt = null;
    ticket.updatedBy = req.user._id;

    await ticket.save();
    await populateTicket(ticket);

    await logTicketActivity({
      ticket,
      user: req.user,
      actionType: 'reopened',
      fieldChanged: 'Status',
      oldValue: oldStatus,
      newValue: 'Assigned',
      description: reason?.trim()
        ? `Ticket ${ticket.ticketId} reopened: ${reason.trim()}`
        : `Ticket ${ticket.ticketId} reopened`,
    });

    return ok(res, { ticket });
  } catch (err) {
    console.error('reopenTicket:', err);

    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return fail(res, message);
    }

    return fail(res, 'Server error reopening ticket', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/tickets/:id/void  (Any non-closed/non-void → Void)
// Permission: Admin, HOD
// Void reason required.
// ─────────────────────────────────────────────────────────────────────────────

const voidTicket = async (req, res) => {
  try {
    if (!canVoidTicket(req)) {
      return fail(res, 'Forbidden: only Admin or HOD can void a ticket', 403);
    }

    const { id } = req.params;
    const { voidReason } = req.body;

    if (!isValidId(id)) return fail(res, 'Invalid ticket ID');
    if (!voidReason?.trim()) return fail(res, 'Void reason is required');

    const ticket = await Ticket.findById(id);
    if (!ticket) return fail(res, 'Ticket not found', 404);

    if (ticket.status === 'Closed') return fail(res, 'Closed ticket cannot be voided', 400);
    if (ticket.status === 'Void') return fail(res, 'Ticket is already void', 400);

    const oldStatus = ticket.status;

    ticket.status = 'Void';
    ticket.voidReason = voidReason.trim();
    ticket.voidedBy = req.user._id;
    ticket.voidedAt = new Date();
    ticket.updatedBy = req.user._id;

    await ticket.save();
    await populateTicket(ticket);

    await logTicketActivity({
      ticket,
      user: req.user,
      actionType: 'voided',
      fieldChanged: 'Status',
      oldValue: oldStatus,
      newValue: 'Void',
      description: `Ticket ${ticket.ticketId} voided: ${ticket.voidReason}`,
      metadata: { voidReason: ticket.voidReason },
    });

    return ok(res, { ticket });
  } catch (err) {
    console.error('voidTicket:', err);

    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return fail(res, message);
    }

    return fail(res, 'Server error voiding ticket', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tickets/:id/comments
// Permission: Everyone (authenticated)
// ─────────────────────────────────────────────────────────────────────────────

const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!isValidId(id)) return fail(res, 'Invalid ticket ID');
    if (!content?.trim()) return fail(res, 'Comment content is required');

    if (!canAddComment(req)) {
      return fail(res, 'Forbidden: insufficient permission to comment on this ticket', 403);
    }

    // const ticket = await Ticket.findById(id).select('ticketId status');
    Ticket.findById(id).select('ticketId')
    if (!ticket) return fail(res, 'Ticket not found', 404);

    const comment = await TicketComment.create({
      ticket: ticket._id,
      ticketId: ticket.ticketId,
      author: req.user._id,
      authorName: req.user.name,
      authorRole: req.user.role,
      content: content.trim(),
    });

    await comment.populate(COMMENT_POPULATE);

    await logTicketActivity({
      ticket,
      user: req.user,
      actionType: 'comment_created',
      description: `Comment added on ticket ${ticket.ticketId}`,
      metadata: { commentId: comment._id },
    });

    return ok(res, { comment }, 201);
  } catch (err) {
    console.error('addComment:', err);

    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return fail(res, message);
    }

    return fail(res, 'Server error adding comment', 500);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tickets/:id/comments
// Permission: Everyone (authenticated)
// ─────────────────────────────────────────────────────────────────────────────

const getComments = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) return fail(res, 'Invalid ticket ID');

    const ticketExists = await Ticket.exists({ _id: id });
    if (!ticketExists) return fail(res, 'Ticket not found', 404);

    const { page = 1, limit = 50 } = req.query;
    const currentPage = Math.max(1, Number(page) || 1);
    const lim = Math.min(100, Math.max(1, Number(limit) || 50));
    const skip = (currentPage - 1) * lim;

    const filter = { ticket: id, isDeleted: false };

    const [comments, total] = await Promise.all([
      TicketComment.find(filter)
        .populate(COMMENT_POPULATE)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      TicketComment.countDocuments(filter),
    ]);

    return ok(res, {
      comments,
      pagination: {
        total,
        page: currentPage,
        limit: lim,
        totalPages: Math.ceil(total / lim),
      },
    });
  } catch (err) {
    console.error('getComments:', err);
    return fail(res, 'Server error fetching comments', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/tickets/comments/:commentId
// Permission: Comment author, or Admin/HOD/Technical Communication
// ─────────────────────────────────────────────────────────────────────────────

const updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;

    if (!isValidId(commentId)) return fail(res, 'Invalid comment ID');
    if (!content?.trim()) return fail(res, 'Comment content is required');

    const comment = await TicketComment.findById(commentId);
    if (!comment || comment.isDeleted) return fail(res, 'Comment not found', 404);

    if (!canModifyComment(req, comment)) {
      return fail(res, 'Forbidden: you can only edit your own comments', 403);
    }

    const ticket = await Ticket.findById(comment.ticket).select('ticketId');
    if (!ticket) return fail(res, 'Ticket not found', 404);

    const oldContent = comment.content;

    comment.content = content.trim();
    comment.isEdited = true;
    comment.editedAt = new Date();

    await comment.save();
    await comment.populate(COMMENT_POPULATE);

    await logTicketActivity({
      ticket,
      user: req.user,
      actionType: 'comment_updated',
      oldValue: oldContent,
      newValue: comment.content,
      description: `Comment updated on ticket ${ticket.ticketId}`,
      metadata: { commentId: comment._id },
    });

    return ok(res, { comment });
  } catch (err) {
    console.error('updateComment:', err);

    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return fail(res, message);
    }

    return fail(res, 'Server error updating comment', 500);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tickets/:id/attachments
// Permission: Everyone (authenticated)
// Reuses ticketAttachmentUpload (multer) — req.files populated by route middleware
// ─────────────────────────────────────────────────────────────────────────────

const uploadTicketAttachments = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) return fail(res, 'Invalid ticket ID');

    if (!canUploadAttachment(req)) {
      return fail(res, 'Forbidden: insufficient permission to upload attachments', 403);
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) return fail(res, 'Ticket not found', 404);

    if (ticket.status === 'Closed') {
      return fail(res, 'Cannot add attachments to a closed ticket. Reopen ticket first.', 400);
    }

    if (ticket.status === 'Void') {
      return fail(res, 'Cannot add attachments to a void ticket.', 400);
    }

    const files = req.files || [];
    if (!files.length) return fail(res, 'No files uploaded');

    const newAttachments = buildTicketAttachmentDocs(files, req.user._id);

    ticket.attachments.push(...newAttachments);
    ticket.updatedBy = req.user._id;

    await ticket.save();
    await populateTicket(ticket);

    await Promise.all(
      newAttachments.map((attachment) =>
        logTicketActivity({
          ticket,
          user: req.user,
          actionType: 'attachment_uploaded',
          fieldChanged: 'attachments',
          newValue: attachment.name,
          description: `Attachment "${attachment.name}" uploaded to ticket ${ticket.ticketId}`,
          metadata: {
            storedName: attachment.storedName,
            storagePath: attachment.storagePath,
          },
        })
      )
    );

    return ok(res, { ticket }, 201);
  } catch (err) {
    console.error('uploadTicketAttachments:', err);

    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return fail(res, message);
    }

    return fail(res, 'Server error uploading attachments', 500);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tickets/:id/activity
// Permission: Everyone (authenticated)
// ─────────────────────────────────────────────────────────────────────────────

const getTicketActivity = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) return fail(res, 'Invalid ticket ID');

    const ticketExists = await Ticket.exists({ _id: id });
    if (!ticketExists) return fail(res, 'Ticket not found', 404);

    const { page = 1, limit = 50 } = req.query;
    const currentPage = Math.max(1, Number(page) || 1);
    const lim = Math.min(200, Math.max(1, Number(limit) || 50));
    const skip = (currentPage - 1) * lim;

    const filter = { ticket: id };

    const [activities, total] = await Promise.all([
      TicketActivity.find(filter)
        .populate({ path: 'userId', select: 'name email avatar role' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      TicketActivity.countDocuments(filter),
    ]);

    return ok(res, {
      activities,
      pagination: {
        total,
        page: currentPage,
        limit: lim,
        totalPages: Math.ceil(total / lim),
      },
    });
  } catch (err) {
    console.error('getTicketActivity:', err);
    return fail(res, 'Server error fetching ticket activity', 500);
  }
};

module.exports = {
  createTicket,
  getTickets,
  getTicketById,
  updateTicket,
  assignTicket,
  startWork,
  customerPending,
  closeTicket,
  reopenTicket,
  voidTicket,
  addComment,
  getComments,
  updateComment,
  uploadTicketAttachments,
  ticketAttachmentUpload,
  getTicketActivity,
};