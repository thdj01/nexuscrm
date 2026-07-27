'use strict';

const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// TicketActivity — append-only audit/timeline log for a Ticket
// ─────────────────────────────────────────────────────────────────────────────

const TICKET_ACTIVITY_ACTION_TYPES = Object.freeze([
  'created',
  'updated',
  'assigned',
  'reassigned',
  'status_changed',
  'priority_changed',
  'department_changed',
  'started_work',
  'customer_pending',
  'closed',
  'reopened',
  'voided',
  'comment_created',
  'comment_updated',
  'comment_deleted',
  'attachment_uploaded',
  'attachment_deleted',
]);

const ticketActivitySchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
      index: true,
    },

    ticketId: {
      type: String,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    userName: {
      type: String,
      default: 'System',
    },

    actionType: {
      type: String,
      enum: {
        values: TICKET_ACTIVITY_ACTION_TYPES,
        message: `actionType must be one of: ${TICKET_ACTIVITY_ACTION_TYPES.join(', ')}`,
      },
      required: true,
      index: true,
    },

    fieldChanged: {
      type: String,
      default: '',
    },

    oldValue: {
      type: String,
      default: '',
    },

    newValue: {
      type: String,
      default: '',
    },

    description: {
      type: String,
      default: '',
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

ticketActivitySchema.index({ ticket: 1, createdAt: -1 });

const TicketActivity = mongoose.model('TicketActivity', ticketActivitySchema);

module.exports = TicketActivity;
module.exports.TICKET_ACTIVITY_ACTION_TYPES = TICKET_ACTIVITY_ACTION_TYPES;
