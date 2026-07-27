// ─────────────────────────────────────────────────────────────────────────────
// frontend/src/utils/calendarEventMapper.js
//
// Maps TimesheetTask API documents → react-big-calendar event objects.
// All date logic uses plain JS Date — no dayjs dependency needed here.
// ─────────────────────────────────────────────────────────────────────────────

// ── Status → colour palette ───────────────────────────────────────────────────
// Each entry: { bg, border, text } — used as inline style on calendar events.
const STATUS_COLORS = {
  Backlog:      { bg: '#f1f5f9', border: '#94a3b8', text: '#475569' },
  Planned:      { bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8' },
  'In Progress':{ bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  Review:       { bg: '#ede9fe', border: '#8b5cf6', text: '#5b21b6' },
  Completed:    { bg: '#dcfce7', border: '#22c55e', text: '#14532d' },
};

const DEFAULT_COLOR = { bg: '#f8fafc', border: '#cbd5e1', text: '#334155' };

// ── Time helpers ──────────────────────────────────────────────────────────────

/**
 * Parse "HH:mm" string and apply it to a base Date, returning a new Date.
 * Falls back to midnight when timeStr is absent or malformed.
 */
function applyTime(baseDate, timeStr) {
  const d = new Date(baseDate);
  if (timeStr && /^\d{2}:\d{2}$/.test(timeStr)) {
    const [h, m] = timeStr.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

/**
 * Build a sensible end Date from task data.
 * Priority: endTime > startTime + hours > startTime + 1h > midnight.
 */
function buildEnd(taskDate, startTime, endTime, hours) {
  if (endTime) return applyTime(taskDate, endTime);

  if (startTime && hours > 0) {
    const start = applyTime(taskDate, startTime);
    return new Date(start.getTime() + hours * 3_600_000);
  }

  if (startTime) {
    const start = applyTime(taskDate, startTime);
    return new Date(start.getTime() + 3_600_000); // +1 h default
  }

  // All-day fallback: end = start of next day so RBC renders it as a full-day block
  const d = new Date(taskDate);
  d.setHours(23, 59, 0, 0);
  return d;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Convert a single TimesheetTask document to an RBC event object.
 *
 * @param  {Object} task  - raw task from API (populated project, employee)
 * @returns {Object}      - { id, title, start, end, allDay, resource, style }
 */
export function taskToEvent(task) {
  const colors  = STATUS_COLORS[task.status] || DEFAULT_COLOR;
  const taskDate = new Date(task.date);

  const start = applyTime(taskDate, task.startTime);
  const end   = buildEnd(taskDate, task.startTime, task.endTime, task.hours || 0);

  // When no times are stored treat as all-day
  const allDay = !task.startTime && !task.endTime;

  return {
    id:    task._id,
    title: task.title,
    start,
    end,
    allDay,

    // Carry the full task so the calendar can open it in TimesheetForm
    resource: task,

    // Inline style consumed by eventPropGetter in the calendar
    style: {
      backgroundColor: colors.bg,
      borderLeft:      `3px solid ${colors.border}`,
      color:           colors.text,
      borderRadius:    '4px',
      fontSize:        '12px',
      fontWeight:      500,
      padding:         '1px 6px',
    },
  };
}

/**
 * Convert an array of TimesheetTask documents to RBC events.
 *
 * @param  {Array} tasks
 * @returns {Array}
 */
export function tasksToEvents(tasks = []) {
  return tasks.map(taskToEvent);
}

/**
 * Build { from, to } ISO date strings for the visible calendar range.
 * Adds a 7-day buffer on each side so navigating between months never
 * shows blank cells while the fetch is in flight.
 *
 * @param  {Date} rangeStart
 * @param  {Date} rangeEnd
 * @returns {{ from: string, to: string }}
 */
export function rangeToParams(rangeStart, rangeEnd) {
  const from = new Date(rangeStart);
  from.setDate(from.getDate() - 7);

  const to = new Date(rangeEnd);
  to.setDate(to.getDate() + 7);

  return {
    from: from.toISOString().split('T')[0],
    to:   to.toISOString().split('T')[0],
  };
}

/**
 * Given a clicked slot (date or datetime), return the ISO date string
 * "YYYY-MM-DD" to pre-fill the task form's date field.
 *
 * @param  {Date} slotDate
 * @returns {string}
 */
export function slotToDateString(slotDate) {
  const d = new Date(slotDate);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Given a clicked slot, return "HH:mm" if a meaningful time is present
 * (i.e. not midnight on a pure date click), otherwise undefined.
 *
 * @param  {Date} slotDate
 * @returns {string|undefined}
 */
export function slotToTimeString(slotDate) {
  const d = new Date(slotDate);
  if (d.getHours() === 0 && d.getMinutes() === 0) return undefined;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export { STATUS_COLORS };
