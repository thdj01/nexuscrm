import React from 'react';
import {
  Cable,
  Gauge,
  ListChecks,
  PanelsTopLeft,
} from 'lucide-react';

import {
  SectionCard,
  FormField,
  Input,
  SearchableSelect,
  MultiCheckSelect,
} from '../../common/FormComponents.extended';

import InquiryLoadTable from '../tables/InquiryLoadTable';
import MainIncomerSection from './MainIncomerSection';

import {
  VOLTAGE_OPTIONS,
  SHORT_CIRCUIT_OPTIONS,
} from '../../../data/masterData';

import {
  MCC_INCOMER_TYPE_OPTIONS,
  MCC_FEEDER_TYPE_OPTIONS,
  defaultMccDetails,
} from '../../../data/inquiryMasterData';

import {
  emptyMainIncomerDetails,
  getMainIncomerValueSignature,
  getPanelMainIncomerDetails,
  getSameAsAboveSourcePanelType,
  setPanelMainIncomerDetails,
} from '../../../utils/mainIncomerUtils';

const FREQUENCY_OPTIONS = ['50 Hz', '60 Hz'];
const MAKE_OPTIONS = ['Siemens', 'Schneider', 'L&K', 'ABB', 'Other'];
const BUSBAR_MATERIAL_OPTIONS = ['Aluminium', 'Copper'];
const PANEL_TYPE_OPTIONS = ['Draw-out', 'Fixed'];
const COMMISSIONING_SCOPE_OPTIONS = ['In Our Scope', 'Customer Scope'];

const REMOVED_SUPPLY_VOLTAGE_OPTIONS = new Set([
  '48V DC',
  '110V DC',
  '220V DC',
  '440V AC, 3 Phase + Neutral',
  '440 V AC, 3 Phase + Neutral',
  '415V AC, 3 Phase',
]);

const SUPPLY_VOLTAGE_OPTIONS = Array.from(new Set([
  '440V AC, 3 Phase',
  '415 V AC 3 Phase',
  '415 V AC 3 Phase + Neutral',
  'Custom',
  ...(Array.isArray(VOLTAGE_OPTIONS) ? VOLTAGE_OPTIONS : []),
])).filter((option) => !REMOVED_SUPPLY_VOLTAGE_OPTIONS.has(option));

const DEFAULT_KA_RATING_OPTIONS = Array.from(new Set(
  (Array.isArray(SHORT_CIRCUIT_OPTIONS) ? SHORT_CIRCUIT_OPTIONS : [])
    .map((option) => String(option || '').replace(/\s*\/\s*1\s*sec/gi, '').trim())
    .filter(Boolean)
));

const MCC_MAKE_STORAGE_KEY = 'nexusInquiryMccMainIncomerMakeOptions';
const MCC_KA_RATING_STORAGE_KEY = 'nexusInquiryMccKaRatingOptions';

const normaliseOptions = (options = []) => options.map((option) => (
  typeof option === 'string' ? { value: option, label: option } : option
));

const getError = (errors = {}, key = '') => errors?.[key] || '';

const isOtherValue = (value) => String(value || '').trim().toUpperCase() === 'OTHER';

const readStoredOptions = (key) => {
  if (typeof window === 'undefined') return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(parsed)
      ? parsed.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
  } catch (_) {
    return [];
  }
};

const saveStoredOption = (key, value, excludedOptions = []) => {
  const cleanValue = String(value || '').trim();
  if (!cleanValue || excludedOptions.includes(cleanValue) || typeof window === 'undefined') return;

  const nextOptions = Array.from(new Set([
    ...readStoredOptions(key),
    cleanValue,
  ]));

  window.localStorage.setItem(key, JSON.stringify(nextOptions));
};

const normaliseFeederType = (value) => {
  const cleanValue = String(value || '').trim();
  const legacyMap = {
    DOL: 'DOL Starter',
    'Star-Delta': 'Star-Delta Starter',
    VFD: 'VFD Feeder',
    Servo: 'Servo Feeder',
  };

  return legacyMap[cleanValue] || cleanValue;
};

const getMccDetails = (form = {}) => {
  const defaults = defaultMccDetails();
  const source = form?.mccDetails || {};
  const sourceIncomer = source.incomerDetails || {};
  const sourceOutgoing = source.outgoingFeederDetails || {};
  const sourceSupport = source.notesAndSupport || {};

  const feederTypes = Array.from(new Set(
    (Array.isArray(sourceOutgoing.feederTypes)
      ? sourceOutgoing.feederTypes
      : defaults.outgoingFeederDetails.feederTypes
    ).map(normaliseFeederType).filter(Boolean)
  ));

  const legacyCommissioningScope = sourceSupport.commissioningSupportRequired === 'Required'
    ? 'In Our Scope'
    : sourceSupport.commissioningSupportRequired === 'Not Required'
      ? 'Customer Scope'
      : '';

  return {
    ...defaults,
    ...source,
    incomerDetails: {
      ...defaults.incomerDetails,
      ...sourceIncomer,
      mainIncomerType: sourceIncomer.mainIncomerType || sourceIncomer.incomerType || '',
      supplyVoltage:
        sourceIncomer.supplyVoltage || sourceIncomer.incomingVoltage || form.supplyVoltage || '',
      customSupplyVoltage:
        sourceIncomer.customSupplyVoltage || sourceIncomer.customIncomingVoltage || '',
      pole: sourceIncomer.pole || '',
      frequency: sourceIncomer.frequency || form.frequency || defaults.incomerDetails.frequency,
      make: sourceIncomer.make || '',
      customMake: sourceIncomer.customMake || '',
      kaRating: sourceIncomer.kaRating || form.shortCircuitCapacity || '',
      controlFeeder: sourceIncomer.controlFeeder || '',
      sameAsAbove: Boolean(sourceIncomer.sameAsAbove),
    },
    outgoingFeederDetails: {
      ...defaults.outgoingFeederDetails,
      ...sourceOutgoing,
      feederTypes,
    },
    loadDetails:
      Array.isArray(source.loadDetails) && source.loadDetails.length > 0
        ? source.loadDetails
        : defaults.loadDetails,
    layoutPreferences: {
      ...defaults.layoutPreferences,
      ...(source.layoutPreferences || {}),
    },
    notesAndSupport: {
      ...defaults.notesAndSupport,
      commissioningScope:
        sourceSupport.commissioningScope || legacyCommissioningScope,
      ...sourceSupport,
    },
  };
};

const updateMccDetails = (setForm, updater) => {
  setForm((previousForm) => {
    const currentDetails = getMccDetails(previousForm);
    const nextDetails = typeof updater === 'function'
      ? updater(currentDetails)
      : { ...currentDetails, ...(updater || {}) };

    return {
      ...previousForm,
      mccDetails: nextDetails,
    };
  });
};

const updateNestedGroup = (setForm, group, field, value, additionalChanges = {}) => {
  updateMccDetails(setForm, (currentDetails) => ({
    ...currentDetails,
    [group]: {
      ...(currentDetails[group] || {}),
      [field]: value,
      ...additionalChanges,
    },
  }));
};

const Subsection = ({ icon: Icon, title, subtitle, color = 'orange', children }) => {
  const toneMap = {
    orange: 'border-orange-200 bg-orange-50/40 text-orange-700',
    violet: 'border-violet-200 bg-violet-50/40 text-violet-700',
    cyan: 'border-cyan-200 bg-cyan-50/40 text-cyan-700',
  };

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${toneMap[color] || toneMap.orange}`}>
      <div className="mb-4 flex items-start gap-3">
        {Icon && (
          <div className="mt-0.5 rounded-xl bg-white/90 p-2 shadow-sm">
            <Icon size={18} />
          </div>
        )}
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <div className="rounded-xl bg-white/90 p-4 text-slate-700 shadow-sm">
        {children}
      </div>
    </div>
  );
};

const MccPanelInquirySection = ({
  form,
  setForm,
  errors = {},
  disabled = false,
  number,
  sectionIndex,
  activeSection,
  setSectionRef,
}) => {
  const details = getMccDetails(form);
  const incomer = details.incomerDetails || {};
  const outgoing = details.outgoingFeederDetails || {};
  const support = details.notesAndSupport || {};
  const sourcePanelType = getSameAsAboveSourcePanelType(form?.panelTypes, 'MCC');
  const sourceMainIncomer = getPanelMainIncomerDetails(form, sourcePanelType);
  const sourceMainIncomerSignature = getMainIncomerValueSignature(sourceMainIncomer);
  const showSameAsAbove = Boolean(sourcePanelType);

  const makeOptions = Array.from(new Set([
    ...MAKE_OPTIONS,
    ...readStoredOptions(MCC_MAKE_STORAGE_KEY),
    ...(!isOtherValue(incomer.make) && incomer.make ? [incomer.make] : []),
  ]));

  const kaRatingOptions = Array.from(new Set([
    ...DEFAULT_KA_RATING_OPTIONS,
    ...readStoredOptions(MCC_KA_RATING_STORAGE_KEY),
    ...(incomer.kaRating ? [incomer.kaRating] : []),
  ]));

  const incomerTypeOptions = Array.from(new Set([
    ...MCC_INCOMER_TYPE_OPTIONS,
    ...(incomer.incomerType ? [incomer.incomerType] : []),
  ]));

  const feederTypeOptions = Array.from(new Set([
    ...MCC_FEEDER_TYPE_OPTIONS,
    ...(Array.isArray(outgoing.feederTypes) ? outgoing.feederTypes : []),
  ]));

  const showDolSelection = (outgoing.feederTypes || []).includes('DOL Starter');

  React.useEffect(() => {
    if (showSameAsAbove || !incomer.sameAsAbove) return;
    setForm((prev) => setPanelMainIncomerDetails(prev, 'MCC', emptyMainIncomerDetails()));
  }, [incomer.sameAsAbove, setForm, showSameAsAbove]);

  React.useEffect(() => {
    if (!incomer.sameAsAbove || !sourcePanelType) return;

    setForm((prev) => {
      const latestSourcePanelType = getSameAsAboveSourcePanelType(prev?.panelTypes, 'MCC');
      if (!latestSourcePanelType) {
        return setPanelMainIncomerDetails(prev, 'MCC', emptyMainIncomerDetails());
      }

      return setPanelMainIncomerDetails(prev, 'MCC', {
        ...getPanelMainIncomerDetails(prev, latestSourcePanelType),
        sameAsAbove: true,
      });
    });
  }, [incomer.sameAsAbove, sourceMainIncomerSignature, sourcePanelType, setForm]);

  const updateMainIncomerField = (field, value, additionalChanges = {}) => {
    setForm((prev) => setPanelMainIncomerDetails(prev, 'MCC', {
      ...getPanelMainIncomerDetails(prev, 'MCC'),
      [field]: value,
      ...additionalChanges,
    }));
  };

  const handleSameAsAboveChange = (checked) => {
    setForm((prev) => {
      const latestSourcePanelType = getSameAsAboveSourcePanelType(prev?.panelTypes, 'MCC');

      if (!checked || !latestSourcePanelType) {
        return setPanelMainIncomerDetails(prev, 'MCC', emptyMainIncomerDetails());
      }

      return setPanelMainIncomerDetails(prev, 'MCC', {
        ...getPanelMainIncomerDetails(prev, latestSourcePanelType),
        sameAsAbove: true,
      });
    });
  };

  return (
    <div ref={(element) => setSectionRef?.(sectionIndex, element)}>
      <SectionCard
        number={String(number)}
        title="MCC Panel Inquiry Details"
        subtitle="Main incomer, outgoing feeder and DOL load selection details."
        icon={PanelsTopLeft}
        color="orange"
        active={activeSection === sectionIndex}
      >
        <div className="space-y-5">
          <MainIncomerSection
            details={incomer}
            onFieldChange={updateMainIncomerField}
            errors={errors}
            errorPrefix="mccDetails.incomerDetails"
            disabled={disabled}
            fieldsDisabled={disabled || Boolean(incomer.sameAsAbove)}
            showSameAsAbove={showSameAsAbove}
            sameAsAbove={incomer.sameAsAbove}
            onSameAsAboveChange={handleSameAsAboveChange}
          />

          <Subsection
            icon={Cable}
            title="MCC Panel Details"
            subtitle="Define MCC-specific busbar material and panel construction."
            color="orange"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <FormField
                label="Busbar Material"
                required
                error={getError(errors, 'mccDetails.incomerDetails.busbarMaterial')}
              >
                <SearchableSelect
                  value={incomer.busbarMaterial || ''}
                  onChange={(value) => updateNestedGroup(setForm, 'incomerDetails', 'busbarMaterial', value)}
                  options={normaliseOptions(BUSBAR_MATERIAL_OPTIONS)}
                  placeholder="Select busbar material"
                  disabled={disabled}
                  error={getError(errors, 'mccDetails.incomerDetails.busbarMaterial')}
                />
              </FormField>

              <FormField
                label="Panel Type"
                required
                error={getError(errors, 'mccDetails.incomerDetails.panelConstruction')}
              >
                <SearchableSelect
                  value={incomer.panelConstruction || ''}
                  onChange={(value) => updateNestedGroup(
                    setForm,
                    'incomerDetails',
                    'panelConstruction',
                    value
                  )}
                  options={normaliseOptions(PANEL_TYPE_OPTIONS)}
                  placeholder="Select panel type"
                  disabled={disabled}
                  error={getError(errors, 'mccDetails.incomerDetails.panelConstruction')}
                />
              </FormField>
            </div>
          </Subsection>

          <Subsection
            icon={Gauge}
            title="Outgoing Feeder Types"
            subtitle="Select all outgoing feeder types required in the MCC panel."
            color="violet"
          >
            <FormField
              label="Outgoing Feeder Type"
              required
              error={getError(errors, 'mccDetails.outgoingFeederDetails.feederTypes')}
            >
              <MultiCheckSelect
                value={outgoing.feederTypes || []}
                onChange={(value) => updateNestedGroup(
                  setForm,
                  'outgoingFeederDetails',
                  'feederTypes',
                  value
                )}
                options={normaliseOptions(feederTypeOptions)}
                placeholder="Select outgoing feeder types"
                disabled={disabled}
                error={getError(errors, 'mccDetails.outgoingFeederDetails.feederTypes')}
              />
            </FormField>
          </Subsection>

          {showDolSelection && (
            <Subsection
              icon={ListChecks}
              title="DOL Selection"
              subtitle="Enter DOL load details and define the commissioning scope."
              color="cyan"
            >
              <div className="space-y-5">
                <InquiryLoadTable
                  rows={details.loadDetails}
                  onChange={(updatedRows) => updateMccDetails(setForm, (currentDetails) => ({
                    ...currentDetails,
                    loadDetails: updatedRows,
                  }))}
                  showRemarks={false}
                  errors={errors}
                  minRows={0}
                  disabled={disabled}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <FormField
                    label="Commissioning Scope"
                    required
                    error={getError(errors, 'mccDetails.notesAndSupport.commissioningScope')}
                  >
                    <SearchableSelect
                      value={support.commissioningScope || ''}
                      onChange={(value) => updateNestedGroup(
                        setForm,
                        'notesAndSupport',
                        'commissioningScope',
                        value,
                        {
                          commissioningSupportRequired:
                            value === 'In Our Scope' ? 'Required' : 'Not Required',
                          commissioningSupportDays: '',
                        }
                      )}
                      options={normaliseOptions(COMMISSIONING_SCOPE_OPTIONS)}
                      placeholder="Select commissioning scope"
                      disabled={disabled}
                      error={getError(errors, 'mccDetails.notesAndSupport.commissioningScope')}
                    />
                  </FormField>
                </div>
              </div>
            </Subsection>
          )}
        </div>
      </SectionCard>
    </div>
  );
};

export default MccPanelInquirySection;
