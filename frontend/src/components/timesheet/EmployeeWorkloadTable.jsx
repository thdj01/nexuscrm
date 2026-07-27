// ─────────────────────────────────────────────────────────────────────────────
// frontend/src/components/timesheet/EmployeeWorkloadTable.jsx
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, ArrowUpDown } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmtHours = (h = 0) => {
  if (!h) return '—';
  const hours = Math.floor(h);
  const mins  = Math.round((h - hours) * 60);
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  return hours > 0 ? `${hours}h` : `${mins}m`;
};

const pct = (part, total) =>
  total > 0 ? `${Math.round((part / total) * 100)}%` : '—';

const barColorFor = (completionPct) =>
  completionPct >= 80 ? 'bg-green-500' : completionPct >= 50 ? 'bg-amber-500' : 'bg-red-400';

// ─────────────────────────────────────────────────────────────────────────────
// Column definitions
// ─────────────────────────────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'name',           label: 'Employee',        align: 'left'  },
  { key: 'totalHours',     label: 'Total Hours',     align: 'right' },
  { key: 'totalTasks',     label: 'Tasks',           align: 'right' },
  { key: 'completedTasks', label: 'Completed',       align: 'right' },
  { key: 'pendingTasks',   label: 'Pending',         align: 'right' },
  { key: 'completion',     label: 'Completion %',    align: 'right', derived: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// SortIcon
// ─────────────────────────────────────────────────────────────────────────────

const SortIcon = ({ active, dir }) => {
  if (!active) return <ChevronsUpDown size={13} className="opacity-30" />;
  return dir === 'asc'
    ? <ChevronUp size={13} className="text-blue-600" />
    : <ChevronDown size={13} className="text-blue-600" />;
};

// ─────────────────────────────────────────────────────────────────────────────
// EmployeeWorkloadTable
//
// Props:
//   workload {Array}   — from fetchWorkload() API:
//                        [{ employeeId, name, email, role,
//                           totalHours, totalTasks, completedTasks, pendingTasks }]
//   loading  {Boolean}
// ─────────────────────────────────────────────────────────────────────────────

const EmployeeWorkloadTable = ({ workload = [], loading = false }) => {
  const [sortKey, setSortKey] = useState('totalHours');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = useMemo(() => {
    const rows = workload.map((e) => ({
      ...e,
      completion: e.totalTasks > 0
        ? Math.round((e.completedTasks / e.totalTasks) * 100)
        : 0,
    }));

    return [...rows].sort((a, b) => {
      const aVal = typeof a[sortKey] === 'string'
        ? a[sortKey].toLowerCase()
        : (a[sortKey] ?? 0);
      const bVal = typeof b[sortKey] === 'string'
        ? b[sortKey].toLowerCase()
        : (b[sortKey] ?? 0);
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [workload, sortKey, sortDir]);

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-2 p-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!workload.length) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        No employee data for the selected filters.
      </div>
    );
  }

  const totals = {
    hours: sorted.reduce((s, r) => s + (r.totalHours || 0), 0),
    tasks: sorted.reduce((s, r) => s + (r.totalTasks || 0), 0),
    completed: sorted.reduce((s, r) => s + (r.completedTasks || 0), 0),
    pending: sorted.reduce((s, r) => s + (r.pendingTasks || 0), 0),
  };

  return (
    <>
      {/* ── Mobile: sort control + stacked cards ─────────────────────────── */}
      <div className="md:hidden">
        <div className="mb-3 flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Sort by</label>
          <select
            value={sortKey}
            onChange={(e) => { setSortKey(e.target.value); setSortDir('desc'); }}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {COLUMNS.map((col) => (
              <option key={col.key} value={col.key}>{col.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            aria-label="Toggle sort direction"
          >
            <ArrowUpDown size={14} />
            {sortDir === 'asc' ? 'Asc' : 'Desc'}
          </button>
        </div>

        <div className="space-y-3">
          {sorted.map((row) => {
            const completionPct = row.completion;
            return (
              <div
                key={row.employeeId}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold uppercase text-blue-700">
                    {(row.name || '?')[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-800">{row.name}</p>
                    <p className="text-xs capitalize text-gray-400">{row.role}</p>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-xs text-gray-400">Total Hours</dt>
                    <dd className="font-semibold text-gray-800">{fmtHours(row.totalHours)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-xs text-gray-400">Tasks</dt>
                    <dd className="text-gray-700">{row.totalTasks}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-xs text-gray-400">Completed</dt>
                    <dd className="font-medium text-green-700">{row.completedTasks}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-xs text-gray-400">Pending</dt>
                    <dd className="font-medium text-amber-700">{row.pendingTasks}</dd>
                  </div>
                </dl>

                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-gray-100">
                    <div
                      className={`h-1.5 rounded-full transition-all ${barColorFor(completionPct)}`}
                      style={{ width: `${completionPct}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-xs font-medium text-gray-600">
                    {pct(row.completedTasks, row.totalTasks)}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Totals card */}
          <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Totals</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-xs text-gray-400">Total Hours</dt>
                <dd className="font-bold text-gray-800">{fmtHours(totals.hours)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-xs text-gray-400">Tasks</dt>
                <dd className="font-bold text-gray-800">{totals.tasks}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-xs text-gray-400">Completed</dt>
                <dd className="font-bold text-green-700">{totals.completed}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-xs text-gray-400">Pending</dt>
                <dd className="font-bold text-amber-700">{totals.pending}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* ── Tablet/Desktop: sortable table ───────────────────────────────── */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`
                    select-none cursor-pointer py-3 px-4 font-semibold text-gray-500
                    hover:text-gray-700 transition-colors whitespace-nowrap
                    ${col.align === 'right' ? 'text-right' : 'text-left'}
                  `}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.align === 'right' && (
                      <SortIcon active={sortKey === col.key} dir={sortDir} />
                    )}
                    {col.label}
                    {col.align === 'left' && (
                      <SortIcon active={sortKey === col.key} dir={sortDir} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50">
            {sorted.map((row) => {
              const completionPct = row.completion;
              const barColor = barColorFor(completionPct);

              return (
                <tr key={row.employeeId} className="hover:bg-gray-50 transition-colors">
                  {/* Employee */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 uppercase">
                        {(row.name || '?')[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 truncate">{row.name}</p>
                        <p className="text-xs text-gray-400 capitalize">{row.role}</p>
                      </div>
                    </div>
                  </td>

                  {/* Total Hours */}
                  <td className="py-3 px-4 text-right font-semibold text-gray-800">
                    {fmtHours(row.totalHours)}
                  </td>

                  {/* Total Tasks */}
                  <td className="py-3 px-4 text-right text-gray-600">
                    {row.totalTasks}
                  </td>

                  {/* Completed */}
                  <td className="py-3 px-4 text-right">
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      {row.completedTasks}
                    </span>
                  </td>

                  {/* Pending */}
                  <td className="py-3 px-4 text-right">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      {row.pendingTasks}
                    </span>
                  </td>

                  {/* Completion % with bar */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-gray-100">
                        <div
                          className={`h-1.5 rounded-full transition-all ${barColor}`}
                          style={{ width: `${completionPct}%` }}
                        />
                      </div>
                      <span className="w-8 text-xs font-medium text-gray-600 text-right">
                        {pct(row.completedTasks, row.totalTasks)}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Totals footer */}
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50">
              <td className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Totals
              </td>
              <td className="py-3 px-4 text-right font-bold text-gray-800">
                {fmtHours(totals.hours)}
              </td>
              <td className="py-3 px-4 text-right font-bold text-gray-800">
                {totals.tasks}
              </td>
              <td className="py-3 px-4 text-right font-bold text-green-700">
                {totals.completed}
              </td>
              <td className="py-3 px-4 text-right font-bold text-amber-700">
                {totals.pending}
              </td>
              <td className="py-3 px-4" />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
};

export default EmployeeWorkloadTable;