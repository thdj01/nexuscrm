'use strict';

/**
 * Project planning v2 migration.
 *
 * Safe default: dry-run only.
 * Apply explicitly: npm run migrate:project-planning-v2 -- --apply
 *
 * The migration keeps an exact backup of legacy fields/grids in
 * legacyProjectDetails before unsetting deprecated Project Details fields.
 * Tasks with a department that cannot be mapped safely are preserved in the
 * backup and the project is marked migrationReviewRequired.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Project = require('../../models/Project');
const {
  SUPPORTED_PROJECT_DEPARTMENTS,
  SUPPORTED_PANEL_TYPES,
  isKickoffTask,
  normalizeTaskName,
} = require('../../config/projectPlanningCatalog');

const APPLY = process.argv.includes('--apply');

const DEPARTMENT_ALIASES = Object.freeze({
  design: 'Design',
  electrical: 'Design',
  engineering: 'Design',
  'engineering design': 'Design',
  production: 'Production',
  prod: 'Production',
  manufacturing: 'Production',
  purchase: 'Purchase',
  purchasing: 'Purchase',
  procurement: 'Purchase',
  automation: 'Automation',
  programmer: 'Automation',
  programming: 'Automation',
  software: 'Automation',
  store: 'Store',
  stores: 'Store',
  dispatch: 'Store',
  despatch: 'Store',
  qc: 'QC',
  qa: 'QC',
  quality: 'QC',
  'quality control': 'QC',
});

function compact(value) {
  return String(value || '').trim().toLowerCase().replace(/[\-_]+/g, ' ').replace(/\s+/g, ' ');
}

function normalizeDepartment(value) {
  const key = compact(value);
  return DEPARTMENT_ALIASES[key] || (SUPPORTED_PROJECT_DEPARTMENTS.includes(value) ? value : '');
}

function normalizePanelType(value) {
  const text = String(value || '').trim();
  if (['PLC_MCC', 'MCC_CUM_PLC'].includes(text) || (/plc/i.test(text) && /mcc/i.test(text))) return 'MCC cum PLC';
  if (/rio/i.test(text)) return 'RIO Box';
  if (/flp/i.test(text)) return 'FLP';
  if (/plc/i.test(text)) return 'PLC';
  if (/vfd/i.test(text)) return 'VFD';
  if (/mcc/i.test(text)) return 'MCC';
  return SUPPORTED_PANEL_TYPES.includes(text) ? text : '';
}

function positiveInteger(value, fallback = 1) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function taskDepartment(task = {}, grid = {}) {
  return normalizeDepartment(task.department || grid.department || task.taskType);
}

function buildMigrationUpdate(project) {
  const issues = [];
  const quantity = positiveInteger(project.quantity, 1);
  const panelType = normalizePanelType(project.panelType || project.sourceInquirySnapshot?.panelType || project.sourceInquirySnapshot?.productType);
  const safePanelType = panelType || 'MCC';
  if (!panelType) issues.push('Legacy panel type could not be mapped; MCC was used as a reviewable fallback.');

  const sourceGrids = Array.isArray(project.planningGrids) && project.planningGrids.length
    ? project.planningGrids
    : [{ gridId: 'LEGACY-A', planningTasks: project.planningTasks || [] }];

  const tasksByDepartment = new Map(SUPPORTED_PROJECT_DEPARTMENTS.map((department) => [department, []]));
  const unmappedPlanningTasks = [];

  sourceGrids.forEach((grid, gridIndex) => {
    (grid.planningTasks || []).forEach((rawTask, taskIndex) => {
      if (isKickoffTask(rawTask.taskName)) return;
      const department = taskDepartment(rawTask, grid);
      const task = {
        ...rawTask,
        taskName: normalizeTaskName(rawTask.taskName),
        order: taskIndex + 1,
      };
      if (!department) {
        unmappedPlanningTasks.push({ gridId: grid.gridId || `LEGACY-${gridIndex + 1}`, task });
        return;
      }
      tasksByDepartment.get(department).push({ ...task, department });
    });
  });

  if (unmappedPlanningTasks.length) {
    issues.push(`${unmappedPlanningTasks.length} legacy planning task(s) have an unsupported/ambiguous department and require manual review.`);
  }
  if (sourceGrids.length > 1) {
    issues.push('Legacy multi-grid layout was consolidated by department. Original grids are preserved in legacyProjectDetails for review.');
  }

  const inferredDepartments = SUPPORTED_PROJECT_DEPARTMENTS.filter((department) => tasksByDepartment.get(department).length > 0);
  const legacyDepartmentCandidates = [
    ...(Array.isArray(project.projectScopes) ? project.projectScopes : []),
    project.projectDepartment,
  ].map(normalizeDepartment).filter(Boolean);
  legacyDepartmentCandidates.forEach((department) => {
    if (!inferredDepartments.includes(department)) inferredDepartments.push(department);
  });

  if (!inferredDepartments.length) {
    issues.push('No supported project department could be inferred automatically. Legacy planning data was preserved without destructive conversion.');
  }

  const selectedDepartments = inferredDepartments;
  const panelSelections = selectedDepartments.map((department) => ({
    department,
    panelType: safePanelType,
    quantity,
    planningMode: 'common',
  }));

  const planningGrids = selectedDepartments.map((department) => {
    const gridId = `${department}-${safePanelType}-COMMON`.replace(/\s+/g, '-').toUpperCase();
    const gridName = quantity > 1
      ? `${department} · ${safePanelType} – Common Grid – Quantity ${quantity}`
      : `${department} · ${safePanelType} – Quantity 1`;
    const planningTasks = tasksByDepartment.get(department).map((task, index) => ({
      ...task,
      taskId: task.taskId || `${gridId}-${index + 1}`,
      gridId,
      gridName,
      department,
      order: index + 1,
      dependency: index === 0 ? '' : (tasksByDepartment.get(department)[index - 1]?.taskId || `${gridId}-${index}`),
      totalDays: positiveInteger(task.totalDays ?? task.duration, 1),
      status: task.status === 'Hold' ? 'On Hold' : task.status === 'Delayed' ? 'Delay' : task.status === 'Not Started' ? 'Pending' : task.status,
    }));
    return {
      gridId,
      name: gridName,
      gridName,
      department,
      panelType: safePanelType,
      panelQuantity: quantity,
      planningMode: 'common',
      isCommon: true,
      migrationReviewRequired: issues.length > 0,
      planningTasks,
    };
  });

  const legacyProjectDetails = {
    migratedAt: new Date(),
    projectType: project.projectType,
    projectScopes: project.projectScopes,
    projectDepartment: project.projectDepartment,
    panelType: project.panelType,
    projectLevelRemark: project.notes,
    planningGrids: project.planningGrids,
    planningTasks: project.planningTasks,
    unmappedPlanningTasks,
  };

  const set = {
    quantity,
    legacyProjectDetails,
    migrationReviewRequired: issues.length > 0,
    migrationIssues: issues,
  };

  if (selectedDepartments.length) {
    set.selectedDepartments = selectedDepartments;
    set.panelSelections = panelSelections;
    set.planningGrids = planningGrids;
    set.planningTasks = planningGrids.flatMap((grid) => grid.planningTasks);
  }

  return {
    set,
    unset: {
      projectType: '',
      projectScopes: '',
      projectDepartment: '',
      panelType: '',
      notes: '',
    },
    issues,
  };
}

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/electrical_crm';
  await mongoose.connect(uri);
  const projects = await Project.find({}).select('+projectType +projectScopes +projectDepartment +panelType +notes +legacyProjectDetails').lean();
  const report = { mode: APPLY ? 'apply' : 'dry-run', scanned: projects.length, migrated: 0, reviewRequired: 0, skipped: 0 };

  for (const project of projects) {
    const alreadyV2 = Array.isArray(project.selectedDepartments) && project.selectedDepartments.length > 0 &&
      Array.isArray(project.panelSelections) && project.panelSelections.length > 0 &&
      (project.planningGrids || []).every((grid) => grid.department && grid.panelType);
    if (alreadyV2) {
      report.skipped += 1;
      continue;
    }

    const migration = buildMigrationUpdate(project);
    if (migration.issues.length) report.reviewRequired += 1;
    console.log(`[${APPLY ? 'APPLY' : 'DRY'}] ${project.projectId || project._id}: ${migration.issues.join(' | ') || 'automatic migration available'}`);

    if (APPLY) {
      await Project.collection.updateOne(
        { _id: project._id },
        { $set: migration.set, $unset: migration.unset }
      );
    }
    report.migrated += 1;
  }

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
