const LEGACY_FEEDER_TYPE_MAP = {
  DOL: 'DOL Starter',
  'Star-Delta': 'Star-Delta Starter',
  VFD: 'VFD Feeder',
  Servo: 'Servo Feeder',
};

export const normalizeOutgoingFeederType = (value) => {
  const cleanValue = String(value || '').trim();
  return LEGACY_FEEDER_TYPE_MAP[cleanValue] || cleanValue;
};

export const createEmptyFeederLoadRow = (srNo = 1) => ({
  srNo,
  loadDescription: '',
  qty: '',
  ratingKwHp: '',
  fullLoadCurrent: '',
  remarks: '',
});

const normalizeRows = (rows = []) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const rowsToUse = safeRows.length ? safeRows : [createEmptyFeederLoadRow(1)];

  return rowsToUse.map((row = {}, index) => ({
    ...createEmptyFeederLoadRow(index + 1),
    ...row,
    srNo: index + 1,
  }));
};

export const hasMeaningfulFeederLoadRows = (rows = []) => (
  Array.isArray(rows) && rows.some((row = {}) => (
    ['loadDescription', 'qty', 'ratingKwHp', 'fullLoadCurrent', 'remarks']
      .some((field) => String(row?.[field] ?? '').trim() !== '')
  ))
);

export const normalizeFeederLoadDetails = ({
  feederTypes = [],
  groups = [],
  legacyRowsByType = {},
} = {}) => {
  const selectedTypes = Array.from(new Set(
    (Array.isArray(feederTypes) ? feederTypes : [])
      .map(normalizeOutgoingFeederType)
      .filter(Boolean)
  ));

  const groupMap = new Map();
  (Array.isArray(groups) ? groups : []).forEach((group = {}) => {
    const feederType = normalizeOutgoingFeederType(group.feederType);
    if (!feederType || groupMap.has(feederType)) return;
    groupMap.set(feederType, group);
  });

  return selectedTypes.map((feederType) => {
    const existingGroup = groupMap.get(feederType) || {};
    const legacyRows = legacyRowsByType?.[feederType];
    const rows = Array.isArray(existingGroup.loadDetails)
      ? existingGroup.loadDetails
      : (Array.isArray(legacyRows) ? legacyRows : []);

    return {
      feederType,
      loadDetails: normalizeRows(rows),
    };
  });
};

export const updateFeederLoadRows = (groups = [], feederType, rows = []) => {
  const normalizedType = normalizeOutgoingFeederType(feederType);
  const safeGroups = Array.isArray(groups) ? groups : [];
  let found = false;

  const nextGroups = safeGroups.map((group = {}) => {
    if (normalizeOutgoingFeederType(group.feederType) !== normalizedType) return group;
    found = true;
    return {
      ...group,
      feederType: normalizedType,
      loadDetails: normalizeRows(rows),
    };
  });

  if (!found && normalizedType) {
    nextGroups.push({
      feederType: normalizedType,
      loadDetails: normalizeRows(rows),
    });
  }

  return nextGroups;
};

export const getFeederLoadRows = (groups = [], feederType) => {
  const normalizedType = normalizeOutgoingFeederType(feederType);
  const group = (Array.isArray(groups) ? groups : []).find(
    (item = {}) => normalizeOutgoingFeederType(item.feederType) === normalizedType
  );
  return Array.isArray(group?.loadDetails) ? group.loadDetails : [];
};

export const getCompatibilityLoadRows = (groups = [], preferredType = '') => {
  const safeGroups = Array.isArray(groups) ? groups : [];
  const preferredRows = getFeederLoadRows(safeGroups, preferredType);
  if (preferredRows.length) return preferredRows;
  return Array.isArray(safeGroups[0]?.loadDetails) ? safeGroups[0].loadDetails : [];
};
