
'use strict';

const fs = require('fs');
const path = require('path');
const qrcodeTerminal = require('qrcode-terminal');

let qrcodeImage = null;
try {
  qrcodeImage = require('qrcode');
} catch {
  qrcodeImage = null;
}

// Keep the API server alive even when whatsapp-web.js or Puppeteer was not
// installed correctly. The Integration Settings page will show the real error
// instead of the whole backend crashing during startup.
let Client = null;
let LocalAuth = null;
let MessageMedia = null;
let whatsappDependencyError = '';
try {
  ({ Client, LocalAuth, MessageMedia } = require('whatsapp-web.js'));
} catch (error) {
  whatsappDependencyError = error?.message || 'whatsapp-web.js could not be loaded';
}

const Project = require('../models/Project');
const { resolveProjectLockState } = require('./projectLockService');
const ProjectActivityLog = require('../models/ProjectActivityLog');
const User = require('../models/User');
const {
  getActiveWhatsAppConfig,
  refreshWhatsAppRuntimeConfig,
} = require('./whatsappSettingsService');

let clientReady = false;
let client = null;
let incomingHandlerAttached = false;
let manualRestartInProgress = false;
let whatsappStatus = 'not_started';
let latestQr = '';
let latestQrDataUrl = '';
let latestQrAscii = '';
let lastError = '';
let lastUpdatedAt = null;
let lastReadyAt = null;
let lastAuthenticatedAt = null;
let lastDisconnectedAt = null;
const processedIncomingMessages = new Set();

const ALLOWED_TASK_STATUSES = ['Pending', 'In Progress', 'Delay', 'Completed', 'On Hold'];

// Keep WhatsApp auth outside the replaceable code folder by default.
// This prevents the linked-device session from being lost when backend files
// are replaced from a new zip. Existing backend/.wwebjs_auth sessions are
// migrated automatically into this persistent location on first boot.

function getWhatsAppClientId() {
  return getActiveWhatsAppConfig().clientId || 'nexus-session';
}

function getDefaultWhatsAppDataRoot() {
  if (process.env.NEXUS_DATA_DIR) return path.resolve(process.env.NEXUS_DATA_DIR, 'whatsapp');

  if (process.platform === 'win32') {
    return path.resolve(process.env.LOCALAPPDATA || process.cwd(), 'NexusDashboard', 'whatsapp');
  }

  return path.resolve(process.env.HOME || process.cwd(), '.nexus-dashboard', 'whatsapp');
}

const DEFAULT_WHATSAPP_DATA_ROOT = getDefaultWhatsAppDataRoot();
const LEGACY_WHATSAPP_AUTH_DATA_PATH = path.resolve(__dirname, '..', '.wwebjs_auth');
const LEGACY_WHATSAPP_CACHE_DATA_PATH = path.resolve(__dirname, '..', '.wwebjs_cache');
const WHATSAPP_AUTH_DATA_PATH = path.resolve(
  process.env.WHATSAPP_AUTH_DATA_PATH || path.join(DEFAULT_WHATSAPP_DATA_ROOT, 'auth')
);
const WHATSAPP_CACHE_DATA_PATH = path.resolve(
  process.env.WHATSAPP_CACHE_DATA_PATH || path.join(DEFAULT_WHATSAPP_DATA_ROOT, 'cache')
);

let reconnectTimer = null;
let reconnectAttempt = 0;
let readyWatchdogTimer = null;
const WHATSAPP_READY_TIMEOUT_MS = Math.max(45_000, Number(process.env.WHATSAPP_READY_TIMEOUT_MS || 120_000));

// ─────────────────────────────────────────────────────────────────────────────
// General helpers
// ─────────────────────────────────────────────────────────────────────────────

function firstExistingPath(paths = []) {
  return paths.find((candidate) => candidate && fs.existsSync(candidate)) || '';
}

function copyDirectoryIfMissing(source, target) {
  if (!source || !target || source === target) return;
  if (!fs.existsSync(source) || fs.existsSync(target)) return;

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true, force: false, errorOnExist: false });
}

function getSessionPathIn(authDataPath, clientId = getWhatsAppClientId()) {
  return path.join(authDataPath, `session-${clientId}`);
}

function migrateLegacyWhatsAppSessionIfNeeded() {
  const targetSessionPath = getSessionPathIn(WHATSAPP_AUTH_DATA_PATH);
  if (fs.existsSync(targetSessionPath)) return;

  copyDirectoryIfMissing(
    getSessionPathIn(LEGACY_WHATSAPP_AUTH_DATA_PATH),
    targetSessionPath
  );

  // Older LocalAuth usage without explicit clientId used "session".
  copyDirectoryIfMissing(
    path.join(LEGACY_WHATSAPP_AUTH_DATA_PATH, 'session'),
    targetSessionPath
  );
}

function ensureWhatsAppStorageDirs() {
  fs.mkdirSync(WHATSAPP_AUTH_DATA_PATH, { recursive: true });
  fs.mkdirSync(WHATSAPP_CACHE_DATA_PATH, { recursive: true });
  migrateLegacyWhatsAppSessionIfNeeded();
}

function resolveChromeExecutablePath() {
  const envPath = String(process.env.CHROME_EXECUTABLE_PATH || '').trim();
  if (envPath) return envPath;

  if (process.platform === 'win32') {
    const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env.LOCALAPPDATA || '';

    return firstExistingPath([
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      localAppData && path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ]);
  }

  if (process.platform === 'darwin') {
    return firstExistingPath([
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ]);
  }

  return firstExistingPath([
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ]);
}

function onlyDigits(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function maskPhoneNumber(value = '') {
  const digits = onlyDigits(value);
  if (!digits) return '';
  if (digits.length <= 4) return '*'.repeat(digits.length);
  return `${'*'.repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}`;
}

function maskGroupId(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const digits = onlyDigits(raw);
  if (!digits) return 'Configured';
  return `${digits.slice(0, 4)}${'*'.repeat(Math.max(4, digits.length - 8))}${digits.slice(-4)}@g.us`;
}

function isWhatsAppEnabled() {
  return Boolean(getActiveWhatsAppConfig().isEnabled);
}

function resolveBrowserExecutablePath() {
  const configuredOrSystemPath = resolveChromeExecutablePath();
  if (configuredOrSystemPath && fs.existsSync(configuredOrSystemPath)) {
    return configuredOrSystemPath;
  }

  try {
    const puppeteer = require('puppeteer');
    const bundledPath = puppeteer.executablePath();
    if (bundledPath && fs.existsSync(bundledPath)) return bundledPath;
  } catch {
    // The Integration Settings diagnostics will report that Chrome is missing.
  }

  return configuredOrSystemPath || '';
}

function getWhatsAppConfigurationStatus() {
  const activeConfig = getActiveWhatsAppConfig();
  const notifyDigits = onlyDigits(activeConfig.notifyNumber || '');
  const groupId = getConfiguredWhatsAppGroupId();
  const browserPath = resolveBrowserExecutablePath();
  const configuredChromePath = String(process.env.CHROME_EXECUTABLE_PATH || '').trim();

  return {
    source: activeConfig.source || 'env',
    isConfigured: Boolean(activeConfig.isConfigured),
    enabled: Boolean(activeConfig.isEnabled),
    dependencyAvailable: Boolean(Client && LocalAuth),
    dependencyError: whatsappDependencyError,
    browserAvailable: Boolean(browserPath && fs.existsSync(browserPath)),
    browserExecutablePath: browserPath,
    configuredChromePath,
    notifyNumberConfigured: Boolean(notifyDigits),
    notifyNumberValid: notifyDigits.length >= 10 && notifyDigits.length <= 15,
    notifyNumberMasked: maskPhoneNumber(notifyDigits),
    groupConfigured: Boolean(groupId),
    groupIdValid: /^\d+@g\.us$/i.test(groupId),
    groupIdMasked: maskGroupId(groupId),
    groupName: activeConfig.groupName || '',
    allowUnknownSenders: Boolean(activeConfig.allowUnknownSenders),
    clientId: activeConfig.clientId || 'nexus-session',
    authDataPath: WHATSAPP_AUTH_DATA_PATH,
    cacheDataPath: WHATSAPP_CACHE_DATA_PATH,
  };
}

function normalizeComparable(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function startOfDay(value = new Date()) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(fromDate, toDate) {
  const from = startOfDay(fromDate);
  const to = startOfDay(toDate);
  if (!from || !to) return 0;
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000));
}

function addDays(dateValue, days) {
  const d = startOfDay(dateValue);
  if (!d) return undefined;
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function formatDate(value) {
  const d = startOfDay(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function calculateTaskDelay(task = {}) {
  const plannedEndDate = task.plannedEndDate || task.endDate;
  if (!plannedEndDate) return Number(task.delayDays || 0) || 0;

  if (task.status === 'Completed') {
    return daysBetween(plannedEndDate, task.actualCompletedDate || new Date());
  }

  return daysBetween(plannedEndDate, new Date());
}

function calculateCompletionPercentage(tasks = []) {
  if (!Array.isArray(tasks) || tasks.length === 0) return 0;
  const completed = tasks.filter((task) => task.status === 'Completed').length;
  return Math.round((completed / tasks.length) * 100);
}

function flattenPlanningGrids(planningGrids = []) {
  return (planningGrids || []).flatMap((grid) => grid.planningTasks || []);
}

function normalizeProjectCode(input = '') {
  const raw = String(input || '').trim().toUpperCase().replace(/\s+/g, '');
  const match = raw.match(/^NAPL-?0*(\d+)$/i);
  if (!match) return raw;
  const number = match[1];
  return `NAPL-${String(number).padStart(4, '0')}`;
}

function buildProjectCodeOptions(input = '') {
  const normalized = normalizeProjectCode(input);
  const options = new Set([String(input || '').trim().toUpperCase(), normalized]);

  const match = normalized.match(/^NAPL-(\d+)$/i);
  if (match) {
    options.add(`NAPL-${Number(match[1])}`);
  }

  return [...options].filter(Boolean);
}

function normalizeStatus(input = '') {
  const value = String(input || '').trim().toLowerCase().replace(/[-_]+/g, ' ');

  const aliases = {
    'not started': 'Pending',
    pending: 'Pending',
    start: 'In Progress',
    started: 'In Progress',
    progress: 'In Progress',
    'in progress': 'In Progress',
    running: 'In Progress',
    wip: 'In Progress',
    complete: 'Completed',
    completed: 'Completed',
    done: 'Completed',
    closed: 'Completed',
    delay: 'Delay',
    delayed: 'Delay',
    overdue: 'Delay',
    hold: 'On Hold',
    'on hold': 'On Hold',
    paused: 'On Hold',
  };

  return aliases[value] || null;
}

function getCandidateSenderDigits(message) {
  const candidates = [
    message?.author,
    message?.from,
    message?.to,
    message?._data?.author,
    message?._data?.participant,
    message?._data?.id?.participant,
    message?._data?.from?.user,
    message?._data?.sender?.id,
    message?._data?.notifyName,
  ];

  if (message?.fromMe && client?.info?.wid?._serialized) {
    candidates.unshift(client.info.wid._serialized);
  }

  if (process.env.WHATSAPP_BOT_NUMBER) {
    candidates.push(process.env.WHATSAPP_BOT_NUMBER);
  }

  const digits = [];
  candidates.forEach((candidate) => {
    const raw = String(candidate || '').trim();
    if (!raw) return;

    // Ignore group ids. For group messages, the real sender is usually in
    // message.author / participant, not message.from.
    if (raw.includes('@g.us')) return;

    const phonePart = raw.split('@')[0];
    const value = onlyDigits(phonePart);
    if (value && !digits.includes(value)) digits.push(value);
  });

  return digits;
}

function phoneMatches(senderDigits, savedPhone) {
  const savedDigits = onlyDigits(savedPhone);
  if (!senderDigits || !savedDigits) return false;
  if (senderDigits === savedDigits) return true;

  // Helpful for India/user records where one side may have country code and
  // the other side may have only the 10-digit mobile number.
  if (senderDigits.length >= 10 && savedDigits.length >= 10) {
    return senderDigits.slice(-10) === savedDigits.slice(-10);
  }

  return false;
}

async function resolveSenderUser(message) {
  const senderDigitsList = getCandidateSenderDigits(message);
  if (senderDigitsList.length === 0) return null;

  const users = await User.find({ phone: { $exists: true, $ne: '' } })
    .select('_id name phone role email isActive')
    .lean();

  const activeUsers = users.filter((user) => user.isActive !== false);
  const matchedUser = activeUsers.find((user) =>
    senderDigitsList.some((senderDigits) => phoneMatches(senderDigits, user.phone))
  );

  if (!matchedUser) {
    console.warn('[whatsappService] Sender not matched in User Management. Detected:', senderDigitsList.join(', '));
    console.warn('[whatsappService] Saved active user phones:', activeUsers.map((u) => onlyDigits(u.phone)).filter(Boolean).join(', ') || '(none)');
  }

  return matchedUser || null;
}

async function safeReply(message, text) {
  try {
    await message.reply(text);
  } catch (err) {
    console.error('[whatsappService] Failed to reply to incoming message:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Incoming WhatsApp command parser
// ─────────────────────────────────────────────────────────────────────────────

function parsePipeCommand(text = '') {
  const parts = String(text)
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 4) return null;

  let projectPart = parts[0];
  let taskPart = parts[1];
  let statusPart = parts[2];
  let remarkPart = parts.slice(3).join(' | ');

  // Format: NEXUS | NAPL-0209 | Task | Status | Remark
  if (/^nexus$/i.test(projectPart) || /^project$/i.test(projectPart)) {
    projectPart = parts[1];
    taskPart = parts[2];
    statusPart = parts[3];
    remarkPart = parts.slice(4).join(' | ');
  }

  // Format: PROJECT NAPL-0209 | Task | Status | Remark
  const projectMatch = projectPart.match(/^project\s+(.+)$/i);
  if (projectMatch) projectPart = projectMatch[1].trim();

  return {
    projectCode: projectPart,
    taskName: taskPart,
    status: statusPart,
    remark: remarkPart,
  };
}

function parseLabelCommand(text = '') {
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 3) return null;

  const output = {};

  lines.forEach((line) => {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) return;

    const key = match[1].trim().toLowerCase();
    const value = match[2].trim();

    if (['project', 'project code', 'project id', 'napl'].includes(key)) {
      output.projectCode = value;
    } else if (['task', 'task name', 'activity'].includes(key)) {
      output.taskName = value;
    } else if (['status', 'task status'].includes(key)) {
      output.status = value;
    } else if (['remark', 'remarks', 'note', 'notes', 'comment'].includes(key)) {
      output.remark = value;
    }
  });

  if (!output.projectCode || !output.taskName || !output.status) return null;
  return output;
}

function parseIncomingProjectUpdateCommand(text = '') {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;

  const looksLikeCommand =
    /^nexus\s*\|/i.test(trimmed) ||
    /^project\s+/i.test(trimmed) ||
    /^project\s*:/i.test(trimmed) ||
    /^napl[-\s]?\d+/i.test(trimmed);

  if (!looksLikeCommand) return null;

  return parseLabelCommand(trimmed) || parsePipeCommand(trimmed);
}

function validateCommand(command) {
  if (!command) return 'Message format not recognized.';
  if (!command.projectCode) return 'Project code is required.';
  if (!command.taskName) return 'Task name is required.';

  const normalizedStatus = normalizeStatus(command.status);
  if (!normalizedStatus) {
    return `Invalid status. Use only: ${ALLOWED_TASK_STATUSES.join(', ')}`;
  }

  command.status = normalizedStatus;
  command.projectCode = normalizeProjectCode(command.projectCode);
  command.taskName = String(command.taskName || '').trim();
  command.remark = String(command.remark || '').trim();

  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Planning Grid update logic
// ─────────────────────────────────────────────────────────────────────────────

async function findProjectByCode(projectCode) {
  const options = buildProjectCodeOptions(projectCode);
  const or = options.map((code) => ({
    projectId: { $regex: `^${escapeRegex(code)}$`, $options: 'i' },
  }));

  return Project.findOne({ $or: or });
}

function findTaskInProject(project, taskName) {
  const wanted = normalizeComparable(taskName);
  if (!wanted) return null;

  if (Array.isArray(project.planningGrids) && project.planningGrids.length > 0) {
    for (let gridIndex = 0; gridIndex < project.planningGrids.length; gridIndex += 1) {
      const grid = project.planningGrids[gridIndex];
      const tasks = grid.planningTasks || [];

      for (let taskIndex = 0; taskIndex < tasks.length; taskIndex += 1) {
        const task = tasks[taskIndex];
        const taskNameComparable = normalizeComparable(task.taskName);
        const taskIdComparable = normalizeComparable(task.taskId);

        if (taskNameComparable === wanted || taskIdComparable === wanted) {
          return { grid, task, gridIndex, taskIndex, source: 'grid' };
        }
      }
    }
  }

  const legacyTasks = project.planningTasks || [];
  for (let taskIndex = 0; taskIndex < legacyTasks.length; taskIndex += 1) {
    const task = legacyTasks[taskIndex];
    const taskNameComparable = normalizeComparable(task.taskName);
    const taskIdComparable = normalizeComparable(task.taskId);

    if (taskNameComparable === wanted || taskIdComparable === wanted) {
      return { grid: null, task, gridIndex: -1, taskIndex, source: 'legacy' };
    }
  }

  // Second pass: contains match. This helps with small typing differences.
  if (Array.isArray(project.planningGrids) && project.planningGrids.length > 0) {
    for (let gridIndex = 0; gridIndex < project.planningGrids.length; gridIndex += 1) {
      const grid = project.planningGrids[gridIndex];
      const tasks = grid.planningTasks || [];

      for (let taskIndex = 0; taskIndex < tasks.length; taskIndex += 1) {
        const task = tasks[taskIndex];
        const candidate = normalizeComparable(task.taskName);
        if (candidate && (candidate.includes(wanted) || wanted.includes(candidate))) {
          return { grid, task, gridIndex, taskIndex, source: 'grid' };
        }
      }
    }
  }

  for (let taskIndex = 0; taskIndex < legacyTasks.length; taskIndex += 1) {
    const task = legacyTasks[taskIndex];
    const candidate = normalizeComparable(task.taskName);
    if (candidate && (candidate.includes(wanted) || wanted.includes(candidate))) {
      return { grid: null, task, gridIndex: -1, taskIndex, source: 'legacy' };
    }
  }

  return null;
}

function refreshProjectPlanningCalculations(project) {
  if (Array.isArray(project.planningGrids) && project.planningGrids.length > 0) {
    project.planningGrids.forEach((grid) => {
      const tasks = grid.planningTasks || [];
      tasks.forEach((task) => {
        task.delayDays = calculateTaskDelay(task);
      });

      grid.completionPercentage = calculateCompletionPercentage(tasks);
      grid.delayedDays = Math.max(0, ...tasks.map((task) => Number(task.delayDays || 0)));
      grid.delayedEndDate = grid.projectEndDate && grid.delayedDays > 0
        ? addDays(grid.projectEndDate, grid.delayedDays)
        : undefined;
    });

    project.planningTasks = flattenPlanningGrids(project.planningGrids);
    project.completionPercentage = Math.round(
      project.planningGrids.reduce((sum, grid) => sum + Number(grid.completionPercentage || 0), 0) /
      project.planningGrids.length
    );
  } else {
    (project.planningTasks || []).forEach((task) => {
      task.delayDays = calculateTaskDelay(task);
    });
    project.completionPercentage = calculateCompletionPercentage(project.planningTasks || []);
  }

  const allTasks = Array.isArray(project.planningTasks) ? project.planningTasks : [];
  const maxDelay = Math.max(0, ...allTasks.map((task) => Number(task.delayDays || 0)));
  project.delayedDays = maxDelay;

  if (project.projectEndDate && maxDelay > 0) {
    project.delayedEndDate = addDays(project.projectEndDate, maxDelay);
  }

  if (allTasks.length > 0 && allTasks.every((task) => task.status === 'Completed')) {
    project.projectStatus = 'Completed';
    project.completedAt = project.completedAt || new Date();
  }
}

async function writeProjectActivityLog({ project, user, task, oldStatus, newStatus, oldRemark, newRemark }) {
  const userId = user?._id || null;
  const userName = user?.name || 'WhatsApp User';

  try {
    if (oldStatus !== newStatus) {
      await ProjectActivityLog.create({
        projectId: project._id,
        userId,
        userName,
        actionType: newStatus === 'Completed' ? 'task_completed' : 'task_status_changed',
        fieldChanged: 'Task Status',
        oldValue: oldStatus || 'Pending',
        newValue: newStatus,
        description: `Updated from WhatsApp: ${task.taskName || task.taskId}`,
        taskId: task.taskId || '',
        taskTitle: task.taskName || '',
        taskStatus: newStatus,
        gridId: task.gridId || '',
        gridName: task.gridName || '',
        assignedUserId: task.assignedTo || null,
        activityDate: new Date(),
      });
    }

    if (newRemark && oldRemark !== newRemark) {
      await ProjectActivityLog.create({
        projectId: project._id,
        userId,
        userName,
        actionType: 'task_updated',
        fieldChanged: 'Task Remark',
        oldValue: oldRemark || '',
        newValue: newRemark,
        description: `Remark updated from WhatsApp: ${task.taskName || task.taskId}`,
        taskId: task.taskId || '',
        taskTitle: task.taskName || '',
        taskStatus: newStatus,
        gridId: task.gridId || '',
        gridName: task.gridName || '',
        assignedUserId: task.assignedTo || null,
        activityDate: new Date(),
      });
    }
  } catch (err) {
    console.error('[whatsappService] Failed to write project activity log:', err.message);
  }
}

async function updateProjectPlanningTaskFromWhatsApp(command, user) {
  const project = await findProjectByCode(command.projectCode);
  if (!project) {
    return {
      ok: false,
      reply: `❌ Project not found: ${command.projectCode}`,
    };
  }

  const lockState = await resolveProjectLockState(project._id);
  if (lockState.locked) {
    return {
      ok: false,
      reply: `🔒 ${lockState.reason}`,
    };
  }

  const match = findTaskInProject(project, command.taskName);
  if (!match) {
    const taskNames = (project.planningTasks || [])
      .map((task) => task.taskName)
      .filter(Boolean)
      .slice(0, 12)
      .join(', ');

    return {
      ok: false,
      reply:
        `❌ Task not found in ${project.projectId}: ${command.taskName}` +
        (taskNames ? `\nAvailable examples: ${taskNames}` : ''),
    };
  }

  const { task } = match;
  const oldStatus = task.status === 'Not Started' ? 'Pending' : (task.status || 'Pending');
  const oldRemark = task.remark || '';

  task.status = command.status;

  if (command.status === 'Completed') {
    task.actualCompletedDate = task.actualCompletedDate || new Date();
  }

  if (command.remark) {
    task.remark = command.remark;
  }

  task.delayDays = calculateTaskDelay(task);

  refreshProjectPlanningCalculations(project);

  project.markModified('planningGrids');
  project.markModified('planningTasks');

  await project.save();

  await writeProjectActivityLog({
    project,
    user,
    task,
    oldStatus,
    newStatus: command.status,
    oldRemark,
    newRemark: task.remark || '',
  });

  return {
    ok: true,
    reply:
      `✅ Nexus Dashboard updated successfully.\n` +
      `Project: ${project.projectId}\n` +
      `Task: ${task.taskName || task.taskId}\n` +
      `Status: ${command.status}\n` +
      `Actual Date: ${command.status === 'Completed' ? formatDate(task.actualCompletedDate) : '—'}\n` +
      `Remark: ${task.remark || '—'}`,
  };
}

async function handleIncomingWhatsAppMessage(message) {
  try {
    const messageId = message?.id?._serialized || message?.id?.id || '';
    if (messageId) {
      if (processedIncomingMessages.has(messageId)) return;
      processedIncomingMessages.add(messageId);
      if (processedIncomingMessages.size > 500) {
        const first = processedIncomingMessages.values().next().value;
        processedIncomingMessages.delete(first);
      }
    }
    const text = String(message.body || '').trim();
    const command = parseIncomingProjectUpdateCommand(text);

    // Ignore normal WhatsApp conversations completely.
    if (!command) return;

    const validationError = validateCommand(command);
    if (validationError) {
      await safeReply(
        message,
        `❌ ${validationError}\n\nUse format:\nNEXUS | NAPL-0209 | GA Approval | Completed | Sent to client`
      );
      return;
    }

    const senderUser = await resolveSenderUser(message);
    if (!senderUser && !getActiveWhatsAppConfig().allowUnknownSenders) {
      const detected = getCandidateSenderDigits(message).join(', ') || 'not detected';
      await safeReply(
        message,
        `❌ Your WhatsApp number is not registered in Nexus User Management.\n` +
        `Detected sender number: ${detected}\n` +
        `Please add this number in User Management. Accepted formats: +918780223547, 918780223547, or 8780223547.\n\n` +
        `An admin can allow unknown senders from Master → Integration Settings for testing.`
      );
      return;
    }

    const result = await updateProjectPlanningTaskFromWhatsApp(command, senderUser);
    await safeReply(message, result.reply);
  } catch (err) {
    console.error('[whatsappService] Incoming command failed:', err);
    await safeReply(
      message,
      `❌ Nexus update failed. ${err.message || 'Please check backend logs.'}`
    );
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp client lifecycle
// ─────────────────────────────────────────────────────────────────────────────

function setWhatsAppStatus(status, error = '') {
  whatsappStatus = status;
  lastError = error || '';
  lastUpdatedAt = new Date();
}

async function reloadWhatsAppSettings() {
  return refreshWhatsAppRuntimeConfig();
}

function getWhatsAppStatus() {
  const account = client?.info
    ? {
      wid: client.info.wid?._serialized || '',
      number: client.info.wid?.user || '',
      pushname: client.info.pushname || '',
      platform: client.info.platform || '',
    }
    : null;

  return {
    status: clientReady ? 'ready' : whatsappStatus,
    isReady: Boolean(clientReady),
    hasClient: Boolean(client),
    qrAvailable: Boolean(latestQr || latestQrDataUrl || latestQrAscii),
    qr: latestQr,
    qrDataUrl: latestQrDataUrl,
    qrAscii: latestQrAscii,
    lastError,
    lastUpdatedAt,
    lastReadyAt,
    lastAuthenticatedAt,
    lastDisconnectedAt,
    account,
    configuration: getWhatsAppConfigurationStatus(),
  };
}

function getLocalAuthSessionPath() {
  return getSessionPathIn(WHATSAPP_AUTH_DATA_PATH);
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function clearReadyWatchdogTimer() {
  if (readyWatchdogTimer) {
    clearTimeout(readyWatchdogTimer);
    readyWatchdogTimer = null;
  }
}

function scheduleReadyWatchdog(reason = '', watchedClient = client) {
  clearReadyWatchdogTimer();

  readyWatchdogTimer = setTimeout(async () => {
    readyWatchdogTimer = null;

    if (manualRestartInProgress || clientReady || watchedClient !== client) return;

    // If a QR is visible, the client is correctly waiting for user scan.
    // Do not auto-restart, otherwise the QR will keep changing.
    if (latestQr || latestQrDataUrl || latestQrAscii) {
      console.warn('[whatsappService] WhatsApp is waiting for QR scan; ready watchdog skipped.');
      return;
    }

    const timeoutSeconds = Math.round(WHATSAPP_READY_TIMEOUT_MS / 1000);
    const statusBeforeRestart = whatsappStatus || 'unknown';
    console.warn(
      `[whatsappService] WhatsApp stayed at "${statusBeforeRestart}" for ${timeoutSeconds}s after ${reason || 'startup'}. Restarting client without clearing session...`
    );

    setWhatsAppStatus('ready_timeout_restarting', `WhatsApp did not become ready within ${timeoutSeconds}s`);

    try {
      await safelyDestroyClient({ callLogout: false });
      initWhatsApp();
    } catch (err) {
      setWhatsAppStatus('failed', err.message);
      console.error('[whatsappService] Ready watchdog restart failed:', err.message);
      scheduleWhatsAppReconnect(err.message);
    }
  }, WHATSAPP_READY_TIMEOUT_MS);
}

async function safelyDestroyClient({ callLogout = false } = {}) {
  clearReadyWatchdogTimer();

  const currentClient = client;
  client = null;
  clientReady = false;
  incomingHandlerAttached = false;

  if (!currentClient) return;

  try {
    if (callLogout && typeof currentClient.logout === 'function') {
      await currentClient.logout();
    }
  } catch (err) {
    console.warn('[whatsappService] WhatsApp logout failed:', err.message);
  }

  try {
    if (typeof currentClient.destroy === 'function') {
      await currentClient.destroy();
    }
  } catch (err) {
    console.warn('[whatsappService] WhatsApp destroy failed:', err.message);
  }
}

function scheduleWhatsAppReconnect(reason = '') {
  if (manualRestartInProgress || reconnectTimer || !isWhatsAppEnabled()) return;

  const reasonText = String(reason || '').toLowerCase();
  if (
    reasonText.includes('chrome executable not found') ||
    reasonText.includes('dependency is unavailable') ||
    reasonText.includes('cannot find module')
  ) {
    console.warn('[whatsappService] Automatic reconnect stopped until the configuration problem is fixed. Use Restart Client from Integration Settings afterward.');
    return;
  }

  const delayMs = Math.min(60_000, 15_000 + (reconnectAttempt * 5_000));
  console.warn(`[whatsappService] Attempting to reinitialise in ${Math.round(delayMs / 1000)} seconds…`);

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (manualRestartInProgress) return;

    reconnectAttempt += 1;
    console.log('[whatsappService] Reinitialising WhatsApp client…', reason || '');

    try {
      await safelyDestroyClient({ callLogout: false });
      initWhatsApp();
    } catch (err) {
      setWhatsAppStatus('failed', err.message);
      console.error('[whatsappService] Reinitialise failed:', err.message);
      scheduleWhatsAppReconnect(err.message);
    }
  }, delayMs);
}

function createClient() {
  if (!isWhatsAppEnabled()) {
    throw new Error('WhatsApp integration is disabled in Master → Integration Settings');
  }

  if (!Client || !LocalAuth) {
    throw new Error(
      `WhatsApp dependency is unavailable. Run PUPPETEER_SKIP_DOWNLOAD=true npm install inside backend. ${whatsappDependencyError}`.trim()
    );
  }

  setWhatsAppStatus('initialising');
  ensureWhatsAppStorageDirs();

  const puppeteerConfig = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
  };

  const chromePath = resolveBrowserExecutablePath();
  if (!chromePath || !fs.existsSync(chromePath)) {
    const configuredPath = String(process.env.CHROME_EXECUTABLE_PATH || '').trim();
    const detail = configuredPath
      ? `Configured path does not exist: ${configuredPath}`
      : 'Install Google Chrome or set CHROME_EXECUTABLE_PATH in backend/.env.';
    throw new Error(`Chrome executable not found. ${detail}`);
  }
  puppeteerConfig.executablePath = chromePath;

  const wClient = new Client({
    authStrategy: new LocalAuth({
      clientId: getWhatsAppClientId(),
      dataPath: WHATSAPP_AUTH_DATA_PATH,
    }),
    puppeteer: puppeteerConfig,
    takeoverOnConflict: true,
    takeoverTimeoutMs: 10_000,
  });

  wClient.on('qr', async (qr) => {
    clearReadyWatchdogTimer();
    latestQr = qr;
    latestQrDataUrl = '';
    latestQrAscii = '';
    setWhatsAppStatus('qr_required');

    qrcodeTerminal.generate(qr, { small: true }, (terminalQr) => {
      latestQrAscii = terminalQr || '';
    });

    if (qrcodeImage) {
      try {
        latestQrDataUrl = await qrcodeImage.toDataURL(qr, {
          margin: 1,
          width: 280,
        });
      } catch (err) {
        console.warn('[whatsappService] Failed to generate QR image:', err.message);
      }
    } else {
      console.warn('[whatsappService] Optional package "qrcode" is not installed. Frontend will show terminal QR fallback.');
    }

    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║  WHATSAPP — Scan the QR code with your phone  ║');
    console.log('╚════════════════════════════════════════════════╝\n');
    if (latestQrAscii) {
      console.log(latestQrAscii);
    } else {
      qrcodeTerminal.generate(qr, { small: true });
    }
    console.log('\nWaiting for scan…\n');
  });

  wClient.on('ready', async () => {
    clientReady = true;
    reconnectAttempt = 0;
    clearReconnectTimer();
    clearReadyWatchdogTimer();
    latestQr = '';
    latestQrDataUrl = '';
    latestQrAscii = '';
    lastReadyAt = new Date();
    setWhatsAppStatus('ready');
    console.log('✅ [whatsappService] WhatsApp client is ready');
    console.log('✅ [whatsappService] Incoming Nexus WhatsApp commands are active');
  });

  wClient.on('authenticated', () => {
    scheduleReadyWatchdog('authentication', wClient);
    latestQr = '';
    latestQrDataUrl = '';
    latestQrAscii = '';
    lastAuthenticatedAt = new Date();
    setWhatsAppStatus('authenticated');
    console.log('🔐 [whatsappService] WhatsApp authenticated — session saved');
    console.log('[whatsappService] Waiting for WhatsApp ready event...');
  });

  wClient.on('loading_screen', (percent, message) => {
    console.log(`[whatsappService] WhatsApp loading ${percent || 0}% ${message || ''}`.trim());
  });

  wClient.on('change_state', (state) => {
    console.log('[whatsappService] WhatsApp state changed:', state);
  });

  wClient.on('auth_failure', (msg) => {
    clearReadyWatchdogTimer();
    clientReady = false;
    setWhatsAppStatus('auth_failed', msg || 'Authentication failed');
    console.error('[whatsappService] Authentication failed:', msg);
    console.error('[whatsappService] Clear session from Integration Settings and scan QR again');
  });

  wClient.on('disconnected', (reason) => {
    clearReadyWatchdogTimer();
    clientReady = false;
    incomingHandlerAttached = false;
    lastDisconnectedAt = new Date();
    setWhatsAppStatus('disconnected', reason || 'Disconnected');
    console.warn('[whatsappService] WhatsApp disconnected:', reason);

    scheduleWhatsAppReconnect(reason);
  });

  return wClient;
}

function attachIncomingHandler(wClient) {
  if (!wClient || incomingHandlerAttached) return;
  incomingHandlerAttached = true;

  // Process only incoming messages from other WhatsApp users.
  // Do not process message_create here because it also catches messages sent
  // by the linked Nexus WhatsApp account itself and can cause wrong sender
  // detection / duplicate command handling inside groups.
  wClient.on('message', handleIncomingWhatsAppMessage);
}

function initWhatsApp() {
  try {
    if (!isWhatsAppEnabled()) {
      setWhatsAppStatus('disabled', 'WhatsApp integration is disabled in Master → Integration Settings');
      console.warn('[whatsappService] WhatsApp integration is disabled.');
      return;
    }

    if (client && !manualRestartInProgress) {
      console.warn('[whatsappService] initWhatsApp skipped because a client already exists');
      return;
    }

    setWhatsAppStatus('initialising');
    client = createClient();
    attachIncomingHandler(client);
    scheduleReadyWatchdog('startup', client);
    client.initialize().catch((err) => {
      setWhatsAppStatus('failed', err.message);
      console.error('[whatsappService] initialize() failed:', err.message);
      console.error('[whatsappService] WhatsApp notifications/commands are disabled.');
      console.error('[whatsappService] Run npm install inside backend/ and check Chrome installation.');
      scheduleWhatsAppReconnect(err.message);
    });
  } catch (err) {
    setWhatsAppStatus('failed', err.message);
    console.error('[whatsappService] Could not create WhatsApp client:', err.message);
    scheduleWhatsAppReconnect(err.message);
  }
}

async function restartWhatsApp({ clearSession = false } = {}) {
  manualRestartInProgress = true;
  clearReconnectTimer();
  clearReadyWatchdogTimer();
  setWhatsAppStatus(clearSession ? 'session_clearing' : 'restarting');
  latestQr = '';
  latestQrDataUrl = '';
  latestQrAscii = '';

  await safelyDestroyClient({ callLogout: clearSession });

  if (clearSession) {
    try {
      fs.rmSync(getLocalAuthSessionPath(), { recursive: true, force: true });
      fs.rmSync(WHATSAPP_CACHE_DATA_PATH, { recursive: true, force: true });
      ensureWhatsAppStorageDirs();
    } catch (err) {
      console.warn('[whatsappService] Failed to clear LocalAuth session:', err.message);
    }
  }

  manualRestartInProgress = false;
  initWhatsApp();
  return getWhatsAppStatus();
}

async function logoutWhatsApp({ clearSession = true } = {}) {
  return restartWhatsApp({ clearSession });
}

// ─────────────────────────────────────────────────────────────────────────────
// Outgoing WhatsApp helpers
// ─────────────────────────────────────────────────────────────────────────────

async function sendWhatsAppNotification(text, toNumber = null) {
  const rawNumber = toNumber ?? getActiveWhatsAppConfig().notifyNumber;

  if (!rawNumber) {
    console.warn('[whatsappService] WhatsApp recipient number not set — skipping');
    return { ok: false, status: 'Skipped', error: 'Recipient number is missing' };
  }

  const digits = onlyDigits(rawNumber);
  if (!digits || digits.length < 10 || digits.length > 15) {
    console.warn('[whatsappService] WhatsApp recipient number is invalid — use country code and digits only');
    return {
      ok: false,
      status: 'Skipped',
      error: 'Recipient number is invalid. Use country code without +, spaces, or leading local zero.',
    };
  }

  if (!clientReady || !client) {
    console.warn('[whatsappService] Client not ready — message queued/skipped. Is WhatsApp authenticated?');
    return { ok: false, status: 'Queued', error: 'WhatsApp client is not ready' };
  }

  try {
    const contactId = await client.getNumberId(digits);

    if (!contactId) {
      console.warn('[whatsappService] Number not found on WhatsApp:', digits);
      return { ok: false, status: 'Failed', error: 'Number not found on WhatsApp' };
    }

    const chatId = contactId._serialized;
    await client.sendMessage(chatId, text);
    console.log('[whatsappService] ✅ Message sent to', chatId);

    return { ok: true, status: 'Sent', recipient: chatId };
  } catch (err) {
    console.error('[whatsappService] Failed to send message:', err.message);
    return { ok: false, status: 'Failed', error: err.message };
  }
}

function getConfiguredWhatsAppGroupId() {
  const rawGroupId = String(getActiveWhatsAppConfig().groupId || '').trim();

  if (!rawGroupId) return '';
  if (rawGroupId.includes('@g.us')) return rawGroupId;

  const digits = onlyDigits(rawGroupId);
  return digits ? `${digits}@g.us` : '';
}

function resolveAttachmentPath(file = {}) {
  const storagePath = String(file.storagePath || '').trim();
  if (!storagePath) return '';

  if (path.isAbsolute(storagePath)) return storagePath;

  // Stored app paths are relative to backend/uploads, for example:
  // inquiry/<filename>, projects/<filename>, tickets/<filename>.
  return path.join(__dirname, '..', 'uploads', storagePath);
}

async function sendWhatsAppGroupNotification(text, overrideGroupId = null) {
  const rawOverride = String(overrideGroupId || '').trim();
  const groupId = rawOverride
    ? (rawOverride.includes('@g.us') ? rawOverride : `${onlyDigits(rawOverride)}@g.us`)
    : getConfiguredWhatsAppGroupId();

  if (!groupId) {
    console.warn('[whatsappService] WhatsApp notification group is not configured in Integration Settings — skipping group message');
    return { ok: false, status: 'Skipped', error: 'WhatsApp notification group is not configured in Master → Integration Settings' };
  }

  if (!/^\d+@g\.us$/i.test(groupId)) {
    console.warn('[whatsappService] WhatsApp group id is invalid:', groupId);
    return {
      ok: false,
      status: 'Skipped',
      error: 'WhatsApp group id is invalid. Load groups from Integration Settings and select the correct group.',
      recipient: groupId,
    };
  }

  if (!clientReady || !client) {
    console.warn('[whatsappService] Client not ready — group message queued/skipped. Is WhatsApp authenticated?');
    return { ok: false, status: 'Queued', error: 'WhatsApp client is not ready' };
  }

  try {
    await client.sendMessage(groupId, text);
    console.log('[whatsappService] ✅ Group message sent to', groupId);

    return { ok: true, status: 'Sent', recipient: groupId };
  } catch (err) {
    console.error('[whatsappService] Failed to send group message:', err.message);
    return { ok: false, status: 'Failed', error: err.message, recipient: groupId };
  }
}

async function sendWhatsAppGroupWithAttachments(text, attachments = []) {
  const groupResult = await sendWhatsAppGroupNotification(text);

  if (!groupResult?.ok) {
    return groupResult;
  }

  const groupId = groupResult.recipient || getConfiguredWhatsAppGroupId();
  const files = Array.isArray(attachments) ? attachments : [];
  const attachmentResults = [];

  for (const file of files) {
    const hasBuffer = Buffer.isBuffer(file?.buffer);
    const fullPath = hasBuffer ? '' : resolveAttachmentPath(file);
    const fileName = file?.name || file?.filename || file?.storedName || path.basename(fullPath || 'attachment');

    if (!hasBuffer && (!fullPath || !fs.existsSync(fullPath))) {
      const error = `Attachment file not found: ${fullPath || fileName}`;
      console.warn('[whatsappService]', error);
      attachmentResults.push({ ok: false, status: 'Skipped', fileName, error });
      continue;
    }

    try {
      const media = hasBuffer
        ? new MessageMedia(
          file?.mimeType || file?.contentType || 'application/octet-stream',
          file.buffer.toString('base64'),
          fileName,
          file.buffer.length
        )
        : MessageMedia.fromFilePath(fullPath);
      media.filename = fileName;

      await client.sendMessage(groupId, media, { sendMediaAsDocument: true });
      console.log('[whatsappService] ✅ Attachment sent to group:', fileName);
      attachmentResults.push({ ok: true, status: 'Sent', fileName });
    } catch (err) {
      console.error('[whatsappService] Attachment failed:', err.message);
      attachmentResults.push({ ok: false, status: 'Failed', fileName, error: err.message });
    }
  }

  const failedAttachments = attachmentResults.filter((item) => !item.ok);

  return {
    ok: failedAttachments.length === 0,
    status: failedAttachments.length === 0 ? 'Sent' : 'Partial',
    recipient: groupId,
    attachments: attachmentResults,
    error: failedAttachments.length > 0
      ? `${failedAttachments.length} attachment(s) failed or were skipped`
      : '',
  };
}

function withWhatsAppTimeout(promise, timeoutMs = 20_000, label = 'WhatsApp operation') {
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)} seconds`));
      }, timeoutMs);
    }),
  ]);
}

function getSerializedWhatsAppId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._serialized || value.serialized || value.user || '';
}

function normalizeWhatsAppGroup(record = {}) {
  const id = getSerializedWhatsAppId(record.id || record.chatId || record.contactId);
  const isGroup = Boolean(
    record.isGroup ||
    record.groupMetadata ||
    /@g\.us$/i.test(id)
  );

  if (!isGroup || !/@g\.us$/i.test(id)) return null;

  const participants =
    record.participants ||
    record.groupMetadata?.participants ||
    record.groupMetadata?.participantSet ||
    [];

  return {
    id,
    name: String(
      record.name ||
      record.formattedTitle ||
      record.title ||
      record.pushname ||
      record.shortName ||
      'Unnamed WhatsApp Group'
    ).trim(),
    participantCount: Number.isFinite(Number(record.participantCount))
      ? Number(record.participantCount)
      : (Array.isArray(participants) ? participants.length : null),
  };
}

function mergeWhatsAppGroups(...collections) {
  const byId = new Map();

  collections.flat().forEach((record) => {
    const group = normalizeWhatsAppGroup(record);
    if (!group) return;

    const previous = byId.get(group.id);
    byId.set(group.id, {
      ...previous,
      ...group,
      name: group.name !== 'Unnamed WhatsApp Group'
        ? group.name
        : (previous?.name || group.name),
      participantCount: group.participantCount ?? previous?.participantCount ?? null,
    });
  });

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function loadGroupsFromChats() {
  if (typeof client?.getChats !== 'function') return [];
  const chats = await withWhatsAppTimeout(client.getChats(), 20_000, 'Loading WhatsApp chats');
  return Array.isArray(chats) ? chats : [];
}

async function loadGroupsFromContacts() {
  if (typeof client?.getContacts !== 'function') return [];
  const contacts = await withWhatsAppTimeout(client.getContacts(), 20_000, 'Loading WhatsApp contacts');
  return (Array.isArray(contacts) ? contacts : []).filter((contact) => {
    const id = getSerializedWhatsAppId(contact?.id);
    return Boolean(contact?.isGroup || /@g\.us$/i.test(id));
  });
}

async function loadGroupsFromBrowserStore() {
  if (!client?.pupPage || typeof client.pupPage.evaluate !== 'function') return [];

  return withWhatsAppTimeout(
    client.pupPage.evaluate(() => {
      const chatStore = window.Store?.Chat;
      const models = typeof chatStore?.getModelsArray === 'function'
        ? chatStore.getModelsArray()
        : (Array.isArray(chatStore?._models) ? chatStore._models : []);

      return (Array.isArray(models) ? models : [])
        .map((chat) => {
          const id = chat?.id?._serialized || chat?.id?.serialized || '';
          const participants =
            chat?.groupMetadata?.participants ||
            chat?.groupMetadata?.participantSet ||
            [];

          return {
            id,
            isGroup: Boolean(chat?.isGroup || chat?.groupMetadata || /@g\.us$/i.test(id)),
            name: chat?.name || chat?.formattedTitle || chat?.title || '',
            participantCount: Array.isArray(participants) ? participants.length : null,
          };
        })
        .filter((chat) => chat.isGroup && /@g\.us$/i.test(chat.id));
    }),
    20_000,
    'Loading WhatsApp groups from browser session'
  );
}

async function listWhatsAppGroups() {
  if (!clientReady || !client) {
    return {
      ok: false,
      status: 'Not Ready',
      groups: [],
      error: 'WhatsApp is not ready. Scan the QR code and wait until the status becomes ready.',
    };
  }

  const diagnostics = [];
  let groups = [];

  try {
    const chats = await loadGroupsFromChats();
    groups = mergeWhatsAppGroups(chats);
    diagnostics.push(`chats:${Array.isArray(chats) ? chats.length : 0}`);
  } catch (error) {
    diagnostics.push(`chats-error:${error.message}`);
    console.warn('[whatsappService] getChats group lookup failed:', error.message);
  }

  if (groups.length === 0) {
    try {
      const contacts = await loadGroupsFromContacts();
      groups = mergeWhatsAppGroups(groups, contacts);
      diagnostics.push(`contacts:${Array.isArray(contacts) ? contacts.length : 0}`);
    } catch (error) {
      diagnostics.push(`contacts-error:${error.message}`);
      console.warn('[whatsappService] getContacts group lookup failed:', error.message);
    }
  }

  if (groups.length === 0) {
    try {
      const browserGroups = await loadGroupsFromBrowserStore();
      groups = mergeWhatsAppGroups(groups, browserGroups);
      diagnostics.push(`browser:${Array.isArray(browserGroups) ? browserGroups.length : 0}`);
    } catch (error) {
      diagnostics.push(`browser-error:${error.message}`);
      console.warn('[whatsappService] Browser-store group lookup failed:', error.message);
    }
  }

  if (groups.length === 0) {
    return {
      ok: true,
      status: 'Ready',
      groups: [],
      warning: 'WhatsApp is connected, but no groups were found. Open WhatsApp on the linked phone, confirm this account is a member of at least one group, then click Load Groups again.',
      diagnostics,
    };
  }

  return {
    ok: true,
    status: 'Ready',
    groups,
    diagnostics,
  };
}

async function sendTestMessage(toNumber = null) {
  const result = await sendWhatsAppNotification(
    `✅ Nexus WhatsApp direct test message.
Time: ${new Date().toLocaleString('en-IN')}`,
    toNumber
  );

  return {
    ok: Boolean(result?.ok),
    status: result?.status || '',
    recipient: result?.recipient || toNumber || getActiveWhatsAppConfig().notifyNumber || '',
    error: result?.error || '',
  };
}

async function sendTestGroupMessage(groupId = null) {
  const result = await sendWhatsAppGroupNotification(
    `✅ Nexus WhatsApp group test message.
Time: ${new Date().toLocaleString('en-IN')}`,
    groupId
  );

  return {
    ok: Boolean(result?.ok),
    status: result?.status || '',
    recipient: result?.recipient || groupId || getConfiguredWhatsAppGroupId(),
    error: result?.error || '',
  };
}

module.exports = {
  initWhatsApp,
  reloadWhatsAppSettings,
  getWhatsAppStatus,
  restartWhatsApp,
  logoutWhatsApp,
  sendWhatsAppNotification,
  sendWhatsAppGroupNotification,
  sendWhatsAppGroupWithAttachments,
  listWhatsAppGroups,
  sendTestMessage,
  sendTestGroupMessage,
};