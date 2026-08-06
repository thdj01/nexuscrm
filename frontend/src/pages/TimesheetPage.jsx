import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
} from 'react';

import { Outlet, useNavigate, useLocation } from 'react-router-dom';

import {
  Plus,
  RefreshCw,
  X,
  Clock,
  CheckCircle2,
  Circle,
  Timer,
  Kanban,
  List,
  CalendarDays,
  Users,
  Briefcase,
  TrendingUp,
  LayoutGrid,
  SlidersHorizontal,
  BarChart2,
} from 'lucide-react';

import {
  createTask,
  updateTask,
  archiveTask,
  restoreTask,
  fetchAnalyticsScope,
  fetchListTasks,
} from '../api/timesheetService';

import API from '../api/axios';

import { useToast } from '../context/ToastContext';
import { useAuth }  from '../context/AuthContext';

import Modal         from '../components/common/Modal';
import TimesheetForm from '../components/timesheet/TimesheetForm';
import { TASK_STATUSES, TASK_TYPES } from '../components/timesheet/TimesheetForm';
import DateRangeCalendarPicker, {
  getCurrentWeekRange,
} from '../components/timesheet/DateRangeCalendarPicker';

import {
  Button,
  Select,
  Card,
} from '../components/common/FormComponents';

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const fmtHours = (h) => {
  if (h === undefined || h === null) return '—';
  const hours = Math.floor(h);
  const mins  = Math.round((h - hours) * 60);
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0)              return `${hours}h`;
  return `${mins}m`;
};

// ── Stat widget — unchanged signature, used for both rows ─────────────────────
const StatWidget = ({ icon: Icon, label, value, sub, colorClass = 'text-blue-600', bgClass = 'bg-blue-50' }) => (
  <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${bgClass}`}>
      <Icon size={18} className={colorClass} />
    </div>
    <div className="min-w-0">
      <p className="truncate text-xs font-medium text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  </div>
);

const BASE_VIEW_TABS = [
  { path: '/timesheet/list',     icon: List,         label: 'List'     },
  { path: '/timesheet/kanban',   icon: Kanban,       label: 'Kanban'   },
  { path: '/timesheet/calendar', icon: CalendarDays, label: 'Calendar' },
];

const ANALYTICS_TAB = { path: '/timesheet/admin', icon: BarChart2, label: 'Analytics' };

// Roles that can access the analytics/admin dashboard
const ELEVATED_ROLES = new Set(['admin', 'hod', 'team_lead', 'manager']);

const getPageTitle = (role) => {
  if (role === 'admin')                return 'Timesheet Admin';
  if (role === 'hod' || role === 'manager') return 'HOD Timesheet';
  if (role === 'team_lead')            return 'Team Timesheet';
  return 'My Timesheet';
};

// Compact desktop filter controls. Mobile keeps a comfortable touch height.
const CTRL = 'h-10 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 lg:h-9 lg:w-[7.25rem] lg:shrink-0';

const TimesheetPage = () => {
  const toast    = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Role-derived state
  const isElevated = ELEVATED_ROLES.has(user?.role);
  const VIEW_TABS  = isElevated
    ? [...BASE_VIEW_TABS, ANALYTICS_TAB]
    : BASE_VIEW_TABS;
  const pageTitle  = getPageTitle(user?.role);

  // ── Filter state (UNCHANGED) ────────────────────────────────────────────
  const initialWeekRange = useMemo(() => getCurrentWeekRange(), []);

  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterTaskType, setFilterTaskType] = useState('');
  const [filterFrom,     setFilterFrom]     = useState(() => initialWeekRange.from);
  const [filterTo,       setFilterTo]       = useState(() => initialWeekRange.to);
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterTeam,     setFilterTeam]     = useState('');
  const [filterProject,  setFilterProject]  = useState('');
  const [filterArchived, setFilterArchived] = useState('active');
  const [filterTaskSource, setFilterTaskSource] = useState('');

  const [teams,    setTeams]    = useState([]);
  const [projects, setProjects] = useState([]);
  const [analyticsScope, setAnalyticsScope] = useState({
    departments: [],
    employeeCount: 0,
    scopeLabel: '',
  });

  const [stats,        setStats]        = useState({ totalHours: 0, completed: 0, inProgress: 0, pending: 0 });
  const [total,        setTotal]        = useState(0);
  const [statsLoading, setStatsLoading] = useState(false);

  const [addModal,    setAddModal]    = useState(false);
  const [editModal,   setEditModal]   = useState(false);
  const [selected,    setSelected]    = useState(null);
  const [submitting,  setSubmitting]  = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // ── Data fetching (UNCHANGED) ───────────────────────────────────────────
  useEffect(() => {
    if (user?.role === 'employee') return;
    API.get('/teams', { params: { limit: 100 } })
      .then((r) => {
        const list = r.data?.teams ?? r.data ?? [];
        setTeams(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
  }, [user?.role]);

  useEffect(() => {
    API.get('/projects', { params: { limit: 200 } })
      .then((r) => {
        const list = r.data?.projects ?? r.data ?? [];
        setProjects(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isElevated) return;
    fetchAnalyticsScope()
      .then((response) => setAnalyticsScope(response.scope ?? {}))
      .catch(() => {});
  }, [isElevated, refreshKey]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params = { limit: 200 };
      if (filterStatus)   params.status   = filterStatus;
      if (filterTaskType) params.taskType = filterTaskType;
      if (filterFrom)     params.from     = filterFrom;
      if (filterTo)       params.to       = filterTo;
      if (filterDepartment) params.departmentId = filterDepartment;
      if (filterTeam)     params.teamId   = filterTeam;
      if (filterProject)  params.project  = filterProject;
      if (filterArchived && filterArchived !== 'active') params.archived = filterArchived;
      if (filterTaskSource) params.taskSource = filterTaskSource;

      const result = await fetchListTasks(params);
      const tasks  = result.tasks ?? [];

      setTotal(result.pagination?.total ?? tasks.length);
      setStats({
        totalHours: tasks.reduce((s, t) => s + (t.hours || 0), 0),
        completed:  tasks.filter((t) => t.status === 'Completed').length,
        inProgress: tasks.filter((t) => t.status === 'In Progress').length,
        pending:    tasks.filter((t) => ['Backlog', 'Planned'].includes(t.status)).length,
      });
    } catch {
      // non-critical
    } finally {
      setStatsLoading(false);
    }
  }, [filterStatus, filterTaskType, filterFrom, filterTo, filterDepartment, filterTeam, filterProject, filterArchived, filterTaskSource]);

  useEffect(() => { loadStats(); }, [loadStats, refreshKey]);

  // ── Handlers (UNCHANGED) ───────────────────────────────────────────────
  const handleCreate = async (payload) => {
    setSubmitting(true);
    try {
      await createTask(payload);
      toast.success('Task created');
      setAddModal(false);
      triggerRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (payload) => {
    setSubmitting(true);
    try {
      await updateTask(selected._id, payload);
      toast.success('Task updated');
      setEditModal(false);
      setSelected(null);
      triggerRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (task) => {
    if (!task?._id) return;
    if (!window.confirm(`Archive task "${task.title}"?`)) return;
    try {
      await archiveTask(task._id);
      toast.success('Task archived');
      triggerRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to archive task');
    }
  };

  const handleRestore = async (task) => {
    if (!task?._id) return;
    try {
      await restoreTask(task._id);
      toast.success('Task restored');
      triggerRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore task');
    }
  };

  const openEdit   = useCallback((task) => { setSelected(task); setEditModal(true); },   []);

  const isCurrentWeekSelected =
    filterFrom === initialWeekRange.from && filterTo === initialWeekRange.to;

  const clearFilters = () => {
    setFilterStatus('');
    setFilterTaskType('');
    setFilterDepartment('');
    setFilterTeam('');
    setFilterProject('');
    setFilterArchived('active');
    setFilterTaskSource('');
    setFilterFrom(initialWeekRange.from);
    setFilterTo(initialWeekRange.to);
  };

  const handleDateRangeChange = ({ from, to }) => {
    setFilterFrom(from);
    setFilterTo(to);
  };

  const hasActiveFilters =
    filterStatus || filterTaskType || filterDepartment || filterTeam || filterProject ||
    filterArchived !== 'active' || filterTaskSource || !isCurrentWeekSelected;

  const activeFilterCount = [
    filterStatus,
    filterTaskType,
    filterDepartment,
    filterTeam,
    filterProject,
    filterTaskSource,
  ].filter(Boolean).length
    + (filterArchived !== 'active' ? 1 : 0)
    + (!isCurrentWeekSelected ? 1 : 0);

  const activeTab = VIEW_TABS.find((t) =>
    // For Analytics tab, match exactly to avoid /timesheet/admin matching /timesheet
    t.path === '/timesheet/admin'
      ? location.pathname.startsWith('/timesheet/admin')
      : location.pathname.startsWith(t.path)
  )?.path ?? '/timesheet/kanban';

  const outletContext = useMemo(() => ({
    filters: {
      filterStatus,
      filterTaskType,
      filterFrom,
      filterTo,
      filterDepartment,
      filterTeam,
      filterProject,
      filterArchived,
      filterTaskSource,
    },
    refreshKey,
    onEdit:      openEdit,
    onArchive:   handleArchive,
    onRestore:   handleRestore,
    currentUser: user,
  }), [
    filterStatus, filterTaskType, filterFrom, filterTo, filterDepartment, filterTeam, filterProject, filterArchived, filterTaskSource,
    refreshKey, openEdit, user,
  ]);

  // ── Derived stats for second row (no new API calls) ────────────────────
  // Unique employees derived from tasks via assignableUsers not available here,
  // so we count team members from the teams list (best available proxy).
  // Productivity = completed / total * 100, clamped to 0 when total is 0.
  const productivity = total > 0 ? Math.round((stats.completed / total) * 100) : 0;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="fade-in space-y-4 sm:space-y-5">

      {/* ── Page header row ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{pageTitle}</h2>
          <p className="text-sm text-gray-500">
            {total} task{total !== 1 ? 's' : ''} · {fmtDate(filterFrom)} – {fmtDate(filterTo)}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
          <div className="flex w-full overflow-x-auto rounded-lg border border-gray-200 bg-white p-0.5 sm:w-auto">
            {VIEW_TABS.map(({ path, icon: Icon, label }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none ${
                  activeTab === path
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          <Button onClick={() => setAddModal(true)} className="w-full sm:w-auto">
            <Plus size={16} /> Add Task
          </Button>
        </div>
      </div>

      {/* ── Row 1 — task stats (existing) ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatWidget icon={Clock}        label="Total Hours" value={fmtHours(stats.totalHours)} colorClass="text-blue-600"  bgClass="bg-blue-50"  />
        <StatWidget icon={CheckCircle2} label="Completed"   value={stats.completed}            colorClass="text-green-600" bgClass="bg-green-50" sub={`of ${total} tasks`} />
        <StatWidget icon={Timer}        label="In Progress" value={stats.inProgress}           colorClass="text-amber-600" bgClass="bg-amber-50" />
        <StatWidget icon={Circle}       label="Pending"     value={stats.pending}              colorClass="text-gray-500"  bgClass="bg-gray-100" />
      </div>

      {/* ── Row 2 — org stats (derived from already-fetched data) ────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatWidget
          icon={LayoutGrid}
          label={isElevated ? 'Departments' : 'Teams'}
          value={isElevated ? (analyticsScope.departments?.length ?? 0) : teams.length}
          colorClass="text-indigo-600"
          bgClass="bg-indigo-50"
          sub={isElevated
            ? (filterDepartment ? '1 selected' : (analyticsScope.scopeLabel || 'assigned scope'))
            : (filterTeam ? '1 selected' : 'all teams')}
        />
        <StatWidget
          icon={Users}
          label="Employees"
          value={isElevated ? (analyticsScope.employeeCount ?? 0) : '—'}
          colorClass="text-violet-600"
          bgClass="bg-violet-50"
          sub={isElevated ? 'in department scope' : 'team visibility'}
        />
        <StatWidget
          icon={Briefcase}
          label="Projects"
          value={projects.length}
          colorClass="text-cyan-600"
          bgClass="bg-cyan-50"
          sub={filterProject ? '1 selected' : 'total'}
        />
        <StatWidget
          icon={TrendingUp}
          label="Productivity"
          value={`${productivity}%`}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-50"
          sub={`${stats.completed} of ${total} done`}
        />
      </div>

      {/* ── Sticky filter bar ────────────────────────────────────────────── */}
      {/* sticky top-0 works because <main> in MainLayout is the scroll container.
          The Topbar sits outside <main> so it cannot be overlapped. */}
      <div className="z-20 lg:sticky lg:top-0">
        <Card className="rounded-xl shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm"
            >
              <SlidersHorizontal size={15} />
              Filters
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <button
              onClick={triggerRefresh}
              className="rounded-lg p-2.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              title="Refresh"
            >
              <RefreshCw size={15} className={statsLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className={`${mobileFiltersOpen ? 'block' : 'hidden'} lg:block`}>
            <div className="overflow-visible lg:flex lg:items-center lg:gap-1.5 lg:px-3 lg:py-2">
              <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 px-3 py-2.5 sm:grid-cols-2 md:grid-cols-3 lg:flex lg:flex-nowrap lg:items-center lg:gap-1.5 lg:overflow-x-auto lg:px-0 lg:py-0 lg:pb-0.5">

              {/* Calendar date / range filter. Current Monday-Sunday is selected by default. */}
              <DateRangeCalendarPicker
                from={filterFrom}
                to={filterTo}
                onChange={handleDateRangeChange}
              />

              <div className="hidden h-4 w-px shrink-0 bg-gray-200 lg:block" />

              {/* Status */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={CTRL}
              >
                <option value="">All Statuses</option>
                {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* Task type */}
              <select
                value={filterTaskType}
                onChange={(e) => setFilterTaskType(e.target.value)}
                className={CTRL}
              >
                <option value="">All Types</option>
                {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>

              {/* Archive visibility */}
              <select
                value={filterArchived}
                onChange={(e) => setFilterArchived(e.target.value)}
                className={CTRL}
              >
                <option value="active">Active</option>
                <option value="only">Archived</option>
                <option value="include">All</option>
              </select>

              {/* Source */}
              <select
                value={filterTaskSource}
                onChange={(e) => setFilterTaskSource(e.target.value)}
                className={CTRL}
              >
                <option value="">All Sources</option>
                <option value="USER">USER</option>
                <option value="PROJECT">PROJECT</option>
              </select>

              {/* Department — Admin sees all; HOD sees assigned departments;
                  Team Lead sees the single assigned department. */}
              {isElevated && analyticsScope.departments?.length > 0 && (
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className={CTRL}
                >
                  <option value="">All Departments</option>
                  {analyticsScope.departments.map((department) => (
                    <option key={department._id} value={department._id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              )}

              {/* Team */}
              {user?.role !== 'employee' && teams.length > 0 && (
                <select
                  value={filterTeam}
                  onChange={(e) => setFilterTeam(e.target.value)}
                  className={CTRL}
                >
                  <option value="">All Teams</option>
                  {teams.map((t) => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
              )}

              {/* Project */}
              {projects.length > 0 && (
                <select
                  value={filterProject}
                  onChange={(e) => setFilterProject(e.target.value)}
                  className={`${CTRL} lg:w-40`}
                >
                  <option value="">All Projects</option>
                  {projects.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.projectId} – {p.projectName}
                    </option>
                  ))}
                </select>
              )}

              {/* Clear */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex h-10 w-full items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 text-xs font-medium text-red-500 transition-colors hover:bg-red-100 hover:text-red-700 lg:h-9 lg:w-auto lg:shrink-0"
                >
                  <X size={13} /> Clear
                </button>
              )}

              </div>

              {/* Fixed desktop action: stays aligned with the first filter row instead of wrapping below it. */}
              <button
                type="button"
                onClick={triggerRefresh}
                disabled={statsLoading}
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-wait disabled:opacity-70 lg:inline-flex"
                title="Refresh tasks"
                aria-label="Refresh tasks"
              >
                <RefreshCw size={14} className={statsLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* ── View outlet ──────────────────────────────────────────────────── */}
      <Outlet context={outletContext} />

      {/* ── Modals (UNCHANGED) ───────────────────────────────────────────── */}
      <Modal isOpen={addModal} onClose={() => setAddModal(false)} title="Log New Task" size="lg">
        <TimesheetForm
          onSubmit={handleCreate}
          onCancel={() => setAddModal(false)}
          loading={submitting}
        />
      </Modal>

      <Modal
        isOpen={editModal}
        onClose={() => { setEditModal(false); setSelected(null); }}
        title="Edit Task"
        size="lg"
      >
        {selected && (
          <TimesheetForm
            initialData={selected}
            onSubmit={handleUpdate}
            onCancel={() => { setEditModal(false); setSelected(null); }}
            loading={submitting}
          />
        )}
      </Modal>
    </div>
  );
};

export default TimesheetPage;
