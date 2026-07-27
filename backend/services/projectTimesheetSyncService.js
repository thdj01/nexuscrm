// ─────────────────────────────────────────────────────────────────────────────
// backend/services/projectTimesheetSyncService.js
//
// Phase 3 — Project → Timesheet sync service only.
// No controller integration, no routes, no frontend, no backfill.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');
const TimesheetTask = require('../models/TimesheetTask');

const TASK_SOURCE = Object.freeze({
  USER: 'USER',
  PROJECT: 'PROJECT',
});

const SYNC_STATUS = Object.freeze({
  SYNCED: 'SYNCED',
  PENDING: 'PENDING',
  FAILED: 'FAILED',
});

const ARCHIVE_REASONS = Object.freeze({
  PROJECT_TASK_REMOVED: 'PROJECT_TASK_REMOVED',
  PROJECT_TASK_UNASSIGNED: 'PROJECT_TASK_UNASSIGNED',
  PROJECT_DELETED: 'PROJECT_DELETED',
});

const PROJECT_TO_TIMESHEET_STATUS = Object.freeze({
  Pending: 'Planned',
  'Not Started': 'Planned',
  'In Progress': 'In Progress',
  Completed: 'Completed',
  'On Hold': 'Planned',
  Hold: 'Planned',
  Delay: 'In Progress',
  Delayed: 'In Progress',
});

const PROJECT_TASK_TYPE_FALLBACK_MAP = Object.freeze({
  Production: 'Design',
  Programming: 'Development',
  Common: 'Other',
  Joint: 'Other',
});

const DEFAULT_TIMESHEET_TASK_TYPE = 'Other';

const SYNC_LOG_PREFIX = '[ProjectTimesheetSync]';

const describeValue = (value) => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString();
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value, (key, nestedValue) => {
      if (nestedValue instanceof mongoose.Types.ObjectId) {
        return nestedValue.toString();
      }
      return nestedValue;
    });
  } catch {
    return String(value);
  }
};

const logSync = () => {};

const logSyncError = (event, details = {}) => {
  console.error(SYNC_LOG_PREFIX, event, details);
};

const getTaskNameForLog = (planningTask = {}) => (
  planningTask?.taskName || planningTask?.title || planningTask?.name || 'Project Task'
);

const getProjectIdForLog = (project = {}) => (
  getIdValue(project?._id) || getProjectDisplayId(project) || 'UNKNOWN_PROJECT'
);

const getAssignedToRawValue = (planningTask = {}) => (
  planningTask?.assignedTo ??
  planningTask?.assignedUser ??
  planningTask?.assignee ??
  planningTask?.employee ??
  planningTask?.userId ??
  null
);

const hasAssignedToInput = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
};

const getIdValue = (value) => {
  if (!value) return null;

  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === 'object') {
    if (value._id) return getIdValue(value._id);
    if (value.id) return getIdValue(value.id);
    if (value.value) return getIdValue(value.value);
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

const safeDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const sanitizeKeyPart = (value, fallback = 'NA') => {
  const text = String(value || fallback).trim();
  return text.replace(/\s+/g, '_').replace(/[:|]/g, '_') || fallback;
};

const getAllowedTimesheetTaskTypes = () => {
  if (Array.isArray(TimesheetTask.TASK_TYPES) && TimesheetTask.TASK_TYPES.length) {
    return TimesheetTask.TASK_TYPES;
  }

  return [
    'Development',
    'Design',
    'Meeting',
    'Review',
    'Testing',
    'Documentation',
    'Support',
    'Other',
  ];
};

const mapProjectTaskTypeToTimesheetTaskType = (planningTask = {}) => {
  const allowedTypes = getAllowedTimesheetTaskTypes();

  if (planningTask.taskType && allowedTypes.includes(planningTask.taskType)) {
    return planningTask.taskType;
  }

  if (planningTask.department && allowedTypes.includes(planningTask.department)) {
    return planningTask.department;
  }

  const mapped = PROJECT_TASK_TYPE_FALLBACK_MAP[planningTask.taskType];
  if (mapped && allowedTypes.includes(mapped)) {
    return mapped;
  }

  return allowedTypes.includes(DEFAULT_TIMESHEET_TASK_TYPE)
    ? DEFAULT_TIMESHEET_TASK_TYPE
    : allowedTypes[0];
};

const mapProjectTaskStatusToTimesheetStatus = (status) => (
  PROJECT_TO_TIMESHEET_STATUS[status] || 'Planned'
);

const getProjectDisplayId = (project = {}) => (
  project.projectId || project.naplId || project.code || ''
);

const buildSourceTaskKey = ({ project, planningTask, gridId, gridIndex = 0, index }) => {
  const projectId = getIdValue(project?._id) || getProjectDisplayId(project) || 'UNKNOWN_PROJECT';
  const stableGridId = sanitizeKeyPart(gridId || planningTask?.gridId || 'A');
  const stableTaskId = sanitizeKeyPart(
    planningTask?.taskId ||
      planningTask?.id ||
      `${planningTask?.taskName || 'TASK'}_${planningTask?.plannedStartDate || ''}_${index}`
  );

  // Positional discriminators (grid index + task index) guarantee a globally
  // unique key per task even when taskId/gridId are blank or duplicated across
  // grids. Without this, mapBySourceTaskKey() silently overwrote tasks that
  // shared a key — assigned early tasks were lost to later unassigned ones,
  // collapsing 31 tasks → 14 source tasks (all unassigned).
  const gridPos = Number.isInteger(gridIndex) ? gridIndex : 0;
  const taskPos = Number.isInteger(index) ? index : 0;

  return `PROJECT:${projectId}:GRID:${stableGridId}#${gridPos}:TASK:${stableTaskId}#${taskPos}`;
};

const extractProjectPlanningTasks = (project = {}) => {
  const sourceTasks = [];
  const planningGrids = Array.isArray(project.planningGrids) ? project.planningGrids : [];

  if (planningGrids.length > 0) {
    planningGrids.forEach((grid, gridIndex) => {
      const gridId = grid?.gridId || String.fromCharCode(65 + gridIndex);
      const gridName = grid?.name || grid?.gridName || `Project Planning Grid - ${gridId}`;
      const planningTasks = Array.isArray(grid?.planningTasks) ? grid.planningTasks : [];

      planningTasks.forEach((planningTask, taskIndex) => {
        const sourceTaskKey = buildSourceTaskKey({
          project,
          planningTask,
          gridId,
          gridIndex,
          index: taskIndex,
        });


        const rawAssignedTo = getAssignedToRawValue(planningTask);
        const assignedTo = toObjectIdOrNull(rawAssignedTo);

        sourceTasks.push({
          project,
          planningTask,
          gridId,
          gridName,
          taskIndex,
          sourceTaskKey,
          assignedTo,
          rawAssignedTo,
        });
      });
    });

    return sourceTasks;
  }

  const legacyPlanningTasks = Array.isArray(project.planningTasks) ? project.planningTasks : [];
  legacyPlanningTasks.forEach((planningTask, taskIndex) => {
    const gridId = planningTask?.gridId || 'A';
    const gridName = planningTask?.gridName || `Project Planning Grid - ${gridId}`;
    const sourceTaskKey = buildSourceTaskKey({
      project,
      planningTask,
      gridId,
      gridIndex: 0,
      index: taskIndex,
    });


    const rawAssignedTo = getAssignedToRawValue(planningTask);
    const assignedTo = toObjectIdOrNull(rawAssignedTo);

    sourceTasks.push({
      project,
      planningTask,
      gridId,
      gridName,
      taskIndex,
      sourceTaskKey,
      assignedTo,
      rawAssignedTo,
    });
  });

  return sourceTasks;
};

const getSourceTaskLogDetails = (sourceTask = {}) => ({
  projectId: getProjectIdForLog(sourceTask.project),
  taskName: getTaskNameForLog(sourceTask.planningTask),
  assignedTo: describeValue(sourceTask.rawAssignedTo ?? sourceTask.planningTask?.assignedTo),
  resolvedAssignedTo: sourceTask.assignedTo ? sourceTask.assignedTo.toString() : null,
  sourceTaskKey: sourceTask.sourceTaskKey,
});

const mapProjectTaskToTimesheetPayload = (sourceTask) => {
  const { project, planningTask, gridId, gridName, sourceTaskKey, assignedTo } = sourceTask;
  const projectObjectId = toObjectIdOrNull(project?._id);
  const plannedStartDate = safeDate(planningTask?.plannedStartDate);
  const plannedEndDate = safeDate(planningTask?.plannedEndDate);
  const taskDate = plannedStartDate || plannedEndDate || safeDate(project?.orderDate) || new Date();
  const taskName = (planningTask?.taskName || '').trim() || 'Project Task';

  return {
    employee: assignedTo,
    title: taskName,
    // Project planning remark remains synced into description.
    // Employee-entered work remarks are stored separately in employeeRemarks
    // and must never be overwritten by project sync.
    description: planningTask?.remark || '',
    employeeRemarks: '',
    project: projectObjectId,
    taskType: mapProjectTaskTypeToTimesheetTaskType(planningTask),
    date: taskDate,
    status: mapProjectTaskStatusToTimesheetStatus(planningTask?.status),

    taskSource: TASK_SOURCE.PROJECT,
    sourceProject: projectObjectId,
    sourceProjectId: getProjectDisplayId(project),
    sourceGridId: gridId || planningTask?.gridId || 'A',
    sourceGridName: gridName || planningTask?.gridName || '',
    sourceTaskId: planningTask?.taskId || '',
    sourceTaskKey,
    sourceTaskName: taskName,
    sourceDepartment: planningTask?.department || planningTask?.taskType || '',
    sourcePlannedStartDate: plannedStartDate,
    sourcePlannedEndDate: plannedEndDate,

    isArchived: false,
    archivedAt: null,
    archivedBy: null,
    archiveReason: '',
    restoredAt: null,
    restoredBy: null,

    syncStatus: SYNC_STATUS.SYNCED,
    lastSyncedAt: new Date(),
    syncError: '',
  };
};

const findLinkedProjectTimesheetTask = async (sourceProject, sourceTaskKey) => {
  const sourceProjectId = toObjectIdOrNull(sourceProject);

  if (!sourceProjectId || !sourceTaskKey) return null;

  return TimesheetTask.findOne({
    taskSource: TASK_SOURCE.PROJECT,
    sourceProject: sourceProjectId,
    sourceTaskKey,
  });
};

const markTaskSyncFailed = async (task, error) => {
  if (!task) return;

  task.syncStatus = SYNC_STATUS.FAILED;
  task.syncError = error?.message || String(error || 'Unknown sync error');
  task.lastSyncedAt = new Date();
  task.syncRetryCount = Number(task.syncRetryCount || 0) + 1;

  await task.save();
};

const createOrUpdateProjectTimesheetTask = async (sourceTask) => {
  const payload = mapProjectTaskToTimesheetPayload(sourceTask);
  const logDetails = getSourceTaskLogDetails(sourceTask);

  if (!payload.sourceProject || !payload.sourceTaskKey) {
    const reason = 'MISSING_SOURCE_PROJECT_OR_SOURCE_TASK_KEY';
    logSyncError('task sync failed', { ...logDetails, reason });
    throw new Error('Cannot sync project task because source project or source task key is missing');
  }

  if (!payload.employee) {
    const reason = 'INVALID_OR_MISSING_ASSIGNED_TO';
    logSyncError('task sync failed', {
      ...logDetails,
      reason,
      receivedAssignedTo: describeValue(sourceTask.rawAssignedTo ?? sourceTask.planningTask?.assignedTo),
    });
    throw new Error(`Cannot create/update project-linked timesheet task without employee: ${payload.sourceTaskKey}`);
  }

  let linkedTask = await findLinkedProjectTimesheetTask(payload.sourceProject, payload.sourceTaskKey);

  try {
    if (!linkedTask) {
      try {
        linkedTask = await TimesheetTask.create({
          ...payload,
          hours: 0,
          kanbanOrder: 0,
          createdBy: null,
        });

        logSync('task created', {
          ...logDetails,
          timesheetTaskId: linkedTask._id?.toString(),
        });

        return { action: 'created', task: linkedTask };
      } catch (createError) {
        // Unique PROJECT source protection may be hit by concurrent project saves.
        // In that case, re-read the linked task and continue with update below.
        if (createError?.code !== 11000) {
          logSyncError('task create failed', {
            ...logDetails,
            reason: createError?.message || String(createError),
          });
          throw createError;
        }

        logSync('duplicate create detected, switching to update', logDetails);

        linkedTask = await findLinkedProjectTimesheetTask(payload.sourceProject, payload.sourceTaskKey);
        if (!linkedTask) {
          logSyncError('duplicate create recovery failed', {
            ...logDetails,
            reason: createError?.message || String(createError),
          });
          throw createError;
        }
      }
    }

    // Only PROJECT-linked tasks are returned by findLinkedProjectTimesheetTask.
    // USER tasks are never touched by this service.
    linkedTask.employee = payload.employee;
    linkedTask.title = payload.title;
    // Keep project planning remarks synced, but never overwrite employeeRemarks.
    linkedTask.description = payload.description;
    linkedTask.project = payload.project;
    linkedTask.taskType = payload.taskType;
    linkedTask.date = payload.date;
    linkedTask.status = payload.status;

    linkedTask.sourceProjectId = payload.sourceProjectId;
    linkedTask.sourceGridId = payload.sourceGridId;
    linkedTask.sourceGridName = payload.sourceGridName;
    linkedTask.sourceTaskId = payload.sourceTaskId;
    linkedTask.sourceTaskName = payload.sourceTaskName;
    linkedTask.sourceDepartment = payload.sourceDepartment;
    linkedTask.sourcePlannedStartDate = payload.sourcePlannedStartDate;
    linkedTask.sourcePlannedEndDate = payload.sourcePlannedEndDate;

    linkedTask.isArchived = false;
    linkedTask.archivedAt = null;
    linkedTask.archivedBy = null;
    linkedTask.archiveReason = '';

    linkedTask.syncStatus = SYNC_STATUS.SYNCED;
    linkedTask.syncError = '';
    linkedTask.lastSyncedAt = new Date();

    await linkedTask.save();

    logSync('task updated', {
      ...logDetails,
      timesheetTaskId: linkedTask._id?.toString(),
    });

    return { action: 'updated', task: linkedTask };
  } catch (error) {
    if (linkedTask) {
      await markTaskSyncFailed(linkedTask, error);
    }

    logSyncError('task sync failed', {
      ...logDetails,
      reason: error?.message || String(error),
    });

    throw error;
  }
};

const archiveLinkedProjectTimesheetTask = async ({
  sourceProject,
  sourceTaskKey,
  archiveReason,
  archivedBy = null,
}) => {
  const linkedTask = await findLinkedProjectTimesheetTask(sourceProject, sourceTaskKey);

  if (!linkedTask) {
    logSync('task archive skipped', {
      sourceProject: describeValue(sourceProject),
      sourceTaskKey,
      archiveReason,
      reason: 'LINKED_TASK_NOT_FOUND',
    });
    return { action: 'skipped', reason: 'LINKED_TASK_NOT_FOUND' };
  }

  try {
    linkedTask.isArchived = true;
    linkedTask.archivedAt = new Date();
    linkedTask.archivedBy = toObjectIdOrNull(archivedBy);
    linkedTask.archiveReason = archiveReason;
    linkedTask.syncStatus = SYNC_STATUS.SYNCED;
    linkedTask.syncError = '';
    linkedTask.lastSyncedAt = new Date();

    await linkedTask.save();

    logSync('task archived', {
      sourceProject: describeValue(sourceProject),
      sourceTaskKey,
      archiveReason,
      timesheetTaskId: linkedTask._id?.toString(),
    });

    return { action: 'archived', task: linkedTask };
  } catch (error) {
    await markTaskSyncFailed(linkedTask, error);
    logSyncError('task archive failed', {
      sourceProject: describeValue(sourceProject),
      sourceTaskKey,
      archiveReason,
      reason: error?.message || String(error),
    });
    throw error;
  }
};

const mapBySourceTaskKey = (sourceTasks = []) => {
  const map = new Map();
  sourceTasks.forEach((sourceTask) => {
    if (sourceTask?.sourceTaskKey) {
      map.set(sourceTask.sourceTaskKey, sourceTask);
    }
  });
  return map;
};

const createEmptySyncResult = () => ({
  created: 0,
  updated: 0,
  archived: 0,
  skipped: 0,
  failed: 0,
  errors: [],
});

const pushSyncError = (result, sourceTaskKey, error) => {
  result.failed += 1;
  result.errors.push({
    sourceTaskKey,
    message: error?.message || String(error || 'Unknown sync error'),
  });
};

const syncProjectTasksToTimesheet = async ({ oldProject = null, newProject, userId = null } = {}) => {
  if (!newProject?._id) {
    throw new Error('newProject with _id is required for Project → Timesheet sync');
  }

  const result = createEmptySyncResult();
  const oldTaskMap = mapBySourceTaskKey(extractProjectPlanningTasks(oldProject || {}));
  const newTaskMap = mapBySourceTaskKey(extractProjectPlanningTasks(newProject || {}));

  logSync('sync started', {
    projectId: getProjectIdForLog(newProject),
    oldTaskCount: oldTaskMap.size,
    newTaskCount: newTaskMap.size,
  });

  for (const [sourceTaskKey, newSourceTask] of newTaskMap.entries()) {
    try {
      if (newSourceTask.assignedTo) {
        const syncResult = await createOrUpdateProjectTimesheetTask(newSourceTask);

        if (syncResult.action === 'created') result.created += 1;
        else result.updated += 1;
      } else if (hasAssignedToInput(newSourceTask.rawAssignedTo)) {
        result.skipped += 1;
        logSyncError('task skipped', {
          ...getSourceTaskLogDetails(newSourceTask),
          reason: 'ASSIGNED_TO_COULD_NOT_BE_CONVERTED_TO_OBJECT_ID',
          receivedAssignedTo: describeValue(newSourceTask.rawAssignedTo),
        });
      } else {
        const oldSourceTask = oldTaskMap.get(sourceTaskKey);

        if (oldSourceTask?.assignedTo) {
          const archiveResult = await archiveLinkedProjectTimesheetTask({
            sourceProject: newProject._id,
            sourceTaskKey,
            archiveReason: ARCHIVE_REASONS.PROJECT_TASK_UNASSIGNED,
            archivedBy: userId,
          });

          if (archiveResult.action === 'archived') result.archived += 1;
          else result.skipped += 1;
        } else {
          result.skipped += 1;
          logSync('task skipped', {
            ...getSourceTaskLogDetails(newSourceTask),
            reason: 'TASK_NOT_ASSIGNED',
            receivedAssignedTo: describeValue(newSourceTask.rawAssignedTo),
          });
        }
      }
    } catch (error) {
      logSyncError('task sync failure recorded', {
        sourceTaskKey,
        reason: error?.message || String(error),
      });
      pushSyncError(result, sourceTaskKey, error);
    }
  }

  for (const [sourceTaskKey, oldSourceTask] of oldTaskMap.entries()) {
    if (newTaskMap.has(sourceTaskKey)) continue;

    try {
      if (oldSourceTask.assignedTo) {
        const archiveResult = await archiveLinkedProjectTimesheetTask({
          sourceProject: newProject._id || oldProject?._id,
          sourceTaskKey,
          archiveReason: ARCHIVE_REASONS.PROJECT_TASK_REMOVED,
          archivedBy: userId,
        });

        if (archiveResult.action === 'archived') result.archived += 1;
        else result.skipped += 1;
      } else {
        result.skipped += 1;
        logSync('task skipped', {
          ...getSourceTaskLogDetails(oldSourceTask),
          reason: 'OLD_TASK_NOT_ASSIGNED',
          receivedAssignedTo: describeValue(oldSourceTask.rawAssignedTo),
        });
      }
    } catch (error) {
      logSyncError('task sync failure recorded', {
        sourceTaskKey,
        reason: error?.message || String(error),
      });
      pushSyncError(result, sourceTaskKey, error);
    }
  }

  if (result.errors.length > 0) {
    logSyncError('sync failed', {
      projectId: getProjectIdForLog(newProject),
      result,
    });
    const error = new Error(`Project → Timesheet sync failed for ${result.errors.length} task(s)`);
    error.syncResult = result;
    throw error;
  }

  logSync('sync completed', {
    projectId: getProjectIdForLog(newProject),
    result,
  });

  return result;
};

const archiveProjectTimesheetTasksForProject = async ({ project, projectId, userId = null } = {}) => {
  const sourceProject = toObjectIdOrNull(project?._id || projectId);

  if (!sourceProject) {
    throw new Error('project or projectId is required to archive project-linked timesheet tasks');
  }

  logSync('project delete archive started', {
    projectId: sourceProject.toString(),
  });

  const now = new Date();
  const result = await TimesheetTask.updateMany(
    {
      taskSource: TASK_SOURCE.PROJECT,
      sourceProject,
      isArchived: { $ne: true },
    },
    {
      $set: {
        isArchived: true,
        archivedAt: now,
        archivedBy: toObjectIdOrNull(userId),
        archiveReason: ARCHIVE_REASONS.PROJECT_DELETED,
        syncStatus: SYNC_STATUS.SYNCED,
        syncError: '',
        lastSyncedAt: now,
      },
    }
  );

  const archiveResult = {
    archived: result.modifiedCount || 0,
    matched: result.matchedCount || 0,
  };

  logSync('project delete archive completed', {
    projectId: sourceProject.toString(),
    result: archiveResult,
  });

  return archiveResult;
};

module.exports = {
  TASK_SOURCE,
  SYNC_STATUS,
  ARCHIVE_REASONS,
  buildSourceTaskKey,
  extractProjectPlanningTasks,
  mapProjectTaskToTimesheetPayload,
  createOrUpdateProjectTimesheetTask,
  archiveLinkedProjectTimesheetTask,
  syncProjectTasksToTimesheet,
  archiveProjectTimesheetTasksForProject,
};
