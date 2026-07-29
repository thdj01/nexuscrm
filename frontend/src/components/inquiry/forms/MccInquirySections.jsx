import React from 'react';
import {
  Cable,
  Layers,
  ListChecks,
  LayoutDashboard,
  Headphones,
} from 'lucide-react';

import {
  FormField,
  Input,
  SearchableSelect,
  MultiCheckSelect,
  Textarea,
} from '../../common/FormComponents.extended';

import InquiryLoadTable from '../tables/InquiryLoadTable';

import {
  MCC_INCOMER_TYPE_OPTIONS,
  SWITCHGEAR_MAKE_OPTIONS,
  MCC_FEEDER_TYPE_OPTIONS,
  MCC_PANEL_STRUCTURE_OPTIONS,
  MCC_CABLE_ENTRY_MV_LV_OPTIONS,
  MCC_BUSBAR_ARRANGEMENT_OPTIONS,
  // PROTECTION_CLASS_OPTIONS,
  defaultMccDetails,
} from '../../../data/inquiryMasterData';

const BUSBAR_MATERIAL_OPTIONS = ['Aluminium', 'Copper'];

const FORM_OF_SEPARATION_OPTIONS = ['Form 1', 'Form 2', 'Form 3b', 'Form 4b'];

const PANEL_CONSTRUCTION_OPTIONS = ['Draw-out', 'Fixed'];

const MCC_PANEL_TYPE_OPTIONS = ['Compartment', 'Non Compartment'];

const normaliseOptions = (options = []) =>
  options.map((option) => {
    if (typeof option === 'string') return { value: option, label: option };
    return option;
  });

const getError = (errors = {}, key) => errors?.[key] || '';

const isOtherValue = (value) =>
  String(value || '').trim().toUpperCase() === 'OTHER';

const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getMccDetails = (form = {}) => {
  const defaults = defaultMccDetails();
  const current = form.mccDetails || {};

  return {
    ...defaults,
    ...current,
    incomerDetails: {
      ...defaults.incomerDetails,
      ...(current.incomerDetails || {}),
    },
    outgoingFeederDetails: {
      ...defaults.outgoingFeederDetails,
      ...(current.outgoingFeederDetails || {}),
      feederTypes: Array.isArray(current.outgoingFeederDetails?.feederTypes)
        ? current.outgoingFeederDetails.feederTypes
        : defaults.outgoingFeederDetails.feederTypes,
    },
    loadDetails:
      Array.isArray(current.loadDetails) && current.loadDetails.length > 0
        ? current.loadDetails
        : defaults.loadDetails,
    layoutPreferences: {
      ...defaults.layoutPreferences,
      ...(current.layoutPreferences || {}),
    },
    notesAndSupport: {
      ...defaults.notesAndSupport,
      ...(current.notesAndSupport || {}),
    },
  };
};

const updateMccDetails = (setForm, updater) => {
  setForm((prev) => {
    const currentMccDetails = getMccDetails(prev);
    const nextMccDetails =
      typeof updater === 'function' ? updater(currentMccDetails) : updater;

    return {
      ...prev,
      mccDetails: {
        ...currentMccDetails,
        ...(nextMccDetails || {}),
        incomerDetails: {
          ...currentMccDetails.incomerDetails,
          ...(nextMccDetails?.incomerDetails || {}),
        },
        outgoingFeederDetails: {
          ...currentMccDetails.outgoingFeederDetails,
          ...(nextMccDetails?.outgoingFeederDetails || {}),
        },
        layoutPreferences: {
          ...currentMccDetails.layoutPreferences,
          ...(nextMccDetails?.layoutPreferences || {}),
        },
        notesAndSupport: {
          ...currentMccDetails.notesAndSupport,
          ...(nextMccDetails?.notesAndSupport || {}),
        },
      },
    };
  });
};

const updateIncomerField = (setForm, field, value) => {
  updateMccDetails(setForm, (current) => ({
    incomerDetails: {
      ...current.incomerDetails,
      [field]: value,
    },
  }));
};

const updateOutgoingField = (setForm, field, value) => {
  updateMccDetails(setForm, (current) => ({
    outgoingFeederDetails: {

      ...current.outgoingFeederDetails,
      [field]: value,
    },
  }));
};

const updateLayoutField = (setForm, field, value) => {
  updateMccDetails(setForm, (current) => ({
    layoutPreferences: {
      ...current.layoutPreferences,
      [field]: value,
    },
  }));
};

const updateSupportField = (setForm, field, value) => {
  updateMccDetails(setForm, (current) => ({
    notesAndSupport: {
      ...current.notesAndSupport,
      [field]: value,
    },
  }));
};

const PanelSubsection = ({ icon: Icon, title, subtitle, color = 'orange', children }) => {
  const toneMap = {
    orange: 'border-orange-100 bg-orange-50/40 text-orange-700',
    purple: 'border-purple-100 bg-purple-50/40 text-purple-700',
    cyan: 'border-cyan-100 bg-cyan-50/40 text-cyan-700',
    amber: 'border-amber-100 bg-amber-50/40 text-amber-700',
    green: 'border-green-100 bg-green-50/40 text-green-700',
  };

  return (
    <div className={`rounded-2xl border p-4 ${toneMap[color] || toneMap.orange}`}>
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

const MccInquirySections = ({
  form,
  setForm,
  errors = {},
  disabled = false,
  mode = 'all',
  showSupportRequirements = true,
  showPanelStructure = true,
}) => {
  const mccDetails = getMccDetails(form);
  const incomerDetails = mccDetails.incomerDetails || {};
  const outgoingFeederDetails = mccDetails.outgoingFeederDetails || {};
  const layoutPreferences = mccDetails.layoutPreferences || {};
  const notesAndSupport = mccDetails.notesAndSupport || {};

  const showCustomMake = isOtherValue(incomerDetails.make);
  const showSoftStarterMake = toNumber(outgoingFeederDetails.noOfSoftStarters) > 0;
  const showVfdMake = toNumber(outgoingFeederDetails.noOfVfdFeeders) > 0;

  const incomerTypeError =
    getError(errors, 'mccDetails.incomerDetails.incomerType') ||
    getError(errors, 'incomerType');

  const incomerMakeError =
    getError(errors, 'mccDetails.incomerDetails.make') ||
    getError(errors, 'incomerMake') ||
    getError(errors, 'make');

  const customMakeError =
    getError(errors, 'mccDetails.incomerDetails.customMake') ||
    getError(errors, 'customMake');

  const busbarMaterialError =
    getError(errors, 'mccDetails.incomerDetails.busbarMaterial') ||
    getError(errors, 'busbarMaterial');

  const formOfSeparationError =
    getError(errors, 'mccDetails.incomerDetails.formOfSeparation') ||
    getError(errors, 'formOfSeparation');

  const panelConstructionError =
    getError(errors, 'mccDetails.incomerDetails.panelConstruction') ||
    getError(errors, 'panelConstruction');

  const totalNoOfFeedersError =
    getError(errors, 'mccDetails.outgoingFeederDetails.totalNoOfFeeders') ||
    getError(errors, 'totalNoOfFeeders');

  const feederTypesError =
    getError(errors, 'mccDetails.outgoingFeederDetails.feederTypes') ||
    getError(errors, 'feederTypes');

  const noOfDolStartersError =
    getError(errors, 'mccDetails.outgoingFeederDetails.noOfDolStarters') ||
    getError(errors, 'noOfDolStarters');

  const totalLoadKwError =
    getError(errors, 'mccDetails.outgoingFeederDetails.totalLoadKw') ||
    getError(errors, 'totalLoadKw');

  const noOfStarDeltaStartersError =
    getError(errors, 'mccDetails.outgoingFeederDetails.noOfStarDeltaStarters') ||
    getError(errors, 'noOfStarDeltaStarters');

  const switchgearMakeError =
    getError(errors, 'mccDetails.outgoingFeederDetails.switchgearMake') ||
    getError(errors, 'switchgearMake');

  const noOfSoftStartersError =
    getError(errors, 'mccDetails.outgoingFeederDetails.noOfSoftStarters') ||
    getError(errors, 'noOfSoftStarters');

  const softStarterMakeError =
    getError(errors, 'mccDetails.outgoingFeederDetails.softStarterMake') ||
    getError(errors, 'softStarterMake');

  const noOfVfdFeedersError =
    getError(errors, 'mccDetails.outgoingFeederDetails.noOfVfdFeeders') ||
    getError(errors, 'noOfVfdFeeders');

  const vfdMakeError =
    getError(errors, 'mccDetails.outgoingFeederDetails.vfdMake') ||
    getError(errors, 'vfdMake');


  const controlTransformerRequiredError =
    getError(errors, 'mccDetails.outgoingFeederDetails.controlTransformerRequired') ||
    getError(errors, 'controlTransformerRequired');

  const panelTypeError =
    getError(errors, 'mccDetails.layoutPreferences.panelType') ||
    getError(errors, 'mccPanelType');

  const panelStructureError =
    getError(errors, 'mccDetails.layoutPreferences.panelStructure') ||
    getError(errors, 'panelStructure');

  const cableEntryMvLvError =
    getError(errors, 'mccDetails.layoutPreferences.cableEntryMvLv') ||
    getError(errors, 'cableEntryMvLv');

  const busbarArrangementError =
    getError(errors, 'mccDetails.layoutPreferences.busbarArrangement') ||
    getError(errors, 'busbarArrangement');


  const onsiteSupportRequiredError =
    getError(errors, 'mccDetails.notesAndSupport.onsiteSupportRequired') ||
    getError(errors, 'onsiteSupportRequired');

  const commissioningSupportRequiredError =
    getError(errors, 'mccDetails.notesAndSupport.commissioningSupportRequired') ||
    getError(errors, 'commissioningSupportRequired');

  const onsiteSupportDaysError =
    getError(errors, 'mccDetails.notesAndSupport.onsiteSupportDays') ||
    getError(errors, 'onsiteSupportDays');

  const commissioningSupportDaysError =
    getError(errors, 'mccDetails.notesAndSupport.commissioningSupportDays') ||
    getError(errors, 'commissioningSupportDays');

  const showOnsiteSupportDays = notesAndSupport.onsiteSupportRequired === 'Required';
  const showCommissioningSupportDays = notesAndSupport.commissioningSupportRequired === 'Required';

  const trainingRequiredError =
    getError(errors, 'mccDetails.notesAndSupport.trainingRequired') ||
    getError(errors, 'trainingRequired');

  const warrantyPeriodMonthsError =
    getError(errors, 'mccDetails.notesAndSupport.warrantyPeriodMonths') ||
    getError(errors, 'warrantyPeriodMonths');

  const amcRequiredAfterWarrantyError =
    getError(errors, 'mccDetails.notesAndSupport.amcRequiredAfterWarranty') ||
    getError(errors, 'amcRequiredAfterWarranty');

  const additionalCommentsError =
    getError(errors, 'mccDetails.notesAndSupport.additionalComments') ||
    getError(errors, 'additionalComments');


  const technicalContent = (
    <div className="space-y-4">
            <PanelSubsection
              icon={Cable}
              title="MCC Technical — Incomer Details"
              subtitle="Define incomer type, make, busbar and construction details."
              color="orange"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <FormField
                  label="Incomer Type"
                  error={incomerTypeError}
                >
                  <SearchableSelect
                    includeNotApplicable
                    value={incomerDetails.incomerType || ''}
                    onChange={(value) => updateIncomerField(setForm, 'incomerType', value)}
                    options={normaliseOptions(MCC_INCOMER_TYPE_OPTIONS)}
                    placeholder="Select incomer type"
                    error={incomerTypeError}
                    disabled={disabled}
                  />
                </FormField>
      
                <FormField
                  label="Make"
                  error={incomerMakeError}
                >
                  <SearchableSelect
                    includeNotApplicable
                    value={incomerDetails.make || ''}
                    onChange={(value) => updateIncomerField(setForm, 'make', value)}
                    options={normaliseOptions(SWITCHGEAR_MAKE_OPTIONS)}
                    placeholder="Select make"
                    error={incomerMakeError}
                    disabled={disabled}
                  />
                </FormField>
      
                {showCustomMake && (
                  <FormField
                    label="Custom Make"
                    error={customMakeError}
                  >
                    <Input
                      value={incomerDetails.customMake || ''}
                      onChange={(event) =>
                        updateIncomerField(setForm, 'customMake', event.target.value)
                      }
                      placeholder="Enter custom make"
                      disabled={disabled}
                      className={customMakeError ? 'border-red-400 focus:ring-red-400' : ''}
                    />
                  </FormField>
                )}
      
                <FormField
                  label="Busbar Material"
                  error={busbarMaterialError}
                >
                  <SearchableSelect
                    includeNotApplicable
                    value={incomerDetails.busbarMaterial || ''}
                    onChange={(value) => updateIncomerField(setForm, 'busbarMaterial', value)}
                    options={normaliseOptions(BUSBAR_MATERIAL_OPTIONS)}
                    placeholder="Select busbar material"
                    error={busbarMaterialError}
                    disabled={disabled}
                  />
                </FormField>
      
                <FormField
                  label="Form of Separation"
                  error={formOfSeparationError}
                >
                  <SearchableSelect
                    includeNotApplicable
                    value={incomerDetails.formOfSeparation || ''}
                    onChange={(value) => updateIncomerField(setForm, 'formOfSeparation', value)}
                    options={normaliseOptions(FORM_OF_SEPARATION_OPTIONS)}
                    placeholder="Select form of separation"
                    error={formOfSeparationError}
                    disabled={disabled}
                  />
                </FormField>
      
                <FormField
                  label="Panel Construction"
                  error={panelConstructionError}
                >
                  <SearchableSelect
                    includeNotApplicable
                    value={incomerDetails.panelConstruction || ''}
                    onChange={(value) => updateIncomerField(setForm, 'panelConstruction', value)}
                    options={normaliseOptions(PANEL_CONSTRUCTION_OPTIONS)}
                    placeholder="Select panel construction"
                    error={panelConstructionError}
                    disabled={disabled}
                  />
                </FormField>
              </div>
            </PanelSubsection>
      
            <PanelSubsection
              icon={Layers}
              title="MCC Technical — Feeder Summary"
              subtitle="Define feeder quantity, feeder types, switchgear and control details."
              color="purple"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <FormField
                  label="Total No. of Feeders"
                  error={totalNoOfFeedersError}
                >
                  <Input
                    type="number"
                    min="0"
                    value={outgoingFeederDetails.totalNoOfFeeders ?? ''}
                    onChange={(event) =>
                      updateOutgoingField(setForm, 'totalNoOfFeeders', event.target.value)
                    }
                    placeholder="Enter total feeders"
                    disabled={disabled}
                    className={totalNoOfFeedersError ? 'border-red-400 focus:ring-red-400' : ''}
                  />
                </FormField>
      
                <FormField
                  label="Feeder Types"
                  error={feederTypesError}
                >
                  <MultiCheckSelect
                    value={outgoingFeederDetails.feederTypes || []}
                    onChange={(value) => updateOutgoingField(setForm, 'feederTypes', value)}
                    options={normaliseOptions(MCC_FEEDER_TYPE_OPTIONS)}
                    placeholder="Select feeder types"
                    error={feederTypesError}
                    disabled={disabled}
                  />
                </FormField>
      
                <FormField
                  label="No. of DOL Starters"
                  error={noOfDolStartersError}
                >
                  <Input
                    type="number"
                    min="0"
                    value={outgoingFeederDetails.noOfDolStarters ?? ''}
                    onChange={(event) =>
                      updateOutgoingField(setForm, 'noOfDolStarters', event.target.value)
                    }
                    placeholder="Enter DOL starters"
                    disabled={disabled}
                    className={noOfDolStartersError ? 'border-red-400 focus:ring-red-400' : ''}
                  />
                </FormField>
      
                <FormField
                  label="Total Load (KW)"
                  error={totalLoadKwError}
                >
                  <Input
                    type="number"
                    min="0"
                    value={outgoingFeederDetails.totalLoadKw ?? ''}
                    onChange={(event) =>
                      updateOutgoingField(setForm, 'totalLoadKw', event.target.value)
                    }
                    placeholder="Enter total load KW"
                    disabled={disabled}
                    className={totalLoadKwError ? 'border-red-400 focus:ring-red-400' : ''}
                  />
                </FormField>
      
                <FormField
                  label="No. of Star-Delta Starters"
                  error={noOfStarDeltaStartersError}
                >
                  <Input
                    type="number"
                    min="0"
                    value={outgoingFeederDetails.noOfStarDeltaStarters ?? ''}
                    onChange={(event) =>
                      updateOutgoingField(setForm, 'noOfStarDeltaStarters', event.target.value)
                    }
                    placeholder="Enter star-delta starters"
                    disabled={disabled}
                    className={noOfStarDeltaStartersError ? 'border-red-400 focus:ring-red-400' : ''}
                  />
                </FormField>
      
                <FormField
                  label="No. of Soft Starters"
                  error={noOfSoftStartersError}
                >
                  <Input
                    type="number"
                    min="0"
                    value={outgoingFeederDetails.noOfSoftStarters ?? ''}
                    onChange={(event) =>
                      updateOutgoingField(setForm, 'noOfSoftStarters', event.target.value)
                    }
                    placeholder="Enter soft starters"
                    disabled={disabled}
                    className={noOfSoftStartersError ? 'border-red-400 focus:ring-red-400' : ''}
                  />
                </FormField>
      
                {showSoftStarterMake && (
                  <FormField
                    label="Soft Starter Make"
                    error={softStarterMakeError}
                  >
                    <Input
                      value={outgoingFeederDetails.softStarterMake || ''}
                      onChange={(event) =>
                        updateOutgoingField(setForm, 'softStarterMake', event.target.value)
                      }
                      placeholder="Enter soft starter make"
                      disabled={disabled}
                      className={softStarterMakeError ? 'border-red-400 focus:ring-red-400' : ''}
                    />
                  </FormField>
                )}
      
                <FormField
                  label="No. of VFD Feeders"
                  error={noOfVfdFeedersError}
                >
                  <Input
                    type="number"
                    min="0"
                    value={outgoingFeederDetails.noOfVfdFeeders ?? ''}
                    onChange={(event) =>
                      updateOutgoingField(setForm, 'noOfVfdFeeders', event.target.value)
                    }
                    placeholder="Enter VFD feeders"
                    disabled={disabled}
                    className={noOfVfdFeedersError ? 'border-red-400 focus:ring-red-400' : ''}
                  />
                </FormField>
      
                {showVfdMake && (
                  <FormField
                    label="VFD Make"
                    error={vfdMakeError}
                  >
                    <Input
                      value={outgoingFeederDetails.vfdMake || ''}
                      onChange={(event) =>
                        updateOutgoingField(setForm, 'vfdMake', event.target.value)
                      }
                      placeholder="Enter VFD make"
                      disabled={disabled}
                      className={vfdMakeError ? 'border-red-400 focus:ring-red-400' : ''}
                    />
                  </FormField>
                )}

      
                <FormField
                  label="Control Transformer Required"
                  error={controlTransformerRequiredError}
                >
                  <label
                    className={`flex min-h-[42px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                      outgoingFeederDetails.controlTransformerRequired === 'Yes'
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={outgoingFeederDetails.controlTransformerRequired === 'Yes'}
                      onChange={(event) =>
                        updateOutgoingField(
                          setForm,
                          'controlTransformerRequired',
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
            </PanelSubsection>
      
            <PanelSubsection
              icon={ListChecks}
              title="MCC Technical — Load Details"
              subtitle="Enter MCC load details with rating and full load current."
              color="cyan"
            >
              <InquiryLoadTable
                rows={mccDetails.loadDetails}
                onChange={(updatedRows) =>
                  updateMccDetails(setForm, {
                    loadDetails: updatedRows,
                  })
                }
                showRemarks={false}
                errors={errors}
                minRows={0}
                disabled={disabled}
              />
            </PanelSubsection>

            <PanelSubsection
              icon={LayoutDashboard}
              title="MCC Engineering — Layout Preferences"
              subtitle="Define MCC panel layout, cable entry, busbar arrangement and protection."
              color="amber"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <FormField
                  label="Panel Type"
                  error={panelTypeError}
                >
                  <SearchableSelect
                    includeNotApplicable
                    value={layoutPreferences.panelType || ''}
                    onChange={(value) => updateLayoutField(setForm, 'panelType', value)}
                    options={normaliseOptions(MCC_PANEL_TYPE_OPTIONS)}
                    placeholder="Select panel type"
                    error={panelTypeError}
                    disabled={disabled}
                  />
                </FormField>
      
                {showPanelStructure && (
                  <FormField
                    label="Panel Structure"
                    error={panelStructureError}
                  >
                    <SearchableSelect
                      includeNotApplicable
                      value={layoutPreferences.panelStructure || ''}
                      onChange={(value) => updateLayoutField(setForm, 'panelStructure', value)}
                      options={normaliseOptions(MCC_PANEL_STRUCTURE_OPTIONS)}
                      placeholder="Select panel structure"
                      error={panelStructureError}
                      disabled={disabled}
                    />
                  </FormField>
                )}
      
                <FormField
                  label="Cable Entry (MV/LV)"
                  error={cableEntryMvLvError}
                >
                  <SearchableSelect
                    includeNotApplicable
                    value={layoutPreferences.cableEntryMvLv || ''}
                    onChange={(value) => updateLayoutField(setForm, 'cableEntryMvLv', value)}
                    options={normaliseOptions(MCC_CABLE_ENTRY_MV_LV_OPTIONS)}
                    placeholder="Select cable entry"
                    error={cableEntryMvLvError}
                    disabled={disabled}
                  />
                </FormField>
      
                <FormField
                  label="Busbar Arrangement"
                  error={busbarArrangementError}
                >
                  <SearchableSelect
                    includeNotApplicable
                    value={layoutPreferences.busbarArrangement || ''}
                    onChange={(value) => updateLayoutField(setForm, 'busbarArrangement', value)}
                    options={normaliseOptions(MCC_BUSBAR_ARRANGEMENT_OPTIONS)}
                    placeholder="Select busbar arrangement"
                    error={busbarArrangementError}
                    disabled={disabled}
                  />
                </FormField>
      
              </div>
            </PanelSubsection>
    </div>
  );

  const engineeringContent = (
    <div className="space-y-4">
      

            <PanelSubsection
              icon={Headphones}
              title="MCC Engineering — Control & Notes"
              subtitle="Define training, warranty and AMC requirements."
              color="green"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <FormField
                  label="Training Required"
                  error={trainingRequiredError}
                >
                  <label
                    className={`flex min-h-[42px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                      notesAndSupport.trainingRequired === 'Yes'
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={notesAndSupport.trainingRequired === 'Yes'}
                      onChange={(event) =>
                        updateSupportField(setForm, 'trainingRequired', event.target.checked ? 'Yes' : 'No')
                      }
                      disabled={disabled}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Required</span>
                  </label>
                </FormField>
      
                <FormField
                  label="Warranty Period (Months)"
                  error={warrantyPeriodMonthsError}
                >
                  <Input
                    type="number"
                    min="0"
                    value={notesAndSupport.warrantyPeriodMonths ?? ''}
                    onChange={(event) =>
                      updateSupportField(setForm, 'warrantyPeriodMonths', event.target.value)
                    }
                    placeholder="Enter warranty months"
                    disabled={disabled}
                    className={warrantyPeriodMonthsError ? 'border-red-400 focus:ring-red-400' : ''}
                  />
                </FormField>
      
                <FormField
                  label="AMC Required After Warranty"
                  error={amcRequiredAfterWarrantyError}
                >
                  <label
                    className={`flex min-h-[42px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                      notesAndSupport.amcRequiredAfterWarranty === 'Yes'
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={notesAndSupport.amcRequiredAfterWarranty === 'Yes'}
                      onChange={(event) =>
                        updateSupportField(
                          setForm,
                          'amcRequiredAfterWarranty',
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
                  label="Additional Comments / Remarks"
                  error={additionalCommentsError}
                  className="md:col-span-2 xl:col-span-3"
                >
                  <Textarea
                    value={notesAndSupport.additionalComments || ''}
                    onChange={(event) =>
                      updateSupportField(setForm, 'additionalComments', event.target.value)
                    }
                    placeholder="Enter additional MCC comments / remarks"
                    disabled={disabled}
                    rows={4}
                    className={additionalCommentsError ? 'border-red-400 focus:ring-red-400' : ''}
                  />
                </FormField>
              </div>
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
                        notesAndSupport.onsiteSupportRequired === 'Required'
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={notesAndSupport.onsiteSupportRequired === 'Required'}
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
                        value={notesAndSupport.onsiteSupportDays ?? ''}
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
                        notesAndSupport.commissioningSupportRequired === 'Required'
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={notesAndSupport.commissioningSupportRequired === 'Required'}
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
                        value={notesAndSupport.commissioningSupportDays ?? ''}
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

export default MccInquirySections;
