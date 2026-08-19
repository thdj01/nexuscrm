const mongoose = require('mongoose');
const { getNextInquiryNumber } = require('../utils/inquiryNumber');

// ─── Contact sub-schema ───────────────────────────────────────────────────────
const contactSchema = new mongoose.Schema(
  {
    name:        { type: String, required: false, trim: true },
    phone:       { type: String, trim: true, default: '' },
    email:       { type: String, trim: true, lowercase: true, default: '' },
    designation: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

// ─── Attachment sub-schema  [FIX C2] ─────────────────────────────────────────
// Previously missing entirely — caused every uploaded file to be silently dropped.
const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    storedName:   { type: String, required: true, trim: true },
    storagePath:  { type: String, required: true, trim: true },  // relative: 'inquiry/<filename>'
    mimeType:     { type: String, trim: true, default: '' },
    sizeBytes:    { type: Number, default: 0 },
    uploadedAt:   { type: Date,   default: Date.now },
  },
  { _id: false }
);

const bomAttachmentSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    storedName: { type: String, required: true, trim: true },
    storagePath: { type: String, required: true, trim: true },
    mimeType: { type: String, trim: true, default: '' },
    sizeBytes: { type: Number, default: 0 },
    revisionNumber: { type: Number, default: 0 },
    versionLabel: { type: String, trim: true, default: 'Revision 0' },
    remarks: { type: String, trim: true, default: '' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const statusDetailsSchema = new mongoose.Schema(
  {
    orderLost: {
      reason: {
        type: String,
        enum: ['', 'Price', 'Commercial', 'Priority', 'Timing', 'Trust Issue', 'Certification'],
        default: '',
        trim: true,
      },
      additionalRemark: { type: String, trim: true, default: '' },
      updatedAt: { type: Date },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    inquiryHold: {
      reason: {
        type: String,
        enum: ['', 'Due to Customer', 'Specification', 'Technical', 'Commercial'],
        default: '',
        trim: true,
      },
      updatedAt: { type: Date },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    bomApproval: {
      additionalRemark: { type: String, trim: true, default: '' },
      updatedAt: { type: Date },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    revision: {
      customerComment: { type: String, trim: true, default: '' },
      internalNotes: { type: String, trim: true, default: '' },
      attachment: { type: attachmentSchema, default: undefined },
      updatedAt: { type: Date },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    bomSubmission: {
      revisionNumber: { type: Number, default: -1 },
      versionLabel: { type: String, trim: true, default: '' },
      remarks: { type: String, trim: true, default: '' },
      updatedAt: { type: Date },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
  },
  { _id: false }
);

// ─── Load-row sub-schema (for loadDetails table)  [FIX H1] ───────────────────
const loadRowSchema = new mongoose.Schema(
{
  description: { type: String, trim: true, default: '' },
  qty: { type: Number, default: 0 },
  kw: { type: Number, default: 0 },
  hp: { type: Number, default: 0 },
  ampere: { type: Number, default: 0 },
  startingMethod: { type: String, trim: true, default: '' },
},
{ _id: false }
);

// ─── New document-aligned inquiry sub-schemas ───────────────────────────────
// These schemas support the PLC / Automation, VFD Panel and MCC Panel forms
// while keeping the legacy loadDetails/controlMatrix fields intact.
const componentRequirementRowSchema = new mongoose.Schema(
  {
    component: { type: String, trim: true, default: '' },
    required: { type: String, enum: ['', 'Yes', 'No', 'NA - Not Applicable'], default: '' },
    preferredBrand: { type: String, trim: true, default: '' },
    suggestedModelRange: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const inquiryLoadRowSchema = new mongoose.Schema(
  {
    srNo: { type: Number, default: 0 },
    loadDescription: { type: String, trim: true, default: '' },
    qty: { type: Number, default: 0 },
    ratingKwHp: { type: String, trim: true, default: '' },
    fullLoadCurrent: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const feederLoadDetailsSchema = new mongoose.Schema(
  {
    feederType: { type: String, trim: true, required: true },
    loadDetails: { type: [inquiryLoadRowSchema], default: [] },
  },
  { _id: false }
);

const plcIoRequirementRowSchema = new mongoose.Schema(
  {
    quantity: { type: Number, min: 0, default: 0 },
    relay: { type: Boolean, default: false },
    isBarrier: { type: Boolean, default: false },
    conformalCoated: { type: Boolean, default: false },
    isInput: { type: Boolean, default: false },
    hart: { type: Boolean, default: false },
  },
  { _id: false }
);

const vfdSelectionOptionsSchema = new mongoose.Schema(
  {
    inputChoke: { type: Boolean, default: false },
    outputChoke: { type: Boolean, default: false },
    heavyDuty: { type: Boolean, default: false },
    normalDuty: { type: Boolean, default: false },
    bop: { type: Boolean, default: false },
  },
  { _id: false }
);

const softStarterDetailsSchema = new mongoose.Schema(
  {
    loadDetails: { type: [inquiryLoadRowSchema], default: [] },
    options: { type: vfdSelectionOptionsSchema, default: () => ({}) },
  },
  { _id: false }
);

const mainIncomerDetailsSchema = new mongoose.Schema(
  {
    mainIncomerType: { type: String, trim: true, default: '' },
    supplyVoltage: { type: String, trim: true, default: '' },
    customSupplyVoltage: { type: String, trim: true, default: '' },
    pole: { type: String, trim: true, default: '' },
    frequency: { type: String, trim: true, default: '50 Hz' },
    make: { type: String, trim: true, default: '' },
    customMake: { type: String, trim: true, default: '' },
    kaRating: { type: String, trim: true, default: '' },
    controlFeeder: { type: String, trim: true, default: '' },
    sameAsAbove: { type: Boolean, default: false },
  },
  { _id: false }
);

const plcDetailsSchema = new mongoose.Schema(
  {
    // Legacy fields remain in place for backward compatibility with existing records.
    switchgearMake: { type: String, trim: true, default: '' },
    customSwitchgearMake: { type: String, trim: true, default: '' },
    programmingDevelopmentScope: { type: String, trim: true, default: '' },
    mainIncomerFeeder: {
      mainIncomerType: { type: String, trim: true, default: '' },
      supplyVoltage: { type: String, trim: true, default: '' },
      customSupplyVoltage: { type: String, trim: true, default: '' },
      pole: { type: String, trim: true, default: '' },
      frequency: { type: String, trim: true, default: '' },
      make: { type: String, trim: true, default: '' },
      customMake: { type: String, trim: true, default: '' },
      kaRating: { type: String, trim: true, default: '' },
      controlFeeder: { type: String, trim: true, default: '' },
      sameAsAbove: { type: Boolean, default: false },
    },
    plcSystem: {
      plcController: { type: String, trim: true, default: '' },
      make: { type: String, trim: true, default: '' },
      customMake: { type: String, trim: true, default: '' },
      modelNumber: { type: String, trim: true, default: '' },
      communicationProtocol: { type: String, trim: true, default: '' },
      networkTopology: { type: String, trim: true, default: '' },
      hmiRequired: { type: Boolean, default: false },
      hmiSize: { type: String, trim: true, default: '' },
      hmiMake: { type: String, trim: true, default: '' },
      ethernetSwitchRequired: { type: Boolean, default: false },
      ethernetSwitchPort: { type: String, trim: true, default: '' },
      ethernetSwitchType: { type: String, trim: true, default: '' },
    },
    servoDetails: {
      make: {
        type: String,
        enum: ['', 'Yaskawa', 'ABB', 'Siemens', 'Mitsubishi', 'Allen-Bradley (AB)', 'Other', 'NA - Not Applicable'],
        trim: true,
        default: '',
      },
      customMake: { type: String, trim: true, default: '' },
      inputVoltage: {
        type: String,
        enum: ['', '1-Phase — 220 V', '3-Phase — 220 V', '3-Phase — 440 V', 'NA - Not Applicable'],
        trim: true,
        default: '',
      },
      motorCapacityKw: { type: Number, min: 0, default: null },
      encoderType: { type: String, enum: ['', 'Absolute', 'Incremental', 'NA - Not Applicable'], default: '' },
      brake: { type: String, enum: ['', 'Yes', 'No', 'NA - Not Applicable'], default: '' },
      ratedRpm: { type: String, enum: ['', '1500 RPM', '2000 RPM', '3000 RPM', 'NA - Not Applicable'], default: '' },
      amplifierCommunication: {
        type: String,
        enum: ['', 'PTO', 'Ethernet', 'EtherNet/IP', 'NA - Not Applicable'],
        default: '',
      },
      communicationProtocol: { type: String, trim: true, default: '' },
      cableLengthMetres: { type: Number, min: 0, default: null },
    },
    ioRequirements: {
      di: { type: plcIoRequirementRowSchema, default: () => ({}) },
      do: { type: plcIoRequirementRowSchema, default: () => ({}) },
      ai: { type: plcIoRequirementRowSchema, default: () => ({}) },
      ao: { type: plcIoRequirementRowSchema, default: () => ({}) },
    },
    redundancy: {
      plcRedundancy: { type: String, enum: ['', 'Hot', 'Cold', 'NA - Not Applicable'], default: '' },
      networkRedundancy: { type: Boolean, default: false },
      communicationRedundancy: { type: Boolean, default: false },
    },
    automationRequirements: {
      type: [componentRequirementRowSchema],
      default: [],
    },
    supportRequirements: {
      onsiteSupportRequired: { type: String, enum: ['', 'Required', 'Not Required', 'NA - Not Applicable'], default: '' },
      onsiteSupportDays: { type: Number, default: 0 },
      commissioningSupportRequired: { type: String, enum: ['', 'Required', 'Not Required', 'NA - Not Applicable'], default: '' },
      commissioningSupportDays: { type: Number, default: 0 },
    },
    ioDetails: {
      digitalInputs: { type: Number, default: 0 },
      digitalOutputs: { type: Number, default: 0 },
      analogInputs: { type: Number, default: 0 },
      analogOutputs: { type: Number, default: 0 },
      thermocoupleRtdInputs: { type: Number, default: 0 },
      highSpeedCounterInputs: { type: Number, default: 0 },
      communicationProtocol: { type: String, trim: true, default: '' },
      networkTopology: { type: String, trim: true, default: '' },
      plcCpuRedundancyRequired: { type: String, enum: ['', 'Yes', 'No', 'NA - Not Applicable'], default: '' },
      powerSupplyRedundancy: { type: String, enum: ['', 'Yes', 'No', 'NA - Not Applicable'], default: '' },
      ioSpareCapacityPercent: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

const vfdDetailsSchema = new mongoose.Schema(
  {
    mainIncomer: { type: mainIncomerDetailsSchema, default: () => ({}) },
    switchgearMake: { type: String, trim: true, default: '' },
    customSwitchgearMake: { type: String, trim: true, default: '' },
    outgoingFeederDetails: {
      totalNoOfFeeders: { type: Number, default: 0 },
      feederTypes: { type: [String], default: [] },
      noOfDolStarters: { type: Number, default: 0 },
      totalLoadKw: { type: Number, default: 0 },
      noOfStarDeltaStarters: { type: Number, default: 0 },
      switchgearMake: { type: String, trim: true, default: '' },
      customSwitchgearMake: { type: String, trim: true, default: '' },
      noOfSoftStarters: { type: Number, default: 0 },
      softStarterMake: { type: String, trim: true, default: '' },
      noOfVfdFeeders: { type: Number, default: 0 },
      vfdMake: { type: String, trim: true, default: '' },
      controlVoltage: { type: String, trim: true, default: '' },
      controlTransformerRequired: { type: String, enum: ['', 'Yes', 'No', 'NA - Not Applicable'], default: '' },
    },
    feederLoadDetails: { type: [feederLoadDetailsSchema], default: [] },
    loadDetails: { type: [inquiryLoadRowSchema], default: [] },
    vfdOptions: { type: vfdSelectionOptionsSchema, default: () => ({}) },
    softStarter: { type: softStarterDetailsSchema, default: () => ({}) },
    additionalComponents: { type: [componentRequirementRowSchema], default: [] },
    referenceBomAttached: { type: String, enum: ['', 'Yes', 'No', 'NA - Not Applicable'], default: '' },
    onsiteSupportRequired: { type: String, enum: ['', 'Required', 'Not Required', 'NA - Not Applicable'], default: '' },
    onsiteSupportDays: { type: Number, default: 0 },
    commissioningSupportRequired: { type: String, enum: ['', 'Required', 'Not Required', 'NA - Not Applicable'], default: '' },
    commissioningSupportDays: { type: Number, default: 0 },
  },
  { _id: false }
);

const mccDetailsSchema = new mongoose.Schema(
  {
    incomerDetails: {
      mainIncomerType: { type: String, trim: true, default: '' },
      supplyVoltage: { type: String, trim: true, default: '' },
      customSupplyVoltage: { type: String, trim: true, default: '' },
      pole: { type: String, trim: true, default: '' },
      frequency: { type: String, trim: true, default: '50 Hz' },
      make: { type: String, trim: true, default: '' },
      customMake: { type: String, trim: true, default: '' },
      kaRating: { type: String, trim: true, default: '' },
      controlFeeder: { type: String, trim: true, default: '' },
      sameAsAbove: { type: Boolean, default: false },
      // Legacy aliases retained for old records/reports.
      incomingVoltage: { type: String, trim: true, default: '' },
      customIncomingVoltage: { type: String, trim: true, default: '' },
      incomerType: { type: String, trim: true, default: '' },
      busbarMaterial: { type: String, trim: true, default: '' },
      formOfSeparation: { type: String, trim: true, default: '' },
      panelConstruction: { type: String, trim: true, default: '' },
    },
    outgoingFeederDetails: {
      totalNoOfFeeders: { type: Number, default: 0 },
      feederTypes: { type: [String], default: [] },
      noOfDolStarters: { type: Number, default: 0 },
      totalLoadKw: { type: Number, default: 0 },
      noOfStarDeltaStarters: { type: Number, default: 0 },
      switchgearMake: { type: String, trim: true, default: '' },
      customSwitchgearMake: { type: String, trim: true, default: '' },
      noOfSoftStarters: { type: Number, default: 0 },
      softStarterMake: { type: String, trim: true, default: '' },
      noOfVfdFeeders: { type: Number, default: 0 },
      vfdMake: { type: String, trim: true, default: '' },
      controlVoltage: { type: String, trim: true, default: '' },
      controlTransformerRequired: { type: String, enum: ['', 'Yes', 'No', 'NA - Not Applicable'], default: '' },
    },
    feederLoadDetails: { type: [feederLoadDetailsSchema], default: [] },
    loadDetails: { type: [inquiryLoadRowSchema], default: [] },
    layoutPreferences: {
      panelType: { type: String, trim: true, default: '' },
      panelStructure: { type: String, trim: true, default: '' },
      cableEntryMvLv: { type: String, trim: true, default: '' },
      busbarArrangement: { type: String, trim: true, default: '' },
    },
    notesAndSupport: {
      onsiteSupportRequired: { type: String, enum: ['', 'Required', 'Not Required', 'NA - Not Applicable'], default: '' },
      onsiteSupportDays: { type: Number, default: 0 },
      commissioningSupportRequired: { type: String, enum: ['', 'Required', 'Not Required', 'NA - Not Applicable'], default: '' },
      commissioningSupportDays: { type: Number, default: 0 },
      commissioningScope: { type: String, trim: true, default: '' },
      trainingRequired: { type: String, enum: ['', 'Yes', 'No', 'NA - Not Applicable'], default: '' },
      warrantyPeriodMonths: { type: Number, default: 0 },
      amcRequiredAfterWarranty: { type: String, enum: ['', 'Yes', 'No', 'NA - Not Applicable'], default: '' },
      additionalComments: { type: String, trim: true, default: '' },
    },
  },
  { _id: false }
);

// ─── Kick-off workflow sub-schema ────────────────────────────────────────────
const kickoffMeetingSchema = new mongoose.Schema(
  {
    workflowReference: { type: mongoose.Schema.Types.ObjectId, ref: 'KickoffWorkflow' },
    scheduledAt: { type: Date },
    date: { type: String, trim: true, default: '' },
    time: { type: String, trim: true, default: '' },
    agenda: { type: String, trim: true, default: '' },
    meetingLink: { type: String, trim: true, default: '' },
    finalTechnicalBomDocument: { type: attachmentSchema, default: undefined },
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    status: {
      type: String,
      enum: ['Not Scheduled', 'Scheduled', 'Ready For Completion', 'Completed', 'Project Created', 'Failed', 'Cancelled'],
      default: 'Not Scheduled',
    },
    projectReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    scheduledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    scheduledOn: { type: Date },
    convertedAt: { type: Date },
    lastError: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const normalizeProductType = (value) => {
  const text = String(value || '').trim();
  return ['PLC', 'MCC', 'VFD', 'PLC_MCC'].includes(text) ? text : value;
};

// ─── Main schema ──────────────────────────────────────────────────────────────
const inquirySchema = new mongoose.Schema(
  {
    // ── Auto-increment ID ─────────────────────────────────────────────────────
    inquiryId: {
      type:   String,
      unique: true,
    },

    // ── Section 1 — Client Info ───────────────────────────────────────────────
    inquiryDate: {
      type:    Date,
      default: Date.now,
    },

    customerRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
    },

    customerName: {
      type:     String,
      required: [true, 'Customer name is required'],
      trim:     true,
    },

    companyName: {
      type: String,
      trim: true,
    },

    companyType: {
      type: String,
      trim: true,
    },

    // Structured contacts array — contacts[0] is primary contact
    contacts: {
      type:    [contactSchema],
      default: [],
    },

    // Legacy flat contact fields — kept for backward compatibility.
    // Auto-populated from contacts[0] in pre-save hook.
    contactPerson: { type: String, trim: true },
    mobileNumber:  { type: String, trim: true },
    email:         { type: String, lowercase: true, trim: true },
    designation:   { type: String, trim: true },

    siteAddress: {                        // [FIX H1] was missing
      type: String,
      trim: true,
    },

    city: {
      type: String,
      trim: true,
    },

    location: {                           // derived from city / siteAddress
      type: String,
      trim: true,
    },

    // ── Section 2 — Project Details ───────────────────────────────────────────
    projectName: {
      type: String,
      trim: true,
    },

    industryType: {                       // [FIX H1] was missing
      type: String,
      trim: true,
    },

    offerType: {                          // [FIX H1] was missing
      type: String,
      trim: true,
    },

    previousOrderRef: {                   // [FIX H1] was missing
      type: String,
      trim: true,
    },

    // ── Sprint 1 — Inquiry Form Type ─────────────────────────────────────────
    // Supports the new source-of-truth forms while legacy inquiries remain valid.
    inquiryType: {
      type: String,
      enum: ['PLC_AUTOMATION', 'VFD_PANEL', 'MCC_PANEL', 'MCC_CUM_PLC', 'LEGACY'],
      default: 'LEGACY',
      index: true,
    },

    // ── Section 3 — Panel Type ────────────────────────────────────────────────
    panelTypes: {                         // [FIX H1] was missing — core field
      type:    [String],
      default: [],
    },

    customPanelType: {                    // [FIX H1] was missing
      type: String,
      trim: true,
    },

    applicationDescription: {            // [FIX H1] was missing
      type: String,
      trim: true,
    },

    applicationProcess: {                 // MCC source-of-truth field
      type: String,
      trim: true,
    },

    productType: {
      type: String,
      enum: ['PLC', 'MCC', 'VFD', 'PLC_MCC'],
      set: normalizeProductType,
      required: [true, 'Product type is required'],
    },
    
    // ── Section 4 — Technical Specs ───────────────────────────────────────────
    supplyVoltage: {                      // [FIX H1] was missing
      type: String,
      trim: true,
    },

    controlVoltage: {
      type: String,
      trim: true,
    },

    controlFeeder: {
      type: Boolean,
      default: false,
    },

    frequency: {                          // [FIX H1] was missing
      type:    String,
      trim:    true,
      default: '50 Hz',
    },

    panelAreaClassification: {            // New document-aligned field
      type: String,
      trim: true,
    },

    panelAreaClass: {                     // Legacy/frontend alias kept for compatibility
      type: String,
      trim: true,
    },

    ipRating: {                           // [FIX H1] was missing
      type: String,
      trim: true,
    },

    installationType: {                   // [FIX H1] was missing
      type: String,
      trim: true,
    },

    hazardousArea: {
      type: String,
      trim: true,
      default: '',
    },

    outdoorInstallation: {
      type: String,
      trim: true,
      default: '',
    },

    shortCircuitCapacity: {               // [FIX H1] was missing
      type: String,
      trim: true,
    },

    busbarMaterial: {                     // [FIX H1] was missing
      type:    String,
      trim:    true,
      default: 'Aluminium',
    },

    enclosureType: {
      type: String,
      trim: true,
    },

    enclosureMake: {
      type: String,
      trim: true,
    },

    panelStructure: {
      type: String,
      trim: true,
    },

    switchgearMake: {
      type: String,
      trim: true,
    },

    customSwitchgearMake: {
      type: String,
      trim: true,
    },

    panelColourRal: {                     // New document-aligned field
      type: String,
      trim: true,
    },

    cableEntry: {                         // New document-aligned field
      type: String,
      trim: true,
    },

    cableGlandMaterial: {                 // MCC source-of-truth field
      type: String,
      trim: true,
    },

    // ── Section 5 — Variant
    barrierVariant: {
      type: String,
      trim: true,
    },

    // ── Section 6 — Load Details ──────────────────────────────────────────────
    loadDetails: {                        // [FIX H1] was missing
      type:    [loadRowSchema],
      default: [],
    },

    // ── Section 7 — Control & Monitoring ─────────────────────────────────────
    controlType: {                        // [FIX H1] was missing
      type:    String,
      trim:    true,
      default: 'Automatic',
    },

    controlMatrix: {                      // [FIX H1] was missing — free-form object
      type:    mongoose.Schema.Types.Mixed,
      default: {},
    },

    // ── Section 8 — Standards & Compliance ───────────────────────────────────
    panelMounting: {                      // [FIX H1] was missing
      type: String,
      trim: true,
    },

    certificationRequired: {             // Boolean legacy OR CE/UL/IS/None new value(s)
      type: mongoose.Schema.Types.Mixed,
      default: false,
    },

    certificationDetails: {              // [FIX H1] was missing
      type: String,
      trim: true,
    },

    drawingsAttached: {                  // Legacy/frontend alias
      type: Boolean,
      default: false,
    },

    drawingsSldAttached: {               // New document-aligned field
      type: String,
      enum: ['', 'Yes', 'No', 'NA - Not Applicable'],
      default: '',
    },

    equipmentListAttached: {             // New document-aligned field
      type: String,
      enum: ['', 'Yes', 'No', 'NA - Not Applicable'],
      default: '',
    },

    referenceBomAttached: {              // VFD source-of-truth field
      type: String,
      enum: ['', 'Yes', 'No', 'NA - Not Applicable'],
      default: '',
    },

    commissioningScope: {
      type: Boolean,
      trim: true,
      default: false,
      },

    deliveryDate: {                       // [FIX H1] was missing
      type: Date,
    },

    orderEndDate: {
      type: Date,
    },

    programmingScope: {                   // [FIX H1] was missing
      type:    String,
      trim:    true,
      default: 'Customer Scope',
    },

    onsiteSupport: {                      // [FIX H1] was missing
      type:    Boolean,
      default: false,
    },

    deliveryTerms: {
      type: String,
      trim: true,
    },

    paymentTerms: {
      type: String,
      trim: true,
    },

    // ── Sprint 1 — Type-specific inquiry details ─────────────────────────────
    plcDetails: {
      type: plcDetailsSchema,
      default: () => ({}),
    },

    vfdDetails: {
      type: vfdDetailsSchema,
      default: () => ({}),
    },

    mccDetails: {
      type: mccDetailsSchema,
      default: () => ({}),
    },

    // Dedicated inquiry-stage selection forms for FLP enclosures and RIO boxes.
    // Kept as nested objects so the two forms remain independent from the
    // combined PLC/MCC/VFD technical and engineering sections.
    flpEnclosureDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },

    rioBoxDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },

    // ── Section 9 — Notes & Review ────────────────────────────────────────────
    additionalNotes: {                    // [FIX H1] was missing
      type: String,
      trim: true,
    },

    internalRemarks: {                    // [FIX H1] was missing
      type: String,
      trim: true,
    },

    preparedBy: {                         // [FIX H1] was missing
      type: String,
      trim: true,
    },

    reviewStatus: {                       // [FIX H1] was missing
      type: String,
      trim: true,
    },

    remarks: {
      type: String,
      trim: true,
    },

    // ── Attachments ───────────────────────────────────────────────────────────
    attachments: {                        // [FIX C2] was completely missing
      type:    [attachmentSchema],
      default: [],
    },

    // Legacy single-file attachment string — preserved for old records
    attachment: {
      type: String,
      trim: true,
    },

    // ── Existing fields (unchanged) ───────────────────────────────────────────
    status: {
      type: String,
      enum: [
        'New',
        'Technical Evaluation',
        'Technical BoM Submitted',
        'BoM Approval Pending',
        'Revision',
        'Commercial BOM Submission',
        'Order Won',
        'Order Lost',
        'Inquiry Hold',
        // Legacy statuses kept so old records can still be saved safely.
        'In Progress',
        'Commercial Discussion',
        'Commercial Submit',
        'Technical Submit',
        'Technical BOM Submission',
        'Technical BoM Submission',
        'BoM Submitted',
        'Technical BOM Submitted',
        'Technical BoM Submitted',
        'BOM Submitted',
        'Bom Submitted',
        'BOM SUBMITTED',
        'Technical BOM Approval',
        'Technical BoM Approval',
        'Order Received',
        'Order Recieved',
        'Inquiry Lost',
        'Inq. Lost',
        'Quotation Submit',
      ],
      default: 'New',
    },

    statusDetails: {
      type: statusDetailsSchema,
      default: () => ({}),
    },

    bomAttachments: {
      type: [bomAttachmentSchema],
      default: [],
    },

    createdBy: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },

    convertedToProject: { type: Boolean, default: false },
    projectReference:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },

    kickoffMeeting: { type: kickoffMeetingSchema, default: undefined },
  },
  { timestamps: true }
);

// ─── Text search index ────────────────────────────────────────────────────────
inquirySchema.index({
  customerName: 'text',
  companyName:  'text',
  projectName:  'text',
});

// ─── Sprint 1 indexes for new inquiry module filters ────────────────────────
inquirySchema.index({ inquiryType: 1, status: 1 });
inquirySchema.index({ inquiryType: 1, createdAt: -1 });
inquirySchema.index({ status: 1, createdAt: -1 });
inquirySchema.index({ customerRef: 1, createdAt: -1 });

// ─── Indexes on contacts sub-array ───────────────────────────────────────────
inquirySchema.index({ 'contacts.phone': 1 });
inquirySchema.index({ 'contacts.email': 1 });

// ─── Pre-save hook ────────────────────────────────────────────────────────────
inquirySchema.pre('save', async function (next) {
  // 1. Auto-increment inquiryId
  if (!this.inquiryId) {
    try {
      this.inquiryId = await getNextInquiryNumber();
    } catch (err) {
      return next(err);
    }
  }

  // 2. Sync contacts[0] → legacy flat fields
  if (this.contacts && this.contacts.length > 0) {
    const primary      = this.contacts[0];
    this.contactPerson = primary.name        || this.contactPerson || '';
    this.mobileNumber  = primary.phone       || this.mobileNumber  || '';
    this.email         = primary.email       || this.email         || '';
    this.designation   = primary.designation || this.designation   || '';
  }

  // 3. Back-fill contacts[] from legacy flat fields for old records
  if ((!this.contacts || this.contacts.length === 0) && this.contactPerson) {
    this.contacts = [{
      name:        this.contactPerson || '',
      phone:       this.mobileNumber  || '',
      email:       this.email         || '',
      designation: this.designation   || '',
    }];
  }

  next();
});

module.exports = mongoose.model('Inquiry', inquirySchema);