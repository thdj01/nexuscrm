import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Input,
  Button,
} from '../../common/FormComponents.extended';

const EMPTY_ROW = {
  srNo: 1,
  loadDescription: '',
  qty: '',
  ratingKwHp: '',
  fullLoadCurrent: '',
  remarks: '',
};

const DEFAULT_VOLTAGE = 415;
const DEFAULT_POWER_FACTOR = 0.8;

const toFiniteNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[^0-9.-]/g, '').trim();
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const roundToTwo = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '';
  return String(Math.round((parsed + Number.EPSILON) * 100) / 100);
};

const calculateHpFromKw = (kw) => kw * 1.341;
const calculateKwFromHp = (hp) => hp * 0.746;
const calculateAmpereFromKw = (kw) => (
  (kw * 1000) / (1.732 * DEFAULT_VOLTAGE * DEFAULT_POWER_FACTOR)
);
const parseRatingKwHp = (rating = '') => {
  const value = String(rating || '').trim();
  if (!value) return { kw: '', hp: '' };

  const kwMatch = value.match(/([0-9]+(?:\.[0-9]+)?)\s*k\s*w/i);
  const hpMatch = value.match(/([0-9]+(?:\.[0-9]+)?)\s*h\s*p/i);

  let kw = kwMatch ? kwMatch[1] : '';
  let hp = hpMatch ? hpMatch[1] : '';

  if ((!kw || !hp) && value.includes('/')) {
    const [firstPart = '', secondPart = ''] = value.split('/');
    kw = kw || (toFiniteNumber(firstPart) !== null ? roundToTwo(toFiniteNumber(firstPart)) : '');
    hp = hp || (toFiniteNumber(secondPart) !== null ? roundToTwo(toFiniteNumber(secondPart)) : '');
  }

  if (!kw && !hp) {
    const numericValue = toFiniteNumber(value);
    if (numericValue !== null) kw = roundToTwo(numericValue);
  }

  return { kw, hp };
};

const formatRatingKwHp = (kw, hp) => {
  const parts = [];
  if (kw !== '' && kw !== null && kw !== undefined) parts.push(`${kw} kW`);
  if (hp !== '' && hp !== null && hp !== undefined) parts.push(`${hp} HP`);
  return parts.join(' / ');
};

const getDisplayLoadValues = (row = {}) => {
  const parsedRating = parseRatingKwHp(row.ratingKwHp);
  const kwValue = toFiniteNumber(parsedRating.kw);
  const hpValue = toFiniteNumber(parsedRating.hp);
  const derivedKw = kwValue !== null ? kwValue : (hpValue !== null ? calculateKwFromHp(hpValue) : null);
  const derivedAmpere = derivedKw !== null ? roundToTwo(calculateAmpereFromKw(derivedKw)) : '';

  return {
    kw: parsedRating.kw,
    hp: parsedRating.hp,
    ampere: derivedAmpere || row.fullLoadCurrent || '',
  };
};

const getTotalAmpere = (row = {}) => {
  const qty = toFiniteNumber(row.qty);
  const ampere = toFiniteNumber(getDisplayLoadValues(row).ampere);

  if (qty === null || ampere === null) return '';

  return roundToTwo(qty * ampere);
};


const normaliseRow = (row = {}, index = 0) => ({
  ...EMPTY_ROW,
  ...row,
  srNo: index + 1,
  loadDescription: row.loadDescription || '',
  qty: row.qty ?? '',
  ratingKwHp: row.ratingKwHp || '',
  fullLoadCurrent: row.fullLoadCurrent || '',
  remarks: row.remarks || '',
});

const hasMeaningfulLoadValue = (row = {}) => (
  ['loadDescription', 'qty', 'ratingKwHp', 'fullLoadCurrent', 'remarks'].some((field) =>
    String(row?.[field] ?? '').trim() !== ''
  )
);

const normaliseRows = (rows = [], minRows = 1) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const minimumRows = Math.max(1, Number(minRows) || 0);

  let displayRows = safeRows;

  if (safeRows.length > minimumRows) {
    const lastMeaningfulIndex = safeRows.reduce((lastIndex, row, index) => (
      hasMeaningfulLoadValue(row) ? index : lastIndex
    ), -1);

    if (lastMeaningfulIndex === -1) {
      displayRows = safeRows.slice(0, minimumRows);
    } else {
      displayRows = safeRows.slice(0, Math.max(minimumRows, lastMeaningfulIndex + 1));
    }
  }

  const requiredRows = Math.max(minimumRows, displayRows.length);

  return Array.from({ length: requiredRows }, (_, index) =>
    normaliseRow(displayRows[index] || {}, index)
  );
};

const createEmptyRow = (index) => ({
  ...EMPTY_ROW,
  srNo: index + 1,
});

const reIndexRows = (rows = []) =>
  rows.map((row, index) => ({
    ...row,
    srNo: index + 1,
  }));

const getFieldError = (errors = {}, rowIndex, field) => {
  if (!errors) return '';

  const keys = [
    `${rowIndex}.${field}`,
    `[${rowIndex}].${field}`,
    `loadDetails.${rowIndex}.${field}`,
    `loadDetails[${rowIndex}].${field}`,
    `vfdDetails.loadDetails.${rowIndex}.${field}`,
    `vfdDetails.loadDetails[${rowIndex}].${field}`,
    `mccDetails.loadDetails.${rowIndex}.${field}`,
    `mccDetails.loadDetails[${rowIndex}].${field}`,
  ];

  for (const key of keys) {
    if (errors[key]) return errors[key];
  }

  return '';
};

const ErrorText = ({ children }) => {
  if (!children) return null;

  return (
    <p className="mt-1 text-[11px] leading-4 text-red-500">
      {children}
    </p>
  );
};

// Stacked label + control used by the mobile card layout.
const MobileField = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs font-medium text-gray-600">{label}</span>
    {children}
  </div>
);

const InquiryLoadTable = ({
  rows = [],
  onChange,
  showRemarks = false,
  errors = {},
  minRows = 0,
  disabled = false,
}) => {
  const minimumRows = Math.max(1, Number(minRows) || 0);
  const baseRows = useMemo(() => normaliseRows(rows, minRows), [rows, minRows]);
  const [visibleRowCount, setVisibleRowCount] = useState(0);

  useEffect(() => {
    const incomingRows = Array.isArray(rows) ? rows : [];
    const lastMeaningfulIndex = incomingRows.reduce((lastIndex, row, index) => (
      hasMeaningfulLoadValue(row) ? index : lastIndex
    ), -1);
    const requiredByData = Math.max(minimumRows, baseRows.length, lastMeaningfulIndex + 1);

    setVisibleRowCount((currentCount) => {
      if (currentCount === 0 || currentCount > incomingRows.length) {
        return requiredByData;
      }

      return Math.max(currentCount, requiredByData);
    });
  }, [rows, minimumRows, baseRows.length]);

  const tableRows = normaliseRows(rows, Math.max(minimumRows, visibleRowCount));

  const safeOnChange = (updatedRows) => {
    if (typeof onChange === 'function') {
      onChange(reIndexRows(updatedRows));
    }
  };

  const updateRow = (rowIndex, field, value) => {
    const updatedRows = tableRows.map((row, index) => (
      index === rowIndex
        ? { ...row, [field]: value }
        : row
    ));

    safeOnChange(updatedRows);
  };

  const updateLoadCalculation = (rowIndex, sourceField, value) => {
    const numericValue = toFiniteNumber(value);

    const updatedRows = tableRows.map((row, index) => {
      if (index !== rowIndex) return row;

      if (numericValue === null) {
        return {
          ...row,
          ratingKwHp: '',
          fullLoadCurrent: '',
        };
      }

      let kw = 0;
      let hp = 0;
      let ampere = 0;

      if (sourceField === 'kw') {
        kw = numericValue;
        hp = calculateHpFromKw(kw);
        ampere = calculateAmpereFromKw(kw);
      } else if (sourceField === 'hp') {
        hp = numericValue;
        kw = calculateKwFromHp(hp);
        ampere = calculateAmpereFromKw(kw);
      }

      const roundedKw = roundToTwo(kw);
      const roundedHp = roundToTwo(hp);
      const roundedAmpere = roundToTwo(ampere);

      return {
        ...row,
        ratingKwHp: formatRatingKwHp(roundedKw, roundedHp),
        fullLoadCurrent: roundedAmpere,
      };
    });

    safeOnChange(updatedRows);
  };

  const addRow = () => {
    if (disabled) return;

    const nextRowCount = tableRows.length + 1;
    setVisibleRowCount(nextRowCount);

    safeOnChange([
      ...tableRows,
      createEmptyRow(tableRows.length),
    ]);
  };

  const deleteRow = (rowIndex) => {
    if (disabled) return;

    const minimumRows = Math.max(1, Number(minRows) || 0);

    if (tableRows.length <= minimumRows) {
      const clearedRows = tableRows.map((row, index) => (
        index === rowIndex
          ? {
              ...createEmptyRow(index),
              srNo: index + 1,
            }
          : row
      ));

      setVisibleRowCount(clearedRows.length);
      safeOnChange(clearedRows);
      return;
    }

    const updatedRows = tableRows.filter((_, index) => index !== rowIndex);
    setVisibleRowCount(updatedRows.length);
    safeOnChange(updatedRows);
  };

  const columnCount = showRemarks ? 8 : 7;

  const compactInputClass = (hasError) => (
    `min-w-0 px-2 py-2 text-sm ${hasError ? 'border-red-400 focus:ring-red-400' : ''}`
  );

  // Per-row error bundle (shared by both layouts).
  const rowErrors = (index) => ({
    loadDescription: getFieldError(errors, index, 'loadDescription'),
    qty: getFieldError(errors, index, 'qty'),
    rating: getFieldError(errors, index, 'ratingKwHp'),
    current: getFieldError(errors, index, 'fullLoadCurrent'),
    remarks: getFieldError(errors, index, 'remarks'),
  });

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-800">
            Load Details
          </h4>
          <p className="mt-1 text-xs text-gray-500">
            Add each motor/load rating. Ampere is auto-calculated from kW / HP.
          </p>
        </div>

        <Button
          type="button"
          onClick={addRow}
          disabled={disabled}
          className="inline-flex w-full items-center justify-center gap-2 sm:w-auto"
        >
          <Plus size={16} />
          Add Row
        </Button>
      </div>

      {/* ── Mobile: stacked cards ────────────────────────────────────────── */}
      <div className="space-y-3 md:hidden">
        {tableRows.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-8 text-center text-sm text-gray-400 shadow-sm">
            No load rows available. Tap “Add Row” to add load details.
          </div>
        ) : (
          tableRows.map((row, index) => {
            const err = rowErrors(index);
            return (
              <div
                key={`load-card-${index}`}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">
                    Load #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteRow(index)}
                    disabled={disabled}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Delete row"
                    aria-label={`Delete load row ${index + 1}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="space-y-3">
                  <MobileField label="Load Description">
                    <Input
                      value={row.loadDescription || ''}
                      onChange={(event) => updateRow(index, 'loadDescription', event.target.value)}
                      placeholder="Load description"
                      disabled={disabled}
                      className={err.loadDescription ? 'border-red-400 focus:ring-red-400' : ''}
                    />
                    <ErrorText>{err.loadDescription}</ErrorText>
                  </MobileField>

                  <div className="grid grid-cols-2 gap-3">
                    <MobileField label="Qty">
                      <Input
                        type="number"
                        min="0"
                        value={row.qty ?? ''}
                        onChange={(event) => updateRow(index, 'qty', event.target.value)}
                        placeholder="Qty"
                        disabled={disabled}
                        className={err.qty ? 'border-red-400 focus:ring-red-400' : ''}
                      />
                      <ErrorText>{err.qty}</ErrorText>
                    </MobileField>

                    <MobileField label="kW">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={getDisplayLoadValues(row).kw}
                        onChange={(event) => updateLoadCalculation(index, 'kw', event.target.value)}
                        placeholder="kW"
                        disabled={disabled}
                        className={err.rating ? 'border-red-400 focus:ring-red-400' : ''}
                      />
                      <ErrorText>{err.rating}</ErrorText>
                    </MobileField>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <MobileField label="HP">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={getDisplayLoadValues(row).hp}
                        onChange={(event) => updateLoadCalculation(index, 'hp', event.target.value)}
                        placeholder="HP"
                        disabled={disabled}
                        className={err.rating ? 'border-red-400 focus:ring-red-400' : ''}
                      />
                    </MobileField>

                    <MobileField label="Ampere (A)">
                      <div
                        className={`flex min-h-[42px] items-center rounded-lg border px-3 py-2 text-sm font-semibold ${
                          err.current
                            ? 'border-red-400 bg-red-50 text-red-600'
                            : 'border-gray-200 bg-gray-50 text-gray-700'
                        }`}
                        title="Auto-calculated from kW / HP"
                      >
                        {getDisplayLoadValues(row).ampere || '0'}
                      </div>
                      <ErrorText>{err.current}</ErrorText>
                    </MobileField>
                  </div>

                  <MobileField label="Total Ampere">
                    <div className="flex min-h-[42px] items-center rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
                      {getTotalAmpere(row) || '0'}
                    </div>
                  </MobileField>

                  {showRemarks && (
                    <MobileField label="Remarks">
                      <Input
                        value={row.remarks || ''}
                        onChange={(event) => updateRow(index, 'remarks', event.target.value)}
                        placeholder="Remarks"
                        disabled={disabled}
                        className={err.remarks ? 'border-red-400 focus:ring-red-400' : ''}
                      />
                      <ErrorText>{err.remarks}</ErrorText>
                    </MobileField>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Tablet/Desktop: responsive table without horizontal scroll ───── */}
      <div className="hidden w-full rounded-xl border border-gray-200 bg-white shadow-sm md:block">
        <div className="overflow-hidden rounded-xl">
          <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
            <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="w-10 border-b border-gray-200 px-2 py-3 text-center">
                No.
              </th>
              <th className={showRemarks ? 'w-[20%] border-b border-gray-200 px-2 py-3' : 'w-[26%] border-b border-gray-200 px-2 py-3'}>
                Load Description
              </th>
              <th className="w-[8%] border-b border-gray-200 px-2 py-3">
                Qty
              </th>
              <th className={showRemarks ? 'w-[9%] border-b border-gray-200 px-2 py-3' : 'w-[10%] border-b border-gray-200 px-2 py-3'}>
                kW
              </th>
              <th className={showRemarks ? 'w-[9%] border-b border-gray-200 px-2 py-3' : 'w-[10%] border-b border-gray-200 px-2 py-3'}>
                HP
              </th>
              <th className={showRemarks ? 'w-[10%] border-b border-gray-200 px-2 py-3' : 'w-[11%] border-b border-gray-200 px-2 py-3'}>
                Ampere
              </th>
              <th className={showRemarks ? 'w-[10%] border-b border-gray-200 px-2 py-3' : 'w-[11%] border-b border-gray-200 px-2 py-3'}>
                Total A
              </th>
              {showRemarks && (
                <th className="w-[14%] border-b border-gray-200 px-2 py-3">
                  Remarks
                </th>
              )}
              <th className="w-10 border-b border-gray-200 px-2 py-3 text-center">
                
              </th>
            </tr>
          </thead>

            <tbody>
            {tableRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columnCount + 1}
                  className="px-3 py-8 text-center text-sm text-gray-400"
                >
                  No load rows available. Click Add Row to add load details.
                </td>
              </tr>
            ) : (
              tableRows.map((row, index) => {
                const err = rowErrors(index);

                return (
                  <tr
                    key={`load-row-${index}`}
                    className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/60"
                  >
                    <td className="align-top px-2 py-3">
                      <div className="flex min-h-[38px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-1 py-2 text-sm font-semibold text-gray-700">
                        {index + 1}
                      </div>
                    </td>

                    <td className="align-top px-2 py-3">
                      <Input
                        value={row.loadDescription || ''}
                        onChange={(event) => updateRow(index, 'loadDescription', event.target.value)}
                        placeholder="Load description"
                        disabled={disabled}
                        className={compactInputClass(err.loadDescription)}
                      />
                      <ErrorText>{err.loadDescription}</ErrorText>
                    </td>

                    <td className="align-top px-2 py-3">
                      <Input
                        type="number"
                        min="0"
                        value={row.qty ?? ''}
                        onChange={(event) => updateRow(index, 'qty', event.target.value)}
                        placeholder="Qty"
                        disabled={disabled}
                        className={compactInputClass(err.qty)}
                      />
                      <ErrorText>{err.qty}</ErrorText>
                    </td>

                    <td className="align-top px-2 py-3">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={getDisplayLoadValues(row).kw}
                        onChange={(event) => updateLoadCalculation(index, 'kw', event.target.value)}
                        placeholder="kW"
                        disabled={disabled}
                        className={compactInputClass(err.rating)}
                      />
                      <ErrorText>{err.rating}</ErrorText>
                    </td>

                    <td className="align-top px-2 py-3">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={getDisplayLoadValues(row).hp}
                        onChange={(event) => updateLoadCalculation(index, 'hp', event.target.value)}
                        placeholder="HP"
                        disabled={disabled}
                        className={compactInputClass(err.rating)}
                      />
                    </td>

                    <td className="align-top px-2 py-3">
                      <div
                        className={`flex min-h-[38px] items-center rounded-lg border px-2 py-2 text-sm font-semibold ${
                          err.current
                            ? 'border-red-400 bg-red-50 text-red-600'
                            : 'border-gray-200 bg-gray-50 text-gray-700'
                        }`}
                        title="Auto-calculated from kW / HP"
                      >
                        {getDisplayLoadValues(row).ampere || '0'}
                      </div>
                      <ErrorText>{err.current}</ErrorText>
                    </td>

                    <td className="align-top px-2 py-3">
                      <div className="flex min-h-[38px] items-center rounded-lg border border-blue-100 bg-blue-50 px-2 py-2 text-sm font-semibold text-blue-700">
                        {getTotalAmpere(row) || '0'}
                      </div>
                    </td>

                    {showRemarks && (
                      <td className="align-top px-2 py-3">
                        <Input
                          value={row.remarks || ''}
                          onChange={(event) => updateRow(index, 'remarks', event.target.value)}
                          placeholder="Remarks"
                          disabled={disabled}
                          className={compactInputClass(err.remarks)}
                        />
                        <ErrorText>{err.remarks}</ErrorText>
                      </td>
                    )}

                    <td className="align-top px-2 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => deleteRow(index)}
                        disabled={disabled}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Delete row"
                        aria-label={`Delete load row ${index + 1}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InquiryLoadTable;