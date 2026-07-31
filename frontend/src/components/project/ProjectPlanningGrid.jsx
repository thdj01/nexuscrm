import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Activity, GripVertical, Plus, Trash2, Users } from 'lucide-react';
import { Input, Select } from '../common/FormComponents';
import { fetchPlanningUsers, getProjectId, updatePlanningTaskStatus } from '../../api/projectService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNavigate } from 'react-router-dom';

const TASK_STATUSES = ['Pending', 'In Progress', 'Delay', 'Completed', 'On Hold'];

const STATUS_STYLES = {
  Pending: {
    row: 'bg-white hover:bg-slate-50',
    badge: 'border-slate-200 bg-slate-100 text-slate-700',
    select: '!border-slate-300 !bg-white !text-slate-700',
  },
  'In Progress': {
    row: 'bg-amber-50/80 hover:bg-amber-100/70',
    badge: 'border-amber-200 bg-amber-100 text-amber-800',
    select: '!border-amber-200 !bg-amber-50 !text-amber-800',
  },
  Delay: {
    row: 'bg-red-50/90 hover:bg-red-100/70',
    badge: 'border-red-200 bg-red-100 text-red-700',
    select: '!border-red-200 !bg-red-50 !text-red-700',
  },
  Completed: {
    row: 'bg-emerald-50/90 hover:bg-emerald-100/70',
    badge: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    select: '!border-emerald-200 !bg-emerald-50 !text-emerald-700',
  },
  'On Hold': {
    row: 'bg-violet-50/80 hover:bg-violet-100/70',
    badge: 'border-violet-200 bg-violet-100 text-violet-700',
    select: '!border-violet-200 !bg-violet-50 !text-violet-700',
  },
};

const COMPACT_INPUT = '!h-7 !rounded-md !border-slate-300 !px-2 !py-1 !text-[11px] !leading-4 focus:!ring-1';
const COMPACT_SELECT = `${COMPACT_INPUT} !pr-6`;

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const toDateInput = (value) => {
  const date = toDate(value);
  if (!date) return '';
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const todayDateInput = () => toDateInput(new Date());

const isSunday = (value) => toDate(value)?.getDay() === 0;

const isPastDate = (value) => {
  const date = toDate(value);
  const today = toDate(new Date());
  return Boolean(date && today && date < today);
};


const addWorkingDays = (value, count) => {
  const date = toDate(value);
  if (!date) return null;
  let remaining = Math.max(0, Number(count) || 0);
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0) remaining -= 1;
  }
  return date;
};

const workingDaysBetween = (fromValue, toValue) => {
  const from = toDate(fromValue);
  const to = toDate(toValue);
  if (!from || !to || to <= from) return 0;
  let days = 0;
  const cursor = new Date(from);
  while (cursor < to) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor <= to && cursor.getDay() !== 0) days += 1;
  }
  return days;
};

// getProjectId also normalizes Mongo ObjectId JSON/buffer shapes. Using it
// here prevents an assigned user from being compared as "[object Object]".
const userId = (value) => getProjectId(value).toLowerCase();
const userLabel = (user = {}) => user.name || user.email || 'User';

const normalizeStatus = (value) => {
  if (value === 'Hold') return 'On Hold';
  if (value === 'Delayed') return 'Delay';
  if (value === 'Not Started') return 'Pending';
  return TASK_STATUSES.includes(value) ? value : 'Pending';
};

const delayedDays = (task, now = new Date()) => {
  const end = toDate(task.plannedEndDate || task.endDate);
  if (!end) return 0;
  const status = normalizeStatus(task.status);
  if (status === 'On Hold') return Math.max(0, Number(task.delayDays || 0));
  const relevant = status === 'Completed'
    ? toDate(task.actualCompletedDate || task.completionDate)
    : toDate(now);
  return relevant && relevant > end ? workingDaysBetween(end, relevant) : 0;
};

const effectiveStatus = (task) => {
  const status = normalizeStatus(task.status);
  if (status === 'Completed' || status === 'On Hold') return status;
  const end = toDate(task.plannedEndDate || task.endDate);
  return end && toDate(new Date()) > end ? 'Delay' : status;
};

const recalculateGrid = (grid = {}) => {
  const tasks = (grid.planningTasks || []).map((rawTask, index) => {
    const totalDays = Number.isInteger(Number(rawTask.totalDays ?? rawTask.duration)) && Number(rawTask.totalDays ?? rawTask.duration) > 0
      ? Number(rawTask.totalDays ?? rawTask.duration)
      : 1;
    const plannedStartDate = toDate(rawTask.plannedStartDate || rawTask.startDate);
    const plannedEndDate = plannedStartDate ? addWorkingDays(plannedStartDate, totalDays - 1) : null;
    const task = {
      ...rawTask,
      taskId: rawTask.taskId || `${grid.gridId || 'grid'}-task-${index + 1}`,
      order: index + 1,
      gridId: grid.gridId,
      gridName: grid.gridName || grid.name,
      department: grid.department,
      totalDays,
      duration: totalDays,
      plannedStartDate: plannedStartDate ? toDateInput(plannedStartDate) : '',
      plannedEndDate: plannedEndDate ? toDateInput(plannedEndDate) : '',
      status: normalizeStatus(rawTask.status),
    };
    task.delayDays = delayedDays(task);
    task.dependency = index === 0 ? '' : String((grid.planningTasks || [])[index - 1]?.taskId || '');
    return task;
  });
  const completed = tasks.filter((task) => task.status === 'Completed').length;
  const completionPercentage = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const endDates = tasks.map((task) => toDate(task.plannedEndDate)).filter(Boolean);
  return {
    ...grid,
    planningTasks: tasks,
    projectEndDate: endDates.length ? toDateInput(new Date(Math.max(...endDates.map((date) => date.getTime())))) : '',
    delayedDays: Math.max(0, ...tasks.map((task) => Number(task.delayDays || 0))),
    completionPercentage,
  };
};

const AutoSizeTaskInput = ({ value, disabled, onChange }) => {
  const inputRef = useRef(null);

  const resize = () => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = '28px';
    element.style.height = `${Math.max(28, element.scrollHeight)}px`;
  };

  useLayoutEffect(resize, [value]);

  return (
    <textarea
      ref={inputRef}
      rows={1}
      value={value}
      disabled={disabled}
      title={value}
      onInput={resize}
      onChange={onChange}
      className="block min-h-7 w-full resize-none overflow-hidden rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium leading-4 text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-white/60 disabled:text-slate-700"
    />
  );
};

const FieldLabel = ({ children }) => (
  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">{children}</span>
);

const SortableTableRow = ({ id, disabled, className, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  return (
    <tr
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.65 : 1,
        position: 'relative',
        zIndex: isDragging ? 20 : 'auto',
      }}
      className={`${className} ${isDragging ? 'shadow-lg' : ''}`}
    >
      {children({ attributes, listeners, setActivatorNodeRef, isDragging })}
    </tr>
  );
};

const SortableMobileCard = ({ id, disabled, className, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.65 : 1,
        position: 'relative',
        zIndex: isDragging ? 20 : 'auto',
      }}
      className={`${className} ${isDragging ? 'shadow-lg ring-2 ring-indigo-200' : ''}`}
    >
      {children({ attributes, listeners, setActivatorNodeRef, isDragging })}
    </div>
  );
};

const DragHandle = ({ enabled, attributes, listeners, setActivatorNodeRef, className = '' }) => {
  if (!enabled) return null;

  return (
    <button
      ref={setActivatorNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={(event) => event.stopPropagation()}
      className={`touch-none select-none rounded p-1 text-slate-500 transition hover:bg-white/90 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${className}`}
      title="Drag to reorder task"
      aria-label="Drag to reorder task"
    >
      <GripVertical size={15} />
    </button>
  );
};

const sortableTaskId = (grid, task, index) => String(
  task.taskId || `${grid.gridId || 'grid'}-task-${index + 1}`
);

const ProjectPlanningGrid = ({
  planningGrids = [],
  onChange,
  readOnly = false,
  canManagePlanning = true,
  onNavigationChange,
  activeGridId = '',
  projectId = '',
}) => {
  const [usersByDepartment, setUsersByDepartment] = useState({});
  const [loadingDepartments, setLoadingDepartments] = useState({});
  const [errors, setErrors] = useState({});
  const [updatingStatuses, setUpdatingStatuses] = useState({});
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const canEditStructure = !readOnly && canManagePlanning;
  const planningLeadershipRole = ['admin', 'hod', 'team_lead'].includes(auth?.user?.role);
  const canEditTaskDates = canEditStructure && planningLeadershipRole;
  const canReorderTasks = canEditStructure && planningLeadershipRole;
  const currentUserId = userId(auth?.user);

  const departments = useMemo(() => [...new Set(planningGrids.map((grid) => grid.department).filter(Boolean))], [planningGrids]);

  useEffect(() => {
    let cancelled = false;
    departments.forEach(async (department) => {
      if (usersByDepartment[department] || loadingDepartments[department]) return;
      setLoadingDepartments((prev) => ({ ...prev, [department]: true }));
      try {
        const users = await fetchPlanningUsers(department);
        if (!cancelled) setUsersByDepartment((prev) => ({ ...prev, [department]: users }));
      } catch {
        if (!cancelled) setUsersByDepartment((prev) => ({ ...prev, [department]: [] }));
      } finally {
        if (!cancelled) setLoadingDepartments((prev) => ({ ...prev, [department]: false }));
      }
    });
    return () => { cancelled = true; };
  }, [departments.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onNavigationChange?.(planningGrids.map((grid, index) => ({
      id: String(grid.gridId || index + 1),
      gridId: String(grid.gridId || index + 1),
      title: grid.gridName || grid.name || `Planning Grid ${index + 1}`,
      label: `${grid.panelType || 'Panel'}`,
    })));
  }, [planningGrids, onNavigationChange]);

  const replaceGrid = (gridIndex, nextGrid) => {
    const next = planningGrids.map((grid, index) => index === gridIndex ? recalculateGrid(nextGrid) : grid);
    onChange?.(next);
  };

  const updateTask = (gridIndex, taskIndex, patch) => {
    const grid = planningGrids[gridIndex];
    const tasks = (grid.planningTasks || []).map((task, index) => index === taskIndex ? { ...task, ...patch } : task);
    replaceGrid(gridIndex, { ...grid, planningTasks: tasks });
  };

  const setDays = (gridIndex, taskIndex, value) => {
    const key = `${gridIndex}-${taskIndex}-days`;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1) {
      setErrors((prev) => ({ ...prev, [key]: 'Days must be a positive whole number.' }));
      updateTask(gridIndex, taskIndex, { totalDays: value, duration: value });
      return;
    }
    setErrors((prev) => ({ ...prev, [key]: '' }));
    updateTask(gridIndex, taskIndex, { totalDays: number, duration: number });
  };

  const setTaskStartDate = (gridIndex, taskIndex, value) => {
    const key = `${gridIndex}-${taskIndex}-start`;
    const currentValue = toDateInput(
      planningGrids[gridIndex]?.planningTasks?.[taskIndex]?.plannedStartDate
      || planningGrids[gridIndex]?.planningTasks?.[taskIndex]?.startDate
    );

    if (value && isPastDate(value) && value !== currentValue) {
      setErrors((prev) => ({ ...prev, [key]: 'Previous dates are blocked. Select today or a future working day.' }));
      return;
    }
    if (value && isSunday(value)) {
      setErrors((prev) => ({ ...prev, [key]: 'Sunday is blocked. Select Monday to Saturday.' }));
      return;
    }
    setErrors((prev) => ({ ...prev, [key]: '' }));
    updateTask(gridIndex, taskIndex, { plannedStartDate: value, startDate: value });
  };

  const addRow = (gridIndex) => {
    const grid = planningGrids[gridIndex];
    const nextTask = {
      taskId: `${grid.gridId}-${Date.now()}`,
      taskName: 'New Task',
      assignedTo: null,
      totalDays: 1,
      duration: 1,
      status: 'Pending',
      remark: '',
      department: grid.department,
    };
    replaceGrid(gridIndex, { ...grid, planningTasks: [...(grid.planningTasks || []), nextTask] });
  };

  const removeRow = (gridIndex, taskIndex) => {
    if (!window.confirm('Remove this planning task? Saved task history will be affected.')) return;
    const grid = planningGrids[gridIndex];
    replaceGrid(gridIndex, { ...grid, planningTasks: (grid.planningTasks || []).filter((_, index) => index !== taskIndex) });
  };

  const handleDragEnd = (gridIndex, grid, event) => {
    if (!canReorderTasks) return;

    const { active, over } = event;
    if (!over || String(active.id) === String(over.id)) return;

    const tasks = [...(grid.planningTasks || [])];
    const oldIndex = tasks.findIndex((task, index) => sortableTaskId(grid, task, index) === String(active.id));
    const newIndex = tasks.findIndex((task, index) => sortableTaskId(grid, task, index) === String(over.id));

    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

    replaceGrid(gridIndex, {
      ...grid,
      planningTasks: arrayMove(tasks, oldIndex, newIndex),
    });
  };

  const changeStatus = async (gridIndex, taskIndex, status) => {
    const grid = planningGrids[gridIndex] || {};
    const task = planningGrids[gridIndex]?.planningTasks?.[taskIndex] || {};
    const key = `${gridIndex}-${taskIndex}-status`;

    if (!projectId || !grid.gridId || !task.taskId) return;

    setUpdatingStatuses((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
    try {
      const updatedProject = await updatePlanningTaskStatus(projectId, grid.gridId, task.taskId, status);
      const updatedGrid = (updatedProject?.planningGrids || []).find((item) => String(item.gridId) === String(grid.gridId));
      const updatedTask = (updatedGrid?.planningTasks || []).find((item) => String(item.taskId) === String(task.taskId));
      updateTask(gridIndex, taskIndex, updatedTask || {
        status,
        actualCompletedDate: status === 'Completed' ? (task.actualCompletedDate || new Date().toISOString()) : task.actualCompletedDate,
      });
      toast.success(`Task status updated to ${status}`);
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to update task status.';
      setErrors((prev) => ({
        ...prev,
        [key]: message,
      }));
      toast.error(message);
    } finally {
      setUpdatingStatuses((prev) => ({ ...prev, [key]: false }));
    }
  };

  const openActivityGraph = (grid, event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!projectId) return;

    const params = new URLSearchParams();
    if (grid.department) params.set('department', grid.department);
    if (grid.gridId) params.set('gridId', grid.gridId);
    navigate(`/projects/${projectId}/activity${params.toString() ? `?${params.toString()}` : ''}`);
  };

  if (!planningGrids.length) {
    return <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">Select the required planning options and at least one panel type to create planning grids.</div>;
  }

  return (
    <div className="space-y-3">
      {planningGrids.map((rawGrid, gridIndex) => {
        const grid = recalculateGrid(rawGrid);
        const users = usersByDepartment[grid.department] || [];
        const statusCounts = TASK_STATUSES.reduce((counts, status) => ({
          ...counts,
          [status]: (grid.planningTasks || []).filter((task) => effectiveStatus(task) === status).length,
        }), {});
        const sortableTaskIds = (grid.planningTasks || []).map((task, taskIndex) => sortableTaskId(grid, task, taskIndex));

        return (
          <details
            key={grid.gridId || gridIndex}
            id={`project-planning-grid-${grid.gridId}`}
            open={!activeGridId || String(activeGridId) === String(grid.gridId) || planningGrids.length <= 2}
            className={`scroll-mt-44 overflow-hidden rounded-xl border bg-white shadow-sm ${String(activeGridId) === String(grid.gridId) ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-200'}`}
          >
            <summary className="cursor-pointer select-none bg-gradient-to-r from-slate-50 to-indigo-50 px-3 py-2 sm:px-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="truncate text-xs font-bold text-slate-800 sm:text-sm">{grid.gridName || grid.name}</h4>
                  <p className="mt-0.5 truncate text-[10px] text-slate-500 sm:text-[11px]">
                    {grid.panelType} · {grid.planningMode === 'separate' ? `Unit ${grid.unitNumber}` : grid.panelQuantity > 1 ? `Common for ${grid.panelQuantity} units` : 'Single unit'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold text-slate-600 sm:text-xs">
                  <Users size={13} /> {grid.planningTasks?.length || 0} tasks · {grid.completionPercentage || 0}%
                </div>
              </div>
            </summary>

            <div className="p-2 sm:p-3">
              <div className="mb-2 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {TASK_STATUSES.map((status) => (
                    <span key={status} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[status].badge}`}>
                      {status} <strong>{statusCounts[status] || 0}</strong>
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <label className="min-w-[132px] flex-1 sm:flex-none">
                    <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-wide text-slate-500">Project End</span>
                    <Input type="date" value={toDateInput(grid.projectEndDate)} disabled className={`${COMPACT_INPUT} !bg-slate-100 !text-slate-400`} />
                  </label>
                  {projectId && (
                    <button
                      type="button"
                      onClick={(event) => openActivityGraph(grid, event)}
                      className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-100"
                      title={`Open activity graph for ${grid.panelType || grid.gridName || 'this panel'}`}
                    >
                      <Activity size={13} /> Activity Graph
                    </button>
                  )}
                  {canEditStructure && (
                    <button
                      type="button"
                      onClick={() => addRow(gridIndex)}
                      className="inline-flex h-7 items-center justify-center gap-1 rounded-md bg-blue-600 px-2.5 text-[11px] font-semibold text-white hover:bg-blue-700"
                    >
                      <Plus size={13} /> Add Row
                    </button>
                  )}
                </div>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => handleDragEnd(gridIndex, grid, event)}
              >
                <SortableContext items={sortableTaskIds} strategy={verticalListSortingStrategy}>
                  <div className="hidden overflow-hidden rounded-lg border border-slate-200 xl:block">
                    <table className="w-full table-fixed text-left text-[11px]">
                      <colgroup>
                        <col className="w-[4%]" />
                        <col className="w-[27%]" />
                        <col className="w-[15%]" />
                        <col className="w-[11%]" />
                        <col className="w-[5%]" />
                        <col className="w-[10%]" />
                        <col className="w-[10%]" />
                        <col className="w-[9%]" />
                        <col className="w-[5%]" />
                        <col className="w-[4%]" />
                      </colgroup>
                      <thead className="bg-slate-800 text-white">
                        <tr>
                          {['Sr.', 'Task Name', 'Remark', 'Assigned To', 'Days', 'Start Date', 'End Date', 'Status', 'Delayed', 'Actions'].map((heading) => (
                            <th key={heading} className="whitespace-nowrap px-1.5 py-2 text-center text-[10px] font-semibold first:text-left">{heading}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(grid.planningTasks || []).map((task, taskIndex) => {
                          const currentAssigneeId = userId(task.assignedTo);
                          const currentAssignee = typeof task.assignedTo === 'object' ? task.assignedTo : null;
                          const userOptions = currentAssignee && !users.some((user) => userId(user) === currentAssigneeId)
                            ? [currentAssignee, ...users]
                            : users;
                          const daysError = errors[`${gridIndex}-${taskIndex}-days`];
                          const startDateError = errors[`${gridIndex}-${taskIndex}-start`];
                          const statusError = errors[`${gridIndex}-${taskIndex}-status`];
                          const status = effectiveStatus(task);
                          const taskSortableId = sortableTaskId(grid, task, taskIndex);
                          const canChangeStatus = Boolean(projectId && currentAssigneeId && currentAssigneeId === currentUserId);
                          const statusUpdating = Boolean(updatingStatuses[`${gridIndex}-${taskIndex}-status`]);

                          return (
                            <SortableTableRow
                              key={taskSortableId}
                              id={taskSortableId}
                              disabled={!canReorderTasks}
                              className={`border-t border-slate-200 align-middle transition-colors ${STATUS_STYLES[status].row}`}
                            >
                              {({ attributes, listeners, setActivatorNodeRef }) => (
                                <>
                                  <td className="px-1 py-1 text-center font-semibold text-slate-600">{taskIndex + 1}</td>
                                  <td className="px-1 py-1">
                                    <AutoSizeTaskInput
                                      value={task.taskName || ''}
                                      disabled={!canEditStructure}
                                      onChange={(event) => updateTask(gridIndex, taskIndex, { taskName: event.target.value })}
                                    />
                                  </td>
                                  <td className="px-1 py-1">
                                    <Input
                                      value={task.remark || ''}
                                      disabled={!canEditStructure}
                                      title={task.remark || ''}
                                      placeholder="Remark..."
                                      onChange={(event) => updateTask(gridIndex, taskIndex, { remark: event.target.value })}
                                      className={COMPACT_INPUT}
                                    />
                                  </td>
                                  <td className="px-1 py-1">
                                    <Select
                                      value={currentAssigneeId}
                                      disabled={!canEditStructure || loadingDepartments[grid.department]}
                                      onChange={(event) => updateTask(gridIndex, taskIndex, { assignedTo: event.target.value || null })}
                                      className={`${COMPACT_SELECT} !px-1.5 !pr-5 !text-[10px]`}
                                      title={currentAssignee ? userLabel(currentAssignee) : ''}
                                    >
                                      <option value="">{loadingDepartments[grid.department] ? 'Loading users…' : 'Assigned To'}</option>
                                      {userOptions.map((user) => <option key={userId(user)} value={userId(user)}>{userLabel(user)}{user.isActive === false ? ' (inactive - historical)' : ''}</option>)}
                                    </Select>
                                  </td>
                                  <td className="px-1 py-1">
                                    <Input
                                      type="number"
                                      min="1"
                                      step="1"
                                      value={task.totalDays ?? task.duration ?? 1}
                                      disabled={!canEditStructure}
                                      onChange={(event) => setDays(gridIndex, taskIndex, event.target.value)}
                                      className={`${COMPACT_INPUT} !text-center`}
                                    />
                                    {daysError && <p className="mt-0.5 text-[9px] font-medium leading-3 text-red-600" title={daysError}>Invalid</p>}
                                  </td>
                                  <td className="px-1 py-1">
                                    <Input
                                      type="date"
                                      value={toDateInput(task.plannedStartDate || task.startDate)}
                                      min={todayDateInput()}
                                      disabled={!canEditTaskDates}
                                      onChange={(event) => setTaskStartDate(gridIndex, taskIndex, event.target.value)}
                                      className={canEditTaskDates ? COMPACT_INPUT : `${COMPACT_INPUT} !bg-slate-100 !text-slate-400`}
                                      title={canEditTaskDates ? 'Admin, HOD, and Team Lead can set this task start date. Previous dates and Sundays are blocked.' : 'Only Admin, HOD, and Team Lead can set task start dates.'}
                                    />
                                    {startDateError && <p className="mt-0.5 text-[9px] font-medium leading-3 text-red-600" title={startDateError}>Invalid</p>}
                                  </td>
                                  <td className="px-1 py-1">
                                    <Input type="date" value={toDateInput(task.plannedEndDate || task.endDate)} disabled className={`${COMPACT_INPUT} !bg-slate-100 !text-slate-400`} title="Calculated automatically" />
                                  </td>
                                  <td className="px-1 py-1">
                                    <Select
                                      value={status}
                                      disabled={!canChangeStatus || statusUpdating}
                                      onChange={(event) => changeStatus(gridIndex, taskIndex, event.target.value)}
                                      className={`${COMPACT_SELECT} ${STATUS_STYLES[status].select}`}
                                      title={canChangeStatus ? 'You are assigned to this task and can change its status.' : 'Only the assigned user can change this task status.'}
                                    >
                                      {TASK_STATUSES.map((statusOption) => <option key={statusOption} value={statusOption}>{statusOption}</option>)}
                                    </Select>
                                    {statusError && <p className="mt-0.5 text-[9px] font-medium leading-3 text-red-600" title={statusError}>Failed</p>}
                                  </td>
                                  <td className={`px-1 py-1 text-center text-[11px] font-bold ${delayedDays(task) > 0 ? 'text-red-600' : 'text-slate-400'}`}>{delayedDays(task)}</td>
                                  <td className="px-0.5 py-1">
                                    <div className="flex items-center justify-center gap-0.5">
                                      <DragHandle
                                        enabled={canReorderTasks}
                                        attributes={attributes}
                                        listeners={listeners}
                                        setActivatorNodeRef={setActivatorNodeRef}
                                      />
                                      <button type="button" disabled={!canEditStructure} onClick={() => removeRow(gridIndex, taskIndex)} className="rounded p-1 text-red-600 hover:bg-white/80 disabled:opacity-25" title="Remove task"><Trash2 size={13} /></button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </SortableTableRow>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </SortableContext>
              </DndContext>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => handleDragEnd(gridIndex, grid, event)}
              >
                <SortableContext items={sortableTaskIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2 xl:hidden">
                    {(grid.planningTasks || []).map((task, taskIndex) => {
                      const currentAssigneeId = userId(task.assignedTo);
                      const currentAssignee = typeof task.assignedTo === 'object' ? task.assignedTo : null;
                      const userOptions = currentAssignee && !users.some((user) => userId(user) === currentAssigneeId)
                        ? [currentAssignee, ...users]
                        : users;
                      const daysError = errors[`${gridIndex}-${taskIndex}-days`];
                      const startDateError = errors[`${gridIndex}-${taskIndex}-start`];
                      const statusError = errors[`${gridIndex}-${taskIndex}-status`];
                      const status = effectiveStatus(task);
                      const taskSortableId = sortableTaskId(grid, task, taskIndex);
                      const canChangeStatus = Boolean(projectId && currentAssigneeId && currentAssigneeId === currentUserId);
                      const statusUpdating = Boolean(updatingStatuses[`${gridIndex}-${taskIndex}-status`]);

                      return (
                        <SortableMobileCard
                          key={taskSortableId}
                          id={taskSortableId}
                          disabled={!canReorderTasks}
                          className={`rounded-lg border border-slate-200 p-2 ${STATUS_STYLES[status].row}`}
                        >
                          {({ attributes, listeners, setActivatorNodeRef }) => (
                            <>
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <DragHandle
                                    enabled={canReorderTasks}
                                    attributes={attributes}
                                    listeners={listeners}
                                    setActivatorNodeRef={setActivatorNodeRef}
                                    className="border border-slate-200 bg-white/80 p-1.5"
                                  />
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-white">{taskIndex + 1}</span>
                                </div>
                                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[status].badge}`}>{status}</span>
                              </div>

                              <div className="mb-2">
                                <FieldLabel>Task Name</FieldLabel>
                                <AutoSizeTaskInput
                                  value={task.taskName || ''}
                                  disabled={!canEditStructure}
                                  onChange={(event) => updateTask(gridIndex, taskIndex, { taskName: event.target.value })}
                                />
                              </div>

                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                <label>
                                  <FieldLabel>Remark</FieldLabel>
                                  <Input value={task.remark || ''} disabled={!canEditStructure} placeholder="Remark..." onChange={(event) => updateTask(gridIndex, taskIndex, { remark: event.target.value })} className={COMPACT_INPUT} />
                                </label>
                                <label>
                                  <FieldLabel>Assigned To</FieldLabel>
                                  <Select
                                    value={currentAssigneeId}
                                    disabled={!canEditStructure || loadingDepartments[grid.department]}
                                    onChange={(event) => updateTask(gridIndex, taskIndex, { assignedTo: event.target.value || null })}
                                    className={COMPACT_SELECT}
                                  >
                                    <option value="">{loadingDepartments[grid.department] ? 'Loading users…' : 'Assigned To'}</option>
                                    {userOptions.map((user) => <option key={userId(user)} value={userId(user)}>{userLabel(user)}{user.isActive === false ? ' (inactive - historical)' : ''}</option>)}
                                  </Select>
                                </label>
                                <label>
                                  <FieldLabel>Days</FieldLabel>
                                  <Input type="number" min="1" step="1" value={task.totalDays ?? task.duration ?? 1} disabled={!canEditStructure} onChange={(event) => setDays(gridIndex, taskIndex, event.target.value)} className={COMPACT_INPUT} />
                                  {daysError && <p className="mt-1 text-[10px] font-medium text-red-600">{daysError}</p>}
                                </label>
                                <label>
                                  <FieldLabel>Start Date</FieldLabel>
                                  <Input type="date" value={toDateInput(task.plannedStartDate || task.startDate)} min={todayDateInput()} disabled={!canEditTaskDates} onChange={(event) => setTaskStartDate(gridIndex, taskIndex, event.target.value)} className={canEditTaskDates ? COMPACT_INPUT : `${COMPACT_INPUT} !bg-slate-100 !text-slate-400`} title={canEditTaskDates ? 'Admin, HOD, and Team Lead can set this task start date. Previous dates and Sundays are blocked.' : 'Only Admin, HOD, and Team Lead can set task start dates.'} />
                                  {startDateError && <p className="mt-1 text-[10px] font-medium text-red-600">{startDateError}</p>}
                                </label>
                                <label>
                                  <FieldLabel>End Date</FieldLabel>
                                  <Input type="date" value={toDateInput(task.plannedEndDate || task.endDate)} disabled className={`${COMPACT_INPUT} !bg-slate-100 !text-slate-400`} title="Calculated automatically" />
                                </label>
                                <label>
                                  <FieldLabel>Status</FieldLabel>
                                  <Select value={status} disabled={!canChangeStatus || statusUpdating} onChange={(event) => changeStatus(gridIndex, taskIndex, event.target.value)} className={`${COMPACT_SELECT} ${STATUS_STYLES[status].select}`} title={canChangeStatus ? 'You are assigned to this task and can change its status.' : 'Only the assigned user can change this task status.'}>
                                    {TASK_STATUSES.map((statusOption) => <option key={statusOption} value={statusOption}>{statusOption}</option>)}
                                  </Select>
                                  {statusError && <p className="mt-1 text-[10px] font-medium text-red-600">{statusError}</p>}
                                </label>
                              </div>

                              <div className="mt-2 flex items-center justify-between border-t border-slate-200/80 pt-2">
                                <span className={`text-[10px] font-bold ${delayedDays(task) > 0 ? 'text-red-600' : 'text-slate-500'}`}>Delayed Days: {delayedDays(task)}</span>
                                <button type="button" disabled={!canEditStructure} onClick={() => removeRow(gridIndex, taskIndex)} className="rounded-md border border-red-200 bg-white/80 p-1.5 text-red-600 disabled:opacity-25" title="Remove task"><Trash2 size={14} /></button>
                              </div>
                            </>
                          )}
                        </SortableMobileCard>
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </details>
        );
      })}
    </div>
  );
};

export default ProjectPlanningGrid;
