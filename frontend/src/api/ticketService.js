/**
 * ticketService.js
 * Single source of truth for all ticket API calls.
 * All components must use these functions — never call API.get('/tickets') directly.
 */
import API from './axios';

const normalizePagination = (pagination = {}) => {
  const totalPages = Number(pagination.totalPages ?? pagination.pages ?? 1);

  return {
    total: Number(pagination.total ?? 0),
    page: Number(pagination.page ?? 1),
    limit: Number(pagination.limit ?? 50),
    totalPages,
    pages: totalPages,
  };
};

const normalizeTicketListParams = (params = {}) => {
  const normalized = {};

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;

    if (Array.isArray(value)) {
      if (!value.length) return;
      normalized[key] = value.join(',');
      return;
    }

    normalized[key] = value;
  });

  return normalized;
};

const unwrapTicket = (response) => response.data.ticket;

const unwrapTicketList = (response) => ({
  tickets: response.data.tickets ?? [],
  statusCounts: response.data.statusCounts ?? {
    Total: 0,
    New: 0,
    Assigned: 0,
    Working: 0,
    'Customer Side Pending': 0,
    Closed: 0,
    Void: 0,
  },
  pagination: normalizePagination(response.data.pagination),
});

// ── List tickets ─────────────────────────────────────────────────────────────
export const fetchTickets = (params = {}) =>
  API.get('/tickets', { params: normalizeTicketListParams(params) }).then(unwrapTicketList);

// ── Single ticket ────────────────────────────────────────────────────────────
export const fetchTicket = (id) =>
  API.get(`/tickets/${id}`).then(unwrapTicket);

// ── Create ticket ────────────────────────────────────────────────────────────
export const createTicket = (body) =>
  API.post('/tickets', body).then(unwrapTicket);

// ── Update ticket ────────────────────────────────────────────────────────────
export const updateTicket = (id, body) =>
  API.put(`/tickets/${id}`, body).then(unwrapTicket);

// ── Workflow actions ─────────────────────────────────────────────────────────
export const assignTicket = (id, body) =>
  API.patch(`/tickets/${id}/assign`, body).then(unwrapTicket);

export const startWork = (id) =>
  API.patch(`/tickets/${id}/start-work`).then(unwrapTicket);

export const setCustomerPending = (id, body = {}) =>
  API.patch(`/tickets/${id}/customer-pending`, body).then(unwrapTicket);

export const closeTicket = (id, body) =>
  API.patch(`/tickets/${id}/close`, body).then(unwrapTicket);

export const reopenTicket = (id, body = {}) =>
  API.patch(`/tickets/${id}/reopen`, body).then(unwrapTicket);

export const voidTicket = (id, body) =>
  API.patch(`/tickets/${id}/void`, body).then(unwrapTicket);

// ── Comments ─────────────────────────────────────────────────────────────────
export const fetchComments = (ticketId, params = {}) =>
  API.get(`/tickets/${ticketId}/comments`, { params }).then((response) => ({
    comments: response.data.comments ?? [],
    pagination: normalizePagination(response.data.pagination),
  }));

export const addComment = (ticketId, body) =>
  API.post(`/tickets/${ticketId}/comments`, body).then((response) => response.data.comment);

export const editComment = (commentId, body) =>
  API.put(`/tickets/comments/${commentId}`, body).then((response) => response.data.comment);

// ── Attachments ──────────────────────────────────────────────────────────────
export const uploadAttachments = (ticketId, files) => {
  const form = new FormData();
  Array.from(files).forEach((file) => form.append('attachments', file));

  return API.post(`/tickets/${ticketId}/attachments`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(unwrapTicket);
};

// ── Activity timeline ────────────────────────────────────────────────────────
export const fetchActivity = (ticketId, params = {}) =>
  API.get(`/tickets/${ticketId}/activity`, { params }).then((response) => ({
    activities: response.data.activities ?? [],
    pagination: normalizePagination(response.data.pagination),
  }));