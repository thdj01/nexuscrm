const MANAGER_ROLES = new Set(['admin', 'hod', 'team_lead']);
const ARCHIVE_MANAGER_ROLES = new Set(['admin', 'hod']);

const getId = (value) =>
  value?._id?.toString?.() ?? value?.toString?.() ?? '';

export const isArchiveManager = (currentUser) =>
  ARCHIVE_MANAGER_ROLES.has(currentUser?.role);

export const isProjectTask = (task) => task?.taskSource === 'PROJECT';
export const isUserTask = (task) => !task?.taskSource || task?.taskSource === 'USER';
export const isArchivedTask = (task) => Boolean(task?.isArchived);

export const isTaskOwner = (task, currentUser) => {
  if (!task || !currentUser) return false;
  return getId(task.employee) === getId(currentUser._id);
};

export const canPerformAction = (_action, task, currentUser) => {
  if (!currentUser || !task) return false;
  if (isArchivedTask(task)) return false;

  if (MANAGER_ROLES.has(currentUser.role)) {
    return true;
  }

  return isTaskOwner(task, currentUser);
};

export const canEditTask = (task, currentUser) =>
  canPerformAction('edit', task, currentUser);

export const canDeleteTask = (task, currentUser) => {
  if (!currentUser || !task) return false;
  if (isArchivedTask(task)) return false;
  if (isProjectTask(task)) return false;
  return canPerformAction('delete', task, currentUser);
};

export const canArchiveTask = (task, currentUser) => {
  if (!task || isArchivedTask(task)) return false;
  return isArchiveManager(currentUser);
};

export const canRestoreTask = (task, currentUser) =>
  Boolean(task?.isArchived) && isArchiveManager(currentUser);

export const canDeleteArchivedTask = (task, currentUser) =>
  Boolean(task?.isArchived) && isArchiveManager(currentUser);

export const canEditProjectControlledFields = (task, currentUser) => {
  if (!task || isArchivedTask(task)) return false;
  if (!isProjectTask(task)) return canPerformAction('edit', task, currentUser);
  return isArchiveManager(currentUser);
};

export const canEditProjectWorkFields = (task, currentUser) => {
  if (!task || isArchivedTask(task)) return false;
  if (!isProjectTask(task)) return canPerformAction('edit', task, currentUser);
  return isArchiveManager(currentUser) || isTaskOwner(task, currentUser);
};

export const canDragTask = (task, currentUser) => {
  if (!task || isArchivedTask(task)) return false;
  if (isProjectTask(task)) {
    return isArchiveManager(currentUser) || isTaskOwner(task, currentUser);
  }
  return canPerformAction('drag', task, currentUser);
};
