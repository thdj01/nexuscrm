'use strict';

const mongoose = require('mongoose');
const Counter = require('./Counter');

// ─────────────────────────────────────────────────────────────────────────────
// Ticket enums
// ─────────────────────────────────────────────────────────────────────────────

const TICKET_TYPES = Object.freeze([
  'N/A',
  'Support',
  'Repairing & Replacement',
]);


const TICKET_STATUSES = Object.freeze([
  'New',
  'Assigned',
  'Working',
  'Customer Side Pending',
  'Closed',
  'Void',
]);

const TICKET_PRIORITIES = Object.freeze([
  'Low',
  'Medium',
  'High',
  'Critical',
]);

const SUPPORT_TYPES = Object.freeze([
  'Free',
  'Paid',
  'Warranty',
  'Comprehensive AMC',
  'Non Comprehensive AMC',
  'Other',
]);

const PRODUCT_TYPES = Object.freeze([
  'N/A',
  'HMI',
  'PLC',
  'Servo',
  'VFD',
  'SCADA',
  'Industrial PC',
  'Other',
]);

const RR_SOLUTION_STATUSES = Object.freeze([
  'N/A',
  'Repair Done',
  'Replacement Done',
  'Vendor Return',
  'Scrap',
  'Awaiting Approval',
  'Awaiting Material',
]);

const REPAIR_STATUSES = Object.freeze([
  'N/A',
  'Pending',
  'In Progress',
  'Under Inspection',
  'Repair Done',
  'Replacement Done',
  'Ready for Dispatch',
  'Dispatched',
  'Vendor Return',
  'Scrap',
]);


// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const productSchema = new mongoose.Schema(
  {
    productType: {
      type: String,
      enum: {
        values: PRODUCT_TYPES,
        message: `Product type must be one of: ${PRODUCT_TYPES.join(', ')}`,
      },
      default: 'N/A',
      trim: true,
      index: true,
    },

    brand: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Brand cannot exceed 100 characters'],
    },

    panelFamily: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Panel family cannot exceed 100 characters'],
    },

    partNumber: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Part number cannot exceed 100 characters'],
    },

    serialNumber: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Serial number cannot exceed 100 characters'],
    },
  },
  { _id: false }
);

const ticketAttachmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Attachment name is required'],
      trim: true,
    },

    storedName: {
      type: String,
      required: [true, 'Stored attachment name is required'],
      trim: true,
    },

    storagePath: {
      type: String,
      required: [true, 'Attachment storage path is required'],
      trim: true,
    },

    mimeType: {
      type: String,
      trim: true,
      default: '',
    },

    sizeBytes: {
      type: Number,
      default: 0,
      min: [0, 'Attachment size cannot be negative'],
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const repairReplacementSchema = new mongoose.Schema(
  {
    underWarranty: {
      type: Boolean,
      default: false,
    },

    productReceivedDate: {
      type: Date,
      default: null,
    },

    receivedDate: {
      type: Date,
      default: null,
    },

    expectedDispatchDate: {
      type: Date,
      default: null,
    },

    inspectionObservation: {
      type: String,
      trim: true,
      default: '',
    },

    repairStatus: {
      type: String,
      enum: {
        values: REPAIR_STATUSES,
        message: `Repair status must be one of: ${REPAIR_STATUSES.join(', ')}`,
      },
      default: 'N/A',
      index: true,
    },

    dateOfReplacement: {
      type: Date,
      default: null,
    },

    replacementSerialNumber: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Replacement serial number cannot exceed 100 characters'],
    },

    rrSolutionStatus: {
      type: String,
      enum: {
        values: RR_SOLUTION_STATUSES,
        message: `RR solution status must be one of: ${RR_SOLUTION_STATUSES.join(', ')}`,
      },
      default: 'N/A',
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// Ticket schema
// ─────────────────────────────────────────────────────────────────────────────

const ticketSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────
    ticketId: {
      type: String,
      unique: true,
      index: true,
    },

    title: {
      type: String,
      required: [true, 'Ticket title is required'],
      trim: true,
      maxlength: [200, 'Ticket title cannot exceed 200 characters'],
    },

    description: {
      type: String,
      trim: true,
      default: '',
    },

    additionalDescription: {
      type: String,
      trim: true,
      default: '',
    },

    // ── Type / workflow ───────────────────────────────────────────────────
    ticketType: {
      type: String,
      enum: {
        values: TICKET_TYPES,
        message: `Ticket type must be one of: ${TICKET_TYPES.join(', ')}`,
      },
      required: [true, 'Ticket type is required'],
      index: true,
    },

    status: {
      type: String,
      enum: {
        values: TICKET_STATUSES,
        message: `Ticket status must be one of: ${TICKET_STATUSES.join(', ')}`,
      },
      default: 'New',
      index: true,
    },

    priority: {
      type: String,
      enum: {
        values: TICKET_PRIORITIES,
        message: `Ticket priority must be one of: ${TICKET_PRIORITIES.join(', ')}`,
      },
      default: 'Medium',
      index: true,
    },

    source: {
      type: String,
      enum: [
        'Call',
        'Mail',
        'WhatsApp',
        'Internal',
        'Other'
      ],
      required: true
    },
  
    supportType: {
      type: String,
      enum: {
        values: SUPPORT_TYPES,
        message: `Support type must be one of: ${SUPPORT_TYPES.join(', ')}`,
      },
      default: 'Free',
      index: true,
    },

    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
      maxlength: [80, 'Department cannot exceed 80 characters'],
      index: true,
    },

    // ── Relationships ─────────────────────────────────────────────────────
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer is required'],
      index: true,
    },

    contactPerson: {
      type: String,
      trim: true,
      required: [true, 'Contact person is required'],
      maxlength: [200, 'Contact person cannot exceed 200 characters'],
    },

    contactNumber: {
      type: String,
      trim: true,
      required: [true, 'Contact number is required'],
      maxlength: [20, 'Contact number cannot exceed 20 characters'],
    },


    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      index: true,
    },

    inquiry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inquiry',
      default: null,
      index: true,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    assignedAt: {
      type: Date,
      default: null,
    },

    // ── Product: one ticket = one product ─────────────────────────────────
    product: {
      type: productSchema,
      required: [true, 'Product details are required'],
    },

    // ── Repairing & Replacement only fields ───────────────────────────────
    repairReplacement: {
      type: repairReplacementSchema,
      default: () => ({}),
    },

    // ── Resolution / closure ──────────────────────────────────────────────
    resolution: {
      type: String,
      trim: true,
      default: '',
    },

    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    closedAt: {
      type: Date,
      default: null,
    },

    reopenedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    reopenedAt: {
      type: Date,
      default: null,
    },

    voidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    voidedAt: {
      type: Date,
      default: null,
    },

    voidReason: {
      type: String,
      trim: true,
      default: '',
    },

    // ── Attachments ───────────────────────────────────────────────────────
    attachments: {
      type: [ticketAttachmentSchema],
      default: [],
    },

    // ── Lifecycle / soft delete ───────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // ── Audit ─────────────────────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by is required'],
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

ticketSchema.index({ status: 1, priority: 1 });
ticketSchema.index({ customer: 1, createdAt: -1 });
ticketSchema.index({ project: 1, createdAt: -1 });
ticketSchema.index({ inquiry: 1, createdAt: -1 });
ticketSchema.index({ assignedTo: 1, status: 1 });
ticketSchema.index({ source: 1, createdAt: -1 });
ticketSchema.index({ supportType: 1, status: 1 });
ticketSchema.index({ department: 1, status: 1 });
ticketSchema.index({ ticketType: 1, status: 1 });
ticketSchema.index({ createdAt: -1 });
ticketSchema.index({
  ticketId: 'text',
  title: 'text',
  description: 'text',
  additionalDescription: 'text',
  'product.productType': 'text',
  'product.brand': 'text',
  'product.panelFamily': 'text',
  'product.partNumber': 'text',
  'product.serialNumber': 'text',
});

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

ticketSchema.pre('validate', function (next) {
  if (this.status === 'Closed' && !this.resolution?.trim()) {
    this.invalidate('resolution', 'Resolution is required before closing a ticket');
  }

  if (this.status === 'Assigned' && !this.assignedTo) {
    this.invalidate('assignedTo', 'Assigned employee is required when ticket status is Assigned');
  }

  if (this.status === 'Void' && !this.voidReason?.trim()) {
    this.invalidate('voidReason', 'Void reason is required when ticket status is Void');
  }

  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Counter integration
// ─────────────────────────────────────────────────────────────────────────────

ticketSchema.pre('save', async function (next) {
  if (this.ticketId) return next();

  try {
    const counter = await Counter.findOneAndUpdate(
      { id: 'ticketId' },
      { $inc: { seq: 1 } },
      {
        new: true,
        upsert: true,
      }
    );

    this.ticketId = `TKT-${String(counter.seq).padStart(6, '0')}`;

    next();
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;
module.exports.TICKET_TYPES = TICKET_TYPES;
module.exports.TICKET_STATUSES = TICKET_STATUSES;
module.exports.TICKET_PRIORITIES = TICKET_PRIORITIES;
module.exports.RR_SOLUTION_STATUSES = RR_SOLUTION_STATUSES;
module.exports.SUPPORT_TYPES = SUPPORT_TYPES;
module.exports.PRODUCT_TYPES = PRODUCT_TYPES;
module.exports.REPAIR_STATUSES = REPAIR_STATUSES;