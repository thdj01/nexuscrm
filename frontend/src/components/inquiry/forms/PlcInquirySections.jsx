import React from 'react';
import { Cpu, Headphones, Network, ShieldCheck } from 'lucide-react';

import {
  FormField,
  Input,
  SearchableSelect,
} from '../../common/FormComponents.extended';

import ComponentRequirementTable from '../tables/ComponentRequirementTable';

import {
  PLC_COMPONENT_ROWS,
  PLC_COMMUNICATION_PROTOCOL_OPTIONS,
  PLC_NETWORK_TOPOLOGY_OPTIONS,
  PROGRAMMING_DEVELOPMENT_SCOPE_OPTIONS,
  BARRIER_VARIANT_OPTIONS,
  defaultPlcDetails,
} from '../../../data/inquiryMasterData';

const normaliseOptions = (options = []) =>
  options.map((option) => {
    if (typeof option === 'string') return { value: option, label: option };
    return option;
  });

const getError = (errors = {}, key) => errors?.[key] || '';

const PLC_PREFERRED_BRAND_OPTIONS = [
  'Siemens',
  'Schneider',
  'ROCKWELL',
  'ABB',
  'Other',
];

const getPlcDetails = (form = {}) => ({
  ...defaultPlcDetails(),
  ...(form.plcDetails || {}),
  ioDetails: {
    ...defaultPlcDetails().ioDetails,
    ...(form.plcDetails?.ioDetails || {}),
  },
  supportRequirements: {
    ...defaultPlcDetails().supportRequirements,
    ...(form.plcDetails?.supportRequirements || {}),
  },
  automationRequirements:
    Array.isArray(form.plcDetails?.automationRequirements) &&
    form.plcDetails.automationRequirements.length > 0
      ? form.plcDetails.automationRequirements
      : defaultPlcDetails().automationRequirements,
});

const updatePlcDetails = (setForm, updater) => {
  setForm((prev) => {
    const currentPlcDetails = getPlcDetails(prev);
    const nextPlcDetails =
      typeof updater === 'function' ? updater(currentPlcDetails) : updater;

    return {
      ...prev,
      plcDetails: {
        ...currentPlcDetails,
        ...nextPlcDetails,
        ioDetails: {
          ...currentPlcDetails.ioDetails,
          ...(nextPlcDetails?.ioDetails || {}),
        },
        supportRequirements: {
          ...currentPlcDetails.supportRequirements,
          ...(nextPlcDetails?.supportRequirements || {}),
        },
      },
    };
  });
};

const updateIoField = (setForm, field, value) => {
  updatePlcDetails(setForm, (current) => ({
    ioDetails: {
      ...current.ioDetails,
      [field]: value,
    },
  }));
};

const updateSupportField = (setForm, field, value) => {
  updatePlcDetails(setForm, (current) => ({
    supportRequirements: {
      ...current.supportRequirements,
      [field]: value,
    },
  }));
};

const updatePlcField = (setForm, field, value) => {
  updatePlcDetails(setForm, {
    [field]: value,
  });
};

const PanelSubsection = ({ icon: Icon, title, subtitle, color = 'indigo', children }) => {
  const toneMap = {
    indigo: 'border-indigo-100 bg-indigo-50/40 text-indigo-700',
    cyan: 'border-cyan-100 bg-cyan-50/40 text-cyan-700',
    amber: 'border-amber-100 bg-amber-50/40 text-amber-700',
    green: 'border-green-100 bg-green-50/40 text-green-700',
  };

  return (
    <div className={`rounded-2xl border p-4 ${toneMap[color] || toneMap.indigo}`}>
      <div className="mb-4 flex items-start gap-3">
        {Icon && (
          <div className="mt-0.5 rounded-xl bg-white/80 p-2 shadow-sm">
            <Icon size={18} />
          </div>
        )}
        <div>
          <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
      <div className="rounded-xl bg-white/80 p-4 text-gray-700 shadow-sm">
        {children}
      </div>
    </div>
  );
};

const PlcInquirySections = ({
  form,
  setForm,
  errors = {},
  disabled = false,
  mode = 'all',
  showSupportRequirements = true,
}) => {
  const plcDetails = getPlcDetails(form);
  const ioDetails = plcDetails.ioDetails || {};
  const supportRequirements = plcDetails.supportRequirements || {};

  const onsiteSupportRequiredError =
    getError(errors, 'plcDetails.supportRequirements.onsiteSupportRequired') ||
    getError(errors, 'onsiteSupportRequired');

  const onsiteSupportDaysError =
    getError(errors, 'plcDetails.supportRequirements.onsiteSupportDays') ||
    getError(errors, 'onsiteSupportDays');

  const commissioningSupportRequiredError =
    getError(errors, 'plcDetails.supportRequirements.commissioningSupportRequired') ||
    getError(errors, 'commissioningSupportRequired');

  const commissioningSupportDaysError =
    getError(errors, 'plcDetails.supportRequirements.commissioningSupportDays') ||
    getError(errors, 'commissioningSupportDays');

  const programmingDevelopmentScopeError =
    getError(errors, 'plcDetails.programmingDevelopmentScope') ||
    getError(errors, 'programmingDevelopmentScope');

  const showOnsiteSupportDays = supportRequirements.onsiteSupportRequired === 'Required';
  const showCommissioningSupportDays = supportRequirements.commissioningSupportRequired === 'Required';

  const technicalContent = (
    <PanelSubsection
      icon={Network}
      title="PLC Technical Details"
      subtitle="I/O count, communication protocol, topology and spare capacity."
      color="cyan"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <FormField
            label="No. of Digital Inputs (DI)"
            error={
              getError(errors, 'plcDetails.ioDetails.digitalInputs') ||
              getError(errors, 'digitalInputs')
            }
          >
            <Input
              type="number"
              min="0"
              value={ioDetails.digitalInputs ?? ''}
              onChange={(event) =>
                updateIoField(setForm, 'digitalInputs', event.target.value)
              }
              placeholder="Enter DI count"
              disabled={disabled}
            />
          </FormField>

          <FormField
            label="No. of Digital Outputs (DO)"
            error={
              getError(errors, 'plcDetails.ioDetails.digitalOutputs') ||
              getError(errors, 'digitalOutputs')
            }
          >
            <Input
              type="number"
              min="0"
              value={ioDetails.digitalOutputs ?? ''}
              onChange={(event) =>
                updateIoField(setForm, 'digitalOutputs', event.target.value)
              }
              placeholder="Enter DO count"
              disabled={disabled}
            />
          </FormField>

          <FormField
            label="No. of Analog Inputs (AI)"
            error={
              getError(errors, 'plcDetails.ioDetails.analogInputs') ||
              getError(errors, 'analogInputs')
            }
          >
            <Input
              type="number"
              min="0"
              value={ioDetails.analogInputs ?? ''}
              onChange={(event) =>
                updateIoField(setForm, 'analogInputs', event.target.value)
              }
              placeholder="Enter AI count"
              disabled={disabled}
            />
          </FormField>

          <FormField
            label="No. of Analog Outputs (AO)"
            error={
              getError(errors, 'plcDetails.ioDetails.analogOutputs') ||
              getError(errors, 'analogOutputs')
            }
          >
            <Input
              type="number"
              min="0"
              value={ioDetails.analogOutputs ?? ''}
              onChange={(event) =>
                updateIoField(setForm, 'analogOutputs', event.target.value)
              }
              placeholder="Enter AO count"
              disabled={disabled}
            />
          </FormField>

          <FormField
            label="No. of Thermocouple / RTD Inputs"
            error={
              getError(errors, 'plcDetails.ioDetails.thermocoupleRtdInputs') ||
              getError(errors, 'thermocoupleRtdInputs')
            }
          >
            <Input
              type="number"
              min="0"
              value={ioDetails.thermocoupleRtdInputs ?? ''}
              onChange={(event) =>
                updateIoField(setForm, 'thermocoupleRtdInputs', event.target.value)
              }
              placeholder="Enter TC / RTD count"
              disabled={disabled}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <FormField
            label="No. of High-Speed Counter Inputs"
            error={
              getError(errors, 'plcDetails.ioDetails.highSpeedCounterInputs') ||
              getError(errors, 'highSpeedCounterInputs')
            }
          >
            <Input
              type="number"
              min="0"
              value={ioDetails.highSpeedCounterInputs ?? ''}
              onChange={(event) =>
                updateIoField(setForm, 'highSpeedCounterInputs', event.target.value)
              }
              placeholder="Enter HSC count"
              disabled={disabled}
            />
          </FormField>

          <FormField
            label="I/O Spare Capacity (%)"
            error={
              getError(errors, 'plcDetails.ioDetails.ioSpareCapacityPercent') ||
              getError(errors, 'ioSpareCapacityPercent')
            }
          >
            <Input
              type="number"
              min="0"
              max="100"
              value={ioDetails.ioSpareCapacityPercent ?? ''}
              onChange={(event) =>
                updateIoField(setForm, 'ioSpareCapacityPercent', event.target.value)
              }
              placeholder="Enter spare capacity %"
              disabled={disabled}
            />
          </FormField>

          <FormField
            label="Communication Protocol"
            error={
              getError(errors, 'plcDetails.ioDetails.communicationProtocol') ||
              getError(errors, 'communicationProtocol')
            }
          >
            <SearchableSelect
              includeNotApplicable
              value={ioDetails.communicationProtocol || ''}
              onChange={(value) =>
                updateIoField(setForm, 'communicationProtocol', value)
              }
              options={normaliseOptions(PLC_COMMUNICATION_PROTOCOL_OPTIONS)}
              placeholder="Select protocol"
              error={
                getError(errors, 'plcDetails.ioDetails.communicationProtocol') ||
                getError(errors, 'communicationProtocol')
              }
              disabled={disabled}
            />
          </FormField>

          <FormField
            label="Network Topology"
            error={
              getError(errors, 'plcDetails.ioDetails.networkTopology') ||
              getError(errors, 'networkTopology')
            }
          >
            <SearchableSelect
              includeNotApplicable
              value={ioDetails.networkTopology || ''}
              onChange={(value) =>
                updateIoField(setForm, 'networkTopology', value)
              }
              options={normaliseOptions(PLC_NETWORK_TOPOLOGY_OPTIONS)}
              placeholder="Select topology"
              error={
                getError(errors, 'plcDetails.ioDetails.networkTopology') ||
                getError(errors, 'networkTopology')
              }
              disabled={disabled}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <FormField
            label="Programming / Development"
            error={programmingDevelopmentScopeError}
          >
            <SearchableSelect
              includeNotApplicable
              value={plcDetails.programmingDevelopmentScope || ''}
              onChange={(value) =>
                updatePlcField(setForm, 'programmingDevelopmentScope', value)
              }
              options={normaliseOptions(PROGRAMMING_DEVELOPMENT_SCOPE_OPTIONS)}
              placeholder="Select scope"
              error={programmingDevelopmentScopeError}
              disabled={disabled}
            />
          </FormField>

          <FormField
            label="Barrier"
            error={getError(errors, 'barrierVariant')}
          >
            <SearchableSelect
              includeNotApplicable
              value={form?.barrierVariant || ''}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  barrierVariant: value,
                }))
              }
              options={normaliseOptions(BARRIER_VARIANT_OPTIONS)}
              placeholder="Select barrier"
              error={getError(errors, 'barrierVariant')}
              disabled={disabled}
            />
          </FormField>

          <FormField
            label="PLC CPU Redundancy"
            error={
              getError(errors, 'plcDetails.ioDetails.plcCpuRedundancyRequired') ||
              getError(errors, 'plcCpuRedundancyRequired')
            }
          >
            <label
              className={`flex min-h-[42px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                ioDetails.plcCpuRedundancyRequired === 'Yes'
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="checkbox"
                checked={ioDetails.plcCpuRedundancyRequired === 'Yes'}
                onChange={(event) =>
                  updateIoField(
                    setForm,
                    'plcCpuRedundancyRequired',
                    event.target.checked ? 'Yes' : 'No'
                  )
                }
                disabled={disabled}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Required</span>
            </label>
          </FormField>

          <FormField
            label="Power Supply Redundancy"
            error={
              getError(errors, 'plcDetails.ioDetails.powerSupplyRedundancy') ||
              getError(errors, 'powerSupplyRedundancy')
            }
          >
            <label
              className={`flex min-h-[42px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                ioDetails.powerSupplyRedundancy === 'Yes'
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="checkbox"
                checked={ioDetails.powerSupplyRedundancy === 'Yes'}
                onChange={(event) =>
                  updateIoField(
                    setForm,
                    'powerSupplyRedundancy',
                    event.target.checked ? 'Yes' : 'No'
                  )
                }
                disabled={disabled}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Required</span>
            </label>
          </FormField>
        </div>
      </div>
    </PanelSubsection>
  );

  const engineeringContent = (
    <div className="space-y-4">
      <PanelSubsection
        icon={Cpu}
      title="PLC Engineering Requirements"
      subtitle="Automation components, preferred makes, redundancy and engineering requirements."
      color="indigo"
    >
      <ComponentRequirementTable
        title=""
        rows={plcDetails.automationRequirements}
        componentRows={PLC_COMPONENT_ROWS}
        onChange={(updatedRows) =>
          updatePlcDetails(setForm, {
            automationRequirements: updatedRows,
          })
        }
        errorPrefix="plcDetails.automationRequirements"
        errors={errors}
        disabled={disabled}
        showAllRows
        allowAddRow={false}
        preferredBrandOptions={PLC_PREFERRED_BRAND_OPTIONS}
      />

      </PanelSubsection>

      {showSupportRequirements && (
        <PanelSubsection
          icon={Headphones}
          title="Support Requirements"
          subtitle="Define on-site and commissioning support requirements."
          color="green"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <FormField label="On-site Support" error={onsiteSupportRequiredError}>
              <label
                className={`flex min-h-[42px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                  supportRequirements.onsiteSupportRequired === 'Required'
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={supportRequirements.onsiteSupportRequired === 'Required'}
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
                  value={supportRequirements.onsiteSupportDays ?? ''}
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
                  supportRequirements.commissioningSupportRequired === 'Required'
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={supportRequirements.commissioningSupportRequired === 'Required'}
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
                  value={supportRequirements.commissioningSupportDays ?? ''}
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
      )}
    </div>
  );

  if (mode === 'technical') return technicalContent;
  if (mode === 'engineering') return engineeringContent;

  return (
    <div className="space-y-6">
      {technicalContent}
      {engineeringContent}
    </div>
  );
};

export default PlcInquirySections;
