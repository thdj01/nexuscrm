const fs = require('fs');
const path = require('path');
const multer = require('multer');
const {
  sendWhatsAppGroupNotification,
  sendWhatsAppNotification,
} = require('../services/whatsappService');

const Project            = require('../models/Project');
const ProjectActivityLog = require('../models/ProjectActivityLog');
const Inquiry            = require('../models/Inquiry');
const Customer           = require('../models/Customer');
const {
  applyCustomerToPayload,
  findCustomerIdsForSearch,
  getLiveCustomerSnapshot,
  resolveUniversalCustomer,
} = require('../utils/customerUniversal');
const User               = require('../models/User');
const Department         = require('../models/Department');
const mongoose           = require('mongoose');
const {
  buildProjectCreatedWhatsAppMessage,
  buildTaskAssignmentGroupWhatsAppMessage,
  buildTaskAssignmentPersonalWhatsAppMessage,
  buildProjectFieldChangedWhatsAppMessage,
  buildProjectDelayedWhatsAppMessage,
} = require('../services/notificationTemplates');
const { scheduleKickoffForInquiry } = require('../services/kickoffWorkflowService');
const {
  syncProjectTasksToTimesheet,
  archiveProjectTimesheetTasksForProject,
} = require('../services/projectTimesheetSyncService');
const { PROJECT_PERMISSIONS } = require('../constants/permissions');
const { getNextInquiryNumber } = require('../utils/inquiryNumber');
const { userHasPermission } = require('../utils/accessControl');
const {
  SUPPORTED_PROJECT_DEPARTMENTS,
  SUPPORTED_PANEL_TYPES,
  PLANNING_MODES,
  TASK_STATUSES,
  DISALLOWED_DEPARTMENTS_BY_PANEL,
  NORMALIZATION_MAPPINGS,
  EXCEL_PLANNING_CATALOG,
  normalizeTaskName: normalizeExcelTaskName,
  isKickoffTask,
} = require('../config/projectPlanningCatalog');
const {
  positiveInteger,
  normalizeTaskStatus: normalizePlanningTaskStatus,
  effectiveTaskStatus,
  calculateDelayedDays,
  recalculateTaskSequence,
  validatePanelSelections,
  initialTasksForDepartment,
  panelSelectionKey,
  assertPlanningStartDateAllowed,
} = require('../utils/projectPlanning');

const PLANNING_REORDER_ROLES = new Set(['admin', 'hod', 'team_lead']);

// ─── Helper: normalise any ObjectId-like value to a plain string ID ──────────
function objectIdBytesToHex(bytes) {
  if (!bytes) return '';

  let values = [];
  if (Array.isArray(bytes)) {
    values = bytes;
  } else if (Buffer.isBuffer(bytes)) {
    values = Array.from(bytes);
  } else if (ArrayBuffer.isView(bytes)) {
    values = Array.from(bytes);
  } else if (typeof bytes === 'object') {
    if (Array.isArray(bytes.data)) {
      values = bytes.data;
    } else {
      values = Object.keys(bytes)
        .filter((key) => /^\d+$/.test(key))
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => bytes[key]);
    }
  }

  if (values.length !== 12 || values.some((value) => !Number.isInteger(Number(value)))) {
    return '';
  }

  return values.map((value) => Number(value).toString(16).padStart(2, '0')).join('');
}

function toId(val) {
  if (!val) return null;

  if (typeof val === 'string' || typeof val === 'number') {
    const text = String(val).trim();
    return text && text !== '[object Object]' && text !== 'undefined' && text !== 'null' ? text : null;
  }

  if (mongoose.Types.ObjectId.isValid(val) && typeof val !== 'object') {
    return String(val);
  }

  if (typeof val === 'object') {
    if (typeof val.toHexString === 'function') return val.toHexString();
    if (typeof val.$oid === 'string') return val.$oid;

    const bufferId = objectIdBytesToHex(val.buffer) || objectIdBytesToHex(val.id);
    if (bufferId) return bufferId;

    if (val._id && val._id !== val) {
      const nestedId = toId(val._id);
      if (nestedId) return nestedId;
    }

    if (val.id && val.id !== val && typeof val.id !== 'function') {
      const nestedId = toId(val.id);
      if (nestedId) return nestedId;
    }
  }

  if (typeof val.toString === 'function') {
    const text = val.toString().trim();
    return text && text !== '[object Object]' ? text : null;
  }

  return null;
}

function normalizeObjectIdRef(value) {
  const id = toId(value);
  return id && mongoose.Types.ObjectId.isValid(id) ? id : undefined;
}

function normalizeObjectIdArray(values = []) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(normalizeObjectIdRef).filter(Boolean))];
}

// ─── Helper: convert a Mongoose document into a frontend-safe plain object ───
function toPlainProjectResponse(doc) {
  if (!doc) return doc;
  const obj = typeof doc.toObject === 'function'
    ? doc.toObject({ virtuals: true })
    : { ...doc };

  const safeId = normalizeObjectIdRef(obj._id) || normalizeObjectIdRef(obj.id);
  if (safeId) {
    obj._id = safeId;
    obj.id = safeId;
  }

  if (Array.isArray(obj.planningGrids)) {
    obj.planningGrids = obj.planningGrids.map((grid = {}, index) => {
      const gridId = grid.gridId || String.fromCharCode(65 + index);
      const gridName = String(grid.name || grid.gridName || `Project Planning Grid - ${gridId}`).trim() || `Project Planning Grid - ${gridId}`;
      return {
        ...grid,
        gridId,
        name: gridName,
        gridName,
        planningTasks: (grid.planningTasks || []).map((task) => ({
          ...task,
          gridId: task.gridId || gridId,
          gridName: task.gridName || gridName,
        })),
      };
    });
  }

  // Removed Project Details fields are never returned by the new API.
  delete obj.projectType;
  delete obj.projectScopes;
  delete obj.projectDepartment;
  delete obj.panelType;
  delete obj.notes;
  delete obj.legacyProjectDetails;
  obj.projectQuantity = Number(obj.quantity || 1);

  const refreshTask = (task = {}) => ({
    ...task,
    status: effectiveTaskStatus(task),
    delayDays: calculateDelayedDays(task),
  });
  if (Array.isArray(obj.planningGrids)) {
    obj.planningGrids = obj.planningGrids.map((grid) => ({
      ...grid,
      planningTasks: (grid.planningTasks || []).map(refreshTask),
    }));
    obj.planningTasks = obj.planningGrids.flatMap((grid) => grid.planningTasks || []);
  }

  return obj;
}

function isValidMongoId(value) {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

const PROJECT_TASK_STATUSES = [...TASK_STATUSES, 'Hold', 'Not Started', 'Delayed'];

function normalizePlanningStatus(value) {
  return normalizePlanningTaskStatus(value);
}


const PROJECT_DEPARTMENT_ALIASES = Object.freeze({
  ADMIN: 'ADMIN',
  ADMINISTRATION: 'ADMIN',
  SALES: 'SALES',
  SALE: 'SALES',
  ESTIMATION: 'ESTIMATION',
  ESTIMATE: 'ESTIMATION',
  ESTIMATOR: 'ESTIMATION',
  ESTIMATES: 'ESTIMATION',
  DESIGN: 'DESIGN',
  ENGINEERING: 'DESIGN',
  DRAWING: 'DESIGN',
  DRAWINGS: 'DESIGN',
  AUTOMATION: 'AUTOMATION',
  PROGRAMMING: 'AUTOMATION',
  PROGRAM: 'AUTOMATION',
  SOFTWARE: 'AUTOMATION',
  DEVELOPMENT: 'AUTOMATION',
  PRODUCTION: 'PRODUCTION',
  PROD: 'PRODUCTION',
  MANUFACTURING: 'PRODUCTION',
  MFG: 'PRODUCTION',
  PURCHASE: 'PURCHASE',
  PROCUREMENT: 'PURCHASE',
  MATERIAL: 'PURCHASE',
  STORE: 'STORE',
  STORES: 'STORE',
  DISPATCH: 'STORE',
  DESPATCH: 'STORE',
  PACKING: 'STORE',
  QC: 'QC',
  QA: 'QC',
  QUALITY: 'QC',
  QUALITYCONTROL: 'QC',
  INSPECTION: 'QC',
});

function normalizeDepartmentName(value, fallback = '') {
  const text = String(value || fallback || '').trim();
  if (!text) return '';

  const normalized = text
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  const compact = normalized.replace(/\s+/g, '');
  if (PROJECT_DEPARTMENT_ALIASES[compact]) return PROJECT_DEPARTMENT_ALIASES[compact];

  if (/MATERIAL|PROCUREMENT|PURCHASE/.test(normalized)) return 'PURCHASE';
  if (/PROGRAM|SOFTWARE|AUTOMATION|DEVELOP/.test(normalized)) return 'AUTOMATION';
  if (/PRODUCTION|MANUFACTUR|ASSEMBLY|WIRING/.test(normalized)) return 'PRODUCTION';
  if (/QUALITY|QC|QA|INSPECTION|TEST/.test(normalized)) return 'QC';
  if (/DISPATCH|DESPATCH|STORE|PACKING/.test(normalized)) return 'STORE';
  if (/ESTIMAT/.test(normalized)) return 'ESTIMATION';
  if (/SALES?/.test(normalized)) return 'SALES';
  if (/ADMIN/.test(normalized)) return 'ADMIN';
  if (/DESIGN|DRAWING|ENGINEERING/.test(normalized)) return 'DESIGN';

  return normalized;
}

function normalizeSupportedDepartment(value) {
  const upper = normalizeDepartmentName(value);
  const titleMap = {
    DESIGN: 'Design', PRODUCTION: 'Production', PURCHASE: 'Purchase',
    AUTOMATION: 'Automation', STORE: 'Store', QC: 'QC',
  };
  return titleMap[upper] || '';
}

function normalizeSupportedPanelType(value) {
  const text = String(value || '').trim();
  if (text === 'PLC_MCC') return 'MCC cum PLC';
  return SUPPORTED_PANEL_TYPES.includes(text) ? text : '';
}

function getUserNotificationPhone(user = {}) {
  return String(
    user.phone ||
    user.whatsappNumber ||
    user.mobileNumber ||
    user.mobile ||
    ''
  ).trim();
}

const PROJECT_DOCUMENT_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'projects');
fs.mkdirSync(PROJECT_DOCUMENT_UPLOAD_DIR, { recursive: true });

const projectDocumentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PROJECT_DOCUMENT_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const base = path.basename(file.originalname || 'document', ext)
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'document';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${base}${ext}`);
  },
});

const projectDocumentUpload = multer({
  storage: projectDocumentStorage,
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
});

function mapUploadedProjectDocument(file, userId) {
  return {
    name: file.originalname || file.filename,
    storedName: file.filename,
    storagePath: `projects/${file.filename}`,
    mimeType: file.mimetype || '',
    sizeBytes: Number(file.size || 0),
    uploadedBy: userId,
    uploadedAt: new Date(),
  };
}

async function populateProjectForResponse(query) {
  return query
    .populate('assignedTo', 'name email phone')
    .populate('assignedTeamMembers', 'name email role phone')
    .populate('createdBy', 'name')
    .populate('inquiryReference')
    .populate('kickoffMeeting.attendees', 'name email role')
    .populate('documents.uploadedBy', 'name email')
    .populate('planningTasks.assignedTo', 'name email phone')
    .populate('planningGrids.planningTasks.assignedTo', 'name email phone');
}

// ─── Helper: format a date value for display in logs / notifications ──────────
function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return String(d); }
}

// ─── Helper: date / task utilities for activity charts ───────────────────────
function startOfDay(value = new Date()) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(value) {
  const d = startOfDay(value);
  return d ? d.toISOString().split('T')[0] : '';
}

function addDays(value, days) {
  const d = startOfDay(value);
  if (!d) return null;
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function getTaskKey(task = {}, index = 0) {
  return String(task.taskId || task._id || task.taskName || `task-${index}`);
}

function flattenPlanningTasks(project = {}) {
  if (Array.isArray(project.planningGrids) && project.planningGrids.length > 0) {
    return project.planningGrids.flatMap((grid, gridIndex) => (
      (grid.planningTasks || []).map((task, taskIndex) => ({
        ...task,
        gridId: task.gridId || grid.gridId || String.fromCharCode(65 + gridIndex),
        gridName: task.gridName || grid.name || grid.gridName || `Project Planning Grid - ${grid.gridId || String.fromCharCode(65 + gridIndex)}`,
        department: task.department || grid.department || '',
        panelType: grid.panelType || task.panelType || '',
        panelQuantity: Number(grid.panelQuantity || task.panelQuantity || 1),
        planningMode: grid.planningMode || task.planningMode || 'common',
        unitNumber: grid.unitNumber || task.unitNumber || 1,
        isCommon: grid.isCommon !== false,
        __taskIndex: taskIndex,
      }))
    ));
  }

  return (project.planningTasks || []).map((task, index) => ({
    ...task,
    gridId: task.gridId || 'A',
    gridName: task.gridName || 'Project Planning Grid - A',
    __taskIndex: index,
  }));
}

function normalizeTaskStatus(task = {}) {
  const status = String(task.status || 'Pending').trim();
  const plannedEnd = startOfDay(task.plannedEndDate || task.endDate);
  const today = startOfDay(new Date());

  if (status === 'Completed') return 'Completed';
  if (status === 'In Progress') return 'In Progress';
  if (status === 'Delayed' || (plannedEnd && today && plannedEnd < today)) return 'Overdue';
  return 'Pending';
}

function buildTaskActivityDescription(actionType, task = {}, oldValue = '', newValue = '') {
  const title = task.taskName || task.taskTitle || 'Task';
  if (actionType === 'task_created' || actionType === 'task_added') return `Created a new task: ${title}`;
  if (actionType === 'task_deleted') return `Deleted task: ${title}`;
  if (actionType === 'task_assigned') return `Assigned task ${title}${newValue ? ` to ${newValue}` : ''}`;
  if (actionType === 'task_completed') return `Updated task status from ${oldValue || 'Pending'} to Completed: ${title}`;
  if (actionType === 'task_status_changed') return `Updated task status from ${oldValue || '—'} to ${newValue || '—'}: ${title}`;
  return `Updated task: ${title}`;
}

async function getUserNameMap(ids = []) {
  const uniqueIds = [...new Set(ids.filter(Boolean).map(String))];
  if (uniqueIds.length === 0) return {};
  const users = await User.find({ _id: { $in: uniqueIds } }).select('name').lean();
  return users.reduce((acc, user) => {
    acc[String(user._id)] = user.name || 'User';
    return acc;
  }, {});
}

function resolveRange({ dateRange, startDate, endDate }, fallbackStart, fallbackEnd) {
  const today = startOfDay(new Date());
  let from = fallbackStart ? startOfDay(fallbackStart) : addDays(today, -29);
  let to = fallbackEnd ? startOfDay(fallbackEnd) : today;

  if (dateRange === 'today') {
    from = today;
    to = today;
  } else if (dateRange === 'last7') {
    from = addDays(today, -6);
    to = today;
  } else if (dateRange === 'last30') {
    from = addDays(today, -29);
    to = today;
  } else if (dateRange === 'custom') {
    from = startDate ? startOfDay(startDate) : from;
    to = endDate ? startOfDay(endDate) : to;
  }

  if (!from) from = addDays(today, -29);
  if (!to) to = today;
  if (from > to) [from, to] = [to, from];
  return { from, to };
}

// ─── Helper: write one activity log record ────────────────────────────────────
async function logActivity({
  projectId,
  userId,
  userName,
  userAvatar,
  actionType,
  fieldChanged,
  oldValue,
  newValue,
  description,
  taskId,
  taskTitle,
  taskStatus,
  gridId,
  gridName,
  assignedUserId,
  assignedUserName,
  activityDate,
}) {
  try {
    await ProjectActivityLog.create({
      projectId,
      userId:       userId  || null,
      userName:     userName || 'System',
      userAvatar:   userAvatar || '',
      actionType,
      fieldChanged: fieldChanged || '',
      oldValue:     oldValue !== undefined && oldValue !== null ? String(oldValue) : '',
      newValue:     newValue  !== undefined && newValue  !== null ? String(newValue)  : '',
      description:  description || '',
      taskId:       taskId || '',
      taskTitle:    taskTitle || '',
      taskStatus:   taskStatus || '',
      gridId:       gridId || '',
      gridName:     gridName || '',
      assignedUserId: assignedUserId || null,
      assignedUserName: assignedUserName || '',
      activityDate: activityDate || new Date(),
    });
  } catch (err) {
    console.error('[activityLog] failed to write log:', err.message);
  }
}

function getNotificationResultStatus(settledResult) {
  if (!settledResult) return 'Failed';
  if (settledResult.status === 'rejected') return 'Failed';

  const value = settledResult.value || {};
  if (value.ok || value.success || value.status === 'Sent') return 'Sent';
  if (value.status === 'Queued') return 'Queued';
  if (value.status === 'Skipped') return 'Skipped';
  if (value.status === 'Partial') return 'Partial';

  return 'Failed';
}

function getNotificationResultError(settledResult) {
  if (!settledResult) return '';
  if (settledResult.status === 'rejected') return settledResult.reason?.message || String(settledResult.reason || '');
  return settledResult.value?.error || '';
}

// ─── Helper: log + send a WhatsApp notification ───────────────────────────────
async function notifyAndLog({ projectDbId, projectId, projectName, userId, userName, message, personalMsg, phone }) {
  const notificationCalls = [sendWhatsAppGroupNotification(message)];

  if (personalMsg && phone) {
    notificationCalls.push(sendWhatsAppNotification(personalMsg, phone));
  }

  const results = await Promise.allSettled(notificationCalls);
  const groupStatus = getNotificationResultStatus(results[0]);
  const groupError = getNotificationResultError(results[0]);
  const personalStatus = results[1] ? getNotificationResultStatus(results[1]) : '';
  const personalError = results[1] ? getNotificationResultError(results[1]) : '';
  const success = groupStatus === 'Sent';

  const statusParts = [`Group: ${groupStatus}`];
  if (groupError) statusParts.push(`Group error: ${groupError}`);
  if (personalStatus) statusParts.push(`Personal: ${personalStatus}`);
  if (personalError) statusParts.push(`Personal error: ${personalError}`);

  await logActivity({
    projectId: projectDbId,
    userId, userName,
    actionType: success ? 'whatsapp_sent' : 'whatsapp_failed',
    description: `${message}`.substring(0, 430) + `\n${statusParts.join(' | ')}`.substring(0, 70),
  });
}


// ─── DIAGNOSTIC PROBE (read-only) ─────────────────────────────────────────────
// Prints the planning data exactly as it exists immediately before the
// Project → Timesheet sync runs, so we can confirm whether assignedTo survives
// all the way through project save. This is logging only — it reads the doc and
// mutates nothing. Safe to remove once the assignedTo issue is diagnosed.
function logProjectTimesheetSyncProbe(action, project) {
  try {
    const grids = Array.isArray(project?.planningGrids) ? project.planningGrids : [];
    const flatTasks = Array.isArray(project?.planningTasks) ? project.planningTasks : [];

    // Prefer per-grid tasks; fall back to the flattened legacy array.
    const tasks = grids.length > 0
      ? grids.flatMap((grid) => (Array.isArray(grid?.planningTasks) ? grid.planningTasks : []))
      : flatTasks;

    const describeAssignee = (value) => {
      if (value === null || value === undefined) return 'null';
      if (typeof value === 'string') return value || 'null';
      // Populated User doc or raw ObjectId
      if (typeof value === 'object') {
        if (value._id) return String(value._id);
        if (typeof value.toString === 'function') {
          const s = value.toString();
          return s && s !== '[object Object]' ? s : 'null';
        }
      }
      return String(value);
    };

    console.log(`[SyncProbe] ${action} — project ${project?.projectId || 'UNKNOWN'} (${String(project?._id)})`, {
      projectId: project?.projectId || null,
      projectName: project?.projectName || null,
      planningGridsCount: grids.length,
      planningTasksCount: tasks.length,
    });

    tasks.forEach((task) => {
      console.log(
        `[SyncProbe] Task Name: ${task?.taskName || '(unnamed)'} assignedTo: ${describeAssignee(task?.assignedTo)}`
      );
    });

    if (tasks.length === 0) {
      console.log(`[SyncProbe] ${action} — no planning tasks found on project before sync`);
    }
  } catch (probeError) {
    console.error('[SyncProbe] probe logging failed (non-fatal):', probeError?.message || probeError);
  }
}

// ─── Helper: Project → Timesheet sync must never block project operations ─────
async function runProjectTimesheetSyncSafe({ action, oldProject = null, newProject = null, userId = null }) {
  const projectDbId = newProject?._id || oldProject?._id || 'unknown';
  const projectCode = newProject?.projectId || oldProject?.projectId || 'unknown';

  try {
    console.info(`[ProjectTimesheetSync] ${action} sync started`, {
      projectDbId: String(projectDbId),
      projectId: projectCode,
    });

    const result = await syncProjectTasksToTimesheet({
      oldProject,
      newProject,
      userId,
    });

    console.info(`[ProjectTimesheetSync] ${action} sync completed`, {
      projectDbId: String(projectDbId),
      projectId: projectCode,
      result,
    });
  } catch (error) {
    console.error(`[ProjectTimesheetSync] ${action} sync failed`, {
      projectDbId: String(projectDbId),
      projectId: projectCode,
      message: error?.message || String(error),
      syncResult: error?.syncResult || null,
    });
  }
}

async function archiveProjectTimesheetTasksSafe({ project, userId = null }) {
  const projectDbId = project?._id || 'unknown';
  const projectCode = project?.projectId || 'unknown';

  try {
    console.info('[ProjectTimesheetSync] delete archive sync started', {
      projectDbId: String(projectDbId),
      projectId: projectCode,
    });

    const result = await archiveProjectTimesheetTasksForProject({
      project,
      userId,
    });

    console.info('[ProjectTimesheetSync] delete archive sync completed', {
      projectDbId: String(projectDbId),
      projectId: projectCode,
      result,
    });
  } catch (error) {
    console.error('[ProjectTimesheetSync] delete archive sync failed', {
      projectDbId: String(projectDbId),
      projectId: projectCode,
      message: error?.message || String(error),
    });
  }
}

// ─── Helper: diff old vs new project and produce change records ───────────────
const TRACKED_FIELDS = [
  { key: 'projectName',       label: 'Project Name' },
  { key: 'projectStatus',     label: 'Status' },
  { key: 'projectEndDate',    label: 'End Date',       format: fmtDate, actionType: 'end_date_changed' },
  { key: 'orderDate',         label: 'Order Date',     format: fmtDate, actionType: 'start_date_changed' },
  { key: 'quantity',          label: 'Project Quantity' },
  { key: 'productionStatus',  label: 'Production Status' },
  { key: 'dispatchStatus',    label: 'Dispatch Status' },
  { key: 'installationStatus',label: 'Installation Status' },
  { key: 'paymentStatus',     label: 'Payment Status' },
  { key: 'orderValue',        label: 'Order Value' },
  { key: 'completionPercentage', label: 'Completion %' },
];

function diffProject(oldDoc, newBody) {
  const changes = [];
  for (const field of TRACKED_FIELDS) {
    let oldVal = oldDoc[field.key];
    let newVal = newBody[field.key];
    if (newVal === undefined) continue;
    if (field.toId) { oldVal = toId(oldVal); newVal = toId(newVal); }
    const oldStr = field.format ? field.format(oldVal) : String(oldVal ?? '');
    const newStr = field.format ? field.format(newVal) : String(newVal ?? '');
    if (oldStr !== newStr) {
      changes.push({
        fieldChanged: field.label,
        oldValue:     oldStr,
        newValue:     newStr,
        actionType:   field.actionType || 'updated',
      });
    }
  }
  return changes;
}

// ─── Helper: send WhatsApp messages when any role/task is newly assigned ──────
async function notifyAssignments(oldProject, newBody, projectDbId, projectId, projectName, actingUserId, actingUserName) {
  const newTasks = flattenPlanningTasks(newBody);
  if (!Array.isArray(newTasks) || newTasks.length === 0) return;

  const oldTasks = flattenPlanningTasks(oldProject || {});
  const oldTaskMap = new Map();
  oldTasks.forEach((task, index) => {
    oldTaskMap.set(getTaskKey(task, index), task);
  });

  const taskAssignmentsByUser = new Map();

  newTasks.forEach((task, index) => {
    const newAssigneeId = toId(task.assignedTo);
    if (!newAssigneeId) return;

    const key = getTaskKey(task, index);
    const oldTask = oldTaskMap.get(key) || {};
    const oldAssigneeId = toId(oldTask.assignedTo);

    if (newAssigneeId === oldAssigneeId) return;

    if (!taskAssignmentsByUser.has(newAssigneeId)) {
      taskAssignmentsByUser.set(newAssigneeId, []);
    }

    taskAssignmentsByUser.get(newAssigneeId).push({
      taskName: task.taskName || task.taskType || 'Task',
      department: normalizeDepartmentName(task.department || task.taskType || ''),
      gridName: task.gridName || task.gridId || '',
      startDate: task.startDate || task.plannedStartDate,
      endDate: task.endDate || task.plannedEndDate,
    });
  });

  if (taskAssignmentsByUser.size === 0) return;

  const users = await User.find({ _id: { $in: Array.from(taskAssignmentsByUser.keys()) } })
    .select('name phone whatsappNumber mobileNumber mobile')
    .lean();
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  const promises = [];

  for (const [assigneeId, tasks] of taskAssignmentsByUser.entries()) {
    const user = userMap.get(String(assigneeId));
    const userName = user?.name || 'Team member';
    const phone = getUserNotificationPhone(user);
    const groupMsg = buildTaskAssignmentGroupWhatsAppMessage({
      projectName,
      projectId,
      assignedToName: userName,
      tasks,
    });

    const personalMsg = phone
      ? buildTaskAssignmentPersonalWhatsAppMessage({
          userName,
          projectName,
          projectId,
          tasks,
        })
      : null;

    promises.push(
      notifyAndLog({
        projectDbId,
        projectId,
        projectName,
        userId: actingUserId,
        userName: actingUserName,
        message: groupMsg,
        personalMsg,
        phone,
      })
    );
  }

  await Promise.allSettled(promises);
}

// ─── Helper: send WhatsApp for field-level changes ────────────────────────────
async function notifyFieldChanges(changes, projectDbId, projectId, projectName, actingUserId, actingUserName) {
  const promises = [];
  for (const change of changes) {
    const groupMsg = buildProjectFieldChangedWhatsAppMessage({
      projectName,
      projectId,
      fieldChanged: change.fieldChanged,
      oldValue: change.oldValue,
      newValue: change.newValue,
    });

    promises.push(
      notifyAndLog({ projectDbId, projectId, projectName, userId: actingUserId, userName: actingUserName, message: groupMsg })
    );
  }
  await Promise.allSettled(promises);
}

// ─── Helper: delay / completion calculations ─────────────────────────────────
function daysBetween(startDate, endDate) {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  if (!start || !end) return 0;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
}

function buildDelayedEndDate(projectEndDate, delayedDays = 0) {
  if (!projectEndDate) return undefined;
  return addDays(projectEndDate, Number(delayedDays || 0));
}

function calculateProjectDelay(project = {}, previousProject = {}) {
  const expectedEnd = project.projectEndDate || previousProject.projectEndDate;
  const status = project.projectStatus || previousProject.projectStatus || 'Planning';
  const wasCompleted = previousProject.projectStatus === 'Completed';
  const isCompleted = status === 'Completed';
  const today = new Date();

  if (!expectedEnd) {
    return {
      isDelayed: Boolean(project.isDelayed ?? previousProject.isDelayed),
      delayedDays: Number(project.delayedDays ?? previousProject.delayedDays ?? 0),
      delayedEndDate: project.delayedEndDate || previousProject.delayedEndDate,
      completedAt: project.completedAt || previousProject.completedAt,
    };
  }

  if (isCompleted) {
    const completedAt = project.completedAt || previousProject.completedAt || today;
    const delayedDays = daysBetween(expectedEnd, completedAt);
    return {
      completedAt,
      delayedDays,
      isDelayed: delayedDays > 0,
      delayedEndDate: buildDelayedEndDate(expectedEnd, delayedDays),
    };
  }

  // If a completed project is reopened later, keep the frozen completion delay
  // instead of silently losing the original late-completion record.
  if (wasCompleted && previousProject.completedAt) {
    const delayedDays = Number(previousProject.delayedDays || 0);
    return {
      completedAt: previousProject.completedAt,
      delayedDays,
      isDelayed: delayedDays > 0,
      delayedEndDate: previousProject.delayedEndDate || buildDelayedEndDate(expectedEnd, delayedDays),
    };
  }

  const delayedDays = daysBetween(expectedEnd, today);
  return {
    completedAt: project.completedAt || previousProject.completedAt,
    delayedDays,
    isDelayed: delayedDays > 0,
    delayedEndDate: buildDelayedEndDate(expectedEnd, delayedDays),
  };
}

async function recalcDelay(project) {
  return calculateProjectDelay(project, project);
}

const DATE_FIELDS = new Set([
  'orderDate',
  'expectedDeliveryDate',
  'actualDeliveryDate',
  'projectEndDate',
  'completedAt',
  'delayedEndDate',
  'projectStartDate',
  'plannedStartDate',
  'plannedEndDate',
  'actualCompletedDate',
  'startDate',
  'endDate',
]);

function stripEmptyDateValues(value) {
  if (Array.isArray(value)) {
    return value.map(stripEmptyDateValues);
  }

  if (!value || typeof value !== 'object' || value instanceof Date) {
    return value;
  }

  const output = {};
  Object.entries(value).forEach(([key, fieldValue]) => {
    if (DATE_FIELDS.has(key) && (fieldValue === '' || fieldValue === null || fieldValue === undefined)) return;
    output[key] = stripEmptyDateValues(fieldValue);
  });
  return output;
}

function calculateTaskDelay(task = {}, oldTask = {}) {
  const plannedEndDate = task.plannedEndDate || task.endDate || oldTask.plannedEndDate || oldTask.endDate;
  const status = task.status || oldTask.status || 'Pending';

  if (!plannedEndDate) {
    return Number(task.delayDays ?? oldTask.delayDays ?? 0) || 0;
  }

  if (status === 'Completed') {
    const completedDate = task.actualCompletedDate || oldTask.actualCompletedDate || new Date();
    return daysBetween(plannedEndDate, completedDate);
  }

  return daysBetween(plannedEndDate, new Date());
}

function applyProjectDelayFields(body = {}, oldProject = {}) {
  const delayFields = calculateProjectDelay(body, oldProject);
  body.completedAt = delayFields.completedAt;
  body.delayedDays = delayFields.delayedDays;
  body.isDelayed = delayFields.isDelayed;
  body.delayedEndDate = delayFields.delayedEndDate;
  return body;
}


function makeHttpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function safeTaskType(value, fallback = 'Production') {
  return ['Production', 'Programming', 'Common', 'Joint'].includes(value)
    ? value
    : fallback;
}

function gridLetter(index = 0) {
  let n = Number(index) + 1;
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result || 'A';
}

function gridNameFromId(gridId) {
  return `Project Planning Grid - ${gridId || 'A'}`;
}

function calculateTaskCompletion(planningTasks = []) {
  if (!Array.isArray(planningTasks) || planningTasks.length === 0) return 0;
  const completed = planningTasks.filter((task) => task.status === 'Completed').length;
  return Math.round((completed / planningTasks.length) * 100);
}

function getLatestDate(...dateValues) {
  const valid = dateValues
    .flat()
    .filter(Boolean)
    .map((date) => new Date(date))
    .filter((date) => !Number.isNaN(date.getTime()));
  if (valid.length === 0) return undefined;
  return new Date(Math.max(...valid.map((date) => date.getTime())));
}


function normalizePlanningTask(task = {}, index = 0, gridId = 'A', gridName = gridNameFromId(gridId), department = '') {
  const baseTaskId = String(task.taskId || `${gridId}-${index + 1}`).replace(/\s+/g, '-');
  const remark = task.remark ?? task.taskRemark ?? task.comments ?? task.notes ?? '';
  const assignedTo = normalizeObjectIdRef(task.assignedTo);
  return {
    ...task,
    taskId: baseTaskId,
    order: index + 1,
    gridId,
    gridName,
    taskType: department === 'Automation' ? 'Programming' : 'Production',
    department,
    taskName: normalizeExcelTaskName(task.taskName || task.taskTitle || `Task ${index + 1}`),
    inqNo: String(task.inqNo || task.inquiryNumber || '').trim(),
    remark: remark == null ? '' : String(remark),
    assignedTo: assignedTo || undefined,
    dependency: index === 0 ? '' : String(task.dependency || ''),
    totalDays: positiveInteger(task.totalDays ?? task.duration ?? 1, `Days for task ${index + 1}`),
    duration: positiveInteger(task.totalDays ?? task.duration ?? 1, `Days for task ${index + 1}`),
    status: normalizePlanningStatus(task.status),
  };
}

function generatedGridName({ department, panelType, panelQuantity, planningMode, unitNumber }) {
  if (planningMode === 'separate') return `${department} · ${panelType} – Unit ${unitNumber}`;
  if (panelQuantity > 1) return `${department} · ${panelType} – Common Grid – Quantity ${panelQuantity}`;
  return `${department} · ${panelType} – Quantity 1`;
}

function normalizePlanningGrid(grid = {}, index = 0) {
  const gridId = String(grid.gridId || grid.code || `GRID-${index + 1}`).trim();
  const department = normalizeSupportedDepartment(grid.department);
  if (!department) throw makeHttpError(`Planning grid ${gridId} has an unsupported department.`, 400);
  const panelType = normalizeSupportedPanelType(grid.panelType);
  if (!panelType) throw makeHttpError(`Planning grid ${gridId} has an unsupported panel type.`, 400);
  const panelQuantity = positiveInteger(grid.panelQuantity || grid.quantity || 1, `${department} ${panelType} panel quantity`);
  const planningMode = panelQuantity === 1 ? 'common' : String(grid.planningMode || (grid.isCommon === false ? 'separate' : 'common')).toLowerCase();
  if (!PLANNING_MODES.includes(planningMode)) throw makeHttpError(`Invalid planning mode for ${department} ${panelType}.`, 400);
  const unitNumber = planningMode === 'separate'
    ? positiveInteger(grid.unitNumber, `${department} ${panelType} unit number`)
    : undefined;
  const name = generatedGridName({ department, panelType, panelQuantity, planningMode, unitNumber });
  const rawTasks = Array.isArray(grid.planningTasks) && grid.planningTasks.length
    ? grid.planningTasks
    : initialTasksForDepartment(department);
  const sourceTasks = rawTasks.filter((task) => !isKickoffTask(task.taskName));
  const normalizedTasks = sourceTasks.map((task, taskIndex) => normalizePlanningTask(task, taskIndex, gridId, name, department));
  const planningTasks = recalculateTaskSequence(normalizedTasks).map((task, taskIndex) => ({
    ...task,
    taskId: task.taskId || `${gridId}-${taskIndex + 1}`,
    gridId,
    gridName: name,
    department,
    dependency: taskIndex === 0 ? '' : (normalizedTasks[taskIndex - 1]?.taskId || ''),
  }));
  const completionPercentage = calculateTaskCompletion(planningTasks);
  const delayedDays = Math.max(0, ...planningTasks.map((task) => Number(task.delayDays || 0)));
  const projectEndDate = getLatestDate(planningTasks.map((task) => task.plannedEndDate));
  return {
    gridId,
    name,
    gridName: name,
    department,
    panelType,
    panelQuantity,
    planningMode,
    unitNumber,
    isCommon: planningMode === 'common',
    completionPercentage,
    projectEndDate,
    delayedEndDate: buildDelayedEndDate(projectEndDate, delayedDays),
    delayedDays,
    planningTasks,
  };
}

function flattenPlanningGrids(planningGrids = []) {
  return (planningGrids || []).flatMap((grid) => grid.planningTasks || []);
}



function resetCopiedPlanningTask(task = {}) {
  const copiedTask = {
    ...task,
    status: 'Pending',
    plannedStartDate: undefined,
    plannedEndDate: undefined,
    startDate: undefined,
    endDate: undefined,
    actualCompletedDate: undefined,
    delayedEndDate: undefined,
    delayDays: 0,
    lastReminderSent: null,
  };

  const assignedTo = normalizeObjectIdRef(task.assignedTo);
  if (assignedTo) {
    copiedTask.assignedTo = assignedTo;
  } else {
    delete copiedTask.assignedTo;
  }

  return copiedTask;
}

function normalizeCopiedKickoffMeeting(kickoffMeeting) {
  if (!kickoffMeeting || typeof kickoffMeeting !== 'object') return undefined;

  return {
    ...kickoffMeeting,
    attendees: normalizeObjectIdArray(kickoffMeeting.attendees),
    workflowReference: normalizeObjectIdRef(kickoffMeeting.workflowReference),
    createdBy: normalizeObjectIdRef(kickoffMeeting.createdBy),
    scheduledBy: normalizeObjectIdRef(kickoffMeeting.scheduledBy),
  };
}

function buildCopiedProjectPayload(source = {}, userId) {
  const {
    _id,
    projectId,
    createdAt,
    updatedAt,
    __v,
    completedAt,
    orderDate,
    expectedDeliveryDate,
    actualDeliveryDate,
    projectEndDate,
    delayedEndDate,
    inquiryReference,
    inquiryNumber,
    sourceInquirySnapshot,
    ...rest
  } = source;

  const copiedInquiryNumber = String(inquiryNumber || sourceInquirySnapshot?.inquiryId || '').trim();

  const planningGrids = Array.isArray(rest.planningGrids)
    ? rest.planningGrids.map((grid) => ({
        ...grid,
        completionPercentage: 0,
        projectEndDate: undefined,
        delayedDays: 0,
        delayedEndDate: undefined,
        planningTasks: (grid.planningTasks || []).map((task) => ({
          ...resetCopiedPlanningTask(task),
          inqNo: task.inqNo || task.inquiryNumber || copiedInquiryNumber,
        })),
      }))
    : [];

  const planningTasks = planningGrids.length > 0
    ? flattenPlanningGrids(planningGrids)
    : (Array.isArray(rest.planningTasks) ? rest.planningTasks.map((task) => ({
        ...resetCopiedPlanningTask(task),
        inqNo: task.inqNo || task.inquiryNumber || copiedInquiryNumber,
      })) : []);

  return {
    ...rest,
    projectName: `${source.projectName || 'Project'} (Copy)`,
    createdBy: normalizeObjectIdRef(userId),
    customerRef: normalizeObjectIdRef(rest.customerRef),
    assignedTeamMembers: normalizeObjectIdArray(rest.assignedTeamMembers),
    kickoffMeeting: normalizeCopiedKickoffMeeting(rest.kickoffMeeting),
    inquiryReference: undefined,
    inquiryNumber: copiedInquiryNumber,
    sourceInquirySnapshot: {},
    orderDate: undefined,
    expectedDeliveryDate: undefined,
    actualDeliveryDate: undefined,
    projectEndDate: undefined,
    completedAt: undefined,
    projectStatus: 'Planning',
    productionStatus: 'Not Started',
    dispatchStatus: 'Not Delivered',
    installationStatus: 'Not Started',
    paymentStatus: 'Pending',
    completionPercentage: 0,
    delayedDays: 0,
    delayedEndDate: undefined,
    isDelayed: false,
    documents: [],
    planningTasks,
    planningGrids,
  };
}

function validateIncomingPlanningStartDates(input = {}, oldProject = {}) {
  if (!Array.isArray(input.planningGrids)) return;

  const oldTaskDateMap = new Map();
  (oldProject.planningGrids || []).forEach((grid, gridIndex) => {
    (grid.planningTasks || []).forEach((task, taskIndex) => {
      const key = `${String(grid.gridId || gridIndex)}::${getTaskKey(task, taskIndex)}`;
      oldTaskDateMap.set(key, task.plannedStartDate || task.startDate);
    });
  });

  input.planningGrids.forEach((grid, gridIndex) => {
    (grid.planningTasks || []).forEach((task, taskIndex) => {
      const startDate = task.plannedStartDate || task.startDate;
      if (!startDate) return;
      const key = `${String(grid.gridId || gridIndex)}::${getTaskKey(task, taskIndex)}`;
      assertPlanningStartDateAllowed(startDate, {
        existingValue: oldTaskDateMap.get(key),
      });
    });
  });
}

function sanitizeProjectPayload(input = {}, options = {}) {
  const body = stripEmptyDateValues({ ...input });
  const partial = Boolean(options.partial);

  delete body.assignedTo;
  delete body.team;
  delete body.teamId;
  delete body.companyName;
  // Removed fields are ignored during the backward-compatibility window.
  delete body.projectType;
  delete body.projectScopes;
  delete body.projectDepartment;
  delete body.panelType;
  delete body.notes;
  delete body.remark;

  if (body.inquiryNumber !== undefined) body.inquiryNumber = String(body.inquiryNumber || '').trim();

  const hasPlanningPayload = ['selectedDepartments', 'panelSelections', 'planningGrids', 'planningTasks']
    .some((key) => Object.prototype.hasOwnProperty.call(body, key));

  if (Object.prototype.hasOwnProperty.call(body, 'projectQuantity') || Object.prototype.hasOwnProperty.call(body, 'quantity') || !partial) {
    const rawProjectQuantity = body.projectQuantity ?? body.quantity ?? 1;
    body.quantity = positiveInteger(rawProjectQuantity, 'Project Quantity');
  }
  delete body.projectQuantity;

  if (partial && !hasPlanningPayload) return body;

  const selectedDepartments = Array.isArray(body.selectedDepartments)
    ? body.selectedDepartments.map(normalizeSupportedDepartment).filter(Boolean)
    : [];
  body.selectedDepartments = [...new Set(selectedDepartments)];
  body.panelSelections = validatePanelSelections(body.selectedDepartments, Array.isArray(body.panelSelections) ? body.panelSelections : []);

  const selectionMap = new Map(body.panelSelections.map((selection) => [panelSelectionKey(selection.department, selection.panelType), selection]));
  let incomingGrids = Array.isArray(body.planningGrids) ? [...body.planningGrids] : [];

  // Common and quantity-one grids are deterministic and are created automatically.
  body.panelSelections.forEach((selection) => {
    const key = panelSelectionKey(selection.department, selection.panelType);
    const matching = incomingGrids.filter((grid) => panelSelectionKey(normalizeSupportedDepartment(grid.department), normalizeSupportedPanelType(grid.panelType)) === key);
    if ((selection.quantity === 1 || selection.planningMode === 'common') && matching.length === 0) {
      incomingGrids.push({
        gridId: `${selection.department}-${selection.panelType}-COMMON`.replace(/\s+/g, '-').toUpperCase(),
        department: selection.department,
        panelType: selection.panelType,
        panelQuantity: selection.quantity,
        planningMode: 'common',
        isCommon: true,
        planningTasks: initialTasksForDepartment(selection.department),
      });
    }
  });

  body.planningGrids = incomingGrids.map((grid, index) => normalizePlanningGrid(grid, index));

  const gridGroups = new Map();
  body.planningGrids.forEach((grid) => {
    const key = panelSelectionKey(grid.department, grid.panelType);
    const selection = selectionMap.get(key);
    if (!selection) throw makeHttpError(`Planning grid ${grid.name} does not match a selected department and panel type.`, 400);
    if (grid.panelQuantity !== selection.quantity || grid.planningMode !== selection.planningMode) {
      throw makeHttpError(`Planning grid ${grid.name} does not match its panel quantity or planning mode.`, 400);
    }
    if (!gridGroups.has(key)) gridGroups.set(key, []);
    gridGroups.get(key).push(grid);
  });

  body.panelSelections.forEach((selection) => {
    const key = panelSelectionKey(selection.department, selection.panelType);
    const grids = gridGroups.get(key) || [];
    if (selection.planningMode === 'common' && grids.length !== 1) {
      throw makeHttpError(`${selection.department} ${selection.panelType} must have exactly one common planning grid.`, 400);
    }
    if (selection.planningMode === 'separate') {
      if (grids.length > selection.quantity) throw makeHttpError(`Separate grids cannot exceed quantity ${selection.quantity} for ${selection.department} ${selection.panelType}.`, 400);
      const units = grids.map((grid) => grid.unitNumber);
      if (new Set(units).size !== units.length) throw makeHttpError(`Duplicate unit numbers are not allowed for ${selection.department} ${selection.panelType}.`, 400);
      if (units.some((unit) => unit > selection.quantity)) throw makeHttpError(`Unit number cannot exceed quantity ${selection.quantity} for ${selection.department} ${selection.panelType}.`, 400);
    }
  });

  body.planningTasks = flattenPlanningGrids(body.planningGrids);
  const gridCount = body.planningGrids.length;
  body.completionPercentage = gridCount
    ? Math.round(body.planningGrids.reduce((sum, grid) => sum + Number(grid.completionPercentage || 0), 0) / gridCount)
    : 0;
  body.delayedDays = Math.max(0, ...body.planningGrids.map((grid) => Number(grid.delayedDays || 0)));
  const latestEndDate = getLatestDate(body.planningGrids.map((grid) => grid.projectEndDate));
  const latestDelayedEndDate = getLatestDate(body.planningGrids.map((grid) => grid.delayedEndDate || grid.projectEndDate));
  if (latestEndDate) body.projectEndDate = latestEndDate;
  if (latestDelayedEndDate) body.delayedEndDate = latestDelayedEndDate;

  return body;
}

async function attachInquiryNumber(body = {}, options = {}) {
  if (body.inquiryNumber) return body;

  const inquiryId = normalizeObjectIdRef(body.inquiryReference);
  if (inquiryId) {
    const inquiry = await Inquiry.findById(inquiryId).select('inquiryId').lean();
    if (inquiry?.inquiryId) {
      body.inquiryNumber = inquiry.inquiryId;
      return body;
    }
  }

  if (options.generateIfMissing) {
    // Projects created directly from the Project screen still need a traceable
    // inquiry reference. Use the same atomic counter as the Inquiry module so
    // manually-created projects and inquiry-created projects never collide.
    body.inquiryNumber = await getNextInquiryNumber();
  }
  return body;
}

async function attachUniversalCustomer(body = {}, userId, oldProject = {}) {
  const inquiryId = normalizeObjectIdRef(body.inquiryReference || oldProject.inquiryReference);
  let inquiryCustomer = null;

  if (inquiryId && !body.customerRef) {
    inquiryCustomer = await Inquiry.findById(inquiryId)
      .select('customerRef customerName companyType contacts contactPerson mobileNumber email city siteAddress')
      .lean();
  }

  const source = {
    ...(inquiryCustomer || {}),
    ...(oldProject || {}),
    ...body,
    customerRef: body.customerRef || inquiryCustomer?.customerRef || oldProject.customerRef,
  };

  const shouldResolve = Boolean(
    source.customerRef ||
    source.customerName ||
    source.companyName ||
    source.companyType ||
    (Array.isArray(source.contacts) && source.contacts.length) ||
    source.contactPerson ||
    source.mobileNumber ||
    source.email
  );

  if (!shouldResolve) return body;

  const customer = await resolveUniversalCustomer(source, userId, {
    createIfMissing: true,
    updateExisting: true,
  });

  applyCustomerToPayload(body, customer);
  return body;
}


async function normalizeKickoffMeetingPayload(input = {}, userId) {
  const raw = input.kickoffMeeting || input;
  const date = String(raw.date || '').trim();
  const time = String(raw.time || '').trim();
  const attendees = Array.isArray(raw.attendees)
    ? raw.attendees.map(toId).filter(Boolean)
    : [];

  if (!date) {
    throw makeHttpError('Kick-off meeting date is required', 400);
  }

  if (!time) {
    throw makeHttpError('Kick-off meeting time is required', 400);
  }

  if (attendees.length === 0) {
    throw makeHttpError('Please select at least one person for the Kick-off Meeting', 400);
  }

  const scheduledAt = new Date(`${date}T${time}:00`);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw makeHttpError('Invalid Kick-off meeting date or time', 400);
  }

  const uniqueAttendees = [...new Set(attendees)];
  const activeUsersCount = await User.countDocuments({
    _id: { $in: uniqueAttendees },
    isActive: true,
  });

  if (activeUsersCount !== uniqueAttendees.length) {
    throw makeHttpError('One or more selected Kick-off Meeting users are invalid or inactive', 400);
  }

  return {
    scheduledAt,
    date,
    time,
    attendees: uniqueAttendees,
    status: 'Scheduled',
    createdBy: userId,
    scheduledBy: userId,
    scheduledOn: new Date(),
  };
}

async function resolveUserDepartmentSet(user = {}) {
  const values = [user.department, ...(Array.isArray(user.hodDepartments) ? user.hodDepartments : [])].filter(Boolean);
  const ids = [];
  const result = new Set();
  values.forEach((value) => {
    const raw = typeof value === 'object' ? (value.name || value.code || value._id || value.id) : value;
    const text = String(raw || '').trim();
    if (!text) return;
    if (mongoose.Types.ObjectId.isValid(text)) ids.push(text);
    else {
      const normalized = normalizeSupportedDepartment(text);
      if (normalized) result.add(normalized);
    }
  });
  if (ids.length) {
    const departments = await Department.find({ _id: { $in: ids } }).select('name code').lean();
    departments.forEach((department) => {
      const normalized = normalizeSupportedDepartment(department.name || department.code);
      if (normalized) result.add(normalized);
    });
  }
  return result;
}

async function validatePlanningAssignments(planningGrids = [], oldProject = {}) {
  const tasks = Array.isArray(planningGrids)
    ? planningGrids.flatMap((grid) => (grid.planningTasks || []).map((task) => ({ ...task, department: grid.department || task.department })))
    : [];
  const assignedIds = [...new Set(tasks.map((task) => toId(task.assignedTo)).filter(Boolean))];
  if (!assignedIds.length) return;

  const users = await User.find({ _id: { $in: assignedIds } })
    .select('name department hodDepartments isActive')
    .lean();
  const userMap = new Map(users.map((user) => [String(user._id), user]));
  const oldAssignments = new Map(
    flattenPlanningTasks(oldProject || {}).map((task, index) => [getTaskKey(task, index), toId(task.assignedTo)])
  );

  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index];
    const assignedId = toId(task.assignedTo);
    if (!assignedId) continue;
    const user = userMap.get(assignedId);
    const historicalAssignment = oldAssignments.get(getTaskKey(task, index)) === assignedId;
    if (!user) throw makeHttpError(`Assigned user for task "${task.taskName}" was not found.`, 400);
    if (!user.isActive && !historicalAssignment) {
      throw makeHttpError(`Inactive user ${user.name || assignedId} cannot receive a new task assignment.`, 400);
    }
    if (!historicalAssignment) {
      const userDepartments = await resolveUserDepartmentSet(user);
      if (!userDepartments.has(task.department)) {
        throw makeHttpError(`${user.name || 'Selected user'} does not belong to the ${task.department} department required by task "${task.taskName}".`, 400);
      }
    }
  }
}

async function assertPlanningDepartmentScope(user = {}, oldProject = {}, body = {}) {
  const hasPlanningPayload = ['selectedDepartments', 'panelSelections', 'planningGrids', 'planningTasks']
    .some((key) => Object.prototype.hasOwnProperty.call(body, key));
  if (!hasPlanningPayload) return;

  const role = String(user.role || '');
  if (role === 'admin') return;
  if (!['hod', 'manager', 'team_lead'].includes(role)) {
    const oldStructure = normalizePlanningStructure(oldProject);
    const newStructure = normalizePlanningStructure(body);
    if (!permissionValuesEqual(oldStructure, newStructure)) {
      throw makeHttpError('Only Admin, HOD, and TL can change planning structure or task remarks.', 403);
    }
    return;
  }

  const allowedDepartments = await resolveUserDepartmentSet(user);
  const oldGridMap = new Map((oldProject.planningGrids || []).map((grid) => [String(grid.gridId), normalizePermissionValue(grid)]));
  const changedDepartments = new Set();
  (body.planningGrids || []).forEach((grid) => {
    const previous = oldGridMap.get(String(grid.gridId));
    if (!previous || JSON.stringify(previous) !== JSON.stringify(normalizePermissionValue(grid))) {
      changedDepartments.add(grid.department);
    }
  });
  (oldProject.planningGrids || []).forEach((grid) => {
    if (!(body.planningGrids || []).some((next) => String(next.gridId) === String(grid.gridId))) changedDepartments.add(grid.department);
  });
  for (const department of changedDepartments) {
    if (!allowedDepartments.has(department)) {
      throw makeHttpError(`You are not authorized to manage the ${department} planning section.`, 403);
    }
  }
}


function applyActualCompletedDates(body = {}, oldProject = {}) {
  const oldTasks = flattenPlanningTasks(oldProject || {});
  const oldTaskMap = new Map();

  oldTasks.forEach((task, index) => {
    taskIdentityKeys(task, index).forEach((key) => {
      if (!oldTaskMap.has(key)) oldTaskMap.set(key, task);
    });
  });

  const stampTask = (task, index) => {
    const oldTask = taskIdentityKeys(task, index)
      .map((key) => oldTaskMap.get(key))
      .find(Boolean) || {};

    const isCompleted = task.status === 'Completed';
    const wasCompleted = oldTask.status === 'Completed';

    if (isCompleted) {
      task.actualCompletedDate =
        task.actualCompletedDate ||
        oldTask.actualCompletedDate ||
        (!wasCompleted ? new Date() : new Date());
    } else if (oldTask.actualCompletedDate) {
      // Preserve existing completion date if a completed task is reopened later.
      // This avoids losing the frozen delay history.
      task.actualCompletedDate = oldTask.actualCompletedDate;
    }

    task.delayDays = calculateDelayedDays(task);
    return task;
  };

  if (Array.isArray(body.planningGrids)) {
    body.planningGrids = body.planningGrids.map((grid) => {
      const planningTasks = Array.isArray(grid.planningTasks)
        ? grid.planningTasks.map(stampTask)
        : [];

      const delayedDays = Math.max(0, ...planningTasks.map((task) => Number(task.delayDays || 0)));
      return {
        ...grid,
        delayedDays,
        delayedEndDate: buildDelayedEndDate(grid.projectEndDate, delayedDays),
        planningTasks,
      };
    });

    body.planningTasks = flattenPlanningGrids(body.planningGrids);
    const maxDelay = Math.max(0, ...body.planningGrids.map((grid) => Number(grid.delayedDays || 0)));
    body.delayedDays = maxDelay;
  } else if (Array.isArray(body.planningTasks)) {
    body.planningTasks = body.planningTasks.map(stampTask);
  }

  return body;
}

function taskIdentityKeys(task = {}, index = 0) {
  return [
    task.taskId,
    task._id,
    task.taskName,
    `${task.gridId || 'A'}-${task.taskName || ''}`,
    `task-${index}`,
  ]
    .filter(Boolean)
    .map((value) => String(value));
}

function formatGraphDate(value) {
  const date = startOfDay(value);
  if (!date) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}
// ── Get project planning templates extracted from Excel ──────────────────────
const getProjectPlanningTemplates = async (_req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        departments: SUPPORTED_PROJECT_DEPARTMENTS,
        panelTypes: SUPPORTED_PANEL_TYPES,
        planningModes: PLANNING_MODES,
        taskStatuses: TASK_STATUSES,
        disallowedDepartmentsByPanel: DISALLOWED_DEPARTMENTS_BY_PANEL,
        tasksByDepartment: EXCEL_PLANNING_CATALOG.tasksByDepartment,
        importIssues: EXCEL_PLANNING_CATALOG.issues,
        normalizationMappings: NORMALIZATION_MAPPINGS,
        sourceInterpretation: 'Only Excel Task Name and Assigned To are used. Assigned To is interpreted as department, never as an application user.',
      },
    });
  } catch (error) { next(error); }
};

const getPlanningUsers = async (req, res, next) => {
  try {
    const department = normalizeSupportedDepartment(req.query.department);
    if (!department) return res.status(400).json({ success: false, message: 'A supported department is required.' });
    const users = await User.find({ isActive: true })
      .select('name email role department hodDepartments teamId isActive')
      .populate('teamId', 'name')
      .sort({ name: 1 })
      .lean();
    const matching = [];
    for (const user of users) {
      const departments = await resolveUserDepartmentSet(user);
      if (departments.has(department)) matching.push(user);
    }
    return res.json({ success: true, data: matching });
  } catch (error) { next(error); }
};

const validatePlanningImport = async (_req, res, next) => {
  try {
    return res.json({
      success: true,
      data: {
        tasksByDepartment: EXCEL_PLANNING_CATALOG.tasksByDepartment,
        issues: EXCEL_PLANNING_CATALOG.issues,
        excludedTasks: ['Kick-off variations'],
        renamedTasks: { 'BOM Preparation': 'Engineering BOM Preparation' },
        normalizationMappings: NORMALIZATION_MAPPINGS,
      },
    });
  } catch (error) { next(error); }
};

const recalculatePlanningPreview = async (req, res, next) => {
  try {
    validateIncomingPlanningStartDates({ planningGrids: [req.body || {}] }, {});
    return res.json({ success: true, data: normalizePlanningGrid(req.body || {}, 0) });
  } catch (error) { next(error); }
};


const padYearSuffix = (year) => String(year % 100).padStart(2, '0');

const parseFinancialYear = (value) => {
  if (typeof value !== 'string') return null;

  const match = value.trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const startYear = Number(match[1]);
  const endSuffix = Number(match[2]);

  if (!Number.isInteger(startYear) || startYear < 2000 || startYear > 2100) return null;
  if (endSuffix !== Number(padYearSuffix(startYear + 1))) return null;

  return startYear;
};

const getFinancialYearDateFilter = (financialYear) => {
  if (String(financialYear || '').trim().toLowerCase() === 'all') return null;
  const startYear = parseFinancialYear(financialYear);
  if (!startYear) return null;

  return {
    $gte: new Date(startYear, 3, 1, 0, 0, 0, 0),
    $lt: new Date(startYear + 1, 3, 1, 0, 0, 0, 0),
  };
};

const applyFinancialYearFilter = (query, financialYear) => {
  const orderDate = getFinancialYearDateFilter(financialYear);
  if (orderDate) query.orderDate = orderDate;
};

const CLOSED_PROJECT_STATUSES_FOR_RISK = ['Completed', 'Closed', 'Cancelled', 'Canceled', 'Removed'];
const DELAYED_TASK_STATUS_VALUES = ['Delay', 'Delayed'];

function startOfDate(value = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDate(value = new Date()) {
  const date = startOfDate(value);
  if (!date) return null;
  date.setHours(23, 59, 59, 999);
  return date;
}

function addRiskDays(value, days) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + Number(days || 0));
  return date;
}

const delayedTaskProjectQuery = () => ({
  $or: [
    { 'planningTasks.status': { $in: DELAYED_TASK_STATUS_VALUES } },
    { 'planningTasks.delayDays': { $gt: 0 } },
    { 'planningGrids.planningTasks.status': { $in: DELAYED_TASK_STATUS_VALUES } },
    { 'planningGrids.planningTasks.delayDays': { $gt: 0 } },
  ],
});

const overdueProjectQuery = (todayStart) => ({
  $or: [
    { projectEndDate: { $lt: todayStart } },
    { isDelayed: true },
    { delayedDays: { $gt: 0 } },
  ],
});

function applyProjectRiskFilter(query, riskFilter) {
  const filter = String(riskFilter || '').trim();
  if (!filter) return;

  const todayStart = startOfDate(new Date());
  const todayEnd = endOfDate(todayStart);
  const weekEnd = endOfDate(addRiskDays(todayStart, 7));

  query.projectStatus = query.projectStatus || { $nin: CLOSED_PROJECT_STATUSES_FOR_RISK };

  if (filter === 'delayedTasks') {
    Object.assign(query, delayedTaskProjectQuery());
    return;
  }

  if (filter === 'dueToday') {
    query.projectEndDate = { $gte: todayStart, $lte: todayEnd };
    return;
  }

  if (filter === 'dueThisWeek') {
    query.projectEndDate = { $gte: todayStart, $lte: weekEnd };
    return;
  }

  if (filter === 'overdue' || filter === 'delayed') {
    Object.assign(query, overdueProjectQuery(todayStart));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLLERS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Get all projects ──────────────────────────────────────────────────────────
const getProjects = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, projectStatus, paymentStatus, orderDate, financialYear, riskFilter } = req.query;
    const query = {};
    applyFinancialYearFilter(query, financialYear);
    if (projectStatus) query.projectStatus = projectStatus;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (orderDate) {
      const selectedDate = new Date(orderDate);
      if (!Number.isNaN(selectedDate.getTime())) {
        const start = new Date(selectedDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(selectedDate);
        end.setHours(23, 59, 59, 999);
        query.orderDate = { $gte: start, $lte: end };
      }
    }
    applyProjectRiskFilter(query, riskFilter);
    if (search) {
      const matchedCustomerIds = await findCustomerIdsForSearch(search);
      query.$or = [
        { projectId:    { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { companyName:  { $regex: search, $options: 'i' } },
        { projectName:  { $regex: search, $options: 'i' } },
        { inquiryNumber: { $regex: search, $options: 'i' } },
        ...(matchedCustomerIds.length ? [{ customerRef: { $in: matchedCustomerIds } }] : []),
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [projects, total] = await Promise.all([
      Project.find(query)
        .populate('assignedTo', 'name email phone')
        .populate('assignedTeamMembers', 'name email role phone')
        .populate('createdBy', 'name')
        .populate('customerRef', 'customerId customerName companyType contacts contactPerson email mobileNumber city address gstNumber notes')
        .populate('inquiryReference', 'inquiryId')
        .populate('kickoffMeeting.attendees', 'name email role')
        .populate('documents.uploadedBy', 'name email')
        .populate('planningTasks.assignedTo', 'name email phone')
        .populate('planningGrids.planningTasks.assignedTo', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Project.countDocuments(query),
    ]);

    // Live recalculate delay for incomplete projects and preserve/freeze delay for completed projects.
    for (const p of projects) {
      const delayFields = await recalcDelay(p);
      const needsUpdate =
        p.isDelayed !== delayFields.isDelayed ||
        Number(p.delayedDays || 0) !== Number(delayFields.delayedDays || 0) ||
        String(p.completedAt || '') !== String(delayFields.completedAt || '') ||
        String(p.delayedEndDate || '') !== String(delayFields.delayedEndDate || '');

      if (needsUpdate) {
        Project.findByIdAndUpdate(p._id, delayFields).exec();
        p.isDelayed = delayFields.isDelayed;
        p.delayedDays = delayFields.delayedDays;
        p.completedAt = delayFields.completedAt;
        p.delayedEndDate = delayFields.delayedEndDate;
      }
    }

    res.json({
      success: true,
      data: projects.map((item) => toPlainProjectResponse(getLiveCustomerSnapshot(item.toObject ? item.toObject() : item))),
      pagination: {
        total,
        page:  Number(page),
        pages: Math.ceil(total / Number(limit)),
        limit: Number(limit),
      },
    });
  } catch (error) { next(error); }
};

// ── Get single project ────────────────────────────────────────────────────────
const getProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('assignedTo', 'name email phone')
      .populate('assignedTeamMembers', 'name email role phone')
      .populate('createdBy', 'name')
      .populate('customerRef', 'customerId customerName companyType contacts contactPerson email mobileNumber city address gstNumber notes')
      .populate('inquiryReference')
      .populate('kickoffMeeting.attendees', 'name email role')
      .populate('documents.uploadedBy', 'name email')
      .populate('planningTasks.assignedTo', 'name email phone')
        .populate('planningGrids.planningTasks.assignedTo', 'name email phone');
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    // Live/frozen delay recalculation
    const delayFields = await recalcDelay(project);
    const needsDelayUpdate =
      project.isDelayed !== delayFields.isDelayed ||
      Number(project.delayedDays || 0) !== Number(delayFields.delayedDays || 0) ||
      String(project.completedAt || '') !== String(delayFields.completedAt || '') ||
      String(project.delayedEndDate || '') !== String(delayFields.delayedEndDate || '');

    if (needsDelayUpdate) {
      project.isDelayed = delayFields.isDelayed;
      project.delayedDays = delayFields.delayedDays;
      project.completedAt = delayFields.completedAt;
      project.delayedEndDate = delayFields.delayedEndDate;
      await Project.findByIdAndUpdate(project._id, delayFields);
    }

    return res.json({ success: true, data: toPlainProjectResponse(getLiveCustomerSnapshot(project.toObject ? project.toObject() : project)) });
  } catch (error) { next(error); }
};

// ── Get Tasks vs Days graph data ─────────────────────────────────────────────
const getTaskCompletionHistory = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('planningTasks.assignedTo', 'name email phone avatar')
      .populate('planningGrids.planningTasks.assignedTo', 'name email phone avatar')
      .lean();

    if (!project) return res.json({ success: true, data: [] });

    const allTasks = flattenPlanningTasks(project);
    if (allTasks.length === 0) return res.json({ success: true, data: [] });

    const {
      dateRange = 'projectTimeline',
      startDate,
      endDate,
      userId = '',
    } = req.query;

    const completionLogs = await ProjectActivityLog.find({
      projectId: req.params.id,
      actionType: { $in: ['task_completed', 'task_status_changed'] },
      $or: [
        { actionType: 'task_completed' },
        { newValue: 'Completed' },
        { taskStatus: 'Completed' },
      ],
    })
      .sort({ createdAt: 1 })
      .lean();

    const completionLogByKey = new Map();

    completionLogs.forEach((log) => {
      const logDate = startOfDay(log.activityDate || log.createdAt);
      if (!logDate) return;

      [log.taskId, log.taskTitle, `${log.gridId || 'A'}-${log.taskTitle || ''}`]
        .filter(Boolean)
        .map((value) => String(value))
        .forEach((key) => {
          if (!completionLogByKey.has(key)) {
            completionLogByKey.set(key, logDate);
          }
        });
    });

    const today = startOfDay(new Date());

    const preparedTasks = allTasks.map((task, index) => {
      const assigneeId = String(task.assignedTo?._id || task.assignedTo || '');
      const expectedDate = startOfDay(
        task.plannedEndDate ||
        task.endDate ||
        task.plannedStartDate ||
        task.startDate
      );

      let actualCompletedDate = startOfDay(task.actualCompletedDate);

      if (!actualCompletedDate && task.status === 'Completed') {
        for (const key of taskIdentityKeys(task, index)) {
          if (completionLogByKey.has(key)) {
            actualCompletedDate = completionLogByKey.get(key);
            break;
          }
        }
      }

      const delayedEndDate = startOfDay(task.delayedEndDate);
      const storedTaskDelayDays = Number(task.delayDays || task.autoDelayDays || 0);

      // Completed late tasks must remain on the delayed/red series.
      // If an older saved task is completed but is missing actualCompletedDate,
      // infer the completed date from the frozen delay value instead of falling
      // back to a green/on-time completed point.
      if (!actualCompletedDate && task.status === 'Completed' && expectedDate && storedTaskDelayDays > 0) {
        actualCompletedDate = addDays(expectedDate, storedTaskDelayDays);
      }

      if (!actualCompletedDate && task.status === 'Completed') {
        actualCompletedDate = today;
      }

      const status = normalizePlanningStatus(task.status || 'Pending');
      const isNotStarted = status === 'Pending';
      const isCompleted = status === 'Completed';
      const isInProgress = status === 'In Progress';
      const isHold = status === 'Hold';
      const isDelayStatus = status === 'Delay' || status === 'Delayed';
      const isExplicitDelayed = isDelayStatus || storedTaskDelayDays > 0;
      const isOverdue = Boolean(expectedDate && today && today > expectedDate && !isCompleted && !isHold);
      const isCompletedLate = Boolean(expectedDate && actualCompletedDate && actualCompletedDate > expectedDate);
      const isDelayed = isExplicitDelayed || isOverdue || isCompletedLate;

      let expectedDisplayDate = null;
      let actualDisplayDate = null;
      let inProgressDisplayDate = null;
      let delayedDisplayDate = null;
      let holdDisplayDate = null;

      if (!userId || userId === assigneeId) {
        // Expected is always pre-decided by planning dates.
        // It must appear immediately after dates are added, even if the task is still Pending.
        expectedDisplayDate = expectedDate;

        // Actual/progress/delay points appear only after status changes or delay happens.
        if (isCompleted) {
          if (isCompletedLate || storedTaskDelayDays > 0) {
            delayedDisplayDate = actualCompletedDate || delayedEndDate || addDays(expectedDate, storedTaskDelayDays);
          } else {
            actualDisplayDate = actualCompletedDate;
          }
        } else if (isHold) {
          holdDisplayDate = today || expectedDate;
        } else if (isDelayed) {
          const extendedDate = delayedEndDate && expectedDate && delayedEndDate > expectedDate
            ? delayedEndDate
            : today;
          delayedDisplayDate = extendedDate || expectedDate;
        } else if (isInProgress) {
          inProgressDisplayDate = today;
        }
      }

      return {
        task,
        index,
        expectedDate: expectedDisplayDate,
        actualDate: actualDisplayDate,
        inProgressDate: inProgressDisplayDate,
        delayedDate: delayedDisplayDate,
        holdDate: holdDisplayDate,
        originalExpectedDate: expectedDate,
        rawActualCompletedDate: actualCompletedDate,
        status,
        isDelayed,
        isNotStarted,
      };
    });

    const allDates = preparedTasks
      .flatMap((row) => [row.expectedDate, row.actualDate, row.inProgressDate, row.delayedDate, row.holdDate])
      .filter(Boolean);

    if (allDates.length === 0) {
      return res.json({ success: true, data: [] });
    }

    let from = new Date(Math.min(...allDates.map((date) => date.getTime())));
    let to = new Date(Math.max(...allDates.map((date) => date.getTime())));

    if (dateRange !== 'projectTimeline') {
      const resolved = resolveRange(
        { dateRange, startDate, endDate },
        from,
        to
      );

      from = resolved.from;
      to = resolved.to;
    }

    const baseDate = startOfDay(from);

    const toDayNumber = (date) => {
      const d = startOfDay(date);
      if (!d || !baseDate) return null;
      if (d < from || d > to) return null;
      return Math.round((d.getTime() - baseDate.getTime()) / (24 * 60 * 60 * 1000));
    };

    const data = preparedTasks.map((row) => {
      const expectedDay = toDayNumber(row.expectedDate);
      const actualDay = toDayNumber(row.actualDate);
      const inProgressDay = toDayNumber(row.inProgressDate);
      const delayedDay = toDayNumber(row.delayedDate);
      const holdDay = toDayNumber(row.holdDate);
      const delayDays = row.originalExpectedDate && (row.rawActualCompletedDate || row.delayedDate)
        ? Math.max(0, Math.round(((row.rawActualCompletedDate || row.delayedDate).getTime() - row.originalExpectedDate.getTime()) / (24 * 60 * 60 * 1000)))
        : Number(row.task.delayDays || 0);

      return {
        taskNo: row.index + 1,
        taskLabel: String(row.index + 1).padStart(2, '0'),
        taskName: row.task.taskName || `Task ${row.index + 1}`,
        department: row.task.department || row.task.taskType || '',
        panelType: row.task.panelType || '',
        panelQuantity: Number(row.task.panelQuantity || 1),
        planningMode: row.task.planningMode || 'common',
        unitNumber: row.task.unitNumber || 1,
        isCommon: row.task.isCommon !== false,
        panelLabel: row.task.panelType
          ? (row.task.planningMode === 'separate'
              ? `${row.task.panelType} · Unit ${row.task.unitNumber || 1}`
              : Number(row.task.panelQuantity || 1) > 1
                ? `${row.task.panelType} · Common for ${row.task.panelQuantity} units`
                : `${row.task.panelType} · Single unit`)
          : '',
        status: row.status,
        gridId: row.task.gridId || 'A',
        gridName: row.task.gridName || 'Project Planning Grid - A',
        expectedDay,
        actualDay,
        inProgressDay,
        delayedDay,
        holdDay,
        expectedDate: row.expectedDate ? row.expectedDate.toISOString() : null,
        actualDate: row.actualDate ? row.actualDate.toISOString() : null,
        inProgressDate: row.inProgressDate ? row.inProgressDate.toISOString() : null,
        delayedDate: row.delayedDate ? row.delayedDate.toISOString() : null,
        holdDate: row.holdDate ? row.holdDate.toISOString() : null,
        expectedDateLabel: formatGraphDate(row.expectedDate),
        actualDateLabel: row.actualDate ? formatGraphDate(row.actualDate) : 'Not completed',
        inProgressDateLabel: row.inProgressDate ? formatGraphDate(row.inProgressDate) : '',
        delayedDateLabel: row.delayedDate ? formatGraphDate(row.delayedDate) : '',
        holdDateLabel: row.holdDate ? formatGraphDate(row.holdDate) : '',
        delayDays,
        isNotStarted: row.isNotStarted,
        baseDate: baseDate ? baseDate.toISOString() : null,
      };
    });

    res.json({
      success: true,
      data,
      meta: {
        baseDate: baseDate ? baseDate.toISOString() : null,
        startDate: from.toISOString(),
        endDate: to.toISOString(),
      },
    });
  } catch (error) { next(error); }
};

// ── Get project activity log ──────────────────────────────────────────────────
const getProjectActivityLog = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 100,
      dateRange = 'last30',
      startDate,
      endDate,
      actionType = '',
      status = '',
      userId = '',
      search = '',
    } = req.query;

    const today = startOfDay(new Date());
    const { from, to } = resolveRange({ dateRange, startDate, endDate }, addDays(today, -29), today);
    const toExclusive = addDays(to, 1);

    const query = {
      projectId: req.params.id,
      createdAt: { $gte: from, $lt: toExclusive },
    };

    if (actionType) query.actionType = actionType;
    if (userId) query.userId = userId;

    if (status) {
      const normalizedStatus = String(status).replace(/-/g, ' ');
      query.$or = [
        { taskStatus: { $regex: normalizedStatus, $options: 'i' } },
        { oldValue: { $regex: normalizedStatus, $options: 'i' } },
        { newValue: { $regex: normalizedStatus, $options: 'i' } },
      ];
    }

    if (search) {
      const searchOr = [
        { userName: { $regex: search, $options: 'i' } },
        { actionType: { $regex: search, $options: 'i' } },
        { taskTitle: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { fieldChanged: { $regex: search, $options: 'i' } },
      ];

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchOr }];
        delete query.$or;
      } else {
        query.$or = searchOr;
      }
    }

    const safeLimit = Math.min(Number(limit) || 100, 200);
    const safePage = Math.max(Number(page) || 1, 1);
    const skip = (safePage - 1) * safeLimit;

    const [logs, total] = await Promise.all([
      ProjectActivityLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      ProjectActivityLog.countDocuments(query),
    ]);

    const userIds = Array.from(new Set(
      logs
        .map((log) => log.userId?.toString?.())
        .filter(Boolean)
    ));

    const users = userIds.length
      ? await User.find({ _id: { $in: userIds } }).select('_id avatar').lean()
      : [];

    const avatarByUserId = users.reduce((acc, item) => {
      acc[item._id.toString()] = item.avatar || '';
      return acc;
    }, {});

    const data = logs.map(log => ({
      ...log,
      userAvatar: log.userAvatar || avatarByUserId[log.userId?.toString?.()] || '',
      date: toISODate(log.createdAt),
      timestamp: log.createdAt,
      userInitials: String(log.userName || 'System')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0])
        .join('')
        .toUpperCase() || 'S',
    }));

    res.json({
      success: true,
      data,
      pagination: {
        total,
        page: safePage,
        pages: Math.ceil(total / safeLimit) || 1,
        limit: safeLimit,
      },
    });
  } catch (error) { next(error); }
};



// ── Project Employee Access authorization helpers ───────────────────────────
const PROJECT_GENERAL_EDIT_FIELDS = Object.freeze([
  'customerRef',
  'customerName',
  'projectName',
  'quantity',
  'selectedDepartments',
  'panelSelections',
  'orderValue',
  'orderDate',
  'expectedDeliveryDate',
  'actualDeliveryDate',
  'productionStatus',
  'dispatchStatus',
  'installationStatus',
  'paymentStatus',
  'assignedTeamMembers',
  'kickoffMeeting',
  'inquiryReference',
  'inquiryNumber',
]);

const normalizePermissionDate = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
};

const normalizePermissionId = (value) => {
  if (!value) return '';
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return value.toHexString();
    if (value._id) return normalizePermissionId(value._id);
    if (value.id && value.id !== value) return normalizePermissionId(value.id);
  }
  return String(value);
};

const normalizePermissionValue = (value, key = '') => {
  if (value === undefined || value === null) return '';
  if (key === 'customerRef' || key === 'inquiryReference' || key === 'assignedTo' || key === 'createdBy') {
    return normalizePermissionId(value);
  }
  if (/Date$|At$/.test(key)) return normalizePermissionDate(value);
  if (value instanceof Date) return normalizePermissionDate(value);
  if (Array.isArray(value)) return value.map((item) => normalizePermissionValue(item, key));
  if (typeof value === 'object') {
    return Object.keys(value)
      .filter((childKey) => childKey !== '_id' && childKey !== '__v')
      .sort()
      .reduce((acc, childKey) => {
        acc[childKey] = normalizePermissionValue(value[childKey], childKey);
        return acc;
      }, {});
  }
  if (typeof value === 'number') return Number(value);
  if (typeof value === 'boolean') return value;
  return String(value).trim();
};

const permissionValuesEqual = (left, right, key = '') => (
  JSON.stringify(normalizePermissionValue(left, key)) ===
  JSON.stringify(normalizePermissionValue(right, key))
);

const normalizePlanningStructure = (project = {}) => {
  const grids = Array.isArray(project.planningGrids) && project.planningGrids.length > 0
    ? project.planningGrids
    : [{
        gridId: 'A',
        name: 'Project Planning Grid - A',
        projectEndDate: project.projectEndDate,
        planningTasks: project.planningTasks || [],
      }];

  return grids.map((grid = {}, gridIndex) => ({
    department: String(grid.department || ''),
    panelType: String(grid.panelType || ''),
    panelQuantity: Number(grid.panelQuantity || 1),
    planningMode: String(grid.planningMode || ''),
    unitNumber: grid.unitNumber == null ? '' : Number(grid.unitNumber),
    isCommon: grid.isCommon !== false,
    gridId: String(grid.gridId || String.fromCharCode(65 + gridIndex)),
    name: String(grid.name || grid.gridName || '').trim(),
    projectEndDate: normalizePermissionDate(grid.projectEndDate),
    planningTasks: (grid.planningTasks || []).map((task = {}, taskIndex) => ({
      taskId: String(task.taskId || `${gridIndex}-${taskIndex}`),
      gridId: String(task.gridId || grid.gridId || String.fromCharCode(65 + gridIndex)),
      gridName: String(task.gridName || grid.name || grid.gridName || '').trim(),
      taskType: String(task.taskType || ''),
      department: String(task.department || ''),
      taskName: String(task.taskName || task.taskTitle || ''),
      inqNo: String(task.inqNo || task.inquiryNumber || ''),
      remark: String(task.remark || ''),
      assignedTo: normalizePermissionId(task.assignedTo),
      dependency: String(task.dependency || ''),
      milestone: Boolean(task.milestone),
      plannedStartDate: normalizePermissionDate(task.plannedStartDate || task.startDate),
      plannedEndDate: normalizePermissionDate(task.plannedEndDate || task.endDate),
      totalDays: Math.max(1, Number(task.totalDays ?? task.duration) || 1),
    })),
  }));
};

const planningTaskOrderChanged = (oldProject = {}, nextProject = {}) => {
  const oldGrids = normalizePlanningStructure(oldProject);
  const nextGrids = normalizePlanningStructure(nextProject);
  const oldGridMap = new Map(oldGrids.map((grid) => [String(grid.gridId), grid]));

  return nextGrids.some((nextGrid) => {
    const oldGrid = oldGridMap.get(String(nextGrid.gridId));
    if (!oldGrid) return false;

    const oldIds = (oldGrid.planningTasks || []).map((task) => String(task.taskId || '')).filter(Boolean);
    const nextIds = (nextGrid.planningTasks || []).map((task) => String(task.taskId || '')).filter(Boolean);
    const oldSet = new Set(oldIds);
    const nextSet = new Set(nextIds);
    const oldCommonOrder = oldIds.filter((id) => nextSet.has(id));
    const nextCommonOrder = nextIds.filter((id) => oldSet.has(id));

    return oldCommonOrder.length > 1 &&
      oldCommonOrder.length === nextCommonOrder.length &&
      oldCommonOrder.some((id, index) => id !== nextCommonOrder[index]);
  });
};

const assertPlanningReorderRole = (user = {}, oldProject = {}, body = {}) => {
  if (!Array.isArray(body.planningGrids) && !Array.isArray(body.planningTasks)) return;
  if (!planningTaskOrderChanged(oldProject, body)) return;
  if (PLANNING_REORDER_ROLES.has(String(user.role || ''))) return;

  const error = new Error('Only Admin, HOD, and Team Lead users can reorder project planning tasks.');
  error.statusCode = 403;
  error.isOperational = true;
  throw error;
};

const planningTaskPermissionKey = (task = {}, index = 0) => (
  `${String(task.gridId || 'A')}::${getTaskKey(task, index)}`
);

const planningTaskPermissionMap = (project = {}) => {
  const map = new Map();
  flattenPlanningTasks(project).forEach((task, index) => {
    map.set(planningTaskPermissionKey(task, index), task);
  });
  return map;
};

const assertTaskStartDateRole = (user = {}, oldProject = {}, body = {}) => {
  if (!Array.isArray(body.planningGrids) && !Array.isArray(body.planningTasks)) return;

  const oldTaskMap = planningTaskPermissionMap(oldProject);
  const changed = flattenPlanningTasks(body).some((task, index) => {
    const previous = oldTaskMap.get(planningTaskPermissionKey(task, index));
    return !permissionValuesEqual(
      previous?.plannedStartDate || previous?.startDate,
      task.plannedStartDate || task.startDate,
      'plannedStartDate'
    );
  });

  if (!changed || PLANNING_REORDER_ROLES.has(String(user.role || ''))) return;

  const error = new Error('Only Admin, HOD, and Team Lead users can set or change individual task start dates.');
  error.statusCode = 403;
  error.isOperational = true;
  throw error;
};

const assertTaskStatusOwnership = (user = {}, oldProject = {}, body = {}) => {
  if (!Array.isArray(body.planningGrids) && !Array.isArray(body.planningTasks)) return;

  const currentUserId = toId(user._id || user.id);
  const oldTaskMap = planningTaskPermissionMap(oldProject);

  flattenPlanningTasks(body).forEach((task, index) => {
    const previous = oldTaskMap.get(planningTaskPermissionKey(task, index));
    const previousStatus = normalizePlanningTaskStatus(previous?.status || 'Pending');
    const nextStatus = normalizePlanningTaskStatus(task.status || 'Pending');
    const statusChanged = previous
      ? previousStatus !== nextStatus
      : nextStatus !== 'Pending';

    if (!statusChanged) return;

    const assignedUserId = toId(previous?.assignedTo || task.assignedTo);
    if (assignedUserId && currentUserId && assignedUserId === currentUserId) return;

    const error = new Error(`Only the user assigned to task "${task.taskName || 'Task'}" can change its status.`);
    error.statusCode = 403;
    error.isOperational = true;
    throw error;
  });
};

const normalizePlanningCompletion = (project = {}) => {
  const grids = Array.isArray(project.planningGrids) && project.planningGrids.length > 0
    ? project.planningGrids
    : [{ gridId: 'A', planningTasks: project.planningTasks || [] }];

  return {
    completionPercentage: Number(project.completionPercentage || 0),
    grids: grids.map((grid = {}, gridIndex) => ({
      gridId: String(grid.gridId || String.fromCharCode(65 + gridIndex)),
      completionPercentage: Number(grid.completionPercentage || 0),
      planningTasks: (grid.planningTasks || []).map((task = {}, taskIndex) => ({
        taskId: String(task.taskId || `${gridIndex}-${taskIndex}`),
        status: String(task.status || 'Pending'),
        actualCompletedDate: normalizePermissionDate(task.actualCompletedDate),
      })),
    })),
  };
};

const getRequiredProjectUpdatePermissions = (oldProject = {}, body = {}) => {
  const required = new Set();

  PROJECT_GENERAL_EDIT_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field) && !permissionValuesEqual(oldProject[field], body[field], field)) {
      required.add(PROJECT_PERMISSIONS.EDIT);
    }
  });

  if (
    Object.prototype.hasOwnProperty.call(body, 'projectEndDate') &&
    !permissionValuesEqual(oldProject.projectEndDate, body.projectEndDate, 'projectEndDate')
  ) {
    required.add(PROJECT_PERMISSIONS.PLANNING_GRID);
  }

  if (
    Object.prototype.hasOwnProperty.call(body, 'projectStatus') &&
    String(body.projectStatus || '') !== String(oldProject.projectStatus || '')
  ) {
    if (String(body.projectStatus) === 'Completed') {
      required.add(PROJECT_PERMISSIONS.MARK_COMPLETED);
    } else {
      required.add(PROJECT_PERMISSIONS.EDIT);
    }
  }

  if (Array.isArray(body.planningGrids) || Array.isArray(body.planningTasks)) {
    const oldStructure = normalizePlanningStructure(oldProject);
    const newStructure = normalizePlanningStructure(body);
    const commonGridCount = Math.min(oldStructure.length, newStructure.length);

    if (newStructure.length > oldStructure.length) {
      required.add(PROJECT_PERMISSIONS.ADD_DUPLICATE_PLANNING_GRID);
    }

    if (newStructure.length < oldStructure.length) {
      required.add(PROJECT_PERMISSIONS.PLANNING_GRID);
    }

    if (!permissionValuesEqual(oldStructure.slice(0, commonGridCount), newStructure.slice(0, commonGridCount))) {
      required.add(PROJECT_PERMISSIONS.PLANNING_GRID);
    }

    const oldCompletion = normalizePlanningCompletion(oldProject);
    const newCompletion = normalizePlanningCompletion(body);
    const commonCompletionGridCount = Math.min(
      oldCompletion.grids.length,
      newCompletion.grids.length
    );
    const addedGridHasCompletionChanges = newCompletion.grids
      .slice(oldCompletion.grids.length)
      .some((grid) => (
        Number(grid.completionPercentage || 0) !== 0 ||
        grid.planningTasks.some((task) => (
          String(task.status || 'Pending') !== 'Pending' || Boolean(task.actualCompletedDate)
        ))
      ));
    const completionChanged =
      Number(oldCompletion.completionPercentage || 0) !== Number(newCompletion.completionPercentage || 0) ||
      !permissionValuesEqual(
        oldCompletion.grids.slice(0, commonCompletionGridCount),
        newCompletion.grids.slice(0, commonCompletionGridCount)
      ) ||
      addedGridHasCompletionChanges;

    if (completionChanged) {
      required.add(PROJECT_PERMISSIONS.UPDATE_COMPLETION);
    }
  }

  const completesProject =
    String(body.projectStatus || '') === 'Completed' ||
    Number(body.completionPercentage || 0) === 100;

  if (completesProject && String(oldProject.projectStatus || '') !== 'Completed') {
    required.add(PROJECT_PERMISSIONS.MARK_COMPLETED);
  }

  return [...required];
};

const assertProjectUpdatePermissions = (user, oldProject, body, options = {}) => {
  let required = getRequiredProjectUpdatePermissions(oldProject, body);
  if (options.allowAssignedTaskStatusUpdate) {
    required = required.filter((permission) => permission !== PROJECT_PERMISSIONS.UPDATE_COMPLETION);
  }
  const missing = required.filter((permission) => !userHasPermission(user, permission));

  if (missing.length > 0) {
    const error = new Error(`Access denied. Missing project permission(s): ${missing.join(', ')}`);
    error.statusCode = 403;
    error.isOperational = true;
    throw error;
  }
};

// ── Create project ────────────────────────────────────────────────────────────
const createProject = async (req, res, next) => {
  try {
    validateIncomingPlanningStartDates(req.body, {});
    const body = sanitizeProjectPayload(req.body);
    assertTaskStartDateRole(req.user, {}, body);
    assertTaskStatusOwnership(req.user, {}, body);
    await attachUniversalCustomer(body, req.user._id);
    applyActualCompletedDates(body);
    if (Array.isArray(body.planningTasks) && body.completionPercentage === 100) {
      body.projectStatus = 'Completed';
    }
    applyProjectDelayFields(body);
    body.createdBy = req.user._id;
    await assertPlanningDepartmentScope(req.user, {}, body);
    await validatePlanningAssignments(body.planningGrids, {});
    await attachInquiryNumber(body, { generateIfMissing: true });
    const project = await Project.create(body);

    if (body.inquiryReference) {
      await Inquiry.findByIdAndUpdate(body.inquiryReference, {
        convertedToProject: true,
        projectReference: project._id,
        status: 'Order Won',
      });
    }

    if (body.customerRef) {
      await Customer.findByIdAndUpdate(
        body.customerRef,
        { $inc: { totalProjects: 1 } }
      );
    }

    const populated = await Project.findById(project._id)
      .populate('assignedTo', 'name email phone')
        .populate('assignedTeamMembers', 'name email role phone')
      .populate('createdBy', 'name')
      .populate('customerRef', 'customerId customerName companyType contacts contactPerson email mobileNumber city address gstNumber notes')
      .populate('inquiryReference', 'inquiryId')
      .populate('documents.uploadedBy', 'name email')
      .populate('planningTasks.assignedTo', 'name email phone')
        .populate('planningGrids.planningTasks.assignedTo', 'name email phone');

    // Audit log
    await logActivity({
      projectId:   project._id,
      userId:      req.user._id,
      userName:    req.user.name || 'User',
      actionType:  'created',
      description: `Project ${project.projectId} created`,
    });

    // Return the created project immediately. WhatsApp and timesheet sync are
    // non-critical side effects and must never keep the Create Project request
    // loading indefinitely when an external integration is slow or disconnected.
    const responseProject = populated || project;
    res.status(201).json({ success: true, data: toPlainProjectResponse(responseProject) });

    const actingUser = {
      id: req.user._id,
      name: req.user.name,
    };

    setImmediate(async () => {
      try {
        const groupMsg = buildProjectCreatedWhatsAppMessage(project);
        await Promise.allSettled([
          notifyAssignments(
            { assignedTo: null, planningTasks: [] },
            body,
            project._id,
            project.projectId,
            project.projectName,
            actingUser.id,
            actingUser.name
          ),
          notifyAndLog({
            projectDbId: project._id,
            projectId: project.projectId,
            projectName: project.projectName,
            userId: actingUser.id,
            userName: actingUser.name,
            message: groupMsg,
          }),
          (async () => {
            logProjectTimesheetSyncProbe('create', responseProject);
            await runProjectTimesheetSyncSafe({
              action: 'create',
              oldProject: null,
              newProject: responseProject,
              userId: actingUser.id,
            });
          })(),
        ]);
      } catch (sideEffectError) {
        console.error('[projectController] Post-create side effect failed:', sideEffectError?.message || sideEffectError);
      }
    });
  } catch (error) { next(error); }
};



// ── Copy project ──────────────────────────────────────────────────────────────
const copyProject = async (req, res, next) => {
  try {
    const sourceProjectId = normalizeObjectIdRef(req.params.id);
    if (!sourceProjectId) {
      return res.status(400).json({ success: false, message: 'Invalid project id. Please refresh the page and try again.' });
    }

    const sourceProject = await Project.findById(sourceProjectId).lean();
    if (!sourceProject) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const copyPayload = buildCopiedProjectPayload(sourceProject, req.user._id);
    const body = sanitizeProjectPayload(copyPayload);
    await attachUniversalCustomer(body, req.user._id, sourceProject);
    applyActualCompletedDates(body);
    applyProjectDelayFields(body);
    await assertPlanningDepartmentScope(req.user, {}, body);
    await validatePlanningAssignments(body.planningGrids, {});

    const copied = await Project.create(body);

    if (body.customerRef) {
      await Customer.findByIdAndUpdate(
        body.customerRef,
        { $inc: { totalProjects: 1 } }
      );
    }

    const populated = await Project.findById(copied._id)
      .populate('assignedTo', 'name email phone')
      .populate('assignedTeamMembers', 'name email role phone')
      .populate('createdBy', 'name')
      .populate('customerRef', 'customerId customerName companyType contacts contactPerson email mobileNumber city address gstNumber notes')
      .populate('inquiryReference', 'inquiryId')
      .populate('documents.uploadedBy', 'name email')
      .populate('planningTasks.assignedTo', 'name email phone')
      .populate('planningGrids.planningTasks.assignedTo', 'name email phone');

    await logActivity({
      projectId: copied._id,
      userId: req.user._id,
      userName: req.user.name || 'User',
      actionType: 'created',
      fieldChanged: 'Project Copy',
      oldValue: sourceProject.projectId || '',
      newValue: copied.projectId || '',
      description: `Project ${copied.projectId} copied from ${sourceProject.projectId || 'existing project'}`,
    });

    await runProjectTimesheetSyncSafe({
      action: 'copy',
      oldProject: null,
      newProject: populated || copied,
      userId: req.user._id,
    });

    const responseProject = toPlainProjectResponse(populated || copied);

    res.status(201).json({
      success: true,
      data: responseProject,
      message: `Project copied successfully as ${copied.projectId}`,
    });
  } catch (error) { next(error); }
};

// ── Update project ────────────────────────────────────────────────────────────
const updateProject = async (req, res, next) => {
  try {
    const oldProject = await Project.findById(req.params.id).lean();
    if (!oldProject)
      return res.status(404).json({ success: false, message: 'Project not found' });

    validateIncomingPlanningStartDates(req.body, oldProject);
    const body = sanitizeProjectPayload(req.body, { partial: true });
    [
      '_id', 'id', 'projectId', 'createdBy', 'createdAt', 'updatedAt', '__v',
      'documents', 'kickoffMeeting', 'assignedTeamMembers', 'inquiryReference',
      'sourceInquirySnapshot',
    ].forEach((field) => delete body[field]);
    assertTaskStartDateRole(req.user, oldProject, body);
    assertTaskStatusOwnership(req.user, oldProject, body);
    await attachInquiryNumber(body);
    applyActualCompletedDates(body, oldProject);
    if (Array.isArray(body.planningTasks) && body.completionPercentage === 100) {
      body.projectStatus = 'Completed';
    }
    applyProjectDelayFields(body, oldProject);
    assertPlanningReorderRole(req.user, oldProject, body);
    assertProjectUpdatePermissions(req.user, oldProject, body, {
      allowAssignedTaskStatusUpdate: req.assignedTaskStatusUpdate === true,
    });
    await assertPlanningDepartmentScope(req.user, oldProject, body);
    await attachUniversalCustomer(body, req.user._id, oldProject);
    await validatePlanningAssignments(body.planningGrids, oldProject);

    const oldTasks = flattenPlanningTasks(oldProject);
    const newTasks = Array.isArray(body.planningTasks) ? body.planningTasks : oldTasks;

    const relatedUserIds = [];
    oldTasks.forEach(task => relatedUserIds.push(toId(task.assignedTo)));
    newTasks.forEach(task => relatedUserIds.push(toId(task.assignedTo)));
    const userNameMap = await getUserNameMap(relatedUserIds);

    // Detect field changes for audit log + notifications
    const changes = diffProject(oldProject, body);
    const taskActivityLogs = [];

    if (Array.isArray(body.planningTasks)) {
      const oldTaskMap = new Map();
      oldTasks.forEach((task, index) => oldTaskMap.set(getTaskKey(task, index), task));

      const newTaskKeys = new Set();
      newTasks.forEach((task, index) => {
        const key = getTaskKey(task, index);
        newTaskKeys.add(key);
        const oldTask = oldTaskMap.get(key);
        const taskTitle = task.taskName || task.taskTitle || key;
        const taskStatus = normalizeTaskStatus(task);
        const assignedUserId = toId(task.assignedTo);
        const assignedUserName = userNameMap[assignedUserId] || task.assignedTo?.name || '';

        const baseLog = {
          taskId: key,
          taskTitle,
          taskStatus,
          gridId: task.gridId || '',
          gridName: task.gridName || '',
          assignedUserId,
          assignedUserName,
          activityDate: new Date(),
        };

        if (!oldTask) {
          taskActivityLogs.push({
            ...baseLog,
            actionType: 'task_created',
            fieldChanged: 'Task',
            newValue: taskTitle,
            description: buildTaskActivityDescription('task_created', task),
          });
          return;
        }

        const oldStatus = normalizePlanningStatus(oldTask.status || 'Pending');
        const newStatus = normalizePlanningStatus(task.status || 'Pending');
        if (oldStatus !== newStatus) {
          const actionType = newStatus === 'Completed' ? 'task_completed' : 'task_status_changed';
          taskActivityLogs.push({
            ...baseLog,
            actionType,
            fieldChanged: 'Task Status',
            oldValue: oldStatus,
            newValue: newStatus,
            description: buildTaskActivityDescription(actionType, task, oldStatus, newStatus),
          });
        }

        const oldAssigneeId = toId(oldTask.assignedTo);
        const newAssigneeId = toId(task.assignedTo);
        if (oldAssigneeId !== newAssigneeId) {
          const oldAssigneeName = userNameMap[oldAssigneeId] || oldTask.assignedTo?.name || '';
          const newAssigneeName = userNameMap[newAssigneeId] || task.assignedTo?.name || '';
          taskActivityLogs.push({
            ...baseLog,
            actionType: 'task_assigned',
            fieldChanged: 'Assigned To',
            oldValue: oldAssigneeName || 'Unassigned',
            newValue: newAssigneeName || 'Unassigned',
            description: buildTaskActivityDescription('task_assigned', task, oldAssigneeName, newAssigneeName),
          });
        }

        const trackedTaskFields = [
          { key: 'plannedStartDate', label: 'Task Start Date', format: fmtDate },
          { key: 'plannedEndDate', label: 'Task End Date', format: fmtDate },
          { key: 'totalDays', label: 'Task Days' },
          { key: 'department', label: 'Department' },
          { key: 'remark', label: 'Task Remark' },
        ];

        trackedTaskFields.forEach(field => {
          const oldRaw = oldTask[field.key];
          const newRaw = task[field.key];
          const oldValue = field.format ? field.format(oldRaw) : String(oldRaw ?? '');
          const newValue = field.format ? field.format(newRaw) : String(newRaw ?? '');
          if (oldValue !== newValue) {
            taskActivityLogs.push({
              ...baseLog,
              actionType: 'task_updated',
              fieldChanged: field.label,
              oldValue,
              newValue,
              description: `${field.label} updated for ${taskTitle}`,
            });
          }
        });
      });

      oldTasks.forEach((task, index) => {
        const key = getTaskKey(task, index);
        if (!newTaskKeys.has(key)) {
          taskActivityLogs.push({
            actionType: 'task_deleted',
            fieldChanged: 'Task',
            oldValue: task.taskName || key,
            taskId: key,
            taskTitle: task.taskName || key,
            taskStatus: normalizeTaskStatus(task),
            gridId: task.gridId || '',
            gridName: task.gridName || '',
            assignedUserId: toId(task.assignedTo),
            assignedUserName: userNameMap[toId(task.assignedTo)] || task.assignedTo?.name || '',
            activityDate: new Date(),
            description: buildTaskActivityDescription('task_deleted', task),
          });
        }
      });
    }

    const updated = await Project.findByIdAndUpdate(
      req.params.id,
      body,
      { new: true, runValidators: true }
    )
      .populate('assignedTo', 'name email phone')
        .populate('assignedTeamMembers', 'name email role phone')
      .populate('createdBy', 'name')
      .populate('customerRef', 'customerId customerName companyType contacts contactPerson email mobileNumber city address gstNumber notes')
      .populate('inquiryReference', 'inquiryId')
      .populate('documents.uploadedBy', 'name email')
      .populate('planningTasks.assignedTo', 'name email phone')
      .populate('planningGrids.planningTasks.assignedTo', 'name email phone');

    // Write audit logs for each changed project-level field
    for (const change of changes) {
      await logActivity({
        projectId:   updated._id,
        userId:      req.user._id,
        userName:    req.user.name || 'User',
        actionType:  change.actionType,
        fieldChanged: change.fieldChanged,
        oldValue:    change.oldValue,
        newValue:    change.newValue,
      });
    }

    // Write task-level activity logs. These power the activity feed and graph refresh.
    for (const log of taskActivityLogs) {
      await logActivity({
        projectId: updated._id,
        userId: req.user._id,
        userName: req.user.name || 'User',
        ...log,
      });
    }

    // Generic update log if no specific field changed but something was saved
    if (changes.length === 0 && taskActivityLogs.length === 0) {
      await logActivity({
        projectId:  updated._id,
        userId:     req.user._id,
        userName:   req.user.name || 'User',
        actionType: 'updated',
        description: 'Project updated',
      });
    }

    // WhatsApp — assignments
    await notifyAssignments(oldProject, body, updated._id, updated.projectId, updated.projectName, req.user._id, req.user.name);

    // WhatsApp — field-level changes (status, dates, delay, completion)
    const notifyFields = changes.filter(c =>
      ['Status', 'End Date', 'Order Date'].includes(c.fieldChanged) ||
      c.newValue === 'Completed'
    );
    if (notifyFields.length > 0) {
      await notifyFieldChanges(notifyFields, updated._id, updated.projectId, updated.projectName, req.user._id, req.user.name);
    }

    // WhatsApp — delay alert
    if (updated.isDelayed && !oldProject.isDelayed) {
      const delayMsg = buildProjectDelayedWhatsAppMessage(updated);
      await notifyAndLog({ projectDbId: updated._id, projectId: updated.projectId, projectName: updated.projectName,
        userId: req.user._id, userName: req.user.name, message: delayMsg });
      await logActivity({
        projectId: updated._id, userId: req.user._id, userName: req.user.name,
        actionType: 'delay_updated', fieldChanged: 'Delayed Days',
        oldValue: '0', newValue: String(updated.delayedDays),
        description: `Project became delayed — ${updated.delayedDays} day(s) past end date`,
      });
    }

    logProjectTimesheetSyncProbe('update', updated);
    await runProjectTimesheetSyncSafe({
      action: 'update',
      oldProject,
      newProject: updated,
      userId: req.user._id,
    });

    res.json({ success: true, data: toPlainProjectResponse(updated) });
  } catch (error) { next(error); }
};

// ── Convert inquiry to project ────────────────────────────────────────────────
// Workflow update: Order Won no longer creates the project immediately.
// This endpoint is kept for backward compatibility, but it now only schedules
// the Kick-off Meeting. Project creation happens only when the Kick-off popup
// is opened after meeting time and the user clicks Kickoff Meeting Done.
const convertInquiryToProject = async (req, res, next) => {
  try {
    const payload = req.body?.kickoffMeeting || req.body || {};
    const workflow = await scheduleKickoffForInquiry({
      inquiryId: req.params.inquiryId,
      payload,
      user: req.user,
    });

    return res.status(202).json({
      success: true,
      data: workflow,
      message: 'Kick-off Meeting scheduled. Open the Kick-off popup after the meeting and click Kickoff Meeting Done to create the project.',
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

function planningMutationPayload(project, planningGrids) {
  return {
    projectQuantity: project.quantity || 1,
    selectedDepartments: project.selectedDepartments || [],
    panelSelections: project.panelSelections || [],
    planningGrids,
  };
}

const createSeparatePlanningGrid = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id).lean();
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    const department = normalizeSupportedDepartment(req.body.department);
    const panelType = normalizeSupportedPanelType(req.body.panelType);
    const selection = (project.panelSelections || []).find((item) => item.department === department && item.panelType === panelType);
    if (!selection || selection.planningMode !== 'separate' || selection.quantity <= 1) {
      return res.status(400).json({ success: false, message: 'Separate planning is not configured for this department and panel type.' });
    }
    const existing = (project.planningGrids || []).filter((grid) => grid.department === department && grid.panelType === panelType);
    if (existing.length >= selection.quantity) return res.status(400).json({ success: false, message: `Maximum ${selection.quantity} separate grids allowed.` });
    const used = new Set(existing.map((grid) => Number(grid.unitNumber)));
    let unitNumber;
    if (req.body.unitNumber !== undefined && req.body.unitNumber !== null && req.body.unitNumber !== '') {
      unitNumber = positiveInteger(req.body.unitNumber, 'Panel unit number');
      if (unitNumber > selection.quantity) return res.status(400).json({ success: false, message: `Unit number cannot exceed panel quantity ${selection.quantity}.` });
      if (used.has(unitNumber)) return res.status(409).json({ success: false, message: `Panel unit ${unitNumber} already has a planning grid.` });
    } else {
      unitNumber = 1;
      while (used.has(unitNumber) && unitNumber <= selection.quantity) unitNumber += 1;
      if (unitNumber > selection.quantity) return res.status(400).json({ success: false, message: 'No unused panel unit number is available.' });
    }
    const gridId = `${department}-${panelType}-UNIT-${unitNumber}`.replace(/\s+/g, '-').toUpperCase();
    req.body = planningMutationPayload(project, [
      ...(project.planningGrids || []),
      { gridId, department, panelType, panelQuantity: selection.quantity, planningMode: 'separate', unitNumber, isCommon: false, planningTasks: initialTasksForDepartment(department) },
    ]);
    return updateProject(req, res, next);
  } catch (error) { next(error); }
};

const addPlanningTask = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id).lean();
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    const grids = (project.planningGrids || []).map((grid) => String(grid.gridId) === String(req.params.gridId)
      ? { ...grid, planningTasks: [...(grid.planningTasks || []), { ...(req.body.task || req.body), taskId: `${grid.gridId}-${Date.now()}` }] }
      : grid);
    if (!grids.some((grid) => String(grid.gridId) === String(req.params.gridId))) return res.status(404).json({ success: false, message: 'Planning grid not found' });
    req.body = planningMutationPayload(project, grids);
    return updateProject(req, res, next);
  } catch (error) { next(error); }
};

const updatePlanningTaskStatus = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id).lean();
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const rawRequestedStatus = String(req.body?.status || '').trim();
    if (!PROJECT_TASK_STATUSES.includes(rawRequestedStatus)) {
      throw makeHttpError(`Invalid task status. Allowed values: ${TASK_STATUSES.join(', ')}.`, 400);
    }
    const requestedStatus = normalizePlanningTaskStatus(rawRequestedStatus);
    const currentUserId = toId(req.user?._id || req.user?.id);
    let found = false;

    const grids = (project.planningGrids || []).map((grid) => ({
      ...grid,
      planningTasks: (grid.planningTasks || []).map((task) => {
        const isTarget = String(grid.gridId) === String(req.params.gridId)
          && String(task.taskId) === String(req.params.taskId);
        if (!isTarget) return task;

        found = true;
        const assignedUserId = toId(task.assignedTo);
        if (!assignedUserId || assignedUserId !== currentUserId) {
          throw makeHttpError('Only the user assigned to this task can change its status.', 403);
        }

        return {
          ...task,
          status: requestedStatus,
        };
      }),
    }));

    if (!found) return res.status(404).json({ success: false, message: 'Planning task not found' });

    req.body = planningMutationPayload(project, grids);
    req.assignedTaskStatusUpdate = true;
    return updateProject(req, res, next);
  } catch (error) { next(error); }
};

const updatePlanningTask = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id).lean();
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    let found = false;
    const grids = (project.planningGrids || []).map((grid) => ({ ...grid, planningTasks: (grid.planningTasks || []).map((task) => {
      if (String(grid.gridId) === String(req.params.gridId) && String(task.taskId) === String(req.params.taskId)) { found = true; return { ...task, ...(req.body.task || req.body), taskId: task.taskId }; }
      return task;
    }) }));
    if (!found) return res.status(404).json({ success: false, message: 'Planning task not found' });
    req.body = planningMutationPayload(project, grids);
    return updateProject(req, res, next);
  } catch (error) { next(error); }
};

const removePlanningTask = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id).lean();
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    let found = false;
    const grids = (project.planningGrids || []).map((grid) => ({ ...grid, planningTasks: (grid.planningTasks || []).filter((task) => {
      const remove = String(grid.gridId) === String(req.params.gridId) && String(task.taskId) === String(req.params.taskId);
      if (remove) found = true;
      return !remove;
    }) }));
    if (!found) return res.status(404).json({ success: false, message: 'Planning task not found' });
    req.body = planningMutationPayload(project, grids);
    return updateProject(req, res, next);
  } catch (error) { next(error); }
};

const reorderPlanningTasks = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id).lean();
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    const orderedIds = Array.isArray(req.body.taskIds) ? req.body.taskIds.map(String) : [];
    const grids = (project.planningGrids || []).map((grid) => {
      if (String(grid.gridId) !== String(req.params.gridId)) return grid;
      const taskMap = new Map((grid.planningTasks || []).map((task) => [String(task.taskId), task]));
      if (orderedIds.length !== taskMap.size || orderedIds.some((id) => !taskMap.has(id))) throw makeHttpError('Reorder list must contain every task exactly once.', 400);
      return { ...grid, planningTasks: orderedIds.map((id) => taskMap.get(id)) };
    });
    req.body = planningMutationPayload(project, grids);
    return updateProject(req, res, next);
  } catch (error) { next(error); }
};

// ── Project document attachments ───────────────────────────────────────────
const uploadProjectDocuments = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      (req.files || []).forEach((file) => fs.promises.unlink(file.path).catch(() => {}));
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      return res.status(400).json({ success: false, message: 'Please upload at least one document' });
    }

    const uploadedDocs = files.map((file) => mapUploadedProjectDocument(file, req.user?._id));
    project.documents = [...(project.documents || []), ...uploadedDocs];
    await project.save();

    await logActivity({
      projectId: project._id,
      userId: req.user?._id,
      userName: req.user?.name,
      actionType: 'document_uploaded',
      fieldChanged: 'Documents',
      newValue: uploadedDocs.map((doc) => doc.name).join(', '),
      description: `Uploaded ${uploadedDocs.length} document(s)`,
    });

    const populated = await populateProjectForResponse(Project.findById(project._id));
    return res.status(201).json({ success: true, data: toPlainProjectResponse(populated) });
  } catch (error) {
    (req.files || []).forEach((file) => fs.promises.unlink(file.path).catch(() => {}));
    next(error);
  }
};


// ── Bulk recalculate delay for all projects (cron / daily sync) ───────────────
const recalcAllDelays = async (req, res, next) => {
  try {
    const projects = await Project.find({ projectStatus: { $ne: 'Completed' } })
      .select('_id projectEndDate delayedEndDate projectStatus isDelayed delayedDays projectId projectName');

    let updated = 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    for (const p of projects) {
      const { isDelayed, delayedDays } = await recalcDelay(p);
      if (p.isDelayed !== isDelayed || p.delayedDays !== delayedDays) {
        await Project.findByIdAndUpdate(p._id, { isDelayed, delayedDays });
        // Log if newly delayed
        if (isDelayed && !p.isDelayed) {
          await logActivity({
            projectId: p._id, userId: null, userName: 'System',
            actionType: 'delay_updated', fieldChanged: 'Delayed Days',
            oldValue: '0', newValue: String(delayedDays),
            description: `Auto delay recalc: ${p.projectId} delayed by ${delayedDays} day(s)`,
          });
        }
        updated++;
      }
    }
    res.json({ success: true, message: `Delay recalculated for ${updated} project(s)` });
  } catch (error) { next(error); }
};

module.exports = {
  getProjects,
  getProject,
  getProjectActivityLog,
  getTaskCompletionHistory,
  getProjectPlanningTemplates,
  getPlanningUsers,
  validatePlanningImport,
  recalculatePlanningPreview,
  createProject,
  copyProject,
  updateProject,
  createSeparatePlanningGrid,
  addPlanningTask,
  updatePlanningTaskStatus,
  updatePlanningTask,
  removePlanningTask,
  reorderPlanningTasks,
  projectDocumentUpload,
  uploadProjectDocuments,
  convertInquiryToProject,
  recalcAllDelays,
};
