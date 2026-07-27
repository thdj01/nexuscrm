// ─────────────────────────────────────────────────────────────────────────────
// backend/models/TimesheetTask.js
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');

// ── Kanban / task status enum ─────────────────────────────────────────────────
const TASK_STATUSES = ['Backlog', 'Planned', 'In Progress', 'Review', 'Completed'];

// ── Task type enum ────────────────────────────────────────────────────────────
const TASK_TYPES = [
  'Development',
  'Design',
  'Meeting',
  'Review',
  'Testing',
  'Documentation',
  'Support',
  'Other',
];

// ── Task source enum ──────────────────────────────────────────────────────────
const TASK_SOURCES = ['USER', 'PROJECT'];

// ── Project sync status enum ─────────────────────────────────────────────────
const SYNC_STATUSES = ['SYNCED', 'PENDING', 'FAILED'];

// ── Archive reason enum ──────────────────────────────────────────────────────
const ARCHIVE_REASONS = [
  'PROJECT_TASK_REMOVED',
  'PROJECT_TASK_UNASSIGNED',
  'PROJECT_DELETED',
  'MANUAL_ARCHIVE',
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper — parse "HH:mm" → total minutes since midnight
// ─────────────────────────────────────────────────────────────────────────────
function timeToMinutes(t) {
  if (!t || typeof t !== 'string') return null;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────
const timesheetTaskSchema = new mongoose.Schema(
  {
    // ── Who ────────────────────────────────────────────────────────────────
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Employee is required'],
      index: true,
    },

    // ── What ───────────────────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },

    description: {
      type: String,
      trim: true,
      default: '',
    },

    // Employee-entered work remarks.
    // For PROJECT-linked tasks, this must remain separate from `description`,
    // because `description` is synced from the Project Planning remark.
    employeeRemarks: {
      type: String,
      trim: true,
      default: '',
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      index: true,
    },

    taskType: {
      type: String,
      enum: {
        values: TASK_TYPES,
        message: `taskType must be one of: ${TASK_TYPES.join(', ')}`,
      },
      required: [true, 'Task type is required'],
      default: 'Development',
    },

    // ── Source tracking ────────────────────────────────────────────────────
    // USER    = created directly from Timesheet module
    // PROJECT = synced from Project Planning task assignment
    taskSource: {
      type: String,
      enum: {
        values: TASK_SOURCES,
        message: `taskSource must be one of: ${TASK_SOURCES.join(', ')}`,
      },
      default: 'USER',
      index: true,
    },

    sourceProject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      index: true,
    },

    sourceProjectId: {
      type: String,
      trim: true,
      default: '',
    },

    sourceGridId: {
      type: String,
      trim: true,
      default: '',
    },

    sourceGridName: {
      type: String,
      trim: true,
      default: '',
    },

    sourceTaskId: {
      type: String,
      trim: true,
      default: '',
    },

    sourceTaskKey: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },

    sourceTaskName: {
      type: String,
      trim: true,
      default: '',
    },

    sourceDepartment: {
      type: String,
      trim: true,
      default: '',
    },

    sourcePlannedStartDate: {
      type: Date,
      default: null,
    },

    sourcePlannedEndDate: {
      type: Date,
      default: null,
    },

    // ── Project sync tracking ──────────────────────────────────────────────
    syncStatus: {
      type: String,
      enum: {
        values: SYNC_STATUSES,
        message: `syncStatus must be one of: ${SYNC_STATUSES.join(', ')}`,
      },
      default: 'SYNCED',
      index: true,
    },

    lastSyncedAt: {
      type: Date,
      default: null,
    },

    syncError: {
      type: String,
      trim: true,
      default: '',
    },

    syncRetryCount: {
      type: Number,
      min: [0, 'Sync retry count cannot be negative'],
      default: 0,
    },

    // ── Archive tracking ───────────────────────────────────────────────────
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },

    archivedAt: {
      type: Date,
      default: null,
    },

    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    archiveReason: {
      type: String,
      enum: {
        values: [...ARCHIVE_REASONS, ''],
        message: `archiveReason must be one of: ${ARCHIVE_REASONS.join(', ')}`,
      },
      default: '',
    },

    restoredAt: {
      type: Date,
      default: null,
    },

    restoredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // ── When ───────────────────────────────────────────────────────────────
    date: {
      type: Date,
      required: [true, 'Date is required'],
      index: true,
    },

    // Stored as "HH:mm" strings for timezone-safe handling
    startTime: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
        message: 'startTime must be in HH:mm format',
      },
    },

    endTime: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
        message: 'endTime must be in HH:mm format',
      },
    },

    // Auto-calculated from startTime / endTime; can also be set manually
    // when times are not provided.
    hours: {
      type: Number,
      min: [0, 'Hours cannot be negative'],
      max: [24, 'Hours cannot exceed 24 in a single entry'],
      default: 0,
    },

    // ── Workflow ───────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: {
        values: TASK_STATUSES,
        message: `status must be one of: ${TASK_STATUSES.join(', ')}`,
      },
      default: 'Backlog',
      index: true,
    },

    // Numeric position within its kanban column for ordering
    kanbanOrder: {
      type: Number,
      default: 0,
    },

    // ── Audit ──────────────────────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────────────────────────────────────
// Compound indexes for common query patterns
// ─────────────────────────────────────────────────────────────────────────────
timesheetTaskSchema.index({ employee: 1, date: -1 });
timesheetTaskSchema.index({ employee: 1, status: 1 });
timesheetTaskSchema.index({ project: 1, date: -1 });
timesheetTaskSchema.index({ date: -1, status: 1 });

// Project → Timesheet sync and archive query patterns
timesheetTaskSchema.index({ taskSource: 1, isArchived: 1 });
timesheetTaskSchema.index({ employee: 1, isArchived: 1 });
timesheetTaskSchema.index(
  { taskSource: 1, sourceProject: 1, sourceTaskKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      taskSource: 'PROJECT',
      sourceProject: { $type: 'objectId' },
      sourceTaskKey: { $type: 'string', $gt: '' },
    },
  }
);
timesheetTaskSchema.index({ syncStatus: 1, taskSource: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// Pre-save: auto-calculate hours from startTime / endTime
// ─────────────────────────────────────────────────────────────────────────────
timesheetTaskSchema.pre('save', function (next) {
  if (this.startTime && this.endTime) {
    const start = timeToMinutes(this.startTime);
    const end   = timeToMinutes(this.endTime);

    if (start !== null && end !== null) {
      // Handle overnight tasks (end < start) by capping at 24 h
      const diff = end >= start ? end - start : 24 * 60 - start + end;
      // Round to 2 decimal places
      this.hours = Math.round((diff / 60) * 100) / 100;
    }
  }
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Static helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregate total hours for a given employee within a date range.
 * Returns { totalHours, taskCount }
 */
timesheetTaskSchema.statics.getTotalHours = async function (employeeId, from, to) {
  const match = { employee: new mongoose.Types.ObjectId(employeeId) };
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to)   match.date.$lte = new Date(to);
  }

  const result = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalHours: { $sum: '$hours' },
        taskCount:  { $sum: 1 },
      },
    },
  ]);

  return result.length ? { totalHours: result[0].totalHours, taskCount: result[0].taskCount }
                       : { totalHours: 0, taskCount: 0 };
};

/**
 * Get daily hour breakdown for an employee over a date range.
 * Returns array of { date, hours, taskCount }
 */
timesheetTaskSchema.statics.getDailyBreakdown = async function (employeeId, from, to) {
  const match = {
    employee: new mongoose.Types.ObjectId(employeeId),
    date: { $gte: new Date(from), $lte: new Date(to) },
  };

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$date' },
        },
        hours:     { $sum: '$hours' },
        taskCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: '$_id', hours: 1, taskCount: 1 } },
  ]);
};

module.exports = mongoose.model('TimesheetTask', timesheetTaskSchema);
module.exports.TASK_STATUSES  = TASK_STATUSES;
module.exports.TASK_TYPES     = TASK_TYPES;
module.exports.TASK_SOURCES   = TASK_SOURCES;
module.exports.SYNC_STATUSES  = SYNC_STATUSES;
module.exports.ARCHIVE_REASONS = ARCHIVE_REASONS;
