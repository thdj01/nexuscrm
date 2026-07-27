import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Spinner from './Spinner';

/**
 * Reusable horizontal-overflow wrapper for raw page tables.
 *
 *   <TableScroll>
 *     <table> … </table>
 *   </TableScroll>
 *
 * Guarantees the table can scroll sideways instead of forcing the page wider
 * than the viewport. `min-w-0` on the parent flex column (set in MainLayout)
 * is what lets this actually clip rather than overflow.
 */
export const TableScroll = ({ children, className = '' }) => (
  <div className={`w-full overflow-x-auto ${className}`}>{children}</div>
);

const Pagination = ({ pagination, onPageChange }) => {
  if (!pagination || pagination.pages <= 1) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-gray-500 sm:text-sm">
        Showing {(pagination.page - 1) * pagination.limit + 1}–
        {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
      </p>
      <div className="flex items-center gap-1 self-end sm:self-auto">
        <button
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={pagination.page === 1}
          className="rounded p-1.5 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
          const page = i + 1;
          return (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`h-8 w-8 rounded text-sm font-medium ${
                pagination.page === page
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {page}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={pagination.page === pagination.pages}
          className="rounded p-1.5 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

/**
 * Responsive data table.
 *
 *  - md and up : standard table inside a horizontal-scroll container.
 *  - below md  : each row renders as a stacked "label → value" card so nothing
 *                gets clipped on a phone. Set `mobileCards={false}` to keep the
 *                scrolling table at every width (e.g. when columns are already
 *                compact / numeric).
 *
 * The column API (`{ key, label, width, render }`) is unchanged, so existing
 * call sites keep working without edits.
 */
const Table = ({
  columns,
  data,
  loading,
  pagination,
  onPageChange,
  emptyMessage = 'No records found',
  onRowClick,
  mobileCards = true,
}) => {
  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const cols = columns || [];
  const rows = data || [];
  const isEmpty = rows.length === 0;

  return (
    <div>
      {/* ── Mobile: stacked cards ───────────────────────────────────────── */}
      {mobileCards && (
        <div className="space-y-3 md:hidden">
          {isEmpty ? (
            <div className="rounded-xl border border-gray-100 bg-white py-10 text-center text-gray-400">
              {emptyMessage}
            </div>
          ) : (
            rows.map((row, rowIndex) => (
              <div
                key={row._id || rowIndex}
                onClick={() => onRowClick?.(row)}
                className={`rounded-xl border border-gray-100 bg-white p-4 shadow-sm ${
                  onRowClick ? 'cursor-pointer active:bg-gray-50' : ''
                }`}
              >
                <dl className="space-y-2">
                  {cols.map((col) => (
                    <div
                      key={col.key}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      {col.label ? (
                        <dt className="shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-400">
                          {col.label}
                        </dt>
                      ) : (
                        <span className="sr-only">value</span>
                      )}
                      <dd className="min-w-0 break-words text-right text-gray-700">
                        {col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Tablet/Desktop: scrollable table ────────────────────────────── */}
      <div className={mobileCards ? 'hidden md:block' : 'block'}>
        <TableScroll>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {cols.map((col) => (
                  <th
                    key={col.key}
                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600"
                    style={{ width: col.width }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isEmpty ? (
                <tr>
                  <td colSpan={cols.length} className="py-12 text-center text-gray-400">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIndex) => (
                  <tr
                    key={row._id || rowIndex}
                    onClick={() => onRowClick?.(row)}
                    className={`table-row-hover border-b border-gray-100 ${
                      onRowClick ? 'cursor-pointer' : ''
                    }`}
                  >
                    {cols.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-gray-700">
                        {col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableScroll>
      </div>

      <Pagination pagination={pagination} onPageChange={onPageChange} />
    </div>
  );
};

export default Table;
