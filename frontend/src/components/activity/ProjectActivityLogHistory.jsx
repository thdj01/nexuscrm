import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Edit3,
  Inbox,
  MessageSquare,
  PlusCircle,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import API from '../../api/axios';
import { fetchActivityLog, fetchTaskCompletionHistory } from '../../api/projectService';
import ActivityGraph from './ActivityGraph';
import Avatar from '../common/Avatar';

const DEFAULT_FILTERS = {
  dateRange: 'projectTimeline',
  startDate: '',
  endDate: '',
  status: '',
  userId: '',
  actionType: '',
  search: '',
  page: 1,
  limit: 60,
};

const DATE_RANGE_OPTIONS = [
  { value: 'projectTimeline', label: 'Project Timeline' },
  { value: 'today', label: 'Today' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Range' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'not-started', label: 'Not Started' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'delayed', label: 'Delayed' },
];

const ACTION_OPTIONS = [
  { value: '', label: 'All Activity Types' },
  { value: 'created', label: 'Project Created' },
  { value: 'updated', label: 'Project Updated' },
  { value: 'task_created', label: 'Task Created' },
  { value: 'task_updated', label: 'Task Updated' },
  { value: 'task_assigned', label: 'Task Assigned' },
  { value: 'task_completed', label: 'Task Completed' },
  { value: 'task_status_changed', label: 'Task Status Changed' },
  { value: 'deleted', label: 'Deleted' },
];

const ACTION_META = {
  created: { label: 'Created', badge: 'bg-blue-50 text-blue-700 border-blue-100', icon: PlusCircle, dot: 'bg-blue-500' },
  task_created: { label: 'Created', badge: 'bg-blue-50 text-blue-700 border-blue-100', icon: PlusCircle, dot: 'bg-blue-500' },
  updated: { label: 'Updated', badge: 'bg-orange-50 text-orange-700 border-orange-100', icon: Edit3, dot: 'bg-orange-500' },
  task_updated: { label: 'Updated', badge: 'bg-orange-50 text-orange-700 border-orange-100', icon: Edit3, dot: 'bg-orange-500' },
  task_status_changed: { label: 'Updated', badge: 'bg-orange-50 text-orange-700 border-orange-100', icon: Edit3, dot: 'bg-orange-500' },
  task_completed: { label: 'Completed', badge: 'bg-green-50 text-green-700 border-green-100', icon: CheckCircle2, dot: 'bg-green-500' },
  completed: { label: 'Completed', badge: 'bg-green-50 text-green-700 border-green-100', icon: CheckCircle2, dot: 'bg-green-500' },
  deleted: { label: 'Deleted', badge: 'bg-red-50 text-red-700 border-red-100', icon: Trash2, dot: 'bg-red-500' },
  task_deleted: { label: 'Deleted', badge: 'bg-red-50 text-red-700 border-red-100', icon: Trash2, dot: 'bg-red-500' },
  task_assigned: { label: 'Assigned', badge: 'bg-purple-50 text-purple-700 border-purple-100', icon: UserPlus, dot: 'bg-purple-500' },
  assignee_changed: { label: 'Assigned', badge: 'bg-purple-50 text-purple-700 border-purple-100', icon: UserPlus, dot: 'bg-purple-500' },
  whatsapp_sent: { label: 'Sent', badge: 'bg-teal-50 text-teal-700 border-teal-100', icon: Send, dot: 'bg-teal-500' },
  commented: { label: 'Commented', badge: 'bg-slate-50 text-slate-700 border-slate-100', icon: MessageSquare, dot: 'bg-slate-500' },
};

const STATUS_STYLES = {
  'Not Started': { bar: 'bg-slate-400', chip: 'bg-slate-50 border-slate-100 text-slate-700' },
  Pending: { bar: 'bg-yellow-400', chip: 'bg-yellow-50 border-yellow-100 text-yellow-700' },
  Completed: { bar: 'bg-green-500', chip: 'bg-green-50 border-green-100 text-green-700' },
  'In Progress': { bar: 'bg-yellow-400', chip: 'bg-yellow-50 border-yellow-100 text-yellow-700' },
  Delayed: { bar: 'bg-red-500', chip: 'bg-red-50 border-red-100 text-red-700' },
  'Review / Testing': { bar: 'bg-blue-500', chip: 'bg-blue-50 border-blue-100 text-blue-700' },
};

const fieldClass = 'h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

const sameProjectId = (a, b) => String(a || '') === String(b || '');

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const formatDate = (value) => {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatShortDate = (value) => {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const formatDay = (value) => {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit' });
};

const formatWeekday = (value) => {
  const date = toDate(value);
  if (!date) return '';
  return date.toLocaleDateString('en-IN', { weekday: 'short' });
};

const formatMonth = (value) => {
  const date = toDate(value);
  if (!date) return '';
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};

const formatTime = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
};

const formatDateGroup = (value) => {
  const date = toDate(value);
  if (!date) return 'Unknown Date';

  const today = toDate(new Date());
  const yesterday = addDays(today, -1);

  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === yesterday.getTime()) return 'Yesterday';
  return formatDate(date);
};

const normalizeStatus = (task = {}) => {
  const status = task.status || 'Not Started';
  const today = toDate(new Date());
  const endDate = toDate(task.plannedEndDate || task.endDate);
  const delayedEndDate = toDate(task.delayedEndDate);
  const hasExtension = Boolean(
    Number(task.delayDays || 0) > 0 ||
    (delayedEndDate && endDate && delayedEndDate > endDate)
  );

  if (status === 'Completed') return 'Completed';
  if (status === 'Delayed' || hasExtension || (endDate && today && endDate < today)) return 'Delayed';
  if (status === 'In Progress') return 'In Progress';
  if (/test|review/i.test(task.taskName || '')) return 'Review / Testing';
  return 'Not Started';
};

const getAssigneeName = (assignedTo) => {
  if (!assignedTo) return 'Unassigned';
  if (typeof assignedTo === 'object') return assignedTo.name || assignedTo.email || 'Assigned';
  return 'Assigned';
};

const getAssignee = (task) => {
  const assignedTo = task.assignedTo;
  if (!assignedTo) return null;
  if (typeof assignedTo === 'object') return assignedTo;
  return { _id: assignedTo, name: 'Assigned User' };
};

const flattenTasks = (project = {}) => {
  if (Array.isArray(project.planningGrids) && project.planningGrids.length > 0) {
    return project.planningGrids.flatMap((grid) =>
      (grid.planningTasks || []).map((task, index) => ({
        ...task,
        gridId: task.gridId || grid.gridId || 'A',
        gridName: task.gridName || grid.name || 'Project Planning Grid - A',
        rowKey: `${grid.gridId || 'A'}-${task.taskId || index}`,
      }))
    );
  }

  return (project.planningTasks || []).map((task, index) => ({
    ...task,
    gridId: task.gridId || 'A',
    gridName: task.gridName || 'Project Planning Grid - A',
    rowKey: task.taskId || String(index),
  }));
};

const groupLogsByDate = (logs = []) =>
  logs.reduce((acc, log) => {
    const key = formatDateGroup(log.createdAt || log.timestamp || log.date);
    acc[key] = acc[key] || [];
    acc[key].push(log);
    return acc;
  }, {});

const EmptyState = ({ title = 'No data found', message = 'There is nothing to show for the selected filters.' }) => (
  <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 p-6 text-center">
    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-gray-400 shadow-sm">
      <Inbox size={20} />
    </div>
    <p className="text-sm font-semibold text-gray-700">{title}</p>
    <p className="mt-1 max-w-md text-xs leading-5 text-gray-500">{message}</p>
  </div>
);

const LoadingSkeleton = ({ rows = 4, height = 'h-16' }) => (
  <div className="space-y-3" aria-live="polite" aria-busy="true">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className={`animate-pulse rounded-2xl bg-gray-100 ${height}`} />
    ))}
  </div>
);

const ActivityFilters = ({ filters, onChange, users = [], project, onReset }) => {
  const update = (key, value) => onChange({ ...filters, [key]: value, page: 1 });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
        <SlidersHorizontal size={16} className="text-blue-600" />
        Activity Filters
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <div className="xl:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-500">Project</label>
          <select className={`${fieldClass} w-full`} value={project?._id || ''} disabled aria-label="Current project">
            <option>{project?.projectName || project?.projectId || 'Current Project'}</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Date Range</label>
          <select className={`${fieldClass} w-full`} value={filters.dateRange || 'projectTimeline'} onChange={(e) => update('dateRange', e.target.value)}>
            {DATE_RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
          <select className={`${fieldClass} w-full`} value={filters.status || ''} onChange={(e) => update('status', e.target.value)}>
            {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Assigned User</label>
          <select className={`${fieldClass} w-full`} value={filters.userId || ''} onChange={(e) => update('userId', e.target.value)}>
            <option value="">All Users</option>
            {users.map((user) => (
              <option key={user._id || user.id || user.name} value={user._id || user.id}>{user.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Activity Type</label>
          <select className={`${fieldClass} w-full`} value={filters.actionType || ''} onChange={(e) => update('actionType', e.target.value)}>
            {ACTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      </div>

      {filters.dateRange === 'custom' && (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:w-1/2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">From Date</label>
            <input type="date" className={`${fieldClass} w-full`} value={filters.startDate || ''} onChange={(e) => update('startDate', e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">To Date</label>
            <input type="date" className={`${fieldClass} w-full`} value={filters.endDate || ''} onChange={(e) => update('endDate', e.target.value)} />
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-xl flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filters.search || ''}
            onChange={(e) => update('search', e.target.value)}
            placeholder="Search by task, user, action, or notes..."
            className={`${fieldClass} w-full pl-9`}
          />
        </div>

        <button type="button" onClick={onReset} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50">
          <X size={14} /> Reset
        </button>
      </div>
    </div>
  );
};

const buildSentence = (log) => {
  if (log.description) return log.description;
  const task = log.taskTitle || 'task';
  if (log.actionType === 'task_completed') return `${log.userName || 'User'} completed task: ${task}`;
  if (log.actionType === 'task_assigned') return `${log.userName || 'User'} assigned task${log.newValue ? ` to ${log.newValue}` : ''}`;
  if (log.actionType === 'task_created') return `${log.userName || 'User'} created a new task: ${task}`;
  if (log.fieldChanged && (log.oldValue || log.newValue)) return `${log.fieldChanged} changed from ${log.oldValue || '—'} to ${log.newValue || '—'}`;
  return `${log.userName || 'User'} updated ${task}`;
};

const ActivityLogCard = ({ log }) => {
  const meta = ACTION_META[log.actionType] || ACTION_META.updated;
  const Icon = meta.icon;
  return (
    <article className="group relative rounded-2xl border border-gray-100 bg-white p-3 shadow-sm transition hover:border-blue-100 hover:shadow-md">
      <div className="flex gap-3">
        <div className="relative flex-shrink-0">
          <Avatar
            user={{ name: log.userName || 'System', avatar: log.userAvatar }}
            name={log.userName || 'System'}
            src={log.userAvatar}
            size="md"
            className="ring-1 ring-blue-100"
            fallbackClassName="from-blue-50 to-indigo-50 text-blue-700"
          />
          <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${meta.dot}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">{log.userName || 'System'}</p>
              <p className="mt-0.5 text-sm leading-5 text-gray-600">{buildSentence(log)}</p>
            </div>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.badge}`}>
              <Icon size={12} /> {meta.label}
            </span>
          </div>

          {(log.taskTitle || log.fieldChanged || log.oldValue || log.newValue) && (
            <div className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
              {log.taskTitle && <span className="font-medium text-gray-800">{log.taskTitle}</span>}
              {log.fieldChanged && <span>{log.taskTitle ? ' · ' : ''}{log.fieldChanged}</span>}
              {(log.oldValue || log.newValue) && (
                <span className="block pt-1">
                  <span className="text-red-500 line-through">{log.oldValue || '—'}</span>
                  <span className="mx-1 text-gray-400">→</span>
                  <span className="font-semibold text-green-600">{log.newValue || '—'}</span>
                </span>
              )}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
            <span>{formatTime(log.createdAt || log.timestamp)}</span>
            {log.gridName && <span>• {log.gridName}</span>}
            {log.assignedUserName && <span>• Assigned: {log.assignedUserName}</span>}
          </div>
        </div>
      </div>
    </article>
  );
};

const ProjectActivityLogHistory = ({ project, projectId, compact = false, focusDepartment = '', focusGridId = '' }) => {
  const resolvedProjectId = projectId || project?._id;
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [graphData, setGraphData] = useState([]);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: DEFAULT_FILTERS.limit });
  const [graphLoading, setGraphLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const userOptions = useMemo(() => {
    const map = new Map();
    users.forEach((user) => { if (user?._id) map.set(String(user._id), user); });
    flattenTasks(project).forEach((task) => {
      const user = getAssignee(task);
      if (user?._id) map.set(String(user._id), user);
    });
    logs.forEach((log) => {
      if (log.userId) map.set(String(log.userId), { _id: String(log.userId), name: log.userName || 'User' });
      if (log.assignedUserId) map.set(String(log.assignedUserId), { _id: String(log.assignedUserId), name: log.assignedUserName || 'Assigned User' });
    });
    return Array.from(map.values()).filter((user) => user.name);
  }, [project, users, logs]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await API.get('/users/assignable');
      setUsers(res.data.users || []);
    } catch {
      setUsers([]);
    }
  }, []);

  const buildQuery = useCallback((overrides = {}) => {
    const merged = { ...filters, ...overrides };
    return Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== '' && value !== null && value !== undefined));
  }, [filters]);

  const loadGraph = useCallback(async () => {
    if (!resolvedProjectId) return;
    setGraphLoading(true);
    try {
      const data = await fetchTaskCompletionHistory(
        resolvedProjectId,
        buildQuery({ page: undefined, limit: undefined, actionType: undefined, search: undefined, status: undefined })
      );
      setGraphData(Array.isArray(data) ? data : []);
    } catch {
      setGraphData([]);
    } finally {
      setGraphLoading(false);
    }
  }, [resolvedProjectId, buildQuery]);

  const loadLogs = useCallback(async ({ append = false, nextPage } = {}) => {
    if (!resolvedProjectId) return;
    setLogsLoading(true);
    try {
      const page = nextPage || filters.page || 1;
      const result = await fetchActivityLog(resolvedProjectId, buildQuery({ page }));
      const data = Array.isArray(result.data) ? result.data : [];
      setLogs((prev) => append ? [...prev, ...data] : data);
      setPagination(result.pagination || { page, pages: 1, total: data.length, limit: filters.limit });
    } catch {
      if (!append) setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, [resolvedProjectId, filters.page, filters.limit, buildQuery]);

  const refreshActivity = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadGraph(), loadLogs({ append: false })]);
    setRefreshing(false);
  }, [loadGraph, loadLogs]);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { refreshActivity(); }, [refreshActivity]);

  useEffect(() => {
    const handler = (event) => {
      if (sameProjectId(event.detail?.projectId, resolvedProjectId)) refreshActivity();
    };
    window.addEventListener('project-activity-updated', handler);
    return () => window.removeEventListener('project-activity-updated', handler);
  }, [resolvedProjectId, refreshActivity]);

  const resetFilters = () => setFilters(DEFAULT_FILTERS);
  const groupedLogs = groupLogsByDate(logs);

  const handleLoadMore = () => {
    if (pagination.page >= pagination.pages || logsLoading) return;
    loadLogs({ append: true, nextPage: pagination.page + 1 });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className={`${compact ? 'text-xl' : 'text-2xl'} font-bold tracking-tight text-gray-900`}>Project Activity Log History</h2>
          <p className="mt-1 text-sm text-gray-500">Department-wise and panel-wise expected-versus-actual graphs with the latest activity feed for {project?.projectId || 'this project'}.</p>
        </div>

        <button type="button" onClick={refreshActivity} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50">
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <ActivityGraph
        data={graphData}
        project={project}
        loading={graphLoading}
        focusDepartment={focusDepartment}
        focusGridId={focusGridId}
      />

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Activity size={18} /></span>
              Latest Activity Feed
            </h3>
            <p className="mt-1 text-xs text-gray-500">Who did what, when, and on which task.</p>
          </div>
          <span className="rounded-full bg-gray-50 px-3 py-1 text-xs font-medium text-gray-500">{pagination.total || logs.length} record(s)</span>
        </div>

        {logsLoading && logs.length === 0 ? (
          <LoadingSkeleton rows={5} height="h-20" />
        ) : logs.length === 0 ? (
          <EmptyState title="No activity recorded" message="Task updates and project changes will appear here automatically." />
        ) : (
          <div className="space-y-5">
            {Object.entries(groupedLogs).map(([dateLabel, dateLogs]) => (
              <div key={dateLabel} className="relative">
                <div className="sticky top-0 z-10 mb-3 inline-flex rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 shadow-sm">{dateLabel}</div>
                <div className="relative space-y-3 pl-4 before:absolute before:left-1 before:top-1 before:h-full before:border-l before:border-dashed before:border-gray-200">
                  {dateLogs.map((log) => <ActivityLogCard key={log._id || `${log.createdAt}-${log.description}`} log={log} />)}
                </div>
              </div>
            ))}

            {pagination.page < pagination.pages && (
              <div className="flex justify-center pt-2">
                <button type="button" onClick={handleLoadMore} disabled={logsLoading} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">
                  {logsLoading ? 'Loading…' : 'Load More Activity'}
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default ProjectActivityLogHistory;