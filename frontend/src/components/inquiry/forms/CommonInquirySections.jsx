import React from 'react';
import {
  Calendar,
  Building2,
  MapPin,
  User,
  Plus,
  Eye,
  Trash2,
  FileText,
  UploadCloud,
  X,
  Paperclip,
  ClipboardList,
  Settings,
  ShieldCheck,
  ChevronDown,
  Zap,
} from 'lucide-react';

import {
  SectionCard,
  FormField,
  Input,
  Textarea,
  Button,
  AutocompleteInput,
  SearchableSelect,
} from '../../common/FormComponents.extended';

import {
  OFFER_TYPES,
  DESIGNATION_OPTIONS,
  VOLTAGE_OPTIONS,
  FREQUENCY_OPTIONS,
  SHORT_CIRCUIT_OPTIONS,
} from '../../../data/masterData';

import PlcPanelInquirySection from './PlcPanelInquirySection';
import MccPanelInquirySection from './MccPanelInquirySection';
import FlpEnclosureInquirySection from './FlpEnclosureInquirySection';
import RioBoxInquirySection from './RioBoxInquirySection';

import {
  INQUIRY_TYPES,
  GENERAL_INQUIRY_PANEL_TYPE_OPTIONS,
  PANEL_AREA_CLASSIFICATION_OPTIONS,
  INSTALLATION_TYPE_OPTIONS,
  CERTIFICATION_OPTIONS,
  SWITCHGEAR_MAKE_OPTIONS,
  CONTROL_VOLTAGE_OPTIONS,
  MCC_PANEL_STRUCTURE_OPTIONS,
  FLP_PANEL_STRUCTURE_OPTIONS,
  getInquiryTypeFromPanelTypes,
  getProductTypeFromPanelTypes,
  normalizeInquiryPanelTypes,
  hasInquiryPanelType,
} from '../../../data/inquiryMasterData';

const COMMISSIONING_SCOPE_OPTIONS = ['In Our Scope', 'Customer Scope'];

const companyTypeOptions = [
  'End User',
  'OEM',
  'Consultant',
  'Contractor',
  'System Integrator',
  'Panel Builder',
  'Dealer / Trader',
  'Other',
];

const REMOVED_SUPPLY_VOLTAGE_OPTIONS = new Set([
  '48V DC',
  '110V DC',
  '220V DC',
  '440V AC, 3 Phase + Neutral',
  '440 V AC, 3 Phase + Neutral',
  '415V AC, 3 Phase',
]);

const supplyVoltageOptions = Array.from(new Set([
  '440V AC, 3 Phase',
  '415 V AC 3 Phase',
  '415 V AC 3 Phase + Neutral',
  'Custom',
  ...(Array.isArray(VOLTAGE_OPTIONS) ? VOLTAGE_OPTIONS : []),
])).filter((option) => !REMOVED_SUPPLY_VOLTAGE_OPTIONS.has(option));

const frequencyOptions = Array.from(new Set([
  '50 Hz',
  '60 Hz',
  ...(Array.isArray(FREQUENCY_OPTIONS) ? FREQUENCY_OPTIONS : []),
]));

const shortCircuitOptions = Array.from(new Set([
  ...(Array.isArray(SHORT_CIRCUIT_OPTIONS) ? SHORT_CIRCUIT_OPTIONS : []),
])).filter((option) => !/1\s*sec/i.test(String(option)));

const protectionClassOptions = [
  'IP20',
  'IP27',
  'IP40',
  'IP42',
  'IP54',
  'IP65',
  'IP66',
  'IP67',
];

const enclosureTypeOptions = [
  'CRCA / MS',
  'SS304',
  'SS316',
  'FLP',
];

const cableEntryOptions = [
  'Top',
  'Bottom',
];

const DEFAULT_PANEL_COLOUR_OPTIONS = [
  'RAL 7035',
  'RAL 7032',
  'RAL 9002',
  'RAL 9005',
];

const PANEL_COLOUR_STORAGE_KEY = 'nexusInquiryPanelColourRalOptions';

const getStoredPanelColourOptions = () => {
  if (typeof window === 'undefined') return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(PANEL_COLOUR_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (_) {
    return [];
  }
};

const savePanelColourOption = (value) => {
  const cleanValue = String(value || '').trim();
  if (!cleanValue || DEFAULT_PANEL_COLOUR_OPTIONS.includes(cleanValue)) return;
  if (typeof window === 'undefined') return;

  const options = Array.from(new Set([...getStoredPanelColourOptions(), cleanValue]));
  window.localStorage.setItem(PANEL_COLOUR_STORAGE_KEY, JSON.stringify(options));
};

const DEFAULT_CABLE_GLAND_MATERIAL_OPTIONS = [
  'Brass',
  'Nickel Plated Brass',
  'SS304',
  'SS316',
  'Polyamide',
  'FLP',
];

const CABLE_GLAND_MATERIAL_STORAGE_KEY = 'nexusInquiryCableGlandMaterialOptions';

const getStoredCableGlandMaterialOptions = () => {
  if (typeof window === 'undefined') return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(CABLE_GLAND_MATERIAL_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (_) {
    return [];
  }
};

const saveCableGlandMaterialOption = (value) => {
  const cleanValue = String(value || '').trim();
  if (!cleanValue || DEFAULT_CABLE_GLAND_MATERIAL_OPTIONS.includes(cleanValue)) return;
  if (typeof window === 'undefined') return;

  const options = Array.from(new Set([...getStoredCableGlandMaterialOptions(), cleanValue]));
  window.localStorage.setItem(CABLE_GLAND_MATERIAL_STORAGE_KEY, JSON.stringify(options));
};

const isControlFeederSupplyVoltage = (value = '') => {
  const normalized = String(value || '')
    .toUpperCase()
    .replace(/[,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized || normalized.includes('NEUTRAL')) return false;

  return /^(415|440)\s*V\s*(AC\s*)?3\s*PHASE$/.test(normalized);
};


export const INQUIRY_STATUS_OPTIONS = [
  { value: 'New', label: 'New' },
  { value: 'Technical Evaluation', label: 'Technical Evaluation' },
  { value: 'Technical BoM Submitted', label: 'Technical BoM Submitted' },
  { value: 'BoM Approval Pending', label: 'BoM Approval Pending' },
  { value: 'Revision', label: 'Revision' },
  { value: 'Commercial BOM Submission', label: 'Commercial BOM Submission' },
  { value: 'Order Won', label: 'Project Won' },
  { value: 'Order Lost', label: 'Order Lost' },
  { value: 'Inquiry Hold', label: 'Inquiry Hold' },
];

const normalizeInquiryStatusValue = (status = '') => {
  const legacyMap = {
    'Project Won': 'Order Won',
    'Order Received': 'Order Won',
    'Order Recieved': 'Order Won',
    'Inquiry Lost': 'Order Lost',
    'Inq. Lost': 'Order Lost',
    'In Progress': 'Technical Evaluation',
    'Technical Submit': 'Technical BoM Submitted',
    'Technical BOM Submission': 'Technical BoM Submitted',
    'Technical BoM Submission': 'Technical BoM Submitted',
    'BoM Submitted': 'Technical BoM Submitted',
    'Technical BOM Submitted': 'Technical BoM Submitted',
    'Technical BoM Submitted': 'Technical BoM Submitted',
    'BOM Submitted': 'Technical BoM Submitted',
    'Bom Submitted': 'Technical BoM Submitted',
    'BOM SUBMITTED': 'Technical BoM Submitted',
    'Technical BOM Approval': 'BoM Approval Pending',
    'Technical BoM Approval': 'BoM Approval Pending',
    'Commercial Submit': 'Commercial BOM Submission',
    'Commercial Discussion': 'Commercial BOM Submission',
    'Quotation Submit': 'Commercial BOM Submission',
  };

  const legacyKeyMap = {
    technicalbomsubmission: 'Technical BoM Submitted',
    technicalbomsubmitted: 'Technical BoM Submitted',
    bomsubmitted: 'Technical BoM Submitted',
    technicalbomapproval: 'BoM Approval Pending',
  };
  const legacyKey = String(status || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  return legacyMap[status] || legacyKeyMap[legacyKey] || status || 'New';
};

const ORDER_LOST_REASONS = ['Price', 'Commercial', 'Priority', 'Timing', 'Trust Issue', 'Certification'];
const HOLD_REASONS = ['Due to Customer', 'Specification', 'Technical', 'Commercial'];

const getAttachmentUrl = (attachment) => {
  if (!attachment) return '';
  const storagePath = attachment.storagePath || (attachment.storedName ? `inquiry/${attachment.storedName}` : '');
  return storagePath ? `/uploads/${storagePath}` : '';
};

const getAttachmentDownloadName = (attachment = {}) => {
  const rawName = attachment.name || attachment.originalName || attachment.storedName || 'Attachment';
  return String(rawName).split(/[\/]/).pop() || 'Attachment';
};

const getBomVersionLabel = (attachment = {}) => {
  const revisionNumber = Number(attachment.revisionNumber);
  if (Number.isFinite(revisionNumber)) return `Revision ${revisionNumber}`;
  return attachment.versionLabel || 'Revision 0';
};

const formatUploadDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getUploadedByName = (attachment = {}) => {
  const uploadedBy = attachment?.uploadedBy;
  if (!uploadedBy || typeof uploadedBy === 'string') return '';
  return uploadedBy.name || uploadedBy.email || '';
};

const updateStatusDetails = (setForm, section, field, value) => {
  setForm((prev) => ({
    ...prev,
    statusDetails: {
      ...(prev.statusDetails || {}),
      [section]: {
        ...((prev.statusDetails || {})[section] || {}),
        [field]: value,
      },
    },
  }));
};

const normaliseSelectOptions = (options = []) =>
  options.map((option) => {
    if (typeof option === 'string') return { value: option, label: option };
    return option;
  });

const formatInquiryDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
};

const buildPastInquiryOptions = (pastInquiries = [], currentValue = '') => {
  const seen = new Set();
  const options = [];

  pastInquiries.forEach((item, index) => {
    const reference = item?.inquiryId || item?.projectId || item?._id || '';
    if (!reference || seen.has(reference)) return;

    seen.add(reference);

    const projectName = item?.projectName || item?.name || 'No Project Name';
    const status = item?.status || 'Order Won';
    const dateLabel = formatInquiryDate(item?.orderReceivedDate || item?.createdAt || item?.inquiryDate);
    const meta = [status, dateLabel].filter(Boolean).join(' · ');

    options.push({
      value: reference,
      label: `${item?.inquiryId || `Inquiry ${index + 1}`} · ${projectName}${meta ? ` (${meta})` : ''}`,
    });
  });

  if (currentValue && !seen.has(currentValue)) {
    options.unshift({ value: currentValue, label: currentValue });
  }

  return options;
};

const getError = (errors = {}, key) => errors?.[key] || '';

const getContactError = (errors = {}, index, field) => (
  errors?.[`contacts.${index}.${field}`] ||
  errors?.[`contacts[${index}].${field}`] ||
  errors?.[`contact.${index}.${field}`] ||
  ''
);

const setValue = (setForm, field, value) => {
  setForm((prev) => ({
    ...prev,
    [field]: value,
  }));
};

const togglePanelType = (setForm, panelType) => {
  setForm((prev) => {
    const selected = normalizeInquiryPanelTypes(prev?.panelTypes || []);
    const nextPanelTypes = selected.includes(panelType)
      ? selected.filter((value) => value !== panelType)
      : [...selected, panelType];

    const addingFlp = panelType === 'FLP' && !selected.includes('FLP');
    return {
      ...prev,
      panelTypes: nextPanelTypes,
      inquiryType: getInquiryTypeFromPanelTypes(nextPanelTypes),
      productType: getProductTypeFromPanelTypes(nextPanelTypes),
      ipRating: prev?.ipRating || 'IP65',
      hazardousArea: addingFlp ? (prev?.hazardousArea || 'Yes') : prev?.hazardousArea,
      outdoorInstallation: addingFlp ? (prev?.outdoorInstallation || '') : prev?.outdoorInstallation,
      enclosureType: addingFlp && prev?.enclosureType === 'CRCA / MS' ? '' : prev?.enclosureType,
      panelStructure: addingFlp && prev?.panelStructure === 'Back-to-Back' ? '' : prev?.panelStructure,
    };
  });
};

const CheckboxMultiSelectDropdown = ({
  options = [],
  values = [],
  onToggle,
  placeholder = 'Select options',
  disabled = false,
  error = '',
}) => {
  const [open, setOpen] = React.useState(false);
  const wrapperRef = React.useRef(null);

  React.useEffect(() => {
    const handleOutsideClick = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  React.useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const selectedLabels = options
    .filter((option) => values.includes(option.value))
    .map((option) => option.label);

  const displayValue = selectedLabels.length === 0
    ? placeholder
    : selectedLabels.length <= 2
      ? selectedLabels.join(', ')
      : `${selectedLabels.slice(0, 2).join(', ')} +${selectedLabels.length - 2} more`;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((current) => !current)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex min-h-[42px] w-full items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2 text-left text-base transition focus:outline-none focus:ring-2 sm:text-sm ${
          error
            ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
        } ${disabled ? 'cursor-not-allowed bg-gray-50 text-gray-500' : 'cursor-pointer'}`}
      >
        <span className={`min-w-0 flex-1 truncate ${selectedLabels.length ? 'text-gray-900' : 'text-gray-400'}`}>
          {displayValue}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {selectedLabels.length > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {selectedLabels.length}
            </span>
          )}
          <ChevronDown
            size={17}
            className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && !disabled && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
        >
          <div className="max-h-72 overflow-y-auto p-2">
            {options.map((option) => {
              const checked = values.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                    checked
                      ? 'bg-blue-50 font-semibold text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle?.(option.value)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const updateSharedSwitchgearMake = (setForm, value) => {
  setForm((prev) => {
    const selected = normalizeInquiryPanelTypes(prev?.panelTypes || []);
    const customSwitchgearMake = isOtherValue(value)
      ? prev?.customSwitchgearMake || ''
      : '';
    const shouldSyncPlc = selected.includes('PLC') || selected.includes('MCC cum PLC');
    const shouldSyncVfd = selected.includes('VFD');
    const shouldSyncMcc = selected.includes('MCC') || selected.includes('MCC cum PLC');

    return {
      ...prev,
      switchgearMake: value,
      customSwitchgearMake,
      plcDetails: shouldSyncPlc
        ? {
            ...(prev?.plcDetails || {}),
            switchgearMake: value,
            customSwitchgearMake,
          }
        : prev?.plcDetails,
      vfdDetails: shouldSyncVfd
        ? {
            ...(prev?.vfdDetails || {}),
            switchgearMake: value,
            customSwitchgearMake,
          }
        : prev?.vfdDetails,
      mccDetails: shouldSyncMcc
        ? {
            ...(prev?.mccDetails || {}),
            outgoingFeederDetails: {
              ...(prev?.mccDetails?.outgoingFeederDetails || {}),
              switchgearMake: value,
              customSwitchgearMake,
            },
          }
        : prev?.mccDetails,
    };
  });
};

const updateSharedCustomSwitchgearMake = (setForm, value) => {
  setForm((prev) => {
    const selected = normalizeInquiryPanelTypes(prev?.panelTypes || []);
    const shouldSyncPlc = selected.includes('PLC') || selected.includes('MCC cum PLC');
    const shouldSyncVfd = selected.includes('VFD');
    const shouldSyncMcc = selected.includes('MCC') || selected.includes('MCC cum PLC');

    return {
      ...prev,
      customSwitchgearMake: value,
      plcDetails: shouldSyncPlc
        ? { ...(prev?.plcDetails || {}), customSwitchgearMake: value }
        : prev?.plcDetails,
      vfdDetails: shouldSyncVfd
        ? { ...(prev?.vfdDetails || {}), customSwitchgearMake: value }
        : prev?.vfdDetails,
      mccDetails: shouldSyncMcc
        ? {
            ...(prev?.mccDetails || {}),
            outgoingFeederDetails: {
              ...(prev?.mccDetails?.outgoingFeederDetails || {}),
              customSwitchgearMake: value,
            },
          }
        : prev?.mccDetails,
    };
  });
};

const updateSharedPanelStructure = (setForm, value) => {
  setForm((prev) => ({
    ...prev,
    panelStructure: value,
    mccDetails: {
      ...(prev?.mccDetails || {}),
      layoutPreferences: {
        ...(prev?.mccDetails?.layoutPreferences || {}),
        panelStructure: value,
      },
    },
  }));
};

const toggleCertification = (form, setForm, value) => {
  const current = Array.isArray(form.certificationRequired)
    ? form.certificationRequired
    : form.certificationRequired
      ? [form.certificationRequired]
      : [];

  let next;

  if (value === 'None') {
    next = current.includes('None') ? [] : ['None'];
  } else {
    const withoutNone = current.filter((item) => item !== 'None');
    next = withoutNone.includes(value)
      ? withoutNone.filter((item) => item !== value)
      : [...withoutNone, value];
  }

  setValue(setForm, 'certificationRequired', next);
};

const isCertificationChecked = (form, value) => {
  const current = Array.isArray(form.certificationRequired)
    ? form.certificationRequired
    : form.certificationRequired
      ? [form.certificationRequired]
      : [];

  return current.includes(value);
};

const safeContacts = (contacts = []) => (
  Array.isArray(contacts) && contacts.length > 0
    ? contacts
    : [{ name: '', phone: '', email: '', designation: '' }]
);

const isOtherValue = (value) =>
  String(value || '').trim().toUpperCase() === 'OTHER';

const getSwitchgearDetailKey = (inquiryType) => {
  if (inquiryType === INQUIRY_TYPES.VFD_PANEL) return 'vfdDetails';
  if (
    inquiryType === INQUIRY_TYPES.PLC_AUTOMATION ||
    inquiryType === INQUIRY_TYPES.MCC_CUM_PLC
  ) {
    return 'plcDetails';
  }
  if (inquiryType === INQUIRY_TYPES.MCC_PANEL) return 'mccDetails.outgoingFeederDetails';

  return '';
};

const getNestedDetail = (source = {}, detailKey = '') => {
  if (!detailKey) return {};
  return detailKey
    .split('.')
    .filter(Boolean)
    .reduce((current, key) => current?.[key], source) || {};
};

const updateNestedDetailField = (setForm, detailKey, field, value) => {
  if (!detailKey) return;

  const keys = detailKey.split('.').filter(Boolean);

  setForm((prev) => {
    if (keys.length === 1) {
      const key = keys[0];
      return {
        ...prev,
        [key]: {
          ...(prev?.[key] || {}),
          [field]: value,
        },
      };
    }

    const [parentKey, childKey] = keys;
    return {
      ...prev,
      [parentKey]: {
        ...(prev?.[parentKey] || {}),
        [childKey]: {
          ...(prev?.[parentKey]?.[childKey] || {}),
          [field]: value,
        },
      },
    };
  });
};

const updateSwitchgearMake = (setForm, detailKey, value) => {
  if (!detailKey) return;

  const keys = detailKey.split('.').filter(Boolean);

  setForm((prev) => {
    const currentDetails = getNestedDetail(prev, detailKey);
    const nextDetails = {
      ...currentDetails,
      switchgearMake: value,
      customSwitchgearMake: isOtherValue(value)
        ? currentDetails.customSwitchgearMake || ''
        : '',
    };

    if (keys.length === 1) {
      const key = keys[0];
      return {
        ...prev,
        [key]: nextDetails,
      };
    }

    const [parentKey, childKey] = keys;
    return {
      ...prev,
      [parentKey]: {
        ...(prev?.[parentKey] || {}),
        [childKey]: nextDetails,
      },
    };
  });
};

const CommonInquirySections = ({
  form,
  setForm,
  errors = {},
  disabled = false,
  statusDisabled = disabled,
  statusOptions = INQUIRY_STATUS_OPTIONS,
  setSectionRef,
  activeSection = -1,

  companySuggestions = [],
  contactNameSuggestions = [],
  citySuggestions = [],
  pastInquiries = [],
  customerOptions = [],
  createdByName = '-',
  canCreateCustomer = false,
  canViewCustomer = false,
  onCustomerSelect,
  onCreateCustomerClick,
  onViewCustomerClick,

  addContact,
  removeContact,
  updateContact,

  stagedFiles = [],
  savedAttachments = [],
  bomStagedFiles = [],
  savedBomAttachments = [],
  dragActive = false,
  fileInputRef,
  bomFileInputRef,

  handleFileSelect,
  handleDrag,
  handleDrop,

  removeStagedFile,
  removeSavedAttachment,
  handleBomFileSelect,
  removeBomStagedFile,
  removeSavedBomAttachment,

  formatBytes,
  fileEmoji,
  technicalContent = null,
  engineeringContent = null,
  vfdPanelContent = null,
}) => {
  const contacts = safeContacts(form?.contacts);
  const panelTypes = normalizeInquiryPanelTypes(form?.panelTypes || []);
  const inquiryType = getInquiryTypeFromPanelTypes(panelTypes);
  const hasSelectedInquiryType = panelTypes.length > 0;
  const showPlcSection =
    hasInquiryPanelType(panelTypes, 'PLC') ||
    hasInquiryPanelType(panelTypes, 'MCC cum PLC');
  const showMccSection =
    hasInquiryPanelType(panelTypes, 'MCC') ||
    hasInquiryPanelType(panelTypes, 'MCC cum PLC');
  const showVfdPanelSection = hasInquiryPanelType(panelTypes, 'VFD') && Boolean(vfdPanelContent);
  const showFlpSection = hasInquiryPanelType(panelTypes, 'FLP');
  const showRioSection = hasInquiryPanelType(panelTypes, 'RIO Box');
  const mccCommissioningScope = form?.mccDetails?.notesAndSupport?.commissioningScope || '';
  const updateMccCommissioningScope = (value) => {
    setForm((previousForm) => ({
      ...previousForm,
      mccDetails: {
        ...(previousForm?.mccDetails || {}),
        notesAndSupport: {
          ...(previousForm?.mccDetails?.notesAndSupport || {}),
          commissioningScope: value,
          commissioningSupportRequired:
            value === 'In Our Scope'
              ? 'Required'
              : value === 'Customer Scope'
                ? 'Not Required'
                : value,
          commissioningSupportDays: '',
        },
      },
    }));
  };
  const generalEnclosureTypeOptions = showFlpSection
    ? ['Cast Aluminium Alloy LM-6', 'SS304', 'SS316', 'FLP']
    : enclosureTypeOptions;
  const generalPanelStructureOptions = showFlpSection
    ? FLP_PANEL_STRUCTURE_OPTIONS
    : MCC_PANEL_STRUCTURE_OPTIONS;
  const showSharedTechnicalEngineering = hasInquiryPanelType(panelTypes, 'VFD');
  const requiresCommonTechnicalFields = showPlcSection || showMccSection;
  const specializedSectionCount =
    Number(showPlcSection) +
    Number(showMccSection) +
    Number(showVfdPanelSection) +
    Number(showFlpSection) +
    Number(showRioSection);
  const plcSectionIndex = showPlcSection ? 2 : -1;
  const mccSectionIndex = showMccSection ? 2 + Number(showPlcSection) : -1;
  const vfdPanelSectionIndex = showVfdPanelSection
    ? 2 + Number(showPlcSection) + Number(showMccSection)
    : -1;
  const flpSectionIndex = showFlpSection
    ? 2 + Number(showPlcSection) + Number(showMccSection) + Number(showVfdPanelSection)
    : -1;
  const rioSectionIndex = showRioSection
    ? 2 + Number(showPlcSection) + Number(showMccSection) + Number(showVfdPanelSection) + Number(showFlpSection)
    : -1;
  const technicalSectionIndex = showSharedTechnicalEngineering
    ? 2 + specializedSectionCount
    : -1;
  const engineeringSectionIndex = showSharedTechnicalEngineering
    ? technicalSectionIndex + 1
    : -1;
  const attachmentsSectionIndex =
    2 + specializedSectionCount + (showSharedTechnicalEngineering ? 2 : 0);
  const technicalBomSectionIndex = attachmentsSectionIndex + 1;
  const isRepeatOrder = form?.offerType === 'repeat';
  const fallbackSwitchgearDetails = getNestedDetail(form, getSwitchgearDetailKey(inquiryType));
  const switchgearMake = form?.switchgearMake || fallbackSwitchgearDetails.switchgearMake || '';
  const customSwitchgearMake = form?.customSwitchgearMake || fallbackSwitchgearDetails.customSwitchgearMake || '';
  const switchgearMakeError = getError(errors, 'switchgearMake') ||
    getError(errors, 'plcDetails.switchgearMake') ||
    getError(errors, 'vfdDetails.switchgearMake') ||
    getError(errors, 'mccDetails.outgoingFeederDetails.switchgearMake');
  const customSwitchgearMakeError = getError(errors, 'customSwitchgearMake') ||
    getError(errors, 'plcDetails.customSwitchgearMake') ||
    getError(errors, 'vfdDetails.customSwitchgearMake') ||
    getError(errors, 'mccDetails.outgoingFeederDetails.customSwitchgearMake');
  const showCustomSwitchgearMake = isOtherValue(switchgearMake);
  const showCustomSupplyVoltage = form?.supplyVoltage === 'Custom';
  const pastInquiryOptions = buildPastInquiryOptions(pastInquiries, form?.previousOrderRef || '');
  const selectedEnclosureType = form?.enclosureType || '';
  const normalizedEnclosureType = String(selectedEnclosureType).trim().toUpperCase();
  const showPanelColourRal = Boolean(normalizedEnclosureType) &&
    !['SS304', 'SS316'].includes(normalizedEnclosureType);
  const showControlFeeder = isControlFeederSupplyVoltage(form?.supplyVoltage);
  const [bomDragActive, setBomDragActive] = React.useState(false);

  const handleBomDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (disabled) return;

    if (event.type === 'dragenter' || event.type === 'dragover') {
      setBomDragActive(true);
    }

    if (event.type === 'dragleave') {
      setBomDragActive(false);
    }
  };

  const handleBomDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setBomDragActive(false);

    if (disabled) return;

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    if (typeof handleBomFileSelect === 'function') {
      handleBomFileSelect({ target: { files } });
    }
  };

  const panelColourOptions = Array.from(new Set([
    ...DEFAULT_PANEL_COLOUR_OPTIONS,
    ...getStoredPanelColourOptions(),
    ...(form?.panelColourRal ? [form.panelColourRal] : []),
  ].filter(Boolean)));
  const cableGlandMaterialOptions = Array.from(new Set([
    ...DEFAULT_CABLE_GLAND_MATERIAL_OPTIONS,
    ...getStoredCableGlandMaterialOptions(),
    ...(form?.cableGlandMaterial ? [form.cableGlandMaterial] : []),
  ].filter(Boolean)));

  return (
    <div className="space-y-6">
      <div ref={(el) => setSectionRef?.(0, el)}>
        <SectionCard
          number="1"
          title="Client & Project Information"
          subtitle="Select the customer and enter the project reference details."
          icon={Building2}
          color="green"
          active={activeSection === 0}
        >
          <div className="space-y-5">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Building2 size={16} className="text-emerald-600" />
                <h4 className="text-sm font-semibold text-slate-800">Client Information</h4>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <FormField
                  label="Customer Name"
                  required
                  error={getError(errors, 'customerName')}
                >
                  <SearchableSelect
                    value={form?.customerRef || ''}
                    onChange={(value) => onCustomerSelect?.(value)}
                    options={customerOptions}
                    placeholder={canViewCustomer
                      ? (customerOptions.length ? 'Select customer name' : 'No customers found')
                      : 'Customer View access required'}
                    error={getError(errors, 'customerName')}
                    disabled={disabled || !canViewCustomer}
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
                  {canViewCustomer && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onViewCustomerClick}
                      disabled={!form?.customerRef}
                      className="w-full justify-center sm:w-auto"
                      title="View customer details"
                    >
                      <Eye size={14} />
                      View
                    </Button>
                  )}

                  {!disabled && canCreateCustomer && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onCreateCustomerClick}
                      className="w-full justify-center sm:w-auto"
                    >
                      <Plus size={14} />
                      Add New Customer
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-5">
              <div className="mb-3 flex items-center gap-2">
                <FileText size={16} className="text-violet-600" />
                <h4 className="text-sm font-semibold text-slate-800">Project Information</h4>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormField
                  label="Project Name"
                  required
                  error={getError(errors, 'projectName')}
                >
                  <Input
                    value={form?.projectName || ''}
                    onChange={(event) => setValue(setForm, 'projectName', event.target.value)}
                    placeholder="Enter Project name"
                    disabled={disabled}
                  />
                </FormField>

                <FormField
                  label="Offer Type"
                  required
                  error={getError(errors, 'offerType')}
                >
                  <SearchableSelect
                    value={form?.offerType || ''}
                    onChange={(value) => {
                      setValue(setForm, 'offerType', value);
                      if (value !== 'repeat') {
                        setValue(setForm, 'previousOrderRef', '');
                      }
                    }}
                    options={normaliseSelectOptions(OFFER_TYPES)}
                    placeholder="Select offer type"
                    error={getError(errors, 'offerType')}
                    disabled={disabled}
                  />
                </FormField>

                <FormField label="Created By">
                  <Input
                    value={createdByName || '-'}
                    readOnly
                    disabled
                    aria-label="Created By"
                    title="Automatically taken from the logged-in user"
                    className="cursor-not-allowed border-gray-200 bg-gray-100 font-medium text-gray-600 opacity-80"
                  />
                </FormField>

                {isRepeatOrder && (
                  <FormField
                    label="Previous Order Reference"
                    error={getError(errors, 'previousOrderRef')}
                  >
                    <SearchableSelect
                      value={form?.previousOrderRef || ''}
                      onChange={(value) => setValue(setForm, 'previousOrderRef', value)}
                      options={pastInquiryOptions}
                      placeholder={pastInquiryOptions.length ? 'Select past inquiry / order' : 'No past inquiries found'}
                      error={getError(errors, 'previousOrderRef')}
                      disabled={disabled || pastInquiryOptions.length === 0}
                    />
                  </FormField>
                )}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div ref={(el) => setSectionRef?.(1, el)}>
        <SectionCard
          number="2"
          title="General Inquiry Information"
          subtitle="Select panel types and enter the common inquiry specifications."
          icon={ClipboardList}
          color="blue"
          active={activeSection === 1}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField
              label="Inquiry Date"
              error={getError(errors, 'inquiryDate')}
            >
              <div className="relative">
                <Calendar
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <Input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={form?.inquiryDate || ''}
                  onChange={(event) => setValue(setForm, 'inquiryDate', event.target.value)}
                  disabled={disabled}
                  className="pl-9"
                />
              </div>
            </FormField>

            <FormField
              label="Panel Type"
              required
              error={getError(errors, 'panelTypes') || getError(errors, 'inquiryType')}
            >
              <CheckboxMultiSelectDropdown
                options={GENERAL_INQUIRY_PANEL_TYPE_OPTIONS}
                values={panelTypes}
                onToggle={(value) => togglePanelType(setForm, value)}
                placeholder="Select panel type"
                disabled={disabled}
                error={getError(errors, 'panelTypes') || getError(errors, 'inquiryType')}
              />
            </FormField>

            <FormField
              label="Status"
              error={getError(errors, 'status')}
            >
              <SearchableSelect
                value={normalizeInquiryStatusValue(form?.status)}
                onChange={(value) => setValue(setForm, 'status', value)}
                options={normaliseSelectOptions(statusOptions)}
                placeholder="Select status"
                error={getError(errors, 'status')}
                disabled={statusDisabled}
              />
            </FormField>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

            <FormField
              label="Panel Area Classification"
              required={requiresCommonTechnicalFields}
              error={getError(errors, 'panelAreaClassification')}
            >
              <SearchableSelect
                includeNotApplicable
                value={form?.panelAreaClassification || form?.panelAreaClass || ''}
                onChange={(value) => {
                  setForm((prev) => ({
                    ...prev,
                    panelAreaClassification: value,
                    panelAreaClass: value,
                  }));
                }}
                options={normaliseSelectOptions(PANEL_AREA_CLASSIFICATION_OPTIONS)}
                placeholder="Select area classification"
                error={getError(errors, 'panelAreaClassification')}
                disabled={disabled}
              />
            </FormField>

            <FormField
              label={showFlpSection ? "Installation" : "Installation Type"}
              required={requiresCommonTechnicalFields}
              error={getError(errors, 'installationType')}
            >
              <SearchableSelect
                includeNotApplicable
                value={form?.installationType || ''}
                onChange={(value) => setValue(setForm, 'installationType', value)}
                options={normaliseSelectOptions(INSTALLATION_TYPE_OPTIONS)}
                placeholder="Select installation type"
                error={getError(errors, 'installationType')}
                disabled={disabled}
              />
            </FormField>

            {showFlpSection && (
              <FormField
                label="Hazardous Area"
                error={getError(errors, 'hazardousArea')}
              >
                <SearchableSelect
                  includeNotApplicable
                  value={form?.hazardousArea || 'Yes'}
                  onChange={(value) => setValue(setForm, 'hazardousArea', value)}
                  options={['Yes', 'No']}
                  placeholder="Select hazardous area"
                  error={getError(errors, 'hazardousArea')}
                  disabled={disabled}
                />
              </FormField>
            )}

            {showFlpSection && (
              <FormField
                label="Outdoor Installation"
                error={getError(errors, 'outdoorInstallation')}
              >
                <SearchableSelect
                  includeNotApplicable
                  value={form?.outdoorInstallation || ''}
                  onChange={(value) => setValue(setForm, 'outdoorInstallation', value)}
                  options={['Yes', 'No']}
                  placeholder="Select outdoor installation"
                  error={getError(errors, 'outdoorInstallation')}
                  disabled={disabled}
                />
              </FormField>
            )}

            <FormField
              label="IP Rating"
              error={getError(errors, 'ipRating')}
            >
              <SearchableSelect
                includeNotApplicable
                value={form?.ipRating || ''}
                onChange={(value) => setValue(setForm, 'ipRating', value)}
                options={normaliseSelectOptions(protectionClassOptions)}
                placeholder="Select IP rating"
                error={getError(errors, 'ipRating')}
                disabled={disabled}
              />
            </FormField>

            <FormField
              label="Enclosure Type"
              required={requiresCommonTechnicalFields}
              error={getError(errors, 'enclosureType')}
            >
              <SearchableSelect
                includeNotApplicable
                value={form?.enclosureType || ''}
                onChange={(value) => {
                  const normalizedValue = String(value || '').trim().toUpperCase();
                  const hidesMaterialColour = ['SS304', 'SS316'].includes(normalizedValue);

                  setForm((prev) => ({
                    ...prev,
                    enclosureType: value,
                    panelColourRal: hidesMaterialColour ? '' : prev.panelColourRal,
                  }));
                }}
                options={normaliseSelectOptions(generalEnclosureTypeOptions)}
                placeholder="Select enclosure type"
                error={getError(errors, 'enclosureType')}
                disabled={disabled}
              />
            </FormField>

            {showPanelColourRal && (
              <FormField
                label="Enclosure Material Color (RAL)"
                error={getError(errors, 'panelColourRal')}
              >
                <Input
                  list="panel-colour-ral-options"
                  value={form?.panelColourRal || ''}
                  onChange={(event) => setValue(setForm, 'panelColourRal', event.target.value)}
                  onBlur={(event) => savePanelColourOption(event.target.value)}
                  placeholder="Select or enter RAL color"
                  disabled={disabled}
                />
                <datalist id="panel-colour-ral-options">
                  {panelColourOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </FormField>
            )}

            <FormField
              label="Enclosure Make"
              error={getError(errors, 'enclosureMake')}
            >
              <Input
                value={form?.enclosureMake || ''}
                onChange={(event) => setValue(setForm, 'enclosureMake', event.target.value)}
                placeholder="Enter enclosure make"
                disabled={disabled}
              />
            </FormField>

            <FormField
              label="Panel Structure"
              error={getError(errors, 'panelStructure') || getError(errors, 'mccDetails.layoutPreferences.panelStructure')}
            >
              <SearchableSelect
                includeNotApplicable
                value={form?.panelStructure || form?.mccDetails?.layoutPreferences?.panelStructure || ''}
                onChange={(value) => updateSharedPanelStructure(setForm, value)}
                options={normaliseSelectOptions(generalPanelStructureOptions)}
                placeholder="Select panel structure"
                error={getError(errors, 'panelStructure') || getError(errors, 'mccDetails.layoutPreferences.panelStructure')}
                disabled={disabled}
              />
            </FormField>

            <FormField
              label="Cable Entry"
              required={requiresCommonTechnicalFields}
              error={getError(errors, 'cableEntry')}
            >
              <SearchableSelect
                includeNotApplicable
                value={form?.cableEntry || ''}
                onChange={(value) => setValue(setForm, 'cableEntry', value)}
                options={normaliseSelectOptions(cableEntryOptions)}
                placeholder="Select cable entry"
                error={getError(errors, 'cableEntry')}
                disabled={disabled}
              />
            </FormField>

            {showMccSection && (
              <FormField
                label="Commissioning Scope"
                required
                error={getError(errors, 'mccDetails.notesAndSupport.commissioningScope')}
              >
                <SearchableSelect
                  includeNotApplicable
                  value={mccCommissioningScope}
                  onChange={updateMccCommissioningScope}
                  options={normaliseSelectOptions(COMMISSIONING_SCOPE_OPTIONS)}
                  placeholder="Select commissioning scope"
                  error={getError(errors, 'mccDetails.notesAndSupport.commissioningScope')}
                  disabled={disabled}
                />
              </FormField>
            )}

            <FormField
              label="Switchgear Make"
              error={switchgearMakeError}
            >
              <SearchableSelect
                includeNotApplicable
                value={switchgearMake}
                onChange={(value) => updateSharedSwitchgearMake(setForm, value)}
                options={normaliseSelectOptions(SWITCHGEAR_MAKE_OPTIONS)}
                placeholder="Select switchgear make"
                error={switchgearMakeError}
                disabled={disabled}
              />
            </FormField>

            {showCustomSwitchgearMake && (
              <FormField
                label="Custom Switchgear Make"
                error={customSwitchgearMakeError}
              >
                <Input
                  value={customSwitchgearMake}
                  onChange={(event) => updateSharedCustomSwitchgearMake(setForm, event.target.value)}
                  placeholder="Enter switchgear make"
                  disabled={disabled}
                  className={customSwitchgearMakeError ? 'border-red-400 focus:ring-red-400' : ''}
                />
              </FormField>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {normalizeInquiryStatusValue(form?.status) === 'Order Lost' && (
              <>
                <FormField label="Order Lost Reason">
                  <SearchableSelect
                    value={form?.statusDetails?.orderLost?.reason || ''}
                    onChange={(value) => updateStatusDetails(setForm, 'orderLost', 'reason', value)}
                    options={normaliseSelectOptions(ORDER_LOST_REASONS)}
                    placeholder="Select reason"
                    disabled={disabled}
                  />
                </FormField>
                <FormField label="Order Lost Remark" className="lg:col-span-2">
                  <Textarea
                    value={form?.statusDetails?.orderLost?.additionalRemark || ''}
                    onChange={(event) => updateStatusDetails(setForm, 'orderLost', 'additionalRemark', event.target.value)}
                    placeholder="Additional remark"
                    disabled={disabled}
                    rows={2}
                  />
                </FormField>
              </>
            )}

            {normalizeInquiryStatusValue(form?.status) === 'Inquiry Hold' && (
              <FormField label="Hold Reason">
                <SearchableSelect
                  value={form?.statusDetails?.inquiryHold?.reason || ''}
                  onChange={(value) => updateStatusDetails(setForm, 'inquiryHold', 'reason', value)}
                  options={normaliseSelectOptions(HOLD_REASONS)}
                  placeholder="Select hold reason"
                  disabled={disabled}
                />
              </FormField>
            )}

            {normalizeInquiryStatusValue(form?.status) === 'BoM Approval Pending' && (
              <FormField label="BoM Approval Pending Remark" className="lg:col-span-3">
                <Textarea
                  value={form?.statusDetails?.bomApproval?.additionalRemark || ''}
                  onChange={(event) => updateStatusDetails(setForm, 'bomApproval', 'additionalRemark', event.target.value)}
                  placeholder="Additional remark"
                  disabled={disabled}
                  rows={2}
                />
              </FormField>
            )}
          </div>
        </SectionCard>
      </div>

      {hasSelectedInquiryType && (
        <>
      {showPlcSection && (
        <PlcPanelInquirySection
          form={form}
          setForm={setForm}
          errors={errors}
          disabled={disabled}
          number={plcSectionIndex + 1}
          sectionIndex={plcSectionIndex}
          activeSection={activeSection}
          setSectionRef={setSectionRef}
        />
      )}

      {showMccSection && (
        <MccPanelInquirySection
          form={form}
          setForm={setForm}
          errors={errors}
          disabled={disabled}
          number={mccSectionIndex + 1}
          sectionIndex={mccSectionIndex}
          activeSection={activeSection}
          setSectionRef={setSectionRef}
        />
      )}

      {showVfdPanelSection && (
        <div ref={(el) => setSectionRef?.(vfdPanelSectionIndex, el)}>
          <SectionCard
            number={String(vfdPanelSectionIndex + 1)}
            title="VFD Panel"
            subtitle="Outgoing feeder load lists for the selected VFD panel feeders."
            icon={Zap}
            color="orange"
            active={activeSection === vfdPanelSectionIndex}
          >
            {vfdPanelContent}
          </SectionCard>
        </div>
      )}

      {showFlpSection && (
        <FlpEnclosureInquirySection
          form={form}
          setForm={setForm}
          errors={errors}
          disabled={disabled}
          number={flpSectionIndex + 1}
          sectionIndex={flpSectionIndex}
          activeSection={activeSection}
          setSectionRef={setSectionRef}
        />
      )}

      {showRioSection && (
        <RioBoxInquirySection
          form={form}
          setForm={setForm}
          errors={errors}
          disabled={disabled}
          number={rioSectionIndex + 1}
          sectionIndex={rioSectionIndex}
          activeSection={activeSection}
          setSectionRef={setSectionRef}
        />
      )}

      {showSharedTechnicalEngineering && (
        <>
      <div ref={(el) => setSectionRef?.(technicalSectionIndex, el)}>
            <SectionCard
              number={String(technicalSectionIndex + 1)}
              title="Technical Details"
              subtitle="Shared panel specifications required across inquiry types."
              icon={Settings}
              color="cyan"
              active={activeSection === technicalSectionIndex}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <FormField
                  label="Application / Process"
                  error={getError(errors, 'applicationProcess')}
                >
                  <Input
                    value={form?.applicationProcess || ''}
                    onChange={(event) => setValue(setForm, 'applicationProcess', event.target.value)}
                    placeholder="Enter application / process"
                    disabled={disabled}
                  />
                </FormField>

                <FormField
                  label="Supply Voltage"
                  error={getError(errors, 'supplyVoltage')}
                >
                  <SearchableSelect
                includeNotApplicable
                    value={form?.supplyVoltage || ''}
                    onChange={(value) => {
                      setForm((prev) => ({
                        ...prev,
                        supplyVoltage: value,
                        controlFeeder: isControlFeederSupplyVoltage(value) ? Boolean(prev?.controlFeeder) : false,
                      }));
                    }}
                    options={normaliseSelectOptions(supplyVoltageOptions)}
                    placeholder="Select supply voltage"
                    error={getError(errors, 'supplyVoltage')}
                    disabled={disabled}
                  />
                </FormField>

                {showControlFeeder && (
                  <FormField
                    label="Control Feeder"
                    error={getError(errors, 'controlFeeder')}
                  >
                    <label
                      className={`flex min-h-[42px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                        form?.controlFeeder
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/40'
                      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(form?.controlFeeder)}
                        onChange={(event) => setValue(setForm, 'controlFeeder', event.target.checked)}
                        disabled={disabled}
                        className="h-4 w-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Required</span>
                    </label>
                  </FormField>
                )}

                {showCustomSupplyVoltage && (
                  <FormField
                    label="Custom Supply Voltage"
                    error={getError(errors, 'customVoltage')}
                  >
                    <Input
                      value={form?.customVoltage || ''}
                      onChange={(event) => setValue(setForm, 'customVoltage', event.target.value)}
                      placeholder="Enter custom supply voltage"
                      disabled={disabled}
                      className={getError(errors, 'customVoltage') ? 'border-red-400 focus:ring-red-400' : ''}
                    />
                  </FormField>
                )}

                <FormField
                  label="Control Voltage"
                  error={getError(errors, 'controlVoltage')}
                >
                  <SearchableSelect
                includeNotApplicable
                    value={form?.controlVoltage || ''}
                    onChange={(value) => setValue(setForm, 'controlVoltage', value)}
                    options={normaliseSelectOptions(CONTROL_VOLTAGE_OPTIONS)}
                    placeholder="Select control voltage"
                    error={getError(errors, 'controlVoltage')}
                    disabled={disabled}
                  />
                </FormField>

                <FormField
                  label="Frequency"
                  error={getError(errors, 'frequency')}
                >
                  <SearchableSelect
                includeNotApplicable
                    value={form?.frequency || ''}
                    onChange={(value) => setValue(setForm, 'frequency', value)}
                    options={normaliseSelectOptions(frequencyOptions)}
                    placeholder="Select frequency"
                    error={getError(errors, 'frequency')}
                    disabled={disabled}
                  />
                </FormField>

                <FormField
                  label="Short Circuit Withstand"
                  error={getError(errors, 'shortCircuitCapacity')}
                >
                  <SearchableSelect
                includeNotApplicable
                    value={form?.shortCircuitCapacity || ''}
                    onChange={(value) => setValue(setForm, 'shortCircuitCapacity', value)}
                    options={normaliseSelectOptions(shortCircuitOptions)}
                    placeholder="Select / type short circuit value"
                    error={getError(errors, 'shortCircuitCapacity')}
                    disabled={disabled}
                  />
                </FormField>

                <FormField
                  label="Cable Gland Material"
                  error={getError(errors, 'cableGlandMaterial')}
                >
                  <Input
                    list="cable-gland-material-options"
                    value={form?.cableGlandMaterial || ''}
                    onChange={(event) => setValue(setForm, 'cableGlandMaterial', event.target.value)}
                    onBlur={(event) => saveCableGlandMaterialOption(event.target.value)}
                    placeholder="Select / type cable gland material"
                    disabled={disabled}
                  />
                  <datalist id="cable-gland-material-options">
                    {cableGlandMaterialOptions.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </FormField>
              </div>

              {technicalContent && (
                <div className="mt-6 space-y-4">
                  {technicalContent}
                </div>
              )}
            </SectionCard>
          </div>

          <div ref={(el) => setSectionRef?.(engineeringSectionIndex, el)}>
            <SectionCard
              number={String(engineeringSectionIndex + 1)}
              title="Engineering Details"
              subtitle="Panel-specific engineering details will be consolidated here in the next phase."
              icon={ShieldCheck}
              color="amber"
              active={activeSection === engineeringSectionIndex}
            >
              {engineeringContent ? (
                <div className="space-y-4">
                  {engineeringContent}
                </div>
              ) : (
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Select an inquiry type to view engineering details.
                </div>
              )}
            </SectionCard>
          </div>

        </>
      )}

      <div ref={(el) => setSectionRef?.(attachmentsSectionIndex, el)}>
        <SectionCard
          number={String(attachmentsSectionIndex + 1)}
          title="Notes & Attachments"
          subtitle="Document checklist and uploaded inquiry files."
          icon={Paperclip}
          color="rose"
          active={activeSection === attachmentsSectionIndex}
        >
          <div className="mb-5 rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-base font-bold text-slate-900">
                Document Checklist
              </h4>
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                Inquiry Documents
              </span>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {!showFlpSection && (
                <>
              <FormField
                label="Certification Required"
                error={getError(errors, 'certificationRequired')}
              >
                <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 shadow-sm">
                  <div className="grid grid-cols-[0.9fr_0.9fr_0.9fr_1.2fr] gap-2">
                    {CERTIFICATION_OPTIONS.map((option) => (
                      <label
                        key={option}
                        className={`flex min-h-[42px] w-full min-w-0 cursor-pointer items-center justify-center gap-2 rounded-lg border px-2 py-2 text-sm font-medium transition ${
                          isCertificationChecked(form, option)
                            ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                            : 'border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/40'
                        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isCertificationChecked(form, option)}
                          onChange={() => toggleCertification(form, setForm, option)}
                          disabled={disabled}
                          className="h-4 w-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </FormField>

                </>
              )}

              <FormField
                label="Drawings / SLD Attached"
                error={getError(errors, 'drawingsSldAttached')}
              >
                <label
                  className={`flex min-h-[46px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                    form?.drawingsSldAttached === 'Yes'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/40'
                  } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={form?.drawingsSldAttached === 'Yes'}
                    onChange={(event) =>
                      setValue(setForm, 'drawingsSldAttached', event.target.checked ? 'Yes' : 'No')
                    }
                    disabled={disabled}
                    className="h-4 w-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Attached</span>
                </label>
              </FormField>

              <FormField
                label="Equipment List Attached"
                error={getError(errors, 'equipmentListAttached')}
              >
                <label
                  className={`flex min-h-[46px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                    form?.equipmentListAttached === 'Yes'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/40'
                  } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={form?.equipmentListAttached === 'Yes'}
                    onChange={(event) =>
                      setValue(setForm, 'equipmentListAttached', event.target.checked ? 'Yes' : 'No')
                    }
                    disabled={disabled}
                    className="h-4 w-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Attached</span>
                </label>
              </FormField>
            </div>
          </div>

          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
              dragActive
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
            } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
          >
            <UploadCloud className="mx-auto mb-3 h-10 w-10 text-gray-400" />
            <h4 className="text-sm font-semibold text-gray-800">
              Drag & drop files here
            </h4>
            <p className="mt-1 text-xs text-gray-500">
              PDF, Word, Excel, images or ZIP files are supported.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              disabled={disabled}
              className="hidden"
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef?.current?.click()}
              disabled={disabled}
              className="mt-4"
            >
              <UploadCloud size={15} />
              Browse Files
            </Button>
          </div>

          {Array.isArray(savedAttachments) && savedAttachments.length > 0 && (
            <div className="mt-5">
              <h4 className="mb-2 text-sm font-semibold text-gray-800">
                Saved Attachments
              </h4>
              <div className="space-y-2">
                {savedAttachments.map((file, index) => (
                  <div
                    key={file?.storedName || file?.storagePath || index}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
                  >
                    <span className="text-xl">
                      {typeof fileEmoji === 'function' ? fileEmoji(file) : '📎'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <a
                        href={getAttachmentUrl(file)}
                        download={getAttachmentDownloadName(file)}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm font-medium text-blue-700 hover:underline"
                      >
                        {file?.name || file?.originalName || file?.storedName || 'Attachment'}
                      </a>
                      <p className="text-xs text-gray-500">
                        {typeof formatBytes === 'function' ? formatBytes(file?.sizeBytes || file?.size || 0) : ''}
                        {file?.uploadedAt ? `${typeof formatBytes === 'function' ? ' · ' : ''}Uploaded: ${formatUploadDateTime(file.uploadedAt)}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSavedAttachment(index)}
                      disabled={disabled}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Remove saved attachment"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(stagedFiles) && stagedFiles.length > 0 && (
            <div className="mt-5">
              <h4 className="mb-2 text-sm font-semibold text-gray-800">
                Files Ready to Upload
              </h4>
              <div className="space-y-2">
                {stagedFiles.map((file, index) => (
                  <div
                    key={`${file?.name || 'file'}-${index}`}
                    className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 shadow-sm"
                  >
                    <span className="text-xl">
                      {typeof fileEmoji === 'function' ? fileEmoji(file) : '📎'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800">
                        {file?.name || 'Attachment'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {typeof formatBytes === 'function' ? formatBytes(file?.size || file?.sizeBytes || 0) : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeStagedFile(index)}
                      disabled={disabled}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Remove staged file"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      <div ref={(el) => setSectionRef?.(technicalBomSectionIndex, el)}>
        <SectionCard
          number={String(technicalBomSectionIndex + 1)}
          title="Technical BOM Documents"
          subtitle="Upload estimator Technical BOM documents and maintain revision history."
          icon={UploadCloud}
          color="green"
          active={activeSection === technicalBomSectionIndex}
        >
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 border-b border-emerald-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Estimator Technical BOM Upload
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  The first upload becomes Technical BOM Submitted with Revision 0. Later uploads create Revision 1, Revision 2 and so on.
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Auto status: Technical BOM Submitted / Revision
              </span>
            </div>

            {form?.statusDetails?.bomSubmission?.versionLabel && (
              <div className="mb-4 rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm text-emerald-800">
                Latest Technical BOM status: <span className="font-semibold">{getBomVersionLabel(form.statusDetails.bomSubmission)}</span>
                {form.statusDetails.bomSubmission.remarks ? ` — ${form.statusDetails.bomSubmission.remarks}` : ''}
              </div>
            )}

            <FormField label="Technical BOM Remarks" error={getError(errors, 'bomSubmissionRemarks')}>
              <Textarea
                value={form?.bomSubmissionRemarks || ''}
                onChange={(event) => setValue(setForm, 'bomSubmissionRemarks', event.target.value)}
                placeholder="Enter Technical BOM remarks"
                disabled={disabled}
                rows={2}
              />
            </FormField>

            <input
              ref={bomFileInputRef}
              type="file"
              multiple
              onChange={handleBomFileSelect}
              disabled={disabled}
              className="hidden"
            />

            <div
              onDragEnter={handleBomDrag}
              onDragOver={handleBomDrag}
              onDragLeave={handleBomDrag}
              onDrop={handleBomDrop}
              className={`mt-4 rounded-2xl border-2 border-dashed p-6 text-center transition ${
                bomDragActive
                  ? 'border-emerald-400 bg-emerald-100/70'
                  : 'border-emerald-300 bg-white hover:bg-emerald-50'
              } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
            >
              <UploadCloud className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
              <h4 className="text-sm font-semibold text-gray-800">
                Drag & drop Technical BOM files here
              </h4>
              <p className="mt-1 text-xs text-gray-500">
                PDF, Word, Excel, images or ZIP files are supported.
              </p>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => bomFileInputRef?.current?.click()}
                disabled={disabled}
                className="mt-4"
              >
                <UploadCloud size={15} />
                Browse Technical BOM Files
              </Button>
            </div>

            {Array.isArray(savedBomAttachments) && savedBomAttachments.length > 0 && (
              <div className="mt-5">
                <h4 className="mb-2 text-sm font-semibold text-gray-800">
                  Saved Technical BOM Attachments
                </h4>
                <div className="space-y-2">
                  {savedBomAttachments.map((file, index) => (
                    <div
                      key={file?.storedName || file?.storagePath || index}
                      className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-white px-4 py-3 shadow-sm"
                    >
                      <span className="text-xl">
                        {typeof fileEmoji === 'function' ? fileEmoji(file) : '📎'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <a
                          href={getAttachmentUrl(file)}
                          download={getAttachmentDownloadName(file)}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-sm font-medium text-blue-700 hover:underline"
                        >
                          {file?.name || file?.originalName || file?.storedName || 'Technical BOM Attachment'}
                        </a>
                        <p className="text-xs text-gray-500">
                          {getBomVersionLabel(file)}
                          {file?.uploadedAt ? ` · Uploaded: ${formatUploadDateTime(file.uploadedAt)}` : ''}
                          {getUploadedByName(file) ? ` · By: ${getUploadedByName(file)}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSavedBomAttachment(index)}
                        disabled={disabled}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Remove saved Technical BOM attachment"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(bomStagedFiles) && bomStagedFiles.length > 0 && (
              <div className="mt-5">
                <h4 className="mb-2 text-sm font-semibold text-gray-800">
                  Technical BOM Files Ready to Upload
                </h4>
                <div className="space-y-2">
                  {bomStagedFiles.map((file, index) => (
                    <div
                      key={`${file?.name || 'bom-file'}-${index}`}
                      className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 shadow-sm"
                    >
                      <span className="text-xl">
                        {typeof fileEmoji === 'function' ? fileEmoji(file) : '📎'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800">
                          {file?.name || 'Technical BOM Attachment'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {typeof formatBytes === 'function' ? formatBytes(file?.size || file?.sizeBytes || 0) : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeBomStagedFile(index)}
                        disabled={disabled}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Remove staged Technical BOM file"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      </div>
        </>
      )}
    </div>
  );
};

export default CommonInquirySections;
