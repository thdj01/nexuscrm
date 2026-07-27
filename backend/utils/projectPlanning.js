'use strict';

const {
  SUPPORTED_PROJECT_DEPARTMENTS,
  SUPPORTED_PANEL_TYPES,
  PLANNING_MODES,
  TASK_STATUSES,
  EXCEL_PLANNING_CATALOG,
  isKickoffTask,
  normalizeTaskName,
  isDepartmentAllowedForPanel,
} = require('../config/projectPlanningCatalog');

const MS_PER_DAY = 86400000;

function startOfDay(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function isSunday(value) {
  const date = startOfDay(value);
  return Boolean(date && date.getDay() === 0);
}

function sameCalendarDay(leftValue, rightValue) {
  const left = startOfDay(leftValue);
  const right = startOfDay(rightValue);
  return Boolean(left && right && left.getTime() === right.getTime());
}

function assertPlanningStartDateAllowed(value, options = {}) {
  if (!value) return null;

  const date = startOfDay(value);
  if (!date) {
    const error = new Error('Planning start date is invalid.');
    error.statusCode = 400;
    throw error;
  }

  const existingValue = options.existingValue;
  if (existingValue && sameCalendarDay(date, existingValue)) return date;

  if (isSunday(date)) {
    const error = new Error('Sunday is not allowed as a planning start date. Select Monday to Saturday.');
    error.statusCode = 400;
    throw error;
  }

  const today = startOfDay(options.today || new Date());
  if (today && date < today) {
    const error = new Error('Previous dates are not allowed as a planning start date. Select today or a future working day.');
    error.statusCode = 400;
    throw error;
  }

  return date;
}

function nextWorkingDay(value, includeCurrent = false) {
  const date = startOfDay(value);
  if (!date) return null;
  if (!includeCurrent) date.setDate(date.getDate() + 1);
  while (date.getDay() === 0) date.setDate(date.getDate() + 1);
  return date;
}

function addWorkingDays(value, count) {
  const date = startOfDay(value);
  if (!date) return null;
  let remaining = Math.max(0, Number(count) || 0);
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0) remaining -= 1;
  }
  return date;
}

function workingDaysBetween(fromValue, toValue) {
  const from = startOfDay(fromValue);
  const to = startOfDay(toValue);
  if (!from || !to || to <= from) return 0;
  let total = 0;
  const cursor = new Date(from);
  while (cursor < to) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor <= to && cursor.getDay() !== 0) total += 1;
  }
  return total;
}

function positiveInteger(value, fieldName) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    const error = new Error(`${fieldName} must be a positive whole number.`);
    error.statusCode = 400;
    throw error;
  }
  return number;
}

function normalizeTaskStatus(value) {
  const text = String(value || 'Pending').trim();
  if (text === 'Hold') return 'On Hold';
  if (text === 'Not Started') return 'Pending';
  if (text === 'Delayed') return 'Delay';
  return TASK_STATUSES.includes(text) ? text : 'Pending';
}

function effectiveTaskStatus(task, now = new Date()) {
  const stored = normalizeTaskStatus(task.status);
  if (stored === 'Completed' || stored === 'On Hold') return stored;
  const end = startOfDay(task.plannedEndDate || task.endDate);
  const today = startOfDay(now);
  return end && today > end ? 'Delay' : stored;
}

function calculateDelayedDays(task, now = new Date()) {
  const end = startOfDay(task.plannedEndDate || task.endDate);
  if (!end) return 0;
  const status = normalizeTaskStatus(task.status);
  if (status === 'On Hold') return 0;
  const relevant = status === 'Completed'
    ? startOfDay(task.actualCompletedDate || task.completionDate)
    : startOfDay(now);
  return relevant && relevant > end ? workingDaysBetween(end, relevant) : 0;
}

function recalculateTaskSequence(tasks = []) {
  return tasks
    .filter((task) => !isKickoffTask(task.taskName))
    .map((rawTask, index) => {
      const duration = positiveInteger(rawTask.totalDays ?? rawTask.duration ?? 1, `Days for task ${index + 1}`);
      const plannedStartDate = startOfDay(rawTask.plannedStartDate || rawTask.startDate) || null;
      const plannedEndDate = plannedStartDate ? addWorkingDays(plannedStartDate, duration - 1) : null;
      const task = {
        ...rawTask,
        order: index + 1,
        taskName: normalizeTaskName(rawTask.taskName),
        totalDays: duration,
        duration,
        plannedStartDate,
        plannedEndDate,
        status: normalizeTaskStatus(rawTask.status),
      };
      task.delayDays = calculateDelayedDays(task);
      return task;
    });
}

function panelSelectionKey(department, panelType) {
  return `${department}::${panelType}`;
}

function validatePanelSelections(selectedDepartments = [], panelSelections = []) {
  const departmentSet = new Set(selectedDepartments);
  if (departmentSet.size !== selectedDepartments.length) throw new Error('Duplicate project department selection is not allowed.');
  selectedDepartments.forEach((department) => {
    if (!SUPPORTED_PROJECT_DEPARTMENTS.includes(department)) throw new Error(`Unsupported project department: ${department}`);
  });

  const seen = new Set();
  const normalized = panelSelections.map((selection) => {
    const department = String(selection.department || '').trim();
    const panelType = String(selection.panelType || '').trim();
    if (!departmentSet.has(department)) throw new Error(`Panel selection department ${department} is not selected for the project.`);
    if (!SUPPORTED_PANEL_TYPES.includes(panelType)) throw new Error(`Unsupported panel type: ${panelType}`);
    if (!isDepartmentAllowedForPanel(department, panelType)) {
      throw new Error(`${department} department is not available for ${panelType} panel planning.`);
    }
    const quantity = positiveInteger(selection.quantity, `${department} ${panelType} panel quantity`);
    const planningMode = quantity === 1 ? 'common' : String(selection.planningMode || '').trim().toLowerCase();
    if (quantity > 1 && !PLANNING_MODES.includes(planningMode)) {
      throw new Error(`${department} ${panelType} requires Common or Separate planning.`);
    }
    const key = panelSelectionKey(department, panelType);
    if (seen.has(key)) throw new Error(`Duplicate panel selection: ${department} / ${panelType}`);
    seen.add(key);
    return { department, panelType, quantity, planningMode };
  });

  selectedDepartments.forEach((department) => {
    if (!normalized.some((selection) => selection.department === department)) {
      throw new Error(`Select at least one panel type for ${department}.`);
    }
  });
  return normalized;
}

function initialTasksForDepartment(department) {
  return (EXCEL_PLANNING_CATALOG.tasksByDepartment[department] || []).map((task, index) => ({
    ...task,
    taskId: `${department.slice(0, 3).toUpperCase()}-${index + 1}`,
    order: index + 1,
  }));
}

module.exports = {
  MS_PER_DAY,
  startOfDay,
  isSunday,
  sameCalendarDay,
  assertPlanningStartDateAllowed,
  nextWorkingDay,
  addWorkingDays,
  workingDaysBetween,
  positiveInteger,
  normalizeTaskStatus,
  effectiveTaskStatus,
  calculateDelayedDays,
  recalculateTaskSequence,
  panelSelectionKey,
  validatePanelSelections,
  initialTasksForDepartment,
};
