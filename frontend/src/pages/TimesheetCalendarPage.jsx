// ─────────────────────────────────────────────────────────────────────────────
// frontend/src/pages/TimesheetCalendarPage.jsx
//
// Dependencies (add to package.json if not present):
//   npm install react-big-calendar dayjs
//
// react-big-calendar requires one of its localizers. We use the dayjs localizer.
// CSS must be imported once — done here so this page is self-contained.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';

import { Calendar, dayjsLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import dayjs from 'dayjs';

import { ChevronLeft, ChevronRight, RefreshCw, Calendar as CalendarIcon } from 'lucide-react';

import { fetchTasks, createTask, updateTask } from '../api/timesheetService';
import {
  tasksToEvents,
  rangeToParams,
  slotToDateString,
  slotToTimeString,
  STATUS_COLORS,
} from '../utils/calendarEventMapper';

import Modal         from '../components/common/Modal';
import TimesheetForm from '../components/timesheet/TimesheetForm';
import { useToast }  from '../context/ToastContext';
import { Card }      from '../components/common/FormComponents';

// ─────────────────────────────────────────────────────────────────────────────
// Localizer
// ─────────────────────────────────────────────────────────────────────────────
const localizer = dayjsLocalizer(dayjs);

// ─────────────────────────────────────────────────────────────────────────────
// View options
// ─────────────────────────────────────────────────────────────────────────────
const VIEWS = ['month', 'week', 'day'];

const VIEW_LABELS = { month: 'Month', week: 'Week', day: 'Day' };

// ─────────────────────────────────────────────────────────────────────────────
// Custom Toolbar — replaces RBC's default for a consistent Nexus design
// ─────────────────────────────────────────────────────────────────────────────
const CalendarToolbar = ({ date, view, onNavigate, onView, onRefresh, loading }) => {
  const label = useMemo(() => {
    if (view === 'month') return dayjs(date).format('MMMM YYYY');
    if (view === 'week') {
      const start = dayjs(date).startOf('week');
      const end   = dayjs(date).endOf('week');
      return start.month() === end.month()
        ? `${start.format('MMM D')} – ${end.format('D, YYYY')}`
        : `${start.format('MMM D')} – ${end.format('MMM D, YYYY')}`;
    }
    return dayjs(date).format('dddd, D MMMM YYYY');
  }, [date, view]);

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      {/* Left: nav */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onNavigate('TODAY')}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Today
        </button>
        <button
          onClick={() => onNavigate('PREV')}
          className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => onNavigate('NEXT')}
          className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
        <span className="ml-1 text-base font-semibold text-gray-900">{label}</span>
      </div>

      {/* Right: view switcher + refresh */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => onView(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                view === v
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        <button
          onClick={onRefresh}
          title="Refresh"
          className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Status legend
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_ORDER = ['Backlog', 'Planned', 'In Progress', 'Review', 'Completed'];

const Legend = () => (
  <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-t border-gray-100">
    {STATUS_ORDER.map((s) => {
      const c = STATUS_COLORS[s];
      return (
        <span key={s} className="flex items-center gap-1.5 text-xs text-gray-600">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: c.border }}
          />
          {s}
        </span>
      );
    })}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Custom event component — shown inside each calendar cell
// ─────────────────────────────────────────────────────────────────────────────
const EventComponent = ({ event }) => {
  const task = event.resource;
  return (
    <span className="flex items-center gap-1 truncate leading-tight" title={task.title}>
      {task.hours > 0 && (
        <span className="shrink-0 font-semibold opacity-75">
          {task.hours}h
        </span>
      )}
      <span className="truncate">{task.title}</span>
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TimesheetCalendarPage
// ─────────────────────────────────────────────────────────────────────────────
const TimesheetCalendarPage = () => {
  const toast = useToast();

  // ── State ─────────────────────────────────────────────────────────────────
  const [tasks,      setTasks]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [view, setView]   = useState('month');
  const [date, setDate]   = useState(new Date());

  // Visible date range driven by RBC's onRangeChange
  const [range, setRange] = useState(() => {
    // Initial range: full current month with buffer
    const start = dayjs().startOf('month').subtract(7, 'day').toDate();
    const end   = dayjs().endOf('month').add(7, 'day').toDate();
    return { start, end };
  });

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [editModal,   setEditModal]   = useState(false);
  const [selected,    setSelected]    = useState(null);   // task being edited
  const [prefill,     setPrefill]     = useState(null);   // date/time pre-fill for create

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = rangeToParams(range.start, range.end);
      // Fetch up to 500 — calendar shows all in visible range, no pagination needed
      const result = await fetchTasks({ from, to, limit: 500 });
      setTasks(result.tasks ?? []);
    } catch {
      toast.error('Failed to load calendar tasks');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // ── RBC range change ──────────────────────────────────────────────────────
  // RBC calls onRangeChange with either an array [start, ..., end] (week/day)
  // or an object { start, end } (month).
  const handleRangeChange = useCallback((rbcRange) => {
    if (Array.isArray(rbcRange)) {
      setRange({ start: rbcRange[0], end: rbcRange[rbcRange.length - 1] });
    } else {
      setRange({ start: rbcRange.start, end: rbcRange.end });
    }
  }, []);

  // ── Events memo ───────────────────────────────────────────────────────────
  const events = useMemo(() => tasksToEvents(tasks), [tasks]);

  // ── Slot click → Create ───────────────────────────────────────────────────
  const handleSelectSlot = useCallback(({ start, action }) => {
    // 'click' fires on single-day click; 'select' on range drag
    if (action !== 'click' && action !== 'select') return;
    const dateStr = slotToDateString(start);
    const timeStr = slotToTimeString(start);
    setPrefill({ date: dateStr, startTime: timeStr });
    setCreateModal(true);
  }, []);

  // ── Event click → Edit ────────────────────────────────────────────────────
  const handleSelectEvent = useCallback((event) => {
    setSelected(event.resource);
    setEditModal(true);
  }, []);

  // ── Create submit ─────────────────────────────────────────────────────────
  const handleCreate = async (payload) => {
    setSubmitting(true);
    try {
      await createTask(payload);
      toast.success('Task created');
      setCreateModal(false);
      setPrefill(null);
      loadTasks();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Update submit ─────────────────────────────────────────────────────────
  const handleUpdate = async (payload) => {
    setSubmitting(true);
    try {
      await updateTask(selected._id, payload);
      toast.success('Task updated');
      setEditModal(false);
      setSelected(null);
      loadTasks();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update task');
    } finally {
      setSubmitting(false);
    }
  };

  // ── eventPropGetter — apply per-event inline styles ───────────────────────
  const eventPropGetter = useCallback((event) => ({
    style: event.style,
  }), []);

  // ── Custom toolbar props ──────────────────────────────────────────────────
  // We inject extra props by wrapping the component inside a closure.
  const CustomToolbar = useCallback(
    (tbProps) => (
      <CalendarToolbar
        {...tbProps}
        onRefresh={loadTasks}
        loading={loading}
      />
    ),
    [loadTasks, loading]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="fade-in space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Timesheet Calendar</h2>
          <p className="text-sm text-gray-500">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} in view · click a date to log time
          </p>
        </div>
        <CalendarIcon size={20} className="text-gray-400" />
      </div>

      {/* Calendar card */}
      <Card>
        <div className="p-4">
          {/* Inline RBC overrides — scoped to this card */}
          <style>{`
            .nexus-calendar .rbc-calendar          { font-family: inherit; }
            .nexus-calendar .rbc-header            { padding: 6px 4px; font-size: 12px; font-weight: 600; color: #64748b; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
            .nexus-calendar .rbc-month-view        { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
            .nexus-calendar .rbc-day-bg            { border-color: #f1f5f9; }
            .nexus-calendar .rbc-today             { background-color: #eff6ff; }
            .nexus-calendar .rbc-off-range-bg      { background-color: #f8fafc; }
            .nexus-calendar .rbc-off-range .rbc-button-link { color: #cbd5e1; }
            .nexus-calendar .rbc-event             { padding: 1px 4px; border: none !important; box-shadow: none; }
            .nexus-calendar .rbc-event:focus       { outline: 2px solid #3b82f6; outline-offset: 1px; }
            .nexus-calendar .rbc-selected          { opacity: 0.85; }
            .nexus-calendar .rbc-show-more         { font-size: 11px; color: #3b82f6; font-weight: 500; }
            .nexus-calendar .rbc-time-header-cell  { font-size: 12px; font-weight: 600; color: #64748b; }
            .nexus-calendar .rbc-time-slot         { font-size: 11px; color: #94a3b8; }
            .nexus-calendar .rbc-current-time-indicator { background-color: #3b82f6; }
            .nexus-calendar .rbc-day-slot .rbc-event { border-radius: 4px; }
            .nexus-calendar .rbc-toolbar           { display: none; }
          `}</style>

          <div className="nexus-calendar">
            <CalendarToolbar
              date={date}
              view={view}
              onNavigate={(action) => {
                if (action === 'TODAY') { setDate(new Date()); return; }
                const d = dayjs(date);
                const unit = view === 'month' ? 'month' : view === 'week' ? 'week' : 'day';
                setDate(action === 'PREV' ? d.subtract(1, unit).toDate() : d.add(1, unit).toDate());
              }}
              onView={setView}
              onRefresh={loadTasks}
              loading={loading}
            />

            <Calendar
              localizer={localizer}
              events={events}
              view={view}
              date={date}
              onView={setView}
              onNavigate={setDate}
              onRangeChange={handleRangeChange}
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              eventPropGetter={eventPropGetter}
              selectable
              popup
              showMultiDayTimes
              style={{ height: 640 }}
              components={{
                toolbar:  () => null,  // hidden — we render our own above
                event:    EventComponent,
              }}
              formats={{
                monthHeaderFormat: 'MMMM YYYY',
                dayHeaderFormat:   'dddd, D MMMM',
                dayRangeHeaderFormat: ({ start, end }) =>
                  `${dayjs(start).format('D MMM')} – ${dayjs(end).format('D MMM YYYY')}`,
                timeGutterFormat: 'h A',
                eventTimeRangeFormat: ({ start, end }) =>
                  `${dayjs(start).format('h:mm')}–${dayjs(end).format('h:mm A')}`,
              }}
            />
          </div>
        </div>

        <Legend />
      </Card>

      {/* ── Create Modal ── */}
      <Modal
        isOpen={createModal}
        onClose={() => { setCreateModal(false); setPrefill(null); }}
        title="Log New Task"
        size="lg"
      >
        <TimesheetForm
          initialData={prefill ?? undefined}
          onSubmit={handleCreate}
          onCancel={() => { setCreateModal(false); setPrefill(null); }}
          loading={submitting}
        />
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal
        isOpen={editModal}
        onClose={() => { setEditModal(false); setSelected(null); }}
        title="Edit Task"
        size="lg"
      >
        {selected && (
          <div className="space-y-4">
            <TimesheetForm
              initialData={selected}
              onSubmit={handleUpdate}
              onCancel={() => { setEditModal(false); setSelected(null); }}
              loading={submitting}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TimesheetCalendarPage;
