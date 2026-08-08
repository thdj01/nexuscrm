import {
  normalizeInquiryPanelTypes,
  hasInquiryPanelType,
} from '../data/inquiryMasterData';

const isBlank = (value) =>
  value === undefined || value === null || String(value).trim() === '';

const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const normalisePhone = (value) =>
  String(value || '').replace(/\s/g, '');

const isValidPhone = (value) =>
  /^\d{10}$/.test(normalisePhone(value));

const mergeErrors = (...errorObjects) =>
  errorObjects.reduce((merged, current) => ({
    ...merged,
    ...(current || {}),
  }), {});

const isOtherValue = (value) =>
  String(value || '').trim().toUpperCase() === 'OTHER';

const addRequiredError = (errors, key, value, message) => {
  if (isBlank(value)) {
    errors[key] = message;
  }
};

const MAIN_INCOMER_FIELDS = [
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

const hasMainIncomerData = (details = {}) => MAIN_INCOMER_FIELDS.some((field) => {
  const value = details?.[field];
  if (field === 'frequency' && String(value || '').trim() === '50 Hz') return false;
  return !isBlank(value);
});

const validateMainIncomer = (details = {}, prefix = '', { required = true } = {}) => {
  const errors = {};
  if (!required && !hasMainIncomerData(details) && !details?.sameAsAbove) return errors;

  addRequiredError(
    errors,
    `${prefix}.mainIncomerType`,
    details.mainIncomerType,
    'Main incomer type is required'
  );
  addRequiredError(
    errors,
    `${prefix}.supplyVoltage`,
    details.supplyVoltage,
    'Supply voltage is required'
  );
  if (details.supplyVoltage === 'Custom') {
    addRequiredError(
      errors,
      `${prefix}.customSupplyVoltage`,
      details.customSupplyVoltage,
      'Custom supply voltage is required'
    );
  }
  addRequiredError(errors, `${prefix}.pole`, details.pole, 'Pole is required');
  addRequiredError(errors, `${prefix}.frequency`, details.frequency, 'Frequency is required');
  addRequiredError(errors, `${prefix}.make`, details.make, 'Main incomer make is required');
  if (isOtherValue(details.make)) {
    addRequiredError(
      errors,
      `${prefix}.customMake`,
      details.customMake,
      'Custom main incomer make is required'
    );
  }
  addRequiredError(errors, `${prefix}.kaRating`, details.kaRating, 'kA rating is required');
  addRequiredError(
    errors,
    `${prefix}.controlFeeder`,
    details.controlFeeder,
    'Control feeder details are required'
  );

  return errors;
};

const selectedEnclosureType = (form = {}) => form.enclosureType || '';

const isPanelColourVisible = (form = {}) => {
  const material = String(selectedEnclosureType(form)).trim().toUpperCase();
  return Boolean(material) && !['SS304', 'SS316'].includes(material);
};

const validateCommonTechnicalFields = (form = {}, requiredFields = {}) => {
  const errors = {};

  if (requiredFields.supplyVoltage) {
    addRequiredError(errors, 'supplyVoltage', form.supplyVoltage, 'Supply voltage is required');

    if (form.supplyVoltage === 'Custom') {
      addRequiredError(errors, 'customVoltage', form.customVoltage, 'Custom supply voltage is required');
    }
  }

  if (requiredFields.frequency) {
    addRequiredError(errors, 'frequency', form.frequency, 'Frequency is required');
  }

  if (requiredFields.shortCircuitCapacity) {
    addRequiredError(
      errors,
      'shortCircuitCapacity',
      form.shortCircuitCapacity,
      'Short circuit withstand is required'
    );
  }

  if (requiredFields.panelAreaClassification) {
    addRequiredError(
      errors,
      'panelAreaClassification',
      form.panelAreaClassification || form.panelAreaClass,
      'Panel area classification is required'
    );
  }

  if (requiredFields.installationType) {
    addRequiredError(errors, 'installationType', form.installationType, 'Installation type is required');
  }

  if (requiredFields.ipRating) {
    addRequiredError(errors, 'ipRating', form.ipRating, 'Protection class (IP) is required');
  }

  if (requiredFields.enclosureType) {
    addRequiredError(
      errors,
      'enclosureType',
      selectedEnclosureType(form),
      'Enclosure type is required'
    );
  }

  if (requiredFields.panelColourRal && isPanelColourVisible(form)) {
    addRequiredError(errors, 'panelColourRal', form.panelColourRal, 'Panel colour (RAL) is required');
  }

  if (requiredFields.cableEntry) {
    addRequiredError(errors, 'cableEntry', form.cableEntry, 'Cable entry is required');
  }

  if (requiredFields.cableGlandMaterial) {
    addRequiredError(
      errors,
      'cableGlandMaterial',
      form.cableGlandMaterial,
      'Cable gland material is required'
    );
  }

  return errors;
};

export const validateCommonInquiry = (form = {}) => {
  const errors = {};
  const contacts = Array.isArray(form.contacts) ? form.contacts : [];
  const primaryContact = contacts[0] || {};

  if (normalizeInquiryPanelTypes(form.panelTypes || []).length === 0) {
    errors.panelTypes = 'Select at least one panel type';
  }

  if (isBlank(form.customerName)) {
    errors.customerName = 'Customer name is required';
  }

  // Contact fields are auto-filled from Customer Master and are not directly
  // visible/editable in the current Inquiry form. Do not block Inquiry save
  // because of missing hidden contact data; only validate contact values if
  // they exist.
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

  return { errors };
};

export const validatePLCInquiry = (form = {}) => {
  const plcDetails = form.plcDetails || {};
  const mainIncomer = plcDetails.mainIncomerFeeder || {};
  const plcSystem = plcDetails.plcSystem || {};
  const servoDetails = plcDetails.servoDetails || {};
  const ioRequirements = plcDetails.ioRequirements || {};
  const supportRequirements = plcDetails.supportRequirements || {};

  const errors = validateCommonTechnicalFields(form, {
    panelAreaClassification: true,
    installationType: true,
    enclosureType: true,
    cableEntry: true,
  });

  addRequiredError(
    errors,
    'plcDetails.mainIncomerFeeder.mainIncomerType',
    mainIncomer.mainIncomerType,
    'Main incomer type is required'
  );
  addRequiredError(
    errors,
    'plcDetails.mainIncomerFeeder.supplyVoltage',
    mainIncomer.supplyVoltage,
    'Supply voltage is required'
  );
  if (mainIncomer.supplyVoltage === 'Custom') {
    addRequiredError(
      errors,
      'plcDetails.mainIncomerFeeder.customSupplyVoltage',
      mainIncomer.customSupplyVoltage,
      'Custom supply voltage is required'
    );
  }
  addRequiredError(
    errors,
    'plcDetails.mainIncomerFeeder.pole',
    mainIncomer.pole,
    'Pole is required'
  );
  addRequiredError(
    errors,
    'plcDetails.mainIncomerFeeder.frequency',
    mainIncomer.frequency,
    'Frequency is required'
  );
  addRequiredError(
    errors,
    'plcDetails.mainIncomerFeeder.make',
    mainIncomer.make,
    'Main incomer make is required'
  );
  if (isOtherValue(mainIncomer.make)) {
    addRequiredError(
      errors,
      'plcDetails.mainIncomerFeeder.customMake',
      mainIncomer.customMake,
      'Custom main incomer make is required'
    );
  }
  addRequiredError(
    errors,
    'plcDetails.mainIncomerFeeder.kaRating',
    mainIncomer.kaRating,
    'kA rating is required'
  );
  addRequiredError(
    errors,
    'plcDetails.mainIncomerFeeder.controlFeeder',
    mainIncomer.controlFeeder,
    'Control feeder details are required'
  );

  addRequiredError(
    errors,
    'plcDetails.plcSystem.plcController',
    plcSystem.plcController,
    'PLC controller is required'
  );
  addRequiredError(
    errors,
    'plcDetails.plcSystem.make',
    plcSystem.make,
    'PLC make is required'
  );
  if (isOtherValue(plcSystem.make)) {
    addRequiredError(
      errors,
      'plcDetails.plcSystem.customMake',
      plcSystem.customMake,
      'Custom PLC make is required'
    );
  }
  addRequiredError(
    errors,
    'plcDetails.plcSystem.communicationProtocol',
    plcSystem.communicationProtocol,
    'Communication protocol is required'
  );
  addRequiredError(
    errors,
    'plcDetails.plcSystem.networkTopology',
    plcSystem.networkTopology,
    'Network topology is required'
  );

  if (plcSystem.hmiRequired) {
    addRequiredError(
      errors,
      'plcDetails.plcSystem.hmiSize',
      plcSystem.hmiSize,
      'HMI size is required'
    );
    addRequiredError(
      errors,
      'plcDetails.plcSystem.hmiMake',
      plcSystem.hmiMake,
      'HMI make is required'
    );
  }

  if (plcSystem.ethernetSwitchRequired) {
    addRequiredError(
      errors,
      'plcDetails.plcSystem.ethernetSwitchPort',
      plcSystem.ethernetSwitchPort,
      'Ethernet switch port is required'
    );
    addRequiredError(
      errors,
      'plcDetails.plcSystem.ethernetSwitchType',
      plcSystem.ethernetSwitchType,
      'Ethernet switch type is required'
    );
  }

  addRequiredError(
    errors,
    'plcDetails.servoDetails.make',
    servoDetails.make,
    'Servo make is required'
  );
  if (isOtherValue(servoDetails.make)) {
    addRequiredError(
      errors,
      'plcDetails.servoDetails.customMake',
      servoDetails.customMake,
      'Custom servo make is required'
    );
  }
  addRequiredError(
    errors,
    'plcDetails.servoDetails.inputVoltage',
    servoDetails.inputVoltage,
    'Servo input voltage is required'
  );
  addRequiredError(
    errors,
    'plcDetails.servoDetails.motorCapacityKw',
    servoDetails.motorCapacityKw,
    'Servo motor capacity is required'
  );
  if (!isBlank(servoDetails.motorCapacityKw)) {
    const motorCapacity = Number(servoDetails.motorCapacityKw);
    if (!Number.isFinite(motorCapacity) || motorCapacity < 0) {
      errors['plcDetails.servoDetails.motorCapacityKw'] =
        'Servo motor capacity must be a number greater than or equal to zero';
    }
  }
  addRequiredError(
    errors,
    'plcDetails.servoDetails.encoderType',
    servoDetails.encoderType,
    'Encoder type is required'
  );
  addRequiredError(
    errors,
    'plcDetails.servoDetails.brake',
    servoDetails.brake,
    'Brake selection is required'
  );
  addRequiredError(
    errors,
    'plcDetails.servoDetails.ratedRpm',
    servoDetails.ratedRpm,
    'Rated RPM is required'
  );
  addRequiredError(
    errors,
    'plcDetails.servoDetails.amplifierCommunication',
    servoDetails.amplifierCommunication,
    'Motor amplifier communication is required'
  );
  addRequiredError(
    errors,
    'plcDetails.servoDetails.communicationProtocol',
    servoDetails.communicationProtocol,
    'Communication protocol is required'
  );
  addRequiredError(
    errors,
    'plcDetails.servoDetails.cableLengthMetres',
    servoDetails.cableLengthMetres,
    'Cable length is required'
  );
  if (!isBlank(servoDetails.cableLengthMetres)) {
    const cableLength = Number(servoDetails.cableLengthMetres);
    if (!Number.isFinite(cableLength) || cableLength < 0) {
      errors['plcDetails.servoDetails.cableLengthMetres'] =
        'Cable length must be a number greater than or equal to zero';
    }
  }

  ['di', 'do', 'ai', 'ao'].forEach((key) => {
    const quantity = ioRequirements?.[key]?.quantity;
    const errorKey = `plcDetails.ioRequirements.${key}.quantity`;

    if (isBlank(quantity)) {
      errors[errorKey] = `${key.toUpperCase()} quantity is required`;
      return;
    }

    const parsed = Number(quantity);
    if (!Number.isInteger(parsed) || parsed < 0) {
      errors[errorKey] = `${key.toUpperCase()} quantity must be an integer greater than or equal to zero`;
    }
  });

  if (
    supportRequirements.onsiteSupportRequired === 'Required' &&
    isBlank(supportRequirements.onsiteSupportDays)
  ) {
    errors['plcDetails.supportRequirements.onsiteSupportDays'] =
      'On-site support days are required';
  }

  if (
    supportRequirements.commissioningSupportRequired === 'Required' &&
    isBlank(supportRequirements.commissioningSupportDays)
  ) {
    errors['plcDetails.supportRequirements.commissioningSupportDays'] =
      'Commissioning support days are required';
  }

  return { errors };
};

const normalizeMultiSelection = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return value ? [value] : [];
};

export const validateVFDInquiry = (form = {}) => {
  const errors = {};
  const vfdDetails = form.vfdDetails || {};
  const mainIncomer = vfdDetails.mainIncomer || {};
  const requireMainIncomer = !form?._id || hasMainIncomerData(mainIncomer) || Boolean(mainIncomer.sameAsAbove);

  Object.assign(
    errors,
    validateMainIncomer(mainIncomer, 'vfdDetails.mainIncomer', { required: requireMainIncomer })
  );

  const feederTypes = normalizeMultiSelection(
    vfdDetails.outgoingFeederDetails?.feederTypes
  );

  if (feederTypes.length === 0) {
    errors['vfdDetails.outgoingFeederDetails.feederTypes'] =
      'At least one outgoing feeder type is required';
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

export const validateRIOInquiry = (form = {}) => {
  const rioBoxDetails = form.rioBoxDetails || {};
  const mainIncomer = rioBoxDetails.mainIncomer || {};
  const requireMainIncomer = !form?._id || hasMainIncomerData(mainIncomer) || Boolean(mainIncomer.sameAsAbove);

  return {
    errors: validateMainIncomer(
      mainIncomer,
      'rioBoxDetails.mainIncomer',
      { required: requireMainIncomer }
    ),
  };
};

export const validateMCCInquiry = (form = {}) => {
  const mccDetails = form.mccDetails || {};
  const incomerDetails = mccDetails.incomerDetails || {};
  const outgoingFeederDetails = mccDetails.outgoingFeederDetails || {};
  const notesAndSupport = mccDetails.notesAndSupport || {};
  const errors = validateCommonTechnicalFields(form, {
    panelAreaClassification: true,
    installationType: true,
    enclosureType: true,
    cableEntry: true,
  });

  const mainIncomer = {
    mainIncomerType: incomerDetails.mainIncomerType || incomerDetails.incomerType || '',
    supplyVoltage: incomerDetails.supplyVoltage || incomerDetails.incomingVoltage || '',
    customSupplyVoltage:
      incomerDetails.customSupplyVoltage || incomerDetails.customIncomingVoltage || '',
    pole: incomerDetails.pole || '',
    frequency: incomerDetails.frequency || '',
    make: incomerDetails.make || '',
    customMake: incomerDetails.customMake || '',
    kaRating: incomerDetails.kaRating || '',
    controlFeeder: incomerDetails.controlFeeder || '',
    sameAsAbove: Boolean(incomerDetails.sameAsAbove),
  };

  Object.assign(
    errors,
    validateMainIncomer(mainIncomer, 'mccDetails.incomerDetails', { required: true })
  );

  if (isBlank(incomerDetails.busbarMaterial)) {
    errors['mccDetails.incomerDetails.busbarMaterial'] = 'Busbar material is required';
  }

  if (isBlank(incomerDetails.panelConstruction)) {
    errors['mccDetails.incomerDetails.panelConstruction'] = 'Panel type is required';
  }

  const feederTypes = normalizeMultiSelection(
    outgoingFeederDetails.feederTypes
  );

  if (feederTypes.length === 0) {
    errors['mccDetails.outgoingFeederDetails.feederTypes'] =
      'At least one outgoing feeder type is required';
  }

  if (isBlank(notesAndSupport.commissioningScope)) {
    errors['mccDetails.notesAndSupport.commissioningScope'] =
      'Commissioning scope is required';
  }

  return { errors };
};

export const validateInquiry = (form = {}) => {
  const commonResult = validateCommonInquiry(form);
  const panelTypes = normalizeInquiryPanelTypes(form.panelTypes || []);
  const typeErrors = [];

  if (
    hasInquiryPanelType(panelTypes, 'PLC') ||
    hasInquiryPanelType(panelTypes, 'MCC cum PLC')
  ) {
    typeErrors.push(validatePLCInquiry(form).errors);
  }

  if (hasInquiryPanelType(panelTypes, 'VFD')) {
    typeErrors.push(validateVFDInquiry(form).errors);
  }

  if (
    hasInquiryPanelType(panelTypes, 'MCC') ||
    hasInquiryPanelType(panelTypes, 'MCC cum PLC')
  ) {
    typeErrors.push(validateMCCInquiry(form).errors);
  }

  if (hasInquiryPanelType(panelTypes, 'RIO Box')) {
    typeErrors.push(validateRIOInquiry(form).errors);
  }

  const errors = mergeErrors(commonResult.errors, ...typeErrors);

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export default validateInquiry;
