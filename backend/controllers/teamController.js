// ─────────────────────────────────────────────────────────────────────────────
// backend/controllers/teamController.js
// ─────────────────────────────────────────────────────────────────────────────
//
// Handles all Team management operations.
//
// Access matrix:
//   createTeam       admin
//   getTeams         admin, hod (scoped to managed teams), team_lead (own team)
//   getTeamById      admin, hod (managed), team_lead (own), employee (own team)
//   updateTeam       admin
//   assignHod        admin
//   assignTeamLead   admin, hod (within managed teams)
//   addMember        admin, hod (within managed teams), team_lead (own team)
//   getTeamMembers   admin, hod, team_lead, employee (own team)
//
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

const mongoose = require('mongoose');
const Team     = require('../models/Team');
const User     = require('../models/User');
const { ROLES } = require('../models/User');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const ok   = (res, data, statusCode = 200) =>
  res.status(statusCode).json({ success: true, ...data });

const fail = (res, message, statusCode = 400) =>
  res.status(statusCode).json({ success: false, message });

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Check whether the current user (hod or team_lead) is authorised to manage
 * a specific team. Admins bypass this check.
 *
 * @param  {object}  req
 * @param  {object}  team  lean Team document
 * @returns {boolean}
 */
function canManageTeam(req, team) {
  const { role, _id } = req.user;
  if (role === ROLES.ADMIN) return true;
  if (role === ROLES.HOD)   return team.hod?.toString() === _id.toString();
  if (role === ROLES.TEAM_LEAD) return team.teamLead?.toString() === _id.toString();
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/teams
// @desc    Create a new team
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────

const createTeam = async (req, res) => {
  try {
    const { name, description, hodId, teamLeadId } = req.body;

    if (!name?.trim()) return fail(res, 'Team name is required');

    // Validate HOD if provided
    if (hodId) {
      if (!isValidId(hodId)) return fail(res, 'Invalid HOD user ID');
      const hod = await User.findById(hodId).select('role isActive').lean();
      if (!hod)            return fail(res, 'HOD user not found', 404);
      if (!hod.isActive)   return fail(res, 'HOD user account is inactive');
      if (hod.role !== ROLES.HOD && hod.role !== ROLES.ADMIN) {
        return fail(res, `User must have role 'hod' to be assigned as HOD. Current role: ${hod.role}`);
      }
    }

    // Validate Team Lead if provided
    if (teamLeadId) {
      if (!isValidId(teamLeadId)) return fail(res, 'Invalid Team Lead user ID');
      const lead = await User.findById(teamLeadId).select('role isActive teamId').lean();
      if (!lead)          return fail(res, 'Team Lead user not found', 404);
      if (!lead.isActive) return fail(res, 'Team Lead user account is inactive');
      if (lead.role !== ROLES.TEAM_LEAD) {
        return fail(res, `User must have role 'team_lead'. Current role: ${lead.role}`);
      }
      // A team lead can only lead one team
      if (lead.teamId) {
        return fail(res, 'This user is already a Team Lead for another team');
      }
    }

    const team = await Team.create({
      name:        name.trim(),
      description: description?.trim() ?? '',
      hod:         hodId     || null,
      teamLead:    teamLeadId || null,
      createdBy:   req.user._id,
    });

    // If a teamLead was assigned, update their User record
    if (teamLeadId) {
      await User.findByIdAndUpdate(teamLeadId, {
        teamId:    team._id,
        reportsTo: hodId || null,
      });
    }

    await team.populate([
      { path: 'hod',      select: 'name email role avatar' },
      { path: 'teamLead', select: 'name email role avatar' },
    ]);

    return ok(res, { team }, 201);
  } catch (err) {
    if (err.code === 11000) return fail(res, 'A team with this name already exists');
    console.error('createTeam:', err);
    return fail(res, 'Server error creating team', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/teams
// @desc    List teams (scoped by caller's role)
// @access  Admin (all), HOD (managed), TeamLead (own), Employee (own)
// ─────────────────────────────────────────────────────────────────────────────

const getTeams = async (req, res) => {
  try {
    const { role, _id } = req.user;
    const { includeInactive = 'false' } = req.query;

    let filter = {};

    if (role === ROLES.ADMIN) {
      if (includeInactive !== 'true') filter.isActive = true;
    } else if (role === ROLES.HOD) {
      filter = { hod: _id, isActive: true };
    } else if (role === ROLES.TEAM_LEAD) {
      filter = { teamLead: _id, isActive: true };
    } else {
      // Employee — return their own team only
      const teamId = req.user.teamId;
      if (!teamId) return ok(res, { teams: [] });
      filter = { _id: teamId, isActive: true };
    }

    const teams = await Team.find(filter)
      .populate('hod',      'name email role avatar')
      .populate('teamLead', 'name email role avatar')
      .select('-members') // don't embed full member list in list view
      .sort({ name: 1 })
      .lean();

    // Attach memberCount to each team without loading full member docs
    const teamIds  = teams.map((t) => t._id);
    const counts   = await Team.aggregate([
      { $match: { _id: { $in: teamIds } } },
      { $project: { memberCount: { $size: '$members' } } },
    ]);

    const countMap = {};
    for (const c of counts) countMap[c._id.toString()] = c.memberCount;

    const result = teams.map((t) => ({
      ...t,
      memberCount: countMap[t._id.toString()] ?? 0,
    }));

    return ok(res, { teams: result });
  } catch (err) {
    console.error('getTeams:', err);
    return fail(res, 'Server error fetching teams', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/teams/:id
// @desc    Get single team with full member list
// @access  Admin, HOD (managed), TeamLead (own), Employee (own team)
// ─────────────────────────────────────────────────────────────────────────────

const getTeamById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return fail(res, 'Invalid team ID');

    const team = await Team.findById(id)
      .populate('hod',      'name email role avatar')
      .populate('teamLead', 'name email role avatar')
      .populate('members',  'name email role avatar teamId reportsTo isActive')
      .lean();

    if (!team) return fail(res, 'Team not found', 404);

    const { role, _id } = req.user;

    // Access check
    if (role !== ROLES.ADMIN) {
      const isHod  = role === ROLES.HOD       && team.hod?._id.toString()      === _id.toString();
      const isLead = role === ROLES.TEAM_LEAD  && team.teamLead?._id.toString() === _id.toString();
      const isMember = team.members?.some((m) => m._id.toString() === _id.toString());

      if (!isHod && !isLead && !isMember) {
        return fail(res, 'Forbidden: you are not associated with this team', 403);
      }
    }

    return ok(res, { team });
  } catch (err) {
    console.error('getTeamById:', err);
    return fail(res, 'Server error', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/teams/:id
// @desc    Update team metadata (name, description)
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────

const updateTeam = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return fail(res, 'Invalid team ID');

    const team = await Team.findById(id);
    if (!team)           return fail(res, 'Team not found', 404);
    if (!team.isActive)  return fail(res, 'Cannot update an inactive team');

    const { name, description } = req.body;

    if (name !== undefined) {
      if (!name.trim()) return fail(res, 'Team name cannot be empty');
      team.name = name.trim();
    }
    if (description !== undefined) team.description = description.trim();

    team.updatedBy = req.user._id;
    await team.save();

    await team.populate([
      { path: 'hod',      select: 'name email role avatar' },
      { path: 'teamLead', select: 'name email role avatar' },
    ]);

    return ok(res, { team });
  } catch (err) {
    if (err.code === 11000) return fail(res, 'A team with this name already exists');
    console.error('updateTeam:', err);
    return fail(res, 'Server error', 500);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/teams/:id/hod
// @desc    Assign or replace the HOD for a team
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────

const assignHod = async (req, res) => {
  try {
    const { id }    = req.params;
    const { hodId } = req.body;

    if (!isValidId(id))    return fail(res, 'Invalid team ID');
    if (!isValidId(hodId)) return fail(res, 'Invalid HOD user ID');

    const [team, hodUser] = await Promise.all([
      Team.findById(id),
      User.findById(hodId).select('role isActive').lean(),
    ]);

    if (!team)             return fail(res, 'Team not found', 404);
    if (!team.isActive)    return fail(res, 'Cannot modify an inactive team');
    if (!hodUser)          return fail(res, 'HOD user not found', 404);
    if (!hodUser.isActive) return fail(res, 'HOD user account is inactive');
    if (hodUser.role !== ROLES.HOD && hodUser.role !== ROLES.ADMIN) {
      return fail(res, `User must have role 'hod'. Current role: ${hodUser.role}`);
    }

    const previousHodId = team.hod;
    team.hod       = hodId;
    team.updatedBy = req.user._id;
    await team.save();

    // Update reportsTo for the team lead (now reports to new HOD)
    if (team.teamLead) {
      await User.findByIdAndUpdate(team.teamLead, { reportsTo: hodId });
    }

    // Update reportsTo for all team members (they report to team lead, unchanged)
    // but reindex if teamLead changed their own reportsTo
    // (no-op here — member → lead chain unchanged)

    await team.populate([
      { path: 'hod',      select: 'name email role avatar' },
      { path: 'teamLead', select: 'name email role avatar' },
    ]);

    return ok(res, {
      team,
      message: previousHodId
        ? 'HOD reassigned successfully'
        : 'HOD assigned successfully',
    });
  } catch (err) {
    console.error('assignHod:', err);
    return fail(res, 'Server error', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/teams/:id/team-lead
// @desc    Assign or replace the Team Lead for a team
// @access  Admin, HOD (for managed teams)
// ─────────────────────────────────────────────────────────────────────────────

const assignTeamLead = async (req, res) => {
  try {
    const { id }         = req.params;
    const { teamLeadId } = req.body;

    if (!isValidId(id))         return fail(res, 'Invalid team ID');
    if (!isValidId(teamLeadId)) return fail(res, 'Invalid Team Lead user ID');

    const [team, leadUser] = await Promise.all([
      Team.findById(id),
      User.findById(teamLeadId).select('role isActive teamId').lean(),
    ]);

    if (!team)          return fail(res, 'Team not found', 404);
    if (!team.isActive) return fail(res, 'Cannot modify an inactive team');

    // HOD can only assign leads to teams they manage
    if (req.user.role === ROLES.HOD) {
      if (team.hod?.toString() !== req.user._id.toString()) {
        return fail(res, 'Forbidden: you do not manage this team', 403);
      }
    }

    if (!leadUser)          return fail(res, 'Team Lead user not found', 404);
    if (!leadUser.isActive) return fail(res, 'Team Lead account is inactive');
    if (leadUser.role !== ROLES.TEAM_LEAD) {
      return fail(res, `User must have role 'team_lead'. Current role: ${leadUser.role}`);
    }

    // Check that target user isn't already a lead elsewhere
    if (leadUser.teamId && leadUser.teamId.toString() !== id) {
      const existingTeam = await Team.findById(leadUser.teamId).select('name').lean();
      return fail(
        res,
        `User is already team lead of "${existingTeam?.name ?? 'another team'}"`
      );
    }

    const previousLeadId = team.teamLead;

    // Unlink old lead from this team
    if (previousLeadId && previousLeadId.toString() !== teamLeadId) {
      await User.findByIdAndUpdate(previousLeadId, {
        $set: { teamId: null, reportsTo: null },
      });
    }

    team.teamLead  = teamLeadId;
    team.updatedBy = req.user._id;
    await team.save();

    // Update new lead's User record
    await User.findByIdAndUpdate(teamLeadId, {
      teamId:    team._id,
      reportsTo: team.hod ?? null,
    });

    await team.populate([
      { path: 'hod',      select: 'name email role avatar' },
      { path: 'teamLead', select: 'name email role avatar' },
    ]);

    return ok(res, {
      team,
      message: previousLeadId
        ? 'Team Lead reassigned successfully'
        : 'Team Lead assigned successfully',
    });
  } catch (err) {
    console.error('assignTeamLead:', err);
    return fail(res, 'Server error', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/teams/:id/members
// @desc    Add a user to the team's member list
// @access  Admin, HOD (managed teams), TeamLead (own team)
// ─────────────────────────────────────────────────────────────────────────────

const addMember = async (req, res) => {
  try {
    const { id }      = req.params;
    const { userId }  = req.body;

    if (!isValidId(id))     return fail(res, 'Invalid team ID');
    if (!isValidId(userId)) return fail(res, 'Invalid user ID');

    const [team, user] = await Promise.all([
      Team.findById(id),
      User.findById(userId).select('role isActive teamId name email').lean(),
    ]);

    if (!team)          return fail(res, 'Team not found', 404);
    if (!team.isActive) return fail(res, 'Cannot modify an inactive team');
    if (!user)          return fail(res, 'User not found', 404);
    if (!user.isActive) return fail(res, 'User account is inactive');

    // Access: caller must be able to manage this team
    if (!canManageTeam(req, team.toObject ? team.toObject() : team)) {
      return fail(res, 'Forbidden: you cannot manage this team', 403);
    }

    // Only users with role 'employee' may be added to a team's member list.
    //
    // Rationale: allowing ROLES.TEAM_LEAD here creates an ambiguous ownership
    // state.  A team_lead's authoritative link to a team is the team.teamLead
    // field, not the members array.  attachTeamContext resolves their scope
    // via Team.findOne({ teamLead: _id }), so placing them in members[] of
    // the same or a different team would cause:
    //   • attachTeamContext to match them as both a lead (full team scope) and
    //     a member (self-only scope from the other team), producing undefined
    //     behaviour depending on which query wins.
    //   • Dual teamId values: teamId is a single ObjectId on User — it cannot
    //     point to two teams simultaneously.
    //
    // If a team_lead needs to be reassigned to a different team, use
    // PATCH /api/teams/:id/team-lead to update team.teamLead, which handles
    // clearing the old team link and setting the new one atomically.
    if (user.role !== ROLES.EMPLOYEE) {
      return fail(
        res,
        `Only users with role 'employee' can be added as team members. ` +
        `User "${user.name}" has role '${user.role}'. ` +
        `To assign a team lead, use PATCH /api/teams/:id/team-lead.`
      );
    }

    // Prevent double-assignment
    if (user.teamId && user.teamId.toString() === id) {
      return fail(res, 'User is already a member of this team');
    }
    if (user.teamId && user.teamId.toString() !== id) {
      return fail(res, 'User already belongs to another team. Remove them first.');
    }

    // Prevent adding as member if they're the team's lead
    if (team.teamLead?.toString() === userId) {
      return fail(res, 'This user is already the Team Lead of this team');
    }

    // Add to members array (use $addToSet to be idempotent)
    await Team.findByIdAndUpdate(id, {
      $addToSet: { members: userId },
      $set:      { updatedBy: req.user._id },
    });

    // Update user's teamId and reportsTo
    await User.findByIdAndUpdate(userId, {
      teamId:    id,
      reportsTo: team.teamLead ?? null,
    });

    return ok(res, {
      message: `${user.name} added to team successfully`,
    });
  } catch (err) {
    console.error('addMember:', err);
    return fail(res, 'Server error', 500);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/teams/:id/members
// @desc    Get all members of a team (with their basic profile)
// @access  Admin, HOD (managed), TeamLead (own), Employee (own team)
// ─────────────────────────────────────────────────────────────────────────────

const getTeamMembers = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return fail(res, 'Invalid team ID');

    const team = await Team.findById(id)
      .populate('hod',      'name email role avatar isActive')
      .populate('teamLead', 'name email role avatar isActive reportsTo')
      .populate('members',  'name email role avatar isActive teamId reportsTo')
      .lean();

    if (!team) return fail(res, 'Team not found', 404);

    const { role, _id } = req.user;

    // Access check
    if (role !== ROLES.ADMIN) {
      const isHod    = role === ROLES.HOD       && team.hod?._id.toString()      === _id.toString();
      const isLead   = role === ROLES.TEAM_LEAD  && team.teamLead?._id.toString() === _id.toString();
      const isMember = team.members?.some((m) => m._id.toString() === _id.toString());

      if (!isHod && !isLead && !isMember) {
        return fail(res, 'Forbidden: you are not associated with this team', 403);
      }
    }

    // Return a structured roster: lead + members in one list with a role tag
    const roster = [];

    if (team.teamLead) {
      roster.push({ ...team.teamLead, teamRole: 'team_lead' });
    }

    for (const member of team.members ?? []) {
      roster.push({ ...member, teamRole: 'member' });
    }

    return ok(res, {
      team: {
        _id:         team._id,
        name:        team.name,
        description: team.description,
        hod:         team.hod,
        isActive:    team.isActive,
      },
      roster,
      memberCount: team.members?.length ?? 0,
    });
  } catch (err) {
    console.error('getTeamMembers:', err);
    return fail(res, 'Server error', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  createTeam,
  getTeams,
  getTeamById,
  updateTeam,
  assignHod,
  assignTeamLead,
  addMember,
  getTeamMembers,
};
