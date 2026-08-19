import React, { useEffect, useRef, useState } from 'react';
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
  <div className={`w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain ${className}`}>{children}</div>
);

const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];

const Pagination = ({
  pagination,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  totalLabel = 'records',
}) => {
  if (!pagination) return null;

  const total = Number(pagination.total) || 0;
  const limit = Number(pagination.limit) || 50;
  const pages = Math.max(1, Number(pagination.pages || pagination.totalPages) || 1);
  const page = Math.min(Math.max(1, Number(pagination.page) || 1), pages);
  const hasPageSizeSelector = typeof onPageSizeChange === 'function';

  // Keep the old compact behavior for tables that do not opt into the new
  // bottom page-size control. The four main list pages opt in explicitly.
  if (pages <= 1 && !hasPageSizeSelector) return null;

  const normalizedOptions = [...new Set([
    ...pageSizeOptions.map(Number).filter((value) => Number.isFinite(value) && value > 0),
    limit,
  ])].sort((a, b) => a - b);

  return (
    <div
      className="mt-auto flex shrink-0 flex-col gap-2 border-t border-gray-200 bg-white px-3 py-2 shadow-[0_-2px_8px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between sm:px-4"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-gray-500">
        {hasPageSizeSelector && (
          <label className="flex items-center gap-1.5 whitespace-nowrap">
            <span>Show per page:</span>
            <select
              value={limit}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="h-8 min-w-[58px] rounded-lg border border-gray-300 bg-white px-2 text-center text-xs font-semibold text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              aria-label="Show records per page"
            >
              {normalizedOptions.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        )}
        <span className="whitespace-nowrap">Total: {total} {totalLabel}</span>
      </div>

      <div className="flex w-full min-w-0 items-center justify-between gap-1.5 sm:w-auto sm:justify-end">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:shadow-none sm:min-w-[78px] sm:flex-none sm:px-3"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
          <span>Previous</span>
        </button>

        <span className="inline-flex h-8 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-lg border border-blue-100 bg-blue-50/50 px-2 text-xs font-semibold text-gray-700 sm:min-w-[92px] sm:flex-none">
          Page {page} of {pages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:shadow-none sm:min-w-[66px] sm:flex-none sm:px-3"
          aria-label="Next page"
        >
          <span>Next</span>
          <ChevronRight size={14} />
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
  getRowClassName,
  onPageSizeChange,
  pageSizeOptions,
  paginationTotalLabel = 'records',
}) => {
  const hasFixedPagination = typeof onPageSizeChange === 'function';
  const rootRef = useRef(null);
  const [availableHeight, setAvailableHeight] = useState(null);

  const cols = columns || [];
  const rows = data || [];
  const isEmpty = rows.length === 0;

  // The four main list pages opt into onPageSizeChange. For those pages we
  // reserve exactly the remaining viewport height for the table card. The rows
  // scroll inside that area while the pagination footer stays permanently
  // visible at the bottom instead of appearing only after all rows are passed.
  useEffect(() => {
    if (!hasFixedPagination || loading) {
      setAvailableHeight(null);
      return undefined;
    }

    const updateAvailableHeight = () => {
      if (!rootRef.current) return;
      const { top } = rootRef.current.getBoundingClientRect();
      const bottomGap = window.innerWidth < 640 ? 8 : 16;
      const nextHeight = Math.max(280, Math.floor(window.innerHeight - top - bottomGap));
      setAvailableHeight(nextHeight);
    };

    updateAvailableHeight();
    window.addEventListener('resize', updateAvailableHeight);

    // MainLayout owns the vertical page scroller. Recalculate if its scroll
    // position changes (for example on a small screen with stacked filters).
    const mainScroller = rootRef.current?.closest('main');
    mainScroller?.addEventListener('scroll', updateAvailableHeight, { passive: true });

    return () => {
      window.removeEventListener('resize', updateAvailableHeight);
      mainScroller?.removeEventListener('scroll', updateAvailableHeight);
    };
  }, [hasFixedPagination, loading]);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`flex min-w-0 max-w-full flex-col ${hasFixedPagination ? 'min-h-0 overflow-hidden' : ''}`}
      style={hasFixedPagination && availableHeight ? { height: `${availableHeight}px` } : undefined}
    >
      <div className={hasFixedPagination ? 'min-h-0 flex-1 overflow-y-auto overscroll-y-contain' : ''}>
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
                } ${getRowClassName?.(row) || ''}`}
              >
                <dl className="space-y-3">
                  {cols.map((col) => (
                    <div
                      key={col.key}
                      className="grid min-w-0 grid-cols-1 gap-1 text-sm sm:grid-cols-[minmax(105px,auto)_minmax(0,1fr)] sm:items-start sm:gap-3"
                    >
                      {col.label ? (
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400 sm:pt-0.5">
                          {col.label}
                        </dt>
                      ) : (
                        <span className="sr-only">value</span>
                      )}
                      <dd className="min-w-0 break-words text-left text-gray-700 sm:text-right">
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
                    } ${getRowClassName?.(row) || ''}`}
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

      </div>

      <Pagination
        pagination={pagination}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={pageSizeOptions}
        totalLabel={paginationTotalLabel}
      />
    </div>
  );
};

export default Table;
