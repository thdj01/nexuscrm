import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';

import { fetchKanbanTasks, fetchAssignableUsers } from '../../api/timesheetService';
import { useToast }         from '../../context/ToastContext';
import { Card, CardBody }   from '../common/FormComponents';
import KanbanBoard          from './KanbanBoard';

const TimesheetKanbanView = () => {
  const toast = useToast();
  const { filters, refreshKey, onEdit, currentUser } = useOutletContext();
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

  const [tasks,   setTasks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [users,   setUsers]   = useState([]);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus)   params.status   = filterStatus;
      if (filterTaskType) params.taskType = filterTaskType;
      if (filterFrom)     params.from     = filterFrom;
      if (filterTo)       params.to       = filterTo;
      if (filterTeam)     params.teamId   = filterTeam;
      if (filterProject)  params.project  = filterProject;
      if (filterArchived && filterArchived !== 'active') params.archived = filterArchived;
      if (filterTaskSource) params.taskSource = filterTaskSource;

      const [taskResult, userResult] = await Promise.all([
        fetchKanbanTasks(params),
        fetchAssignableUsers(),
      ]);

      setTasks(taskResult.tasks ?? []);
      setUsers(userResult.users ?? []);
    } catch {
      toast.error('Failed to load kanban tasks');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterTaskType, filterFrom, filterTo, filterTeam, filterProject, filterArchived, filterTaskSource]);

  useEffect(() => { loadTasks(); }, [loadTasks, refreshKey]);

  // ── Visible user list ──────────────────────────────────────────────────────
  // fetchAssignableUsers() always returns the full hierarchy-scoped user list,
  // unaffected by the team filter.  When a team filter is active we restrict
  // the list here so KanbanBoard only renders lanes for members of that team.
  // When no team filter is set every scoped user gets a lane (including those
  // with 0 tasks).  Additional filters (status, date, project, type) never
  // touch this list — they only affect `tasks`, so team member lanes persist.
  //
  // user.team is either a populated object { _id, name } or a raw ObjectId
  // string, so we normalise both shapes with the nullish chain below.

  const visibleUsers = useMemo(() => {
    if (!filterTeam) return users;

    return users.filter((u) => {
      const teamId = u?.teamId?._id ?? u?.teamId;
      return String(teamId) === String(filterTeam);
    });
  }, [users, filterTeam]);

  const handleKanbanChange = useCallback((updatedTasks) => {
    setTasks(updatedTasks);
  }, []);

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

  return (
    <Card className="overflow-hidden">
      <CardBody className="p-2 sm:p-4 lg:p-6">
        <KanbanBoard
          tasks={tasks}
          users={visibleUsers}
          onEdit={onEdit}
          onChange={handleKanbanChange}
          currentUser={currentUser}
        />
      </CardBody>
    </Card>
  );
};

export default TimesheetKanbanView;
