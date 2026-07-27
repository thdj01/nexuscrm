// ─────────────────────────────────────────────────────────────────────────────
// backend/models/Team.js
// ─────────────────────────────────────────────────────────────────────────────
//
// Represents a team within the organisation.
//
// Hierarchy supported:
//   Admin ↓ HOD ↓ Team Lead ↓ Employee
//
// Relationships stored HERE (Team is the join table):
//   • hod        — the single User with role 'hod' who oversees this team
//   • teamLead   — the single User with role 'team_lead' who leads this team
//   • members    — array of User refs (role 'employee') who belong to this team
//
// One employee belongs to exactly one team. This is enforced at the
// application layer (teamController checks for existing membership before
// adding) and by the sparse unique index on User.teamId added in Phase 1.
//
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const teamSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────
    name: {
      type:      String,
      required:  [true, 'Team name is required'],
      trim:      true,
      maxlength: [100, 'Team name cannot exceed 100 characters'],
    },

    description: {
      type:    String,
      trim:    true,
      default: '',
    },

    // ── Reporting relationships ───────────────────────────────────────────
    hod: {
      type:  mongoose.Schema.Types.ObjectId,
      ref:   'User',
      // HOD is required at creation; null is only valid during seeding/migration
      default: null,
      index: true,
    },

    teamLead: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      default:  null,
      // index:    true,
    },

    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'User',
      },
    ],

    // ── Lifecycle ─────────────────────────────────────────────────────────
    isActive: {
      type:    Boolean,
      default: true,
      index:   true,
    },

    // ── Audit ─────────────────────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
    },
  },
  {
    timestamps: true,
    // Expose virtual "id" in JSON and plain-object output
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

// Fast lookup of all teams under a given HOD
teamSchema.index({ hod: 1, isActive: 1 });

// Fast lookup of a team by its lead
teamSchema.index({ teamLead: 1 });

// Case-insensitive unique team name index.
// The collation option is intentionally NOT set here because Mongoose's
// schema.index() does not reliably pass the collation to the driver in all
// versions.  If autoIndex runs before the migration script, a plain index
// without collation would be created, and the migration's attempt to create
// the collation version would fail with IndexOptionsConflict (code 85).
//
// Resolution: the collation index is created exclusively by the migration
// script (001_add_team_hierarchy.js Step 4), which handles the drop+recreate
// logic.  The schema-level index below intentionally omits collation so that
// Mongoose autoIndex and the migration script do not conflict.
// Remove this comment (and keep only the schema index) after confirming the
// migration has run successfully in all environments.
teamSchema.index(
  { name: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
    // collation intentionally omitted — see comment above.
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Virtuals
// ─────────────────────────────────────────────────────────────────────────────

/** Convenience count without an extra query */
teamSchema.virtual('memberCount').get(function () {
  return this.members?.length ?? 0;
});

// ─────────────────────────────────────────────────────────────────────────────
// Statics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return the team document for a given member/lead/hod userId.
 * Used by permission middleware to avoid repetitive queries.
 *
 * @param  {string|ObjectId} userId
 * @returns {Promise<TeamDocument|null>}
 */
teamSchema.statics.findByMember = function (userId) {
  const id = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId)
    : null;

  if (!id) return Promise.resolve(null);

  return this.findOne({
    isActive: true,
    $or: [{ members: id }, { teamLead: id }, { hod: id }],
  }).lean();
};

/**
 * Return all team IDs managed by a given HOD.
 *
 * @param  {string|ObjectId} hodId
 * @returns {Promise<ObjectId[]>}
 */
teamSchema.statics.findIdsByHod = async function (hodId) {
  const teams = await this.find({ hod: hodId, isActive: true }, '_id').lean();
  return teams.map((t) => t._id);
};

/**
 * Return all member IDs across all teams managed by a given HOD.
 * Includes team leads.
 *
 * @param  {string|ObjectId} hodId
 * @returns {Promise<ObjectId[]>}
 */
teamSchema.statics.findMembersByHod = async function (hodId) {
  const teams = await this.find({ hod: hodId, isActive: true }, 'members teamLead').lean();

  const ids = new Set();
  for (const team of teams) {
    if (team.teamLead) ids.add(team.teamLead.toString());
    for (const m of team.members ?? []) ids.add(m.toString());
  }

  return [...ids].map((id) => new mongoose.Types.ObjectId(id));
};

/**
 * Return all member IDs for a given team lead.
 * Includes the lead themselves.
 *
 * @param  {string|ObjectId} leadId
 * @returns {Promise<ObjectId[]>}
 */
teamSchema.statics.findMembersByLead = async function (leadId) {
  const team = await this.findOne({ teamLead: leadId, isActive: true }, 'members teamLead').lean();
  if (!team) return [];

  const ids = new Set();
  ids.add(team.teamLead.toString());
  for (const m of team.members ?? []) ids.add(m.toString());

  return [...ids].map((id) => new mongoose.Types.ObjectId(id));
};

// ─────────────────────────────────────────────────────────────────────────────
module.exports = mongoose.model('Team', teamSchema);
