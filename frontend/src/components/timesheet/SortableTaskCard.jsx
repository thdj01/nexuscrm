// ─────────────────────────────────────────────────────────────────────────────
// frontend/src/components/timesheet/SortableTaskCard.jsx
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Clock, Archive } from 'lucide-react';

// ── Shared colour maps (duplicated from TimesheetPage to keep this component
//    self-contained and importable without coupling to the page) ───────────────

const COLUMN_META = {
  Backlog: { border: 'border-gray-200', dot: 'bg-gray-400' },
  Planned: { border: 'border-blue-200', dot: 'bg-blue-500' },
  'In Progress': { border: 'border-amber-200', dot: 'bg-amber-500' },
  Review: { border: 'border-purple-200', dot: 'bg-purple-500' },
  Completed: { border: 'border-green-200', dot: 'bg-green-500' },
};

const TASK_TYPE_COLORS = {
  Development: 'bg-sky-50    text-sky-700',
  Design: 'bg-pink-50   text-pink-700',
  Meeting: 'bg-orange-50 text-orange-700',
  Review: 'bg-purple-50 text-purple-700',
  Testing: 'bg-yellow-50 text-yellow-700',
  Documentation: 'bg-teal-50   text-teal-700',
  Support: 'bg-red-50    text-red-700',
  Other: 'bg-gray-50   text-gray-600',
};

const fmtDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const getTaskDateLabel = (task) => {
  if (task?.taskSource !== 'PROJECT') return fmtDate(task?.date);
  const start = task?.sourcePlannedStartDate || task?.date;
  const end = task?.sourcePlannedEndDate || start;
  const startLabel = fmtDate(start);
  const endLabel = fmtDate(end);
  return startLabel && endLabel && startLabel !== endLabel
    ? `${startLabel} – ${endLabel}`
    : startLabel;
};

const SourceBadge = ({ task }) => {
  const project = task?.taskSource === 'PROJECT';
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${project ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
      {project ? 'PROJECT' : 'USER'}
    </span>
  );
};

const ArchivedBadge = () => (
  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
    <Archive size={10} /> Archived
  </span>
);

const SyncBadge = ({ status }) => {
  if (!status) return null;
  const cls = status === 'SYNCED'
    ? 'bg-emerald-100 text-emerald-700'
    : status === 'FAILED'
      ? 'bg-red-100 text-red-700'
      : 'bg-amber-100 text-amber-700';
  return <span className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${cls}`}>{status}</span>;
};

const canSeeSyncStatus = (user) => user?.role === 'admin' || user?.role === 'hod';

const fmtHours = (h) => {
  if (!h) return null;
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
};

// ─────────────────────────────────────────────────────────────────────────────
// SortableTaskCard
//
// Props:
//   task     {Object}   — raw task document
//   onEdit   {Function} — called with task
//   isDragging {Boolean} — true when this specific card is being dragged
//                          (passed from KanbanColumn via DragOverlay)
// ─────────────────────────────────────────────────────────────────────────────

const SortableTaskCard = ({
  task,
  onEdit = () => { },
  isDragging = false,
  canEdit = true,
  currentUser = null
}) => {

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isSorting,
  } = useSortable({
    id: task._id,
    data: { task },          // carried through DragEvent so columns can read it
  });

  const meta = COLUMN_META[task.status] || COLUMN_META.Backlog;
  const typeCls = TASK_TYPE_COLORS[task.taskType] || TASK_TYPE_COLORS.Other;
  const hoursStr = fmtHours(task.hours);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isSorting ? transition : undefined,
    // Lift the card visually while dragging
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 999 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      onClick={() => canEdit && onEdit(task)}
      style={style}
      className={`
        group relative rounded-lg border bg-white shadow-sm
        transition-shadow hover:shadow-md
        ${task?.isArchived ? 'opacity-75 bg-slate-50' : ''}
        ${meta.border}
        ${isDragging ? 'cursor-grabbing' : (canEdit ? 'cursor-pointer' : 'cursor-default')}
      `}
    >
      {/* ── Drag handle (touch + mouse) ── */}
      {canEdit && (
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          // onClick={(e) => e.stopPropagation()}
          className="
          absolute left-1.5 top-1/2 -translate-y-1/2
          flex items-center justify-center
          rounded p-1 opacity-0 group-hover:opacity-100
          text-gray-300 hover:text-gray-500
          touch-none select-none
          transition-opacity
        "
          aria-label="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>
      )}

      {/* ── Card body ── */}
      <div className="p-3 pl-5 sm:pl-6">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <SourceBadge task={task} />
          {task?.isArchived && <ArchivedBadge />}
          {canSeeSyncStatus(currentUser) && task?.taskSource === 'PROJECT' && (
            <SyncBadge status={task?.syncStatus} />
          )}
        </div>

        {/* Type + Hours */}
        <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
          <span className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium ${typeCls}`}>
            {task.taskType}
          </span>

          {hoursStr && (
            <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-gray-500">
              <Clock size={10} />
              {hoursStr}
            </span>
          )}
        </div>

        {/* Title */}
        <p className="line-clamp-2 text-sm font-semibold text-gray-800 leading-snug">
          {task.title}
        </p>

        {/* Owner / Assignment Info */}
        <div className="mt-2 space-y-1">
          {task.employee?.name && (
            <div className="text-xs font-medium text-gray-600">
              👤 {task.employee.name}
            </div>
          )}

          {task.createdBy?.name &&
            task.employee?._id &&
            task.createdBy?._id !== task.employee?._id && (
              <div className="text-xs text-blue-600">
                ↗ Assigned by {task.createdBy.name}
              </div>
            )}
        </div>

        {task.employeeRemarks && (
          <p className="mt-1 line-clamp-2 text-xs text-blue-600">
            💬 {task.employeeRemarks}
          </p>
        )}

        {/* Footer */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            <span className="text-xs text-gray-400">{getTaskDateLabel(task)}</span>
          </div>

          {task.project?.projectId && (
            <span className="max-w-full truncate rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-600 sm:max-w-[80px]">
              {task.project.projectId}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SortableTaskCard;
