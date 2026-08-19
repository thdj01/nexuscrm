// backend/utils/timesheetTime.js
// Canonical storage remains 24-hour HH:mm and decimal hours so existing
// sorting, aggregation and persisted data stay backward compatible.
// User/API input additionally accepts 12-hour AM/PM times and H.MM/H:MM
// duration shorthand.

const TIME_24_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const TIME_12_RE = /^(0?[1-9]|1[0-2])(?::([0-5]\d))?\s*(AM|PM)$/i;

const normalizeTimeTo24Hour = (value) => {
  if (value === null || value === undefined) return '';
  const raw = String(value).trim();
  if (!raw) return '';

  const match24 = raw.match(TIME_24_RE);
  if (match24) return `${match24[1]}:${match24[2]}`;

  const match12 = raw.match(TIME_12_RE);
  if (!match12) return null;

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

const timeToMinutes = (value) => {
  const normalized = normalizeTimeTo24Hour(value);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(':').map(Number);
  return hours * 60 + minutes;
};

const formatTime12Hour = (value) => {
  const normalized = normalizeTimeTo24Hour(value);
  if (!normalized) return '';

  const [hours24, minutes] = normalized.split(':').map(Number);
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
};

/**
 * Parse a user-entered duration.
 * Numbers remain decimal-hour values for backward compatibility with existing
 * API clients and already-normalized internal code.
 */
const parseDurationToDecimalHours = (value) => {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || value > 24) return null;
    return Math.round(value * 10000) / 10000;
  }

  const raw = String(value).trim().replace(',', '.');
  if (!raw) return null;

  const match = raw.match(/^(\d{1,2})(?:([.:])(\d{1,2}))?$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = match[3] === undefined ? 0 : Number(match[3]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes > 59) return null;

  const totalMinutes = hours * 60 + minutes;
  if (totalMinutes < 0 || totalMinutes > 24 * 60) return null;

  return Math.round((totalMinutes / 60) * 10000) / 10000;
};

const decimalHoursToDurationInput = (value) => {
  const decimal = Number(value);
  if (!Number.isFinite(decimal) || decimal < 0) return '';
  const totalMinutes = Math.round(decimal * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? String(hours) : `${hours}.${String(minutes).padStart(2, '0')}`;
};

module.exports = {
  TIME_24_RE,
  TIME_12_RE,
  normalizeTimeTo24Hour,
  timeToMinutes,
  formatTime12Hour,
  parseDurationToDecimalHours,
  decimalHoursToDurationInput,
};
