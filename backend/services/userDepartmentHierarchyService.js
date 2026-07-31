'use strict';

const mongoose = require('mongoose');
const Department = require('../models/Department');
const Team = require('../models/Team');
const User = require('../models/User');
const { ROLES } = require('../models/User');

const normalizeRole = (value = '') => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s-]+/g, '_');

const effectiveRole = (value = '') => {
  const role = normalizeRole(value);
  return role === ROLES.MANAGER ? ROLES.HOD : role;
};

const idString = (value) => {
  if (!value) return '';
  const candidate = value?._id || value?.id || value?.value || value;
  if (!candidate) return '';
  if (typeof candidate.toHexString === 'function') return candidate.toHexString();
  return String(candidate).trim();
};

const uniqueValidIds = (values = []) => {
  const seen = new Set();
  return (Array.isArray(values) ? values : [values])
    .map(idString)
    .filter((value) => mongoose.Types.ObjectId.isValid(value))
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
};

const sameId = (left, right) => {
  const a = idString(left);
  const b = idString(right);
  return Boolean(a && b && a === b);
};

/**
 * Keep Department Master aligned after an administrator edits a user.
 * User Management remains the authority for the user's designation/role and
 * department ownership; Department Master mirrors those values.
 */
async function syncUserHierarchyToDepartments(user) {
  if (!user?._id) return;

  const userId = user._id;
  const role = user.isActive === false ? '' : effectiveRole(user.role);
  const hodDepartmentIds = role === ROLES.HOD
    ? uniqueValidIds(user.hodDepartments)
    : [];
  const hodObjectIds = hodDepartmentIds.map((id) => new mongoose.Types.ObjectId(id));

  // Remove stale HOD ownership from departments no longer assigned to this user.
  await Department.updateMany(
    {
      hods: userId,
      ...(hodObjectIds.length ? { _id: { $nin: hodObjectIds } } : {}),
    },
    { $pull: { hods: userId } }
  );

  await Department.updateMany(
    {
      hod: userId,
      ...(hodObjectIds.length ? { _id: { $nin: hodObjectIds } } : {}),
    },
    { $set: { hod: null } }
  );

  if (hodObjectIds.length) {
    await Department.updateMany(
      { _id: { $in: hodObjectIds }, isActive: true },
      { $addToSet: { hods: userId } }
    );

    await Department.updateMany(
      {
        _id: { $in: hodObjectIds },
        isActive: true,
        $or: [{ hod: null }, { hod: { $exists: false } }],
      },
      { $set: { hod: userId } }
    );
  }

  const teamLeadDepartmentId = role === ROLES.TEAM_LEAD
    ? uniqueValidIds([user.department])[0] || ''
    : '';
  const teamLeadDepartmentObjectId = teamLeadDepartmentId
    ? new mongoose.Types.ObjectId(teamLeadDepartmentId)
    : null;

  // A Team Lead can be the selected lead of only the currently assigned
  // Department Master record. Role/department changes clear stale references.
  await Department.updateMany(
    {
      teamLead: userId,
      ...(teamLeadDepartmentObjectId ? { _id: { $ne: teamLeadDepartmentObjectId } } : {}),
    },
    { $set: { teamLead: null } }
  );

  if (teamLeadDepartmentObjectId) {
    const selectedDepartment = await Department.findOne({
      _id: teamLeadDepartmentObjectId,
      isActive: true,
    })
      .select('_id teamLead')
      .lean();
    const displacedLeadId = idString(selectedDepartment?.teamLead);

    await Department.updateOne(
      { _id: teamLeadDepartmentObjectId, isActive: true },
      { $set: { teamLead: userId } }
    );

    if (displacedLeadId && displacedLeadId !== idString(userId)) {
      const displacedLead = await User.findById(displacedLeadId)
        .select('_id role department')
        .lean();
      const leadsLegacyTeam = await Team.exists({
        teamLead: displacedLeadId,
        isActive: { $ne: false },
      });

      if (
        displacedLead &&
        effectiveRole(displacedLead.role) === ROLES.TEAM_LEAD &&
        sameId(displacedLead.department, teamLeadDepartmentId) &&
        !leadsLegacyTeam
      ) {
        await User.updateOne(
          { _id: displacedLeadId },
          { $set: { role: ROLES.EMPLOYEE, department: teamLeadDepartmentId } }
        );
      }
    }
  }

  // Keep the legacy Team hierarchy safe when a designation is changed away
  // from Team Lead. We do not create Team records from Department assignments.
  if (role !== ROLES.TEAM_LEAD) {
    await Team.updateMany({ teamLead: userId }, { $set: { teamLead: null } });
    if (user.teamId) {
      user.teamId = null;
      user.reportsTo = null;
      await User.updateOne(
        { _id: userId },
        { $set: { teamId: null, reportsTo: null } }
      );
    }
  }
}

/**
 * Keep User Management aligned after an administrator edits Department Master.
 * Selecting leadership in Department Master updates the corresponding user
 * designation and department ownership immediately.
 */
async function syncDepartmentHierarchyToUsers({
  departmentId,
  previousHods = [],
  nextHods = [],
  previousTeamLead = null,
  nextTeamLead = null,
  isActive = true,
}) {
  const departmentKey = idString(departmentId);
  if (!mongoose.Types.ObjectId.isValid(departmentKey)) return;

  const departmentObjectId = new mongoose.Types.ObjectId(departmentKey);
  const previousHodIds = uniqueValidIds(previousHods);
  const nextHodIds = isActive ? uniqueValidIds(nextHods) : [];
  const nextHodSet = new Set(nextHodIds);
  const removedHodIds = previousHodIds.filter((id) => !nextHodSet.has(id));

  if (removedHodIds.length) {
    await User.updateMany(
      { _id: { $in: removedHodIds } },
      { $pull: { hodDepartments: { $in: [departmentKey, departmentObjectId] } } }
    );
  }

  if (nextHodIds.length) {
    await User.updateMany(
      { _id: { $in: nextHodIds }, isActive: true },
      {
        $set: { role: ROLES.HOD, department: '', teamId: null, reportsTo: null },
        $addToSet: { hodDepartments: departmentKey },
      }
    );

    await Department.updateMany(
      { teamLead: { $in: nextHodIds } },
      { $set: { teamLead: null } }
    );
    await Team.updateMany(
      { teamLead: { $in: nextHodIds } },
      { $set: { teamLead: null } }
    );
  }

  const previousLeadId = idString(previousTeamLead);
  const nextLeadId = isActive ? idString(nextTeamLead) : '';

  if (
    previousLeadId &&
    mongoose.Types.ObjectId.isValid(previousLeadId) &&
    previousLeadId !== nextLeadId
  ) {
    const previousLead = await User.findById(previousLeadId)
      .select('_id role department teamId')
      .lean();

    const stillLeadsLegacyTeam = await Team.exists({
      teamLead: previousLeadId,
      isActive: { $ne: false },
    });

    if (
      previousLead &&
      effectiveRole(previousLead.role) === ROLES.TEAM_LEAD &&
      sameId(previousLead.department, departmentKey) &&
      !stillLeadsLegacyTeam
    ) {
      await User.updateOne(
        { _id: previousLeadId },
        { $set: { role: ROLES.EMPLOYEE, department: departmentKey } }
      );
    }
  }

  if (nextLeadId && mongoose.Types.ObjectId.isValid(nextLeadId)) {
    const nextLeadUser = await User.findById(nextLeadId)
      .select('_id role')
      .lean();

    await User.updateOne(
      { _id: nextLeadId, isActive: true },
      {
        $set: {
          role: ROLES.TEAM_LEAD,
          department: departmentKey,
          hodDepartments: [],
        },
      }
    );

    await Department.updateMany(
      { hods: nextLeadId },
      { $pull: { hods: nextLeadId } }
    );
    await Department.updateMany(
      { hod: nextLeadId },
      { $set: { hod: null } }
    );

    // If this user was previously an HOD, clear legacy Team HOD ownership too.
    // Existing Team Lead membership is preserved because the designation stays
    // Team Lead and may still be used by older project/timesheet records.
    if (effectiveRole(nextLeadUser?.role) === ROLES.HOD) {
      await Team.updateMany(
        { hod: nextLeadId },
        { $set: { hod: null } }
      );
    }
  }
}

module.exports = {
  effectiveRole,
  idString,
  sameId,
  syncUserHierarchyToDepartments,
  syncDepartmentHierarchyToUsers,
};
