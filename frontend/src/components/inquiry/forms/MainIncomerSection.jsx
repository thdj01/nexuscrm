import React from 'react';
import { PlugZap } from 'lucide-react';

import {
  FormField,
  Input,
  SearchableSelect,
} from '../../common/FormComponents.extended';

import {
  VOLTAGE_OPTIONS,
  SHORT_CIRCUIT_OPTIONS,
} from '../../../data/masterData';

const MAIN_INCOMER_TYPE_OPTIONS = ['MCB', 'MCCB', 'ACB'];
const POLE_OPTIONS = ['1-Pole', '2-Pole', '3-Pole', '4-Pole'];
const FREQUENCY_OPTIONS = ['50 Hz', '60 Hz'];
const MAKE_OPTIONS = ['Siemens', 'Schneider', 'L&K', 'ABB', 'Other'];

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

const KA_RATING_OPTIONS = Array.from(new Set(
  (Array.isArray(SHORT_CIRCUIT_OPTIONS) ? SHORT_CIRCUIT_OPTIONS : [])
    .map((option) => String(option || '').replace(/\s*\/\s*1\s*sec/gi, '').trim())
    .filter(Boolean)
));

const normaliseOptions = (options = []) => options.map((option) => (
  typeof option === 'string' ? { value: option, label: option } : option
));

const isOtherValue = (value) => String(value || '').trim().toUpperCase() === 'OTHER';
const getError = (errors = {}, key = '') => errors?.[key] || '';

const MainIncomerSection = ({
  details = {},
  onFieldChange,
  errors = {},
  errorPrefix,
  disabled = false,
  fieldsDisabled,
  showSameAsAbove = false,
  sameAsAbove = false,
  onSameAsAboveChange,
}) => {
  const errorKey = (field) => `${errorPrefix}.${field}`;
  const fieldDisabled = fieldsDisabled ?? disabled;
  const datalistId = `${String(errorPrefix || 'main-incomer').replace(/[^a-z0-9]+/gi, '-')}-ka-options`;
  const makeOptions = Array.from(new Set([
    ...MAKE_OPTIONS,
    ...(!isOtherValue(details.make) && details.make ? [details.make] : []),
  ].filter(Boolean)));
  const kaRatingOptions = Array.from(new Set([
    ...KA_RATING_OPTIONS,
    ...(details.kaRating ? [details.kaRating] : []),
  ].filter(Boolean)));

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-white/90 p-2 text-amber-700 shadow-sm">
            <PlugZap size={18} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Main Incomer</h4>
            <p className="mt-0.5 text-xs text-gray-500">
              Define incoming protection, supply and control feeder requirements.
            </p>
          </div>
        </div>

        {showSameAsAbove && (
          <label
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              sameAsAbove
                ? 'border-amber-400 bg-amber-100 text-amber-800'
                : 'border-amber-200 bg-white text-slate-700 hover:border-amber-300'
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <input
              type="checkbox"
              checked={Boolean(sameAsAbove)}
              onChange={(event) => onSameAsAboveChange?.(event.target.checked)}
              disabled={disabled}
              className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
            />
            <span>Same as Above</span>
          </label>
        )}
      </div>

      <div className="rounded-xl bg-white/85 p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <FormField
            label="Main Incomer Type"
            required
            error={getError(errors, errorKey('mainIncomerType'))}
          >
            <SearchableSelect
              includeNotApplicable
              value={details.mainIncomerType || ''}
              onChange={(value) => onFieldChange?.('mainIncomerType', value)}
              options={normaliseOptions(MAIN_INCOMER_TYPE_OPTIONS)}
              placeholder="Select incomer type"
              disabled={fieldDisabled}
              error={getError(errors, errorKey('mainIncomerType'))}
            />
          </FormField>

          <FormField
            label="Supply Voltage"
            required
            error={getError(errors, errorKey('supplyVoltage'))}
          >
            <SearchableSelect
              includeNotApplicable
              value={details.supplyVoltage || ''}
              onChange={(value) => onFieldChange?.(
                'supplyVoltage',
                value,
                { customSupplyVoltage: value === 'Custom' ? details.customSupplyVoltage || '' : '' }
              )}
              options={normaliseOptions(SUPPLY_VOLTAGE_OPTIONS)}
              placeholder="Select supply voltage"
              disabled={fieldDisabled}
              error={getError(errors, errorKey('supplyVoltage'))}
            />
          </FormField>

          {details.supplyVoltage === 'Custom' && (
            <FormField
              label="Custom Supply Voltage"
              required
              error={getError(errors, errorKey('customSupplyVoltage'))}
            >
              <Input
                value={details.customSupplyVoltage || ''}
                onChange={(event) => onFieldChange?.('customSupplyVoltage', event.target.value)}
                placeholder="Enter custom supply voltage"
                disabled={fieldDisabled}
              />
            </FormField>
          )}

          <FormField
            label="Pole"
            required
            error={getError(errors, errorKey('pole'))}
          >
            <SearchableSelect
              includeNotApplicable
              value={details.pole || ''}
              onChange={(value) => onFieldChange?.('pole', value)}
              options={normaliseOptions(POLE_OPTIONS)}
              placeholder="Select pole"
              disabled={fieldDisabled}
              error={getError(errors, errorKey('pole'))}
            />
          </FormField>

          <FormField
            label="Frequency"
            required
            error={getError(errors, errorKey('frequency'))}
          >
            <SearchableSelect
              includeNotApplicable
              value={details.frequency || ''}
              onChange={(value) => onFieldChange?.('frequency', value)}
              options={normaliseOptions(FREQUENCY_OPTIONS)}
              placeholder="Select frequency"
              disabled={fieldDisabled}
              error={getError(errors, errorKey('frequency'))}
            />
          </FormField>

          <FormField
            label="Make"
            required
            error={getError(errors, errorKey('make'))}
          >
            <SearchableSelect
              includeNotApplicable
              value={details.make || ''}
              onChange={(value) => onFieldChange?.(
                'make',
                value,
                { customMake: isOtherValue(value) ? details.customMake || '' : '' }
              )}
              options={normaliseOptions(makeOptions)}
              placeholder="Select make"
              disabled={fieldDisabled}
              error={getError(errors, errorKey('make'))}
            />
          </FormField>

          {isOtherValue(details.make) && (
            <FormField
              label="Other Make"
              required
              error={getError(errors, errorKey('customMake'))}
            >
              <Input
                value={details.customMake || ''}
                onChange={(event) => onFieldChange?.('customMake', event.target.value)}
                placeholder="Enter custom make"
                disabled={fieldDisabled}
              />
            </FormField>
          )}

          <FormField
            label="kA Rating"
            required
            error={getError(errors, errorKey('kaRating'))}
          >
            <Input
              list={datalistId}
              value={details.kaRating || ''}
              onChange={(event) => onFieldChange?.('kaRating', event.target.value)}
              placeholder="Select or enter kA rating"
              disabled={fieldDisabled}
            />
            <datalist id={datalistId}>
              {kaRatingOptions.map((option) => <option key={option} value={option} />)}
            </datalist>
          </FormField>

          <FormField
            label="Control Feeder"
            required
            error={getError(errors, errorKey('controlFeeder'))}
          >
            <Input
              value={details.controlFeeder || ''}
              onChange={(event) => onFieldChange?.('controlFeeder', event.target.value)}
              placeholder="Enter control feeder details"
              disabled={fieldDisabled}
            />
          </FormField>
        </div>
      </div>
    </div>
  );
};

export default MainIncomerSection;
