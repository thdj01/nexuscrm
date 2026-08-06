import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const normaliseRange = (from, to) => {
  if (!from && !to) return { from: '', to: '' };
  const start = dayjs(from || to);
  const end = dayjs(to || from);

  if (!start.isValid() || !end.isValid()) return { from: '', to: '' };

  return start.isAfter(end, 'day')
    ? { from: end.format('YYYY-MM-DD'), to: start.format('YYYY-MM-DD') }
    : { from: start.format('YYYY-MM-DD'), to: end.format('YYYY-MM-DD') };
};

export const getCurrentWeekRange = (referenceDate = dayjs()) => {
  const date = dayjs(referenceDate);
  const daysSinceMonday = (date.day() + 6) % 7;
  const monday = date.subtract(daysSinceMonday, 'day').startOf('day');

  return {
    from: monday.format('YYYY-MM-DD'),
    to: monday.add(6, 'day').format('YYYY-MM-DD'),
  };
};

export const formatTimesheetDateRange = (from, to) => {
  const range = normaliseRange(from, to);
  if (!range.from || !range.to) return 'Select date';

  const start = dayjs(range.from);
  const end = dayjs(range.to);

  if (start.isSame(end, 'day')) {
    return start.format('DD MMM YYYY');
  }

  if (start.isSame(end, 'year')) {
    if (start.isSame(end, 'month')) {
      return `${start.format('DD')} – ${end.format('DD MMM YYYY')}`;
    }
    return `${start.format('DD MMM')} – ${end.format('DD MMM YYYY')}`;
  }

  return `${start.format('DD MMM YYYY')} – ${end.format('DD MMM YYYY')}`;
};

const DateRangeCalendarPicker = ({
  from,
  to,
  onChange,
  className = '',
}) => {
  const wrapperRef = useRef(null);
  const selectedRange = useMemo(() => normaliseRange(from, to), [from, to]);

  const [open, setOpen] = useState(false);
  const [cursorMonth, setCursorMonth] = useState(() => (
    dayjs(selectedRange.from || undefined).startOf('month')
  ));
  const [rangeStart, setRangeStart] = useState(null);

  useEffect(() => {
    if (!open) return undefined;

    const handleOutsideClick = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
        setRangeStart(null);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setRangeStart(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const source = selectedRange.from || selectedRange.to;
    if (source) setCursorMonth(dayjs(source).startOf('month'));
  }, [open, selectedRange.from, selectedRange.to]);

  const calendarDays = useMemo(() => {
    const monthStart = cursorMonth.startOf('month');
    const mondayBasedOffset = (monthStart.day() + 6) % 7;
    const gridStart = monthStart.subtract(mondayBasedOffset, 'day');

    return Array.from({ length: 42 }, (_, index) => gridStart.add(index, 'day'));
  }, [cursorMonth]);

  const handleDateClick = (date) => {
    const selectedDate = date.format('YYYY-MM-DD');

    if (!rangeStart) {
      setRangeStart(selectedDate);
      onChange?.({ from: selectedDate, to: selectedDate });
      return;
    }

    const completedRange = normaliseRange(rangeStart, selectedDate);
    onChange?.(completedRange);
    setRangeStart(null);
    setOpen(false);
  };

  const chooseCurrentWeek = () => {
    const currentWeek = getCurrentWeekRange();
    onChange?.(currentWeek);
    setCursorMonth(dayjs(currentWeek.from).startOf('month'));
    setRangeStart(null);
    setOpen(false);
  };

  const selectionStart = rangeStart || selectedRange.from;
  const selectionEnd = rangeStart || selectedRange.to;

  return (
    <div ref={wrapperRef} className={`relative w-full lg:w-auto ${className}`}>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          setRangeStart(null);
        }}
        className="flex h-10 w-full items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2 text-left text-xs text-gray-700 transition-colors hover:border-blue-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 lg:h-9 lg:w-[11.5rem]"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarDays size={14} className="shrink-0 text-blue-600" />
        <span className="min-w-0 flex-1 truncate font-medium">
          {formatTimesheetDateRange(selectedRange.from, selectedRange.to)}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Select timesheet date or date range"
          className="absolute bottom-[calc(100%+0.5rem)] left-0 z-[100] w-[19rem] max-w-[calc(100vw-1rem)] rounded-xl border border-gray-200 bg-white p-2.5 shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setCursorMonth((month) => month.subtract(1, 'month'))}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              aria-label="Previous month"
            >
              <ChevronLeft size={15} />
            </button>

            <p className="text-xs font-semibold text-gray-900">
              {cursorMonth.format('MMMM YYYY')}
            </p>

            <button
              type="button"
              onClick={() => setCursorMonth((month) => month.add(1, 'month'))}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              aria-label="Next month"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {day}
              </div>
            ))}

            {calendarDays.map((date) => {
              const dateValue = date.format('YYYY-MM-DD');
              const isCurrentMonth = date.month() === cursorMonth.month();
              const isToday = date.isSame(dayjs(), 'day');
              const isStart = Boolean(selectionStart) && dateValue === selectionStart;
              const isEnd = Boolean(selectionEnd) && dateValue === selectionEnd;
              const isInRange = Boolean(selectionStart && selectionEnd)
                && !date.isBefore(dayjs(selectionStart), 'day')
                && !date.isAfter(dayjs(selectionEnd), 'day');

              return (
                <button
                  type="button"
                  key={dateValue}
                  onClick={() => handleDateClick(date)}
                  className={`relative flex h-7 items-center justify-center rounded-md text-xs transition-colors ${
                    isStart || isEnd
                      ? 'bg-blue-600 font-semibold text-white hover:bg-blue-700'
                      : isInRange
                        ? 'bg-blue-50 font-medium text-blue-700 hover:bg-blue-100'
                        : isCurrentMonth
                          ? 'text-gray-700 hover:bg-gray-100'
                          : 'text-gray-300 hover:bg-gray-50'
                  } ${isToday && !(isStart || isEnd) ? 'ring-1 ring-inset ring-blue-400' : ''}`}
                  aria-label={date.format('DD MMMM YYYY')}
                >
                  {date.date()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 border-t border-gray-100 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="max-w-[11rem] text-[10px] leading-4 text-gray-500">
                {rangeStart
                  ? 'Select the second date to complete the range.'
                  : 'Click once for one day, or select two dates for a range.'}
              </p>
              <button
                type="button"
                onClick={chooseCurrentWeek}
                className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-100"
              >
                Current week
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangeCalendarPicker;
