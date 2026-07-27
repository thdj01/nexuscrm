const mongoose = require('mongoose');
const Counter = require('./Counter');
const { SUPPORTED_PROJECT_DEPARTMENTS, SUPPORTED_PANEL_TYPES, PLANNING_MODES, TASK_STATUSES } = require('../config/projectPlanningCatalog');

// ── Date helpers ─────────────────────────────────────────────────────────────
function startOfDay(value = new Date()) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(value, days) {
  const d = startOfDay(value);
  if (!d) return undefined;
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function diffDays(fromDate, toDate) {
  const from = startOfDay(fromDate);
  const to = startOfDay(toDate);
  if (!from || !to) return 0;
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000));
}

function normalizeDelayFields(doc) {
  if (!doc.projectEndDate) return;

  const isCompleted = doc.projectStatus === 'Completed';
  let delayDays = 0;

  if (isCompleted) {
    if (!doc.completedAt) doc.completedAt = new Date();
    delayDays = diffDays(doc.projectEndDate, doc.completedAt);
  } else {
    delayDays = diffDays(doc.projectEndDate, new Date());
  }

  doc.delayedDays = delayDays;
  doc.isDelayed = delayDays > 0;
  doc.delayedEndDate = addDays(doc.projectEndDate, delayDays);
}

// ── Planning Task sub-schema ─────────────────────────────────────────────────
const planningTaskSchema = new mongoose.Schema(
  {
    taskId: { type: String },

    // A/B/C... identifier used when the same project has multiple planning grids
    // when a project has multiple department/panel planning grids. Blank values are allowed for legacy records.
    gridId: { type: String, trim: true, default: 'A' },
    gridName: { type: String, trim: true, default: 'Project Planning Grid - A' },

    taskType: {
      type: String,
      enum: ['Production', 'Programming', 'Common', 'Joint'],
      default: 'Production',
    },

    // Department is shown in the planning grid and is used for
    // task-level assignee filtering. taskType is retained as the
    // legacy/workstream field for backward compatibility.
    department: {
      type: String,
      trim: true,
      default: '',
    },

    taskName: {
      type: String,
      trim: true,
    },

    // Project inquiry number shown in the planning grid INQ No column.
    inqNo: {
      type: String,
      trim: true,
      default: '',
    },

    // Separate remark for this individual planning task/activity row.
    // This belongs only to the planning task and is not a project-details field.
    remark: {
      type: String,
      trim: true,
      default: '',
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    dependency: {
      type: String,
      default: '',
    },

    milestone: {
      type: Boolean,
      default: false,
    },

    plannedStartDate: {
      type: Date,
    },

    plannedEndDate: {
      type: Date,
    },

    // Real completion date captured when task status changes to Completed.
    // Used for Expected vs Actual task completion graph and frozen delay.
    actualCompletedDate: {
      type: Date,
    },

    order: { type: Number, default: 1, min: 1 },

    totalDays: {
      type: Number,
      default: 1,
      min: 1,
      validate: { validator: Number.isInteger, message: 'Task days must be a whole number' },
    },

    // For completed tasks this is frozen using actualCompletedDate vs plannedEndDate.
    // For incomplete tasks it can be refreshed/live-calculated by the controller/UI.
    delayDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastReminderSent: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: [...TASK_STATUSES, 'Hold', 'Not Started', 'Delayed'],
      default: 'Pending',
    },
  },
  { _id: false }
);

// ── Planning Grid sub-schema ─────────────────────────────────────────────────
const planningGridSchema = new mongoose.Schema(
  {
    gridId: { type: String, trim: true, default: 'A' },
    name: { type: String, trim: true, default: 'Project Planning Grid' },
    gridName: { type: String, trim: true, default: 'Project Planning Grid' },
    department: { type: String, enum: SUPPORTED_PROJECT_DEPARTMENTS, index: true },
    panelType: { type: String, enum: SUPPORTED_PANEL_TYPES, index: true },
    panelQuantity: { type: Number, min: 1, default: 1, validate: { validator: Number.isInteger, message: 'Panel quantity must be a whole number' } },
    planningMode: { type: String, enum: PLANNING_MODES, default: 'common' },
    unitNumber: { type: Number, min: 1, validate: { validator: (value) => value === undefined || Number.isInteger(value), message: 'Unit number must be a whole number' } },
    isCommon: { type: Boolean, default: true },
    migrationReviewRequired: { type: Boolean, default: false },
    completionPercentage: { type: Number, min: 0, max: 100, default: 0 },
    projectEndDate: { type: Date },
    delayedEndDate: { type: Date },
    delayedDays: { type: Number, default: 0, min: 0 },
    planningTasks: { type: [planningTaskSchema], default: [] },
  },
  { _id: false }
);

const projectDocumentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    storedName: { type: String, required: true, trim: true },
    storagePath: { type: String, required: true, trim: true },
    mimeType: { type: String, trim: true, default: '' },
    sizeBytes: { type: Number, default: 0, min: 0 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);


// ── Kick-off Meeting sub-schema ──────────────────────────────────────────────
const kickoffMeetingSchema = new mongoose.Schema(
  {
    scheduledAt: { type: Date },
    date: { type: String, trim: true, default: '' },
    time: { type: String, trim: true, default: '' },
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    agenda: { type: String, trim: true, default: '' },
    meetingLink: { type: String, trim: true, default: '' },
    workflowReference: { type: mongoose.Schema.Types.ObjectId, ref: 'KickoffWorkflow' },
    status: {
      type: String,
      enum: ['Scheduled', 'Completed', 'Project Created', 'Cancelled'],
      default: 'Scheduled',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    scheduledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    scheduledOn: { type: Date },
  },
  { _id: false }
);

// ── NAPL ID counter ───────────────────────────────────────────────────────────
const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 199 } });
const NaplCounter = mongoose.model('NaplCounter', counterSchema);

async function getNextNaplId() {
  const doc = await NaplCounter.findByIdAndUpdate(
    'napl',
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `NAPL-${String(doc.seq).padStart(4, '0')}`;
}


const projectSchema = new mongoose.Schema(
  {
    projectId: { type: String, unique: true },  // NAPL-0200, NAPL-0201, …

    inquiryReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Inquiry' },

    // Denormalized inquiry number preserved when an inquiry is converted into a project.
    inquiryNumber: { type: String, trim: true, default: '' },

    customerName: { type: String, required: [true, 'Customer name is required'], trim: true },
    companyName:  { type: String, trim: true },
    projectName:  { type: String, required: [true, 'Project name is required'], trim: true },

    // Deprecated legacy Project Details fields. Kept select:false during the
    // compatibility window so old records can be migrated without data loss.
    projectType: { type: String, select: false },
    projectScopes: { type: [String], default: undefined, select: false },
    projectDepartment: { type: String, trim: true, select: false },
    panelType: { type: String, select: false },
    notes: { type: String, trim: true, select: false },

    selectedDepartments: {
      type: [{ type: String, enum: SUPPORTED_PROJECT_DEPARTMENTS }],
      default: [],
    },

    panelSelections: {
      type: [{
        _id: false,
        department: { type: String, enum: SUPPORTED_PROJECT_DEPARTMENTS, required: true },
        panelType: { type: String, enum: SUPPORTED_PANEL_TYPES, required: true },
        quantity: { type: Number, min: 1, required: true, validate: { validator: Number.isInteger, message: 'Panel quantity must be a whole number' } },
        planningMode: { type: String, enum: PLANNING_MODES, required: true },
      }],
      default: [],
    },

    legacyProjectDetails: { type: mongoose.Schema.Types.Mixed, default: undefined, select: false },
    migrationReviewRequired: { type: Boolean, default: false },
    migrationIssues: { type: [String], default: [] },

    // Stored field remains `quantity`; UI/API label is Project Quantity.
    quantity: { type: Number, default: 1, min: 1, validate: { validator: Number.isInteger, message: 'Project Quantity must be a whole number' } },
    orderValue:           { type: Number, default: 0 },
    orderDate:            { type: Date, default: Date.now },
    expectedDeliveryDate: { type: Date },
    actualDeliveryDate:   { type: Date },

    // Original planned/expected project end date. This date is kept as the
    // comparison baseline for delay; completion does not overwrite it.
    projectEndDate:       { type: Date },

    // Real project completion date. Set once when projectStatus becomes Completed.
    completedAt:          { type: Date },

    // Frozen after completion; live calculated before completion.
    delayedDays:          { type: Number, default: 0, min: 0 },
    delayedEndDate:       { type: Date },
    isDelayed:            { type: Boolean, default: false },

    productionStatus:   { type: String, enum: ['Not Started', 'In Progress', 'Completed'], default: 'Not Started' },
    dispatchStatus:     { type: String, enum: ['Not Delivered', 'Delivered'], default: 'Not Delivered' },
    installationStatus: { type: String, enum: ['Not Started', 'In Progress', 'Completed'], default: 'Not Started' },
    paymentStatus:      { type: String, enum: ['Pending', 'Partial', 'Completed'], default: 'Pending' },
    projectStatus: {
      type: String,
      enum: ['Planning','Design','Production','Testing','Dispatch','Installation','Completed','Delivered','won'],
      default: 'Planning',
    },
    completionPercentage: { type: Number, min: 0, max: 100, default: 0 },


    // Kick-off meeting scheduled when Inquiry is converted after Order Received.
    kickoffMeeting: { type: kickoffMeetingSchema, default: undefined },

    // Project detail page document attachments.
    documents: { type: [projectDocumentSchema], default: [] },

    // Team members selected during Kick-off Meeting scheduling.
    assignedTeamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Full inquiry snapshot preserved during automatic conversion so customer,
    // requirements, notes, and source details remain available even if the
    // inquiry changes later.
    sourceInquirySnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Legacy project-level assignment field. New project screens do not write it;
    // task assignment now lives only inside planningTasks[].assignedTo.
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    customerRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },

    // ── Planning Grid ────────────────────────────────────────────────────────
    // planningTasks is retained as a flattened legacy copy so existing reports,
    // charts, reminders, and integrations keep working. planningGrids stores the
    // department/panel common or separate grids with per-grid completion percentages.
    planningTasks: { type: [planningTaskSchema], default: [] },
    planningGrids: { type: [planningGridSchema], default: [] },
  },
  { timestamps: true }
);

projectSchema.index({ customerRef: 1, createdAt: -1 });
projectSchema.index({ selectedDepartments: 1, createdAt: -1 });
projectSchema.index({ 'planningGrids.department': 1, 'planningGrids.panelType': 1 });

// Auto-assign NAPL ID on create + keep project delay fields consistent.
projectSchema.pre('save', async function (next) {
  try {
    if (!this.projectId) {
      this.projectId = await getNextNaplId();
    }

    // Projects created directly from the New Project page do not have an
    // Inquiry document. Allocate a number from the same counter used by
    // Inquiry.js so INQ numbers remain unique across both modules.
    if (!String(this.inquiryNumber || '').trim()) {
      const counter = await Counter.findOneAndUpdate(
        { id: 'inquiryId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.inquiryNumber = `INQ-${counter.seq + 1349}`;
    }

    normalizeDelayFields(this);
    next();
  } catch (error) {
    next(error);
  }
});

// Keep delayedEndDate consistent on direct updates. Main create/update controller
// still performs the full delay freeze logic because it can compare old vs new.
projectSchema.pre('findOneAndUpdate', function (next) {
  const upd = this.getUpdate() || {};
  const body = upd.$set || upd;

  if (body.projectEndDate && body.delayedDays !== undefined) {
    const delayedEndDate = addDays(body.projectEndDate, Number(body.delayedDays) || 0);
    body.delayedEndDate = delayedEndDate;
    if (upd.$set) upd.$set.delayedEndDate = delayedEndDate;
  }

  next();
});

module.exports = mongoose.model('Project', projectSchema);
