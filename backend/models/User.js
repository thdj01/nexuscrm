// ─────────────────────────────────────────────────────────────────────────────
// backend/models/User.js
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ─────────────────────────────────────────────────────────────────────────────
// Role constants — exported so other modules stay in sync without magic strings
// ─────────────────────────────────────────────────────────────────────────────

const ROLES = Object.freeze({
  ADMIN: 'admin',
  HOD: 'hod',
  TEAM_LEAD: 'team_lead',
  EMPLOYEE: 'employee',
  MANAGER: 'manager',
});

const ROLE_ORDER = ['admin', 'hod', 'manager', 'team_lead', 'employee'];

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },

    phone: {
      type: String,
      trim: true,
      default: '',
    },

    avatar: {
      type: String,
      default: '',
    },

    // ── Role / Hierarchy ──────────────────────────────────────────────────
    role: {
      type: String,
      enum: {
        values: Object.values(ROLES),
        message: `role must be one of: ${Object.values(ROLES).join(', ')}`,
      },
      default: ROLES.EMPLOYEE,
      index: true,
    },

    // Employee / Team Lead primary department.
    // HOD uses hodDepartments[] because one HOD may own multiple departments.
    department: {
      // Department Master stores new values as Department ObjectId.
      // Mixed keeps existing legacy string departments readable until migration.
      type: mongoose.Schema.Types.Mixed,
      default: '',
      index: true,
    },

    hodDepartments: {
      // Supports Department ObjectIds for new data and legacy strings for old data.
      type: [mongoose.Schema.Types.Mixed],
      default: [],
      index: true,
    },

    // ── Team / Reporting ──────────────────────────────────────────────────
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
      index: true,
    },

    reportsTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // ── Employee access permissions ───────────────────────────────────────
    // Undefined means department-based suggestions are used until an
    // administrator explicitly saves the employee's access checklist.
    // Universal Inquiry/Project view permissions are always effective, even
    // when the saved optional permission list is empty.
    employeeAccess: {
      type: [String],
      default: undefined,
    },

    // ── Lifecycle ─────────────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // ── Password reset ────────────────────────────────────────────────────
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
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

userSchema.index({ teamId: 1, role: 1 });
userSchema.index({ reportsTo: 1 });
userSchema.index({ department: 1, role: 1 });
userSchema.index({ hodDepartments: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// Pre-save hooks
// ─────────────────────────────────────────────────────────────────────────────

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);

  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Instance methods
// ─────────────────────────────────────────────────────────────────────────────

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.hasRole = function (...roles) {
  return roles.includes(this.role);
};

userSchema.methods.outranks = function (targetRole) {
  const myRank = ROLE_ORDER.indexOf(this.role);
  const targetRank = ROLE_ORDER.indexOf(targetRole);

  if (myRank === -1 || targetRank === -1) return false;

  return myRank <= targetRank;
};

// ─────────────────────────────────────────────────────────────────────────────
// Statics
// ─────────────────────────────────────────────────────────────────────────────

userSchema.statics.findByTeam = function (teamId) {
  return this.find({ teamId, isActive: true }).select('-password').lean();
};

// ─────────────────────────────────────────────────────────────────────────────

const User = mongoose.model('User', userSchema);

module.exports = User;
module.exports.ROLES = ROLES;
module.exports.ROLE_ORDER = ROLE_ORDER;