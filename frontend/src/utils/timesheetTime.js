// frontend/src/utils/timesheetTime.js
// UI helpers for explicit 12-hour AM/PM display while preserving the existing
// canonical 24-hour HH:mm values used by the API/database.

export const normalizeTimeTo24Hour = (value) => {
  if (value === null || value === undefined) return '';
  const raw = String(value).trim();
  if (!raw) return '';

  const match24 = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (match24) return `${match24[1]}:${match24[2]}`;

  const match12 = raw.match(/^(0?[1-9]|1[0-2])(?::([0-5]\d))?\s*(AM|PM)$/i);
  if (!match12) return '';

  let hour = Number(match12[1]);
  const minute = Number(match12[2] ?? 0);
  const period = match12[3].toUpperCase();

  if (period === 'AM') {
    if (hour === 12) hour = 0;
  } else if (hour !== 12) {
    hour += 12;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

export const timeToMinutes = (value) => {
  const normalized = normalizeTimeTo24Hour(value);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(':').map(Number);
  return hours * 60 + minutes;
};

export const minutesToTime = (minutes) => {
  const safeMinutes = Math.max(0, Math.min(23 * 60 + 59, Number(minutes) || 0));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

export const formatTime12Hour = (value) => {
  const normalized = normalizeTimeTo24Hour(value);
  if (!normalized) return '';
  const [hours24, minutes] = normalized.split(':').map(Number);
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
};

export const get12HourParts = (value) => {
  const normalized = normalizeTimeTo24Hour(value);
  if (!normalized) return { hour: '', minute: '', period: 'AM' };
  const [hours24, minutes] = normalized.split(':').map(Number);
  return {
    hour: String(hours24 % 12 || 12).padStart(2, '0'),
    minute: String(minutes).padStart(2, '0'),
    period: hours24 >= 12 ? 'PM' : 'AM',
  };
};

export const build24HourTime = (hour12, minute, period = 'AM') => {
  if (!hour12) return '';
  let hour = Number(hour12);
  const mins = Number(minute || 0);
  if (!Number.isInteger(hour) || hour < 1 || hour > 12) return '';
  if (!Number.isInteger(mins) || mins < 0 || mins > 59) return '';

  if (String(period).toUpperCase() === 'AM') {
    if (hour === 12) hour = 0;
  } else if (hour !== 12) {
    hour += 12;
  }

  return `${String(hour).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

export const calcHoursValue = (start, end) => {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return null;
  const diff = endMinutes - startMinutes;
  return diff > 0 ? Math.round((diff / 60) * 10000) / 10000 : null;
};

export const addDecimalHoursToTime = (startTime, decimalHours) => {
  const startMinutes = timeToMinutes(startTime);
  const hours = Number(decimalHours);
  if (startMinutes === null || Number.isNaN(hours) || hours <= 0) return '';
  return minutesToTime(startMinutes + Math.round(hours * 60));
};

// Accepts user shorthand H, H.MM or H:MM. The digits after '.' or ':' are
// minutes, not a decimal fraction of an hour.
export const parseDurationInput = (value) => {
  if (value === '' || value === null || value === undefined) {
    return { valid: false, empty: true, decimalHours: null, totalMinutes: null };
  }

  const raw = String(value).trim().replace(',', '.');
  const match = raw.match(/^(\d{1,2})(?:([.:])(\d{1,2}))?$/);
  if (!match) return { valid: false, empty: false, decimalHours: null, totalMinutes: null };

  const hours = Number(match[1]);
  const minutes = match[3] === undefined ? 0 : Number(match[3]);
  const totalMinutes = hours * 60 + minutes;

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes > 59 || totalMinutes > 24 * 60) {
    return { valid: false, empty: false, decimalHours: null, totalMinutes: null };
  }

  return {
    valid: true,
    empty: false,
    totalMinutes,
    decimalHours: Math.round((totalMinutes / 60) * 10000) / 10000,
  };
};

export const normalizeDurationTyping = (value) => {
  if (value === '' || value === null || value === undefined) return '';
  const raw = String(value).replace(',', '.');
  if (!/^\d{0,2}(?:[.:]\d{0,2})?$/.test(raw)) return null;
  return raw;
};

export const decimalHoursToDurationInput = (value) => {
  const decimal = Number(value);
  if (!Number.isFinite(decimal) || decimal < 0) return '';
  const totalMinutes = Math.round(decimal * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? String(hours) : `${hours}.${String(minutes).padStart(2, '0')}`;
};

export const formatHours = (value) => {
  if (value === '' || value === null || value === undefined || Number.isNaN(Number(value))) return '';
  const totalMinutes = Math.round(Number(value) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
};
