    import { INQUIRY_TYPES } from '../data/inquiryMasterData';

const isBlank = (value) =>
  value === undefined || value === null || String(value).trim() === '';

const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const normalisePhone = (value) =>
  String(value || '').replace(/\s/g, '');

const isValidPhone = (value) =>
  /^\d{10}$/.test(normalisePhone(value));

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const mergeErrors = (...errorObjects) =>
  errorObjects.reduce((merged, current) => ({
    ...merged,
    ...(current || {}),
  }), {});

export const validateCommonInquiry = (form = {}) => {
  const errors = {};
  const contacts = Array.isArray(form.contacts) ? form.contacts : [];
  const primaryContact = contacts[0] || {};

  if (isBlank(form.inquiryType) || form.inquiryType === INQUIRY_TYPES.LEGACY) {
    errors.inquiryType = 'Inquiry type is required';
  }

  if (isBlank(form.customerName)) {
    errors.customerName = 'Customer name is required';
  }

  // Contact fields are auto-filled from Customer Master and are not directly
  // visible/editable in the Inquiry form. Do not block Inquiry save because of
  // missing hidden contact data; only validate contact values if they exist.
  if (!isBlank(primaryContact.phone) && !isValidPhone(primaryContact.phone)) {
    errors['contacts.0.phone'] = 'Enter a valid 10-digit number';
  }

  if (!isBlank(primaryContact.email) && !isValidEmail(primaryContact.email)) {
    errors['contacts.0.email'] = 'Invalid email address';
  }

  contacts.slice(1).forEach((contact, index) => {
    const contactIndex = index + 1;

    if (!isBlank(contact.phone) && !isValidPhone(contact.phone)) {
      errors[`contacts.${contactIndex}.phone`] = 'Invalid number';
    }

    if (!isBlank(contact.email) && !isValidEmail(contact.email)) {
      errors[`contacts.${contactIndex}.email`] = 'Invalid email';
    }
  });

  if (isBlank(form.projectName)) {
    errors.projectName = 'Project name is required';
  }

  if (isBlank(form.offerType)) {
    errors.offerType = 'Offer type is required';
  }

  if (isBlank(form.supplyVoltage)) {
    errors.supplyVoltage = 'Supply voltage is required';
  }

  return { errors };
};

export const validatePLCInquiry = (form = {}) => {
  const errors = {};
  const plcDetails = form.plcDetails || {};
  const automationRequirements = Array.isArray(plcDetails.automationRequirements)
    ? plcDetails.automationRequirements
    : [];
  const ioDetails = plcDetails.ioDetails || {};
  const supportRequirements = plcDetails.supportRequirements || {};

  if (automationRequirements.length === 0) {
    errors['plcDetails.automationRequirements'] = 'PLC automation requirements are required';
  }

  if (isBlank(plcDetails.switchgearMake)) {
    errors['plcDetails.switchgearMake'] = 'Switchgear make is required';
  }

  if (isBlank(ioDetails.communicationProtocol)) {
    errors['plcDetails.ioDetails.communicationProtocol'] = 'Communication protocol is required';
  }

  if (isBlank(ioDetails.networkTopology)) {
    errors['plcDetails.ioDetails.networkTopology'] = 'Network topology is required';
  }

  if (
    supportRequirements.onsiteSupportRequired === 'Required' &&
    isBlank(supportRequirements.onsiteSupportDays)
  ) {
    errors['plcDetails.supportRequirements.onsiteSupportDays'] = 'On-site support days are required';
  }

  if (
    supportRequirements.commissioningSupportRequired === 'Required' &&
    isBlank(supportRequirements.commissioningSupportDays)
  ) {
    errors['plcDetails.supportRequirements.commissioningSupportDays'] = 'Commissioning support days are required';
  }

  return { errors };
};

export const validateVFDInquiry = (form = {}) => {
  const errors = {};
  const vfdDetails = form.vfdDetails || {};

  if (isBlank(vfdDetails.panelType)) {
    errors['vfdDetails.panelType'] = 'Panel type is required';
  }

  if (isBlank(vfdDetails.switchgearMake)) {
    errors['vfdDetails.switchgearMake'] = 'Switchgear make is required';
  }

  if (
    vfdDetails.onsiteSupportRequired === 'Required' &&
    isBlank(vfdDetails.onsiteSupportDays)
  ) {
    errors['vfdDetails.onsiteSupportDays'] = 'On-site support days are required';
  }

  if (
    vfdDetails.commissioningSupportRequired === 'Required' &&
    isBlank(vfdDetails.commissioningSupportDays)
  ) {
    errors['vfdDetails.commissioningSupportDays'] = 'Commissioning support days are required';
  }

  return { errors };
};

export const validateMCCInquiry = (form = {}) => {
  const errors = {};
  const mccDetails = form.mccDetails || {};
  const incomerDetails = mccDetails.incomerDetails || {};
  const outgoingFeederDetails = mccDetails.outgoingFeederDetails || {};
  const notesAndSupport = mccDetails.notesAndSupport || {};

  if (isBlank(incomerDetails.incomerType)) {
    errors['mccDetails.incomerDetails.incomerType'] = 'Incomer type is required';
  }

  if (isBlank(incomerDetails.make)) {
    errors['mccDetails.incomerDetails.make'] = 'Make is required';
  }

  if (isBlank(incomerDetails.busbarMaterial)) {
    errors['mccDetails.incomerDetails.busbarMaterial'] = 'Busbar material is required';
  }

  const controlVoltage = form.controlVoltage ?? outgoingFeederDetails.controlVoltage;

  if (isBlank(controlVoltage)) {
    errors.controlVoltage = 'Control voltage is required';
  }

  if (
    toNumber(outgoingFeederDetails.noOfSoftStarters) > 0 &&
    isBlank(outgoingFeederDetails.softStarterMake)
  ) {
    errors['mccDetails.outgoingFeederDetails.softStarterMake'] = 'Soft starter make is required';
  }

  if (
    toNumber(outgoingFeederDetails.noOfVfdFeeders) > 0 &&
    isBlank(outgoingFeederDetails.vfdMake)
  ) {
    errors['mccDetails.outgoingFeederDetails.vfdMake'] = 'VFD make is required';
  }

  if (
    notesAndSupport.onsiteSupportRequired === 'Required' &&
    isBlank(notesAndSupport.onsiteSupportDays)
  ) {
    errors['mccDetails.notesAndSupport.onsiteSupportDays'] = 'On-site support days are required';
  }

  if (
    notesAndSupport.commissioningSupportRequired === 'Required' &&
    isBlank(notesAndSupport.commissioningSupportDays)
  ) {
    errors['mccDetails.notesAndSupport.commissioningSupportDays'] = 'Commissioning support days are required';
  }

  return { errors };
};

export const validateInquiry = (form = {}) => {
  const commonResult = validateCommonInquiry(form);

  let typeResult = { errors: {} };

  switch (form.inquiryType) {
    case INQUIRY_TYPES.PLC_AUTOMATION:
      typeResult = validatePLCInquiry(form);
      break;

    case INQUIRY_TYPES.VFD_PANEL:
      typeResult = validateVFDInquiry(form);
      break;

    case INQUIRY_TYPES.MCC_PANEL:
      typeResult = validateMCCInquiry(form);
      break;

    case INQUIRY_TYPES.MCC_CUM_PLC:
      typeResult = {
        errors: mergeErrors(
          validatePLCInquiry(form).errors,
          validateMCCInquiry(form).errors
        ),
      };
      break;

    default:
      typeResult = { errors: {} };
      break;
  }

  const errors = mergeErrors(commonResult.errors, typeResult.errors);

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export default validateInquiry;