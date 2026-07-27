import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Archive,
  RotateCcw,
  Edit2,
} from 'lucide-react';

import { fetchListTasks } from '../../api/timesheetService';
import { useToast }       from '../../context/ToastContext';
import { Card, CardBody } from '../common/FormComponents';
import {
  canEditTask,
  canArchiveTask,
  canRestoreTask,
  isArchiveManager,
} from './timesheetPermissions';

const COLUMN_META = {
  Backlog:       { dot: 'bg-gray-400',   border: 'border-gray-200'   },
  Planned:       { dot: 'bg-blue-500',   border: 'border-blue-200'   },
  'In Progress': { dot: 'bg-amber-500',  border: 'border-amber-200'  },
  Review:        { dot: 'bg-purple-500', border: 'border-purple-200' },
  Completed:     { dot: 'bg-green-500',  border: 'border-green-200'  },
};

const TASK_TYPE_COLORS = {
  Development:   'bg-sky-50    text-sky-700',
  Design:        'bg-pink-50   text-pink-700',
  Meeting:       'bg-orange-50 text-orange-700',
  Review:        'bg-purple-50 text-purple-700',
  Testing:       'bg-yellow-50 text-yellow-700',
  Documentation: 'bg-teal-50   text-teal-700',
  Support:       'bg-red-50    text-red-700',
  Other:         'bg-gray-50   text-gray-600',
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtHours = (h) => {
  if (!h) return null;
  const hours = Math.floor(h);
  const mins  = Math.round((h - hours) * 60);
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0)              return `${hours}h`;
  return `${mins}m`;
};

const SourceBadge = ({ task }) => {
  const project = task?.taskSource === 'PROJECT';
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${project ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
      {project ? 'PROJECT' : 'USER'}
    </span>
  );
};

const ArchivedBadge = () => (
  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">
    <Archive size={11} /> Archived
  </span>
);

const SyncBadge = ({ status }) => {
  if (!status) return null;
  const cls = status === 'SYNCED'
    ? 'bg-emerald-100 text-emerald-700'
    : status === 'FAILED'
      ? 'bg-red-100 text-red-700'
      : 'bg-amber-100 text-amber-700';
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}>{status}</span>;
};

const TaskCard = ({
  task,
  currentUser,
  onEdit,
  onArchive,
  onRestore,
}) => {
  const meta    = COLUMN_META[task.status] || COLUMN_META.Backlog;
  const typeCls = TASK_TYPE_COLORS[task.taskType] || TASK_TYPE_COLORS.Other;
  const manager = isArchiveManager(currentUser);
  const hoursStr = fmtHours(task.hours);

  const editable = canEditTask(task, currentUser);
  const archivable = canArchiveTask(task, currentUser);
  const restorable = canRestoreTask(task, currentUser);

  return (
    <div className={`group relative rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md ${meta.border} ${task.isArchived ? 'bg-slate-50 opacity-80' : 'bg-white'}`}>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <SourceBadge task={task} />
          {task.isArchived && <ArchivedBadge />}
          {manager && task.taskSource === 'PROJECT' && <SyncBadge status={task.syncStatus} />}
          <span className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium ${typeCls}`}>
            {task.taskType}
          </span>
        </div>

        {hoursStr && (
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-gray-600">
            <Clock size={11} />
            {hoursStr}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onEdit?.(task)}
        className="block w-full text-left"
      >
        <p className="line-clamp-2 text-sm font-semibold text-gray-800">{task.title}</p>
        {task.description && (
          <p className="mt-1 line-clamp-2 text-xs text-gray-500">{task.description}</p>
        )}
        {task.employeeRemarks && (
          <p className="mt-1 line-clamp-2 text-xs text-blue-600">💬 {task.employeeRemarks}</p>
        )}
      </button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          <span className="text-xs text-gray-400">{fmtDate(task.date)}</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {task.project?.projectId && (
            <span className="truncate max-w-[90px] rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-600">
              {task.project.projectId}
            </span>
          )}
          {editable && !task.isArchived && (
            <button
              type="button"
              onClick={() => onEdit?.(task)}
              className="rounded border border-gray-200 p-1 text-gray-500 hover:bg-gray-50"
              title="Edit"
            >
              <Edit2 size={13} />
            </button>
          )}
          {archivable && (
            <button
              type="button"
              onClick={() => onArchive?.(task)}
              className="rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
              title="Archive"
            >
              <Archive size={13} />
            </button>
          )}
          {restorable && (
            <button
              type="button"
              onClick={() => onRestore?.(task)}
              className="rounded border border-emerald-200 p-1 text-emerald-600 hover:bg-emerald-50"
              title="Restore"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const TimesheetListView = () => {
  const toast = useToast();
  const {
    filters,
    refreshKey,
    onEdit,
      onArchive,
    onRestore,
      currentUser,
  } = useOutletContext();

  const {
    filterStatus,
    filterTaskType,
    filterFrom,
    filterTo,
    filterTeam,
    filterProject,
    filterArchived,
    filterTaskSource,
  } = filters;

  const [tasks,      setTasks]      = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 50 });
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterTaskType, filterFrom, filterTo, filterTeam, filterProject, filterArchived, filterTaskSource, refreshKey]);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (filterStatus)     params.status = filterStatus;
      if (filterTaskType)   params.taskType = filterTaskType;
      if (filterFrom)       params.from = filterFrom;
      if (filterTo)         params.to = filterTo;
      if (filterTeam)       params.teamId = filterTeam;
      if (filterProject)    params.project = filterProject;
      if (filterArchived)   params.archived = filterArchived;
      if (filterTaskSource) params.taskSource = filterTaskSource;

      const result = await fetchListTasks(params);
      setTasks(result.tasks ?? []);
      setPagination(result.pagination ?? { page: 1, totalPages: 1, total: 0, limit: 50 });
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterTaskType, filterFrom, filterTo, filterTeam, filterProject, filterArchived, filterTaskSource]);

  useEffect(() => { loadTasks(); }, [loadTasks, refreshKey]);

  if (loading) {
    return (
      <Card>
        <CardBody>
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
          </div>
        </CardBody>
      </Card>
    );
  }

  if (!tasks.length) {
    return (
      <Card>
        <CardBody>
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
            <AlertCircle size={32} className="opacity-40" />
            <p className="text-sm">No tasks found for the selected filters.</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard
              key={task._id}
              task={task}
              currentUser={currentUser}
              onEdit={onEdit}
              onArchive={onArchive}
              onRestore={onRestore}
            />
          ))}

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-500">
                {pagination.total} tasks · page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

export default TimesheetListView;
