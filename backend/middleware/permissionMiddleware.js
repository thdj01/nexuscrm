'use strict';

const mongoose = require('mongoose');
const Team     = require('../models/Team');
const { ROLES } = require('../models/User');
const { userHasPermission, userHasAnyPermission } = require('../utils/accessControl');
const { resolveDepartmentHierarchyScope } = require('../services/timesheetDepartmentScopeService');

const effectiveRole = (role) => (role === ROLES.MANAGER ? ROLES.HOD : role);

const createError = (message, statusCode = 403) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.isOperational = true;
  return err;
};


// ─────────────────────────────────────────────────────────────────────────────
// Action-level Employee Access permissions
// ─────────────────────────────────────────────────────────────────────────────

const requirePermission = (permission) => (req, _res, next) => {
  if (!req.user) return next(createError('Not authenticated', 401));

  if (!userHasPermission(req.user, permission)) {
    return next(createError(`Access denied. Missing permission: ${permission}`, 403));
  }

  next();
};

const requireAnyPermission = (...permissions) => (req, _res, next) => {
  if (!req.user) return next(createError('Not authenticated', 401));

  if (!userHasAnyPermission(req.user, permissions)) {
    return next(createError(`Access denied. Requires one of: ${permissions.join(', ')}`, 403));
  }

  next();
};

const requireProjectLeadershipRole = (req, _res, next) => {
  if (!req.user) return next(createError('Not authenticated', 401));

  const role = effectiveRole(req.user.role);
  if ([ROLES.ADMIN, ROLES.HOD, ROLES.TEAM_LEAD].includes(role)) return next();

  return next(createError(
    'Only Admin, HOD, and Team Lead users can create projects or change planning-grid structure.',
    403
  ));
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. requireRoles
// ─────────────────────────────────────────────────────────────────────────────

const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(createError('Not authenticated', 401));
  }

  const role = effectiveRole(req.user.role);

  const expandedRoles = new Set(roles.map(effectiveRole));
  if (roles.includes(ROLES.MANAGER)) {
    expandedRoles.add(ROLES.HOD);
    expandedRoles.add(ROLES.TEAM_LEAD);
  }

  if (!expandedRoles.has(role)) {
    return next(
      createError(
        `Access denied. Requires one of: ${[...expandedRoles].join(', ')}. Your role: ${req.user.role}`
      )
    );
  }

  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. attachTeamContext
// ─────────────────────────────────────────────────────────────────────────────

const attachTeamContext = async (req, _res, next) => {
  try {
    if (!req.user) return next(createError('Not authenticated', 401));

    const role = effectiveRole(req.user.role);
    const { _id } = req.user;

    if (role === ROLES.ADMIN) {
      req.teamContext = {
        team:       null,
        teamId:     null,
        memberIds:  null,
        isSelfOnly: false,
        departments: [],
        departmentIds: [],
      };
      return next();
    }

    let team       = null;
    let memberIds  = [];
    let isSelfOnly = false;
    let departments = [];

    if (role === ROLES.HOD || role === ROLES.TEAM_LEAD) {
      // Department Master is the primary source of truth:
      //   HOD       -> all departments in hodDepartments / Department.hod(s)
      //   Team Lead -> the single User.department / Department.teamLead
      // Legacy Team members are merged by the service for backward compatibility.
      const hierarchyScope = await resolveDepartmentHierarchyScope(req.user);
      memberIds = hierarchyScope.employeeIds || [];
      departments = hierarchyScope.departments || [];
      isSelfOnly = hierarchyScope.isSelfOnly;

      const legacyTeamFilter = role === ROLES.HOD
        ? { hod: _id, isActive: true }
        : { teamLead: _id, isActive: true };
      team = await Team.findOne(legacyTeamFilter)
        .select('members teamLead hod')
        .lean();

    } else {
      // EMPLOYEE — can view all team tasks, edit only own
      team = await Team.findOne({
        members:  _id,
        isActive: true,
      })
        .select('members teamLead hod')
        .lean();

      if (team) {
        const idSet = new Set();
        idSet.add(_id.toString());
        if (team.teamLead) idSet.add(team.teamLead.toString());
        for (const member of team.members ?? []) idSet.add(member.toString());
        memberIds  = [...idSet].map((id) => new mongoose.Types.ObjectId(id));
        isSelfOnly = false;
      } else {
        memberIds  = [new mongoose.Types.ObjectId(_id)];
        isSelfOnly = true;
      }
    }

    req.teamContext = {
      team,
      teamId:    team?._id ?? null,
      memberIds,
      isSelfOnly,
      departments,
      departmentIds: departments.map((department) => department._id),
    };

    next();
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. scopeToHierarchy
// ─────────────────────────────────────────────────────────────────────────────

const scopeToHierarchy =
  ({ allowSelfOverride = true } = {}) =>
  (req, _res, next) => {
    try {
      if (!req.teamContext) {
        req.allowedEmployeeIds = [new mongoose.Types.ObjectId(req.user._id)];
        return next();
      }

      const { memberIds } = req.teamContext;
      req.allowedEmployeeIds = memberIds;

      const rawId = req.query.employeeId || req.query.employee;
      if (rawId && mongoose.Types.ObjectId.isValid(rawId)) {
        const requestedId = new mongoose.Types.ObjectId(rawId);

        if (memberIds === null) {
          req.allowedEmployeeIds = [requestedId];
        } else {
          const allowed = memberIds.some(
            (id) => id.toString() === requestedId.toString()
          );
          if (!allowed) {
            return next(
              createError('Forbidden: requested employee is outside your scope')
            );
          }
          req.allowedEmployeeIds = [requestedId];
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };

// ─────────────────────────────────────────────────────────────────────────────
// 4. canEditTask
// ─────────────────────────────────────────────────────────────────────────────

const canEditTask = (req, task) => {
  const role = effectiveRole(req.user.role);
  const { _id } = req.user;
  const taskOwner = task.employee?.toString?.() ?? task.employee;

  if (role === ROLES.ADMIN) return true;

  if (role === ROLES.HOD || role === ROLES.TEAM_LEAD) {
    const { memberIds } = req.teamContext ?? {};
    if (!memberIds) return true;
    return memberIds.some((id) => id.toString() === taskOwner);
  }

  return taskOwner === _id.toString();
};

const canReadTask = (req, taskOwnerId) => {
  const role = effectiveRole(req.user.role);
  const { _id } = req.user;
  const ownerStr = taskOwnerId?.toString?.() ?? taskOwnerId;

  if (role === ROLES.ADMIN) return true;

  if (role === ROLES.HOD || role === ROLES.TEAM_LEAD) {
    const { memberIds } = req.teamContext ?? {};
    if (!memberIds) return true;
    return memberIds.some((id) => id.toString() === ownerStr);
  }

  const { memberIds } = req.teamContext ?? {};
  if (!memberIds) return ownerStr === _id.toString();
  return memberIds.some((id) => id.toString() === ownerStr);
};



// ─────────────────────────────────────────────────────────────────────────────
// 5. Timesheet archive / project-linked permission helpers
// ─────────────────────────────────────────────────────────────────────────────

const isAdminOrHod = (req) => {
  const role = effectiveRole(req.user?.role);
  return role === ROLES.ADMIN || role === ROLES.HOD;
};

const isTaskWithinScope = (req, task) => {
  const role = effectiveRole(req.user?.role);
  const taskOwner = task.employee?.toString?.() ?? task.employee;

  if (role === ROLES.ADMIN) return true;

  const { memberIds } = req.teamContext ?? {};
  if (!memberIds) return taskOwner === req.user?._id?.toString?.();

  return memberIds.some((id) => id.toString() === taskOwner);
};

const canArchiveTimesheetTask = (req, task) => {
  return isAdminOrHod(req) && isTaskWithinScope(req, task);
};

const canRestoreTimesheetTask = (req, task) => {
  return isAdminOrHod(req) && isTaskWithinScope(req, task);
};

const canDeleteArchivedTimesheetTask = (req, task) => {
  return isAdminOrHod(req) && isTaskWithinScope(req, task);
};

const canModifyProjectLinkedTaskStructure = (req, task) => {
  return task?.taskSource !== 'PROJECT' || isAdminOrHod(req);
};

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  requirePermission,
  requireAnyPermission,
  requireProjectLeadershipRole,
  requireRoles,
  attachTeamContext,
  scopeToHierarchy,
  canEditTask,
  canReadTask,
  canArchiveTimesheetTask,
  canRestoreTimesheetTask,
  canDeleteArchivedTimesheetTask,
  canModifyProjectLinkedTaskStructure,
};
