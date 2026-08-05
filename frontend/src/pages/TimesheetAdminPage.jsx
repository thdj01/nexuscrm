// ─────────────────────────────────────────────────────────────────────────────
// frontend/src/pages/TimesheetAdminPage.jsx
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useCallback,
  useMemo,
} from 'react';
import { useOutletContext } from 'react-router-dom';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

import { RefreshCw, ShieldAlert, Archive, RotateCcw } from 'lucide-react';

import {
  fetchAnalyticsScope,
  fetchSummary,
  fetchWorkload,
  fetchAllTasks,
  restoreTask,
} from '../api/timesheetService';

import { useAuth }   from '../context/AuthContext';
import { useToast }  from '../context/ToastContext';

import {
  Card,
  CardHeader,
  CardBody,
  Button,
} from '../components/common/FormComponents';

import TimesheetWidgets      from '../components/timesheet/TimesheetWidgets';
import EmployeeWorkloadTable from '../components/timesheet/EmployeeWorkloadTable';


// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmtHours = (h = 0) => {
  if (!h) return '0h';
  const hours = Math.floor(h);
  const mins  = Math.round((h - hours) * 60);
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  return hours > 0 ? `${hours}h` : `${mins}m`;
};

const fmtDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// Recharts custom tooltip
const HoursTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-gray-700 mb-1 truncate max-w-[140px]">{label}</p>
      <p className="text-blue-600 font-bold">{fmtHours(payload[0]?.value)}</p>
    </div>
  );
};

// Bar chart colours — cycles through palette
const BAR_COLORS = [
  '#3b82f6','#8b5cf6','#f59e0b','#10b981','#ef4444',
  '#06b6d4','#f97316','#84cc16','#ec4899','#6366f1',
];

// ─────────────────────────────────────────────────────────────────────────────
// TimesheetAdminPage
// ─────────────────────────────────────────────────────────────────────────────

const TimesheetAdminPage = () => {
  const { isAdmin, isHod, isTeamLead, user } = useAuth();
  const toast             = useToast();
  const outletContext     = useOutletContext();
  const parentFilters     = outletContext?.filters ?? {};

  const {
    filterStatus = '',
    filterTaskType = '',
    filterDepartment = '',
    filterTeam = '',
    filterProject = '',
    filterArchived = 'active',
    filterTaskSource = '',
    filterFrom = '',
    filterTo = '',
  } = parentFilters;

  const canAccessTimesheetAdmin =
    isAdmin ||
    isHod ||
    isTeamLead ||
    user?.role === 'manager';

  // ── Guard — mirrors backend /api/timesheet/admin/* access ────────────────
  // Backend allows admin, hod, team_lead, and treats manager as HOD.
  if (!canAccessTimesheetAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-gray-400">
        <ShieldAlert size={40} className="opacity-40" />
        <p className="text-sm">Admin/HOD/Team Lead access required.</p>
      </div>
    );
  }

  // ── Remote data ───────────────────────────────────────────────────────────
  const [scope,     setScope]     = React.useState({
    scopeLabel: '',
    departments: [],
    employeeCount: 0,
    isCompanyWide: false,
  });
  const [summary,   setSummary]   = React.useState({});
  const [workload,  setWorkload]  = React.useState([]);
  const [allTasks,  setAllTasks]  = React.useState([]);

  const [loadingScope,    setLoadingScope]    = React.useState(true);
  const [loadingSummary,  setLoadingSummary]  = React.useState(true);
  const [loadingWorkload, setLoadingWorkload] = React.useState(true);
  const [loadingTasks,    setLoadingTasks]    = React.useState(true);

  // ── Build filter params from the main Timesheet filter bar ────────────────
  const filterParams = useMemo(() => {
    const p = {};
    if (filterStatus)   p.status   = filterStatus;
    if (filterTaskType) p.taskType = filterTaskType;
    if (filterDepartment) p.departmentId = filterDepartment;
    if (filterTeam)     p.teamId   = filterTeam;
    if (filterProject)  p.project  = filterProject;
    if (filterArchived && filterArchived !== 'active') p.archived = filterArchived;
    if (filterTaskSource) p.taskSource = filterTaskSource;
    if (filterFrom)     p.from     = filterFrom;
    if (filterTo)       p.to       = filterTo;
    return p;
  }, [filterStatus, filterTaskType, filterDepartment, filterTeam, filterProject, filterArchived, filterTaskSource, filterFrom, filterTo]);

  // ── Fetch the exact role/department scope used by the backend ─────────────
  const loadScope = useCallback(async () => {
    setLoadingScope(true);
    try {
      const res = await fetchAnalyticsScope();
      setScope(res.scope ?? {});
    } catch {
      toast.error('Failed to load department scope');
    } finally {
      setLoadingScope(false);
    }
  }, []);

  // ── Fetch summary ─────────────────────────────────────────────────────────
  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await fetchSummary(filterParams);
      setSummary(res.summary ?? {});
    } catch {
      toast.error('Failed to load summary');
    } finally {
      setLoadingSummary(false);
    }
  }, [filterParams]);

  // ── Fetch workload ────────────────────────────────────────────────────────
  const loadWorkload = useCallback(async () => {
    setLoadingWorkload(true);
    try {
      const res = await fetchWorkload(filterParams);
      setWorkload(res.workload ?? []);
    } catch {
      toast.error('Failed to load workload');
    } finally {
      setLoadingWorkload(false);
    }
  }, [filterParams]);

  // ── Fetch all tasks (for project hours chart) ─────────────────────────────
  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const res = await fetchAllTasks({ ...filterParams, limit: 500 });
      setAllTasks(res.tasks ?? []);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoadingTasks(false);
    }
  }, [filterParams]);

  // ── Trigger all fetches when filters change ───────────────────────────────
  React.useEffect(() => {
    loadScope();
    loadSummary();
    loadWorkload();
    loadTasks();
  }, [loadScope, loadSummary, loadWorkload, loadTasks]);

  const handleRefresh = () => {
    loadScope();
    loadSummary();
    loadWorkload();
    loadTasks();
  };


  const handleRestoreTask = async (task) => {
    try {
      await restoreTask(task._id);
      toast.success('Task restored');
      loadTasks();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore task');
    }
  };

  const isLoading = loadingScope || loadingSummary || loadingWorkload;

  const filterSummaryText = useMemo(() => {
    const labels = [];
    if (filterFrom || filterTo) labels.push(`${fmtDate(filterFrom) || 'Start'} – ${fmtDate(filterTo) || 'Today'}`);
    if (filterStatus) labels.push(filterStatus);
    if (filterTaskType) labels.push(filterTaskType);
    if (filterArchived && filterArchived !== 'active') labels.push(filterArchived === 'only' ? 'Archived only' : 'Including archived');
    if (filterTaskSource) labels.push(`${filterTaskSource} source`);
    if (filterDepartment) labels.push('Selected department');
    if (filterTeam) labels.push('Selected team');
    if (filterProject) labels.push('Selected project');
    return labels.length ? labels.join(' · ') : 'Using main timesheet filters';
  }, [filterFrom, filterTo, filterStatus, filterTaskType, filterArchived, filterTaskSource, filterDepartment, filterTeam, filterProject]);

  // ── Chart data — Hours by Employee ────────────────────────────────────────
  const employeeChartData = useMemo(() =>
    workload
      .filter((e) => (e.totalHours || 0) > 0)
      .slice(0, 10)                                  // top 10
      .map((e) => ({
        name:  e.name?.split(' ')[0] ?? 'Unknown',   // first name for brevity
        hours: Math.round((e.totalHours || 0) * 100) / 100,
      })),
  [workload]);

  // ── Chart data — Hours by Project ─────────────────────────────────────────
  const projectChartData = useMemo(() => {
    const map = {};
    allTasks.forEach((t) => {
      const key   = t.project?.projectId || 'No Project';
      map[key] = (map[key] || 0) + (t.hours || 0);
    });
    return Object.entries(map)
      .map(([name, hours]) => ({ name, hours: Math.round(hours * 100) / 100 }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);
  }, [allTasks]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="fade-in space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {isAdmin
              ? 'Company Timesheet Analytics'
              : (isHod || user?.role === 'manager')
                ? 'HOD Department Analytics'
                : 'Team Lead Department Analytics'}
          </h2>
          <p className="text-sm text-gray-500">
            {loadingScope
              ? 'Loading department scope…'
              : `${scope.scopeLabel || 'No department assigned'} · ${scope.employeeCount ?? workload.length} user${(scope.employeeCount ?? workload.length) !== 1 ? 's' : ''}`}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {workload.length} employee{workload.length !== 1 ? 's' : ''} with timesheet activity · {filterSummaryText}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-100 transition-colors"
          title="Refresh all"
        >
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Admin page uses the main Timesheet filter bar above. */}

      {/* ── Summary Widgets ── */}
      <TimesheetWidgets
        summary={summary}
        workload={workload}
        loading={loadingSummary}
      />

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">

        {/* Hours by Employee */}
        <Card>
          <CardHeader title="Hours by Employee" subtitle="Top 10 by logged hours" />
          <CardBody>
            {loadingWorkload ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
              </div>
            ) : employeeChartData.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-gray-400">
                No data for selected filters.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={employeeChartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}h`}
                    width={32}
                  />
                  <Tooltip content={<HoursTooltip />} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {employeeChartData.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        {/* Hours by Project */}
        <Card>
          <CardHeader title="Hours by Project" subtitle="Top 10 projects" />
          <CardBody>
            {loadingTasks ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
              </div>
            ) : projectChartData.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-gray-400">
                No project data for selected filters.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={projectChartData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}h`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    width={72}
                  />
                  <Tooltip content={<HoursTooltip />} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="hours" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {projectChartData.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>
      </div>


      {/* ── Task Source / Archive Overview ── */}
      <Card>
        <CardHeader
          title="Timesheet Tasks"
          subtitle={`${allTasks.length} task${allTasks.length !== 1 ? 's' : ''} in current filter`}
        />
        <CardBody>
          {loadingTasks ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            </div>
          ) : allTasks.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">No tasks found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Task</th>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Sync</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allTasks.slice(0, 100).map((task) => {
                    const sourceCls = task.taskSource === 'PROJECT'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-600';
                    const syncCls = task.syncStatus === 'FAILED'
                      ? 'bg-red-100 text-red-700'
                      : task.syncStatus === 'PENDING'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700';

                    return (
                      <tr key={task._id} className={task.isArchived ? 'bg-slate-50 opacity-80' : 'hover:bg-gray-50'}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{task.title}</p>
                          <p className="text-xs text-gray-400">{task.project?.projectId || 'No project'}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{task.employee?.name || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${sourceCls}`}>
                            {task.taskSource || 'USER'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {task.taskSource === 'PROJECT' ? (
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${syncCls}`}>
                              {task.syncStatus || 'SYNCED'}
                            </span>
                          ) : <span className="text-xs text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                              {task.status}
                            </span>
                            {task.isArchived && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                                <Archive size={11} /> Archived
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {task.isArchived ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => handleRestoreTask(task)}
                                className="rounded border border-emerald-200 p-1.5 text-emerald-600 hover:bg-emerald-50"
                                title="Restore"
                              >
                                <RotateCcw size={14} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Active</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Employee Workload Table ── */}
      <Card>
        <CardHeader
          title="Employee Workload"
          subtitle={`${workload.length} employee${workload.length !== 1 ? 's' : ''} · click column headers to sort`}
        />
        <EmployeeWorkloadTable workload={workload} loading={loadingWorkload} />
      </Card>
    </div>
  );
};

export default TimesheetAdminPage;
