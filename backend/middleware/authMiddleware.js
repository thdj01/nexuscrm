// ─────────────────────────────────────────────────────────────────────────────
// backend/middleware/authMiddleware.js  — Phase 1 extended version
// ─────────────────────────────────────────────────────────────────────────────
//
// Changes from original:
//   • protect: populates req.user.teamId and req.user.reportsTo from DB so
//     downstream permission middleware doesn't need a second User query.
//   • authorize: backward-compatible; now also accepts 'hod', 'team_lead'.
//     Existing callers that pass 'admin' or 'manager' continue to work.
//   • New export: authorizeHierarchy — convenience wrapper that accepts a
//     minimum-privilege role and allows all roles at or above it.
//
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

const jwt  = require('jsonwebtoken');
const User = require('../models/User');
const { ROLE_ORDER } = require('../models/User');
const { resolveEffectiveEmployeeAccess } = require('../utils/accessControl');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const createError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.isOperational = true;
  return err;
};

// ─────────────────────────────────────────────────────────────────────────────
// protect — verify JWT and hydrate req.user
// ─────────────────────────────────────────────────────────────────────────────

const protect = async (req, _res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return next(createError('Not authenticated. Please log in.', 401));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return next(createError('Invalid or expired token. Please log in again.', 401));
    }

    // Fetch the full user so permission middleware has current role + teamId.
    // Select the fields needed downstream; exclude password.
    const user = await User.findById(decoded.id)
      .select('name email phone role department hodDepartments teamId reportsTo isActive avatar employeeAccess')
      .lean();

    if (!user) {
      return next(createError('User no longer exists.', 401));
    }

    if (!user.isActive) {
      return next(createError('Your account has been deactivated.', 401));
    }

    // Hydrate effective action permissions from the Employee Access checklist.
    // Existing users without a saved checklist inherit department suggestions,
    // while Inquiry View and Project View remain universal.
    user.employeeAccess = await resolveEffectiveEmployeeAccess(user);

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// authorize — exact role allowlist (backward-compatible)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Restrict access to routes to users with one of the specified roles.
 * Backward-compatible: callers passing 'manager' still work during migration
 * window (mapped to 'hod' | 'team_lead').
 *
 * @param  {...string} roles
 */
const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) {
    return next(createError('Not authenticated.', 401));
  }

  const userRole = req.user.role;

  // Backward-compat: treat legacy 'manager' token as matching 'hod'
  const effectiveRole =
    userRole === 'manager' ? 'hod' : userRole;

  // Treat requested 'manager' in allowlist as matching both 'hod' and 'team_lead'
  const expandedRoles = new Set(roles);
  if (roles.includes('manager')) {
    expandedRoles.add('hod');
    expandedRoles.add('team_lead');
  }

  if (!expandedRoles.has(effectiveRole)) {
    return next(
      createError(
        `Access denied. Required roles: [${[...expandedRoles].join(', ')}]. Your role: ${userRole}.`
      )
    );
  }

  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// authorizeHierarchy — minimum-privilege check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Allow all roles AT OR ABOVE the specified minimum in the hierarchy.
 *
 * ROLE_ORDER (high → low): ['admin', 'hod', 'team_lead', 'employee', 'manager']
 *
 * @example
 *   router.get('/team/tasks', authorizeHierarchy('team_lead'), handler);
 *   // Allows: admin, hod, team_lead
 *   // Denies: employee
 *
 * @param  {string} minimumRole
 */
const authorizeHierarchy = (minimumRole) => (req, _res, next) => {
  if (!req.user) {
    return next(createError('Not authenticated.', 401));
  }

  const userRole    = req.user.role === 'manager' ? 'hod' : req.user.role;
  const userRank    = ROLE_ORDER.indexOf(userRole);
  const minimumRank = ROLE_ORDER.indexOf(minimumRole);

  if (userRank === -1 || minimumRank === -1) {
    return next(createError('Invalid role configuration.', 500));
  }

  if (userRank > minimumRank) {
    return next(
      createError(
        `Access denied. Minimum required role: ${minimumRole}. Your role: ${userRole}.`
      )
    );
  }

  next();
};

// ─────────────────────────────────────────────────────────────────────────────
module.exports = { protect, authorize, authorizeHierarchy };
