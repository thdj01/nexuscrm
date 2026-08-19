// ─────────────────────────────────────────────────────────────────────────────
// backend/services/timesheetProjectReverseSyncService.js
//
// Timesheet → Project reverse sync for PROJECT-linked task status only.
// Keeps project planning task status aligned when a user changes the
// corresponding Timesheet task status changes.
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

const mongoose = require('mongoose');
const Project = require('../models/Project');
const {
  extractProjectPlanningTasks,
} = require('./projectTimesheetSyncService');

const SYNC_LOG_PREFIX = '[TimesheetProjectReverseSync]';

const TIMESHEET_TO_PROJECT_STATUS = Object.freeze({
  Backlog: 'Pending',
  Planned: 'Pending',
  'In Progress': 'In Progress',
  Review: 'In Progress',
  Completed: 'Completed',
});

const getIdValue = (value) => {
  if (!value) return null;

  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (typeof value === 'string') return value.trim() || null;

  if (typeof value === 'object') {
    if (value._id) return getIdValue(value._id);
    if (value.id) return getIdValue(value.id);
  }

  if (typeof value.toString === 'function') {
    const text = value.toString();
    return text && text !== '[object Object]' ? text : null;
  }

  return null;
};

const toObjectIdOrNull = (value) => {
  const id = getIdValue(value);
  return id && mongoose.Types.ObjectId.isValid(id)
    ? new mongoose.Types.ObjectId(id)
    : null;
};

const logSync = (event, details = {}) => {
  console.log(SYNC_LOG_PREFIX, event, details);
};

const logSyncError = (event, details = {}) => {
  console.error(SYNC_LOG_PREFIX, event, details);
};

const mapTimesheetStatusToProjectStatus = (status) => (
  TIMESHEET_TO_PROJECT_STATUS[String(status || '').trim()] || null
);

const calculateTaskCompletion = (planningTasks = []) => {
  if (!Array.isArray(planningTasks) || planningTasks.length === 0) return 0;
  const completed = planningTasks.filter((task) => task?.status === 'Completed').length;
  return Math.round((completed / planningTasks.length) * 100);
};

const flattenPlanningGrids = (planningGrids = []) => (
  (planningGrids || []).flatMap((grid) => {
    const tasks = Array.isArray(grid?.planningTasks) ? grid.planningTasks : [];
    return tasks.map((task) => (typeof task.toObject === 'function' ? task.toObject() : task));
  })
);

const recalculateProjectCompletion = (project) => {
  const grids = Array.isArray(project.planningGrids) ? project.planningGrids : [];

  if (grids.length > 0) {
    grids.forEach((grid) => {
      grid.completionPercentage = calculateTaskCompletion(grid.planningTasks || []);
    });

    project.planningTasks = flattenPlanningGrids(grids);
    project.completionPercentage = Math.round(
      grids.reduce((sum, grid) => sum + Number(grid.completionPercentage || 0), 0) / grids.length
    );
    return;
  }

  project.completionPercentage = calculateTaskCompletion(project.planningTasks || []);
};

const findMatchingProjectPlanningTask = (project, timesheetTask) => {
  const sourceTaskKey = timesheetTask?.sourceTaskKey || '';
  const sourceGridId = timesheetTask?.sourceGridId || '';
  const sourceTaskId = timesheetTask?.sourceTaskId || '';
  const sourceTaskName = timesheetTask?.sourceTaskName || timesheetTask?.title || '';

  const sourceTasks = extractProjectPlanningTasks(project || {});

  const bySourceTaskKey = sourceTasks.find((sourceTask) => (
    sourceTask?.sourceTaskKey && sourceTask.sourceTaskKey === sourceTaskKey
  ));
  if (bySourceTaskKey) return bySourceTaskKey;

  const byGridAndTaskId = sourceTasks.find((sourceTask) => (
    sourceGridId &&
    sourceTaskId &&
    String(sourceTask.gridId || '').trim() === String(sourceGridId).trim() &&
    String(sourceTask.planningTask?.taskId || '').trim() === String(sourceTaskId).trim()
  ));
  if (byGridAndTaskId) return byGridAndTaskId;

  return sourceTasks.find((sourceTask) => (
    sourceGridId &&
    sourceTaskName &&
    String(sourceTask.gridId || '').trim() === String(sourceGridId).trim() &&
    String(sourceTask.planningTask?.taskName || '').trim() === String(sourceTaskName).trim()
  )) || null;
};

const updateLinkedProjectTaskStatusFromTimesheet = async ({ timesheetTask, userId = null } = {}) => {
  if (!timesheetTask) {
    return { action: 'skipped', reason: 'NO_TIMESHEET_TASK' };
  }

  if (timesheetTask.taskSource !== 'PROJECT') {
    return { action: 'skipped', reason: 'NOT_PROJECT_LINKED_TASK' };
  }

  const projectStatus = mapTimesheetStatusToProjectStatus(timesheetTask.status);
  if (!projectStatus) {
    return {
      action: 'skipped',
      reason: 'STATUS_NOT_ELIGIBLE_FOR_PROJECT_REVERSE_SYNC',
      timesheetStatus: timesheetTask.status,
    };
  }

  const projectObjectId = toObjectIdOrNull(timesheetTask.sourceProject || timesheetTask.project);
  if (!projectObjectId) {
    return { action: 'skipped', reason: 'NO_LINKED_PROJECT_ID' };
  }

  const project = await Project.findById(projectObjectId);
  if (!project) {
    return {
      action: 'skipped',
      reason: 'PROJECT_NOT_FOUND',
      projectId: projectObjectId.toString(),
    };
  }

  const matchedSourceTask = findMatchingProjectPlanningTask(project, timesheetTask);
  if (!matchedSourceTask?.planningTask) {
    logSyncError('project planning task not found', {
      timesheetTaskId: getIdValue(timesheetTask._id),
      projectId: projectObjectId.toString(),
      sourceTaskKey: timesheetTask.sourceTaskKey || '',
      sourceGridId: timesheetTask.sourceGridId || '',
      sourceTaskId: timesheetTask.sourceTaskId || '',
      sourceTaskName: timesheetTask.sourceTaskName || timesheetTask.title || '',
    });

    return {
      action: 'skipped',
      reason: 'PROJECT_PLANNING_TASK_NOT_FOUND',
      projectId: projectObjectId.toString(),
    };
  }

  const planningTask = matchedSourceTask.planningTask;
  const oldStatus = planningTask.status || 'Pending';

  if (oldStatus === projectStatus) {
    return {
      action: 'skipped',
      reason: 'PROJECT_TASK_STATUS_ALREADY_MATCHED',
      projectId: projectObjectId.toString(),
      sourceTaskKey: timesheetTask.sourceTaskKey || matchedSourceTask.sourceTaskKey || '',
      projectStatus,
    };
  }

  planningTask.status = projectStatus;

  if (projectStatus === 'Completed') {
    planningTask.actualCompletedDate = planningTask.actualCompletedDate || new Date();
  } else {
    planningTask.actualCompletedDate = undefined;
  }

  recalculateProjectCompletion(project);

  project.markModified('planningGrids');
  project.markModified('planningTasks');
  project.markModified('completionPercentage');

  await project.save();

  const result = {
    action: 'updated',
    projectId: project.projectId || projectObjectId.toString(),
    projectObjectId: projectObjectId.toString(),
    sourceTaskKey: timesheetTask.sourceTaskKey || matchedSourceTask.sourceTaskKey || '',
    taskName: planningTask.taskName || timesheetTask.title || '',
    oldStatus,
    newStatus: projectStatus,
    triggeredBy: getIdValue(userId),
  };

  logSync('project planning task status updated', result);
  return result;
};

module.exports = {
  TIMESHEET_TO_PROJECT_STATUS,
  mapTimesheetStatusToProjectStatus,
  updateLinkedProjectTaskStatusFromTimesheet,
};
