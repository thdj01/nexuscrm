// const express = require('express');
// const router = express.Router();
// const { getUsers, getUser, createUser, updateUser } = require('../controllers/userController');
// const { protect, authorize } = require('../middleware/authMiddleware');

// router.use(protect);
// router.use(authorize('admin'));

// router.route('/').get(getUsers).post(createUser);
// router.route('/:id').get(getUser).put(updateUser);

// module.exports = router;

'use strict';

const express = require('express');
const router  = express.Router();

const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  updateUserAvatar,
  getKickoffAttendeeUsers,
  getAssignableUsers,
} = require('../controllers/userController');

const { protect, authorize }           = require('../middleware/authMiddleware');
const { avatarUpload }                 = require('../utils/avatarUpload');
const { attachTeamContext, scopeToHierarchy, requirePermission } = require('../middleware/permissionMiddleware');
const { INQUIRY_PERMISSIONS } = require('../constants/permissions');

// ── Every route requires authentication ──────────────────────────────────────
router.use(protect);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/users/kickoff-attendees
//
// Returns every active User Management account for the inquiry kick-off
// multi-select. Access is limited to users allowed to edit inquiries.
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/kickoff-attendees',
  requirePermission(INQUIRY_PERMISSIONS.EDIT),
  getKickoffAttendeeUsers
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/users/assignable
//
// Must be declared BEFORE the authorize('admin') router.use() so that
// non-admin roles can reach it. protect + attachTeamContext + scopeToHierarchy
// provide all the access control this route needs.
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/assignable',
  attachTeamContext,
  scopeToHierarchy(),
  getAssignableUsers
);

// ── All routes below this line are admin-only ─────────────────────────────────
router.use(authorize('admin'));

router.route('/').get(getUsers).post(createUser);
router.post('/:id/avatar', avatarUpload.single('avatar'), updateUserAvatar);
router.route('/:id').get(getUser).put(updateUser);

module.exports = router;