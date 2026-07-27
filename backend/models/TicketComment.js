'use strict';

const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// TicketComment — discussion thread on a Ticket
// ─────────────────────────────────────────────────────────────────────────────

const ticketCommentSchema = new mongoose.Schema(
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

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Comment author is required'],
    },

    authorName: {
      type: String,
      default: '',
    },

    authorRole: {
      type: String,
      default: '',
    },

    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
      maxlength: [4000, 'Comment cannot exceed 4000 characters'],
    },

    isEdited: {
      type: Boolean,
      default: false,
    },

    editedAt: {
      type: Date,
      default: null,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

ticketCommentSchema.index({ ticket: 1, createdAt: -1 });

const TicketComment = mongoose.model('TicketComment', ticketCommentSchema);

module.exports = TicketComment;
