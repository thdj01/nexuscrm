import React from 'react';
import { Network } from 'lucide-react';

import {
  SectionCard,
  FormField,
  Input,
  SearchableSelect,
} from '../../common/FormComponents.extended';

import MainIncomerSection from './MainIncomerSection';

import {
  RIO_PROTOCOL_OPTIONS,
  RIO_NETWORK_MEDIUM_OPTIONS,
  RIO_TOPOLOGY_OPTIONS,
  RIO_ENCLOSURE_MATERIAL_OPTIONS,
  RIO_IP_RATING_OPTIONS,
  RIO_AREA_CLASSIFICATION_OPTIONS,
  RIO_POWER_SUPPLY_OPTIONS,
  RIO_REDUNDANCY_OPTIONS,
  RIO_MOUNTING_OPTIONS,
  RIO_CABLE_ENTRY_OPTIONS,
  RIO_YES_NO_OPTIONS,
  RIO_IO_SIGNAL_ROWS,
  defaultRioBoxDetails,
} from '../../../data/inquiryMasterData';

import {
  emptyMainIncomerDetails,
  getMainIncomerValueSignature,
  getPanelMainIncomerDetails,
  getSameAsAboveSourcePanelType,
  setPanelMainIncomerDetails,
} from '../../../utils/mainIncomerUtils';

const getError = (errors = {}, key = '') => errors?.[key] || '';

const Subsection = ({ title, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
    <h4 className="mb-4 text-sm font-semibold text-slate-800">{title}</h4>
    {children}
  </div>
);

const toNonNegativeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const getSelectedCapacity = (row = {}) => {
  const requiredQty = toNonNegativeNumber(row.requiredQty, 0);
  const sparePercentRaw = toNonNegativeNumber(row.sparePercent, 0);
  const sparePercent = sparePercentRaw > 0 && sparePercentRaw < 1
    ? sparePercentRaw * 100
    : sparePercentRaw;
  return Math.ceil(requiredQty * (1 + (sparePercent / 100)));
};

const RioBoxInquirySection = ({
  form,
  setForm,
  errors = {},
  disabled = false,
  number,
  sectionIndex,
  activeSection,
  setSectionRef,
}) => {
  const defaults = defaultRioBoxDetails();
  const currentDetails = form?.rioBoxDetails || {};
  const details = {
    ...defaults,
    ...currentDetails,
    mainIncomer: {
      ...defaults.mainIncomer,
      ...(currentDetails.mainIncomer || {}),
      sameAsAbove: Boolean(currentDetails.mainIncomer?.sameAsAbove),
    },
    application: {
      ...defaults.application,
      ...(currentDetails.application || {}),
    },
    enclosureConditions: {
      ...defaults.enclosureConditions,
      ...(currentDetails.enclosureConditions || {}),
    },
    accessories: {
      ...defaults.accessories,
      ...(currentDetails.accessories || {}),
    },
  };
  const mainIncomer = details.mainIncomer || {};
  const application = details.application || {};
  const enclosureConditions = details.enclosureConditions || {};
  const accessories = details.accessories || {};
  const ioRequirements = Array.isArray(details.ioRequirements) ? details.ioRequirements : [];
  const sourcePanelType = getSameAsAboveSourcePanelType(form?.panelTypes, 'RIO Box');
  const sourceMainIncomer = getPanelMainIncomerDetails(form, sourcePanelType);
  const sourceMainIncomerSignature = getMainIncomerValueSignature(sourceMainIncomer);
  const showSameAsAbove = Boolean(sourcePanelType);

  React.useEffect(() => {
    if (showSameAsAbove || !mainIncomer.sameAsAbove) return;
    setForm((prev) => setPanelMainIncomerDetails(prev, 'RIO Box', emptyMainIncomerDetails()));
  }, [mainIncomer.sameAsAbove, setForm, showSameAsAbove]);

  React.useEffect(() => {
    if (!mainIncomer.sameAsAbove || !sourcePanelType) return;

    setForm((prev) => {
      const latestSourcePanelType = getSameAsAboveSourcePanelType(prev?.panelTypes, 'RIO Box');
      if (!latestSourcePanelType) {
        return setPanelMainIncomerDetails(prev, 'RIO Box', emptyMainIncomerDetails());
      }

      return setPanelMainIncomerDetails(prev, 'RIO Box', {
        ...getPanelMainIncomerDetails(prev, latestSourcePanelType),
        sameAsAbove: true,
      });
    });
  }, [mainIncomer.sameAsAbove, sourceMainIncomerSignature, sourcePanelType, setForm]);

  const updateMainIncomerField = (field, value, additionalChanges = {}) => {
    setForm((prev) => setPanelMainIncomerDetails(prev, 'RIO Box', {
      ...getPanelMainIncomerDetails(prev, 'RIO Box'),
      [field]: value,
      ...additionalChanges,
    }));
  };

  const handleSameAsAboveChange = (checked) => {
    setForm((prev) => {
      const latestSourcePanelType = getSameAsAboveSourcePanelType(prev?.panelTypes, 'RIO Box');

      if (!checked || !latestSourcePanelType) {
        return setPanelMainIncomerDetails(prev, 'RIO Box', emptyMainIncomerDetails());
      }

      return setPanelMainIncomerDetails(prev, 'RIO Box', {
        ...getPanelMainIncomerDetails(prev, latestSourcePanelType),
        sameAsAbove: true,
      });
    });
  };

  const updateField = (group, field, value) => {
    setForm((prev) => ({
      ...prev,
      rioBoxDetails: {
        ...(prev.rioBoxDetails || {}),
        [group]: {
          ...((prev.rioBoxDetails || {})[group] || {}),
          [field]: value,
        },
      },
    }));
  };

  const updateIoRow = (key, field, value) => {
    setForm((prev) => {
      const currentRows = Array.isArray(prev.rioBoxDetails?.ioRequirements)
        ? prev.rioBoxDetails.ioRequirements
        : [];

      const nextRows = RIO_IO_SIGNAL_ROWS.map((definition) => {
        const current = currentRows.find((row) => row.key === definition.key) || definition;
        return definition.key === key
          ? { ...current, ...definition, [field]: value }
          : { ...definition, ...current };
      });

      return {
        ...prev,
        rioBoxDetails: {
          ...(prev.rioBoxDetails || {}),
          ioRequirements: nextRows,
        },
      };
    });
  };

  const normalizedIoRows = RIO_IO_SIGNAL_ROWS.map((definition) => ({
    ...definition,
    ...(ioRequirements.find((row) => row.key === definition.key) || {}),
  }));

  const totalCapacity = normalizedIoRows.reduce(
    (total, row) => total + getSelectedCapacity(row),
    0
  );

  return (
    <div ref={(el) => setSectionRef?.(sectionIndex, el)}>
      <SectionCard
        number={String(number)}
        title="RIO Box Selection"
        subtitle="Dedicated inquiry-stage form for preliminary RIO box selection, estimation and quotation."
        icon={Network}
        color="indigo"
        active={activeSection === sectionIndex}
      >
        <div className="space-y-5">
          <MainIncomerSection
            details={mainIncomer}
            onFieldChange={updateMainIncomerField}
            errors={errors}
            errorPrefix="rioBoxDetails.mainIncomer"
            disabled={disabled}
            fieldsDisabled={disabled || Boolean(mainIncomer.sameAsAbove)}
            showSameAsAbove={showSameAsAbove}
            sameAsAbove={mainIncomer.sameAsAbove}
            onSameAsAboveChange={handleSameAsAboveChange}
          />

          <Subsection title="RIO Box Application">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <FormField label="RIO Box Tag / Name">
                <Input
                  value={application.tagName || ''}
                  onChange={(event) => updateField('application', 'tagName', event.target.value)}
                  placeholder="Enter RIO box tag / name"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Plant Area / Location">
                <Input
                  value={application.plantAreaLocation || ''}
                  onChange={(event) => updateField('application', 'plantAreaLocation', event.target.value)}
                  placeholder="Enter plant area / location"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Mounting" required error={getError(errors, 'rioBoxDetails.application.mounting')}>
                <SearchableSelect
                  includeNotApplicable
                  value={application.mounting || ''}
                  onChange={(value) => updateField('application', 'mounting', value)}
                  options={RIO_MOUNTING_OPTIONS}
                  placeholder="Select mounting"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Main PLC / DCS Make">
                <Input
                  value={application.mainPlcDcsMake || ''}
                  onChange={(event) => updateField('application', 'mainPlcDcsMake', event.target.value)}
                  placeholder="Enter PLC / DCS make"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="PLC / DCS Model">
                <Input
                  value={application.plcDcsModel || ''}
                  onChange={(event) => updateField('application', 'plcDcsModel', event.target.value)}
                  placeholder="Enter PLC / DCS model"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="System Voltage" required error={getError(errors, 'rioBoxDetails.application.systemVoltage')}>
                <SearchableSelect
                  includeNotApplicable
                  value={application.systemVoltage || ''}
                  onChange={(value) => updateField('application', 'systemVoltage', value)}
                  options={RIO_POWER_SUPPLY_OPTIONS}
                  placeholder="Select system voltage"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Communication Protocol" required error={getError(errors, 'rioBoxDetails.application.communicationProtocol')}>
                <SearchableSelect
                  includeNotApplicable
                  value={application.communicationProtocol || ''}
                  onChange={(value) => updateField('application', 'communicationProtocol', value)}
                  options={RIO_PROTOCOL_OPTIONS}
                  placeholder="Select protocol"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Network Medium" required error={getError(errors, 'rioBoxDetails.application.networkMedium')}>
                <SearchableSelect
                  includeNotApplicable
                  value={application.networkMedium || ''}
                  onChange={(value) => updateField('application', 'networkMedium', value)}
                  options={RIO_NETWORK_MEDIUM_OPTIONS}
                  placeholder="Select network medium"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Topology" required error={getError(errors, 'rioBoxDetails.application.topology')}>
                <SearchableSelect
                  includeNotApplicable
                  value={application.topology || ''}
                  onChange={(value) => updateField('application', 'topology', value)}
                  options={RIO_TOPOLOGY_OPTIONS}
                  placeholder="Select topology"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Distance from Main PLC">
                <Input
                  value={application.distanceFromMainPlc || ''}
                  onChange={(event) => updateField('application', 'distanceFromMainPlc', event.target.value)}
                  placeholder="Enter distance"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Redundancy Required" required error={getError(errors, 'rioBoxDetails.application.redundancyRequired')}>
                <SearchableSelect
                  includeNotApplicable
                  value={application.redundancyRequired || ''}
                  onChange={(value) => updateField('application', 'redundancyRequired', value)}
                  options={RIO_REDUNDANCY_OPTIONS}
                  placeholder="Select redundancy"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Local HMI Required" required error={getError(errors, 'rioBoxDetails.application.localHmiRequired')}>
                <SearchableSelect
                  includeNotApplicable
                  value={application.localHmiRequired || ''}
                  onChange={(value) => updateField('application', 'localHmiRequired', value)}
                  options={RIO_YES_NO_OPTIONS}
                  placeholder="Select"
                  disabled={disabled}
                />
              </FormField>
            </div>
          </Subsection>

          <Subsection title="I/O Requirement">
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-[900px] w-full border-collapse text-sm">
                <thead className="bg-blue-700 text-white">
                  <tr>
                    <th className="px-3 py-3 text-left font-semibold">Signal Type</th>
                    <th className="w-36 px-3 py-3 text-left font-semibold">Required Qty</th>
                    <th className="w-32 px-3 py-3 text-left font-semibold">Spare %</th>
                    <th className="w-40 px-3 py-3 text-left font-semibold">Selected Capacity</th>
                    <th className="px-3 py-3 text-left font-semibold">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {normalizedIoRows.map((row) => (
                    <tr key={row.key} className="border-t border-slate-200">
                      <td className="px-3 py-3 font-medium text-slate-800">{row.label}</td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="0"
                          value={row.requiredQty ?? 0}
                          onChange={(event) => updateIoRow(
                            row.key,
                            'requiredQty',
                            toNonNegativeNumber(event.target.value, 0)
                          )}
                          disabled={disabled}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={row.sparePercent ?? 20}
                            onChange={(event) => updateIoRow(
                              row.key,
                              'sparePercent',
                              toNonNegativeNumber(event.target.value, 0)
                            )}
                            disabled={disabled}
                            className="pr-8"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={getSelectedCapacity(row)}
                          readOnly
                          className="bg-slate-100 font-semibold text-slate-700"
                          aria-label={`${row.label} selected capacity`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={row.remarks || ''}
                          onChange={(event) => updateIoRow(row.key, 'remarks', event.target.value)}
                          placeholder="Enter remarks"
                          disabled={disabled}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-green-200 bg-green-50">
                  <tr>
                    <td colSpan="3" className="px-3 py-3 text-right font-semibold text-green-900">
                      Total Required I/O Capacity
                    </td>
                    <td className="px-3 py-3 text-lg font-bold text-green-900">{totalCapacity}</td>
                    <td className="px-3 py-3 italic text-green-800">points including spare</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Subsection>

          <Subsection title="Enclosure & Installation Conditions">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <FormField label="Enclosure Material" required error={getError(errors, 'rioBoxDetails.enclosureConditions.enclosureMaterial')}>
                <SearchableSelect
                  includeNotApplicable
                  value={enclosureConditions.enclosureMaterial || ''}
                  onChange={(value) => updateField('enclosureConditions', 'enclosureMaterial', value)}
                  options={RIO_ENCLOSURE_MATERIAL_OPTIONS}
                  placeholder="Select enclosure material"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="IP Rating" required error={getError(errors, 'rioBoxDetails.enclosureConditions.ipRating')}>
                <SearchableSelect
                  includeNotApplicable
                  value={enclosureConditions.ipRating || ''}
                  onChange={(value) => updateField('enclosureConditions', 'ipRating', value)}
                  options={RIO_IP_RATING_OPTIONS}
                  placeholder="Select IP rating"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Area Classification" required error={getError(errors, 'rioBoxDetails.enclosureConditions.areaClassification')}>
                <SearchableSelect
                  includeNotApplicable
                  value={enclosureConditions.areaClassification || ''}
                  onChange={(value) => updateField('enclosureConditions', 'areaClassification', value)}
                  options={RIO_AREA_CLASSIFICATION_OPTIONS}
                  placeholder="Select area classification"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Indoor / Outdoor" required error={getError(errors, 'rioBoxDetails.enclosureConditions.indoorOutdoor')}>
                <SearchableSelect
                  includeNotApplicable
                  value={enclosureConditions.indoorOutdoor || ''}
                  onChange={(value) => updateField('enclosureConditions', 'indoorOutdoor', value)}
                  options={['Indoor', 'Outdoor']}
                  placeholder="Select installation"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Ambient Temperature">
                <Input
                  value={enclosureConditions.ambientTemperature || ''}
                  onChange={(event) => updateField('enclosureConditions', 'ambientTemperature', event.target.value)}
                  placeholder="Example: 0 to 50 °C"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Canopy Required" required error={getError(errors, 'rioBoxDetails.enclosureConditions.canopyRequired')}>
                <SearchableSelect
                  includeNotApplicable
                  value={enclosureConditions.canopyRequired || ''}
                  onChange={(value) => updateField('enclosureConditions', 'canopyRequired', value)}
                  options={RIO_YES_NO_OPTIONS}
                  placeholder="Select"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Cable Entry" required error={getError(errors, 'rioBoxDetails.enclosureConditions.cableEntry')}>
                <SearchableSelect
                  includeNotApplicable
                  value={enclosureConditions.cableEntry || ''}
                  onChange={(value) => updateField('enclosureConditions', 'cableEntry', value)}
                  options={RIO_CABLE_ENTRY_OPTIONS}
                  placeholder="Select cable entry"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Approx. Cable Quantity">
                <Input
                  type="number"
                  min="0"
                  value={enclosureConditions.approximateCableQuantity ?? ''}
                  onChange={(event) => updateField('enclosureConditions', 'approximateCableQuantity', event.target.value)}
                  placeholder="Enter quantity"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Gland Plate Required" required error={getError(errors, 'rioBoxDetails.enclosureConditions.glandPlateRequired')}>
                <SearchableSelect
                  includeNotApplicable
                  value={enclosureConditions.glandPlateRequired || ''}
                  onChange={(value) => updateField('enclosureConditions', 'glandPlateRequired', value)}
                  options={RIO_YES_NO_OPTIONS}
                  placeholder="Select"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Power Supply Available" required error={getError(errors, 'rioBoxDetails.enclosureConditions.powerSupplyAvailable')}>
                <SearchableSelect
                  includeNotApplicable
                  value={enclosureConditions.powerSupplyAvailable || ''}
                  onChange={(value) => updateField('enclosureConditions', 'powerSupplyAvailable', value)}
                  options={RIO_POWER_SUPPLY_OPTIONS}
                  placeholder="Select power supply"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="UPS Supply Available" required error={getError(errors, 'rioBoxDetails.enclosureConditions.upsSupplyAvailable')}>
                <SearchableSelect
                  includeNotApplicable
                  value={enclosureConditions.upsSupplyAvailable || ''}
                  onChange={(value) => updateField('enclosureConditions', 'upsSupplyAvailable', value)}
                  options={RIO_YES_NO_OPTIONS}
                  placeholder="Select"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Space Heater Required" required error={getError(errors, 'rioBoxDetails.enclosureConditions.spaceHeaterRequired')}>
                <SearchableSelect
                  includeNotApplicable
                  value={enclosureConditions.spaceHeaterRequired || ''}
                  onChange={(value) => updateField('enclosureConditions', 'spaceHeaterRequired', value)}
                  options={RIO_YES_NO_OPTIONS}
                  placeholder="Select"
                  disabled={disabled}
                />
              </FormField>
            </div>
          </Subsection>

          <Subsection title="Accessories / Special Requirements">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FormField label="Network Switch" required error={getError(errors, 'rioBoxDetails.accessories.networkSwitch')}>
                <SearchableSelect
                  includeNotApplicable
                  value={accessories.networkSwitch || ''}
                  onChange={(value) => updateField('accessories', 'networkSwitch', value)}
                  options={RIO_YES_NO_OPTIONS}
                  placeholder="Select"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Fiber Converter" required error={getError(errors, 'rioBoxDetails.accessories.fiberConverter')}>
                <SearchableSelect
                  includeNotApplicable
                  value={accessories.fiberConverter || ''}
                  onChange={(value) => updateField('accessories', 'fiberConverter', value)}
                  options={RIO_YES_NO_OPTIONS}
                  placeholder="Select"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="24 VDC Power Supply" required error={getError(errors, 'rioBoxDetails.accessories.powerSupply24Vdc')}>
                <SearchableSelect
                  includeNotApplicable
                  value={accessories.powerSupply24Vdc || ''}
                  onChange={(value) => updateField('accessories', 'powerSupply24Vdc', value)}
                  options={RIO_YES_NO_OPTIONS}
                  placeholder="Select"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Redundant PSU" required error={getError(errors, 'rioBoxDetails.accessories.redundantPsu')}>
                <SearchableSelect
                  includeNotApplicable
                  value={accessories.redundantPsu || ''}
                  onChange={(value) => updateField('accessories', 'redundantPsu', value)}
                  options={RIO_YES_NO_OPTIONS}
                  placeholder="Select"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Marshalling Terminals" required error={getError(errors, 'rioBoxDetails.accessories.marshallingTerminals')}>
                <SearchableSelect
                  includeNotApplicable
                  value={accessories.marshallingTerminals || ''}
                  onChange={(value) => updateField('accessories', 'marshallingTerminals', value)}
                  options={RIO_YES_NO_OPTIONS}
                  placeholder="Select"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Interposing Relays" required error={getError(errors, 'rioBoxDetails.accessories.interposingRelays')}>
                <SearchableSelect
                  includeNotApplicable
                  value={accessories.interposingRelays || ''}
                  onChange={(value) => updateField('accessories', 'interposingRelays', value)}
                  options={['Yes', 'No', 'As Required']}
                  placeholder="Select"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Intrinsic Safety Barriers" required error={getError(errors, 'rioBoxDetails.accessories.intrinsicSafetyBarriers')}>
                <SearchableSelect
                  includeNotApplicable
                  value={accessories.intrinsicSafetyBarriers || ''}
                  onChange={(value) => updateField('accessories', 'intrinsicSafetyBarriers', value)}
                  options={RIO_YES_NO_OPTIONS}
                  placeholder="Select"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Local Isolator" required error={getError(errors, 'rioBoxDetails.accessories.localIsolator')}>
                <SearchableSelect
                  includeNotApplicable
                  value={accessories.localIsolator || ''}
                  onChange={(value) => updateField('accessories', 'localIsolator', value)}
                  options={RIO_YES_NO_OPTIONS}
                  placeholder="Select"
                  disabled={disabled}
                />
              </FormField>
            </div>
          </Subsection>
        </div>
      </SectionCard>
    </div>
  );
};

export default RioBoxInquirySection;
