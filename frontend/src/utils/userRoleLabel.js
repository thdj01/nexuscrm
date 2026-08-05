const ROLE_LABELS = {
  admin: 'Admin',
  hod: 'HOD',
  manager: 'Manager',
  team_lead: 'Team Lead',
  employee: 'Employee',
};

const DEPARTMENT_ACRONYMS = new Set([
  'AI',
  'HR',
  'IT',
  'MCC',
  'PCC',
  'PLC',
  'PM',
  'QA',
  'QC',
  'R&D',
  'VFD',
]);

const isObjectIdLike = (value) => /^[a-f\d]{24}$/i.test(String(value || '').trim());

const cleanDepartmentName = (value) => {
  if (!value) return '';

  if (typeof value === 'object') {
    return cleanDepartmentName(
      value.name ||
      value.departmentName ||
      value.label ||
      value.code ||
      value.value ||
      ''
    );
  }

  const text = String(value).trim();
  if (!text || isObjectIdLike(text)) return '';

  return text
    .split(/(\s+|[&/+,-])/)
    .map((part) => {
      if (!part || /^\s+$/.test(part) || /^[&/+,-]$/.test(part)) return part;

      const upper = part.toUpperCase();
      if (DEPARTMENT_ACRONYMS.has(upper)) return upper;

      return `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
};

const uniqueNames = (values = []) => {
  const seen = new Set();

  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map(cleanDepartmentName)
    .filter(Boolean)
    .filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const joinDepartmentNames = (names = []) => {
  if (names.length <= 1) return names[0] || '';
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
};

export const getRoleLabel = (role) => ROLE_LABELS[role] || role || 'User';

export const getUserDepartmentNames = (user = {}) => {
  const isHod = user?.role === 'hod' || user?.role === 'manager';

  if (isHod) {
    const hodNames = uniqueNames([
      user?.hodDepartmentNames,
      (user?.hodDepartmentInfo || []).map((department) => department?.name || department?.code),
      user?.hodDepartments,
    ]);

    if (hodNames.length > 0) return hodNames;
  }

  return uniqueNames([
    user?.departmentName,
    user?.departmentInfo?.name,
    user?.departmentInfo?.code,
    user?.department,
    user?.teamName,
    user?.team?.name,
    user?.teamId?.name,
  ]);
};

export const getUserRoleDepartmentLabel = (user = {}) => {
  const role = getRoleLabel(user?.role);

  // Admin is intentionally global and should not show a misleading department.
  if (user?.role === 'admin') return role;

  const departments = joinDepartmentNames(getUserDepartmentNames(user));
  return departments ? `${role} - ${departments}` : role;
};

export { cleanDepartmentName, joinDepartmentNames };
