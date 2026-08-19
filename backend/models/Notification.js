// ─────────────────────────────────────────────────────────────────────────────
// backend/models/Notification.js  — FIXED (full replacement)
//
// Bug fix applied:
//   [C3] Added 'status' and 'warning' to the type enum.
//        inquiryController.js calls createNotification with type: 'status'
//        (on status change) and type: 'warning' (on delete).
//        Neither was in the original enum, so Notification.create() threw a
//        Mongoose ValidationError every time.  Because notificationService
//        had no try/catch, this error propagated all the way up and caused
//        createInquiry / updateInquiry / deleteInquiry to return 500 to the
//        frontend — making it appear the save had failed even when the inquiry
//        document was already written to MongoDB.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      // [FIX C3] Added 'status' and 'warning' — used by inquiryController
      enum: [
        'overdue',
        'project_delay',
        'order_confirmed',
        'kickoff_scheduled',
        'project_created',
        'workflow_error',
        'info',
        'status',   // ← was missing: sent on status change in updateInquiry
        'warning',  // ← was missing: sent on deleteInquiry
      ],
      default: 'info',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    relatedInquiry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inquiry',
    },
    relatedProject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
    },
    relatedTicket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
