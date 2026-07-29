import React from 'react';
import { ListChecks, Wrench, Headphones } from 'lucide-react';

import {
  FormField,
  Input,
  SearchableSelect,
  MultiCheckSelect,
} from '../../common/FormComponents.extended';

import ComponentRequirementTable from '../tables/ComponentRequirementTable';
import OutgoingFeederLoadLists from '../tables/OutgoingFeederLoadLists';
import MainIncomerSection from './MainIncomerSection';

import {
  VFD_COMPONENT_ROWS,
  MCC_FEEDER_TYPE_OPTIONS,
  defaultVfdDetails,
} from '../../../data/inquiryMasterData';

import {
  emptyMainIncomerDetails,
  getMainIncomerValueSignature,
  getPanelMainIncomerDetails,
  getSameAsAboveSourcePanelType,
  setPanelMainIncomerDetails,
} from '../../../utils/mainIncomerUtils';

import {
  getFeederLoadRows,
  hasMeaningfulFeederLoadRows,
  normalizeFeederLoadDetails,
} from '../../../utils/feederLoadDetails';

const normaliseOptions = (options = []) =>
  options.map((option) => {
    if (typeof option === 'string') return { value: option, label: option };
    return option;
  });

const getError = (errors = {}, key) => errors?.[key] || '';

const normalizeFeederType = (value) => {
  const cleanValue = String(value || '').trim();
  const legacyMap = {
    DOL: 'DOL Starter',
    'Star-Delta': 'Star-Delta Starter',
    VFD: 'VFD Feeder',
    Servo: 'Servo Feeder',
  };

  return legacyMap[cleanValue] || cleanValue;
};

const VFD_PREFERRED_BRAND_OPTIONS = [
  'Siemens',
  'Schneider',
  'ROCKWELL',
  'ABB',
  'Other',
];

const getVfdDetails = (form = {}) => {
  const defaults = defaultVfdDetails();
  const current = form.vfdDetails || {};
  const currentSoftStarter = current.softStarter || {};

  const currentOutgoing = current.outgoingFeederDetails || {};
  const selectedFeederTypes = Array.from(new Set(
    (Array.isArray(currentOutgoing.feederTypes)
      ? currentOutgoing.feederTypes
      : defaults.outgoingFeederDetails.feederTypes
    ).map(normalizeFeederType).filter(Boolean)
  ));

  const feederTypes = selectedFeederTypes.length > 0
    ? selectedFeederTypes
    : (hasMeaningfulFeederLoadRows(current.loadDetails) ? ['VFD Feeder'] : []);

  const feederLoadDetails = normalizeFeederLoadDetails({
    feederTypes,
    groups: current.feederLoadDetails,
    legacyRowsByType: {
      'VFD Feeder': current.loadDetails,
      'Soft Starter': currentSoftStarter.loadDetails,
    },
  });

  return {
    ...defaults,
    ...current,
    outgoingFeederDetails: {
      ...defaults.outgoingFeederDetails,
      ...currentOutgoing,
      feederTypes,
    },
    feederLoadDetails,
    loadDetails: getFeederLoadRows(feederLoadDetails, 'VFD Feeder').length
      ? getFeederLoadRows(feederLoadDetails, 'VFD Feeder')
      : (Array.isArray(current.loadDetails) && current.loadDetails.length > 0
        ? current.loadDetails
        : defaults.loadDetails),
    additionalComponents:
      Array.isArray(current.additionalComponents) && current.additionalComponents.length > 0
        ? current.additionalComponents
        : defaults.additionalComponents,
    mainIncomer: {
      ...defaults.mainIncomer,
      ...(current.mainIncomer || {}),
      sameAsAbove: Boolean(current.mainIncomer?.sameAsAbove),
    },
    vfdOptions: {
      ...defaults.vfdOptions,
      ...(current.vfdOptions || {}),
    },
    softStarter: {
      ...defaults.softStarter,
      ...currentSoftStarter,
      loadDetails: getFeederLoadRows(feederLoadDetails, 'Soft Starter').length
        ? getFeederLoadRows(feederLoadDetails, 'Soft Starter')
        : (Array.isArray(currentSoftStarter.loadDetails) && currentSoftStarter.loadDetails.length > 0
          ? currentSoftStarter.loadDetails
          : defaults.softStarter.loadDetails),
      options: {
        ...defaults.softStarter.options,
        ...(currentSoftStarter.options || {}),
      },
    },
  };
};

const updateVfdDetails = (setForm, updater) => {
  setForm((prev) => {
    const currentVfdDetails = getVfdDetails(prev);
    const nextVfdDetails =
      typeof updater === 'function' ? updater(currentVfdDetails) : updater;

    return {
      ...prev,
      vfdDetails: {
        ...currentVfdDetails,
        ...(nextVfdDetails || {}),
      },
    };
  });
};

const updateVfdField = (setForm, field, value) => {
  updateVfdDetails(setForm, {
    [field]: value,
  });
};

const updateSupportField = (setForm, field, value) => {
  updateVfdDetails(setForm, {
    [field]: value,
  });
};

const PanelSubsection = ({ icon: Icon, title, subtitle, color = 'orange', compact = false, children }) => {
  const toneMap = {
    orange: 'border-orange-100 bg-orange-50/40 text-orange-700',
    blue: 'border-blue-100 bg-blue-50/40 text-blue-700',
    purple: 'border-purple-100 bg-purple-50/40 text-purple-700',
    green: 'border-green-100 bg-green-50/40 text-green-700',
    cyan: 'border-cyan-100 bg-cyan-50/40 text-cyan-700',
  };

  return (
    <div
      className={`rounded-2xl border ${compact ? 'p-3' : 'p-4'} ${toneMap[color] || toneMap.orange}`}
    >
      <div className={`${compact ? 'mb-3' : 'mb-4'} flex items-start gap-3`}>
        {Icon && (
          <div className={`${compact ? 'p-1.5' : 'p-2'} mt-0.5 rounded-xl bg-white/80 shadow-sm`}>
            <Icon size={compact ? 16 : 18} />
          </div>
        )}
        <div>
          <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
      <div className={`rounded-xl bg-white/80 ${compact ? 'p-3' : 'p-4'} text-gray-700 shadow-sm`}>
        {children}
      </div>
    </div>
  );
};

const VfdInquirySections = ({
  form,
  setForm,
  errors = {},
  disabled = false,
  mode = 'all',
}) => {
  const vfdDetails = getVfdDetails(form);
  const mainIncomer = vfdDetails.mainIncomer || {};
  const outgoingFeederDetails = vfdDetails.outgoingFeederDetails || {};
  const feederTypeOptions = Array.from(new Set([
    ...MCC_FEEDER_TYPE_OPTIONS,
    ...(Array.isArray(outgoingFeederDetails.feederTypes)
      ? outgoingFeederDetails.feederTypes
      : []),
  ]));
  const sourcePanelType = getSameAsAboveSourcePanelType(form?.panelTypes, 'VFD');
  const sourceMainIncomer = getPanelMainIncomerDetails(form, sourcePanelType);
  const sourceMainIncomerSignature = getMainIncomerValueSignature(sourceMainIncomer);
  const managesMainIncomer = mode === 'panel' || mode === 'all';
  const showSameAsAbove = managesMainIncomer && Boolean(sourcePanelType);

  React.useEffect(() => {
    if (!managesMainIncomer || showSameAsAbove || !mainIncomer.sameAsAbove) return;
    setForm((prev) => setPanelMainIncomerDetails(prev, 'VFD', emptyMainIncomerDetails()));
  }, [mainIncomer.sameAsAbove, managesMainIncomer, setForm, showSameAsAbove]);

  React.useEffect(() => {
    if (!managesMainIncomer || !mainIncomer.sameAsAbove || !sourcePanelType) return;

    setForm((prev) => {
      const latestSourcePanelType = getSameAsAboveSourcePanelType(prev?.panelTypes, 'VFD');
      if (!latestSourcePanelType) {
        return setPanelMainIncomerDetails(prev, 'VFD', emptyMainIncomerDetails());
      }

      return setPanelMainIncomerDetails(prev, 'VFD', {
        ...getPanelMainIncomerDetails(prev, latestSourcePanelType),
        sameAsAbove: true,
      });
    });
  }, [
    mainIncomer.sameAsAbove,
    managesMainIncomer,
    sourceMainIncomerSignature,
    sourcePanelType,
    setForm,
  ]);

  const updateMainIncomerField = (field, value, additionalChanges = {}) => {
    updateVfdDetails(setForm, (current) => ({
      mainIncomer: {
        ...(current.mainIncomer || {}),
        [field]: value,
        ...additionalChanges,
      },
    }));
  };

  const handleSameAsAboveChange = (checked) => {
    setForm((prev) => {
      const latestSourcePanelType = getSameAsAboveSourcePanelType(prev?.panelTypes, 'VFD');

      if (!checked || !latestSourcePanelType) {
        return setPanelMainIncomerDetails(prev, 'VFD', emptyMainIncomerDetails());
      }

      return setPanelMainIncomerDetails(prev, 'VFD', {
        ...getPanelMainIncomerDetails(prev, latestSourcePanelType),
        sameAsAbove: true,
      });
    });
  };

  const onsiteSupportRequiredError =
    getError(errors, 'vfdDetails.onsiteSupportRequired') ||
    getError(errors, 'onsiteSupportRequired');

  const onsiteSupportDaysError =
    getError(errors, 'vfdDetails.onsiteSupportDays') ||
    getError(errors, 'onsiteSupportDays');

  const commissioningSupportRequiredError =
    getError(errors, 'vfdDetails.commissioningSupportRequired') ||
    getError(errors, 'commissioningSupportRequired');

  const commissioningSupportDaysError =
    getError(errors, 'vfdDetails.commissioningSupportDays') ||
    getError(errors, 'commissioningSupportDays');

  const showOnsiteSupportDays = vfdDetails.onsiteSupportRequired === 'Required';
  const showCommissioningSupportDays = vfdDetails.commissioningSupportRequired === 'Required';

  const panelContent = (
    <div className="space-y-5">
      <MainIncomerSection
        details={mainIncomer}
        onFieldChange={updateMainIncomerField}
        errors={errors}
        errorPrefix="vfdDetails.mainIncomer"
        disabled={disabled}
        fieldsDisabled={disabled || Boolean(mainIncomer.sameAsAbove)}
        showSameAsAbove={showSameAsAbove}
        sameAsAbove={mainIncomer.sameAsAbove}
        onSameAsAboveChange={handleSameAsAboveChange}
      />

      <PanelSubsection
        icon={ListChecks}
        title="Outgoing Feeder Types"
        subtitle="Select all outgoing feeder types required in the VFD panel."
        color="blue"
      >
        <FormField
          label="Outgoing Feeder Type"
          required
          error={getError(errors, 'vfdDetails.outgoingFeederDetails.feederTypes')}
        >
          <MultiCheckSelect
            value={outgoingFeederDetails.feederTypes || []}
            onChange={(value) =>
              updateVfdDetails(setForm, (current) => {
                const feederLoadDetails = normalizeFeederLoadDetails({
                  feederTypes: value,
                  groups: current.feederLoadDetails,
                  legacyRowsByType: {
                    'VFD Feeder': current.loadDetails,
                    'Soft Starter': current.softStarter?.loadDetails,
                  },
                });

                return {
                  outgoingFeederDetails: {
                    ...(current.outgoingFeederDetails || {}),
                    feederTypes: value,
                  },
                  feederLoadDetails,
                  loadDetails: getFeederLoadRows(feederLoadDetails, 'VFD Feeder'),
                  softStarter: {
                    ...(current.softStarter || {}),
                    loadDetails: getFeederLoadRows(feederLoadDetails, 'Soft Starter'),
                  },
                };
              })
            }
            options={normaliseOptions(feederTypeOptions)}
            placeholder="Select outgoing feeder types"
            disabled={disabled}
            error={getError(errors, 'vfdDetails.outgoingFeederDetails.feederTypes')}
          />
        </FormField>
      </PanelSubsection>

      <OutgoingFeederLoadLists
        feederTypes={outgoingFeederDetails.feederTypes || []}
        groups={vfdDetails.feederLoadDetails || []}
        onChange={(feederLoadDetails) =>
          updateVfdDetails(setForm, (current) => ({
            feederLoadDetails,
            loadDetails: getFeederLoadRows(feederLoadDetails, 'VFD Feeder'),
            softStarter: {
              ...(current.softStarter || {}),
              loadDetails: getFeederLoadRows(feederLoadDetails, 'Soft Starter'),
            },
          }))
        }
        errors={errors}
        disabled={disabled}
        tone="orange"
      />
    </div>
  );

  const technicalContent = (
    <div className="space-y-4">
      <OutgoingFeederLoadLists
        feederTypes={outgoingFeederDetails.feederTypes || []}
        groups={vfdDetails.feederLoadDetails || []}
        onChange={(feederLoadDetails) =>
          updateVfdDetails(setForm, (current) => ({
            feederLoadDetails,
            loadDetails: getFeederLoadRows(feederLoadDetails, 'VFD Feeder'),
            softStarter: {
              ...(current.softStarter || {}),
              loadDetails: getFeederLoadRows(feederLoadDetails, 'Soft Starter'),
            },
          }))
        }
        errors={errors}
        disabled={disabled}
        tone="blue"
      />
    </div>
  );

  const engineeringContent = (
    <div className="space-y-3">
      <PanelSubsection
        icon={Wrench}
        title="VFD Engineering Requirements"
        subtitle="Additional components and control/communication accessories required in the VFD panel."
        color="purple"
      >
        <ComponentRequirementTable
          title=""
          rows={vfdDetails.additionalComponents}
          componentRows={VFD_COMPONENT_ROWS}
          onChange={(updatedRows) =>
            updateVfdDetails(setForm, {
              additionalComponents: updatedRows,
            })
          }
          errorPrefix="vfdDetails.additionalComponents"
          errors={errors}
          disabled={disabled}
          showAllRows
          allowAddRow={false}
          preferredBrandOptions={VFD_PREFERRED_BRAND_OPTIONS}
        />
      </PanelSubsection>

      <PanelSubsection
        icon={Headphones}
        title="Support Requirements"
        subtitle="Define on-site and commissioning support requirements."
        color="cyan"
        compact
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FormField label="On-site Support" error={onsiteSupportRequiredError}>
            <label
              className={`flex min-h-[42px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                vfdDetails.onsiteSupportRequired === 'Required'
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="checkbox"
                checked={vfdDetails.onsiteSupportRequired === 'Required'}
                onChange={(event) =>
                  updateSupportField(
                    setForm,
                    'onsiteSupportRequired',
                    event.target.checked ? 'Required' : 'Not Required'
                  )
                }
                disabled={disabled}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Required</span>
            </label>
          </FormField>

          {showOnsiteSupportDays && (
            <FormField label="On-site Days" error={onsiteSupportDaysError}>
              <Input
                type="number"
                min="0"
                value={vfdDetails.onsiteSupportDays ?? ''}
                onChange={(event) =>
                  updateSupportField(setForm, 'onsiteSupportDays', event.target.value)
                }
                placeholder="No. of days"
                disabled={disabled}
                className={onsiteSupportDaysError ? 'border-red-400 focus:ring-red-400' : ''}
              />
            </FormField>
          )}

          <FormField label="Commissioning Support" error={commissioningSupportRequiredError}>
            <label
              className={`flex min-h-[42px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                vfdDetails.commissioningSupportRequired === 'Required'
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="checkbox"
                checked={vfdDetails.commissioningSupportRequired === 'Required'}
                onChange={(event) =>
                  updateSupportField(
                    setForm,
                    'commissioningSupportRequired',
                    event.target.checked ? 'Required' : 'Not Required'
                  )
                }
                disabled={disabled}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Required</span>
            </label>
          </FormField>

          {showCommissioningSupportDays && (
            <FormField label="Commissioning Days" error={commissioningSupportDaysError}>
              <Input
                type="number"
                min="0"
                value={vfdDetails.commissioningSupportDays ?? ''}
                onChange={(event) =>
                  updateSupportField(setForm, 'commissioningSupportDays', event.target.value)
                }
                placeholder="No. of days"
                disabled={disabled}
                className={commissioningSupportDaysError ? 'border-red-400 focus:ring-red-400' : ''}
              />
            </FormField>
          )}
        </div>
      </PanelSubsection>
    </div>
  );

  if (mode === 'panel') return panelContent;
  if (mode === 'technical') return technicalContent;
  if (mode === 'engineering') return engineeringContent;

  return (
    <div className="space-y-6">
      {technicalContent}
      {engineeringContent}
    </div>
  );
};

export default VfdInquirySections;
