/**
 * ticketPermissions.js
 * Pure-function permission helpers that mirror the backend's role/assignment
 * business rules. Used exclusively for show/hide/disable of UI elements.
 *
 * Backend remains the authoritative source of truth — these functions are
 * client-side shortcuts only and do NOT replace server-side validation.
 */

// ── Role helpers ──────────────────────────────────────────────────────────────

const normalizeRole = (role = '') => String(role || '').trim().toLowerCase();
const isAdminUser = (user) => normalizeRole(user?.role) === 'admin';
const isHodUser = (user) => normalizeRole(user?.role) === 'hod';
const isManagerUser = (user) => normalizeRole(user?.role) === 'manager';
const isTeamLeadUser = (user) => normalizeRole(user?.role) === 'team_lead';

/** Admin or HOD. */
const isAdminOrHod = (user) => isAdminUser(user) || isHodUser(user);

/** Admin, HOD, Manager, or Team Lead. */
const isManagement = (user) =>
  isAdminUser(user) || isHodUser(user) || isManagerUser(user) || isTeamLeadUser(user);

/** The ticket's currently assigned employee. */
const isAssignedEmployee = (user, ticket) => {
  if (!user || !ticket?.assignedTo) return false;
  const assignedId =
    ticket.assignedTo?._id?.toString?.() ?? ticket.assignedTo?.toString?.();
  const userId = user._id?.toString?.();
  return !!assignedId && !!userId && assignedId === userId;
};

// ── CRUD / creation ───────────────────────────────────────────────────────────

/**
 * Any authenticated user can create a ticket.
 * Gate at render level only if business rules change; for now always true.
 */
// export const canCreateTicket = (user) => !!user;
export const canCreateTicket = (user) => isManagement(user);

// ── Workflow actions ──────────────────────────────────────────────────────────

/** Assign / Reassign — Admin, HOD, or Manager/Team Lead. */
export const canAssignTicket = (user, _ticket) => isManagement(user);

/**
 * Start Work — the assigned employee, Admin, HOD, or Manager/Team Lead.
 * Only relevant when status is 'Assigned' or 'Customer Side Pending'.
 */
export const canStartWork = (user, ticket) =>
  isManagement(user) || isAssignedEmployee(user, ticket);

/**
 * Set Customer Side Pending — assigned employee, Admin, HOD, Manager/Team Lead.
 * Only relevant when status is 'Working'.
 */
export const canSetCustomerPending = (user, ticket) =>
  isManagement(user) || isAssignedEmployee(user, ticket);

/**
 * Close — assigned employee, Admin, HOD, Manager/Team Lead.
 * Only relevant when status is 'Working' or 'Customer Side Pending'.
 */

// export const canCloseTicket = (user, ticket) =>
//   isManagement(user) || isAssignedEmployee(user, ticket);
export const canCloseTicket = (user, ticket) =>
  isManagement(user) || isAssignedEmployee(user, ticket);


/**
 * Reopen — ticket managers only.
 * Only relevant when status is 'Closed'.
 */
export const canReopenTicket = (user) => isManagement(user);

/**
 * Void — Admin or HOD only.
 * Relevant for any status except 'Closed' and 'Void'.
 */
export const canVoidTicket = (user, _ticket) => isAdminOrHod(user);

// ── Comments ──────────────────────────────────────────────────────────────────

/**
 * Edit or delete a comment — comment's own author, Admin, HOD, or Manager/Team Lead.
 * Pass the comment object (must have `author` field as id or populated object).
 */
export const canModifyComment = (user, comment) => {
  if (!user) return false;
  if (isManagement(user)) return true;
  const authorId =
    comment?.author?._id?.toString?.() ?? comment?.author?.toString?.();
  return !!authorId && authorId === user._id?.toString?.();
};

// ── Attachments ───────────────────────────────────────────────────────────────

/**
 * Delete an attachment — uploader, Admin, HOD, or Manager/Team Lead.
 * Upload is always allowed (disabled by backend when ticket is Closed/Void).
 */
export const canDeleteAttachment = (user, attachment) => {
  if (!user) return false;
  if (isManagement(user)) return true;
  const uploaderId =
    attachment?.uploadedBy?._id?.toString?.() ??
    attachment?.uploadedBy?.toString?.();
  return !!uploaderId && uploaderId === user._id?.toString?.();
};

// ── Convenience: which workflow buttons are visible given current status ───────

/**
 * Returns a map of which workflow action buttons should be shown,
 * based on current ticket status AND user role/assignment.
 *
 * Components should call this once and destructure for clarity.
 */
export const getVisibleActions = (user, ticket) => {
  if (!user || !ticket) {
    return {
      showAssign: false,
      showStartWork: false,
      showCustomerPending: false,
      showClose: false,
      showReopen: false,
      showVoid: false,
    };
  }

  const { status } = ticket;

  return {
    // Assign/Reassign: always shown to management, regardless of status
    // (except Closed/Void where it's moot — keep hidden for cleanliness)
    showAssign:
      canAssignTicket(user, ticket) &&
      status !== 'Closed' &&
      status !== 'Void',

    // Start Work: only when Assigned or Customer Side Pending
    showStartWork:
      canStartWork(user, ticket) &&
      (status === 'Assigned' || status === 'Customer Side Pending'),

    // Customer Pending: only when Working
    showCustomerPending:
      canSetCustomerPending(user, ticket) && status === 'Working',

    // Close: only when Working or Customer Side Pending
    showClose:
      canCloseTicket(user, ticket) &&
      (status === 'Working' || status === 'Customer Side Pending'),

    // Reopen: only when Closed
    showReopen: canReopenTicket(user, ticket) && status === 'Closed',

    // Void: any status except Closed or already Void
    showVoid:
      canVoidTicket(user, ticket) &&
      status !== 'Closed' &&
      status !== 'Void',
  };
};
