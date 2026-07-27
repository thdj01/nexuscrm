import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useOutletContext } from 'react-router-dom';
import { Briefcase, Clock, ListChecks, X } from 'lucide-react';

import FullCalendar      from '@fullcalendar/react';
import dayGridPlugin     from '@fullcalendar/daygrid';
import timeGridPlugin    from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

import { fetchCalendarTasks } from '../../api/timesheetService';
import { useToast }           from '../../context/ToastContext';

const TYPE_COLORS = {
  Development:   { bg: '#e0f2fe', border: '#0ea5e9', text: '#0c4a6e' },
  Design:        { bg: '#fce7f3', border: '#ec4899', text: '#831843' },
  Meeting:       { bg: '#ffedd5', border: '#f97316', text: '#7c2d12' },
  Review:        { bg: '#f3e8ff', border: '#a855f7', text: '#581c87' },
  Testing:       { bg: '#fef9c3', border: '#eab308', text: '#713f12' },
  Documentation: { bg: '#ccfbf1', border: '#14b8a6', text: '#134e4a' },
  Support:       { bg: '#fee2e2', border: '#ef4444', text: '#7f1d1d' },
  Other:         { bg: '#f3f4f6', border: '#9ca3af', text: '#1f2937' },
};

const STATUS_BORDER = {
  Backlog:      '#9ca3af',
  Planned:      '#3b82f6',
  'In Progress':'#f59e0b',
  Review:       '#8b5cf6',
  Completed:    '#22c55e',
};

const toYMD = (date) => new Date(date).toISOString().split('T')[0];

const fmtDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const fmtHours = (value = 0) => {
  if (!value) return '0h';
  const h = Math.floor(value);
  const m = Math.round((value - h) * 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

const initials = (name = '') => {
  const parts = String(name || 'U').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
};

const getEmployeeId = (task) => {
  const employee = task?.employee;
  if (!employee) return 'unassigned';
  if (typeof employee === 'string') return employee;
  return employee._id || employee.id || 'unassigned';
};

const getEmployeeName = (task) => {
  const employee = task?.employee;

  if (!employee) return 'Unassigned';
  if (typeof employee === 'string') return 'Assigned User';

  return employee.name || employee.email || 'Unassigned';
};

const getProjectLabel = (task) => {
  const project = task?.project;
  if (project?.projectId && project?.projectName) return `${project.projectId} — ${project.projectName}`;
  if (project?.projectName) return project.projectName;
  if (project?.projectId) return project.projectId;
  if (task?.sourceProjectId) return task.sourceProjectId;
  return 'No project';
};

const getTaskSourceLabel = (task) =>
  task?.taskSource === 'PROJECT' ? '[PROJECT]' : '[USER]';

const getTaskTimeLabel = (task) => {
  if (task?.startTime && task?.endTime) return `${task.startTime}–${task.endTime}`;
  return 'Full day';
};

const getPrimaryTaskType = (tasks = []) => {
  const counts = {};
  tasks.forEach((task) => {
    const type = task.taskType || 'Other';
    counts[type] = (counts[type] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Other';
};

const sortTasksForList = (tasks = []) =>
  [...tasks].sort((a, b) => {
    const dateDiff = new Date(a.date || 0) - new Date(b.date || 0);
    if (dateDiff !== 0) return dateDiff;
    return String(a.startTime || '').localeCompare(String(b.startTime || ''));
  });

function personDayToEvent(personDay) {
  const colors = TYPE_COLORS[personDay.primaryTaskType] ?? TYPE_COLORS.Other;

  return {
    id:              personDay.id,
    title:           personDay.employeeName,
    start:           personDay.dateStr,
    end:             personDay.dateStr,
    allDay:          true,
    backgroundColor: colors.bg,
    borderColor:     colors.border,
    textColor:       colors.text,
    extendedProps:   { personDay },
  };
}

function PersonDayEventContent({ eventInfo }) {
  const { personDay } = eventInfo.event.extendedProps;
  const colors = TYPE_COLORS[personDay.primaryTaskType] ?? TYPE_COLORS.Other;
  const isMonth = eventInfo.view.type === 'dayGridMonth';
  const taskLabel = `${personDay.taskCount} task${personDay.taskCount !== 1 ? 's' : ''}`;
  const hourLabel = fmtHours(personDay.totalHours);

  if (isMonth) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '1px 6px', overflow: 'hidden', width: '100%', cursor: 'pointer',
      }}>
        <span style={{
          width: '7px', height: '7px', borderRadius: '50%',
          background: colors.border, flexShrink: 0,
        }} />
        <span style={{
          fontSize: '11px', fontWeight: 700, color: colors.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
        }}>
          {personDay.employeeName}
        </span>
        <span style={{ fontSize: '10px', color: colors.text, opacity: 0.72, flexShrink: 0 }}>
          {personDay.taskCount}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      padding: '4px 7px', height: '100%', overflow: 'hidden', cursor: 'pointer',
      borderLeft: `3px solid ${colors.border}`, paddingLeft: '7px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px',
        marginBottom: '3px',
      }}>
        <span style={{
          fontSize: '12px', fontWeight: 800, color: colors.text,
          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        }}>
          {personDay.employeeName}
        </span>
        <span style={{
          fontSize: '10px', fontWeight: 700, background: colors.border,
          color: '#fff', borderRadius: '999px', padding: '1px 6px', flexShrink: 0,
        }}>
          {taskLabel}
        </span>
      </div>
      <div style={{
        fontSize: '11px', fontWeight: 600, color: colors.text, opacity: 0.78,
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
      }}>
        {hourLabel} · click to view task list
      </div>
    </div>
  );
}

const CALENDAR_STYLES = `
  .fc-nexus {
    font-family: inherit;
    --fc-border-color: #e5e7eb;
    --fc-today-bg-color: #eff6ff;
    --fc-highlight-color: #dbeafe;
    --fc-now-indicator-color: #3b82f6;
  }
  .fc-nexus .fc-toolbar { display: none; }
  .fc-nexus .fc-col-header-cell {
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    padding: 8px 0;
  }
  .fc-nexus .fc-col-header-cell-cushion {
    font-size: 12px; font-weight: 600; color: #6b7280; text-decoration: none !important;
  }
  .fc-nexus .fc-daygrid-day-number {
    font-size: 12px; font-weight: 500; color: #374151;
    text-decoration: none !important; padding: 4px 8px;
  }
  .fc-nexus .fc-day-today .fc-daygrid-day-number {
    background: #3b82f6; color: #fff; border-radius: 50%;
    width: 24px; height: 24px; display: flex;
    align-items: center; justify-content: center; padding: 0; margin: 4px 6px;
  }
  .fc-nexus .fc-day-today { background: var(--fc-today-bg-color) !important; }
  /* Week/Day views should only show the all-day task area. */
  .fc-nexus .fc-timegrid-divider,
  .fc-nexus .fc-timegrid-body {
    display: none !important;
  }
  .fc-nexus .fc-timegrid-axis-cushion {
    font-size: 14px;
    color: #111827;
    font-weight: 500;
  }
  .fc-nexus .fc-timegrid-slot { height: 48px; }
  .fc-nexus .fc-timegrid-slot-label { display: none !important; }
  .fc-nexus .fc-timegrid-col-frame {
    min-height: 108px;
  }
  .fc-nexus .fc-timegrid-event-harness {
    margin: 2px 3px;
  }
  .fc-nexus .fc-event {
    border-radius: 6px; border: 1px solid transparent;
    box-shadow: 0 1px 2px rgba(0,0,0,0.06);
    transition: box-shadow 0.15s, transform 0.1s; overflow: hidden;
  }
  .fc-nexus .fc-event:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.12); transform: translateY(-1px); z-index: 10 !important;
  }
  .fc-nexus .fc-daygrid-event { border-radius: 4px; margin: 1px 2px; }
  .fc-nexus .fc-daygrid-event-harness { cursor: pointer; }
  .fc-nexus .fc-now-indicator-line { border-color: #3b82f6; border-width: 2px; }
  .fc-nexus .fc-now-indicator-arrow { border-top-color: #3b82f6; }
  .fc-nexus .fc-scrollgrid { border-color: #e5e7eb; }
  .fc-nexus .fc-more-link { font-size: 11px; color: #6b7280; padding: 0 4px; }
  .fc-nexus .fc-more-link:hover { color: #3b82f6; background: #eff6ff; border-radius: 4px; }
  .fc-nexus .fc-popover {
    border-radius: 10px; border: 1px solid #e5e7eb;
    box-shadow: 0 10px 25px rgba(0,0,0,0.1); overflow: hidden;
  }
  .fc-nexus .fc-popover-header {
    background: #f9fafb; padding: 8px 12px; font-size: 12px; font-weight: 600; color: #374151;
  }
`;

const ChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const VIEWS = [
  { key: 'dayGridMonth', label: 'Month' },
  { key: 'timeGridWeek', label: 'Week'  },
  { key: 'timeGridDay',  label: 'Day'   },
];

const TimesheetCalendarView = () => {
  const toast = useToast();
  const { filters, refreshKey, onEdit } = useOutletContext();
  const {
    filterStatus,
    filterTaskType,
    filterTeam,
    filterProject,
    filterArchived,
    filterTaskSource,
  } = filters;

  const calendarRef = useRef(null);
  const calendarShellRef = useRef(null);
  const popupRef = useRef(null);

  const [tasks,        setTasks]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [currentView,  setCurrentView]  = useState('dayGridMonth');
  const [title,        setTitle]        = useState('');
  const [visibleRange, setVisibleRange] = useState({ start: null, end: null });
  const [selectedPersonDayId, setSelectedPersonDayId] = useState(null);
  const [popupPosition, setPopupPosition] = useState(null);

  useEffect(() => {
    const id = 'fc-nexus-styles';
    if (!document.getElementById(id)) {
      const el = document.createElement('style');
      el.id = id;
      el.textContent = CALENDAR_STYLES;
      document.head.appendChild(el);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    if (!visibleRange.start || !visibleRange.end) return;
    setLoading(true);
    try {
      const params = {
        from: toYMD(visibleRange.start),
        to:   toYMD(visibleRange.end),
      };
      if (filterStatus)   params.status   = filterStatus;
      if (filterTaskType) params.taskType = filterTaskType;
      if (filterTeam)     params.teamId   = filterTeam;
      if (filterProject)  params.project  = filterProject;
      if (filterArchived && filterArchived !== 'active') params.archived = filterArchived;
      if (filterTaskSource) params.taskSource = filterTaskSource;

      const result = await fetchCalendarTasks(params);
      setTasks(result.tasks ?? []);
    } catch {
      toast.error('Failed to load calendar tasks');
    } finally {
      setLoading(false);
    }
  }, [visibleRange, filterStatus, filterTaskType, filterTeam, filterProject, filterArchived, filterTaskSource]);

  useEffect(() => { loadTasks(); }, [loadTasks, refreshKey]);

  const personDayGroups = useMemo(() => {
    const byDayAndPerson = new Map();

    tasks.forEach((task) => {
      const dateStr = toYMD(new Date(task.date));
      const employeeId = getEmployeeId(task);
      const id = `${dateStr}__${employeeId}`;
      const employeeName = getEmployeeName(task);

      if (!byDayAndPerson.has(id)) {
        byDayAndPerson.set(id, {
          id,
          dateStr,
          employeeId,
          employeeName,
          tasks: [],
          taskCount: 0,
          totalHours: 0,
          primaryTaskType: 'Other',
        });
      }

      const group = byDayAndPerson.get(id);
      group.tasks.push(task);
      group.taskCount += 1;
      group.totalHours += Number(task.hours || 0);
    });

    return Array.from(byDayAndPerson.values())
      .map((group) => ({
        ...group,
        tasks: sortTasksForList(group.tasks),
        primaryTaskType: getPrimaryTaskType(group.tasks),
      }))
      .sort((a, b) => {
        const dateDiff = new Date(a.dateStr) - new Date(b.dateStr);
        if (dateDiff !== 0) return dateDiff;
        return a.employeeName.localeCompare(b.employeeName);
      });
  }, [tasks]);

  const events = useMemo(() => personDayGroups.map(personDayToEvent), [personDayGroups]);

  const selectedPersonDay = useMemo(
    () => personDayGroups.find((group) => group.id === selectedPersonDayId) || null,
    [personDayGroups, selectedPersonDayId]
  );

  const closePersonDayPopup = useCallback(() => {
    setSelectedPersonDayId(null);
    setPopupPosition(null);
  }, []);

  useEffect(() => {
    if (selectedPersonDayId && !selectedPersonDay) {
      closePersonDayPopup();
    }
    if (!selectedPersonDay) {
      setPopupPosition(null);
    }
  }, [selectedPersonDayId, selectedPersonDay, closePersonDayPopup]);

  useEffect(() => {
    if (!selectedPersonDayId) return undefined;

    const handleOutsideClick = (event) => {
      if (popupRef.current?.contains(event.target)) return;
      if (event.target?.closest?.('.fc-event')) return;
      closePersonDayPopup();
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') closePersonDayPopup();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [selectedPersonDayId, closePersonDayPopup]);

  const handleDatesSet = useCallback((dateInfo) => {
    closePersonDayPopup();
    setVisibleRange({ start: dateInfo.start, end: dateInfo.end });
    setTitle(dateInfo.view.title);
    setCurrentView(dateInfo.view.type);
  }, [closePersonDayPopup]);

  const handleEventClick = useCallback(({ event, el, jsEvent }) => {
    jsEvent?.preventDefault?.();
    jsEvent?.stopPropagation?.();

    const personDay = event.extendedProps.personDay;
    if (!personDay) return;

    setSelectedPersonDayId((current) => {
      if (current === personDay.id) {
        setPopupPosition(null);
        return null;
      }

      const shellRect = calendarShellRef.current?.getBoundingClientRect();
      const eventRect = el?.getBoundingClientRect?.();
      const dayEl = el?.closest?.('.fc-daygrid-day, .fc-timegrid-col, .fc-timegrid-slot-lane');
      const dayRect = dayEl?.getBoundingClientRect?.() || eventRect;

      if (shellRect && eventRect && dayRect) {
        const popupWidth = 340;
        const estimatedPopupHeight = 315;
        const padding = 8;

        let left = dayRect.left - shellRect.left + padding;
        let top = eventRect.bottom - shellRect.top + 6;

        const maxLeft = Math.max(padding, shellRect.width - popupWidth - padding);
        left = Math.min(Math.max(left, padding), maxLeft);

        if (top + estimatedPopupHeight > shellRect.height) {
          top = Math.max(padding, eventRect.top - shellRect.top - estimatedPopupHeight - 6);
        }

        setPopupPosition({ left, top, width: popupWidth });
      } else {
        setPopupPosition({ left: 16, top: 16, width: 340 });
      }

      return personDay.id;
    });
  }, []);

  const getApi = () => calendarRef.current?.getApi();

  const goToday = () => getApi()?.today();
  const goPrev  = () => getApi()?.prev();
  const goNext  = () => getApi()?.next();
  const goView  = (v) => { getApi()?.changeView(v); setCurrentView(v); };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">

      <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 transition-colors"
            title="Previous"
          >
            <ChevronLeft />
          </button>

          <button
            onClick={goToday}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Today
          </button>

          <button
            onClick={goNext}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 transition-colors"
            title="Next"
          >
            <ChevronRight />
          </button>

          <h3 className="ml-1 text-sm font-semibold text-gray-800 min-w-[180px]">
            {title}
          </h3>

          {loading && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-500" />
          )}
        </div>

        <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {VIEWS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => goView(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                currentView === key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>


      <div ref={calendarShellRef} className="fc-nexus relative">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={currentView}
          headerToolbar={false}
          slotDuration="00:30:00"
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
          scrollTime="08:00:00"
          nowIndicator={true}
          dayMaxEvents={4}
          expandRows={true}
          weekends={true}
          height="auto"
          firstDay={1}
          events={events}
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
          eventContent={(info) => <PersonDayEventContent eventInfo={info} />}
          editable={false}
          selectable={false}
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false,
          }}
        />

        {selectedPersonDay && popupPosition && (
          <div
            ref={popupRef}
            className="absolute z-40 rounded-xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5"
            style={{
              left: popupPosition.left,
              top: popupPosition.top,
              width: popupPosition.width,
              maxWidth: 'calc(100% - 16px)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {initials(selectedPersonDay.employeeName)}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-gray-900">
                    {selectedPersonDay.employeeName}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {fmtDate(selectedPersonDay.dateStr)} · {selectedPersonDay.taskCount} task{selectedPersonDay.taskCount !== 1 ? 's' : ''} · {fmtHours(selectedPersonDay.totalHours)}
                  </p>
                </div>
              </div>
              <button
                onClick={closePersonDayPopup}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                title="Close task list"
                type="button"
              >
                <X size={14} />
              </button>
            </div>

            <div className="max-h-[270px] overflow-y-auto p-2">
              <div className="space-y-2">
                {selectedPersonDay.tasks.map((task) => {
                  const colors = TYPE_COLORS[task.taskType] ?? TYPE_COLORS.Other;
                  const statusColor = STATUS_BORDER[task.status] ?? STATUS_BORDER.Backlog;

                  return (
                    <button
                      key={task._id}
                      onClick={() => {
                        closePersonDayPopup();
                        onEdit(task);
                      }}
                      className="w-full rounded-lg border border-gray-100 bg-gray-50/70 p-2.5 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/40"
                      type="button"
                    >
                      <div className="mb-1.5 flex items-start gap-2">
                        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: statusColor }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-gray-900">{task.title}</p>
                          <p className="truncate text-[11px] text-gray-500">{getProjectLabel(task)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1.5">
                          <Clock size={12} className="text-gray-400" /> {fmtHours(task.hours)}
                        </span>
                        <span className="flex items-center gap-1.5 truncate">
                          <ListChecks size={12} className="shrink-0 text-gray-400" />
                          <span className="truncate">{task.status || '—'}</span>
                        </span>
                        <span className="flex items-center gap-1.5 truncate">
                          <Briefcase size={12} className="shrink-0 text-gray-400" />
                          <span className="truncate">{getTaskTimeLabel(task)}</span>
                        </span>
                        <span
                          className="truncate rounded-full px-1.5 py-0.5 text-center font-semibold"
                          style={{ background: colors.bg, color: colors.text }}
                        >
                          {task.taskType || 'Other'}
                        </span>
                      </div>

                      <p className="mt-1.5 text-[10px] font-semibold text-gray-400">
                        {getTaskSourceLabel(task)} · click to edit
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          {Object.entries(TYPE_COLORS).map(([type, colors]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span style={{ background: colors.border }} className="h-2 w-2 rounded-full shrink-0" />
              <span className="text-[11px] text-gray-500">{type}</span>
            </div>
          ))}
        </div>
        <span className="text-[11px] text-gray-400">
          Calendar shows each person once per day. Click a name to open that person's tasks in a small popup on that day.
        </span>
      </div>
    </div>
  );
};

export default TimesheetCalendarView;
