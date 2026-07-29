import React from 'react';
import {
  Cog,
  Cpu,
  Headphones,
  ListChecks,
  Network,
  PackageSearch,
  PlugZap,
  Repeat2,
} from 'lucide-react';

import {
  SectionCard,
  FormField,
  Input,
  SearchableSelect,
} from '../../common/FormComponents.extended';

import ComponentRequirementTable from '../tables/ComponentRequirementTable';
import MainIncomerSection from './MainIncomerSection';

import {
  VOLTAGE_OPTIONS,
  SHORT_CIRCUIT_OPTIONS,
} from '../../../data/masterData';

import {
  PLC_COMPONENT_ROWS,
  PROGRAMMING_DEVELOPMENT_SCOPE_OPTIONS,
  defaultPlcDetails,
} from '../../../data/inquiryMasterData';

import {
  emptyMainIncomerDetails,
  getMainIncomerValueSignature,
  getPanelMainIncomerDetails,
  getSameAsAboveSourcePanelType,
  setPanelMainIncomerDetails,
} from '../../../utils/mainIncomerUtils';

const MAIN_INCOMER_TYPE_OPTIONS = ['MCB', 'MCCB', 'ACB'];
const POLE_OPTIONS = ['1-Pole', '2-Pole', '3-Pole', '4-Pole'];
const FREQUENCY_OPTIONS = ['50 Hz', '60 Hz'];
const MAKE_OPTIONS = ['Siemens', 'Schneider', 'L&K', 'ABB', 'Other'];
const COMMUNICATION_PROTOCOL_OPTIONS = ['Profibus', 'Profinet', 'EtherNet/IP'];
const NETWORK_TOPOLOGY_OPTIONS = ['Star', 'Ring', 'Line'];
const PLC_REDUNDANCY_OPTIONS = ['Hot', 'Cold'];
const SERVO_MAKE_OPTIONS = [
  'Yaskawa',
  'ABB',
  'Siemens',
  'Mitsubishi',
  'Allen-Bradley (AB)',
  'Other',
];
const SERVO_INPUT_VOLTAGE_OPTIONS = [
  '1-Phase — 220 V',
  '3-Phase — 220 V',
  '3-Phase — 440 V',
];
const SERVO_ENCODER_TYPE_OPTIONS = ['Absolute', 'Incremental'];
const SERVO_RATED_RPM_OPTIONS = ['1500 RPM', '2000 RPM', '3000 RPM'];
const SERVO_AMPLIFIER_COMMUNICATION_OPTIONS = ['PTO', 'Ethernet', 'EtherNet/IP'];

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

const PLC_MAIN_INCOMER_MAKE_STORAGE_KEY = 'nexusInquiryPlcMainIncomerMakeOptions';
const PLC_SYSTEM_MAKE_STORAGE_KEY = 'nexusInquiryPlcSystemMakeOptions';
const PLC_KA_RATING_STORAGE_KEY = 'nexusInquiryPlcKaRatingOptions';

const REMOVED_ENGINEERING_COMPONENTS = new Set([
  'PLC',
  'HMI / Touch Panel',
  'VFD (if any)',
  'Servo Drive & Motor',
  'Remote I/O Modules',
]);

const OTHER_MATERIAL_COMPONENT_ROWS = PLC_COMPONENT_ROWS.filter(
  (component) => !REMOVED_ENGINEERING_COMPONENTS.has(component)
);

const PLC_PREFERRED_BRAND_OPTIONS = [
  'Siemens',
  'Schneider',
  'ROCKWELL',
  'ABB',
  'Other',
];

const IO_ROW_DEFINITIONS = [
  { key: 'di', label: 'DI', legacyQuantityKey: 'digitalInputs', hart: false },
  { key: 'do', label: 'DO', legacyQuantityKey: 'digitalOutputs', hart: false },
  { key: 'ai', label: 'AI', legacyQuantityKey: 'analogInputs', hart: true },
  { key: 'ao', label: 'AO', legacyQuantityKey: 'analogOutputs', hart: true },
];

const normaliseOptions = (options = []) => options.map((option) => (
  typeof option === 'string' ? { value: option, label: option } : option
));

const getError = (errors = {}, key = '') => errors?.[key] || '';

const isOtherValue = (value) => String(value || '').trim().toUpperCase() === 'OTHER';

const readStoredOptions = (key) => {
  if (typeof window === 'undefined') return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.map((value) => String(value || '').trim()).filter(Boolean) : [];
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

const createIoRow = (quantity = '') => ({
  quantity,
  relay: false,
  isBarrier: false,
  conformalCoated: false,
  isInput: false,
  hart: false,
});

const normalizeCheckboxValue = (value) => {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['true', 'yes', 'required', '1'].includes(normalized);
};

const getPlcDetails = (form = {}) => {
  const defaults = defaultPlcDetails();
  const source = form?.plcDetails || {};
  const legacyIo = source.ioDetails || {};
  const sourceIoRequirements = source.ioRequirements || {};

  return {
    ...defaults,
    ...source,
    mainIncomerFeeder: {
      ...defaults.mainIncomerFeeder,
      ...(source.mainIncomerFeeder || {}),
      sameAsAbove: Boolean(source.mainIncomerFeeder?.sameAsAbove),
    },
    plcSystem: {
      ...defaults.plcSystem,
      ...(source.plcSystem || {}),
      hmiRequired: normalizeCheckboxValue(source.plcSystem?.hmiRequired),
      ethernetSwitchRequired: normalizeCheckboxValue(source.plcSystem?.ethernetSwitchRequired),
    },
    servoDetails: {
      ...defaults.servoDetails,
      ...(source.servoDetails || {}),
    },
    ioDetails: {
      ...defaults.ioDetails,
      ...legacyIo,
    },
    ioRequirements: IO_ROW_DEFINITIONS.reduce((rows, definition) => ({
      ...rows,
      [definition.key]: {
        ...(defaults.ioRequirements?.[definition.key] || {}),
        quantity:
          sourceIoRequirements?.[definition.key]?.quantity ??
          legacyIo?.[definition.legacyQuantityKey] ??
          '',
        ...(sourceIoRequirements?.[definition.key] || {}),
      },
    }), {}),
    redundancy: {
      ...defaults.redundancy,
      ...(source.redundancy || {}),
    },
    supportRequirements: {
      ...defaults.supportRequirements,
      ...(source.supportRequirements || {}),
    },
    automationRequirements:
      Array.isArray(source.automationRequirements) && source.automationRequirements.length > 0
        ? source.automationRequirements
        : defaults.automationRequirements,
  };
};

const updatePlcDetails = (setForm, updater) => {
  setForm((previousForm) => {
    const currentDetails = getPlcDetails(previousForm);
    const nextDetails = typeof updater === 'function'
      ? updater(currentDetails)
      : { ...currentDetails, ...(updater || {}) };

    return {
      ...previousForm,
      plcDetails: nextDetails,
    };
  });
};

const updateNestedGroup = (setForm, group, field, value, additionalChanges = {}) => {
  updatePlcDetails(setForm, (currentDetails) => ({
    ...currentDetails,
    [group]: {
      ...(currentDetails[group] || {}),
      [field]: value,
      ...additionalChanges,
    },
  }));
};

const updateIoRequirement = (setForm, definition, field, value) => {
  updatePlcDetails(setForm, (currentDetails) => {
    const currentIoRequirements = currentDetails.ioRequirements || {};
    const currentRow = currentIoRequirements[definition.key] || createIoRow();
    const nextRow = {
      ...currentRow,
      [field]: value,
    };

    return {
      ...currentDetails,
      ioRequirements: {
        ...currentIoRequirements,
        [definition.key]: nextRow,
      },
      ioDetails: field === 'quantity'
        ? {
            ...(currentDetails.ioDetails || {}),
            [definition.legacyQuantityKey]: value,
          }
        : currentDetails.ioDetails,
    };
  });
};

const updateRedundancy = (setForm, field, value) => {
  updatePlcDetails(setForm, (currentDetails) => ({
    ...currentDetails,
    redundancy: {
      ...(currentDetails.redundancy || {}),
      [field]: value,
    },
    ioDetails: field === 'plcRedundancy'
      ? {
          ...(currentDetails.ioDetails || {}),
          plcCpuRedundancyRequired: value ? 'Yes' : 'No',
        }
      : currentDetails.ioDetails,
  }));
};

const mergeVisibleMaterialRows = (currentRows = [], updatedVisibleRows = []) => {
  const updatedByComponent = new Map(
    updatedVisibleRows.map((row) => [row.component, row])
  );

  const mergedRows = currentRows.map((row) => (
    updatedByComponent.has(row.component)
      ? updatedByComponent.get(row.component)
      : row
  ));

  updatedVisibleRows.forEach((row) => {
    if (!mergedRows.some((existing) => existing.component === row.component)) {
      mergedRows.push(row);
    }
  });

  return mergedRows;
};

const Subsection = ({ icon: Icon, title, subtitle, color = 'indigo', children }) => {
  const toneMap = {
    indigo: 'border-indigo-200 bg-indigo-50/40 text-indigo-700',
    cyan: 'border-cyan-200 bg-cyan-50/40 text-cyan-700',
    amber: 'border-amber-200 bg-amber-50/40 text-amber-700',
    green: 'border-green-200 bg-green-50/40 text-green-700',
    rose: 'border-rose-200 bg-rose-50/40 text-rose-700',
    violet: 'border-violet-200 bg-violet-50/40 text-violet-700',
    orange: 'border-orange-200 bg-orange-50/40 text-orange-700',
  };

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${toneMap[color] || toneMap.indigo}`}>
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

const CheckboxControl = ({ checked, onChange, label = 'Required', disabled = false }) => {
  const checkboxId = React.useId();
  const isChecked = normalizeCheckboxValue(checked);

  return (
    <div
      className={`flex min-h-[42px] items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
        isChecked
          ? 'border-blue-300 bg-blue-50 text-blue-700'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <input
        id={checkboxId}
        type="checkbox"
        checked={isChecked}
        onChange={(event) => onChange(Boolean(event.currentTarget.checked))}
        disabled={disabled}
        className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
      />
      <label
        htmlFor={checkboxId}
        className={disabled ? 'cursor-not-allowed select-none' : 'cursor-pointer select-none'}
      >
        {label}
      </label>
    </div>
  );
};

const PlcPanelInquirySection = ({
  form,
  setForm,
  errors = {},
  disabled = false,
  number,
  sectionIndex,
  activeSection,
  setSectionRef,
}) => {
  const details = getPlcDetails(form);
  const mainIncomer = details.mainIncomerFeeder || {};
  const plcSystem = details.plcSystem || {};
  const servoDetails = details.servoDetails || {};
  const ioRequirements = details.ioRequirements || {};
  const legacyIoDetails = details.ioDetails || {};
  const redundancy = details.redundancy || {};
  const supportRequirements = details.supportRequirements || {};
  const sourcePanelType = getSameAsAboveSourcePanelType(form?.panelTypes, 'PLC');
  const sourceMainIncomer = getPanelMainIncomerDetails(form, sourcePanelType);
  const sourceMainIncomerSignature = getMainIncomerValueSignature(sourceMainIncomer);
  const showSameAsAbove = Boolean(sourcePanelType);

  const mainIncomerMakeOptions = Array.from(new Set([
    ...MAKE_OPTIONS,
    ...readStoredOptions(PLC_MAIN_INCOMER_MAKE_STORAGE_KEY),
    ...(!isOtherValue(mainIncomer.make) && mainIncomer.make ? [mainIncomer.make] : []),
    ...(mainIncomer.customMake ? [mainIncomer.customMake] : []),
  ].filter(Boolean)));

  const plcSystemMakeOptions = Array.from(new Set([
    ...MAKE_OPTIONS,
    ...readStoredOptions(PLC_SYSTEM_MAKE_STORAGE_KEY),
    ...(!isOtherValue(plcSystem.make) && plcSystem.make ? [plcSystem.make] : []),
    ...(plcSystem.customMake ? [plcSystem.customMake] : []),
  ].filter(Boolean)));

  const kaRatingOptions = Array.from(new Set([
    ...DEFAULT_KA_RATING_OPTIONS,
    ...readStoredOptions(PLC_KA_RATING_STORAGE_KEY),
    ...(mainIncomer.kaRating ? [mainIncomer.kaRating] : []),
  ].filter(Boolean)));

  const communicationProtocolOptions = Array.from(new Set([
    ...COMMUNICATION_PROTOCOL_OPTIONS,
    ...(plcSystem.communicationProtocol ? [plcSystem.communicationProtocol] : []),
  ]));

  const networkTopologyOptions = Array.from(new Set([
    ...NETWORK_TOPOLOGY_OPTIONS,
    ...(plcSystem.networkTopology ? [plcSystem.networkTopology] : []),
  ]));

  const currentAutomationRows = Array.isArray(details.automationRequirements)
    ? details.automationRequirements
    : [];

  const visibleMaterialRows = OTHER_MATERIAL_COMPONENT_ROWS.map((component) => (
    currentAutomationRows.find((row) => row.component === component) || {
      component,
      required: 'No',
      preferredBrand: '',
      suggestedModelRange: '',
      remarks: '',
    }
  ));

  const showOnsiteSupportDays = supportRequirements.onsiteSupportRequired === 'Required';
  const showCommissioningSupportDays = supportRequirements.commissioningSupportRequired === 'Required';

  const updateSystemField = (field, value, additionalChanges = {}) => {
    updatePlcDetails(setForm, (currentDetails) => {
      const legacyComponent = field === 'hmiRequired'
        ? 'HMI / Touch Panel'
        : field === 'ethernetSwitchRequired'
          ? 'Industrial Network Switch'
          : '';

      let automationRequirements = currentDetails.automationRequirements;

      if (legacyComponent) {
        const currentRows = Array.isArray(currentDetails.automationRequirements)
          ? currentDetails.automationRequirements
          : [];
        const requiredValue = normalizeCheckboxValue(value) ? 'Yes' : 'No';
        let rowFound = false;

        automationRequirements = currentRows.map((row) => {
          if (row.component !== legacyComponent) return row;
          rowFound = true;
          return {
            ...row,
            required: requiredValue,
          };
        });

        if (!rowFound) {
          automationRequirements = [
            ...automationRequirements,
            {
              component: legacyComponent,
              required: requiredValue,
              preferredBrand: '',
              suggestedModelRange: '',
              remarks: '',
            },
          ];
        }
      }

      return {
        ...currentDetails,
        plcSystem: {
          ...(currentDetails.plcSystem || {}),
          [field]: value,
          ...additionalChanges,
        },
        automationRequirements,
        ioDetails: field === 'communicationProtocol'
          ? { ...(currentDetails.ioDetails || {}), communicationProtocol: value }
          : field === 'networkTopology'
            ? { ...(currentDetails.ioDetails || {}), networkTopology: value }
            : currentDetails.ioDetails,
      };
    });
  };

  React.useEffect(() => {
    if (showSameAsAbove || !mainIncomer.sameAsAbove) return;
    setForm((prev) => setPanelMainIncomerDetails(prev, 'PLC', emptyMainIncomerDetails()));
  }, [mainIncomer.sameAsAbove, setForm, showSameAsAbove]);

  React.useEffect(() => {
    if (!mainIncomer.sameAsAbove || !sourcePanelType) return;

    setForm((prev) => {
      const latestSourcePanelType = getSameAsAboveSourcePanelType(prev?.panelTypes, 'PLC');
      if (!latestSourcePanelType) {
        return setPanelMainIncomerDetails(prev, 'PLC', emptyMainIncomerDetails());
      }

      return setPanelMainIncomerDetails(prev, 'PLC', {
        ...getPanelMainIncomerDetails(prev, latestSourcePanelType),
        sameAsAbove: true,
      });
    });
  }, [mainIncomer.sameAsAbove, sourceMainIncomerSignature, sourcePanelType, setForm]);

  const updateMainIncomerField = (field, value, additionalChanges = {}) => {
    setForm((prev) => setPanelMainIncomerDetails(prev, 'PLC', {
      ...getPanelMainIncomerDetails(prev, 'PLC'),
      [field]: value,
      ...additionalChanges,
    }));
  };

  const handleSameAsAboveChange = (checked) => {
    setForm((prev) => {
      const latestSourcePanelType = getSameAsAboveSourcePanelType(prev?.panelTypes, 'PLC');

      if (!checked || !latestSourcePanelType) {
        return setPanelMainIncomerDetails(prev, 'PLC', emptyMainIncomerDetails());
      }

      return setPanelMainIncomerDetails(prev, 'PLC', {
        ...getPanelMainIncomerDetails(prev, latestSourcePanelType),
        sameAsAbove: true,
      });
    });
  };

  return (
    <div ref={(element) => setSectionRef?.(sectionIndex, element)}>
      <SectionCard
        number={String(number)}
        title="PLC Panel Inquiry"
        subtitle="Standalone PLC panel form for incomer, PLC system, I/O, redundancy, servo and material requirements."
        icon={Cpu}
        color="indigo"
        active={activeSection === sectionIndex}
      >
        <div className="space-y-5">
          <MainIncomerSection
            details={mainIncomer}
            onFieldChange={updateMainIncomerField}
            errors={errors}
            errorPrefix="plcDetails.mainIncomerFeeder"
            disabled={disabled}
            fieldsDisabled={disabled || Boolean(mainIncomer.sameAsAbove)}
            showSameAsAbove={showSameAsAbove}
            sameAsAbove={mainIncomer.sameAsAbove}
            onSameAsAboveChange={handleSameAsAboveChange}
          />

          <Subsection
            icon={Network}
            title="PLC System"
            subtitle="Controller, communication, HMI and Ethernet switch details."
            color="cyan"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <FormField
                label="PLC Controller"
                required
                error={getError(errors, 'plcDetails.plcSystem.plcController')}
              >
                <Input
                  value={plcSystem.plcController || ''}
                  onChange={(event) => updateSystemField('plcController', event.target.value)}
                  placeholder="Enter PLC controller"
                  disabled={disabled}
                />
              </FormField>

              <FormField
                label="Make"
                required
                error={getError(errors, 'plcDetails.plcSystem.make')}
              >
                <SearchableSelect
                  includeNotApplicable
                  value={plcSystem.make || ''}
                  onChange={(value) => updateSystemField(
                    'make',
                    value,
                    { customMake: isOtherValue(value) ? plcSystem.customMake || '' : '' }
                  )}
                  options={normaliseOptions(plcSystemMakeOptions)}
                  placeholder="Select PLC make"
                  disabled={disabled}
                  error={getError(errors, 'plcDetails.plcSystem.make')}
                />
              </FormField>

              {isOtherValue(plcSystem.make) && (
                <FormField
                  label="Other PLC Make"
                  required
                  error={getError(errors, 'plcDetails.plcSystem.customMake')}
                >
                  <Input
                    value={plcSystem.customMake || ''}
                    onChange={(event) => updateSystemField('customMake', event.target.value)}
                    onBlur={(event) => saveStoredOption(
                      PLC_SYSTEM_MAKE_STORAGE_KEY,
                      event.target.value,
                      MAKE_OPTIONS
                    )}
                    placeholder="Enter custom PLC make"
                    disabled={disabled}
                  />
                </FormField>
              )}

              <FormField label="Model Number, If Any">
                <Input
                  value={plcSystem.modelNumber || ''}
                  onChange={(event) => updateSystemField('modelNumber', event.target.value)}
                  placeholder="Enter model number"
                  disabled={disabled}
                />
              </FormField>

              <FormField
                label="Communication Protocol"
                required
                error={getError(errors, 'plcDetails.plcSystem.communicationProtocol')}
              >
                <SearchableSelect
                  includeNotApplicable
                  value={plcSystem.communicationProtocol || ''}
                  onChange={(value) => updateSystemField('communicationProtocol', value)}
                  options={normaliseOptions(communicationProtocolOptions)}
                  placeholder="Select protocol"
                  disabled={disabled}
                  error={getError(errors, 'plcDetails.plcSystem.communicationProtocol')}
                />
              </FormField>

              <FormField
                label="Network Topology"
                required
                error={getError(errors, 'plcDetails.plcSystem.networkTopology')}
              >
                <SearchableSelect
                  includeNotApplicable
                  value={plcSystem.networkTopology || ''}
                  onChange={(value) => updateSystemField('networkTopology', value)}
                  options={normaliseOptions(networkTopologyOptions)}
                  placeholder="Select topology"
                  disabled={disabled}
                  error={getError(errors, 'plcDetails.plcSystem.networkTopology')}
                />
              </FormField>

              <FormField label="HMI">
                <CheckboxControl
                  checked={plcSystem.hmiRequired}
                  onChange={(checked) => updateSystemField(
                    'hmiRequired',
                    checked,
                    checked ? {} : { hmiSize: '', hmiMake: '' }
                  )}
                  label="Required"
                  disabled={disabled}
                />
              </FormField>

              {plcSystem.hmiRequired && (
                <>
                  <FormField
                    label="HMI Size"
                    required
                    error={getError(errors, 'plcDetails.plcSystem.hmiSize')}
                  >
                    <Input
                      value={plcSystem.hmiSize || ''}
                      onChange={(event) => updateSystemField('hmiSize', event.target.value)}
                      placeholder="Enter HMI size"
                      disabled={disabled}
                    />
                  </FormField>

                  <FormField
                    label="HMI Make"
                    required
                    error={getError(errors, 'plcDetails.plcSystem.hmiMake')}
                  >
                    <Input
                      value={plcSystem.hmiMake || ''}
                      onChange={(event) => updateSystemField('hmiMake', event.target.value)}
                      placeholder="Enter HMI make"
                      disabled={disabled}
                    />
                  </FormField>
                </>
              )}

              <FormField label="Ethernet Switch">
                <CheckboxControl
                  checked={plcSystem.ethernetSwitchRequired}
                  onChange={(checked) => updateSystemField(
                    'ethernetSwitchRequired',
                    checked,
                    checked ? {} : { ethernetSwitchPort: '', ethernetSwitchType: '' }
                  )}
                  label="Required"
                  disabled={disabled}
                />
              </FormField>

              {plcSystem.ethernetSwitchRequired && (
                <>
                  <FormField
                    label="Port"
                    required
                    error={getError(errors, 'plcDetails.plcSystem.ethernetSwitchPort')}
                  >
                    <Input
                      value={plcSystem.ethernetSwitchPort || ''}
                      onChange={(event) => updateSystemField('ethernetSwitchPort', event.target.value)}
                      placeholder="Enter port details"
                      disabled={disabled}
                    />
                  </FormField>

                  <FormField
                    label="Type"
                    required
                    error={getError(errors, 'plcDetails.plcSystem.ethernetSwitchType')}
                  >
                    <Input
                      value={plcSystem.ethernetSwitchType || ''}
                      onChange={(event) => updateSystemField('ethernetSwitchType', event.target.value)}
                      placeholder="Enter switch type"
                      disabled={disabled}
                    />
                  </FormField>
                </>
              )}

              <FormField
                label="Programming / Development"
                error={getError(errors, 'plcDetails.programmingDevelopmentScope')}
              >
                <SearchableSelect
                  includeNotApplicable
                  value={details.programmingDevelopmentScope || ''}
                  onChange={(value) => updatePlcDetails(setForm, {
                    ...details,
                    programmingDevelopmentScope: value,
                  })}
                  options={normaliseOptions(PROGRAMMING_DEVELOPMENT_SCOPE_OPTIONS)}
                  placeholder="Select scope"
                  disabled={disabled}
                  error={getError(errors, 'plcDetails.programmingDevelopmentScope')}
                />
              </FormField>
            </div>
          </Subsection>

          <Subsection
            icon={ListChecks}
            title="I/O Details"
            subtitle="Enter each I/O type on a separate horizontal row."
            color="green"
          >
            <div className="space-y-3">
              {IO_ROW_DEFINITIONS.map((definition) => {
                const row = ioRequirements[definition.key] || createIoRow();
                const quantityError = getError(
                  errors,
                  `plcDetails.ioRequirements.${definition.key}.quantity`
                );

                return (
                  <div
                    key={definition.key}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"
                  >
                    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[70px_minmax(120px,1fr)_repeat(5,minmax(110px,1fr))]">
                      <div className="flex min-h-[42px] items-center justify-center rounded-lg bg-indigo-600 px-3 text-sm font-bold text-white">
                        {definition.label}
                      </div>

                      <FormField label="Quantity" required error={quantityError}>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={row.quantity ?? ''}
                          onChange={(event) => updateIoRequirement(
                            setForm,
                            definition,
                            'quantity',
                            event.target.value
                          )}
                          placeholder="0"
                          disabled={disabled}
                        />
                      </FormField>

                      <FormField label="Relay">
                        <CheckboxControl
                          checked={row.relay}
                          onChange={(checked) => updateIoRequirement(setForm, definition, 'relay', checked)}
                          label="Required"
                          disabled={disabled}
                        />
                      </FormField>

                      <FormField label="Is Barrier">
                        <CheckboxControl
                          checked={row.isBarrier}
                          onChange={(checked) => updateIoRequirement(setForm, definition, 'isBarrier', checked)}
                          label="Required"
                          disabled={disabled}
                        />
                      </FormField>

                      <FormField label="Conformal Coated">
                        <CheckboxControl
                          checked={row.conformalCoated}
                          onChange={(checked) => updateIoRequirement(setForm, definition, 'conformalCoated', checked)}
                          label="Required"
                          disabled={disabled}
                        />
                      </FormField>

                      <FormField label="Is Input">
                        <CheckboxControl
                          checked={row.isInput}
                          onChange={(checked) => updateIoRequirement(setForm, definition, 'isInput', checked)}
                          label="Required"
                          disabled={disabled}
                        />
                      </FormField>

                      {definition.hart ? (
                        <FormField label="HART">
                          <CheckboxControl
                            checked={row.hart}
                            onChange={(checked) => updateIoRequirement(setForm, definition, 'hart', checked)}
                            label="Required"
                            disabled={disabled}
                          />
                        </FormField>
                      ) : (
                        <div className="hidden lg:block" aria-hidden="true" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <FormField
                label="No. of Thermocouple / RTD Inputs"
                error={getError(errors, 'plcDetails.ioDetails.thermocoupleRtdInputs')}
              >
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={legacyIoDetails.thermocoupleRtdInputs ?? ''}
                  onChange={(event) => updateNestedGroup(
                    setForm,
                    'ioDetails',
                    'thermocoupleRtdInputs',
                    event.target.value
                  )}
                  placeholder="Enter TC / RTD count"
                  disabled={disabled}
                />
              </FormField>

              <FormField
                label="No. of High-Speed Counter Inputs"
                error={getError(errors, 'plcDetails.ioDetails.highSpeedCounterInputs')}
              >
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={legacyIoDetails.highSpeedCounterInputs ?? ''}
                  onChange={(event) => updateNestedGroup(
                    setForm,
                    'ioDetails',
                    'highSpeedCounterInputs',
                    event.target.value
                  )}
                  placeholder="Enter HSC count"
                  disabled={disabled}
                />
              </FormField>

              <FormField
                label="I/O Spare Capacity (%)"
                error={getError(errors, 'plcDetails.ioDetails.ioSpareCapacityPercent')}
              >
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={legacyIoDetails.ioSpareCapacityPercent ?? ''}
                  onChange={(event) => updateNestedGroup(
                    setForm,
                    'ioDetails',
                    'ioSpareCapacityPercent',
                    event.target.value
                  )}
                  placeholder="Enter spare capacity %"
                  disabled={disabled}
                />
              </FormField>
            </div>
          </Subsection>

          <Subsection
            icon={Repeat2}
            title="Redundancy"
            subtitle="Select PLC, network, communication and power-supply redundancy requirements."
            color="violet"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <FormField
                label="PLC Redundancy"
                error={getError(errors, 'plcDetails.redundancy.plcRedundancy')}
              >
                <div className="grid min-h-[42px] grid-cols-1 gap-2 sm:grid-cols-3 rounded-lg border border-slate-200 bg-slate-50 p-1.5">
                  {PLC_REDUNDANCY_OPTIONS.map((option) => (
                    <label
                      key={option}
                      className={`flex cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                        redundancy.plcRedundancy === option
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white text-slate-700 hover:bg-indigo-50'
                      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <input
                        type="radio"
                        name="plc-redundancy"
                        value={option}
                        checked={redundancy.plcRedundancy === option}
                        onChange={() => updateRedundancy(setForm, 'plcRedundancy', option)}
                        disabled={disabled}
                        className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </FormField>

              <FormField label="Network Redundancy">
                <CheckboxControl
                  checked={redundancy.networkRedundancy}
                  onChange={(checked) => updateRedundancy(setForm, 'networkRedundancy', checked)}
                  label="Required"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Communication Redundancy">
                <CheckboxControl
                  checked={redundancy.communicationRedundancy}
                  onChange={(checked) => updateRedundancy(setForm, 'communicationRedundancy', checked)}
                  label="Required"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Power Supply Redundancy">
                <CheckboxControl
                  checked={legacyIoDetails.powerSupplyRedundancy === 'Yes'}
                  onChange={(checked) => updateNestedGroup(
                    setForm,
                    'ioDetails',
                    'powerSupplyRedundancy',
                    checked ? 'Yes' : 'No'
                  )}
                  label="Required"
                  disabled={disabled}
                />
              </FormField>
            </div>
          </Subsection>

          <Subsection
            icon={Cog}
            title="Servo Details"
            subtitle="Define the servo motor, encoder, brake, communication and cable requirements."
            color="orange"
          >
            <div className="space-y-5">
              <div>
                <div className="mb-3 border-b border-orange-100 pb-2">
                  <h5 className="text-sm font-semibold text-slate-900">Servo Motor Details</h5>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <FormField
                    label="Servo Make"
                    required
                    error={getError(errors, 'plcDetails.servoDetails.make')}
                  >
                    <SearchableSelect
                      includeNotApplicable
                      value={servoDetails.make || ''}
                      onChange={(value) => updateNestedGroup(
                        setForm,
                        'servoDetails',
                        'make',
                        value,
                        { customMake: isOtherValue(value) ? servoDetails.customMake || '' : '' }
                      )}
                      options={normaliseOptions(SERVO_MAKE_OPTIONS)}
                      placeholder="Select servo make"
                      disabled={disabled}
                      error={getError(errors, 'plcDetails.servoDetails.make')}
                    />
                  </FormField>

                  {isOtherValue(servoDetails.make) && (
                    <FormField
                      label="Other Servo Make"
                      required
                      error={getError(errors, 'plcDetails.servoDetails.customMake')}
                    >
                      <Input
                        value={servoDetails.customMake || ''}
                        onChange={(event) => updateNestedGroup(
                          setForm,
                          'servoDetails',
                          'customMake',
                          event.target.value
                        )}
                        placeholder="Enter servo make"
                        disabled={disabled}
                      />
                    </FormField>
                  )}

                  <FormField
                    label="Input Voltage"
                    required
                    error={getError(errors, 'plcDetails.servoDetails.inputVoltage')}
                  >
                    <SearchableSelect
                      includeNotApplicable
                      value={servoDetails.inputVoltage || ''}
                      onChange={(value) => updateNestedGroup(
                        setForm,
                        'servoDetails',
                        'inputVoltage',
                        value
                      )}
                      options={normaliseOptions(SERVO_INPUT_VOLTAGE_OPTIONS)}
                      placeholder="Select input voltage"
                      disabled={disabled}
                      error={getError(errors, 'plcDetails.servoDetails.inputVoltage')}
                    />
                  </FormField>

                  <FormField
                    label="Servo Motor Capacity (kW)"
                    required
                    error={getError(errors, 'plcDetails.servoDetails.motorCapacityKw')}
                  >
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={servoDetails.motorCapacityKw ?? ''}
                      onChange={(event) => updateNestedGroup(
                        setForm,
                        'servoDetails',
                        'motorCapacityKw',
                        event.target.value
                      )}
                      placeholder="Enter capacity"
                      disabled={disabled}
                    />
                  </FormField>

                  <FormField
                    label="Encoder Type"
                    required
                    error={getError(errors, 'plcDetails.servoDetails.encoderType')}
                  >
                    <SearchableSelect
                      includeNotApplicable
                      value={servoDetails.encoderType || ''}
                      onChange={(value) => updateNestedGroup(
                        setForm,
                        'servoDetails',
                        'encoderType',
                        value
                      )}
                      options={normaliseOptions(SERVO_ENCODER_TYPE_OPTIONS)}
                      placeholder="Select encoder type"
                      disabled={disabled}
                      error={getError(errors, 'plcDetails.servoDetails.encoderType')}
                    />
                  </FormField>

                  <FormField
                    label="Brake"
                    required
                    error={getError(errors, 'plcDetails.servoDetails.brake')}
                  >
                    <div className="grid min-h-[42px] grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1.5 sm:grid-cols-3">
                      {['Yes', 'No', 'NA - Not Applicable'].map((option) => (
                        <label
                          key={option}
                          className={`flex cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                            servoDetails.brake === option
                              ? 'bg-orange-600 text-white shadow-sm'
                              : 'bg-white text-slate-700 hover:bg-orange-50'
                          } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                        >
                          <input
                            type="radio"
                            name="plc-servo-brake"
                            value={option}
                            checked={servoDetails.brake === option}
                            onChange={() => updateNestedGroup(
                              setForm,
                              'servoDetails',
                              'brake',
                              option
                            )}
                            disabled={disabled}
                            className="h-4 w-4 border-slate-300 text-orange-600 focus:ring-orange-500"
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </FormField>

                  <FormField
                    label="Rated RPM"
                    required
                    error={getError(errors, 'plcDetails.servoDetails.ratedRpm')}
                  >
                    <SearchableSelect
                      includeNotApplicable
                      value={servoDetails.ratedRpm || ''}
                      onChange={(value) => updateNestedGroup(
                        setForm,
                        'servoDetails',
                        'ratedRpm',
                        value
                      )}
                      options={normaliseOptions(SERVO_RATED_RPM_OPTIONS)}
                      placeholder="Select rated RPM"
                      disabled={disabled}
                      error={getError(errors, 'plcDetails.servoDetails.ratedRpm')}
                    />
                  </FormField>
                </div>
              </div>

              <div>
                <div className="mb-3 border-b border-orange-100 pb-2">
                  <h5 className="text-sm font-semibold text-slate-900">Communication Details</h5>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <FormField
                    label="Motor Amplifier Communication"
                    required
                    error={getError(errors, 'plcDetails.servoDetails.amplifierCommunication')}
                  >
                    <SearchableSelect
                      includeNotApplicable
                      value={servoDetails.amplifierCommunication || ''}
                      onChange={(value) => updateNestedGroup(
                        setForm,
                        'servoDetails',
                        'amplifierCommunication',
                        value
                      )}
                      options={normaliseOptions(SERVO_AMPLIFIER_COMMUNICATION_OPTIONS)}
                      placeholder="Select communication"
                      disabled={disabled}
                      error={getError(errors, 'plcDetails.servoDetails.amplifierCommunication')}
                    />
                  </FormField>

                  <FormField
                    label="Communication Protocol"
                    required
                    error={getError(errors, 'plcDetails.servoDetails.communicationProtocol')}
                  >
                    <Input
                      value={servoDetails.communicationProtocol || ''}
                      onChange={(event) => updateNestedGroup(
                        setForm,
                        'servoDetails',
                        'communicationProtocol',
                        event.target.value
                      )}
                      placeholder="Enter protocol"
                      disabled={disabled}
                    />
                  </FormField>

                  <FormField
                    label="Cable Length (metres)"
                    required
                    error={getError(errors, 'plcDetails.servoDetails.cableLengthMetres')}
                  >
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={servoDetails.cableLengthMetres ?? ''}
                      onChange={(event) => updateNestedGroup(
                        setForm,
                        'servoDetails',
                        'cableLengthMetres',
                        event.target.value
                      )}
                      placeholder="Enter cable length"
                      disabled={disabled}
                    />
                  </FormField>
                </div>
              </div>
            </div>
          </Subsection>

          <Subsection
            icon={PackageSearch}
            title="Other Material Requirement"
            subtitle="PLC engineering material requirements excluding PLC, HMI, VFD, servo and remote I/O fields."
            color="indigo"
          >
            <ComponentRequirementTable
              title=""
              rows={visibleMaterialRows}
              componentRows={OTHER_MATERIAL_COMPONENT_ROWS}
              onChange={(updatedRows) => updatePlcDetails(setForm, (currentDetails) => ({
                ...currentDetails,
                automationRequirements: mergeVisibleMaterialRows(
                  Array.isArray(currentDetails.automationRequirements)
                    ? currentDetails.automationRequirements
                    : [],
                  updatedRows
                ),
              }))}
              errorPrefix="plcDetails.automationRequirements"
              errors={errors}
              disabled={disabled}
              showAllRows
              allowAddRow={false}
              preferredBrandOptions={PLC_PREFERRED_BRAND_OPTIONS}
            />
          </Subsection>

          <Subsection
            icon={Headphones}
            title="Support Requirements"
            subtitle="Define on-site and commissioning support requirements."
            color="rose"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <FormField
                label="On-site Support"
                error={getError(errors, 'plcDetails.supportRequirements.onsiteSupportRequired')}
              >
                <CheckboxControl
                  checked={supportRequirements.onsiteSupportRequired === 'Required'}
                  onChange={(checked) => updateNestedGroup(
                    setForm,
                    'supportRequirements',
                    'onsiteSupportRequired',
                    checked ? 'Required' : 'Not Required',
                    checked ? {} : { onsiteSupportDays: '' }
                  )}
                  label="Required"
                  disabled={disabled}
                />
              </FormField>

              {showOnsiteSupportDays && (
                <FormField
                  label="On-site Days"
                  required
                  error={getError(errors, 'plcDetails.supportRequirements.onsiteSupportDays')}
                >
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={supportRequirements.onsiteSupportDays ?? ''}
                    onChange={(event) => updateNestedGroup(
                      setForm,
                      'supportRequirements',
                      'onsiteSupportDays',
                      event.target.value
                    )}
                    placeholder="No. of days"
                    disabled={disabled}
                  />
                </FormField>
              )}

              <FormField
                label="Commissioning Support"
                error={getError(errors, 'plcDetails.supportRequirements.commissioningSupportRequired')}
              >
                <CheckboxControl
                  checked={supportRequirements.commissioningSupportRequired === 'Required'}
                  onChange={(checked) => updateNestedGroup(
                    setForm,
                    'supportRequirements',
                    'commissioningSupportRequired',
                    checked ? 'Required' : 'Not Required',
                    checked ? {} : { commissioningSupportDays: '' }
                  )}
                  label="Required"
                  disabled={disabled}
                />
              </FormField>

              {showCommissioningSupportDays && (
                <FormField
                  label="Commissioning Days"
                  required
                  error={getError(errors, 'plcDetails.supportRequirements.commissioningSupportDays')}
                >
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={supportRequirements.commissioningSupportDays ?? ''}
                    onChange={(event) => updateNestedGroup(
                      setForm,
                      'supportRequirements',
                      'commissioningSupportDays',
                      event.target.value
                    )}
                    placeholder="No. of days"
                    disabled={disabled}
                  />
                </FormField>
              )}
            </div>
          </Subsection>
        </div>
      </SectionCard>
    </div>
  );
};

export default PlcPanelInquirySection;
