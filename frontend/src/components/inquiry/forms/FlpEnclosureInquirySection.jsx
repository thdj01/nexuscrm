import React from 'react';
import { ShieldCheck } from 'lucide-react';

import {
  SectionCard,
  FormField,
  Input,
  Textarea,
  SearchableSelect,
} from '../../common/FormComponents.extended';

import {
  FLP_ENCLOSURE_TYPE_OPTIONS,
  FLP_MATERIAL_OPTIONS,
  FLP_IP_RATING_OPTIONS,
  FLP_YES_NO_OPTIONS,
  FLP_MOUNTING_OPTIONS,
  FLP_ZONE_DIVISION_OPTIONS,
  FLP_GAS_GROUP_OPTIONS,
  FLP_TEMPERATURE_CLASS_OPTIONS,
  FLP_CERTIFICATION_OPTIONS,
  INSTALLATION_TYPE_OPTIONS,
} from '../../../data/inquiryMasterData';

const Subsection = ({ title, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
    <h4 className="mb-4 text-sm font-semibold text-slate-800">{title}</h4>
    {children}
  </div>
);

const getError = (errors = {}, path = '') => errors?.[path] || '';

const FlpEnclosureInquirySection = ({
  form,
  setForm,
  errors = {},
  disabled = false,
  number,
  sectionIndex,
  activeSection,
  setSectionRef,
}) => {
  const details = form?.flpEnclosureDetails || {};

  const updateField = (group, field, value) => {
    setForm((prev) => ({
      ...prev,
      flpEnclosureDetails: {
        ...(prev.flpEnclosureDetails || {}),
        [group]: {
          ...((prev.flpEnclosureDetails || {})[group] || {}),
          [field]: value,
        },
      },
    }));
  };

  const group = (key) => details?.[key] || {};

  return (
    <div ref={(el) => setSectionRef?.(sectionIndex, el)}>
      <SectionCard
        number={String(number)}
        title="Weatherproof / FLP Enclosure Selection"
        subtitle="Dedicated enclosure inquiry-stage selection form for weatherproof and flameproof applications."
        icon={ShieldCheck}
        color="purple"
        active={activeSection === sectionIndex}
      >
        <div className="space-y-5">
          <Subsection title="Enclosure Type Selection">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <FormField
                label="Enclosure Type"
                error={getError(errors, 'flpEnclosureDetails.enclosureSelection.enclosureType')}
              >
                <SearchableSelect
                  value={group('enclosureSelection').enclosureType || ''}
                  onChange={(value) => updateField('enclosureSelection', 'enclosureType', value)}
                  options={FLP_ENCLOSURE_TYPE_OPTIONS}
                  placeholder="Select enclosure type"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Application">
                <Input
                  value={group('enclosureSelection').application || ''}
                  onChange={(event) => updateField('enclosureSelection', 'application', event.target.value)}
                  placeholder="Enter application"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Installation">
                <SearchableSelect
                  value={group('enclosureSelection').installation || ''}
                  onChange={(value) => updateField('enclosureSelection', 'installation', value)}
                  options={INSTALLATION_TYPE_OPTIONS}
                  placeholder="Select installation"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Hazardous Area">
                <SearchableSelect
                  value={group('enclosureSelection').hazardousArea || ''}
                  onChange={(value) => updateField('enclosureSelection', 'hazardousArea', value)}
                  options={FLP_YES_NO_OPTIONS}
                  placeholder="Select"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Outdoor Installation">
                <SearchableSelect
                  value={group('enclosureSelection').outdoorInstallation || ''}
                  onChange={(value) => updateField('enclosureSelection', 'outdoorInstallation', value)}
                  options={FLP_YES_NO_OPTIONS}
                  placeholder="Select"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Remarks">
                <Input
                  value={group('enclosureSelection').remarks || ''}
                  onChange={(event) => updateField('enclosureSelection', 'remarks', event.target.value)}
                  placeholder="Enter remarks"
                  disabled={disabled}
                />
              </FormField>
            </div>
          </Subsection>

          <Subsection title="Common Technical Details">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <FormField label="Equipment Mounted">
                <Input
                  value={group('commonTechnical').equipmentMounted || ''}
                  onChange={(event) => updateField('commonTechnical', 'equipmentMounted', event.target.value)}
                  placeholder="Enter equipment mounted"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Make / Model">
                <Input
                  value={group('commonTechnical').makeModel || ''}
                  onChange={(event) => updateField('commonTechnical', 'makeModel', event.target.value)}
                  placeholder="Enter make / model"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Voltage">
                <Input
                  value={group('commonTechnical').voltage || ''}
                  onChange={(event) => updateField('commonTechnical', 'voltage', event.target.value)}
                  placeholder="Enter voltage"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Current Rating">
                <Input
                  value={group('commonTechnical').currentRating || ''}
                  onChange={(event) => updateField('commonTechnical', 'currentRating', event.target.value)}
                  placeholder="Enter current rating"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Control Voltage">
                <Input
                  value={group('commonTechnical').controlVoltage || ''}
                  onChange={(event) => updateField('commonTechnical', 'controlVoltage', event.target.value)}
                  placeholder="Enter control voltage"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Cable Entry Direction">
                <Input
                  value={group('commonTechnical').cableEntryDirection || ''}
                  onChange={(event) => updateField('commonTechnical', 'cableEntryDirection', event.target.value)}
                  placeholder="Enter cable entry direction"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Gland Type">
                <Input
                  value={group('commonTechnical').glandType || ''}
                  onChange={(event) => updateField('commonTechnical', 'glandType', event.target.value)}
                  placeholder="Enter gland type"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Ambient Temperature">
                <Input
                  value={group('commonTechnical').ambientTemperature || ''}
                  onChange={(event) => updateField('commonTechnical', 'ambientTemperature', event.target.value)}
                  placeholder="Example: 0 to 50 °C"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Humidity">
                <Input
                  value={group('commonTechnical').humidity || ''}
                  onChange={(event) => updateField('commonTechnical', 'humidity', event.target.value)}
                  placeholder="Enter humidity"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Corrosive Atmosphere">
                <SearchableSelect
                  value={group('commonTechnical').corrosiveAtmosphere || ''}
                  onChange={(value) => updateField('commonTechnical', 'corrosiveAtmosphere', value)}
                  options={FLP_YES_NO_OPTIONS}
                  placeholder="Select"
                  disabled={disabled}
                />
              </FormField>
            </div>
          </Subsection>

          <Subsection title="Weatherproof Enclosure Details">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <FormField label="Material">
                <SearchableSelect
                  value={group('weatherproof').material || ''}
                  onChange={(value) => updateField('weatherproof', 'material', value)}
                  options={FLP_MATERIAL_OPTIONS}
                  placeholder="Select material"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="IP Rating">
                <SearchableSelect
                  value={group('weatherproof').ipRating || ''}
                  onChange={(value) => updateField('weatherproof', 'ipRating', value)}
                  options={FLP_IP_RATING_OPTIONS}
                  placeholder="Select IP rating"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Mounting">
                <SearchableSelect
                  value={group('weatherproof').mounting || ''}
                  onChange={(value) => updateField('weatherproof', 'mounting', value)}
                  options={FLP_MOUNTING_OPTIONS}
                  placeholder="Select mounting"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Door Type">
                <Input
                  value={group('weatherproof').doorType || ''}
                  onChange={(event) => updateField('weatherproof', 'doorType', event.target.value)}
                  placeholder="Enter door type"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Sunshade / Canopy">
                <SearchableSelect
                  value={group('weatherproof').sunshadeCanopy || ''}
                  onChange={(value) => updateField('weatherproof', 'sunshadeCanopy', value)}
                  options={FLP_YES_NO_OPTIONS}
                  placeholder="Select"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Make / Model">
                <Input
                  value={group('weatherproof').makeModel || ''}
                  onChange={(event) => updateField('weatherproof', 'makeModel', event.target.value)}
                  placeholder="Enter make / model"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Thermostat">
                <SearchableSelect
                  value={group('weatherproof').thermostat || ''}
                  onChange={(value) => updateField('weatherproof', 'thermostat', value)}
                  options={FLP_YES_NO_OPTIONS}
                  placeholder="Select"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Window Required">
                <SearchableSelect
                  value={group('weatherproof').windowRequired || ''}
                  onChange={(value) => updateField('weatherproof', 'windowRequired', value)}
                  options={FLP_YES_NO_OPTIONS}
                  placeholder="Select"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Breather Drain">
                <SearchableSelect
                  value={group('weatherproof').breatherDrain || ''}
                  onChange={(value) => updateField('weatherproof', 'breatherDrain', value)}
                  options={FLP_YES_NO_OPTIONS}
                  placeholder="Select"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Painting / RAL">
                <Input
                  value={group('weatherproof').paintingRal || ''}
                  onChange={(event) => updateField('weatherproof', 'paintingRal', event.target.value)}
                  placeholder="Enter painting / RAL"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Corrosion Class">
                <Input
                  value={group('weatherproof').corrosionClass || ''}
                  onChange={(event) => updateField('weatherproof', 'corrosionClass', event.target.value)}
                  placeholder="Enter corrosion class"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Special Requirement" className="md:col-span-2 xl:col-span-3">
                <Textarea
                  value={group('weatherproof').specialRequirement || ''}
                  onChange={(event) => updateField('weatherproof', 'specialRequirement', event.target.value)}
                  placeholder="Enter special requirement"
                  disabled={disabled}
                  rows={3}
                />
              </FormField>
            </div>
          </Subsection>

          <Subsection title="Flameproof (FLP) Enclosure Details">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <FormField label="Area Classification">
                <SearchableSelect
                  value={group('flameproof').areaClassification || ''}
                  onChange={(value) => updateField('flameproof', 'areaClassification', value)}
                  options={['Safe Area', 'Hazardous Area']}
                  placeholder="Select area classification"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Zone / Division">
                <SearchableSelect
                  value={group('flameproof').zoneDivision || ''}
                  onChange={(value) => updateField('flameproof', 'zoneDivision', value)}
                  options={FLP_ZONE_DIVISION_OPTIONS}
                  placeholder="Select zone / division"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Gas Group">
                <SearchableSelect
                  value={group('flameproof').gasGroup || ''}
                  onChange={(value) => updateField('flameproof', 'gasGroup', value)}
                  options={FLP_GAS_GROUP_OPTIONS}
                  placeholder="Select gas group"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Temperature Class">
                <SearchableSelect
                  value={group('flameproof').temperatureClass || ''}
                  onChange={(value) => updateField('flameproof', 'temperatureClass', value)}
                  options={FLP_TEMPERATURE_CLASS_OPTIONS}
                  placeholder="Select temperature class"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Gas Name">
                <Input
                  value={group('flameproof').gasName || ''}
                  onChange={(event) => updateField('flameproof', 'gasName', event.target.value)}
                  placeholder="Enter gas name"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Certification">
                <SearchableSelect
                  value={group('flameproof').certification || ''}
                  onChange={(value) => updateField('flameproof', 'certification', value)}
                  options={FLP_CERTIFICATION_OPTIONS}
                  placeholder="Select certification"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Protection Concept">
                <Input
                  value={group('flameproof').protectionConcept || ''}
                  onChange={(event) => updateField('flameproof', 'protectionConcept', event.target.value)}
                  placeholder="Example: Ex d / Ex e"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Material">
                <SearchableSelect
                  value={group('flameproof').material || ''}
                  onChange={(value) => updateField('flameproof', 'material', value)}
                  options={FLP_MATERIAL_OPTIONS}
                  placeholder="Select material"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="IP Rating">
                <SearchableSelect
                  value={group('flameproof').ipRating || ''}
                  onChange={(value) => updateField('flameproof', 'ipRating', value)}
                  options={FLP_IP_RATING_OPTIONS}
                  placeholder="Select IP rating"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Internal Device">
                <Input
                  value={group('flameproof').internalDevice || ''}
                  onChange={(event) => updateField('flameproof', 'internalDevice', event.target.value)}
                  placeholder="Enter internal device"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Make / Model">
                <Input
                  value={group('flameproof').makeModel || ''}
                  onChange={(event) => updateField('flameproof', 'makeModel', event.target.value)}
                  placeholder="Enter make / model"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Breather">
                <SearchableSelect
                  value={group('flameproof').breather || ''}
                  onChange={(value) => updateField('flameproof', 'breather', value)}
                  options={FLP_YES_NO_OPTIONS}
                  placeholder="Select"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Window Required">
                <SearchableSelect
                  value={group('flameproof').windowRequired || ''}
                  onChange={(value) => updateField('flameproof', 'windowRequired', value)}
                  options={FLP_YES_NO_OPTIONS}
                  placeholder="Select"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="No. of Glands">
                <Input
                  type="number"
                  min="0"
                  value={group('flameproof').numberOfGlands ?? ''}
                  onChange={(event) => updateField('flameproof', 'numberOfGlands', event.target.value)}
                  placeholder="Enter quantity"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Cable Type">
                <Input
                  value={group('flameproof').cableType || ''}
                  onChange={(event) => updateField('flameproof', 'cableType', event.target.value)}
                  placeholder="Enter cable type"
                  disabled={disabled}
                />
              </FormField>
            </div>
          </Subsection>

          <Subsection title="Preliminary Engineering Summary">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <FormField label="Selected Enclosure Type">
                <SearchableSelect
                  value={group('preliminarySummary').selectedEnclosureType || ''}
                  onChange={(value) => updateField('preliminarySummary', 'selectedEnclosureType', value)}
                  options={FLP_ENCLOSURE_TYPE_OPTIONS}
                  placeholder="Select enclosure type"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Material">
                <SearchableSelect
                  value={group('preliminarySummary').material || ''}
                  onChange={(value) => updateField('preliminarySummary', 'material', value)}
                  options={FLP_MATERIAL_OPTIONS}
                  placeholder="Select material"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="IP Rating">
                <SearchableSelect
                  value={group('preliminarySummary').ipRating || ''}
                  onChange={(value) => updateField('preliminarySummary', 'ipRating', value)}
                  options={FLP_IP_RATING_OPTIONS}
                  placeholder="Select IP rating"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Area Requirement">
                <Input
                  value={group('preliminarySummary').areaRequirement || ''}
                  onChange={(event) => updateField('preliminarySummary', 'areaRequirement', event.target.value)}
                  placeholder="Enter area requirement"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Size Requirement">
                <Input
                  value={group('preliminarySummary').sizeRequirement || ''}
                  onChange={(event) => updateField('preliminarySummary', 'sizeRequirement', event.target.value)}
                  placeholder="Enter size requirement"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Remarks">
                <Input
                  value={group('preliminarySummary').remarks || ''}
                  onChange={(event) => updateField('preliminarySummary', 'remarks', event.target.value)}
                  placeholder="Enter remarks"
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

export default FlpEnclosureInquirySection;
