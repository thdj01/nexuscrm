'use strict';

const mongoose = require('mongoose');
const Department = require('../models/Department');
const User = require('../models/User');

const ok = (res, data, status = 200) => res.status(status).json({ success: true, ...data });
const fail = (res, message, status = 400) => res.status(status).json({ success: false, message });

const cleanUpper = (value) => String(value || '').trim().toUpperCase();

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));

const normalizeHodArray = (value) => {
  if (!value) return [];

  const rawValues = Array.isArray(value) ? value : [value];
  const seen = new Set();

  return rawValues
    .map((item) => String(item?._id || item?.id || item || '').trim())
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
};

const validateActiveUsers = async (userIds = [], label = 'selected users') => {
  const ids = normalizeHodArray(userIds);
  if (ids.length === 0) return null;

  const invalidId = ids.find((id) => !isValidObjectId(id));
  if (invalidId) return `Invalid ${label} user id`;

  const users = await User.find({ _id: { $in: ids }, isActive: true })
    .select('_id name role isActive')
    .lean();

  if (users.length !== ids.length) {
    return `One or more ${label} users were not found or are inactive`;
  }

  return null;
};

const syncDepartmentHodUserOwnership = async ({ departmentId, previousHods = [], nextHods = [] }) => {
  if (!departmentId) return;

  const departmentObjectId = new mongoose.Types.ObjectId(departmentId);
  const departmentIdString = departmentObjectId.toString();
  const pullValues = [departmentIdString, departmentObjectId];

  const previousSet = new Set(normalizeHodArray(previousHods));
  const nextSet = new Set(normalizeHodArray(nextHods));

  const removedHods = [...previousSet].filter((hodId) => !nextSet.has(hodId));
  const nextHodIds = [...nextSet];

  if (removedHods.length > 0) {
    await User.updateMany(
      { _id: { $in: removedHods } },
      { $pull: { hodDepartments: { $in: pullValues } } }
    );
  }

  if (nextHodIds.length === 0) return;

  await User.updateMany(
    { _id: { $in: nextHodIds } },
    { $addToSet: { hodDepartments: departmentIdString } }
  );
};

const buildDepartmentPayload = (body = {}, reqUser = null) => {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    payload.name = cleanUpper(body.name);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'code')) {
    payload.code = cleanUpper(body.code);
  }

  if (
    Object.prototype.hasOwnProperty.call(body, 'hods') ||
    Object.prototype.hasOwnProperty.call(body, 'hod')
  ) {
    const hods = normalizeHodArray(
      Object.prototype.hasOwnProperty.call(body, 'hods') ? body.hods : body.hod
    );

    payload.hods = hods;
    payload.hod = hods[0] || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'teamLead')) {
    const teamLead = String(body.teamLead?._id || body.teamLead?.id || body.teamLead || '').trim();
    payload.teamLead = teamLead || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'isActive')) {
    payload.isActive = body.isActive === true || body.isActive === 'true';
  }

  if (reqUser?._id && !Object.prototype.hasOwnProperty.call(payload, 'createdBy')) {
    payload.createdBy = reqUser._id;
  }

  return payload;
};

const findDuplicate = async ({ name, code, excludeId = null }) => {
  const conditions = [];
  if (name) conditions.push({ name: cleanUpper(name) });
  if (code) conditions.push({ code: cleanUpper(code) });
  if (!conditions.length) return null;

  const query = { $or: conditions };
  if (excludeId) query._id = { $ne: excludeId };

  return Department.findOne(query).lean();
};

const duplicateMessage = (duplicate, payload = {}) => {
  if (!duplicate) return '';
  if (payload.name && duplicate.name === cleanUpper(payload.name)) {
    return 'Department name already exists';
  }
  if (payload.code && duplicate.code === cleanUpper(payload.code)) {
    return 'Department code already exists';
  }
  return 'Department already exists';
};

const listDepartments = async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === 'true' && req.user?.role === 'admin';
    const search = String(req.query.search || '').trim();

    const query = includeInactive ? {} : { isActive: true };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }

    const departments = await Department.find(query)
      .populate('hod', 'name email role avatar isActive')
      .populate('hods', 'name email role avatar isActive')
      .populate('teamLead', 'name email role avatar isActive')
      .populate('createdBy', 'name email')
      .sort({ name: 1 })
      .lean();

    return ok(res, { data: departments });
  } catch (err) {
    next(err);
  }
};

const getDepartment = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) return fail(res, 'Invalid department id', 400);

    const department = await Department.findById(req.params.id)
      .populate('hod', 'name email role avatar isActive')
      .populate('hods', 'name email role avatar isActive')
      .populate('teamLead', 'name email role avatar isActive')
      .populate('createdBy', 'name email')
      .lean();

    if (!department) return fail(res, 'Department not found', 404);

    return ok(res, { data: department });
  } catch (err) {
    next(err);
  }
};

const createDepartment = async (req, res, next) => {
  try {
    const payload = buildDepartmentPayload(req.body, req.user);

    if (!payload.name) return fail(res, 'Department name is required');
    if (!payload.code) return fail(res, 'Department code is required');

    const duplicate = await findDuplicate(payload);
    if (duplicate) return fail(res, duplicateMessage(duplicate, payload), 409);

    const hodValidationError = await validateActiveUsers(payload.hods || [], 'HOD');
    if (hodValidationError) return fail(res, hodValidationError, 400);

    const teamLeadValidationError = await validateActiveUsers(
      payload.teamLead ? [payload.teamLead] : [],
      'Team Lead'
    );
    if (teamLeadValidationError) return fail(res, teamLeadValidationError, 400);

    const department = await Department.create(payload);
    await syncDepartmentHodUserOwnership({
      departmentId: department._id,
      previousHods: [],
      nextHods: department.hods || [],
    });
    const saved = await Department.findById(department._id)
      .populate('hod', 'name email role avatar isActive')
      .populate('hods', 'name email role avatar isActive')
      .populate('teamLead', 'name email role avatar isActive')
      .populate('createdBy', 'name email')
      .lean();

    return ok(res, { data: saved }, 201);
  } catch (err) {
    if (err.code === 11000) {
      return fail(res, 'Department name or code already exists', 409);
    }
    next(err);
  }
};

const updateDepartment = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) return fail(res, 'Invalid department id', 400);

    const department = await Department.findById(req.params.id);
    if (!department) return fail(res, 'Department not found', 404);

    const previousHods = Array.isArray(department.hods) && department.hods.length > 0
      ? department.hods.map((hodId) => hodId.toString())
      : (department.hod ? [department.hod.toString()] : []);
    const payload = buildDepartmentPayload(req.body, req.user);

    if (payload.isActive === false) {
      payload.hod = null;
      payload.hods = [];
      payload.teamLead = null;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'name') && !payload.name) {
      return fail(res, 'Department name is required');
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'code') && !payload.code) {
      return fail(res, 'Department code is required');
    }

    const duplicate = await findDuplicate({
      name: payload.name,
      code: payload.code,
      excludeId: department._id,
    });
    if (duplicate) return fail(res, duplicateMessage(duplicate, payload), 409);

    const hodValidationError = await validateActiveUsers(payload.hods || [], 'HOD');
    if (hodValidationError) return fail(res, hodValidationError, 400);

    const teamLeadValidationError = await validateActiveUsers(
      payload.teamLead ? [payload.teamLead] : [],
      'Team Lead'
    );
    if (teamLeadValidationError) return fail(res, teamLeadValidationError, 400);

    Object.entries(payload).forEach(([key, value]) => {
      if (key !== 'createdBy') department[key] = value;
    });

    await department.save();
    await syncDepartmentHodUserOwnership({
      departmentId: department._id,
      previousHods,
      nextHods: department.hods || [],
    });

    const saved = await Department.findById(department._id)
      .populate('hod', 'name email role avatar isActive')
      .populate('hods', 'name email role avatar isActive')
      .populate('teamLead', 'name email role avatar isActive')
      .populate('createdBy', 'name email')
      .lean();

    return ok(res, { data: saved });
  } catch (err) {
    if (err.code === 11000) {
      return fail(res, 'Department name or code already exists', 409);
    }
    next(err);
  }
};


module.exports = {
  listDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
};
