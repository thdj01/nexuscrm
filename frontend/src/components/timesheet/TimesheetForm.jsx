// frontend/src/components/timesheet/TimesheetForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, User as UserIcon, Lock, Archive } from 'lucide-react';
import { FormField, Input, Select, Textarea, Button } from '../common/FormComponents';
import { useAuth } from '../../context/AuthContext';
import { fetchAssignableUsers } from '../../api/timesheetService';
import API from '../../api/axios';
import {
  canEditProjectControlledFields,
  canEditProjectWorkFields,
  isArchivedTask,
  isProjectTask,
  isArchiveManager,
} from './timesheetPermissions';

// ─────────────────────────────────────────────────────────────────────────────
// Constants — must stay in sync with backend enums
// ─────────────────────────────────────────────────────────────────────────────

export const TASK_TYPES = [
  'Development',
  'Design',
  'Meeting',
  'Review',
  'Testing',
  'Documentation',
  'Support',
  'Other',
];

export const TASK_STATUSES = [
  'Backlog',
  'Planned',
  'In Progress',
  'Review',
  'Completed',
];

const ROLE_LABELS = {
  admin:     'Admin',
  hod:       'HOD',
  team_lead: 'Team Lead',
  employee:  'Employee',
};

const todayISO = () => new Date().toISOString().split('T')[0];

const timeToMinutes = (time) => {
  if (!time) return null;
  const [hours, minutes] = String(time).split(':').map(Number);
  if ([hours, minutes].some(Number.isNaN)) return null;
  return hours * 60 + minutes;
};

const minutesToTime = (minutes) => {
  const safeMinutes = Math.max(0, Math.min(23 * 60 + 59, minutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const getDefaultStartTime = () => {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutesToTime(Math.floor(minutes / 30) * 30);
};

const getDefaultEndTime = (startTime) => {
  const startMinutes = timeToMinutes(startTime);
  if (startMinutes === null) return '';
  return minutesToTime(startMinutes + 30);
};

const calcHoursValue = (start, end) => {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return null;
  const diff = endMinutes - startMinutes;
  return diff > 0 ? Math.round((diff / 60) * 100) / 100 : null;
};

const normalizeHoursInput = (value) => {
  if (value === '' || value === null || value === undefined) return '';
  const raw = String(value).replace(',', '.');
  if (!/^\d*\.?\d*$/.test(raw)) return null;
  return raw;
};

const addHoursToTime = (startTime, hoursValue) => {
  const startMinutes = timeToMinutes(startTime);
  const hours = Number(hoursValue);
  if (startMinutes === null || Number.isNaN(hours) || hours <= 0) return '';
  return minutesToTime(startMinutes + Math.round(hours * 60));
};

const formatDecimalHours = (value) => {
  if (value === '' || value === null || value === undefined || Number.isNaN(Number(value))) return '';
  return String(Math.round(Number(value) * 100) / 100);
};

const formatHours = (value) => {
  if (value === '' || value === null || value === undefined || Number.isNaN(Number(value))) return '';
  const totalMinutes = Math.round(Number(value) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
};

const getId = (value) =>
  value?._id?.toString?.() ??
  value?.toString?.() ??
  '';

const getUserTeamId = (user) =>
  user?.teamId?._id?.toString?.() ??
  user?.teamId?.toString?.() ??
  '';

const getTeamOption = (team) => {
  const id = getId(team);
  if (!id) return null;

  return {
    _id: id,
    name: team?.name ?? 'Employee Team',
  };
};

const mergeTeamOptions = (...teamLists) => {
  const teamMap = new Map();

  teamLists.flat().forEach((team) => {
    const option = getTeamOption(team);
    if (!option) return;

    const existing = teamMap.get(option._id);
    if (!existing || existing.name === 'Employee Team') {
      teamMap.set(option._id, option);
    }
  });

  return [...teamMap.values()].sort((a, b) => a.name.localeCompare(b.name));
};

const validate = (form, mode = {}) => {
  const errors = {};

  if (!mode.projectWorkOnly) {
    if (!form.title.trim())   errors.title    = 'Title is required';
    if (!form.taskType)       errors.taskType = 'Task type is required';
    if (!form.date)           errors.date     = 'Date is required';
  }

  if (!form.status) errors.status = 'Status is required';

  const requiresTimeRange = mode.requireTimeRange || form.startTime || form.endTime;

  if (requiresTimeRange && !form.startTime) {
    errors.startTime = 'Start time is required';
  }

  if (requiresTimeRange && !form.endTime) {
    errors.endTime = 'End time is required';
  }

  if (form.startTime && form.endTime && calcHoursValue(form.startTime, form.endTime) === null) {
    errors.endTime = 'End time must be after start time';
  }

  if (form.hours !== '' && isNaN(Number(form.hours))) {
    errors.hours = 'Hours must be a number';
  }

  if (form.hours !== '' && Number(form.hours) <= 0) {
    errors.hours = 'Hours must be greater than 0';
  }

  return errors;
};

const SourceBadge = ({ task }) => {
  const project = isProjectTask(task);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${project ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
      {project ? 'PROJECT' : 'USER'}
    </span>
  );
};

const ArchivedBadge = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">
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
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}>{status}</span>;
};

const TimesheetForm = ({ initialData, onSubmit, onCancel, loading = false }) => {
  const { user } = useAuth();
  const isEdit = Boolean(initialData?._id);
  const projectTask = isProjectTask(initialData);
  const archived = isArchivedTask(initialData);
  const archiveManager = isArchiveManager(user);

  const canAssign = user?.role === 'admin' || user?.role === 'hod' || user?.role === 'team_lead';
  const canEditControlled = !isEdit || canEditProjectControlledFields(initialData, user);
  const canEditWork = !isEdit || canEditProjectWorkFields(initialData, user);
  const readOnly = archived || (projectTask && !canEditControlled && !canEditWork);
  const projectWorkOnly = isEdit && projectTask && !archiveManager;

  const [projects, setProjects] = useState([]);
  const [projLoading, setProjLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    setProjLoading(true);
    try {
      const { data } = await API.get('/projects', { params: { limit: 200 } });
      setProjects(data.data ?? data.projects ?? []);
    } catch {
      // Non-critical
    } finally {
      setProjLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const [assignableUsers, setAssignableUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [teams, setTeams] = useState([]);

  const loadAssignableUsers = useCallback(async () => {
    if (!canAssign) return;
    setUsersLoading(true);
    try {
      const data = await fetchAssignableUsers();
      const users = data.users ?? [];
      setAssignableUsers(users);

      let scopedTeams = [];
      try {
        const teamResponse = await API.get('/teams');
        scopedTeams = teamResponse.data?.teams ?? teamResponse.data?.data ?? [];
      } catch {
        scopedTeams = [];
      }

      setTeams(mergeTeamOptions(
        scopedTeams,
        users.map((u) => u.teamId),
        [initialData?.employee?.teamId]
      ));
    } catch {
      // Non-critical
    } finally {
      setUsersLoading(false);
    }
  }, [canAssign, initialData?.employee?.teamId]);

  useEffect(() => { loadAssignableUsers(); }, [loadAssignableUsers]);

  const [defaultTimeRange] = useState(() => {
    const startTime = getDefaultStartTime();
    return {
      startTime,
      endTime: getDefaultEndTime(startTime),
    };
  });

  const [form, setForm] = useState(() => {
    const existingEmployee = getId(initialData?.employee);

    return {
      title:           initialData?.title ?? '',
      description:     initialData?.description ?? '',
      employeeRemarks: initialData?.employeeRemarks ?? '',
      project:         initialData?.project?._id ?? initialData?.project ?? '',
      taskType:        initialData?.taskType ?? 'Development',
      date:            initialData?.date
        ? new Date(initialData.date).toISOString().split('T')[0]
        : todayISO(),
      startTime:       initialData?.startTime ?? '',
      endTime:         initialData?.endTime ?? '',
      hours:           initialData?.hours != null ? String(initialData.hours) : '',
      status:          initialData?.status ?? 'Backlog',
      kanbanOrder:     initialData?.kanbanOrder ?? 0,
      assignee:        canAssign ? existingEmployee : '',
    };
  });

  useEffect(() => {
    if (!canAssign) return;

    const assignedEmployeeId = form.assignee || getId(initialData?.employee);
    if (!assignedEmployeeId) return;

    const assignedUser = assignableUsers.find((u) => getId(u) === assignedEmployeeId);
    const assignedTeamId =
      getUserTeamId(assignedUser) ||
      getUserTeamId(initialData?.employee);

    if (assignedTeamId && assignedTeamId !== selectedTeam) {
      setSelectedTeam(assignedTeamId);
    }
  }, [assignableUsers, canAssign, form.assignee, initialData?.employee, selectedTeam]);

  const [errors, setErrors] = useState({});
  const calculatedHours = calcHoursValue(form.startTime, form.endTime);
  const defaultHours = calcHoursValue(defaultTimeRange.startTime, defaultTimeRange.endTime);
  const hoursSummary = form.hours !== '' && !Number.isNaN(Number(form.hours))
    ? formatHours(Number(form.hours))
    : '';

  const getSubmitForm = () => {
    if (!isEdit && !form.startTime && !form.endTime) {
      const startTime = defaultTimeRange.startTime;
      const hours = form.hours !== '' && !Number.isNaN(Number(form.hours))
        ? Number(form.hours)
        : calcHoursValue(defaultTimeRange.startTime, defaultTimeRange.endTime);
      return {
        ...form,
        startTime,
        endTime: hours ? addHoursToTime(startTime, hours) : defaultTimeRange.endTime,
        hours: hours !== null ? String(hours) : form.hours,
      };
    }

    if (form.startTime && !form.endTime && form.hours !== '' && !Number.isNaN(Number(form.hours))) {
      return {
        ...form,
        endTime: addHoursToTime(form.startTime, form.hours),
      };
    }

    return form;
  };

  const filteredUsers =
    (user?.role === 'admin' || user?.role === 'hod') && selectedTeam
      ? assignableUsers.filter((u) => getUserTeamId(u) === selectedTeam)
      : assignableUsers;

  const set = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      const nextHours = calcHoursValue(next.startTime, next.endTime);
      if ((field === 'startTime' || field === 'endTime') && nextHours !== null) {
        next.hours = formatDecimalHours(nextHours);
      }
      return next;
    });

    if (errors[field] || (field === 'startTime' && errors.endTime) || (field === 'endTime' && errors.hours)) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        if (field === 'startTime' || field === 'endTime') {
          delete next.startTime;
          delete next.endTime;
          delete next.hours;
        }
        return next;
      });
    }
  };

  const handleHoursChange = (e) => {
    const normalized = normalizeHoursInput(e.target.value);
    if (normalized === null) return;

    setForm((prev) => {
      const next = { ...prev, hours: normalized };
      const numericHours = Number(normalized);

      if (normalized !== '' && !Number.isNaN(numericHours) && numericHours > 0) {
        const startTime = prev.startTime || defaultTimeRange.startTime;
        next.startTime = startTime;
        next.endTime = addHoursToTime(startTime, numericHours);
      }

      return next;
    });

    if (errors.hours || errors.startTime || errors.endTime) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.hours;
        delete next.startTime;
        delete next.endTime;
        return next;
      });
    }
  };

  const handleSubmit = () => {
    if (archived) return;

    const submitForm = getSubmitForm();
    const submitCalculatedHours = calcHoursValue(submitForm.startTime, submitForm.endTime);
    const errs = validate(submitForm, { projectWorkOnly, requireTimeRange: !isEdit });
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    if (projectWorkOnly) {
      const payload = {
        status: submitForm.status,
        employeeRemarks: submitForm.employeeRemarks.trim(),
      };
      if (submitForm.startTime) payload.startTime = submitForm.startTime;
      if (submitForm.endTime) payload.endTime = submitForm.endTime;
      if (submitCalculatedHours !== null) {
        payload.hours = submitCalculatedHours;
      } else if (submitForm.hours !== '') {
        payload.hours = Number(submitForm.hours);
      }
      onSubmit(payload);
      return;
    }

    const payload = {
      title:           submitForm.title.trim(),
      description:     submitForm.description.trim(),
      employeeRemarks: submitForm.employeeRemarks.trim(),
      taskType:        submitForm.taskType,
      date:            submitForm.date,
      status:          submitForm.status,
      kanbanOrder:     Number(submitForm.kanbanOrder),
    };

    if (submitForm.project) payload.project = submitForm.project;
    if (submitForm.startTime) payload.startTime = submitForm.startTime;
    if (submitForm.endTime) payload.endTime = submitForm.endTime;

    if (submitCalculatedHours !== null) {
      payload.hours = submitCalculatedHours;
    } else if (submitForm.hours !== '') {
      payload.hours = Number(submitForm.hours);
    }

    if (canAssign && submitForm.assignee) {
      payload.employee = submitForm.assignee;
    }

    onSubmit(payload);
  };

  return (
    <div className="space-y-5">
      {isEdit && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <SourceBadge task={initialData} />
          {archived && <ArchivedBadge />}
          {archiveManager && projectTask && <SyncBadge status={initialData?.syncStatus} />}
          {projectTask && !archiveManager && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
              <Lock size={11} /> Project-controlled task
            </span>
          )}
        </div>
      )}

      {archived && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          This task is archived and is read-only. Only Admin/HOD can restore or permanently delete it.
        </div>
      )}

      <FormField label="Task Title" required error={errors.title}>
        <Input
          value={form.title}
          onChange={set('title')}
          placeholder="e.g. Design MCC panel layout"
          autoFocus={!readOnly}
          disabled={!canEditControlled || archived}
        />
      </FormField>

      <FormField label="Project Planning Remark">
        <Textarea
          value={form.description}
          onChange={set('description')}
          placeholder="Optional details about this task..."
          rows={3}
          disabled={!canEditControlled || archived}
        />
      </FormField>

      {projectTask && (
        <FormField label="Employee Work Remarks">
          <Textarea
            value={form.employeeRemarks}
            onChange={set('employeeRemarks')}
            placeholder="Add your work remarks..."
            rows={3}
            disabled={!canEditWork || archived}
          />
        </FormField>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Project">
          <Select value={form.project} onChange={set('project')} disabled={projLoading || !canEditControlled || archived}>
            <option value="">— No Project —</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>
                {p.projectId ? `${p.projectId} — ` : ''}{p.projectName}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Task Type" required error={errors.taskType}>
          <Select value={form.taskType} onChange={set('taskType')} disabled={!canEditControlled || archived}>
            {TASK_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </FormField>
      </div>

      {canAssign && (
        <div className="space-y-4">
          {(user?.role === 'admin' || user?.role === 'hod') && (
            <FormField label="Team">
              <Select
                value={selectedTeam}
                onChange={(e) => {
                  setSelectedTeam(e.target.value);
                  setForm((prev) => ({ ...prev, assignee: '' }));
                }}
                disabled={!canEditControlled || archived}
              >
                <option value="">Select Team</option>
                {teams.map((team) => (
                  <option key={team._id} value={team._id}>{team.name}</option>
                ))}
              </Select>
            </FormField>
          )}

          <FormField
            label={
              <span className="flex items-center gap-1.5">
                <UserIcon size={13} className="text-gray-400" />
                Assign To
              </span>
            }
          >
            <Select
              value={form.assignee}
              onChange={set('assignee')}
              disabled={
                usersLoading ||
                !canEditControlled ||
                archived
              }
            >
              <option value="">{usersLoading ? 'Loading users...' : '— Assign to self —'}</option>
              {filteredUsers.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                  {u.role && u.role !== 'employee'
                    ? ` (${ROLE_LABELS[u.role] ?? u.role})`
                    : ''}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-gray-400">Leave blank to assign to yourself.</p>
          </FormField>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Date" required error={errors.date}>
          <Input type="date" value={form.date} onChange={set('date')} disabled={!canEditControlled || archived} />
        </FormField>

        <FormField label="Status" required error={errors.status}>
          <Select value={form.status} onChange={set('status')} disabled={!canEditWork || archived}>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Time Tracking
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField label="Start Time" error={errors.startTime}>
            <Input
              type="time"
              value={form.startTime}
              onChange={set('startTime')}
              disabled={!canEditWork || archived}
              className={!form.startTime ? 'text-gray-400' : ''}
            />
          </FormField>

          <FormField label="End Time" error={errors.endTime}>
            <Input
              type="time"
              value={form.endTime}
              onChange={set('endTime')}
              disabled={!canEditWork || archived}
              className={!form.endTime ? 'text-gray-400' : ''}
            />
          </FormField>

          <FormField label="Hours" error={errors.hours}>
            <Input
              type="number"
              min="0.01"
              step="0.25"
              value={form.hours}
              onChange={handleHoursChange}
              disabled={!canEditWork || archived}
              className="bg-white text-gray-900"
              placeholder={`Default ${formatHours(defaultHours)} if blank`}
            />
          </FormField>
        </div>

        <p className="mt-2 text-xs text-gray-500">
          {hoursSummary
            ? `Selected duration: ${hoursSummary}. You can enter hours directly or select start/end time.`
            : `Leave times and hours blank to use the current default slot ${defaultTimeRange.startTime}–${defaultTimeRange.endTime}.`}
        </p>

        {form.startTime && form.endTime && calculatedHours === null && !archived && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle size={11} />
            End time must be after start time.
          </p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onCancel} disabled={loading} className="w-full sm:w-auto">
          {archived ? 'Close' : 'Cancel'}
        </Button>
        {!archived && canEditWork && (
          <Button onClick={handleSubmit} loading={loading} className="w-full sm:w-auto">
            {isEdit ? 'Save Changes' : 'Create Task'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default TimesheetForm;
