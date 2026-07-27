'use strict';

const SUPPORTED_PROJECT_DEPARTMENTS = Object.freeze([
  'Design', 'Production', 'Purchase', 'Automation', 'Store', 'QC',
]);

const SUPPORTED_PANEL_TYPES = Object.freeze([
  'PLC', 'MCC', 'VFD', 'MCC cum PLC', 'FLP', 'RIO Box',
]);

const PLANNING_MODES = Object.freeze(['common', 'separate']);
const TASK_STATUSES = Object.freeze(['Pending', 'In Progress', 'Delay', 'Completed', 'On Hold']);

const DISALLOWED_DEPARTMENTS_BY_PANEL = Object.freeze({
  MCC: Object.freeze(['Automation']),
  VFD: Object.freeze(['Automation']),
});

function isDepartmentAllowedForPanel(department, panelType) {
  const blocked = DISALLOWED_DEPARTMENTS_BY_PANEL[String(panelType || '').trim()] || [];
  return !blocked.includes(String(department || '').trim());
}

// Extracted from Panel_and_Development_Master_Plan.xlsx.
// Per the approved interpretation, only Task Name and Assigned To are retained.
const EXCEL_TASK_ROWS = Object.freeze([
  ['Project Kick-off', 'PM/All'],
  ['URS & Scope Freeze', 'PM/All'],
  ['BOM Preparation', 'Production'],
  ['Technical BOM Review', 'Production'],
  ['BOM Approval', 'PM/Production'],
  ['GAD Design', 'Design/Production'],
  ['GAD Approval', 'PM/Customer'],
  ['Electrical Drawing Preparation', 'Electrical'],
  ['Electrical Drawing Approval', 'PM/Customer'],
  ['Material Procurement', 'Purchase'],
  ['Material Inspection & Review', 'QC/Store'],
  ['Panel GA Assembly', 'Production'],
  ['Panel Wiring', 'Production'],
  ['Labelling & Stickering', 'Production'],
  ['Visual Inspection & QC', 'QC'],
  ['System Architecture Definition', 'Programmer'],
  ['Control Architecture Definition', 'Programmer'],
  ['Software Architecture Definition', 'Programmer'],
  ['PLC Programming', 'Programmer'],
  ['HMI / SCADA Development', 'Programmer'],
  ['Alarm & Interlock Implementation', 'Programmer'],
  ['Communication Configuration (Drives / Fieldbus)', 'Programmer'],
  ['Dry Run / Simulation', 'Programmer'],
  ['Bug Fixing & Optimization', 'Programmer'],
  ['Program Freeze for FAT', 'Programmer'],
  ['Internal FAT (Panel + Program)', 'All'],
  ['FAT Observation Closure', 'All'],
  ['Final Backup & Handover', 'PM/Programmer'],
  ['Final Inspection & Testing', 'QC/All'],
  ['Packing & Dispatch', 'Dispatch'],
]);

const NORMALIZATION_MAPPINGS = Object.freeze({
  design: 'Design',
  'engineering design': 'Design',
  electrical: 'Design',
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

function compactText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\-_]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function isKickoffTask(taskName) {
  const compact = compactText(taskName).replace(/\s+/g, '');
  return ['kickoff', 'kickofftask', 'projectkickoff'].includes(compact);
}

function normalizeTaskName(taskName) {
  const text = String(taskName || '').trim().replace(/\s+/g, ' ');
  if (/^bom\s+preparation$/i.test(text)) return 'Engineering BOM Preparation';
  return text;
}

function normalizeExcelDepartment(value) {
  const raw = String(value || '').trim();
  const key = compactText(raw);
  const mapped = NORMALIZATION_MAPPINGS[key];
  if (mapped) return { department: mapped, normalizedFrom: raw, issue: null };

  const hasMultipleTargets = /[\/,;&+]|\band\b/i.test(raw);
  return {
    department: null,
    normalizedFrom: raw,
    issue: hasMultipleTargets
      ? `Ambiguous Excel Assigned To value "${raw}" contains multiple or non-department targets.`
      : `Unsupported Excel Assigned To value "${raw}" could not be mapped safely.`,
  };
}

function buildExcelPlanningCatalog() {
  const tasksByDepartment = Object.fromEntries(
    SUPPORTED_PROJECT_DEPARTMENTS.map((department) => [department, []])
  );
  const issues = [];

  EXCEL_TASK_ROWS.forEach(([rawTaskName, rawAssignedTo], sourceIndex) => {
    if (isKickoffTask(rawTaskName)) return;
    const taskName = normalizeTaskName(rawTaskName);
    const mapping = normalizeExcelDepartment(rawAssignedTo);
    if (!mapping.department) {
      issues.push({ sourceRow: sourceIndex + 2, taskName, assignedTo: rawAssignedTo, message: mapping.issue });
      return;
    }

    tasksByDepartment[mapping.department].push({
      taskName,
      department: mapping.department,
      sourceOrder: sourceIndex,
      sourceAssignedTo: rawAssignedTo,
      duration: 1,
      totalDays: 1,
      status: 'Pending',
      remark: '',
      assignedTo: null,
    });
  });

  return { tasksByDepartment, issues };
}

const EXCEL_PLANNING_CATALOG = Object.freeze(buildExcelPlanningCatalog());

module.exports = {
  SUPPORTED_PROJECT_DEPARTMENTS,
  SUPPORTED_PANEL_TYPES,
  PLANNING_MODES,
  TASK_STATUSES,
  DISALLOWED_DEPARTMENTS_BY_PANEL,
  NORMALIZATION_MAPPINGS,
  EXCEL_TASK_ROWS,
  EXCEL_PLANNING_CATALOG,
  compactText,
  isKickoffTask,
  normalizeTaskName,
  normalizeExcelDepartment,
  isDepartmentAllowedForPanel,
  buildExcelPlanningCatalog,
};
