// ─────────────────────────────────────────────────────────────────────────────
// backend/routes/timesheetRoutes.js  — Phase 1 updated
// ─────────────────────────────────────────────────────────────────────────────
//
// Changes from original:
//   • attachTeamContext runs on every route (after protect) so req.teamContext
//     is always populated when controllers call canEditTask / canReadTask.
//   • scopeToHierarchy() is added to every read route to inject
//     req.allowedEmployeeIds before the controller executes.
//   • Admin-only routes now also accept 'hod' and 'team_lead' with automatic
//     scope restriction (they only see their managed employees' data).
//   • authorize() calls updated to use requireRoles() from permissionMiddleware
//     for consistency; authorize() is kept for backward-compat elsewhere.
//
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

const express = require('express');
const { protect, authorizeHierarchy } = require('../middleware/authMiddleware');
const {
  requireRoles,
  attachTeamContext,
  scopeToHierarchy,
} = require('../middleware/permissionMiddleware');

const {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  updateKanbanPosition,
  archiveTask,
  restoreTask,
  getListTasks,
  getKanbanTasks,
  getCalendarTasks,
  getAllTasks,
  getSummary,
  getWorkload,
  getDailyBreakdown,
} = require('../controllers/timesheetController');

const router = express.Router();

// ── Auth + team context applied to every timesheet route ─────────────────────
router.use(protect);
router.use(attachTeamContext);

// ─────────────────────────────────────────────────────────────────────────────
// View-specific read routes
// scopeToHierarchy injects req.allowedEmployeeIds; controllers just filter.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/timesheet/list
 *   Paginated list sorted by date desc.
 *   All roles — each sees only their permitted scope.
 */
router.get('/list',     scopeToHierarchy(), getListTasks);

/**
 * GET /api/timesheet/kanban
 *   All tasks sorted by kanbanOrder asc (no pagination).
 */
router.get('/kanban',   scopeToHierarchy(), getKanbanTasks);

/**
 * GET /api/timesheet/calendar
 *   Tasks within a date window. Requires from + to query params.
 */
router.get('/calendar', scopeToHierarchy(), getCalendarTasks);

// ─────────────────────────────────────────────────────────────────────────────
// Task CRUD routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET  /api/timesheet/tasks   — scoped list (all roles)
 * POST /api/timesheet/tasks   — create (all roles; employee scoped to self)
 */
router
  .route('/tasks')
  .get(scopeToHierarchy(), getTasks)
  .post(scopeToHierarchy(), createTask);


/**
 * Project/user task archive lifecycle routes.
 * Archive / restore are enforced in the controller: Admin + HOD only.
 */
router.patch('/tasks/:id/archive', scopeToHierarchy(), archiveTask);
router.patch('/tasks/:id/restore', scopeToHierarchy(), restoreTask);

/**
 * GET    /api/timesheet/tasks/:id
 * PUT    /api/timesheet/tasks/:id
 *
 * attachTeamContext (already applied) gives canEditTask/canReadTask the
 * context they need; no extra middleware required here.
 */
router
  .route('/tasks/:id')
  .get(getTaskById)
  .put(scopeToHierarchy(), updateTask);

/**
 * PATCH /api/timesheet/tasks/:id/status
 */
router.patch('/tasks/:id/status', scopeToHierarchy(), updateTaskStatus);

/**
 * PATCH /api/timesheet/tasks/:id/kanban
 */
router.patch('/tasks/:id/kanban', scopeToHierarchy(), updateKanbanPosition);

// ─────────────────────────────────────────────────────────────────────────────
// Elevated routes
// Previously admin-only; now also accessible to hod + team_lead with
// automatic scope restriction applied by scopeToHierarchy().
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/timesheet/admin/all
 *   admin  → all employees
 *   hod    → managed teams only
 *   team_lead → own team only
 */
router.get(
  '/admin/all',
  authorizeHierarchy('team_lead'),   // minimum role: team_lead
  scopeToHierarchy(),
  getAllTasks
);

/**
 * GET /api/timesheet/admin/summary
 */
router.get(
  '/admin/summary',
  authorizeHierarchy('team_lead'),
  scopeToHierarchy(),
  getSummary
);

/**
 * GET /api/timesheet/admin/workload
 */
router.get(
  '/admin/workload',
  authorizeHierarchy('team_lead'),
  scopeToHierarchy(),
  getWorkload
);

/**
 * GET /api/timesheet/admin/daily-breakdown
 */
router.get(
  '/admin/daily-breakdown',
  authorizeHierarchy('team_lead'),
  scopeToHierarchy(),
  getDailyBreakdown
);

module.exports = router;
