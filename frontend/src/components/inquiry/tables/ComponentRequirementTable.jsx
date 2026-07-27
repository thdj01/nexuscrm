import React from 'react';
import { Download, Plus } from 'lucide-react';
import { Input, Select, Button } from '../../common/FormComponents.extended';

const EMPTY_ROW = {
  component: '',
  required: 'No',
  preferredBrand: '',
  suggestedModelRange: '',
  remarks: '',
};

const normaliseDropdownOptions = (options = []) =>
  (Array.isArray(options) ? options : [])
    .map((option) => {
      if (typeof option === 'string') {
        return { value: option, label: option };
      }

      return option;
    })
    .filter((option) => option?.value);

const getDropdownValue = (value = '', options = []) => {
  if (!value) return '';

  return options.some((option) => option.value === value) ? value : 'Other';
};

const normaliseRequiredValue = (value) => (value === 'Yes' ? 'Yes' : 'No');

const normaliseRow = (row = {}, component = '') => ({
  ...EMPTY_ROW,
  ...row,
  component: row.component || component || '',
  required: normaliseRequiredValue(row.required),
});

const hasMeaningfulComponentValue = (row = {}) => (
  row.__visible === true ||
  row.required === 'Yes' ||
  ['preferredBrand', 'suggestedModelRange', 'remarks'].some((field) =>
    String(row?.[field] ?? '').trim() !== ''
  )
);

const getVisibleComponentCount = (sourceRows = [], sourceComponents = []) => {
  const minimumRows = 1;

  if (!Array.isArray(sourceRows) || sourceRows.length === 0) {
    return minimumRows;
  }

  const lastMeaningfulIndex = sourceRows.reduce((lastIndex, row, index) => (
    hasMeaningfulComponentValue(row) ? index : lastIndex
  ), -1);

  if (lastMeaningfulIndex === -1) {
    return minimumRows;
  }

  const maxCount = Array.isArray(sourceComponents) && sourceComponents.length > 0
    ? sourceComponents.length
    : sourceRows.length;

  return Math.max(minimumRows, Math.min(maxCount, lastMeaningfulIndex + 1));
};

const getFieldError = (errors = {}, errorPrefix = '', rowIndex, field) => {
  if (!errors) return '';

  const keys = [
    errorPrefix ? `${errorPrefix}.${rowIndex}.${field}` : '',
    errorPrefix ? `${errorPrefix}[${rowIndex}].${field}` : '',
    errorPrefix ? `${errorPrefix}.${rowIndex}` : '',
    errorPrefix ? `${errorPrefix}[${rowIndex}]` : '',
    `${rowIndex}.${field}`,
    `[${rowIndex}].${field}`,
  ].filter(Boolean);

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

const RequiredCheckbox = ({ checked, onChange, disabled = false, error = '' }) => (
  <label
    title={checked ? 'Required' : 'Not required'}
    className={`flex min-h-[40px] min-w-0 cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-sm font-medium transition ${
      checked
        ? 'border-blue-300 bg-blue-50 text-blue-700'
        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
    } ${error ? 'border-red-400 ring-1 ring-red-200' : ''} ${
      disabled ? 'cursor-not-allowed opacity-60' : ''
    }`}
  >
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      disabled={disabled}
      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
    />
  </label>
);

// Stacked label + control used by the mobile card layout.
const MobileField = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs font-medium text-gray-600">{label}</span>
    {children}
  </div>
);

const ComponentRequirementTable = ({
  title = '',
  rows = [],
  onChange,
  componentRows = [],
  errorPrefix = '',
  errors = {},
  disabled = false,
  showAllRows = false,
  allowAddRow = true,
  preferredBrandOptions = [],
}) => {
  const sourceComponents = Array.isArray(componentRows) ? componentRows : [];
  const sourceRows = Array.isArray(rows) ? rows : [];
  const brandOptions = normaliseDropdownOptions(preferredBrandOptions);
  const useBrandDropdown = brandOptions.length > 0;
  const visibleCount = showAllRows && sourceComponents.length > 0
    ? sourceComponents.length
    : getVisibleComponentCount(sourceRows, sourceComponents);

  const tableRows = sourceComponents.length > 0
    ? sourceComponents
        .slice(0, visibleCount)
        .map((component, index) => normaliseRow(sourceRows[index], component))
    : Array.from(
        { length: Math.max(1, sourceRows.length) },
        (_, index) => normaliseRow(sourceRows[index])
      ).slice(0, Math.max(1, visibleCount));

  const canAddRow = allowAddRow && (sourceComponents.length > 0
    ? tableRows.length < sourceComponents.length
    : true);

  const safeOnChange = (updatedRows) => {
    if (typeof onChange === 'function') {
      onChange(updatedRows);
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

  const updateRequired = (rowIndex, checked) => {
    const updatedRows = tableRows.map((row, index) => (
      index === rowIndex
        ? { ...row, required: checked ? 'Yes' : 'No' }
        : row
    ));

    safeOnChange(updatedRows);
  };

  const addRow = () => {
    if (disabled || !canAddRow) return;

    if (sourceComponents.length > 0) {
      const nextIndex = tableRows.length;
      safeOnChange([
        ...tableRows,
        {
          ...normaliseRow(sourceRows[nextIndex], sourceComponents[nextIndex]),
          __visible: true,
        },
      ]);
      return;
    }

    safeOnChange([
      ...tableRows,
      {
        ...normaliseRow({}, ''),
        __visible: true,
      },
    ]);
  };

  const downloadRows = () => {
    const csvHeaders = [
      'Component',
      'Required',
      'Preferred Brand',
      'Suggested Model / Range',
      'Remarks',
    ];

    const csvRows = tableRows.map((row) => [
      row.component || '',
      row.required || 'No',
      row.preferredBrand || '',
      row.suggestedModelRange || '',
      row.remarks || '',
    ]);

    const escapeCsvValue = (value) => {
      const text = String(value ?? '');
      return /[\",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const csvContent = [csvHeaders, ...csvRows]
      .map((row) => row.map(escapeCsvValue).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'component-requirements.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const rowErrors = (index) => ({
    required: getFieldError(errors, errorPrefix, index, 'required'),
    component: getFieldError(errors, errorPrefix, index, 'component'),
    preferredBrand: getFieldError(errors, errorPrefix, index, 'preferredBrand'),
    suggestedModel: getFieldError(errors, errorPrefix, index, 'suggestedModelRange'),
    remarks: getFieldError(errors, errorPrefix, index, 'remarks'),
  });

  const isDetailDisabled = (row) => disabled || row.required !== 'Yes';

  const detailDisabledClass = (row) => (
    isDetailDisabled(row)
      ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 placeholder:text-gray-400'
      : 'bg-white text-gray-900'
  );

  const renderPreferredBrandField = (row, index, error = '') => {
    if (useBrandDropdown) {
      return (
        <Select
          value={getDropdownValue(row.preferredBrand || '', brandOptions)}
          onChange={(event) => updateRow(index, 'preferredBrand', event.target.value)}
          disabled={isDetailDisabled(row)}
          className={`min-w-0 w-full ${detailDisabledClass(row)} ${error ? 'border-red-400 focus:ring-red-400' : ''}`}
        >
          <option value="">Select brand</option>
          {brandOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      );
    }

    return (
      <Input
        value={row.preferredBrand || ''}
        onChange={(event) => updateRow(index, 'preferredBrand', event.target.value)}
        placeholder="Preferred brand"
        disabled={isDetailDisabled(row)}
        className={`min-w-0 w-full ${detailDisabledClass(row)} ${error ? 'border-red-400 focus:ring-red-400' : ''}`}
      />
    );
  };

  return (
    <div className="w-full min-w-0">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {title ? (
          <h4 className="text-sm font-semibold text-gray-800">
            {title}
          </h4>
        ) : (
          <div>
            <h4 className="text-sm font-semibold text-gray-800">
              Component Requirements
            </h4>
            <p className="mt-1 text-xs text-gray-500">
              Add only the components required for this inquiry.
            </p>
          </div>
        )}

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={downloadRows}
            disabled={disabled || tableRows.length === 0}
            className="inline-flex w-full items-center justify-center gap-2 sm:w-auto"
          >
            <Download size={16} />
            Download
          </Button>

          {allowAddRow && (
            <Button
              type="button"
              onClick={addRow}
              disabled={disabled || !canAddRow}
              className="inline-flex w-full items-center justify-center gap-2 sm:w-auto"
            >
              <Plus size={16} />
              Add Row
            </Button>
          )}
        </div>
      </div>

      {/* ── Mobile/Tablet: stacked cards ─────────────────────────────────── */}
      <div className="space-y-3 lg:hidden">
        {tableRows.map((row, index) => {
          const err = rowErrors(index);
          const isRequired = row.required === 'Yes';
          const hasFixedComponent = sourceComponents.length > 0;

          return (
            <div
              key={`${row.component || 'component'}-card-${index}`}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3">
                {hasFixedComponent ? (
                  <p className="text-sm font-semibold text-gray-800">
                    {row.component || '-'}
                  </p>
                ) : (
                  <MobileField label="Component">
                    <Input
                      value={row.component || ''}
                      onChange={(event) => updateRow(index, 'component', event.target.value)}
                      placeholder="Component"
                      disabled={disabled}
                      className={`min-w-0 w-full ${err.component ? 'border-red-400 focus:ring-red-400' : ''}`}
                    />
                    <ErrorText>{err.component}</ErrorText>
                  </MobileField>
                )}
              </div>

              <div className="space-y-3">
                <MobileField label="Required">
                  <RequiredCheckbox
                    checked={isRequired}
                    onChange={(checked) => updateRequired(index, checked)}
                    disabled={disabled}
                    error={err.required}
                  />
                  <ErrorText>{err.required}</ErrorText>
                </MobileField>

                <MobileField label="Preferred Brand">
                  {renderPreferredBrandField(row, index, err.preferredBrand)}
                  <ErrorText>{err.preferredBrand}</ErrorText>
                </MobileField>

                <MobileField label="Suggested Model / Range">
                  <Input
                    value={row.suggestedModelRange || ''}
                    onChange={(event) => updateRow(index, 'suggestedModelRange', event.target.value)}
                    placeholder="Suggested model / range"
                    disabled={isDetailDisabled(row)}
                    className={`min-w-0 w-full ${detailDisabledClass(row)} ${err.suggestedModel ? 'border-red-400 focus:ring-red-400' : ''}`}
                  />
                  <ErrorText>{err.suggestedModel}</ErrorText>
                </MobileField>

                <MobileField label="Remarks">
                  <Input
                    value={row.remarks || ''}
                    onChange={(event) => updateRow(index, 'remarks', event.target.value)}
                    placeholder="Remarks"
                    disabled={isDetailDisabled(row)}
                    className={`min-w-0 w-full ${detailDisabledClass(row)} ${err.remarks ? 'border-red-400 focus:ring-red-400' : ''}`}
                  />
                  <ErrorText>{err.remarks}</ErrorText>
                </MobileField>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Desktop: fitted table without horizontal scrollbar ───────────── */}
      <div className="hidden w-full min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:block">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="w-[24%] border-b border-gray-200 px-2 py-3">
                Component
              </th>
              <th className="w-[12%] border-b border-gray-200 px-2 py-3 text-center">
                Required
              </th>
              <th className="w-[18%] border-b border-gray-200 px-2 py-3">
                Preferred Brand
              </th>
              <th className="w-[23%] border-b border-gray-200 px-2 py-3">
                Suggested Model / Range
              </th>
              <th className="w-[23%] border-b border-gray-200 px-2 py-3">
                Remarks
              </th>
            </tr>
          </thead>

          <tbody>
            {tableRows.map((row, index) => {
              const err = rowErrors(index);
              const isRequired = row.required === 'Yes';
              const hasFixedComponent = sourceComponents.length > 0;

              return (
                <tr
                  key={`${row.component || 'component'}-${index}`}
                  className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/60"
                >
                  <td className="min-w-0 align-top px-2 py-3">
                    {hasFixedComponent ? (
                      <div className="min-h-[38px] min-w-0 break-words rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-sm font-medium text-gray-700">
                        {row.component || '-'}
                      </div>
                    ) : (
                      <>
                        <Input
                          value={row.component || ''}
                          onChange={(event) => updateRow(index, 'component', event.target.value)}
                          placeholder="Component"
                          disabled={disabled}
                          className={`min-w-0 w-full ${err.component ? 'border-red-400 focus:ring-red-400' : ''}`}
                        />
                        <ErrorText>{err.component}</ErrorText>
                      </>
                    )}
                  </td>

                  <td className="min-w-0 align-top px-2 py-3">
                    <RequiredCheckbox
                      checked={isRequired}
                      onChange={(checked) => updateRequired(index, checked)}
                      disabled={disabled}
                      error={err.required}
                    />
                    <ErrorText>{err.required}</ErrorText>
                  </td>

                  <td className="min-w-0 align-top px-2 py-3">
                    {renderPreferredBrandField(row, index, err.preferredBrand)}
                    <ErrorText>{err.preferredBrand}</ErrorText>
                  </td>

                  <td className="min-w-0 align-top px-2 py-3">
                    <Input
                      value={row.suggestedModelRange || ''}
                      onChange={(event) => updateRow(index, 'suggestedModelRange', event.target.value)}
                      placeholder="Suggested model / range"
                      disabled={isDetailDisabled(row)}
                      className={`min-w-0 w-full ${detailDisabledClass(row)} ${err.suggestedModel ? 'border-red-400 focus:ring-red-400' : ''}`}
                    />
                    <ErrorText>{err.suggestedModel}</ErrorText>
                  </td>

                  <td className="min-w-0 align-top px-2 py-3">
                    <Input
                      value={row.remarks || ''}
                      onChange={(event) => updateRow(index, 'remarks', event.target.value)}
                      placeholder="Remarks"
                      disabled={isDetailDisabled(row)}
                      className={`min-w-0 w-full ${detailDisabledClass(row)} ${err.remarks ? 'border-red-400 focus:ring-red-400' : ''}`}
                    />
                    <ErrorText>{err.remarks}</ErrorText>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ComponentRequirementTable;
