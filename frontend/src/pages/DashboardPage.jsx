import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText,
  TrendingUp,
  CheckCircle,
  XCircle,
  FolderKanban,
  Bell,
  ArrowUpRight,
  AlertTriangle,
  CalendarClock,
  LifeBuoy,
  UserCheck,
  Wrench,
  PauseCircle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import { useNavigate, useSearchParams } from 'react-router-dom';
import API from '../api/axios';
import Spinner from '../components/common/Spinner';
import StatusBadge from '../components/common/StatusBadge';
import { Card, CardHeader, CardBody } from '../components/common/FormComponents';

const COLORS = ['#3b82f6', '#f97316', '#a855f7', '#eab308', '#22c55e', '#ef4444', '#6b7280', '#10b981'];
const DASHBOARD_TABS = ['all', 'inquiry', 'project', 'ticket'];
const ALL_YEARS_VALUE = 'all';
const FINANCIAL_YEAR_STORAGE_KEY = 'dashboardFinancialYear';

const getStoredFinancialYear = () => {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(FINANCIAL_YEAR_STORAGE_KEY) || '';
};

const setStoredFinancialYear = (value) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FINANCIAL_YEAR_STORAGE_KEY, value || '');
};

const getFinancialYearStartYear = (date = new Date()) => (
  date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1
);

const formatFinancialYear = (startYear) => `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;

const getCurrentFinancialYear = () => formatFinancialYear(getFinancialYearStartYear());

const generateFinancialYearOptions = (yearsBack = 2, yearsForward = 2) => {
  const currentStartYear = getFinancialYearStartYear();
  const firstYear = currentStartYear - yearsBack;
  const totalYears = yearsBack + yearsForward + 1;

  return [ALL_YEARS_VALUE, ...Array.from({ length: totalYears }, (_, index) => formatFinancialYear(firstYear + index))];
};

const buildQueryPath = (basePath, params = {}) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((item) => query.append(key, item));
      return;
    }

    if (value !== undefined && value !== null && value !== '') {
      query.set(key, value);
    }
  });

  const queryString = query.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
};

const addFinancialYearToPath = (path, financialYear) => {
  const [pathname, queryString = ''] = path.split('?');
  const query = new URLSearchParams(queryString);

  if (financialYear) {
    query.set('financialYear', financialYear);
  }

  const finalQuery = query.toString();
  return finalQuery ? `${pathname}?${finalQuery}` : pathname;
};

const navigateWithFinancialYear = (navigate, path, financialYear) => {
  navigate(addFinancialYearToPath(path, financialYear));
};

const INQUIRY_PATHS = {
  all: '/inquiries',
  new: buildQueryPath('/inquiries', { status: 'New' }),
  technicalEvaluation: buildQueryPath('/inquiries', { status: 'Technical Evaluation' }),
  commercialBomSubmission: buildQueryPath('/inquiries', { status: 'Commercial BOM Submission' }),
};

const PROJECT_PATHS = {
  all: '/projects',
  won: buildQueryPath('/projects', { projectStatus: 'won' }),
  completed: buildQueryPath('/projects', { projectStatus: 'Completed' }),
  delayed: buildQueryPath('/projects', { riskFilter: 'delayed' }),
  delayedTasks: buildQueryPath('/projects', { riskFilter: 'delayedTasks' }),
  dueToday: buildQueryPath('/projects', { riskFilter: 'dueToday' }),
  dueThisWeek: buildQueryPath('/projects', { riskFilter: 'dueThisWeek' }),
  overdue: buildQueryPath('/projects', { riskFilter: 'overdue' }),
};

const TICKET_PATHS = {
  all: '/tickets',
  open: buildQueryPath('/tickets', { status: ['New', 'Assigned', 'Working', 'Customer Side Pending'] }),
  assigned: buildQueryPath('/tickets', { status: 'Assigned' }),
  working: buildQueryPath('/tickets', { status: 'Working' }),
  customerPending: buildQueryPath('/tickets', { status: 'Customer Side Pending' }),
  closed: buildQueryPath('/tickets', { status: 'Closed' }),
  void: buildQueryPath('/tickets', { status: 'Void' }),
  critical: buildQueryPath('/tickets', { priority: 'Critical' }),
};


const StatCard = ({ label, value, icon: Icon, color, onClick }) => {
  const clickableProps = onClick
    ? {
      role: 'button',
      tabIndex: 0,
      onClick,
      onKeyDown: (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      },
    }
    : {};

  return (
    <div
      {...clickableProps}
      className={`flex min-w-0 items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2.5 shadow-sm transition-all duration-150 sm:p-3 lg:rounded-xl lg:p-4 ${onClick ? 'cursor-pointer hover:shadow-md hover:border-blue-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30' : ''
        }`}
    >
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-[10px] font-medium uppercase leading-tight tracking-wide text-gray-500 sm:text-[11px] lg:mb-1 lg:text-xs">{label}</p>
        <p className="text-lg font-bold leading-none text-gray-900 lg:text-xl">{value}</p>
      </div>
      <div
        className={`ml-2 shrink-0 cursor-default rounded-lg p-2 lg:rounded-xl lg:p-2.5 ${color}`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        title="Icon only"
      >
        <Icon className="h-4 w-4 text-white lg:h-[18px] lg:w-[18px]" />
      </div>
    </div>
  );
};

const SectionHeader = ({ title, subtitle, action }) => (
  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
    </div>
    {action && <div className="flex shrink-0 justify-start sm:justify-end">{action}</div>}
  </div>
);

const EmptyChart = ({ message = 'No chart data available' }) => (
  <div className="flex h-[220px] min-w-0 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 text-center text-sm text-gray-400">
    {message}
  </div>
);

const hasChartData = (data, valueKey = 'value') =>
  Array.isArray(data) && data.some((item) => Number(item?.[valueKey] || 0) > 0);

const useCompactChartLayout = () => {
  const [isCompact, setIsCompact] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  ));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleResize = () => {
      setIsCompact(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isCompact;
};

const DistributionPie = ({ data }) => {
  const isCompact = useCompactChartLayout();

  if (!hasChartData(data)) {
    return <EmptyChart />;
  }

  const total = data?.reduce((sum, item) => sum + Number(item.value || 0), 0) || 1;
  const legendLayout = isCompact ? 'horizontal' : 'vertical';
  const legendAlign = isCompact ? 'center' : 'right';
  const legendVerticalAlign = isCompact ? 'bottom' : 'middle';
  const maxLegendLength = isCompact ? 18 : 28;

  return (
    <div className="h-[285px] min-w-0 sm:h-[230px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={isCompact ? { top: 4, right: 4, bottom: 42, left: 4 } : { top: 4, right: 4, bottom: 4, left: 4 }}>
          <Pie
            data={data || []}
            cx={isCompact ? '50%' : '42%'}
            cy={isCompact ? '43%' : '50%'}
            outerRadius={isCompact ? 58 : 76}
            dataKey="value"
            nameKey="name"
            label={false}
            labelLine={false}
          >
            {(data || []).map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend
            layout={legendLayout}
            align={legendAlign}
            verticalAlign={legendVerticalAlign}
            iconSize={8}
            wrapperStyle={{
              maxWidth: '100%',
              overflow: 'hidden',
              fontSize: 11,
              lineHeight: '16px',
              paddingTop: isCompact ? 6 : 0,
            }}
            formatter={(value, entry) => {
              const percent = ((Number(entry.payload.value || 0) / total) * 100).toFixed(1);
              const label = String(value || '');
              const displayLabel = label.length > maxLegendLength
                ? `${label.slice(0, maxLegendLength - 1)}…`
                : label;

              return (
                <span title={`${label} (${percent}%)`}>
                  {displayLabel} ({percent}%)
                </span>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

const TrendLine = ({ data, dataKey, stroke = '#3b82f6', tooltipFormatter }) => {
  if (!hasChartData(data, dataKey)) {
    return <EmptyChart />;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data || []}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={tooltipFormatter} />
        <Line type="monotone" dataKey={dataKey} stroke={stroke} strokeWidth={2} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
};

const DistributionBar = ({ data, dataKey = 'value' }) => {
  if (!hasChartData(data, dataKey)) {
    return <EmptyChart />;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data || []}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey={dataKey} fill="#3b82f6" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};


const TASK_REMINDER_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'dueToday', label: 'Due today' },
  { key: 'dueIn2Days', label: 'Due in 2 days' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'inProgress', label: 'In progress' },
  { key: 'pending', label: 'Pending' },
];

const formatDate = (value) => {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const filterReminderTask = (task, filter) => {
  const status = String(task?.currentStatus || '').toLowerCase();

  switch (filter) {
    case 'dueToday':
      return task?.bucket === 'due_today';
    case 'dueIn2Days':
      return task?.bucket === 'due_in_2_days';
    case 'overdue':
      return task?.bucket === 'overdue' || task?.isOverdue;
    case 'inProgress':
      return status === 'in progress';
    case 'pending':
      return status === 'pending' || status === 'not started';
    default:
      return true;
  }
};

const reminderCardClass = (task) => {
  if (task?.isOverdue || task?.priority === 'urgent') return 'border-red-200 bg-red-50/70';
  if (task?.bucket === 'due_today') return 'border-amber-200 bg-amber-50/70';
  if (task?.bucket === 'due_in_2_days') return 'border-yellow-200 bg-yellow-50/70';
  return 'border-gray-100 bg-white';
};

const reminderIconClass = (task) => {
  if (task?.isOverdue || task?.priority === 'urgent') return 'bg-red-100 text-red-600';
  if (task?.bucket === 'due_today') return 'bg-amber-100 text-amber-600';
  if (task?.bucket === 'due_in_2_days') return 'bg-yellow-100 text-yellow-700';
  return 'bg-blue-50 text-blue-600';
};

const REMINDER_LOOP_REPEAT_COUNT = 6;
const AUTO_SCROLL_SPEED = 0.045;
const AUTO_SCROLL_TOUCH_RESUME_DELAY = 1200;

const TaskReminderWidget = ({ taskReminders, navigate, className = '' }) => {
  const [activeFilter, setActiveFilter] = useState('all');
  const scrollRef = useRef(null);
  const loopContentRef = useRef(null);
  const pausedRef = useRef(false);
  const hoverPausedRef = useRef(false);
  const interactionPauseTimeoutRef = useRef(null);
  const scrollRemainderRef = useRef(0);
  const items = taskReminders?.items || [];
  const counts = taskReminders?.counts || {};
  const filteredItems = items.filter((task) => filterReminderTask(task, activeFilter));
  const shouldLoop = filteredItems.length > 0;
  const displayGroups = shouldLoop
    ? Array.from({ length: REMINDER_LOOP_REPEAT_COUNT }, () => filteredItems)
    : [filteredItems];
  const filteredItemsKey = filteredItems
    .map((task) => task.id || task._id || task.projectMongoId || task.taskTitle || task.projectName || 'task')
    .join('|');

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    if (interactionPauseTimeoutRef.current) {
      window.clearTimeout(interactionPauseTimeoutRef.current);
      interactionPauseTimeoutRef.current = null;
    }

    scrollEl.scrollTop = 0;
    scrollRemainderRef.current = 0;
    pausedRef.current = false;
    hoverPausedRef.current = false;
  }, [activeFilter]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const contentEl = loopContentRef.current;

    if (!scrollEl || !contentEl || !shouldLoop) return undefined;

    let animationFrame;
    let lastTimestamp = 0;
    let initialized = false;

    const getLoopHeight = () => {
      if (!scrollEl || !contentEl || scrollEl.scrollHeight <= scrollEl.clientHeight + 2) return 0;

      const firstGroup = contentEl.children?.[0];
      const secondGroup = contentEl.children?.[1];

      if (firstGroup && secondGroup) {
        const measuredHeight = secondGroup.offsetTop - firstGroup.offsetTop;
        if (measuredHeight > 0) return measuredHeight;
      }

      return scrollEl.scrollHeight / REMINDER_LOOP_REPEAT_COUNT;
    };

    const normalizePosition = (loopHeight) => {
      if (!loopHeight) return;

      if (scrollEl.scrollTop >= loopHeight * 2) {
        scrollEl.scrollTop -= loopHeight;
      } else if (scrollEl.scrollTop <= 1) {
        scrollEl.scrollTop += loopHeight;
      }
    };

    const step = (timestamp) => {
      if (!lastTimestamp) lastTimestamp = timestamp;

      const elapsed = Math.min(timestamp - lastTimestamp, 64);
      lastTimestamp = timestamp;

      const loopHeight = getLoopHeight();

      if (loopHeight && !initialized) {
        scrollEl.scrollTop = loopHeight;
        initialized = true;
      }

      if (loopHeight && !pausedRef.current) {
        scrollRemainderRef.current += elapsed * AUTO_SCROLL_SPEED;
        const nextStep = Math.floor(scrollRemainderRef.current);

        if (nextStep > 0) {
          scrollEl.scrollTop += nextStep;
          scrollRemainderRef.current -= nextStep;
          normalizePosition(loopHeight);
        }
      }

      animationFrame = window.requestAnimationFrame(step);
    };

    animationFrame = window.requestAnimationFrame(step);

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [shouldLoop, filteredItemsKey]);

  useEffect(() => () => {
    if (interactionPauseTimeoutRef.current) {
      window.clearTimeout(interactionPauseTimeoutRef.current);
    }
  }, []);

  const clearInteractionPauseTimer = () => {
    if (interactionPauseTimeoutRef.current) {
      window.clearTimeout(interactionPauseTimeoutRef.current);
      interactionPauseTimeoutRef.current = null;
    }
  };

  const pauseScroll = () => {
    hoverPausedRef.current = true;
    clearInteractionPauseTimer();
    pausedRef.current = true;
  };

  const resumeScroll = () => {
    hoverPausedRef.current = false;
    clearInteractionPauseTimer();
    pausedRef.current = false;
  };

  const resumeScrollAfterTouch = () => {
    hoverPausedRef.current = false;
    clearInteractionPauseTimer();

    interactionPauseTimeoutRef.current = window.setTimeout(() => {
      interactionPauseTimeoutRef.current = null;
      pausedRef.current = false;
    }, AUTO_SCROLL_TOUCH_RESUME_DELAY);
  };

  const pauseScrollTemporarily = () => {
    pausedRef.current = true;
    clearInteractionPauseTimer();
  };

  return (
    <Card className={`min-w-0 max-w-full overflow-hidden ${className}`}>
      <CardHeader
        title="Task Reminder"
        subtitle="Your assigned project tasks"
        actions={
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            {counts.all || 0} active
          </span>
        }
      />
      <CardBody className="min-w-0 space-y-3">
        <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
          {TASK_REMINDER_FILTERS.map((filter) => {
            const count = counts[filter.key] ?? (filter.key === 'all' ? items.length : 0);
            const active = activeFilter === filter.key;

            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active
                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-700'
                  }`}
              >
                {filter.label}
                <span className={`ml-1 ${active ? 'text-blue-100' : 'text-gray-400'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {filteredItems.length === 0 ? (
          <div className="flex h-[170px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 text-center">
            <CheckCircle size={26} className="mb-2 text-green-500" />
            <p className="text-sm font-semibold text-gray-700">No task reminders</p>
            <p className="mt-1 text-xs text-gray-400">Completed, closed, cancelled, and removed tasks are hidden automatically.</p>
          </div>
        ) : (
          <div
            ref={scrollRef}
            onMouseEnter={pauseScroll}
            onMouseLeave={resumeScroll}
            onTouchStart={pauseScrollTemporarily}
            onTouchMove={pauseScrollTemporarily}
            onTouchEnd={resumeScrollAfterTouch}
            onFocus={pauseScroll}
            onBlur={resumeScroll}
            className="max-h-[240px] min-w-0 overflow-y-auto pr-1"
          >
            <div ref={loopContentRef} className="space-y-2">
              {displayGroups.map((group, groupIndex) => (
                <div key={`reminder-loop-${groupIndex}`} className="space-y-2">
                  {group.map((task, taskIndex) => (
                    <div
                      key={`${task.id || task._id || task.projectMongoId || task.taskTitle || 'task'}-${groupIndex}-${taskIndex}`}
                      className={`min-w-0 rounded-xl border p-3 ${reminderCardClass(task)}`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className={`mt-0.5 shrink-0 rounded-lg p-2 ${reminderIconClass(task)}`}>
                          {task.isOverdue ? <AlertTriangle size={16} /> : <CalendarClock size={16} />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-gray-900">{task.taskTitle}</p>
                              <p className="truncate text-xs text-gray-500">{task.projectName}</p>
                            </div>

                            <StatusBadge status={task.currentStatus} size="xs" />
                          </div>

                          <p className={`mt-2 text-xs font-medium ${task.isOverdue ? 'text-red-700' : 'text-gray-600'}`}>
                            {task.reminderMessage || task.remainingLabel}
                          </p>

                          <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-gray-500 sm:grid-cols-2">
                            <span>Assigned: {task.assignedUser?.name || 'You'}</span>
                            <span>Due: {formatDate(task.dueDate)}</span>
                            {task.projectId && <span>Project ID: {task.projectId}</span>}
                            {task.department && <span>Dept: {task.department}</span>}
                          </div>

                          {task.projectMongoId && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                navigate(`/projects/${task.projectMongoId}`);
                              }}
                              className="mt-2 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                            >
                              View project
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

const getInquiryPanelLabel = (inquiry = {}) => {
  const panelTypes = Array.isArray(inquiry.panelTypes)
    ? inquiry.panelTypes.filter(Boolean)
    : [];

  if (panelTypes.length > 0) {
    return panelTypes.join(', ');
  }

  return inquiry.panelType || inquiry.customPanelType || 'Panel type not set';
};

const getProjectInquiryNumber = (project = {}) => (
  project?.inquiryNumber ||
  project?.inquiryReference?.inquiryId ||
  project?.sourceInquirySnapshot?.inquiryId ||
  ''
);

const InfoPill = ({ children, tone = 'gray' }) => {
  const tones = {
    gray: 'bg-gray-50 text-gray-600 border-gray-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
  };

  return (
    <span className={`inline-flex max-w-full min-w-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tones[tone] || tones.gray}`}>
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
};

const RecentInquiryRows = ({ recent, navigate }) => (
  recent?.recentInquiries?.length > 0 &&
  recent.recentInquiries.map((inq) => (
    <div
      key={inq._id}
      onClick={() => navigate(`/inquiries/${inq._id}`)}
      className="flex w-full min-w-0 cursor-pointer flex-col items-start gap-2 px-3 py-3 transition-colors hover:bg-gray-50 sm:flex-row sm:flex-wrap sm:items-center sm:px-5"
    >
      <div className="w-full min-w-0 sm:min-w-[150px] sm:flex-1">
        <p className="break-words text-sm font-semibold text-gray-800">{inq.customerName || inq.companyName || 'Untitled Inquiry'}</p>
      </div>

      <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 sm:flex-1">
        <InfoPill tone="blue">Inquiry No: {inq.inquiryId || '—'}</InfoPill>
        <InfoPill tone="violet">Panel: {getInquiryPanelLabel(inq)}</InfoPill>
      </div>

      <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 sm:ml-auto sm:w-auto sm:justify-end">
        <StatusBadge status={inq.status} size="xs" />
      </div>
    </div>
  ))
);

const RecentProjectRows = ({ recent, navigate }) => (
  recent?.recentProjects?.length > 0 &&
  recent.recentProjects.map((proj) => {
    const inquiryNo = getProjectInquiryNumber(proj);

    return (
      <div
        key={proj._id}
        onClick={() => navigate(`/projects/${proj._id}`)}
        className="flex w-full min-w-0 cursor-pointer flex-col items-start gap-2 px-3 py-3 transition-colors hover:bg-gray-50 sm:flex-row sm:flex-wrap sm:items-center sm:px-5"
      >
        <div className="w-full min-w-0 sm:min-w-[150px] sm:flex-1">
          <p className="break-words text-sm font-semibold text-gray-800">{proj.projectName || 'Untitled Project'}</p>
        </div>

        <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 sm:flex-1">
          <InfoPill tone="blue">Project No: {proj.projectId || '—'}</InfoPill>
          <InfoPill tone="emerald">Inquiry No: {inquiryNo || '—'}</InfoPill>
        </div>

        <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 sm:ml-auto sm:w-auto sm:justify-end">
          <StatusBadge status={proj.projectStatus} size="xs" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/projects/${proj._id}/activity`);
            }}
            className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 transition-colors hover:border-blue-200 hover:bg-blue-100"
          >
            Activity
          </button>
        </div>
      </div>
    );
  })
);

const RecentListCard = ({ title, emptyMessage, children, className = '' }) => (
  <Card className={`min-w-0 max-w-full overflow-hidden ${className}`}>
    <CardHeader title={title} />
    <div className="w-full min-w-0 divide-y divide-gray-50">{children || <p className="px-4 py-6 text-center text-sm text-gray-400">{emptyMessage}</p>}</div>
  </Card>
);

const FinancialYearDropdown = ({ selectedFinancialYear, financialYearOptions, onFinancialYearChange }) => (
  <label className="flex w-full max-w-[160px] flex-col gap-1 sm:w-auto">
    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Financial Year</span>
    <select
      value={selectedFinancialYear}
      onChange={(event) => onFinancialYearChange(event.target.value)}
      className="min-w-[145px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
    >
      {financialYearOptions.map((year) => (
        <option key={year} value={year}>{year === ALL_YEARS_VALUE ? 'All Years' : year}</option>
      ))}
    </select>
  </label>
);

const DashboardHeader = ({ stats, navigate, financialYear, financialYearOptions, onFinancialYearChange, showSummaryCards }) => (
  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-4">
    {showSummaryCards ? (
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:gap-4">
        <StatCard
          label="Total Inquiries"
          value={stats?.totalInquiries || 0}
          icon={FileText}
          color="bg-blue-600"
          onClick={() => navigateWithFinancialYear(navigate, INQUIRY_PATHS.all, financialYear)}
        />
        <StatCard
          label="Total Projects"
          value={stats?.totalProjects || 0}
          icon={FolderKanban}
          color="bg-emerald-600"
          onClick={() => navigateWithFinancialYear(navigate, PROJECT_PATHS.all, financialYear)}
        />
        <StatCard
          label="Total Tickets"
          value={stats?.totalTickets || 0}
          icon={LifeBuoy}
          color="bg-purple-600"
          onClick={() => navigateWithFinancialYear(navigate, TICKET_PATHS.all, financialYear)}
        />
      </div>
    ) : (
      <div className="hidden lg:block" />
    )}

    <div className="flex items-start justify-start lg:justify-end">
      <FinancialYearDropdown
        selectedFinancialYear={financialYear}
        financialYearOptions={financialYearOptions}
        onFinancialYearChange={onFinancialYearChange}
      />
    </div>
  </div>
);

const INQUIRY_STATUS_CARD_OPTIONS = [
  'New',
  'Technical Evaluation',
  'Technical BoM Submitted',
  'BoM Approval Pending',
  'Revision',
  'Commercial BOM Submission',
  'Order Won',
  'Order Lost',
  'Inquiry Hold',
];

const INQUIRY_STATUS_CARD_COLORS = [
  'bg-indigo-500',
  'bg-orange-500',
  'bg-purple-500',
  'bg-emerald-600',
  'bg-rose-500',
  'bg-sky-500',
  'bg-amber-500',
  'bg-gray-600',
];

const InquiryStatusCards = ({ charts, navigate, financialYear }) => {
  const countsByStatus = new Map(
    (charts?.statusDistribution || [])
      .filter((item) => item?.name)
      .map((item) => [item.name, Number(item.value || 0)])
  );

  const statusItems = INQUIRY_STATUS_CARD_OPTIONS.map((status) => ({
    name: status,
    value: countsByStatus.get(status) || 0,
  }));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 lg:gap-4">
      {statusItems.map((statusItem, index) => (
        <StatCard
          key={statusItem.name}
          label={statusItem.name}
          value={statusItem.value}
          icon={FileText}
          color={INQUIRY_STATUS_CARD_COLORS[index % INQUIRY_STATUS_CARD_COLORS.length]}
          onClick={() => navigateWithFinancialYear(navigate, buildQueryPath('/inquiries', { status: statusItem.name }), financialYear)}
        />
      ))}
    </div>
  );
};

const InquirySection = ({ stats, charts, recent, navigate, taskReminders, showTaskReminder, financialYear, headerAction }) => (
  <section className="space-y-4">
    <SectionHeader
      title="Inquiry Status"
      subtitle={showTaskReminder ? "Inquiry status counts, task reminders, and inquiry-related charts" : "Inquiry status counts and inquiry-related charts"}
      action={headerAction}
    />

    <InquiryStatusCards charts={charts} navigate={navigate} financialYear={financialYear} />

    {stats?.pendingFollowUps > 0 && (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
        <Bell size={18} className="text-amber-600 flex-shrink-0" />
        <p className="text-sm text-amber-800">
          <strong>{stats.pendingFollowUps}</strong> pending follow-up{stats.pendingFollowUps > 1 ? 's' : ''} require your attention.
        </p>
      </div>
    )}

    {showTaskReminder ? (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader title="Inquiry Trend" subtitle={`FY ${financialYear}`} />
          <CardBody className="min-w-0 overflow-hidden">
            <TrendLine data={charts?.inquiryTrend || []} dataKey="inquiries" />
          </CardBody>
        </Card>

        <TaskReminderWidget taskReminders={taskReminders} navigate={navigate} />

        <Card className="min-w-0 overflow-hidden">
          <CardHeader title="Inquiry Status Distribution" />
          <CardBody className="min-w-0 overflow-hidden">
            <DistributionPie data={charts?.statusDistribution || []} />
          </CardBody>
        </Card>

        <RecentListCard title="Recent Inquiries" emptyMessage="No inquiries yet">
          <RecentInquiryRows recent={recent} navigate={navigate} />
        </RecentListCard>
      </div>
    ) : (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader title="Inquiry Trend" subtitle={`FY ${financialYear}`} />
          <CardBody className="min-w-0 overflow-hidden">
            <TrendLine data={charts?.inquiryTrend || []} dataKey="inquiries" />
          </CardBody>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader title="Inquiry Status Distribution" />
          <CardBody className="min-w-0 overflow-hidden">
            <DistributionPie data={charts?.statusDistribution || []} />
          </CardBody>
        </Card>

        <RecentListCard title="Recent Inquiries" emptyMessage="No inquiries yet" className="xl:col-span-2">
          <RecentInquiryRows recent={recent} navigate={navigate} />
        </RecentListCard>
      </div>
    )}
  </section>
);

const ProjectSection = ({ stats, charts, recent, navigate, financialYear, headerAction }) => (
  <section className="space-y-4">
    <SectionHeader title="Recent Projects" subtitle="Project status, delivery risk, and project-related charts" action={headerAction} />

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 lg:gap-4">
      <StatCard
        label="Achieved Project"
        value={stats?.wonProjects || 0}
        icon={CheckCircle}
        color="bg-green-600"
        onClick={() => navigateWithFinancialYear(navigate, PROJECT_PATHS.won, financialYear)}
      />
      <StatCard
        label="Completed Projects"
        value={stats?.completedProjects || 0}
        icon={FolderKanban}
        color="bg-emerald-600"
        onClick={() => navigateWithFinancialYear(navigate, PROJECT_PATHS.completed, financialYear)}
      />
      <StatCard
        label="Delayed Projects"
        value={stats?.delayedProjects || 0}
        icon={AlertTriangle}
        color="bg-red-500"
        onClick={() => navigateWithFinancialYear(navigate, PROJECT_PATHS.delayed, financialYear)}
      />
    </div>

    {(stats?.delayedProjects > 0 || stats?.projectsDueToday > 0) && (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
        <AlertTriangle size={18} className="text-red-600 flex-shrink-0" />
        <p className="text-sm text-red-800">
          <strong>{stats?.delayedProjects || 0}</strong> delayed project(s) requiring attention.
          {stats?.projectsDueToday > 0 && (
            <span> · <strong>{stats.projectsDueToday}</strong> due today.</span>
          )}
        </p>
      </div>
    )}

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 lg:gap-4">
      <StatCard label="Delayed Tasks" value={stats?.delayedTasks || 0} icon={XCircle} color="bg-rose-500" onClick={() => navigateWithFinancialYear(navigate, PROJECT_PATHS.delayedTasks, financialYear)} />
      <StatCard label="Due Today" value={stats?.projectsDueToday || 0} icon={CalendarClock} color="bg-yellow-500" onClick={() => navigateWithFinancialYear(navigate, PROJECT_PATHS.dueToday, financialYear)} />
      <StatCard label="Due This Week" value={stats?.projectsDueThisWeek || 0} icon={CalendarClock} color="bg-amber-500" onClick={() => navigateWithFinancialYear(navigate, PROJECT_PATHS.dueThisWeek, financialYear)} />
      <StatCard label="Overdue Projects" value={stats?.overdueProjects || 0} icon={AlertTriangle} color="bg-red-700" onClick={() => navigateWithFinancialYear(navigate, PROJECT_PATHS.overdue, financialYear)} />
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card className="min-w-0 overflow-hidden">
        <CardHeader title="Project Trend" subtitle={`FY ${financialYear}`} />
        <CardBody className="min-w-0 overflow-hidden">
          <TrendLine data={charts?.projectTrend || []} dataKey="projects" stroke="#10b981" />
        </CardBody>
      </Card>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader title="Project Status Distribution" />
        <CardBody className="min-w-0 overflow-hidden">
          <DistributionPie data={charts?.projectStatusDistribution || []} />
        </CardBody>
      </Card>

      <RecentListCard title="Recent Projects" emptyMessage="No projects yet" className="xl:col-span-2">
        <RecentProjectRows recent={recent} navigate={navigate} />
      </RecentListCard>
    </div>
  </section>
);

const TicketSection = ({ stats, charts, recent, navigate, financialYear, headerAction }) => (
  <section className="space-y-4">
    <SectionHeader title="Recent Tickets" subtitle="Ticket workload, priority, status, and ticket-related charts" action={headerAction} />

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 lg:gap-4">
      <StatCard
        label="Open Tickets"
        value={stats?.openTickets || 0}
        icon={FileText}
        color="bg-indigo-500"
        onClick={() => navigateWithFinancialYear(navigate, TICKET_PATHS.open, financialYear)}
      />
      <StatCard
        label="Assigned Tickets"
        value={stats?.assignedTickets || 0}
        icon={UserCheck}
        color="bg-sky-500"
        onClick={() => navigateWithFinancialYear(navigate, TICKET_PATHS.assigned, financialYear)}
      />
      <StatCard
        label="Working Tickets"
        value={stats?.workingTickets || 0}
        icon={Wrench}
        color="bg-violet-500"
        onClick={() => navigateWithFinancialYear(navigate, TICKET_PATHS.working, financialYear)}
      />
    </div>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 lg:gap-4">
      <StatCard label="Customer Pending" value={stats?.customerPendingTickets || 0} icon={PauseCircle} color="bg-orange-500" onClick={() => navigateWithFinancialYear(navigate, TICKET_PATHS.customerPending, financialYear)} />
      <StatCard label="Closed Tickets" value={stats?.closedTickets || 0} icon={CheckCircle} color="bg-emerald-600" onClick={() => navigateWithFinancialYear(navigate, TICKET_PATHS.closed, financialYear)} />
      <StatCard label="Void Tickets" value={stats?.voidTickets || 0} icon={XCircle} color="bg-gray-600" onClick={() => navigateWithFinancialYear(navigate, TICKET_PATHS.void, financialYear)} />
      <StatCard label="Critical Tickets" value={stats?.criticalTickets || 0} icon={AlertTriangle} color="bg-red-600" onClick={() => navigateWithFinancialYear(navigate, TICKET_PATHS.critical, financialYear)} />
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card className="min-w-0 overflow-hidden">
        <CardHeader title="Ticket Trend" subtitle={`FY ${financialYear}`} />
        <CardBody className="min-w-0 overflow-hidden">
          <TrendLine data={charts?.ticketTrend || []} dataKey="tickets" stroke="#a855f7" />
        </CardBody>
      </Card>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader title="Ticket Status Distribution" />
        <CardBody className="min-w-0 overflow-hidden">
          <DistributionPie data={charts?.ticketStatusDistribution || []} />
        </CardBody>
      </Card>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader title="Ticket Priority Distribution" />
        <CardBody className="min-w-0 overflow-hidden">
          <DistributionBar data={charts?.ticketPriorityDistribution || []} />
        </CardBody>
      </Card>

      <RecentListCard title="Recent Tickets" emptyMessage="No tickets yet">
        {recent?.recentTickets?.length > 0 &&
          recent.recentTickets.map((ticket) => (
            <div
              key={ticket._id}
              onClick={() => navigate(`/tickets/${ticket._id}`)}
              className="flex w-full min-w-0 cursor-pointer flex-col items-start gap-2 px-3 py-3 transition-colors hover:bg-gray-50 sm:flex-row sm:flex-wrap sm:items-center sm:px-5"
            >
              <div className="w-full min-w-0 sm:min-w-[150px] sm:flex-1">
                <p className="break-words text-sm font-semibold text-gray-800">{ticket.title}</p>
              </div>

              <div className="w-full min-w-0 break-words text-xs text-gray-400 sm:min-w-[145px] sm:flex-1">
                <span className="font-semibold text-gray-500">{ticket.ticketId}</span>
                {ticket.customer?.customerName ? <span> · {ticket.customer.customerName}</span> : null}
              </div>

              <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 sm:ml-auto sm:w-auto sm:justify-end">
                <StatusBadge status={ticket.priority} size="xs" />
                <StatusBadge status={ticket.status} size="xs" />
              </div>
            </div>
          ))}
      </RecentListCard>
    </div>
  </section>
);

const DashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [recent, setRecent] = useState(null);
  const [taskReminders, setTaskReminders] = useState({ items: [], counts: {} });
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedFinancialYear, setSelectedFinancialYear] = useState(() => searchParams.get('financialYear') || getStoredFinancialYear() || getCurrentFinancialYear());
  const financialYearOptions = useMemo(() => generateFinancialYearOptions(), []);

  const requestedTab = searchParams.get('dashboardTab') || 'all';
  const activeTab = DASHBOARD_TABS.includes(requestedTab) ? requestedTab : 'all';
  const showInquiry = activeTab === 'all' || activeTab === 'inquiry';
  const showProject = activeTab === 'all' || activeTab === 'project';
  const showTicket = activeTab === 'all' || activeTab === 'ticket';
  const showTaskReminder = activeTab === 'all';

  const handleFinancialYearChange = (value) => {
    setSelectedFinancialYear(value);
    setStoredFinancialYear(value);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('financialYear', value);
    setSearchParams(nextParams, { replace: true });
  };

  useEffect(() => {
    const urlFinancialYear = searchParams.get('financialYear');
    if (urlFinancialYear && urlFinancialYear !== selectedFinancialYear) {
      setSelectedFinancialYear(urlFinancialYear);
      setStoredFinancialYear(urlFinancialYear);
    }
  }, [searchParams, selectedFinancialYear]);

  useEffect(() => {
    let mounted = true;

    const fetchData = async (showLoader = false) => {
      if (showLoader) setLoading(true);

      try {
        const requestConfig = { params: { financialYear: selectedFinancialYear } };
        const [statsRes, recentRes] = await Promise.all([
          API.get('/dashboard/stats', requestConfig),
          API.get('/dashboard/recent', requestConfig),
        ]);

        if (!mounted) return;

        setStats(statsRes.data.data.stats);
        setCharts(statsRes.data.data.charts);
        setTaskReminders(statsRes.data.data.taskReminders || { items: [], counts: {} });
        setRecent(recentRes.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData(true);
    const refreshTimer = setInterval(() => fetchData(false), 60000);

    return () => {
      mounted = false;
      clearInterval(refreshTimer);
    };
  }, [selectedFinancialYear]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const financialYearControl = (
    <FinancialYearDropdown
      selectedFinancialYear={selectedFinancialYear}
      financialYearOptions={financialYearOptions}
      onFinancialYearChange={handleFinancialYearChange}
    />
  );

  const sectionHeaderAction = activeTab === 'all' ? null : financialYearControl;

  return (
    <div className="min-w-0 space-y-8 fade-in">
      {activeTab === 'all' && (
        <DashboardHeader
          stats={stats}
          navigate={navigate}
          financialYear={selectedFinancialYear}
          financialYearOptions={financialYearOptions}
          onFinancialYearChange={handleFinancialYearChange}
          showSummaryCards
        />
      )}

      {showInquiry && (
        <InquirySection
          stats={stats}
          charts={charts}
          recent={recent}
          navigate={navigate}
          taskReminders={taskReminders}
          showTaskReminder={showTaskReminder}
          financialYear={selectedFinancialYear}
          headerAction={sectionHeaderAction}
        />
      )}
      {showProject && (
        <ProjectSection
          stats={stats}
          charts={charts}
          recent={recent}
          navigate={navigate}
          financialYear={selectedFinancialYear}
          headerAction={sectionHeaderAction}
        />
      )}
      {showTicket && (
        <TicketSection
          stats={stats}
          charts={charts}
          recent={recent}
          navigate={navigate}
          financialYear={selectedFinancialYear}
          headerAction={sectionHeaderAction}
        />
      )}
    </div>
  );
};

export default DashboardPage;