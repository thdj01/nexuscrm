// ─────────────────────────────────────────────────────────────────────────────
// backend/controllers/timesheetController.js  — Phase 1 updated (team + project filter fix)
// ─────────────────────────────────────────────────────────────────────────────
//
// Changes from previous version:
//   • buildDateFilter() ADDED — was called everywhere but never defined;
//     primary cause of all HTTP 500 errors on read routes.
//   • buildViewFilter() now resolves ?teamId= by:
//       1. Loading team.members from the Team collection.
//       2. Intersecting with req.allowedEmployeeIds (hierarchy scope).
//       3. Using the intersection as the employee filter.
//     If the caller has no permission over any member of the requested team,
//     an empty result set is returned (no 403, consistent with scoped queries).
//   • buildAggregateEmployeeMatch() ADDED — used by getSummary / getWorkload /
//     getDailyBreakdown to avoid the inline ObjectId re-cast duplication and
//     to correctly pick up team-filter results from buildViewFilter.
//   • getTasks() and getAllTasks() now also resolve ?teamId= via the same
//     resolveEmployeeScope() helper so all five read endpoints are consistent.
//   • All other endpoints, response shapes, permission checks, and models are
//     UNCHANGED.
//
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

const mongoose      = require('mongoose');
const TimesheetTask = require('../models/TimesheetTask');
const { ROLES }     = require('../models/User');
const {
  getDepartmentEmployeeIds,
  resolveDepartmentHierarchyScope,
} = require('../services/timesheetDepartmentScopeService');
const Team          = require('../models/Team');
const User          = require('../models/User');
const {
  updateLinkedProjectTaskStatusFromTimesheet,
} = require('../services/timesheetProjectReverseSyncService');
const { resolveProjectLockState } = require('../services/projectLockService');
const {
  normalizeTimeTo24Hour,
  timeToMinutes,
  parseDurationToDecimalHours,
} = require('../utils/timesheetTime');
const {
  canEditTask,
  canReadTask,
  canArchiveTimesheetTask,
  canRestoreTimesheetTask,
  canDeleteArchivedTimesheetTask,
  canModifyProjectLinkedTaskStructure,
} = require('../middleware/permissionMiddleware');

// ─────────────────────────────────────────────────────────────────────────────
// Response helpers
// ─────────────────────────────────────────────────────────────────────────────

const ok   = (res, data, statusCode = 200) =>
  res.status(statusCode).json({ success: true, ...data });

const fail = (res, message, statusCode = 400) =>
  res.status(statusCode).json({ success: false, message });

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const VALID_TASK_SOURCES = ['USER', 'PROJECT'];
const VALID_ARCHIVE_REASONS = [
  'PROJECT_TASK_REMOVED',
  'PROJECT_TASK_UNASSIGNED',
  'PROJECT_DELETED',
  'MANUAL_ARCHIVE',
];

function applyArchiveAndSourceFilters(filter, query = {}) {
  const { archived, taskSource } = query;

  if (archived === 'only') {
    filter.isArchived = true;
  } else if (archived === 'include') {
    // intentionally do not filter by isArchived
  } else {
    filter.isArchived = { $ne: true };
  }

  if (taskSource) {
    const normalizedSource = String(taskSource).trim().toUpperCase();
    if (VALID_TASK_SOURCES.includes(normalizedSource)) {
      filter.taskSource = normalizedSource;
    }
  }

  return filter;
}

async function runTimesheetProjectReverseSyncSafe({ task, req } = {}) {
  try {
    return await updateLinkedProjectTaskStatusFromTimesheet({
      timesheetTask: task,
      userId: req?.user?._id,
    });
  } catch (error) {
    console.error('[TimesheetProjectReverseSync] reverse sync failed', {
      taskId: task?._id?.toString?.() || task?._id || null,
      projectId: task?.sourceProject?.toString?.() || task?.sourceProject || task?.project || null,
      sourceTaskKey: task?.sourceTaskKey || '',
      status: task?.status || '',
      error: error?.message || String(error),
    });

    return {
      action: 'failed',
      reason: error?.message || 'Timesheet → Project reverse sync failed',
    };
  }
}

const shouldRunProjectReverseStatusSync = (previousStatus, nextStatus) => (
  previousStatus !== nextStatus
);

async function getLockedProjectStatusChangeMessage(task, previousStatus, nextStatus) {
  if (!task || task.taskSource !== 'PROJECT' || previousStatus === nextStatus) return '';

  const projectId = task.sourceProject || task.project;
  if (!projectId) return '';

  const lockState = await resolveProjectLockState(projectId);
  return lockState.locked ? lockState.reason : '';
}

const normalizeOptionalTimeInput = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return '';
  const normalized = normalizeTimeTo24Hour(value);
  if (!normalized) {
    const error = new Error(`${fieldName} must be a valid time, for example 02:25 PM or 14:25`);
    error.statusCode = 400;
    throw error;
  }
  return normalized;
};

const normalizeOptionalHoursInput = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return 0;
  const normalized = parseDurationToDecimalHours(value);
  if (normalized === null || normalized < 0 || normalized > 24) {
    const error = new Error('Hours must use H.MM or H:MM with minutes from 00 to 59 (for example 1.15 or 1:30)');
    error.statusCode = 400;
    throw error;
  }
  return normalized;
};

const getTimeRangeError = (startTime, endTime) => {
  if (!startTime || !endTime) return null;
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === null || end === null) return null;
  return end > start ? null : 'End time must be after start time';
};

function buildSafeProjectTaskUpdatePayload(req, existing) {
  const role = req.user?.role === ROLES.MANAGER ? ROLES.HOD : req.user?.role;
  const isAdminOrHod = role === ROLES.ADMIN || role === ROLES.HOD;

  if (existing.taskSource !== 'PROJECT' || isAdminOrHod) {
    return { ...req.body };
  }

  const allowedProjectTaskFields = ['hours', 'startTime', 'endTime', 'status', 'remarks', 'employeeRemarks'];
  const blockedFields = Object.keys(req.body).filter(
    (field) => !allowedProjectTaskFields.includes(field)
  );

  if (blockedFields.length > 0) {
    const error = new Error(
      `Project-linked tasks allow employees to update only time tracking, status, and employee remarks. Blocked fields: ${blockedFields.join(', ')}`
    );
    error.statusCode = 403;
    throw error;
  }

  return { ...req.body };
}


// ─────────────────────────────────────────────────────────────────────────────
// buildDateFilter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a MongoDB date-range filter from `from` and `to` query param strings.
 *
 * Returns an object suitable for Object.assign() into a find/aggregate match.
 * Returns {} when neither param is present so callers can always safely spread.
 *
 * Both values are treated as INCLUSIVE boundaries.
 * Date-only values are interpreted in the application timezone (Asia/Kolkata)
 * and converted to UTC boundaries for MongoDB comparisons.
 *
 * @param  {string|undefined} from  — ISO date string, e.g. "2025-01-01"
 * @param  {string|undefined} to    — ISO date string, e.g. "2025-01-31"
 * @returns {object}
 */
function buildDateFilter(from, to) {
  if (!from && !to) return {};

  const parseBoundary = (value, endOfDay = false) => {
    if (!value) return null;
    const text = String(value).trim();
    const dateOnly = text.match(/^(\d{4}-\d{2}-\d{2})$/);
    const parsed = dateOnly
      ? new Date(`${dateOnly[1]}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+05:30`)
      : new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const fromDate = parseBoundary(from, false);
  const toDate = parseBoundary(to, true);
  const dateFilter = {};
  if (fromDate) dateFilter.$gte = fromDate;
  if (toDate) dateFilter.$lte = toDate;
  if (!Object.keys(dateFilter).length) return {};

  // Normal/user tasks are matched by their single date. Project-linked tasks
  // are matched when their assigned planning range overlaps the requested
  // range, so a 17-19 Aug task is visible when viewing 17th, 18th or 19th.
  const rangeOverlap = { taskSource: 'PROJECT' };
  if (toDate) rangeOverlap.sourcePlannedStartDate = { $lte: toDate };
  if (fromDate) rangeOverlap.sourcePlannedEndDate = { $gte: fromDate };

  return {
    $or: [
      { date: dateFilter },
      rangeOverlap,
    ],
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// buildAggregateEmployeeMatch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Like buildEmployeeFilter but always returns ObjectId instances suitable for
 * use inside a MongoDB aggregation $match stage.
 *
 * The middleware already provides ObjectIds in req.allowedEmployeeIds, but
 * calling code previously re-cast them inline with fragile instanceof checks.
 * This helper centralises the cast so aggregate callers stay clean.
 *
 * @param  {object}   req
 * @param  {ObjectId[]|null} [overrideIds]  — supply when you have already
 *   resolved a team-filtered subset; otherwise req.allowedEmployeeIds is used.
 * @returns {object}  — e.g. {} | { employee: ObjectId } | { employee: { $in: [...] } }
 */
function buildAggregateEmployeeMatch(req, overrideIds) {
  const ids = overrideIds !== undefined ? overrideIds : req.allowedEmployeeIds;

  if (ids === null || ids === undefined) return {};

  const cast = ids.map((id) =>
    id instanceof mongoose.Types.ObjectId
      ? id
      : new mongoose.Types.ObjectId(id.toString())
  );

  if (cast.length === 1) return { employee: cast[0] };
  return { employee: { $in: cast } };
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveEmployeeScope
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Central helper that resolves the effective employee ID set for any read
 * operation.  It applies the ?teamId filter on top of req.allowedEmployeeIds
 * (the hierarchy scope already injected by scopeToHierarchy middleware).
 *
 * Rules:
 *   1. Start from req.allowedEmployeeIds  (already scoped by role).
 *   2. If ?teamId is present and valid:
 *        a. Load the Team document.
 *        b. Collect team.members + team.teamLead into a Set.
 *        c. Intersect with the allowed set (null allowed set = admin = no
 *           restriction, so use team set directly).
 *        d. If intersection is empty, return [] (caller sees no tasks).
 *   3. Return the resolved ObjectId array (or null for unrestricted admin with
 *      no teamId filter).
 *
 * @param  {object} req
 * @returns {Promise<ObjectId[]|null>}
 *   null  → unrestricted (admin, no teamId filter)
 *   []    → team filter applied but caller has no matching employees
 *   [...] → resolved employee ObjectId array
 */
async function resolveEmployeeScope(req) {
  const { allowedEmployeeIds } = req;
  const { teamId, departmentId } = req.query;

  let resolvedIds = allowedEmployeeIds;

  // Department Master filter. Non-admin users may select only departments
  // already present in their hierarchy scope; Admin may select any active one.
  if (departmentId) {
    if (!isValidId(departmentId)) return [];

    const allowedDepartmentIds = req.teamContext?.departmentIds || [];
    if (resolvedIds !== null && resolvedIds !== undefined) {
      const allowedDepartment = allowedDepartmentIds.some(
        (id) => id.toString() === departmentId.toString()
      );
      if (!allowedDepartment) return [];
    }

    const departmentEmployeeIds = await getDepartmentEmployeeIds(departmentId);
    const departmentSet = new Set(departmentEmployeeIds.map((id) => id.toString()));

    resolvedIds = resolvedIds === null || resolvedIds === undefined
      ? departmentEmployeeIds
      : resolvedIds.filter((id) => departmentSet.has(id.toString()));
  }

  // No team filter — return the current hierarchy/department scope.
  if (!teamId) return resolvedIds;

  // Invalid teamId — treat as "no match" to avoid 500.
  if (!isValidId(teamId)) return [];

  const team = await Team.findById(teamId).select('members teamLead').lean();
  if (!team) return [];

  const teamMemberSet = new Set();
  if (team.teamLead) teamMemberSet.add(team.teamLead.toString());
  for (const member of team.members ?? []) teamMemberSet.add(member.toString());

  if (resolvedIds === null || resolvedIds === undefined) {
    return [...teamMemberSet].map((id) => new mongoose.Types.ObjectId(id));
  }

  return resolvedIds.filter((id) => teamMemberSet.has(id.toString()));
}

// ─────────────────────────────────────────────────────────────────────────────
// buildViewFilter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shared base filter for the view-specific endpoints (list / kanban / calendar).
 * Called after scopeToHierarchy has run (req.allowedEmployeeIds is available).
 *
 * Applies:  employee scope (with team filter)  +  status  +  taskType
 *           +  project  +  date range
 *
 * @param  {object} req
 * @returns {Promise<object>}  Mongoose find() filter
 */
async function buildViewFilter(req) {
  const { status, taskType, from, to, project } = req.query;

  // Resolve employee scope with optional team filter
  const resolvedIds = await resolveEmployeeScope(req);

  // Build the employee fragment from the resolved IDs
  let filter;
  if (resolvedIds === null || resolvedIds === undefined) {
    filter = {};
  } else if (resolvedIds.length === 1) {
    filter = { employee: resolvedIds[0] };
  } else if (resolvedIds.length === 0) {
    // Team filter produced an empty intersection — return nothing
    filter = { employee: { $in: [] } };
  } else {
    filter = { employee: { $in: resolvedIds } };
  }

  if (status)   filter.status   = status;
  if (taskType) filter.taskType = taskType;

  if (project) {
    if (isValidId(project)) filter.project = new mongoose.Types.ObjectId(project);
    // Invalid project ID: silently ignore rather than 500 (consistent with GET /tasks)
  }

  Object.assign(filter, buildDateFilter(from, to));
  applyArchiveAndSourceFilters(filter, req.query);

  return filter;
}

// ─────────────────────────────────────────────────────────────────────────────
// View-specific handlers
// (GET /api/timesheet/list | /kanban | /calendar)
// ─────────────────────────────────────────────────────────────────────────────

const getListTasks = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const filter = await buildViewFilter(req);
    const lim  = Math.min(100, Number(limit));
    const skip = (Math.max(1, Number(page)) - 1) * lim;

    const [tasks, total] = await Promise.all([
      TimesheetTask.find(filter)
        .populate('employee', 'name email avatar role teamId')
        .populate('createdBy', 'name role')
        .populate('project',  'projectId projectName')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      TimesheetTask.countDocuments(filter),
    ]);

    return ok(res, {
      tasks,
      pagination: {
        total,
        page:       Number(page),
        limit:      lim,
        totalPages: Math.ceil(total / lim),
      },
    });
  } catch (err) {
    console.error('getListTasks:', err);
    return fail(res, 'Server error fetching list tasks', 500);
  }
};

const getKanbanTasks = async (req, res) => {
  try {
    const filter = await buildViewFilter(req);

    const tasks = await TimesheetTask.find(filter)
      .populate('employee', 'name email avatar role teamId')
      .populate('createdBy', 'name role')
      .populate('project',  'projectId projectName')
      .sort({ kanbanOrder: 1, createdAt: 1 })
      .lean();

    return ok(res, { tasks });
  } catch (err) {
    console.error('getKanbanTasks:', err);
    return fail(res, 'Server error fetching kanban tasks', 500);
  }
};

const getCalendarTasks = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return fail(res, 'from and to query params are required');

    const filter = await buildViewFilter(req);

    const tasks = await TimesheetTask.find(filter)
      .populate('employee', 'name email avatar role teamId')
      .populate('createdBy', 'name role')
      .populate('project',  'projectId projectName')
      .sort({ date: 1, startTime: 1 })
      .lean();

    return ok(res, { tasks });
  } catch (err) {
    console.error('getCalendarTasks:', err);
    return fail(res, 'Server error fetching calendar tasks', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/timesheet/tasks
// ─────────────────────────────────────────────────────────────────────────────

const getTasks = async (req, res) => {
  try {
    const { project, status, taskType, from, to, page = 1, limit = 50 } = req.query;

    // Resolve employee scope including optional ?teamId filter
    const resolvedIds = await resolveEmployeeScope(req);

    const filter = {};

    if (resolvedIds === null || resolvedIds === undefined) {
      // Admin, unrestricted
    } else if (resolvedIds.length === 0) {
      filter.employee = { $in: [] };
    } else if (resolvedIds.length === 1) {
      filter.employee = resolvedIds[0];
    } else {
      filter.employee = { $in: resolvedIds };
    }

    if (project) {
      if (!isValidId(project)) return fail(res, 'Invalid project ID');
      filter.project = new mongoose.Types.ObjectId(project);
    }
    if (status)   filter.status   = status;
    if (taskType) filter.taskType = taskType;

    Object.assign(filter, buildDateFilter(from, to));
    applyArchiveAndSourceFilters(filter, req.query);

    const lim  = Math.min(100, Number(limit));
    const skip = (Math.max(1, Number(page)) - 1) * lim;

    const [tasks, total] = await Promise.all([
      TimesheetTask.find(filter)
        .populate('employee', 'name email avatar role teamId')
        .populate('createdBy', 'name role')
        .populate('project',  'projectId projectName')
        .sort({ date: -1, kanbanOrder: 1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      TimesheetTask.countDocuments(filter),
    ]);

    return ok(res, {
      tasks,
      pagination: {
        total,
        page:       Number(page),
        limit:      lim,
        totalPages: Math.ceil(total / lim),
      },
    });
  } catch (err) {
    console.error('getTasks:', err);
    return fail(res, 'Server error fetching tasks', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/timesheet/tasks/:id
// ─────────────────────────────────────────────────────────────────────────────

const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return fail(res, 'Invalid task ID');

    const task = await TimesheetTask.findById(id)
      .populate('employee', 'name email avatar role teamId')
      .populate('createdBy', 'name role')
      .populate('project',  'projectId projectName')
      .lean();

    if (!task) return fail(res, 'Task not found', 404);

    // Use hierarchy-aware read check
    if (!canReadTask(req, task.employee?._id ?? task.employee)) {
      return fail(res, 'Forbidden', 403);
    }

    return ok(res, { task });
  } catch (err) {
    console.error('getTaskById:', err);
    return fail(res, 'Server error', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/timesheet/tasks
// ─────────────────────────────────────────────────────────────────────────────

const createTask = async (req, res) => {
  try {
    const {
      title, description, project, taskType,
      date, startTime, endTime, hours, status, kanbanOrder,
    } = req.body;

    // Determine target employee
    let employeeId = req.user._id;
    if (req.body.employee) {
      if (!isValidId(req.body.employee)) return fail(res, 'Invalid employee ID');

      // Check the caller is allowed to create on behalf of this employee
      const { allowedEmployeeIds } = req;
      if (allowedEmployeeIds !== null && allowedEmployeeIds !== undefined) {
        const allowed = allowedEmployeeIds.some(
          (id) => id.toString() === req.body.employee
        );
        if (!allowed) return fail(res, 'Forbidden: cannot create task for this employee', 403);
      }

      employeeId = req.body.employee;
    }

    if (!title?.trim()) return fail(res, 'Title is required');
    if (!date)          return fail(res, 'Date is required');
    if (!taskType)      return fail(res, 'Task type is required');

    let normalizedStartTime;
    let normalizedEndTime;
    let normalizedHours;
    try {
      normalizedStartTime = normalizeOptionalTimeInput(startTime, 'Start time');
      normalizedEndTime = normalizeOptionalTimeInput(endTime, 'End time');
      normalizedHours = normalizeOptionalHoursInput(hours);
    } catch (error) {
      return fail(res, error.message, error.statusCode || 400);
    }

    const timeRangeError = getTimeRangeError(normalizedStartTime, normalizedEndTime);
    if (timeRangeError) return fail(res, timeRangeError);

    const taskData = {
      employee:    employeeId,
      title:       title.trim(),
      description: description?.trim() ?? '',
      taskType,
      date:        new Date(date),
      status:      status ?? 'Backlog',
      kanbanOrder: kanbanOrder ?? 0,
      createdBy:   req.user._id,
    };

    if (project) {
      if (!isValidId(project)) return fail(res, 'Invalid project ID');
      taskData.project = project;
    }
    if (normalizedStartTime) taskData.startTime = normalizedStartTime;
    if (normalizedEndTime)   taskData.endTime   = normalizedEndTime;
    if (normalizedHours !== undefined && !(normalizedStartTime && normalizedEndTime)) {
      taskData.hours = normalizedHours;
    }

    const task = await TimesheetTask.create(taskData);
    await task.populate([
      { path: 'employee', select: 'name email avatar role teamId' },
      { path: 'project',  select: 'projectId projectName'  },
    ]);

    return ok(res, { task }, 201);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message).join(', ');
      return fail(res, messages);
    }
    console.error('createTask:', err);
    return fail(res, 'Server error creating task', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/timesheet/tasks/:id
// ─────────────────────────────────────────────────────────────────────────────

const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return fail(res, 'Invalid task ID');

    const existing = await TimesheetTask.findById(id);
    if (!existing) return fail(res, 'Task not found', 404);

    if (existing.isArchived) {
      return fail(res, 'Archived tasks are read-only. Restore the task before editing.', 403);
    }

    // Hierarchy-aware edit check
    if (!canEditTask(req, existing)) {
      return fail(res, 'Forbidden: insufficient permission to edit this task', 403);
    }

    // Prevent employee from reassigning task to another employee
    const { role } = req.user;
    const isPrivileged = [ROLES.ADMIN, ROLES.HOD, ROLES.TEAM_LEAD].includes(role);

    if (req.body.employee && !isPrivileged) {
      return fail(res, 'Forbidden: only team leads and above can reassign tasks', 403);
    }

    // If reassigning, validate new employee is within scope
    if (req.body.employee && isPrivileged) {
      if (!isValidId(req.body.employee)) return fail(res, 'Invalid employee ID');
      const { allowedEmployeeIds } = req;
      if (allowedEmployeeIds !== null) {
        const allowed = allowedEmployeeIds.some(
          (id) => id.toString() === req.body.employee
        );
        if (!allowed) return fail(res, 'Forbidden: target employee is outside your scope', 403);
      }
    }

    const previousStatus = existing.status;

    let payload;
    try {
      payload = buildSafeProjectTaskUpdatePayload(req, existing);
    } catch (err) {
      return fail(res, err.message, err.statusCode || 403);
    }

    const PROTECTED = [
      '_id',
      '__v',
      'createdBy',
      'taskSource',
      'sourceProject',
      'sourceProjectId',
      'sourceGridId',
      'sourceGridName',
      'sourceTaskId',
      'sourceTaskKey',
      'sourceTaskName',
      'sourceDepartment',
      'sourcePlannedStartDate',
      'sourcePlannedEndDate',
      'syncStatus',
      'lastSyncedAt',
      'syncError',
      'syncRetryCount',
      'isArchived',
      'archivedAt',
      'archivedBy',
      'archiveReason',
      'restoredAt',
      'restoredBy',
    ];
    if (!isPrivileged) PROTECTED.push('employee');

    PROTECTED.forEach((f) => delete payload[f]);

    if (existing.taskSource === 'PROJECT' && !canModifyProjectLinkedTaskStructure(req, existing)) {
      delete payload.title;
      delete payload.employee;
      delete payload.assignedTo;
      delete payload.project;
      delete payload.taskType;
      delete payload.date;
      delete payload.kanbanOrder;
    }

    if (payload.project && !isValidId(payload.project)) {
      return fail(res, 'Invalid project ID');
    }
    if (payload.date) payload.date = new Date(payload.date);

    try {
      if (payload.startTime !== undefined) {
        payload.startTime = normalizeOptionalTimeInput(payload.startTime, 'Start time');
      }
      if (payload.endTime !== undefined) {
        payload.endTime = normalizeOptionalTimeInput(payload.endTime, 'End time');
      }
      if (payload.hours !== undefined) {
        payload.hours = normalizeOptionalHoursInput(payload.hours);
      }
    } catch (error) {
      return fail(res, error.message, error.statusCode || 400);
    }

    const effectiveStartTime = payload.startTime !== undefined ? payload.startTime : existing.startTime;
    const effectiveEndTime = payload.endTime !== undefined ? payload.endTime : existing.endTime;
    const timeRangeError = getTimeRangeError(effectiveStartTime, effectiveEndTime);
    if (timeRangeError) return fail(res, timeRangeError);

    if (payload.remarks !== undefined) {
      if (existing.taskSource === 'PROJECT') {
        payload.employeeRemarks = payload.remarks;
      } else if (payload.description === undefined) {
        payload.description = payload.remarks;
      }
      delete payload.remarks;
    }

    const nextStatus = payload.status !== undefined ? payload.status : existing.status;
    const lockedProjectMessage = await getLockedProjectStatusChangeMessage(existing, previousStatus, nextStatus);
    if (lockedProjectMessage) return fail(res, lockedProjectMessage, 423);

    Object.assign(existing, payload);
    await existing.save();

    const projectSync = shouldRunProjectReverseStatusSync(previousStatus, existing.status)
      ? await runTimesheetProjectReverseSyncSafe({ task: existing, req })
      : undefined;

    await existing.populate([
      { path: 'employee', select: 'name email avatar role teamId' },
      { path: 'project',  select: 'projectId projectName' },
    ]);

    return ok(res, { task: existing, ...(projectSync ? { projectSync } : {}) });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message).join(', ');
      return fail(res, messages);
    }
    console.error('updateTask:', err);
    return fail(res, 'Server error updating task', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/timesheet/tasks/:id/status
// ─────────────────────────────────────────────────────────────────────────────

const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidId(id)) return fail(res, 'Invalid task ID');
    if (!status)        return fail(res, 'status is required');

    const { TASK_STATUSES } = require('../models/TimesheetTask');
    if (!TASK_STATUSES.includes(status)) {
      return fail(res, `Invalid status. Must be one of: ${TASK_STATUSES.join(', ')}`);
    }

    const task = await TimesheetTask.findById(id);
    if (!task) return fail(res, 'Task not found', 404);

    if (task.isArchived) {
      return fail(res, 'Archived tasks are read-only. Restore the task before updating status.', 403);
    }

    if (!canEditTask(req, task)) {
      return fail(res, 'Forbidden', 403);
    }

    const previousStatus = task.status;
    const lockedProjectMessage = await getLockedProjectStatusChangeMessage(task, previousStatus, status);
    if (lockedProjectMessage) return fail(res, lockedProjectMessage, 423);

    task.status = status;
    await task.save();

    const projectSync = shouldRunProjectReverseStatusSync(previousStatus, task.status)
      ? await runTimesheetProjectReverseSyncSafe({ task, req })
      : undefined;

    return ok(res, { task, ...(projectSync ? { projectSync } : {}) });
  } catch (err) {
    console.error('updateTaskStatus:', err);
    return fail(res, 'Server error', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/timesheet/tasks/:id/kanban
// ─────────────────────────────────────────────────────────────────────────────

const updateKanbanPosition = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, kanbanOrder } = req.body;

    if (!isValidId(id)) return fail(res, 'Invalid task ID');

    const task = await TimesheetTask.findById(id);
    if (!task) return fail(res, 'Task not found', 404);

    if (task.isArchived) {
      return fail(res, 'Archived tasks are read-only. Restore the task before changing kanban position.', 403);
    }

    if (!canEditTask(req, task)) {
      return fail(res, 'Forbidden', 403);
    }

    if (task.taskSource === 'PROJECT' && !canModifyProjectLinkedTaskStructure(req, task)) {
      if (kanbanOrder !== undefined) {
        return fail(res, 'Forbidden: employees cannot reorder project-linked tasks', 403);
      }
    }

    const previousStatus = task.status;
    if (status !== undefined) {
      const lockedProjectMessage = await getLockedProjectStatusChangeMessage(task, previousStatus, status);
      if (lockedProjectMessage) return fail(res, lockedProjectMessage, 423);
    }

    if (status !== undefined)     task.status      = status;
    if (kanbanOrder !== undefined) task.kanbanOrder = Number(kanbanOrder);

    await task.save();

    const projectSync = status !== undefined && shouldRunProjectReverseStatusSync(previousStatus, task.status)
      ? await runTimesheetProjectReverseSyncSafe({ task, req })
      : undefined;

    return ok(res, { task, ...(projectSync ? { projectSync } : {}) });
  } catch (err) {
    console.error('updateKanbanPosition:', err);
    return fail(res, 'Server error', 500);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/timesheet/tasks/:id/archive
// ─────────────────────────────────────────────────────────────────────────────

const archiveTask = async (req, res) => {
  try {
    const { id } = req.params;
    const reason = req.body?.archiveReason || 'MANUAL_ARCHIVE';

    if (!isValidId(id)) return fail(res, 'Invalid task ID');
    if (!VALID_ARCHIVE_REASONS.includes(reason)) {
      return fail(res, `Invalid archive reason. Must be one of: ${VALID_ARCHIVE_REASONS.join(', ')}`);
    }

    const task = await TimesheetTask.findById(id);
    if (!task) return fail(res, 'Task not found', 404);

    if (!canArchiveTimesheetTask(req, task)) {
      return fail(res, 'Forbidden: only Admin/HOD can archive tasks', 403);
    }

    task.isArchived = true;
    task.archivedAt = new Date();
    task.archivedBy = req.user._id;
    task.archiveReason = reason;
    task.restoredAt = undefined;
    task.restoredBy = undefined;

    await task.save();
    await task.populate([
      { path: 'employee', select: 'name email avatar role teamId' },
      { path: 'project',  select: 'projectId projectName' },
      { path: 'archivedBy', select: 'name role' },
    ]);

    return ok(res, { task, message: 'Task archived successfully' });
  } catch (err) {
    console.error('archiveTask:', err);
    return fail(res, 'Server error archiving task', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/timesheet/tasks/:id/restore
// ─────────────────────────────────────────────────────────────────────────────

const restoreTask = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return fail(res, 'Invalid task ID');

    const task = await TimesheetTask.findById(id);
    if (!task) return fail(res, 'Task not found', 404);

    if (!canRestoreTimesheetTask(req, task)) {
      return fail(res, 'Forbidden: only Admin/HOD can restore archived tasks', 403);
    }

    task.isArchived = false;
    task.restoredAt = new Date();
    task.restoredBy = req.user._id;
    task.archivedAt = undefined;
    task.archivedBy = undefined;
    task.archiveReason = undefined;

    await task.save();
    await task.populate([
      { path: 'employee', select: 'name email avatar role teamId' },
      { path: 'project',  select: 'projectId projectName' },
      { path: 'restoredBy', select: 'name role' },
    ]);

    return ok(res, { task, message: 'Task restored successfully' });
  } catch (err) {
    console.error('restoreTask:', err);
    return fail(res, 'Server error restoring task', 500);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// ADMIN / ELEVATED ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route GET /api/timesheet/admin/scope
 * Returns the exact department/employee scope used by the analytics endpoints.
 * Admin receives company-wide scope, HOD receives every assigned department,
 * and Team Lead receives only their single assigned department.
 */
const getAnalyticsScope = async (req, res) => {
  try {
    const scope = await resolveDepartmentHierarchyScope(req.user);
    const isAdmin = scope.role === ROLES.ADMIN;

    const employeeCount = isAdmin
      ? await User.countDocuments({
          isActive: { $ne: false },
          role: { $ne: ROLES.ADMIN },
        })
      : (scope.employeeIds || []).length;

    const departments = (scope.departments || []).map((department) => ({
      _id: department._id,
      name: department.name,
      code: department.code,
    }));

    const scopeLabel = isAdmin
      ? 'All departments'
      : departments.length
        ? departments.map((department) => department.name).join(', ')
        : 'No department assigned';

    return ok(res, {
      scope: {
        role: scope.role,
        scopeLabel,
        departments,
        employeeCount,
        isCompanyWide: isAdmin,
        isSelfOnly: Boolean(scope.isSelfOnly),
      },
    });
  } catch (err) {
    console.error('getAnalyticsScope:', err);
    return fail(res, 'Server error fetching timesheet scope', 500);
  }
};

/**
 * @route GET /api/timesheet/admin/all
 * Also accessible to HOD (scoped to managed teams) and
 * team_lead (scoped to own team). scopeToHierarchy runs before this handler.
 */
const getAllTasks = async (req, res) => {
  try {
    const { project, status, taskType, from, to, page = 1, limit = 50 } = req.query;

    // Resolve employee scope including optional ?teamId filter
    const resolvedIds = await resolveEmployeeScope(req);

    const filter = {};

    if (resolvedIds === null || resolvedIds === undefined) {
      // Admin, unrestricted
    } else if (resolvedIds.length === 0) {
      filter.employee = { $in: [] };
    } else if (resolvedIds.length === 1) {
      filter.employee = resolvedIds[0];
    } else {
      filter.employee = { $in: resolvedIds };
    }

    if (project) {
      if (!isValidId(project)) return fail(res, 'Invalid project ID');
      filter.project = new mongoose.Types.ObjectId(project);
    }
    if (status)   filter.status   = status;
    if (taskType) filter.taskType = taskType;

    Object.assign(filter, buildDateFilter(from, to));
    applyArchiveAndSourceFilters(filter, req.query);

    const lim  = Math.min(100, Number(limit));
    const skip = (Math.max(1, Number(page)) - 1) * lim;

    const [tasks, total] = await Promise.all([
      TimesheetTask.find(filter)
        .populate('employee', 'name email avatar role teamId')
        .populate('createdBy', 'name role')
        .populate('project',  'projectId projectName')
        .sort({ date: -1, kanbanOrder: 1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      TimesheetTask.countDocuments(filter),
    ]);

    return ok(res, {
      tasks,
      pagination: {
        total,
        page:       Number(page),
        limit:      lim,
        totalPages: Math.ceil(total / lim),
      },
    });
  } catch (err) {
    console.error('getAllTasks:', err);
    return fail(res, 'Server error', 500);
  }
};

const getSummary = async (req, res) => {
  try {
    const { from, to, project, status, taskType } = req.query;

    // Resolve scope (respects ?teamId if present)
    const resolvedIds = await resolveEmployeeScope(req);
    const match = buildAggregateEmployeeMatch(req, resolvedIds);

    if (project) {
      if (!isValidId(project)) return fail(res, 'Invalid project ID');
      match.project = new mongoose.Types.ObjectId(project);
    }
    if (status)   match.status   = status;
    if (taskType) match.taskType = taskType;

    Object.assign(match, buildDateFilter(from, to));
    applyArchiveAndSourceFilters(match, req.query);

    const [aggregate, statusBreakdown] = await Promise.all([
      TimesheetTask.aggregate([
        { $match: match },
        { $group: { _id: null, totalHours: { $sum: '$hours' }, totalTasks: { $sum: 1 } } },
      ]),
      TimesheetTask.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const totals = aggregate[0] ?? { totalHours: 0, totalTasks: 0 };

    const statusMap = {};
    statusBreakdown.forEach(({ _id, count }) => { statusMap[_id] = count; });

    const pendingTasks =
      (statusMap['Backlog']     ?? 0) +
      (statusMap['Planned']     ?? 0) +
      (statusMap['In Progress'] ?? 0) +
      (statusMap['Review']      ?? 0);

    const completedTasks = statusMap['Completed'] ?? 0;

    let utilizationPct = null;
    if (from && to) {
      const days = Math.max(
        1,
        Math.ceil((new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24)) + 1
      );
      const distinctEmployees = await TimesheetTask.distinct('employee', match);
      const employeeCount     = distinctEmployees.length || 1;
      const capacityHours     = days * 8 * employeeCount;
      utilizationPct = Math.min(100, Math.round((totals.totalHours / capacityHours) * 100));
    }

    return ok(res, {
      summary: {
        totalHours:      Math.round(totals.totalHours * 100) / 100,
        totalTasks:      totals.totalTasks,
        pendingTasks,
        completedTasks,
        utilizationPct,
        statusBreakdown: statusMap,
      },
    });
  } catch (err) {
    console.error('getSummary:', err);
    return fail(res, 'Server error fetching summary', 500);
  }
};

const getWorkload = async (req, res) => {
  try {
    const { from, to, project, status, taskType } = req.query;

    // Resolve scope (respects ?teamId if present)
    const resolvedIds = await resolveEmployeeScope(req);
    const match = buildAggregateEmployeeMatch(req, resolvedIds);

    if (project) {
      if (!isValidId(project)) return fail(res, 'Invalid project ID');
      match.project = new mongoose.Types.ObjectId(project);
    }
    if (status)   match.status   = status;
    if (taskType) match.taskType = taskType;

    Object.assign(match, buildDateFilter(from, to));
    applyArchiveAndSourceFilters(match, req.query);

    const workload = await TimesheetTask.aggregate([
      { $match: match },
      {
        $group: {
          _id:            '$employee',
          totalHours:     { $sum: '$hours' },
          totalTasks:     { $sum: 1 },
          completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
          pendingTasks:   {
            $sum: {
              $cond: [{ $in: ['$status', ['Backlog', 'Planned', 'In Progress', 'Review']] }, 1, 0],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users', localField: '_id', foreignField: '_id', as: 'employee',
        },
      },
      { $unwind: '$employee' },
      {
        $project: {
          _id:            0,
          employeeId:     '$_id',
          name:           '$employee.name',
          email:          '$employee.email',
          avatar:         '$employee.avatar',
          role:           '$employee.role',
          teamId:         '$employee.teamId',
          totalHours:     { $round: ['$totalHours', 2] },
          totalTasks:     1,
          completedTasks: 1,
          pendingTasks:   1,
        },
      },
      { $sort: { totalHours: -1 } },
    ]);

    return ok(res, { workload });
  } catch (err) {
    console.error('getWorkload:', err);
    return fail(res, 'Server error fetching workload', 500);
  }
};

const getDailyBreakdown = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return fail(res, 'from and to date params are required');

    // Resolve scope (respects ?teamId if present)
    const resolvedIds = await resolveEmployeeScope(req);
    const match = buildAggregateEmployeeMatch(req, resolvedIds);

    Object.assign(match, buildDateFilter(from, to));
    applyArchiveAndSourceFilters(match, req.query);

    const breakdown = await TimesheetTask.aggregate([
      { $match: match },
      {
        $group: {
          _id:       { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          hours:     { $sum: '$hours' },
          taskCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', hours: { $round: ['$hours', 2] }, taskCount: 1 } },
    ]);

    return ok(res, { breakdown });
  } catch (err) {
    console.error('getDailyBreakdown:', err);
    return fail(res, 'Server error', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  updateKanbanPosition,
  archiveTask,
  restoreTask,
  // View-specific
  getListTasks,
  getKanbanTasks,
  getCalendarTasks,
  // Admin / elevated
  getAnalyticsScope,
  getAllTasks,
  getSummary,
  getWorkload,
  getDailyBreakdown,
};