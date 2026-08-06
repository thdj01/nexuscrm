'use strict';

const mongoose = require('mongoose');


const kickoffDocumentSchema = new mongoose.Schema(
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

const notificationLogSchema = new mongoose.Schema(
  {
    channel: {
      type: String,
      enum: ['WhatsApp', 'Outlook', 'System'],
      required: true,
    },
    recipientType: {
      type: String,
      enum: ['Customer', 'Assigned User', 'Internal Stakeholder', 'Internal Team', 'Internal WhatsApp Group', 'Configured Notify Number', 'System'],
      default: 'System',
    },
    recipientName: { type: String, trim: true, default: '' },
    recipientContact: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['Queued', 'Sent', 'Skipped', 'Failed'],
      default: 'Queued',
    },
    message: { type: String, trim: true, default: '' },
    error: { type: String, trim: true, default: '' },
    loggedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const kickoffWorkflowSchema = new mongoose.Schema(
  {
    inquiry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inquiry',
      required: true,
      unique: true,
      index: true,
    },
    projectReference: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    date: { type: String, trim: true, required: true },
    time: { type: String, trim: true, required: true },
    agenda: {
      type: String,
      trim: true,
      default: 'Kick-off Meeting to review customer requirements, scope, responsibilities, timeline, and next actions.',
    },
    meetingLink: { type: String, trim: true, default: '' },
    finalTechnicalBomDocument: { type: kickoffDocumentSchema, default: undefined },
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    status: {
      type: String,
      enum: ['Scheduled', 'Ready For Completion', 'Completed', 'Project Created', 'Failed', 'Cancelled'],
      default: 'Scheduled',
      index: true,
    },
    notificationStatus: {
      whatsapp: {
        type: String,
        enum: ['Pending', 'Queued', 'Sent', 'Skipped', 'Failed'],
        default: 'Pending',
      },
      outlook: {
        type: String,
        enum: ['Pending', 'Queued', 'Sent', 'Skipped', 'Failed'],
        default: 'Pending',
      },
      internal: {
        type: String,
        enum: ['Pending', 'Queued', 'Sent', 'Skipped', 'Failed'],
        default: 'Pending',
      },
    },
    notificationLogs: { type: [notificationLogSchema], default: [] },
    conversionAttempts: { type: Number, default: 0, min: 0 },
    lastProcessedAt: { type: Date, default: null },
    convertedAt: { type: Date, default: null },
    lastError: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

kickoffWorkflowSchema.index({ status: 1, scheduledAt: 1 });

module.exports = mongoose.model('KickoffWorkflow', kickoffWorkflowSchema);
