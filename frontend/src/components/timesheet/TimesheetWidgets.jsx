// ─────────────────────────────────────────────────────────────────────────────
// frontend/src/components/timesheet/TimesheetWidgets.jsx
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Clock, CheckCircle2, Circle, Users } from 'lucide-react';

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

// ─────────────────────────────────────────────────────────────────────────────
// Single widget card
// ─────────────────────────────────────────────────────────────────────────────

const Widget = ({ icon: Icon, label, value, sub, colorClass, bgClass, loading }) => (
  <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${bgClass}`}>
      {loading
        ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-50" />
        : <Icon size={20} className={colorClass} />
      }
    </div>
    <div className="min-w-0">
      <p className="truncate text-xs font-medium text-gray-500">{label}</p>
      {loading
        ? <div className="mt-1 h-6 w-16 animate-pulse rounded bg-gray-100" />
        : <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
      }
      {sub && !loading && (
        <p className="text-xs text-gray-400">{sub}</p>
      )}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// TimesheetWidgets
//
// Props:
//   summary  {Object}  — from fetchSummary() API:
//                        { totalHours, totalTasks, pendingTasks,
//                          completedTasks, utilizationPct, statusBreakdown }
//   workload {Array}   — from fetchWorkload() API, used for activeEmployees
//   loading  {Boolean}
// ─────────────────────────────────────────────────────────────────────────────

const TimesheetWidgets = ({ summary = {}, workload = [], loading = false }) => {
  const activeEmployees = workload.filter((e) => (e.totalHours || 0) > 0).length;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Widget
        icon={Clock}
        label="Total Hours"
        value={fmtHours(summary.totalHours)}
        sub={summary.utilizationPct != null ? `${summary.utilizationPct}% utilization` : undefined}
        colorClass="text-blue-600"
        bgClass="bg-blue-50"
        loading={loading}
      />
      <Widget
        icon={CheckCircle2}
        label="Completed Tasks"
        value={summary.completedTasks ?? 0}
        sub={summary.totalTasks ? `of ${summary.totalTasks} total` : undefined}
        colorClass="text-green-600"
        bgClass="bg-green-50"
        loading={loading}
      />
      <Widget
        icon={Circle}
        label="Pending Tasks"
        value={summary.pendingTasks ?? 0}
        colorClass="text-amber-600"
        bgClass="bg-amber-50"
        loading={loading}
      />
      <Widget
        icon={Users}
        label="Active Employees"
        value={activeEmployees}
        sub="with logged hours"
        colorClass="text-purple-600"
        bgClass="bg-purple-50"
        loading={loading}
      />
    </div>
  );
};

export default TimesheetWidgets;
