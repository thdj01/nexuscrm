// frontend/src/api/timesheetService.js
import API from './axios';

// ─────────────────────────────────────────────────────────────────────────────
// Task CRUD
// ─────────────────────────────────────────────────────────────────────────────

export const fetchTasks = (params = {}) =>
  API.get('/timesheet/tasks', { params }).then((r) => r.data);

export const fetchTaskById = (id) =>
  API.get(`/timesheet/tasks/${id}`).then((r) => r.data);

export const createTask = (payload) =>
  API.post('/timesheet/tasks', payload).then((r) => r.data);

export const updateTask = (id, payload) =>
  API.put(`/timesheet/tasks/${id}`, payload).then((r) => r.data);

export const updateTaskStatus = (id, status) =>
  API.patch(`/timesheet/tasks/${id}/status`, { status }).then((r) => r.data);

export const updateKanbanPosition = (id, payload) =>
  API.patch(`/timesheet/tasks/${id}/kanban`, payload).then((r) => r.data);

// ─────────────────────────────────────────────────────────────────────────────
// View-specific task endpoints
// ─────────────────────────────────────────────────────────────────────────────

export const fetchListTasks = (params = {}) =>
  API.get('/timesheet/list', { params }).then((r) => r.data);

export const fetchKanbanTasks = (params = {}) =>
  API.get('/timesheet/kanban', { params }).then((r) => r.data);

export const fetchCalendarTasks = (params = {}) =>
  API.get('/timesheet/calendar', { params }).then((r) => r.data);

// ─────────────────────────────────────────────────────────────────────────────
// Admin / Manager endpoints
// ─────────────────────────────────────────────────────────────────────────────

export const fetchAnalyticsScope = () =>
  API.get('/timesheet/admin/scope').then((r) => r.data);

export const fetchAllTasks = (params = {}) =>
  API.get('/timesheet/admin/all', { params }).then((r) => r.data);

export const fetchSummary = (params = {}) =>
  API.get('/timesheet/admin/summary', { params }).then((r) => r.data);

export const fetchWorkload = (params = {}) =>
  API.get('/timesheet/admin/workload', { params }).then((r) => r.data);

export const fetchDailyBreakdown = (params = {}) =>
  API.get('/timesheet/admin/daily-breakdown', { params }).then((r) => r.data);

// ─────────────────────────────────────────────────────────────────────────────
// Assignable users — scoped to caller's hierarchy
//
// Returns users the logged-in caller is permitted to assign tasks to:
//   admin     → all active users
//   hod       → team leads + employees in managed teams
//   team_lead → employees in own team
//   employee  → themselves only
// ─────────────────────────────────────────────────────────────────────────────
export const fetchAssignableUsers = () =>
  API.get('/users/assignable').then((r) => r.data);
// ─────────────────────────────────────────────────────────────────────────────
// Archive / restore lifecycle
// ─────────────────────────────────────────────────────────────────────────────
export const archiveTask = (id) =>
  API.patch(`/timesheet/tasks/${id}/archive`).then((r) => r.data);

export const restoreTask = (id) =>
  API.patch(`/timesheet/tasks/${id}/restore`).then((r) => r.data);
