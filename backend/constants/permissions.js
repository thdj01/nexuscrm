'use strict';

const INQUIRY_PERMISSIONS = Object.freeze({
  CREATE: 'Inquiries - Create Inquiry',
  VIEW: 'Inquiries - View Inquiry',
  EDIT: 'Inquiries - Edit Inquiry',
  FOLLOW_UP: 'Inquiries - Follow-up / Reminder',
  COMMERCIAL_SUBMIT: 'Inquiries - Commercial Submit',
});

const PROJECT_PERMISSIONS = Object.freeze({
  CREATE: 'Projects - Create Project',
  VIEW: 'Projects - View Project',
  EDIT: 'Projects - Edit Project',
  PLANNING_GRID: 'Projects - Project Planning Grid',
  ADD_DUPLICATE_PLANNING_GRID: 'Projects - Add Duplicate Planning Grid',
  UPDATE_COMPLETION: 'Projects - Update Completion %',
  MARK_COMPLETED: 'Projects - Mark Completed',
});

const CUSTOMER_PERMISSIONS = Object.freeze({
  CREATE: 'Customers - Create Customer',
  VIEW: 'Customers - View Customer',
  EDIT: 'Customers - Edit Customer',
});

const ALL_INQUIRY_PERMISSIONS = Object.freeze(Object.values(INQUIRY_PERMISSIONS));
const ALL_PROJECT_PERMISSIONS = Object.freeze(Object.values(PROJECT_PERMISSIONS));
const ALL_CUSTOMER_PERMISSIONS = Object.freeze(Object.values(CUSTOMER_PERMISSIONS));

// View access for Inquiry and Project is intentionally universal for every
// authenticated, active user. These keys are always merged into the effective
// Employee Access list and cannot be removed from User Management.
const UNIVERSAL_EMPLOYEE_PERMISSIONS = Object.freeze([
  INQUIRY_PERMISSIONS.VIEW,
  PROJECT_PERMISSIONS.VIEW,
]);

const ALL_EMPLOYEE_PERMISSIONS = Object.freeze([
  ...ALL_INQUIRY_PERMISSIONS,
  ...ALL_PROJECT_PERMISSIONS,
  ...ALL_CUSTOMER_PERMISSIONS,
]);

module.exports = {
  INQUIRY_PERMISSIONS,
  PROJECT_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  ALL_INQUIRY_PERMISSIONS,
  ALL_PROJECT_PERMISSIONS,
  ALL_CUSTOMER_PERMISSIONS,
  UNIVERSAL_EMPLOYEE_PERMISSIONS,
  ALL_EMPLOYEE_PERMISSIONS,
};
