'use strict';

const express = require('express');
const router  = express.Router();
const {
  getProjects,
  getProject,
  getProjectActivityLog,
  getTaskCompletionHistory,
  getProjectPlanningTemplates,
  getPlanningUsers,
  validatePlanningImport,
  recalculatePlanningPreview,
  createProject,
  copyProject,
  updateProject,
  createSeparatePlanningGrid,
  addPlanningTask,
  updatePlanningTaskStatus,
  updatePlanningTask,
  removePlanningTask,
  reorderPlanningTasks,
  projectDocumentUpload,
  uploadProjectDocuments,
  downloadProjectDocument,
  convertInquiryToProject,
  recalcAllDelays,
} = require('../controllers/projectController');
const { protect } = require('../middleware/authMiddleware');
const {
  requirePermission,
  requireAnyPermission,
  requireProjectLeadershipRole,
} = require('../middleware/permissionMiddleware');
const { PROJECT_PERMISSIONS } = require('../constants/permissions');

const PROJECT_UPDATE_PERMISSIONS = [
  PROJECT_PERMISSIONS.EDIT,
  PROJECT_PERMISSIONS.PLANNING_GRID,
];

const requirePlanningReorderRole = (req, res, next) => {
  const allowedRoles = new Set(['admin', 'hod', 'manager', 'team_lead']);
  if (allowedRoles.has(String(req.user?.role || ''))) return next();

  return res.status(403).json({
    success: false,
    message: 'Only Admin, HOD, and Team Lead users can reorder project planning tasks.',
  });
};

router.use(protect);

router.post(
  '/convert/:inquiryId',
  requireProjectLeadershipRole,
  requirePermission(PROJECT_PERMISSIONS.CREATE),
  convertInquiryToProject
);

router.post(
  '/recalc-delays',
  requirePermission(PROJECT_PERMISSIONS.PLANNING_GRID),
  recalcAllDelays
);

router.get(
  '/planning-templates',
  requirePermission(PROJECT_PERMISSIONS.VIEW),
  getProjectPlanningTemplates
);


router.get(
  '/planning-users',
  requirePermission(PROJECT_PERMISSIONS.VIEW),
  getPlanningUsers
);

router.get(
  '/planning-import/validate',
  requirePermission(PROJECT_PERMISSIONS.VIEW),
  validatePlanningImport
);

router.post(
  '/planning-preview/recalculate',
  requireProjectLeadershipRole,
  requirePermission(PROJECT_PERMISSIONS.PLANNING_GRID),
  recalculatePlanningPreview
);

router.route('/')
  .get(requirePermission(PROJECT_PERMISSIONS.VIEW), getProjects)
  .post(requireProjectLeadershipRole, requirePermission(PROJECT_PERMISSIONS.CREATE), createProject);

router.post(
  '/:id/copy',
  requireProjectLeadershipRole,
  requirePermission(PROJECT_PERMISSIONS.CREATE),
  copyProject
);

router.post(
  '/:id/documents',
  requirePermission(PROJECT_PERMISSIONS.EDIT),
  projectDocumentUpload.array('documents', 10),
  uploadProjectDocuments
);

router.get(
  '/:id/documents/:fileKey',
  requirePermission(PROJECT_PERMISSIONS.VIEW),
  downloadProjectDocument
);


router.post(
  '/:id/planning-grids',
  requireProjectLeadershipRole,
  requirePermission(PROJECT_PERMISSIONS.ADD_DUPLICATE_PLANNING_GRID),
  createSeparatePlanningGrid
);

router.post(
  '/:id/planning-grids/:gridId/tasks',
  requireProjectLeadershipRole,
  requirePermission(PROJECT_PERMISSIONS.PLANNING_GRID),
  addPlanningTask
);

router.patch(
  '/:id/planning-grids/:gridId/tasks/reorder',
  requireProjectLeadershipRole,
  requirePermission(PROJECT_PERMISSIONS.PLANNING_GRID),
  requirePlanningReorderRole,
  reorderPlanningTasks
);

router.patch(
  '/:id/planning-grids/:gridId/tasks/:taskId/status',
  requireAnyPermission(PROJECT_PERMISSIONS.EDIT, PROJECT_PERMISSIONS.PLANNING_GRID),
  updatePlanningTaskStatus
);

router.patch(
  '/:id/planning-grids/:gridId/tasks/:taskId',
  requireProjectLeadershipRole,
  requireAnyPermission(PROJECT_PERMISSIONS.PLANNING_GRID, PROJECT_PERMISSIONS.UPDATE_COMPLETION),
  updatePlanningTask
);

router.delete(
  '/:id/planning-grids/:gridId/tasks/:taskId',
  requireProjectLeadershipRole,
  requirePermission(PROJECT_PERMISSIONS.PLANNING_GRID),
  removePlanningTask
);

router.route('/:id')
  .get(requirePermission(PROJECT_PERMISSIONS.VIEW), getProject)
  .put(requireAnyPermission(...PROJECT_UPDATE_PERMISSIONS), updateProject);

router.get(
  '/:id/activity',
  requirePermission(PROJECT_PERMISSIONS.VIEW),
  getProjectActivityLog
);

router.get(
  '/:id/task-completion-history',
  requirePermission(PROJECT_PERMISSIONS.VIEW),
  getTaskCompletionHistory
);

module.exports = router;
