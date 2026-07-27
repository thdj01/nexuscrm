import {
  defaultMainIncomerDetails,
  normalizeInquiryPanelType,
  normalizeInquiryPanelTypes,
} from '../data/inquiryMasterData';

export const MAIN_INCOMER_VALUE_FIELDS = [
  'mainIncomerType',
  'supplyVoltage',
  'customSupplyVoltage',
  'pole',
  'frequency',
  'make',
  'customMake',
  'kaRating',
  'controlFeeder',
];

export const normalizeMainIncomerDetails = (details = {}) => {
  const defaults = defaultMainIncomerDetails();
  return MAIN_INCOMER_VALUE_FIELDS.reduce(
    (result, field) => ({
      ...result,
      [field]: details?.[field] ?? defaults[field],
    }),
    { sameAsAbove: Boolean(details?.sameAsAbove) }
  );
};

export const emptyMainIncomerDetails = () => MAIN_INCOMER_VALUE_FIELDS.reduce(
  (result, field) => ({ ...result, [field]: '' }),
  { sameAsAbove: false }
);

export const getPreviousPanelType = (panelTypes = [], currentPanelType = '') => {
  const selected = normalizeInquiryPanelTypes(panelTypes);
  const normalizedCurrent = normalizeInquiryPanelType(currentPanelType);
  const currentIndex = selected.indexOf(normalizedCurrent);
  return currentIndex > 0 ? selected[currentIndex - 1] : '';
};

// "Same as Above" always uses the first selected panel that has a Main Incomer.
// FLP is skipped because it intentionally has no Main Incomer section.
export const getSameAsAboveSourcePanelType = (panelTypes = [], currentPanelType = '') => {
  const selected = normalizeInquiryPanelTypes(panelTypes).filter((type) => type !== 'FLP');
  const normalizedCurrent = normalizeInquiryPanelType(currentPanelType);

  const currentSelectionType = selected.find((type) => (
    type === normalizedCurrent ||
    (type === 'MCC cum PLC' && ['PLC', 'MCC'].includes(normalizedCurrent))
  ));

  const currentIndex = selected.indexOf(currentSelectionType);
  return currentIndex > 0 ? selected[0] : '';
};

const hasMainIncomerValues = (details = {}) => MAIN_INCOMER_VALUE_FIELDS.some((field) => {
  const value = String(details?.[field] ?? '').trim();
  if (field === 'frequency' && value === '50 Hz') return false;
  return value !== '';
});

const mapMccMainIncomer = (details = {}) => normalizeMainIncomerDetails({
  mainIncomerType: details.mainIncomerType || details.incomerType,
  supplyVoltage: details.supplyVoltage || details.incomingVoltage,
  customSupplyVoltage: details.customSupplyVoltage || details.customIncomingVoltage,
  pole: details.pole,
  frequency: details.frequency,
  make: details.make,
  customMake: details.customMake,
  kaRating: details.kaRating,
  controlFeeder: details.controlFeeder,
  sameAsAbove: details.sameAsAbove,
});

export const getPanelMainIncomerDetails = (form = {}, panelType = '') => {
  const normalizedPanelType = normalizeInquiryPanelType(panelType);

  if (normalizedPanelType === 'PLC') {
    return normalizeMainIncomerDetails(form?.plcDetails?.mainIncomerFeeder);
  }

  if (normalizedPanelType === 'MCC') {
    return mapMccMainIncomer(form?.mccDetails?.incomerDetails);
  }

  if (normalizedPanelType === 'MCC cum PLC') {
    const mccDetails = mapMccMainIncomer(form?.mccDetails?.incomerDetails);
    if (hasMainIncomerValues(mccDetails)) return mccDetails;
    return normalizeMainIncomerDetails(form?.plcDetails?.mainIncomerFeeder);
  }

  if (normalizedPanelType === 'VFD') {
    return normalizeMainIncomerDetails(form?.vfdDetails?.mainIncomer);
  }

  if (normalizedPanelType === 'RIO Box') {
    return normalizeMainIncomerDetails(form?.rioBoxDetails?.mainIncomer);
  }

  return normalizeMainIncomerDetails();
};

export const setPanelMainIncomerDetails = (
  form = {},
  panelType = '',
  details = {},
  { preserveSameAsAbove = false } = {}
) => {
  const normalizedPanelType = normalizeInquiryPanelType(panelType);
  const current = getPanelMainIncomerDetails(form, normalizedPanelType);
  const normalizedDetails = normalizeMainIncomerDetails({
    ...current,
    ...details,
    sameAsAbove: preserveSameAsAbove
      ? current.sameAsAbove
      : Boolean(details?.sameAsAbove),
  });

  if (normalizedPanelType === 'PLC') {
    return {
      ...form,
      plcDetails: {
        ...(form?.plcDetails || {}),
        mainIncomerFeeder: normalizedDetails,
      },
    };
  }

  if (normalizedPanelType === 'MCC') {
    return {
      ...form,
      mccDetails: {
        ...(form?.mccDetails || {}),
        incomerDetails: {
          ...(form?.mccDetails?.incomerDetails || {}),
          ...normalizedDetails,
          // Keep legacy aliases populated for old reports and existing APIs.
          incomerType: normalizedDetails.mainIncomerType,
          incomingVoltage: normalizedDetails.supplyVoltage,
          customIncomingVoltage: normalizedDetails.customSupplyVoltage,
        },
      },
    };
  }

  if (normalizedPanelType === 'VFD') {
    return {
      ...form,
      vfdDetails: {
        ...(form?.vfdDetails || {}),
        mainIncomer: normalizedDetails,
      },
    };
  }

  if (normalizedPanelType === 'RIO Box') {
    return {
      ...form,
      rioBoxDetails: {
        ...(form?.rioBoxDetails || {}),
        mainIncomer: normalizedDetails,
      },
    };
  }

  return form;
};

export const getMainIncomerValueSignature = (details = {}) => JSON.stringify(
  MAIN_INCOMER_VALUE_FIELDS.reduce((result, field) => ({
    ...result,
    [field]: details?.[field] ?? '',
  }), {})
);
