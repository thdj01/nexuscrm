import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Inbox,
  Loader2,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const COLORS = {
  expected: '#2563eb',
  actual: '#16a34a',
  inProgress: '#eab308',
  delayed: '#dc2626',
};

const MS_DAY = 24 * 60 * 60 * 1000;

const SUMMARY = [
  {
    key: 'activeTasks',
    label: 'Expected Tasks',
    icon: Activity,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    key: 'completedTasks',
    label: 'Completed On Time',
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  {
    key: 'inProgressTasks',
    label: 'In Progress',
    icon: Loader2,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
  },
  {
    key: 'delayedTasks',
    label: 'Delayed / Extended',
    icon: AlertTriangle,
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
];

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatDate = (value) => {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
};

const isFinitePoint = (value) =>
  value !== null &&
  value !== undefined &&
  value !== '' &&
  Number.isFinite(Number(value));

const ACTUAL_POINT_TYPES = {
  completed: {
    color: COLORS.actual,
    label: 'Completed on time',
  },
  inProgress: {
    color: COLORS.inProgress,
    label: 'In progress',
  },
  delayed: {
    color: COLORS.delayed,
    label: 'Delayed / extended / completed late',
  },
};

const resolveActualPoint = (row = {}) => {
  if (isFinitePoint(row.delayedDay)) {
    return {
      day: Number(row.delayedDay),
      type: 'delayed',
      color: ACTUAL_POINT_TYPES.delayed.color,
      label: row.status === 'Completed' ? 'Completed late' : ACTUAL_POINT_TYPES.delayed.label,
      dateLabel: row.delayedDateLabel || row.actualDateLabel || '—',
    };
  }

  if (isFinitePoint(row.actualDay)) {
    return {
      day: Number(row.actualDay),
      type: 'completed',
      color: ACTUAL_POINT_TYPES.completed.color,
      label: ACTUAL_POINT_TYPES.completed.label,
      dateLabel: row.actualDateLabel || '—',
    };
  }

  if (isFinitePoint(row.inProgressDay)) {
    return {
      day: Number(row.inProgressDay),
      type: 'inProgress',
      color: ACTUAL_POINT_TYPES.inProgress.color,
      label: ACTUAL_POINT_TYPES.inProgress.label,
      dateLabel: row.inProgressDateLabel || '—',
    };
  }

  if (isFinitePoint(row.holdDay)) {
    return {
      day: Number(row.holdDay),
      type: 'delayed',
      color: ACTUAL_POINT_TYPES.delayed.color,
      label: 'On hold / delayed',
      dateLabel: row.holdDateLabel || '—',
    };
  }

  return null;
};

const buildActualLineRows = (rows = []) => {
  const chartRows = rows.map((row) => {
    const actualPoint = resolveActualPoint(row);

    return {
      ...row,
      actualUnifiedDay: actualPoint ? actualPoint.day : null,
      actualPointType: actualPoint?.type || '',
      actualPointColor: actualPoint?.color || COLORS.actual,
      actualPointLabel: actualPoint?.label || '',
      actualUnifiedDateLabel: actualPoint?.dateLabel || '',
    };
  });

  const actualPointIndexes = chartRows
    .map((row, index) => (isFinitePoint(row.actualUnifiedDay) ? index : null))
    .filter((index) => index !== null);

  const actualSegments = [];

  actualPointIndexes.forEach((rowIndex, pointIndex) => {
    if (pointIndex === 0) return;

    const previousRowIndex = actualPointIndexes[pointIndex - 1];
    const currentRow = chartRows[rowIndex];
    const previousRow = chartRows[previousRowIndex];
    const segmentKey = `actualSegment${pointIndex}`;

    chartRows[previousRowIndex][segmentKey] = Number(previousRow.actualUnifiedDay);
    chartRows[rowIndex][segmentKey] = Number(currentRow.actualUnifiedDay);
    actualSegments.push({
      key: segmentKey,
      color: currentRow.actualPointColor || COLORS.actual,
    });
  });

  return { chartRows, actualSegments };
};

const renderActualDot = (radius = 3.8) => (props) => {
  const { cx, cy, payload } = props || {};
  if (!payload || !isFinitePoint(payload.actualUnifiedDay) || cx === undefined || cy === undefined) {
    return null;
  }

  return (
    <circle
      cx={cx}
      cy={cy}
      r={radius}
      fill="#ffffff"
      stroke={payload.actualPointColor || COLORS.actual}
      strokeWidth={2}
    />
  );
};

const getGridKey = (gridId, gridName, fallback = 'A') => String(gridId || gridName || fallback);
const normalizeText = (value) => String(value || '').trim();
const sameText = (left, right) => normalizeText(left).toLowerCase() === normalizeText(right).toLowerCase();
const domSafe = (value) => normalizeText(value).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
const departmentElementId = (department) => `activity-department-${domSafe(department)}`;
const panelElementId = (gridId) => `activity-panel-${domSafe(gridId)}`;

const getPanelDescriptor = (grid = {}) => {
  const panelType = grid.panelType || 'Panel';
  if (grid.planningMode === 'separate') {
    return `${panelType} · Unit ${grid.unitNumber || 1}`;
  }
  if (Number(grid.panelQuantity || 1) > 1) {
    return `${panelType} · Common for ${grid.panelQuantity} units`;
  }
  return `${panelType} · Single unit`;
};

const getPanelActivityTitle = (grid = {}) => {
  const panelType = normalizeText(grid.panelType) || 'Panel';
  if (/\b(panel|box|enclosure)\b/i.test(panelType)) return panelType;
  return `${panelType} Panel`;
};

const getPanelScopeLabel = (grid = {}) => {
  const quantity = Math.max(1, Number(grid.panelQuantity || 1));
  if (grid.planningMode === 'separate') {
    return `Quantity ${quantity} · Unit ${grid.unitNumber || 1}`;
  }
  if (quantity > 1) return `Quantity ${quantity} · Common planning`;
  return 'Quantity 1 · Single unit';
};

const getProjectGridDefinitions = (project = {}, chartData = []) => {
  const definitions = [];
  const seen = new Set();

  const addGrid = (grid = {}, fallbackIndex = 0) => {
    const resolvedId = grid.gridId || String.fromCharCode(65 + fallbackIndex);
    const resolvedName = grid.name || grid.gridName || `Project Planning Grid - ${resolvedId}`;
    const key = getGridKey(resolvedId, resolvedName, resolvedId);

    if (seen.has(key)) return;
    seen.add(key);
    definitions.push({
      key,
      gridId: resolvedId,
      gridName: resolvedName,
      department: grid.department || '',
      panelType: grid.panelType || '',
      panelQuantity: Number(grid.panelQuantity || 1),
      planningMode: grid.planningMode || 'common',
      unitNumber: grid.unitNumber || 1,
      isCommon: grid.isCommon !== false,
    });
  };

  if (Array.isArray(project?.planningGrids) && project.planningGrids.length > 0) {
    project.planningGrids.forEach((grid, index) => addGrid(grid, index));
  }

  chartData.forEach((row, index) => addGrid(row, index));

  if (definitions.length === 0) {
    addGrid({ gridId: 'A', gridName: 'Project Planning Grid - A' }, 0);
  }

  return definitions;
};

const getDepartmentDefinitions = (project = {}, chartData = [], grids = []) => {
  const departments = [];
  const seen = new Set();

  const addDepartment = (value) => {
    const department = normalizeText(value);
    if (!department) return;
    const key = department.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    departments.push(department);
  };

  (project?.selectedDepartments || []).forEach(addDepartment);
  (project?.planningGrids || []).forEach((grid) => addDepartment(grid.department));
  grids.forEach((grid) => addDepartment(grid.department));
  chartData.forEach((row) => addDepartment(row.department));

  if (departments.length === 0) departments.push('Project');
  return departments;
};

const EmptyState = ({ title }) => (
  <div className="flex min-h-[230px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/70 p-6 text-center">
    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-gray-400 shadow-sm">
      <Inbox size={20} />
    </div>
    <p className="text-sm font-semibold text-gray-700">No planned task date data found</p>
    <p className="mt-1 max-w-md text-xs leading-5 text-gray-500">
      {title || 'This activity graph'} has no dated tasks yet. Add task start and end dates to generate the graph.
    </p>
  </div>
);

const LoadingSkeleton = () => (
  <div className="space-y-4">
    {Array.from({ length: 3 }).map((_, index) => (
      <div key={index} className="h-[420px] animate-pulse rounded-2xl bg-gray-100" />
    ))}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  const row = payload[0]?.payload || {};

  return (
    <div className="max-w-xs rounded-xl border border-gray-200 bg-white p-3 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-gray-900">
        Task {label}: {row.taskName || 'Task'}
      </p>
      <p className="mb-2 text-[11px] text-gray-500">
        {[row.department, row.panelLabel || row.panelType, row.status || 'Pending'].filter(Boolean).join(' · ')}
      </p>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-5">
          <span className="flex items-center gap-2 text-gray-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS.expected }} />
            Expected
          </span>
          <span className="font-semibold text-gray-900">{row.expectedDateLabel || '—'}</span>
        </div>

        {row.actualUnifiedDateLabel && (
          <div className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-2 text-gray-600">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: row.actualPointColor || COLORS.actual }}
              />
              Actual · {row.actualPointLabel || 'Status'}
            </span>
            <span className="font-semibold" style={{ color: row.actualPointColor || COLORS.actual }}>
              {row.actualUnifiedDateLabel}
            </span>
          </div>
        )}

        {Number(row.delayDays || 0) > 0 && (
          <div className="rounded-lg bg-red-50 px-2 py-1 font-semibold text-red-600">
            Delayed by {row.delayDays} day(s)
          </div>
        )}
      </div>
    </div>
  );
};

const getVisibleDateValues = (rows = []) => rows.flatMap((row) => [
  row.expectedDay,
  row.actualUnifiedDay,
]).filter(isFinitePoint);

const getTotals = (rows = []) => rows.reduce(
  (acc, row) => {
    if (isFinitePoint(row.expectedDay)) acc.activeTasks += 1;
    if (row.actualPointType === 'completed') acc.completedTasks += 1;
    if (row.actualPointType === 'inProgress') acc.inProgressTasks += 1;
    if (row.actualPointType === 'delayed') acc.delayedTasks += 1;
    return acc;
  },
  {
    activeTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    delayedTasks: 0,
  }
);

const GraphSummary = ({ totals, compact = false }) => (
  <div className={`grid grid-cols-2 ${compact ? 'gap-1.5' : 'gap-2'}`}>
    {SUMMARY.map((item) => {
      const Icon = item.icon;
      return (
        <div key={item.key} className={`rounded-lg ${item.bg} ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
          <div className={`flex items-center gap-1 text-[10px] font-medium leading-4 ${item.color}`}>
            <Icon size={11} className="shrink-0" />
            <span className="truncate" title={item.label}>{item.label}</span>
          </div>
          <p className={`${compact ? 'mt-0.5 text-sm' : 'mt-1 text-base'} font-bold text-gray-900`}>{totals[item.key]}</p>
        </div>
      );
    })}
  </div>
);

const GraphLegend = ({ compact = false }) => (
  <div className={`${compact ? 'mt-2 gap-x-3' : 'mt-3 gap-x-5'} flex flex-wrap items-center justify-center gap-y-1.5 text-[10px] font-medium text-gray-600`}>
    <span className="flex items-center gap-1.5">
      <span className="h-0.5 w-5 rounded-full" style={{ backgroundColor: COLORS.expected }} />
      Expected
    </span>
    <span className="flex items-center gap-1.5">
      <span className="h-0 w-5 border-t-2 border-dashed" style={{ borderColor: COLORS.actual }} />
      On time
    </span>
    <span className="flex items-center gap-1.5">
      <span className="h-0 w-5 border-t-2 border-dashed" style={{ borderColor: COLORS.inProgress }} />
      In progress
    </span>
    <span className="flex items-center gap-1.5">
      <span className="h-0 w-5 border-t-2 border-dashed" style={{ borderColor: COLORS.delayed }} />
      Delayed
    </span>
  </div>
);

const SingleActivityGraph = ({
  id,
  title,
  subtitle,
  eyebrow,
  rows = [],
  focused = false,
  variant = 'panel',
  compact = false,
}) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const { chartRows, actualSegments } = useMemo(() => buildActualLineRows(safeRows), [safeRows]);
  const hasData = chartRows.some(
    (row) => isFinitePoint(row.expectedDay) || isFinitePoint(row.actualUnifiedDay)
  );

  const baseDate = toDate(safeRows.find((row) => row.baseDate)?.baseDate);

  const formatAxisDate = (dayOffset) => {
    if (!baseDate && safeRows.length > 0) return String(dayOffset);
    if (!baseDate) return '';
    const date = new Date(baseDate.getTime() + Number(dayOffset || 0) * MS_DAY);
    return formatDate(date);
  };

  const visibleDateValues = getVisibleDateValues(chartRows);
  const minDay = visibleDateValues.length ? Math.min(...visibleDateValues) : 0;
  const maxDay = visibleDateValues.length ? Math.max(...visibleDateValues) : 1;
  const yDomain = minDay === maxDay ? [minDay - 1, maxDay + 1] : [minDay, maxDay];
  const totals = getTotals(chartRows);
  const chartMinWidth = compact
    ? Math.max(440, safeRows.length * 46)
    : Math.max(680, safeRows.length * 62);
  const chartHeightClass = compact ? 'h-[270px]' : 'h-[350px]';

  return (
    <article
      id={id}
      className={`scroll-mt-28 min-w-0 rounded-2xl border bg-white ${compact ? 'p-3' : 'p-4'} shadow-sm transition ${
        focused
          ? 'border-indigo-400 ring-4 ring-indigo-100'
          : variant === 'department'
            ? 'border-indigo-200'
            : 'border-gray-200'
      }`}
    >
      <div className={`${compact ? 'mb-3 gap-2' : 'mb-4 gap-3'} flex flex-col`}>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className={`max-w-[46%] shrink-0 truncate rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${variant === 'department' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}
              title={eyebrow || 'Project'}
            >
              {eyebrow || 'Project'}
            </span>
            <h4 className="min-w-0 flex-1 break-words text-sm font-bold leading-5 text-gray-900" title={title}>
              {title}
            </h4>
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-gray-500" title={subtitle}>{subtitle}</p>
        </div>
        <GraphSummary totals={totals} compact={compact} />
      </div>

      {!hasData ? (
        <EmptyState title={title} />
      ) : (
        <>
          <div className={`${chartHeightClass} w-full overflow-x-auto overflow-y-hidden pb-1`}>
            <div className="h-full min-w-full" style={{ minWidth: chartMinWidth }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartRows}
                  margin={{ top: 10, right: compact ? 12 : 24, left: compact ? -8 : 4, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />

                  <XAxis
                    dataKey="localTaskLabel"
                    tick={{ fontSize: compact ? 9 : 10, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={52}
                    label={{ value: 'Task No.', position: 'insideBottom', offset: -8, fontSize: 10, fill: '#64748b' }}
                  />

                  <YAxis
                    type="number"
                    tickFormatter={formatAxisDate}
                    allowDecimals={false}
                    tick={{ fontSize: compact ? 9 : 10, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                    width={compact ? 58 : 68}
                    domain={yDomain}
                  />

                  <Tooltip content={<CustomTooltip />} />

                  <Line
                    type="monotone"
                    dataKey="expectedDay"
                    name="Expected Date"
                    stroke={COLORS.expected}
                    strokeWidth={2.5}
                    dot={{ r: 3.5, strokeWidth: 2, fill: '#ffffff' }}
                    activeDot={{ r: 6 }}
                    connectNulls
                    isAnimationActive={false}
                  />

                  {actualSegments.map((segment) => (
                    <Line
                      key={segment.key}
                      type="monotone"
                      dataKey={segment.key}
                      stroke={segment.color}
                      strokeWidth={2.5}
                      strokeDasharray="5 5"
                      dot={false}
                      activeDot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ))}

                  <Line
                    type="monotone"
                    dataKey="actualUnifiedDay"
                    name="Actual"
                    stroke="transparent"
                    strokeWidth={0}
                    dot={renderActualDot(3.8)}
                    activeDot={renderActualDot(5.5)}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <GraphLegend compact={compact} />
        </>
      )}
    </article>
  );
};

const panelFilterLabel = (panel = {}) => {
  const department = panel.department || 'Project';
  const title = getPanelActivityTitle(panel);
  const quantity = Math.max(1, Number(panel.panelQuantity || 1));

  if (panel.planningMode === 'separate') {
    return `${department} · ${title} – Quantity ${quantity} · Unit ${panel.unitNumber || 1}`;
  }

  return `${department} · ${title} – Quantity ${quantity}`;
};

const ActivityGraph = ({
  data: chartData = [],
  project = {},
  loading = false,
  focusDepartment = '',
  focusGridId = '',
}) => {
  const safeData = Array.isArray(chartData) ? chartData : [];

  const { departments, gridGroups, graphItems } = useMemo(() => {
    const definitions = getProjectGridDefinitions(project, safeData);
    const departmentNames = getDepartmentDefinitions(project, safeData, definitions);

    const panels = definitions.map((grid) => {
      const rows = safeData
        .filter((row) => {
          const rowKey = getGridKey(row.gridId, row.gridName, row.gridId || row.gridName);
          return rowKey === grid.key || String(row.gridId || '') === String(grid.gridId || '');
        })
        .map((row, index) => ({
          ...row,
          localTaskNo: index + 1,
          localTaskLabel: String(index + 1).padStart(2, '0'),
          originalTaskLabel: row.taskLabel,
          gridName: row.gridName || grid.gridName,
          gridId: row.gridId || grid.gridId,
          department: row.department || grid.department,
          panelType: row.panelType || grid.panelType,
          panelQuantity: row.panelQuantity || grid.panelQuantity,
          planningMode: row.planningMode || grid.planningMode,
          unitNumber: row.unitNumber || grid.unitNumber,
          panelLabel: row.panelLabel || getPanelDescriptor({ ...grid, ...row }),
        }));

      return {
        ...grid,
        panelLabel: getPanelDescriptor(grid),
        rows,
      };
    });

    const byDepartment = departmentNames.map((department) => {
      const matchingPanels = panels.filter((grid) => {
        if (department === 'Project' && !grid.department) return true;
        return sameText(grid.department, department);
      });

      const departmentRows = safeData
        .filter((row) => {
          if (department === 'Project' && !row.department) return true;
          return sameText(row.department, department);
        })
        .map((row, index) => ({
          ...row,
          localTaskNo: index + 1,
          localTaskLabel: String(index + 1).padStart(2, '0'),
          panelLabel: row.panelLabel || getPanelDescriptor(row),
        }));

      return {
        department,
        rows: departmentRows,
        panels: matchingPanels,
      };
    });

    const items = [];
    byDepartment.forEach((departmentGroup) => {
      items.push({
        key: `department:${departmentGroup.department.toLowerCase()}`,
        id: departmentElementId(departmentGroup.department),
        title: 'All Activity',
        filterLabel: `${departmentGroup.department} · All Activity`,
        subtitle: `Combined activity for all ${departmentGroup.department} panel tasks.`,
        eyebrow: departmentGroup.department,
        rows: departmentGroup.rows,
        variant: 'department',
        department: departmentGroup.department,
        gridId: '',
      });

      departmentGroup.panels.forEach((panel) => {
        items.push({
          key: `panel:${String(panel.gridId || panel.key)}`,
          id: panelElementId(panel.gridId),
          title: getPanelActivityTitle(panel),
          filterLabel: panelFilterLabel(panel),
          subtitle: `${getPanelScopeLabel(panel)}${panel.gridName ? ` · ${panel.gridName}` : ''}`,
          eyebrow: panel.department || 'Project',
          rows: panel.rows,
          variant: 'panel',
          department: panel.department,
          gridId: panel.gridId,
        });
      });
    });

    return {
      departments: departmentNames,
      gridGroups: panels,
      graphItems: items,
    };
  }, [project, safeData]);

  const focusedGraphKey = useMemo(() => {
    if (focusGridId) {
      return graphItems.find((item) => item.variant === 'panel' && String(item.gridId) === String(focusGridId))?.key || 'all';
    }
    if (focusDepartment) {
      return graphItems.find((item) => item.variant === 'department' && sameText(item.department, focusDepartment))?.key || 'all';
    }
    return 'all';
  }, [focusDepartment, focusGridId, graphItems]);

  const [selectedGraphKey, setSelectedGraphKey] = useState(focusedGraphKey);

  useEffect(() => {
    setSelectedGraphKey(focusedGraphKey);
  }, [focusedGraphKey]);

  useEffect(() => {
    if (selectedGraphKey === 'all') return;
    if (!graphItems.some((item) => item.key === selectedGraphKey)) {
      setSelectedGraphKey('all');
    }
  }, [graphItems, selectedGraphKey]);

  const navigationItems = useMemo(() => [
    { key: 'all', filterLabel: `All Activity Graphs · ${graphItems.length} total` },
    ...graphItems,
  ], [graphItems]);

  const selectedGraphIndex = Math.max(0, navigationItems.findIndex((item) => item.key === selectedGraphKey));
  const selectedGraph = navigationItems[selectedGraphIndex] || navigationItems[0];
  const visibleGraphItems = selectedGraphKey === 'all'
    ? graphItems
    : graphItems.filter((item) => item.key === selectedGraphKey);

  const changeGraph = (nextKey) => {
    setSelectedGraphKey(nextKey);
    window.requestAnimationFrame(() => {
      document.getElementById('activity-graph-filter')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const moveGraph = (direction) => {
    const nextIndex = Math.min(
      navigationItems.length - 1,
      Math.max(0, selectedGraphIndex + direction)
    );
    changeGraph(navigationItems[nextIndex]?.key || 'all');
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Clock3 size={18} />
            </span>
            Department and Panel Activity Graphs
          </h3>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Graphs are displayed three per row on desktop. Use the selector to show all graphs or focus on one department or panel.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600">
            <span className="rounded-full bg-indigo-50 px-2.5 py-1">{departments.length} department graph(s)</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1">{gridGroups.length} panel graph(s)</span>
          </div>
        </div>

        {!loading && graphItems.length > 0 && (
          <div id="activity-graph-filter" className="scroll-mt-28 w-full rounded-xl border border-indigo-100 bg-indigo-50/70 p-2.5 xl:max-w-[660px]">
            <div className="flex min-w-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => moveGraph(-1)}
                disabled={selectedGraphIndex <= 0}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={14} /> <span className="hidden sm:inline">Prev</span>
              </button>

              <select
                value={selectedGraphKey}
                onChange={(event) => changeGraph(event.target.value)}
                className="h-9 min-w-0 flex-1 rounded-lg border border-indigo-300 bg-white px-3 text-xs font-semibold text-indigo-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                aria-label="Select activity graph"
              >
                {navigationItems.map((item, index) => (
                  <option key={item.key} value={item.key}>
                    {index === 0 ? item.filterLabel : `${index}. ${item.filterLabel}`}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => moveGraph(1)}
                disabled={selectedGraphIndex >= navigationItems.length - 1}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="hidden sm:inline">Next</span> <ChevronRight size={14} />
              </button>
            </div>
            <p className="mt-1.5 truncate px-1 text-[10px] font-medium text-indigo-600" title={selectedGraph?.filterLabel}>
              Showing: {selectedGraph?.filterLabel}
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : visibleGraphItems.length > 0 ? (
        <div className={selectedGraphKey === 'all'
          ? 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'
          : 'grid grid-cols-1 gap-4'}
        >
          {visibleGraphItems.map((item) => (
            <SingleActivityGraph
              key={item.key}
              id={item.id}
              title={item.title}
              subtitle={item.subtitle}
              eyebrow={item.eyebrow}
              rows={item.rows}
              focused={selectedGraphKey !== 'all' && item.key === selectedGraphKey}
              variant={item.variant}
              compact={selectedGraphKey === 'all'}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="Activity graphs" />
      )}

      {!loading && graphItems.length > 0 && (
        <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
          Expected uses each task's planned end date. Actual uses the same connected status line: green for completed on time, yellow for in progress, and red for delayed, extended, overdue, on hold, or completed late.
        </div>
      )}
    </section>
  );
};

export default ActivityGraph;
