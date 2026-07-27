'use strict';

const express = require('express');
const router = express.Router();

const {
  listDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
} = require('../controllers/departmentController');

const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
  .get(listDepartments)
  .post(authorize('admin'), createDepartment);

router.route('/:id')
  .get(getDepartment)
  .put(authorize('admin'), updateDepartment);

module.exports = router;
