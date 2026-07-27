// ─────────────────────────────────────────────────────────────────────────────
// backend/services/projectTimesheetBackfillService.js
//
// Phase 5 — Project → Timesheet backfill service only.
// No controllers, no routes, no frontend, no retry jobs, no cron jobs.
// ─────────────────────────────────────────────────────────────────────────────

const TimesheetTask = require('../models/TimesheetTask');
const Project = require('../models/Project');
const {
  TASK_SOURCE,
  SYNC_STATUS,
  extractProjectPlanningTasks,
  createOrUpdateProjectTimesheetTask,
} = require('./projectTimesheetSyncService');

const createEmptyBackfillStats = () => ({
  totalProjects: 0,
  totalAssignedTasks: 0,
  alreadyLinked: 0,
  created: 0,
  skipped: 0,
  errors: [],
});

const normalizeError = (error) => (
  error?.message || String(error || 'Unknown backfill error')
);

const addBackfillError = (stats, context, error) => {
  stats.errors.push({
    ...context,
    message: normalizeError(error),
  });
};

const hasAssignedEmployee = (sourceTask) => Boolean(sourceTask?.assignedTo);

const findExistingProjectLinkedTask = async (sourceTask) => {
  if (!sourceTask?.project?._id || !sourceTask?.sourceTaskKey) return null;

  return TimesheetTask.findOne({
    taskSource: TASK_SOURCE.PROJECT,
    sourceProject: sourceTask.project._id,
    sourceTaskKey: sourceTask.sourceTaskKey,
  }).select('_id taskSource sourceProject sourceTaskKey syncStatus isArchived');
};

const buildErrorContext = (project, sourceTask = {}) => ({
  project: project?._id?.toString?.() || '',
  projectId: project?.projectId || '',
  sourceTaskKey: sourceTask?.sourceTaskKey || '',
  gridId: sourceTask?.gridId || '',
  taskId: sourceTask?.planningTask?.taskId || '',
  taskName: sourceTask?.planningTask?.taskName || '',
});

const backfillOneProject = async ({ project, dryRun, stats }) => {
  const sourceTasks = extractProjectPlanningTasks(project);

  for (const sourceTask of sourceTasks) {
    if (!hasAssignedEmployee(sourceTask)) {
      stats.skipped += 1;
      continue;
    }

    stats.totalAssignedTasks += 1;

    try {
      const existingTask = await findExistingProjectLinkedTask(sourceTask);

      if (existingTask) {
        stats.alreadyLinked += 1;
        continue;
      }

      if (dryRun) {
        stats.created += 1;
        continue;
      }

      const result = await createOrUpdateProjectTimesheetTask(sourceTask);

      if (result?.task) {
        result.task.taskSource = TASK_SOURCE.PROJECT;
        result.task.syncStatus = SYNC_STATUS.SYNCED;
        result.task.syncError = '';
        result.task.lastSyncedAt = result.task.lastSyncedAt || new Date();
        await result.task.save();
      }

      stats.created += 1;
    } catch (error) {
      addBackfillError(stats, buildErrorContext(project, sourceTask), error);
    }
  }
};

/**
 * Backfill PROJECT-linked TimesheetTask records from existing Project planning tasks.
 *
 * Rules:
 * - Scans all projects by default.
 * - Processes planningGrids[].planningTasks[] and legacy planningTasks[] through
 *   the shared extraction utility.
 * - Only tasks with assignedTo are eligible.
 * - Skips if PROJECT-linked TimesheetTask already exists for sourceProject + sourceTaskKey.
 * - Never modifies USER tasks.
 * - Never archives anything.
 * - Never deletes anything.
 * - dryRun=true returns counts without creating records.
 */
const runBackfill = async ({ dryRun = true, projectFilter = {}, logger = console } = {}) => {
  const stats = createEmptyBackfillStats();
  const projects = await Project.find(projectFilter);

  stats.totalProjects = projects.length;

  logger?.info?.(`[ProjectTimesheetBackfill] Started. dryRun=${dryRun}. projects=${projects.length}`);

  for (const project of projects) {
    try {
      await backfillOneProject({ project, dryRun, stats });
    } catch (error) {
      addBackfillError(stats, buildErrorContext(project), error);
    }
  }

  logger?.info?.(
    `[ProjectTimesheetBackfill] Completed. dryRun=${dryRun}. ` +
      `assigned=${stats.totalAssignedTasks}, alreadyLinked=${stats.alreadyLinked}, ` +
      `created=${stats.created}, skipped=${stats.skipped}, errors=${stats.errors.length}`
  );

  return {
    dryRun,
    ...stats,
  };
};

module.exports = {
  runBackfill,
};
