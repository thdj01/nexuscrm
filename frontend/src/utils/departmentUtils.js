const ALIASES = {
  programmer: 'automation',
  program: 'automation',
  programs: 'automation',
  software: 'automation',
  developer: 'automation',
  development: 'automation',
  prod: 'production',
  manufacturing: 'production',
  mfg: 'production',
  admin: 'admin',
  administration: 'admin',
  sales: 'sales',
  sale: 'sales',
  estimation: 'estimation',
  estimate: 'estimation',
  estimator: 'estimation',
  estimates: 'estimation',
  design: 'design',
  designer: 'design',
  electrical: 'electrical',
  electric: 'electrical',
  automation: 'automation',
  purchase: 'purchase',
  procurement: 'purchase',
  qc: 'qc',
  quality: 'qc',
  qualitycontrol: 'qc',
  qa: 'qc',
  production: 'production',
  store: 'store',
  stores: 'store',
  dispatch: 'store',
  despatch: 'store',
  pm: 'pm',
  projectmanagement: 'pm',
  projectmanager: 'pm',
  customer: 'customer',
  all: 'all',
};

export const normalizeDepartmentToken = (value) => {
  const key = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return ALIASES[key] || key;
};

export const departmentTokens = (value) => {
  if (!value) return [];
  return String(value)
    .split(/[\/,+&|]/)
    .map((part) => normalizeDepartmentToken(part.trim()))
    .filter(Boolean);
};

export const departmentAllowsAll = (value) => departmentTokens(value).includes('all');

export const departmentMatchesUserTeam = (department, teamName) => {
  if (!department) return true;
  const deptTokens = departmentTokens(department);
  if (deptTokens.length === 0 || deptTokens.includes('all')) return true;
  const teamTokens = departmentTokens(teamName);
  if (teamTokens.length === 0) return false;
  return deptTokens.some((token) => teamTokens.includes(token));
};

const getDepartmentKey = (value) => {
  if (!value) return '';
  if (typeof value === 'object') {
    return String(value._id || value.id || value.value || value.name || value.code || '').trim();
  }
  return String(value).trim();
};

const equalDepartment = (a, b) => {
  const left = getDepartmentKey(a);
  const right = getDepartmentKey(b);
  if (!left || !right) return false;
  return left.toUpperCase() === right.toUpperCase();
};

export const userMatchesDepartment = (user, department) => {
  if (!department) return true;

  const userDepartmentValues = [
    user?.department,
    user?.departmentName,
    user?.departmentCode,
    ...(Array.isArray(user?.hodDepartments) ? user.hodDepartments : []),
    ...(Array.isArray(user?.hodDepartmentNames) ? user.hodDepartmentNames : []),
    ...(Array.isArray(user?.hodDepartmentInfo)
      ? user.hodDepartmentInfo.flatMap((dept) => [dept?._id, dept?.name, dept?.code])
      : []),
  ];

  if (userDepartmentValues.some((value) => equalDepartment(value, department))) {
    return true;
  }

  const teamName = user?.teamId?.name || user?.teamName || '';
  return departmentMatchesUserTeam(department, teamName);
};

export const filterUsersByDepartment = (users, department) => (
  (users || []).filter((user) => userMatchesDepartment(user, department))
);
