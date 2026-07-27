export const INQUIRY_PERMISSIONS = Object.freeze({
  CREATE: 'Inquiries - Create Inquiry',
  VIEW: 'Inquiries - View Inquiry',
  EDIT: 'Inquiries - Edit Inquiry',
  FOLLOW_UP: 'Inquiries - Follow-up / Reminder',
  COMMERCIAL_SUBMIT: 'Inquiries - Commercial Submit',
});

export const PROJECT_PERMISSIONS = Object.freeze({
  CREATE: 'Projects - Create Project',
  VIEW: 'Projects - View Project',
  EDIT: 'Projects - Edit Project',
  PLANNING_GRID: 'Projects - Project Planning Grid',
  ADD_DUPLICATE_PLANNING_GRID: 'Projects - Add Duplicate Planning Grid',
  UPDATE_COMPLETION: 'Projects - Update Completion %',
  MARK_COMPLETED: 'Projects - Mark Completed',
});

export const CUSTOMER_PERMISSIONS = Object.freeze({
  CREATE: 'Customers - Create Customer',
  VIEW: 'Customers - View Customer',
  EDIT: 'Customers - Edit Customer',
});

export const INQUIRY_PERMISSION_OPTIONS = Object.freeze([
  { key: INQUIRY_PERMISSIONS.CREATE, label: 'Create Inquiry' },
  { key: INQUIRY_PERMISSIONS.VIEW, label: 'View Inquiry', universal: true },
  { key: INQUIRY_PERMISSIONS.EDIT, label: 'Edit Inquiry' },
  { key: INQUIRY_PERMISSIONS.FOLLOW_UP, label: 'Follow-up / Reminder' },
  { key: INQUIRY_PERMISSIONS.COMMERCIAL_SUBMIT, label: 'Commercial Submit' },
]);

export const PROJECT_PERMISSION_OPTIONS = Object.freeze([
  { key: PROJECT_PERMISSIONS.CREATE, label: 'Create Project' },
  { key: PROJECT_PERMISSIONS.VIEW, label: 'View Project', universal: true },
  { key: PROJECT_PERMISSIONS.EDIT, label: 'Edit Project' },
  { key: PROJECT_PERMISSIONS.PLANNING_GRID, label: 'Project Planning Grid' },
  { key: PROJECT_PERMISSIONS.ADD_DUPLICATE_PLANNING_GRID, label: 'Add Duplicate Planning Grid' },
  { key: PROJECT_PERMISSIONS.UPDATE_COMPLETION, label: 'Update Completion %' },
  { key: PROJECT_PERMISSIONS.MARK_COMPLETED, label: 'Mark Completed' },
]);

export const CUSTOMER_PERMISSION_OPTIONS = Object.freeze([
  { key: CUSTOMER_PERMISSIONS.CREATE, label: 'Create Customer' },
  { key: CUSTOMER_PERMISSIONS.VIEW, label: 'View Customer' },
  { key: CUSTOMER_PERMISSIONS.EDIT, label: 'Edit Customer' },
]);

export const ALL_INQUIRY_PERMISSIONS = Object.freeze(
  INQUIRY_PERMISSION_OPTIONS.map((item) => item.key)
);

export const ALL_PROJECT_PERMISSIONS = Object.freeze(
  PROJECT_PERMISSION_OPTIONS.map((item) => item.key)
);

export const ALL_CUSTOMER_PERMISSIONS = Object.freeze(
  CUSTOMER_PERMISSION_OPTIONS.map((item) => item.key)
);

export const UNIVERSAL_EMPLOYEE_PERMISSIONS = Object.freeze([
  INQUIRY_PERMISSIONS.VIEW,
  PROJECT_PERMISSIONS.VIEW,
]);

export const ALL_EMPLOYEE_PERMISSIONS = Object.freeze([
  ...ALL_INQUIRY_PERMISSIONS,
  ...ALL_PROJECT_PERMISSIONS,
  ...ALL_CUSTOMER_PERMISSIONS,
]);
