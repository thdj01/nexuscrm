import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ShieldCheck } from 'lucide-react';

import {
  SectionCard,
  FormField,
  Input,
  Textarea,
  SearchableSelect,
} from '../../common/FormComponents.extended';

import {
  FLP_MATERIAL_OPTIONS,
  FLP_IP_RATING_OPTIONS,
  FLP_MOUNTING_OPTIONS,
  FLP_ZONE_DIVISION_OPTIONS,
  FLP_GAS_GROUP_OPTIONS,
  FLP_TEMPERATURE_CLASS_OPTIONS,
  FLP_CERTIFICATION_OPTIONS,
} from '../../../data/inquiryMasterData';

const NOT_APPLICABLE = 'NA - Not Applicable';
const getError = (errors = {}, key = '') => errors?.[key] || '';

const Subsection = ({ title, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
    <h4 className="mb-4 text-sm font-semibold text-slate-800">
      {title}
    </h4>

    {children}
  </div>
);

const normalizeMultiValue = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (!value) {
    return [];
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const MultiSelectDropdown = ({
  values,
  options,
  onChange,
  disabled = false,
  placeholder = 'Select one or more options',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selected = normalizeMultiValue(values);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutsideClick
      );
    };
  }, []);

  const toggleOption = (option) => {
    if (disabled) {
      return;
    }

    /*
     * NA is treated as an exclusive option.
     * Selecting NA removes every other selection.
     */
    if (option === NOT_APPLICABLE) {
      onChange(
        selected.includes(NOT_APPLICABLE)
          ? []
          : [NOT_APPLICABLE]
      );

      return;
    }

    const selectedWithoutNA = selected.filter(
      (item) => item !== NOT_APPLICABLE
    );

    const nextValues = selectedWithoutNA.includes(option)
      ? selectedWithoutNA.filter((item) => item !== option)
      : [...selectedWithoutNA, option];

    onChange(nextValues);
  };

  const selectedText = selected.length
    ? selected.join(', ')
    : placeholder;

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current);
          }
        }}
        className={[
          'flex min-h-[42px] w-full items-center',
          'justify-between gap-2 rounded-lg border',
          'bg-white px-3 py-2 text-left text-base',
          'focus:outline-none focus:ring-2',
          'focus:ring-purple-500 sm:text-sm',
          disabled
            ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
            : 'border-gray-300 text-gray-800',
        ].join(' ')}
      >
        <span
          className={[
            'min-w-0 flex-1 truncate',
            selected.length
              ? 'text-gray-800'
              : 'text-gray-400',
          ].join(' ')}
          title={selectedText}
        >
          {selectedText}
        </span>

        <ChevronDown
          size={16}
          className={[
            'flex-shrink-0 text-gray-400',
            'transition-transform',
            open ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>

      {open && !disabled && (
        <div
          className={[
            'absolute z-[80] mt-1 w-full',
            'min-w-[260px] overflow-hidden',
            'rounded-lg border border-gray-200',
            'bg-white shadow-xl',
          ].join(' ')}
        >
          <div
            className="max-h-64 overflow-y-auto p-1.5"
            role="listbox"
            aria-multiselectable="true"
          >
            {options.map((option) => {
              const checked = selected.includes(option);

              return (
                <label
                  key={option}
                  className={[
                    'flex cursor-pointer items-center',
                    'gap-2 rounded-md px-3 py-2',
                    'text-sm transition-colors',
                    checked
                      ? 'bg-purple-50 font-medium text-purple-700'
                      : 'text-gray-700 hover:bg-gray-50',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOption(option)}
                    className={[
                      'h-4 w-4 rounded',
                      'border-gray-300 text-purple-600',
                      'focus:ring-purple-500',
                    ].join(' ')}
                  />

                  <span className="min-w-0 flex-1">
                    {option}
                  </span>

                  {checked && (
                    <Check
                      size={14}
                      className="flex-shrink-0 text-purple-600"
                    />
                  )}
                </label>
              );
            })}
          </div>

          <div
            className={[
              'flex items-center justify-between',
              'border-t border-gray-100',
              'bg-gray-50 px-3 py-2',
              'text-xs text-gray-500',
            ].join(' ')}
          >
            <span>
              {selected.length} selected
            </span>

            <div className="flex items-center gap-3">
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className={[
                    'font-medium text-gray-600',
                    'hover:text-gray-800',
                  ].join(' ')}
                >
                  Clear
                </button>
              )}

              <button
                type="button"
                onClick={() => setOpen(false)}
                className={[
                  'font-medium text-purple-700',
                  'hover:text-purple-800',
                ].join(' ')}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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

  const updateField = (groupName, fieldName, value) => {
    setForm((previousForm) => ({
      ...previousForm,

      flpEnclosureDetails: {
        ...(previousForm.flpEnclosureDetails || {}),

        [groupName]: {
          ...(
            (
              previousForm.flpEnclosureDetails ||
              {}
            )[groupName] || {}
          ),

          [fieldName]: value,
        },
      },
    }));
  };

  const getGroup = (groupName) => (
    details?.[groupName] || {}
  );

  const commonTechnical = getGroup('commonTechnical');
  const weatherproof = getGroup('weatherproof');
  const flameproof = getGroup('flameproof');

  return (
    <div
      ref={(element) => {
        setSectionRef?.(sectionIndex, element);
      }}
    >
      <SectionCard
        number={String(number)}
        title="Weatherproof / FLP Enclosure Details"
        subtitle={
          'Internal component, weatherproof and flameproof enclosure requirements.'
        }
        icon={ShieldCheck}
        color="purple"
        active={activeSection === sectionIndex}
      >
        <div className="space-y-5">
          {/* Internal Component Technical Details */}
          <Subsection title="Internal Component Technical Details">
            <div
              className={[
                'grid grid-cols-1 gap-x-4 gap-y-4',
                'md:grid-cols-2 xl:grid-cols-3',
              ].join(' ')}
            >
              <FormField label="Equipment Mounted">
                <Input
                  value={
                    commonTechnical.equipmentMounted ||
                    ''
                  }
                  onChange={(event) => {
                    updateField(
                      'commonTechnical',
                      'equipmentMounted',
                      event.target.value
                    );
                  }}
                  placeholder="Enter equipment mounted"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Make / Model">
                <Input
                  value={
                    commonTechnical.makeModel ||
                    ''
                  }
                  onChange={(event) => {
                    updateField(
                      'commonTechnical',
                      'makeModel',
                      event.target.value
                    );
                  }}
                  placeholder="Enter make / model"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Voltage">
                <Input
                  value={
                    commonTechnical.voltage ||
                    ''
                  }
                  onChange={(event) => {
                    updateField(
                      'commonTechnical',
                      'voltage',
                      event.target.value
                    );
                  }}
                  placeholder="Enter voltage"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Current Rating">
                <Input
                  value={
                    commonTechnical.currentRating ||
                    ''
                  }
                  onChange={(event) => {
                    updateField(
                      'commonTechnical',
                      'currentRating',
                      event.target.value
                    );
                  }}
                  placeholder="Enter current rating"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Control Voltage">
                <Input
                  value={
                    commonTechnical.controlVoltage ||
                    ''
                  }
                  onChange={(event) => {
                    updateField(
                      'commonTechnical',
                      'controlVoltage',
                      event.target.value
                    );
                  }}
                  placeholder="Enter control voltage"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Gland Type">
                <Input
                  value={
                    commonTechnical.glandType ||
                    ''
                  }
                  onChange={(event) => {
                    updateField(
                      'commonTechnical',
                      'glandType',
                      event.target.value
                    );
                  }}
                  placeholder="Enter gland type"
                  disabled={disabled}
                />
              </FormField>
            </div>
          </Subsection>

          {/* Weatherproof Enclosure Details */}
          <Subsection title="Weatherproof Enclosure Details">
            <div
              className={[
                'grid grid-cols-1 gap-x-4 gap-y-4',
                'md:grid-cols-2 xl:grid-cols-3',
              ].join(' ')}
            >
              <FormField
                label="Material"
                required
                error={getError(errors, 'flpEnclosureDetails.weatherproof.material')}
              >
                <SearchableSelect
                  includeNotApplicable
                  value={weatherproof.material || ''}
                  onChange={(value) => {
                    updateField(
                      'weatherproof',
                      'material',
                      value
                    );
                  }}
                  options={FLP_MATERIAL_OPTIONS}
                  placeholder="Select material"
                  disabled={disabled}
                />
              </FormField>

              <FormField
                label="IP Rating"
                required
                error={getError(errors, 'flpEnclosureDetails.weatherproof.ipRating')}
              >
                <SearchableSelect
                  includeNotApplicable
                  value={
                    weatherproof.ipRating ||
                    'IP65'
                  }
                  onChange={(value) => {
                    updateField(
                      'weatherproof',
                      'ipRating',
                      value
                    );
                  }}
                  options={FLP_IP_RATING_OPTIONS}
                  placeholder="Select IP rating"
                  disabled={disabled}
                />
              </FormField>

              <FormField
                label="Mounting"
                required
                error={getError(errors, 'flpEnclosureDetails.weatherproof.mounting')}
              >
                <SearchableSelect
                  includeNotApplicable
                  value={weatherproof.mounting || ''}
                  onChange={(value) => {
                    updateField(
                      'weatherproof',
                      'mounting',
                      value
                    );
                  }}
                  options={FLP_MOUNTING_OPTIONS}
                  placeholder="Select mounting"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="Make / Model">
                <Input
                  value={weatherproof.makeModel || ''}
                  onChange={(event) => {
                    updateField(
                      'weatherproof',
                      'makeModel',
                      event.target.value
                    );
                  }}
                  placeholder="Enter make / model"
                  disabled={disabled}
                />
              </FormField>

              <FormField
                label="Window Required"
                required
                error={getError(errors, 'flpEnclosureDetails.weatherproof.windowRequired')}
              >
                <SearchableSelect
                  includeNotApplicable
                  value={
                    weatherproof.windowRequired ||
                    ''
                  }
                  onChange={(value) => {
                    updateField(
                      'weatherproof',
                      'windowRequired',
                      value
                    );
                  }}
                  options={['Yes', 'No']}
                  placeholder="Select"
                  disabled={disabled}
                />
              </FormField>

              <FormField
                label="Special Requirement"
                className="md:col-span-2 xl:col-span-3"
              >
                <Textarea
                  value={
                    weatherproof.specialRequirement ||
                    ''
                  }
                  onChange={(event) => {
                    updateField(
                      'weatherproof',
                      'specialRequirement',
                      event.target.value
                    );
                  }}
                  placeholder="Enter special requirement"
                  disabled={disabled}
                  rows={3}
                />
              </FormField>
            </div>
          </Subsection>

          {/* Flameproof Enclosure Details */}
          <Subsection title="Flameproof (FLP) Enclosure Details">
            <div
              className={[
                'grid grid-cols-1 gap-x-4 gap-y-4',
                'md:grid-cols-2 xl:grid-cols-3',
              ].join(' ')}
            >
              <FormField label="Area Classification">
                <Input
                  value={
                    flameproof.areaClassification ||
                    'Hazardous Area'
                  }
                  onChange={(event) => {
                    updateField(
                      'flameproof',
                      'areaClassification',
                      event.target.value
                    );
                  }}
                  placeholder="Enter area classification"
                  disabled={disabled}
                />
              </FormField>

              <FormField
                label="Zone / Division"
                required
                error={getError(errors, 'flpEnclosureDetails.flameproof.zoneDivision')}
              >
                <MultiSelectDropdown
                  values={flameproof.zoneDivision}
                  options={[
                    ...FLP_ZONE_DIVISION_OPTIONS,
                    NOT_APPLICABLE,
                  ]}
                  onChange={(value) => {
                    updateField(
                      'flameproof',
                      'zoneDivision',
                      value
                    );
                  }}
                  disabled={disabled}
                  placeholder="Select one or more options"
                />
              </FormField>

              <FormField
                label="Gas Group"
                required
                error={getError(errors, 'flpEnclosureDetails.flameproof.gasGroup')}
              >
                <MultiSelectDropdown
                  values={flameproof.gasGroup}
                  options={[
                    ...FLP_GAS_GROUP_OPTIONS,
                    NOT_APPLICABLE,
                  ]}
                  onChange={(value) => {
                    updateField(
                      'flameproof',
                      'gasGroup',
                      value
                    );
                  }}
                  disabled={disabled}
                  placeholder="Select one or more options"
                />
              </FormField>

              <FormField
                label="Temperature Class"
                required
                error={getError(errors, 'flpEnclosureDetails.flameproof.temperatureClass')}
              >
                <SearchableSelect
                  includeNotApplicable
                  value={
                    flameproof.temperatureClass ||
                    ''
                  }
                  onChange={(value) => {
                    updateField(
                      'flameproof',
                      'temperatureClass',
                      value
                    );
                  }}
                  options={
                    FLP_TEMPERATURE_CLASS_OPTIONS
                  }
                  placeholder="Select temperature class"
                  disabled={disabled}
                />
              </FormField>

              <FormField
                label="Certification"
                required
                error={getError(errors, 'flpEnclosureDetails.flameproof.certification')}
              >
                <MultiSelectDropdown
                  values={flameproof.certification}
                  options={[
                    ...FLP_CERTIFICATION_OPTIONS,
                    NOT_APPLICABLE,
                  ]}
                  onChange={(value) => {
                    updateField(
                      'flameproof',
                      'certification',
                      value
                    );
                  }}
                  disabled={disabled}
                  placeholder="Select one or more options"
                />
              </FormField>

              <FormField label="Protection Concept">
                <Input
                  value={
                    flameproof.protectionConcept ||
                    ''
                  }
                  onChange={(event) => {
                    updateField(
                      'flameproof',
                      'protectionConcept',
                      event.target.value
                    );
                  }}
                  placeholder="Example: Ex d / Ex e"
                  disabled={disabled}
                />
              </FormField>

              <FormField
                label="Material"
                required
                error={getError(errors, 'flpEnclosureDetails.flameproof.material')}
              >
                <SearchableSelect
                  includeNotApplicable
                  value={flameproof.material || ''}
                  onChange={(value) => {
                    updateField(
                      'flameproof',
                      'material',
                      value
                    );
                  }}
                  options={FLP_MATERIAL_OPTIONS}
                  placeholder="Select material"
                  disabled={disabled}
                />
              </FormField>

              <FormField
                label="IP Rating"
                required
                error={getError(errors, 'flpEnclosureDetails.flameproof.ipRating')}
              >
                <SearchableSelect
                  includeNotApplicable
                  value={
                    flameproof.ipRating ||
                    'IP65'
                  }
                  onChange={(value) => {
                    updateField(
                      'flameproof',
                      'ipRating',
                      value
                    );
                  }}
                  options={FLP_IP_RATING_OPTIONS}
                  placeholder="Select IP rating"
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