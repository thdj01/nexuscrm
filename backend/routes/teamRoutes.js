// ─────────────────────────────────────────────────────────────────────────────
// backend/routes/teamRoutes.js
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

const express = require('express');
const { protect }           = require('../middleware/authMiddleware');
const { requireRoles }      = require('../middleware/permissionMiddleware');
const {
  createTeam,
  getTeams,
  getTeamById,
  updateTeam,
  assignHod,
  assignTeamLead,
  addMember,
  getTeamMembers,
} = require('../controllers/teamController');

const router = express.Router();

// All team routes require a valid JWT
router.use(protect);

// ─────────────────────────────────────────────────────────────────────────────
// Team collection routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET  /api/teams
 *   Admin  — returns all teams
 *   HOD    — returns only their managed teams
 *   Lead   — returns only their own team
 *   Employee — returns only their own team
 *
 * Query params:
 *   includeInactive=true  (admin only)
 */
router.get('/', getTeams);

/**
 * POST /api/teams
 *   Body: { name, description?, hodId?, teamLeadId? }
 */
router.post('/', requireRoles('admin'), createTeam);

// ─────────────────────────────────────────────────────────────────────────────
// Single team routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET    /api/teams/:id
 * PUT    /api/teams/:id   — admin only (metadata update)
 */
router
  .route('/:id')
  .get(getTeamById)
  .put(requireRoles('admin'), updateTeam);

// ─────────────────────────────────────────────────────────────────────────────
// Reporting relationship routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /api/teams/:id/hod
 *   Body: { hodId }
 *   Assign or replace the HOD for a team.
 */
router.patch(
  '/:id/hod',
  requireRoles('admin'),
  assignHod
);

/**
 * PATCH /api/teams/:id/team-lead
 *   Body: { teamLeadId }
 *   Assign or replace the Team Lead.
 *   Admin or HOD (for teams they manage).
 */
router.patch(
  '/:id/team-lead',
  requireRoles('admin', 'hod'),
  assignTeamLead
);

// ─────────────────────────────────────────────────────────────────────────────
// Member management routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET    /api/teams/:id/members
 *   Full roster: team_lead + members with profile data.
 *   Accessible by admin, hod (managed), team_lead (own), employee (own team).
 *
 * POST   /api/teams/:id/members
 *   Body: { userId }
 *   Add a user to the team.
 *   Admin, HOD (managed), Team Lead (own team).
 */
router
  .route('/:id/members')
  .get(getTeamMembers)
  .post(requireRoles('admin', 'hod', 'team_lead'), addMember);

module.exports = router;
