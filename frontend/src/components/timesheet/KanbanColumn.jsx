// ─────────────────────────────────────────────────────────────────────────────
// frontend/src/components/timesheet/KanbanColumn.jsx
// ─────────────────────────────────────────────────────────────────────────────
//
// Changes from original:
//   • Accepts `droppableId` prop (used as the useDroppable id).
//     In swimlane mode this will be `"${employeeId}::${status}"`.
//     In classic mode callers may still pass `droppableId={status}` (same behaviour).
//   • `status` prop is still used for header colour/label — no change there.
//   • Everything else is identical.
//
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react';
import { useDroppable }          from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import SortableTaskCard from './SortableTaskCard';

// ── Column colour meta ────────────────────────────────────────────────────────

const COLUMN_META = {
  Backlog:      { color: 'bg-gray-100  text-gray-700',   dot: 'bg-gray-400'   },
  Planned:      { color: 'bg-blue-100  text-blue-700',   dot: 'bg-blue-500'   },
  'In Progress':{ color: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500'  },
  Review:       { color: 'bg-purple-100 text-purple-700',dot: 'bg-purple-500' },
  Completed:    { color: 'bg-green-100 text-green-700',  dot: 'bg-green-500'  },
};

const fmtHours = (h) => {
  if (!h) return null;
  const hours = Math.floor(h);
  const mins  = Math.round((h - hours) * 60);
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0)              return `${hours}h`;
  return `${mins}m`;
};

// ─────────────────────────────────────────────────────────────────────────────
// KanbanColumn
//
// Props:
//   droppableId  {string}    — unique ID for useDroppable; in swimlane mode this
//                              is "${employeeId}::${status}"; in classic mode it
//                              equals status.
//   status       {string}    — one of TASK_STATUSES (used for header/colour only)
//   tasks        {Array}     — tasks for this cell, already sorted
//   activeId     {string|null}
//   onEdit       {Function}
//   canEditTask  {Function}
//   showHeader   {boolean}   — set false to hide the coloured status header
//                              (swimlane mode renders a single shared header row)
// ─────────────────────────────────────────────────────────────────────────────
const KanbanColumn = ({
  droppableId,
  status,
  tasks,
  activeId,
  onEdit,
  canEditTask,
  currentUser = null,
  showHeader = true,
}) => {
  const meta = COLUMN_META[status] || COLUMN_META.Backlog;

  // dnd-kit: make the entire column a drop target using the unique droppableId
  const { setNodeRef, isOver } = useDroppable({
    id:   droppableId,
    data: { status },       // carried through DragEvent so handlers can read status
  });

  // IDs list required by SortableContext
  const itemIds = useMemo(() => tasks.map((t) => t._id), [tasks]);

  const totalHours = tasks.reduce((s, t) => s + (t.hours || 0), 0);
  const hoursStr   = fmtHours(totalHours);

  return (
    <div className="min-w-0 flex flex-col gap-2">
      {/* ── Column header (hidden in swimlane body rows; shown in header row) ── */}
      {showHeader && (
        <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${meta.color}`}>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
            <span className="text-xs font-semibold">{status}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {hoursStr && (
              <span className="text-xs opacity-70">{hoursStr}</span>
            )}
            <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-xs font-bold">
              {tasks.length}
            </span>
          </div>
        </div>
      )}

      {/* ── Droppable + sortable area ── */}
      {/*
        min-h sizing:
          showHeader=true  (classic board)  — 120px so empty columns have visual presence
          showHeader=false (swimlane cell)  — 40px; cells shrink to card height,
                                             only expand on active drag-over
      */}
      <div
        ref={setNodeRef}
        className={`
          flex flex-col gap-2 rounded-lg p-1.5 transition-colors
          ${showHeader ? 'min-h-[120px]' : 'min-h-[40px]'}
          ${isOver ? 'bg-blue-50 ring-2 ring-blue-300 ring-inset' : 'bg-transparent'}
        `}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div
              className={`
                flex flex-1 items-center justify-center rounded-lg
                border-2 border-dashed transition-colors
                text-xs
                ${showHeader ? 'py-8' : 'py-3'}
                ${isOver
                  ? 'border-blue-300 text-blue-400'
                  : showHeader
                    ? 'border-gray-200 text-gray-400'
                    : 'border-transparent text-transparent'
                }
              `}
            >
              {/* Classic mode: show label always. Swimlane: only on active drag-over */}
              {isOver ? 'Drop here' : showHeader ? 'No tasks' : ''}
            </div>
          ) : (
            tasks.map((task) => (
              <SortableTaskCard
                key={task._id}
                task={task}
                onEdit={onEdit}
                isDragging={task._id === activeId}
                canEdit={canEditTask(task)}
                currentUser={currentUser}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
};

export default KanbanColumn;
