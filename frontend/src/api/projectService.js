/**
 * projectService.js
 * Single source of truth for all project API calls.
 * All components must use these functions — never call API.get('/projects') directly.
 */
import API from './axios';

const emitProjectActivityRefresh = (projectId, payload = {}) => {
  if (typeof window === 'undefined' || !projectId) return;

  window.dispatchEvent(
    new CustomEvent('project-activity-updated', {
      detail: { projectId, ...payload },
    })
  );
};

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isBadIdString = (value = '') => {
  const text = String(value || '').trim();
  return !text || text === '[object Object]' || text === 'undefined' || text === 'null';
};

const cleanIdString = (value) => {
  const text = String(value || '').trim();
  return isBadIdString(text) ? '' : text;
};

const objectIdBytesToHex = (bytes) => {
  if (!bytes) return '';

  let values = [];
  if (Array.isArray(bytes)) {
    values = bytes;
  } else if (ArrayBuffer.isView(bytes)) {
    values = Array.from(bytes);
  } else if (isPlainObject(bytes)) {
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

  return values
    .map((value) => Number(value).toString(16).padStart(2, '0'))
    .join('');
};

const getObjectIdFromBufferShape = (value) => {
  if (!isPlainObject(value)) return '';

  const directBufferId = objectIdBytesToHex(value.buffer);
  if (directBufferId) return directBufferId;

  const idBufferId = objectIdBytesToHex(value.id);
  if (idBufferId) return idBufferId;

  return '';
};

/**
 * Accepts either a Mongo id string or a project/object returned by Mongo/Mongoose.
 * This prevents routes like /projects/[object Object] when an _id/id is received
 * as a nested ObjectId-shaped object instead of a plain string.
 */
export const getProjectId = (value) => {
  if (!value) return '';

  if (typeof value === 'string' || typeof value === 'number') {
    return cleanIdString(value);
  }

  if (isPlainObject(value)) {
    const bufferShapeId = getObjectIdFromBufferShape(value);
    if (bufferShapeId) return bufferShapeId;

    if (typeof value.toHexString === 'function') {
      const hexId = cleanIdString(value.toHexString());
      if (hexId) return hexId;
    }

    if (typeof value.$oid === 'string') {
      const oid = cleanIdString(value.$oid);
      if (oid) return oid;
    }

    // Prefer real Mongo _id first. Mongoose/Express can sometimes expose an id
    // virtual as an object/stringified [object Object], so id is checked later.
    if (value._id && value._id !== value) {
      const nestedId = getProjectId(value._id);
      if (nestedId) return nestedId;
    }

    if (typeof value.id === 'string' || typeof value.id === 'number') {
      const plainId = cleanIdString(value.id);
      if (plainId) return plainId;
    }

    if (value.id && value.id !== value) {
      const nestedId = getProjectId(value.id);
      if (nestedId) return nestedId;
    }
  }

  if (typeof value.toHexString === 'function') {
    const hexId = cleanIdString(value.toHexString());
    if (hexId) return hexId;
  }

  if (typeof value.toString === 'function') {
    const asString = cleanIdString(value.toString());
    if (asString) return asString;
  }

  return '';
};

const requireProjectId = (value, action = 'project action') => {
  const projectId = getProjectId(value);

  if (!projectId) {
    throw new Error(`Invalid project id for ${action}`);
  }

  return encodeURIComponent(projectId);
};

// ── Fetch paginated project list ──────────────────────────────────────────────
export const fetchProjects = (params = {}) =>
  API.get('/projects', { params }).then((r) => r.data);

// ── Fetch single project ──────────────────────────────────────────────────────
export const fetchProject = (id) =>
  API.get(`/projects/${requireProjectId(id, 'fetch project')}`).then((r) => r.data.data);

// ── Create project ────────────────────────────────────────────────────────────
export const createProject = (body) =>
  API.post('/projects', body).then((r) => {
    const project = r.data.data;
    emitProjectActivityRefresh(getProjectId(project), { action: 'created', project });
    return project;
  });

// ── Copy project ──────────────────────────────────────────────────────────────
export const copyProject = (projectOrId) => {
  const sourceProjectId = requireProjectId(projectOrId, 'copy project');

  return API.post(`/projects/${sourceProjectId}/copy`).then((r) => {
    // Support the current backend response shape and older copy responses safely.
    // This prevents successful copy calls from returning undefined to the UI.
    const response = r.data || {};
    const project = response.data?.project || response.data || response.project || response.copiedProject || null;
    emitProjectActivityRefresh(getProjectId(project), { action: 'copied', project });
    return project;
  });
};

// ── Update project - single source of truth for all updates ──────────────────
export const updateProject = (id, body) => {
  const projectId = requireProjectId(id, 'update project');

  return API.put(`/projects/${projectId}`, body).then((r) => {
    const project = r.data.data;
    emitProjectActivityRefresh(projectId, { action: 'updated', project });
    return project;
  });
};

export const updatePlanningTaskStatus = (projectId, gridId, taskId, status) => {
  const safeProjectId = requireProjectId(projectId, 'update planning task status');
  const safeGridId = encodeURIComponent(String(gridId || '').trim());
  const safeTaskId = encodeURIComponent(String(taskId || '').trim());

  if (!safeGridId || !safeTaskId) {
    throw new Error('Invalid planning grid or task id');
  }

  return API.patch(
    `/projects/${safeProjectId}/planning-grids/${safeGridId}/tasks/${safeTaskId}/status`,
    { status }
  ).then((r) => {
    const project = r.data.data;
    emitProjectActivityRefresh(safeProjectId, { action: 'task_status_updated', project });
    return project;
  });
};

// ── Convert inquiry to project ────────────────────────────────────────────────
export const convertInquiry = (inquiryId, body) =>
  API.post(`/projects/convert/${inquiryId}`, body).then((r) => {
    const project = r.data.data;
    emitProjectActivityRefresh(getProjectId(project), { action: 'created', project });
    return project;
  });

// ── Fetch activity log history ────────────────────────────────────────────────
export const fetchActivityLog = (id, params = {}) =>
  API.get(`/projects/${requireProjectId(id, 'fetch activity')}/activity`, { params }).then((r) => r.data);

// ── Fetch task completion history / Tasks vs Days graph ──────────────────────
export const fetchTaskCompletionHistory = (id, params = {}) =>
  API.get(`/projects/${requireProjectId(id, 'fetch task completion history')}/task-completion-history`, { params }).then(
    (r) => r.data.data
  );

// ── Trigger bulk delay recalculation ─────────────────────────────────────────
export const recalcDelays = () =>
  API.post('/projects/recalc-delays').then((r) => r.data);

// ── Helper: compute delay on the client side ─────────────────────────────────
const startOfDay = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const daysBetween = (startDate, endDate) => {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  if (!start || !end) return 0;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
};

const addDays = (dateValue, days) => {
  const date = startOfDay(dateValue);
  if (!date) return null;
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString();
};

export const computeDelay = (project = {}) => {
  const expectedEndDate = project.projectEndDate;
  const isCompleted = project.projectStatus === 'Completed';

  if (!expectedEndDate) {
    const storedDays = Number(project.delayedDays || 0);
    return {
      isDelayed: storedDays > 0 || Boolean(project.isDelayed),
      delayedDays: storedDays,
      delayedEndDate: project.delayedEndDate || null,
      completedAt: project.completedAt || project.actualDeliveryDate || null,
      delayFrozen: isCompleted,
    };
  }

  if (isCompleted) {
    const completedAt = project.completedAt || project.actualDeliveryDate || null;
    const storedDays = Number(project.delayedDays || 0);
    const delayedDays = completedAt ? daysBetween(expectedEndDate, completedAt) : storedDays;

    return {
      isDelayed: delayedDays > 0,
      delayedDays,
      delayedEndDate: project.delayedEndDate || addDays(expectedEndDate, delayedDays),
      completedAt,
      delayFrozen: true,
    };
  }

  const delayedDays = daysBetween(expectedEndDate, new Date());

  return {
    isDelayed: delayedDays > 0,
    delayedDays,
    delayedEndDate: delayedDays > 0 ? addDays(expectedEndDate, delayedDays) : project.delayedEndDate || null,
    completedAt: project.completedAt || null,
    delayFrozen: false,
  };
};

// ── Project document attachments ────────────────────────────────────────────
export const uploadProjectDocuments = (id, files = []) => {
  const projectId = requireProjectId(id, 'upload project documents');
  const formData = new FormData();
  Array.from(files || []).forEach((file) => formData.append('documents', file));

  return API.post(`/projects/${projectId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => {
    const project = r.data.data;
    emitProjectActivityRefresh(projectId, { action: 'documents_uploaded', project });
    return project;
  });
};

// ── Project planning v2 catalog and task APIs ────────────────────────────────
export const fetchProjectPlanningOptions = () =>
  API.get('/projects/planning-templates').then((r) => r.data.data);

export const validateProjectPlanningImport = () =>
  API.get('/projects/planning-import/validate').then((r) => r.data.data);

export const fetchPlanningUsers = (department) =>
  API.get('/projects/planning-users', { params: { department } }).then((r) => r.data.data || []);

export const recalculatePlanningGrid = (grid) =>
  API.post('/projects/planning-preview/recalculate', grid).then((r) => r.data.data);

export const createSeparatePlanningGrid = (projectId, body) =>
  API.post(`/projects/${requireProjectId(projectId, 'create planning grid')}/planning-grids`, body).then((r) => r.data.data);

export const addPlanningTask = (projectId, gridId, task) =>
  API.post(`/projects/${requireProjectId(projectId, 'add planning task')}/planning-grids/${encodeURIComponent(gridId)}/tasks`, { task }).then((r) => r.data.data);

export const updatePlanningTask = (projectId, gridId, taskId, task) =>
  API.patch(`/projects/${requireProjectId(projectId, 'update planning task')}/planning-grids/${encodeURIComponent(gridId)}/tasks/${encodeURIComponent(taskId)}`, { task }).then((r) => r.data.data);

export const removePlanningTask = (projectId, gridId, taskId) =>
  API.delete(`/projects/${requireProjectId(projectId, 'remove planning task')}/planning-grids/${encodeURIComponent(gridId)}/tasks/${encodeURIComponent(taskId)}`).then((r) => r.data.data);

export const reorderPlanningTasks = (projectId, gridId, taskIds) =>
  API.patch(`/projects/${requireProjectId(projectId, 'reorder planning tasks')}/planning-grids/${encodeURIComponent(gridId)}/tasks/reorder`, { taskIds }).then((r) => r.data.data);
