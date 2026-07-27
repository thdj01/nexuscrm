// ─────────────────────────────────────────────────────────────────────────────
// frontend/src/components/timesheet/KanbanBoard.jsx  — Jira-style swimlanes
// ─────────────────────────────────────────────────────────────────────────────
//
// Fixes applied on top of the visual upgrade:
//   1. users prop accepted + passed to groupByEmployee so zero-task lanes appear.
//   2. groupByEmployee seeds from users list first (correct 3-arg version).
//   3. lanes useMemo passes (localTasks, users, currentUser?._id).
//   4. Sticky status header aligned to columns with no hardcoded left offset —
//      uses the same flex layout as the column bodies so labels sit exactly
//      above their columns.
//
// All DnD handlers, persistence, permissions, refs, and effects are UNCHANGED.
//
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { updateKanbanPosition, updateTask } from '../../api/timesheetService';
import { useToast } from '../../context/ToastContext';
import { TASK_STATUSES } from './TimesheetForm';
import KanbanColumn from './KanbanColumn';
import SortableTaskCard from './SortableTaskCard';
import Avatar from '../common/Avatar';
import { canDragTask, isArchiveManager } from './timesheetPermissions';
// import { canDragTask, isArchiveManager } from './timesheetPermissions';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const LANE_SEP = '::';

const COLUMN_META = {
  Backlog:       { color: 'bg-gray-100   text-gray-700',   dot: 'bg-gray-400',   colBg: 'bg-gray-50/70'   },
  Planned:       { color: 'bg-blue-100   text-blue-700',   dot: 'bg-blue-500',   colBg: 'bg-blue-50/60'   },
  'In Progress': { color: 'bg-amber-100  text-amber-700',  dot: 'bg-amber-500',  colBg: 'bg-amber-50/60'  },
  Review:        { color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500', colBg: 'bg-purple-50/60' },
  Completed:     { color: 'bg-green-100  text-green-700',  dot: 'bg-green-500',  colBg: 'bg-green-50/60'  },
};

const dropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0.5' } },
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Compound ID helpers  (UNCHANGED)
// ─────────────────────────────────────────────────────────────────────────────

const makeCellId = (employeeId, status) => `${employeeId}${LANE_SEP}${status}`;

const extractStatus = (id) => {
  if (typeof id === 'string' && id.includes(LANE_SEP)) return id.split(LANE_SEP)[1];
  return null;
};

const extractEmployee = (id) => {
  if (typeof id === 'string' && id.includes(LANE_SEP)) return id.split(LANE_SEP)[0];
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// groupByEmployee
//
// Accepts an explicit `users` list so that employees with 0 tasks still get
// a swimlane (Scenarios A, B, C).
//
// Scenario A — no team filter: TimesheetKanbanView passes the full
//   fetchAssignableUsers() result; every scoped user gets a lane.
// Scenario B/C — team filter active: the backend already scopes
//   fetchAssignableUsers() to that team, so `users` only contains members of
//   the selected team; no extra filtering is required here.
//
// The `tasks` list drives the card counts; it may be further filtered by
// status / project / date without removing any user lanes.
// ─────────────────────────────────────────────────────────────────────────────

const groupByEmployee = (tasks, users = [], currentUserId = null) => {
  const map = new Map();

  // Seed a lane for every user in scope (guarantees zero-task lanes).
  for (const user of users) {
    const id = user?._id?.toString?.() ?? String(user?._id ?? '');
    if (!id) continue;
    map.set(id, {
      employeeId: id,
      name:   user?.name   ?? 'Unknown',
      avatar: user?.avatar ?? '',
      tasks:  [],
    });
  }

  // Populate tasks into their owner's lane.
  // If a task owner is not in the users list (edge case), create a fallback lane.
  for (const task of tasks) {
    const emp = task.employee;
    const id  =
      emp?._id?.toString?.() ??
      emp?.toString?.()      ??
      String(emp ?? '');
    if (!id) continue;

    if (!map.has(id)) {
      map.set(id, {
        employeeId: id,
        name:   emp?.name   ?? 'Unknown',
        avatar: emp?.avatar ?? '',
        tasks:  [],
      });
    }
    map.get(id).tasks.push(task);
  }

  return [...map.values()].sort((a, b) => {
    const aIsCurrent = String(a.employeeId) === String(currentUserId);
    const bIsCurrent = String(b.employeeId) === String(currentUserId);
    if (aIsCurrent && !bIsCurrent) return -1;
    if (!aIsCurrent && bIsCurrent) return  1;
    return a.name.localeCompare(b.name);
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// KanbanBoard
// ─────────────────────────────────────────────────────────────────────────────

const KanbanBoard = ({
  tasks,
  users = [],
  onEdit,
  onChange,
  currentUser,
}) => {
  const [localTasks,     setLocalTasks]     = useState(tasks);
  const [activeTask,     setActiveTask]     = useState(null);
  const [collapsedLanes, setCollapsedLanes] = useState(new Set());
  const { showToast } = useToast();

  // ── Permission helper ───────────────────────────────────────────────────
  const canEditTask = useCallback((task) => canDragTask(task, currentUser), [currentUser]);

  const canMoveTaskToEmployee = useCallback((task) => {
    if (!task || task?.isArchived) return false;
    if (task?.taskSource === 'PROJECT') return isArchiveManager(currentUser);
    return canEditTask(task);
  }, [canEditTask, currentUser]);

  const isMounted          = useRef(true);
  const pendingSave        = useRef(null);
  const dragSourceStatus   = useRef(null);
  const dragSourceEmployee = useRef(null);

  useEffect(() => () => { isMounted.current = false; }, []);
  useEffect(() => { setLocalTasks(tasks); }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Pure helpers  (UNCHANGED) ─────────────────────────────────────────────

  const getTaskId = (task) => task._id ?? task.id;

  const getEmpId = (task) => {
    const emp = task?.employee;
    return emp?._id ?? emp?.toString?.() ?? String(emp ?? '');
  };

  const getColumnTasks = (snapshot, status, employeeId = null) =>
    snapshot
      .filter((t) =>
        t.status === status &&
        (employeeId === null || getEmpId(t) === employeeId)
      )
      .sort((a, b) => (a.kanbanOrder ?? 0) - (b.kanbanOrder ?? 0));

  const findStatusByTaskId = (snapshot, id) => {
    const task = snapshot.find((t) => getTaskId(t) === id);
    return task?.status ?? null;
  };

  const findEmployeeByTaskId = (snapshot, id) => {
    const task = snapshot.find((t) => getTaskId(t) === id);
    return task ? getEmpId(task) : null;
  };

  // ── Grouped lanes ─────────────────────────────────────────────────────────
  // Uses `users` as the canonical lane list so zero-task users always appear.
  const lanes = useMemo(
    () => groupByEmployee(localTasks, users, currentUser?._id),
    [localTasks, users, currentUser?._id]
  );

  // ── Collapse toggle ───────────────────────────────────────────────────────
  const toggleLane = useCallback((employeeId) => {
    setCollapsedLanes((prev) => {
      const next = new Set(prev);
      next.has(employeeId) ? next.delete(employeeId) : next.add(employeeId);
      return next;
    });
  }, []);

  // ── onDragStart  (UNCHANGED) ──────────────────────────────────────────────

  const handleDragStart = useCallback(({ active }) => {
    const task = active.data?.current?.task ?? null;
    if (task?.isArchived || !canEditTask(task)) return;
    dragSourceStatus.current   = task?.status ?? null;
    dragSourceEmployee.current = task ? getEmpId(task) : null;
    setActiveTask((prev) => {
      if (prev && getTaskId(prev) === active.id) return prev;
      return task;
    });
  }, [canEditTask, canMoveTaskToEmployee]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── onDragOver  (UNCHANGED) ───────────────────────────────────────────────

  const handleDragOver = useCallback(({ active, over }) => {
    if (!over || active.id === over.id) return;

    setLocalTasks((prev) => {
      const activeStatus   = findStatusByTaskId(prev, active.id);
      const activeEmployee = findEmployeeByTaskId(prev, active.id);

      let overStatus   = extractStatus(over.id);
      let overEmployee = extractEmployee(over.id);

      if (overStatus === null) {
        overStatus   = findStatusByTaskId(prev, over.id);
        overEmployee = findEmployeeByTaskId(prev, over.id);
      }

      if (!activeStatus || !overStatus) return prev;

      const statusChanged   = activeStatus !== overStatus;
      const employeeChanged = overEmployee && activeEmployee !== overEmployee;

      if (!statusChanged && !employeeChanged) return prev;

      const activeTaskObj = prev.find((t) => getTaskId(t) === active.id);
      if (employeeChanged && activeTaskObj && !canMoveTaskToEmployee(activeTaskObj)) return prev;

      return prev.map((t) => {
        if (getTaskId(t) !== active.id) return t;
        const updated = { ...t };
        if (statusChanged) updated.status = overStatus;
        if (employeeChanged && overEmployee) {
          const overTask = prev.find((x) => getTaskId(x) === over.id);
          updated.employee = overTask?.employee ?? overEmployee;
        }
        return updated;
      });
    });
  }, [canEditTask, canMoveTaskToEmployee]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── onDragEnd  (UNCHANGED) ────────────────────────────────────────────────

  const handleDragEnd = useCallback(
    async ({ active, over }) => {
      setActiveTask(null);
      if (!over) return;

      const activeId = active.id;
      const overId   = over.id;

      setLocalTasks((prev) => {
        const activeStatus   = dragSourceStatus.current   ?? findStatusByTaskId(prev, activeId);
        const activeEmployee = dragSourceEmployee.current ?? findEmployeeByTaskId(prev, activeId);

        let overStatus   = extractStatus(overId);
        let overEmployee = extractEmployee(overId);

        if (overStatus === null) {
          overStatus   = findStatusByTaskId(prev, overId)   ?? activeStatus;
          overEmployee = findEmployeeByTaskId(prev, overId) ?? activeEmployee;
        }

        const isCrossColumn = activeStatus   !== overStatus;
        const isCrossLane   = activeEmployee !== overEmployee;
        const activeTaskObj = prev.find((t) => getTaskId(t) === activeId);

        if (isCrossLane && activeTaskObj && !canMoveTaskToEmployee(activeTaskObj)) {
          return prev;
        }

        if (isCrossColumn || isCrossLane) {
          const srcColumn = prev
            .filter((t) => t.status === activeStatus && getEmpId(t) === activeEmployee && getTaskId(t) !== activeId)
            .sort((a, b) => (a.kanbanOrder ?? 0) - (b.kanbanOrder ?? 0))
            .map((t, i) => ({ ...t, kanbanOrder: i }));

          const destColumn = prev
            .filter((t) => t.status === overStatus && getEmpId(t) === overEmployee)
            .sort((a, b) => (a.kanbanOrder ?? 0) - (b.kanbanOrder ?? 0))
            .map((t, i) => ({ ...t, kanbanOrder: i }));

          const nextTasks = prev.map((t) => {
            const id       = getTaskId(t);
            const fromDest = destColumn.find((d) => getTaskId(d) === id);
            if (fromDest) return fromDest;
            const fromSrc  = srcColumn.find((s)  => getTaskId(s) === id);
            if (fromSrc)  return fromSrc;
            return t;
          });

          const changedTasks = nextTasks.filter((t) => {
            const orig = tasks.find((p) => getTaskId(p) === getTaskId(t));
            return (
              !orig ||
              orig.kanbanOrder !== t.kanbanOrder ||
              orig.status      !== t.status      ||
              getEmpId(orig)   !== getEmpId(t)
            );
          });

          if (changedTasks.length) {
            pendingSave.current = { tasks: changedTasks, snapshot: nextTasks };
          }
          return nextTasks;
        }

        // Same-column, same-lane reorder
        const columnTasks = getColumnTasks(prev, activeStatus, activeEmployee);
        const activeIdx   = columnTasks.findIndex((t) => getTaskId(t) === activeId);
        const overIdx     = columnTasks.findIndex((t) => getTaskId(t) === overId);

        if (activeIdx === -1 || overIdx === -1 || activeIdx === overIdx) return prev;

        const reorderedColumn = arrayMove(columnTasks, activeIdx, overIdx).map(
          (t, i) => ({ ...t, kanbanOrder: i })
        );

        const nextTasks = prev.map((t) => {
          const updated = reorderedColumn.find((r) => getTaskId(r) === getTaskId(t));
          return updated ?? t;
        });

        const changedTasks = nextTasks.filter((t) => {
          const orig = prev.find((p) => getTaskId(p) === getTaskId(t));
          return !orig || orig.kanbanOrder !== t.kanbanOrder || orig.status !== t.status;
        });

        if (changedTasks.length) {
          pendingSave.current = { tasks: changedTasks, snapshot: nextTasks };
        }
        return nextTasks;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canMoveTaskToEmployee]
  );

  // ── Persist effect  (UNCHANGED) ───────────────────────────────────────────

  useEffect(() => {
    if (!pendingSave.current) return;
    const { tasks: tasksToSave, snapshot } = pendingSave.current;
    pendingSave.current = null;

    const persist = async () => {
      try {
        await Promise.all(
          tasksToSave.map((t) => {
            const orig       = tasks.find((p) => getTaskId(p) === getTaskId(t));
            const origEmpId  = orig ? getEmpId(orig) : null;
            const empChanged = origEmpId && origEmpId !== getEmpId(t);

            if (empChanged) {
              const empId = t.employee?._id ?? t.employee;
              return updateTask(getTaskId(t), {
                employee:    empId,
                status:      t.status,
                kanbanOrder: t.kanbanOrder ?? 0,
              });
            }
            return updateKanbanPosition(getTaskId(t), {
              status:      t.status,
              kanbanOrder: t.kanbanOrder ?? 0,
            });
          })
        );

        if (isMounted.current && typeof onChange === 'function') onChange(snapshot);
        dragSourceStatus.current   = null;
        dragSourceEmployee.current = null;
      } catch (err) {
        console.error('Failed to update kanban position:', err);
        if (isMounted.current) {
          showToast('Failed to save task position. Reverting.', 'error');
          setLocalTasks(tasks);
        }
      }
    };

    persist();
  });

  const handleDragCancel = useCallback(() => {
    setActiveTask(null);
    setLocalTasks(tasks);
  }, [tasks]);

  // ── Render ────────────────────────────────────────────────────────────────
  //
  // Layout:
  //   • Sticky status header — 5 flex-1 labels, no left offset, aligned 1:1
  //     with the column bodies inside each card.
  //   • Per-employee card (rounded-xl border shadow-sm) with:
  //       – Gray header bar (collapsible, avatar, name, badge).
  //       – Row of 5 flex-1 column divs, each tinted per COLUMN_META.colBg.
  //   • minWidth on the outer wrapper handles horizontal scroll.
  //   • DnD droppable IDs (makeCellId compound strings) are UNCHANGED.

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="w-full min-w-0 overflow-hidden">
        <div className="space-y-3">

          {/* ── Sticky global status header ─────────────────────────────── */}
          {/* Desktop/tablet-wide view keeps the classic 5-column header. On smaller screens, each status section gets its own header inside the lane. */}
          <div className="sticky top-0 z-20 hidden bg-white pb-1.5 shadow-[0_1px_0_0_#e5e7eb] lg:block">
            <div className="flex items-center gap-0">
              {TASK_STATUSES.map((status, idx) => {
                const meta = COLUMN_META[status] || COLUMN_META.Backlog;
                return (
                  <div
                    key={status}
                    className={`flex-1 min-w-0 px-2 ${idx > 0 ? 'border-l border-transparent' : ''}`}
                  >
                    <div className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 ${meta.color}`}>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
                      <span className="text-xs font-semibold truncate">{status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Empty state ───────────────────────────────────────────────── */}
          {lanes.length === 0 && (
            <div className="py-16 text-center text-sm text-gray-400">
              No tasks found
            </div>
          )}

          {/* ── Per-employee cards ─────────────────────────────────────────── */}
          {lanes.map(({ employeeId, name, avatar }) => {
            const isCollapsed  = collapsedLanes.has(employeeId);
            const empTaskCount = localTasks.filter((t) => getEmpId(t) === employeeId).length;
            return (
              <div
                key={employeeId}
                className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
              >
                {/* ── Employee header ────────────────────────────────────── */}
                <button
                  onClick={() => toggleLane(employeeId)}
                  className={`
                    w-full flex items-center gap-2.5 px-3 py-2.5
                    bg-gray-50 hover:bg-gray-100 transition-colors text-left group
                    ${!isCollapsed ? 'border-b border-gray-200' : ''}
                  `}
                >
                  {/* Chevron */}
                  <span className="text-gray-400 group-hover:text-gray-600 transition-colors shrink-0">
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </span>

                  {/* Avatar */}
                  <Avatar
                    user={{ name, avatar }}
                    name={name}
                    src={avatar}
                    size="xs"
                    className="h-7 w-7 ring-2 ring-white shadow-sm"
                  />

                  {/* Name */}
                  <span className="text-sm font-semibold text-gray-800 truncate">
                    {name}
                  </span>

                  {/* Task count badge */}
                  <span className="ml-1 rounded-full bg-white border border-gray-200 px-2 py-px text-[11px] font-medium text-gray-500 shadow-sm shrink-0">
                    {empTaskCount}
                  </span>
                </button>

                {/* ── Lane columns (hidden when collapsed) ──────────────── */}
                {!isCollapsed && (
                  <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2 lg:flex lg:items-stretch lg:gap-0 lg:p-0">
                    {TASK_STATUSES.map((status, colIdx) => {
                      const cellId      = makeCellId(employeeId, status);
                      const meta        = COLUMN_META[status] || COLUMN_META.Backlog;
                      const columnTasks = localTasks
                        .filter((t) => getEmpId(t) === employeeId && t.status === status)
                        .sort((a, b) => (a.kanbanOrder ?? 0) - (b.kanbanOrder ?? 0));

                      return (
                        <div
                          key={cellId}
                          className={`
                            min-w-0 rounded-lg border border-gray-100 p-2 lg:flex-1 lg:rounded-none lg:border-0
                            ${meta.colBg}
                            ${colIdx < TASK_STATUSES.length - 1 ? 'lg:border-r lg:border-gray-200' : ''}
                          `}
                        >
                          <div className={`mb-2 flex items-center justify-between rounded-md px-2.5 py-1.5 lg:hidden ${meta.color}`}>
                            <span className="flex min-w-0 items-center gap-2">
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
                              <span className="truncate text-xs font-semibold">{status}</span>
                            </span>
                            <span className="shrink-0 rounded-full bg-white/60 px-1.5 py-0.5 text-[11px] font-bold">
                              {columnTasks.length}
                            </span>
                          </div>
                          <KanbanColumn
                            droppableId={cellId}
                            status={status}
                            tasks={columnTasks}
                            onEdit={onEdit}
                            activeId={activeTask?._id}
                            canEditTask={canEditTask}
                            currentUser={currentUser}
                            showHeader={false}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

        </div>
      </div>

      {/* ── Drag overlay ghost card ───────────────────────────────────────── */}
      <DragOverlay dropAnimation={dropAnimation}>
        {activeTask ? (
          <SortableTaskCard
            task={activeTask}
            onEdit={onEdit}
            isDragOverlay
            currentUser={currentUser}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanBoard;
