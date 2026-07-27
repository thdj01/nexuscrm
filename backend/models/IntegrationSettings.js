'use strict';

const mongoose = require('mongoose');

const IntegrationSettingsSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      default: 'default',
      unique: true,
      immutable: true,
    },
    email: {
      isEnabled: {
        type: Boolean,
        default: false,
      },
      provider: {
        type: String,
        trim: true,
        default: 'outlook',
      },
      host: {
        type: String,
        trim: true,
        default: 'smtp.office365.com',
      },
      port: {
        type: Number,
        default: 587,
      },
      secure: {
        type: Boolean,
        default: false,
      },
      username: {
        type: String,
        trim: true,
        lowercase: true,
      },
      fromEmail: {
        type: String,
        trim: true,
        lowercase: true,
      },
      passwordEncrypted: {
        type: String,
        select: false,
      },
      lastVerifiedAt: Date,
      lastVerificationStatus: {
        type: String,
        enum: ['Pending', 'Success', 'Failed'],
        default: 'Pending',
      },
      lastVerificationError: String,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('IntegrationSettings', IntegrationSettingsSchema);
