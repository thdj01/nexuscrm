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
  getAssignableUsers,
} = require('../controllers/userController');

const { protect, authorize }           = require('../middleware/authMiddleware');
const { avatarUpload }                 = require('../utils/avatarUpload');
const { attachTeamContext, scopeToHierarchy } = require('../middleware/permissionMiddleware');

// ── Every route requires authentication ──────────────────────────────────────
router.use(protect);

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