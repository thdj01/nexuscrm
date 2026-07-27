import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// StickyActionBar — the ONE reusable sticky bottom submit/update bar.
//
// Replaces every page/form-specific "sticky bottom-0 -mx-* ..." bar. Each one
// previously used slightly different margin math, and left <main>'s bottom
// padding dangling below the bar as dead scroll space. This component
// cancels that trailing padding so the bar sits flush with the true bottom
// edge, with no gap after it.
//
// Keep MAIN_BLEED_X in sync with <main>'s padding in layouts/MainLayout.jsx.
// ─────────────────────────────────────────────────────────────────────────────

// Keep MAIN_BLEED_X in sync with <main>'s padding in layouts/MainLayout.jsx
// (MAIN_PADDING). <main> uses px-3 sm:px-5 xl:px-6 (same scale on the
// vertical axis), so the bleed/restore values below mirror that exactly.
const MAIN_BLEED_X = '-mx-3 sm:-mx-5 xl:-mx-6';
const MAIN_PADDING_X = 'px-3 sm:px-5 xl:px-6';
const MAIN_BLEED_BOTTOM = '-mb-3 sm:-mb-5 xl:-mb-6';

/**
 * @param {React.ReactNode} status - left-aligned status text/icon (e.g. validation state)
 * @param {React.ReactNode} children - right-aligned action buttons
 * @param {boolean} fullBleed - true (default) bleeds edge-to-edge with <main>
 *   for full-width pages (Project, Inquiry). Set false for pages whose content
 *   sits in a centered column (e.g. Ticket's max-w-5xl form) so the bar stays
 *   boxed with the rest of the content instead of spanning the whole viewport.
 * @param {boolean} bleedBottom - whether to cancel <main>'s bottom padding with a
 *   negative bottom margin (default true, only applies when fullBleed is true).
 *   Set false only for a route where <main> itself already renders zero bottom
 *   padding for that page (e.g. Project detail, which MainLayout special-cases)
 *   — otherwise the negative margin double-cancels padding that isn't there and
 *   leaves dead scroll space below the bar.
 */
const StickyActionBar = ({ status, children, fullBleed = true, bleedBottom = true, className = '' }) => (
  <div
    className={[
      // Keep width auto. A fixed w-full combined with -mx-* creates a right-side
      // blank strip; auto width expands correctly between both negative margins.
      'sticky bottom-0 z-30 mt-4 w-auto',
      'flex flex-col gap-2 border-t border-gray-200 bg-white',
      'shadow-[0_-4px_14px_rgba(15,23,42,0.10)]',
      'sm:flex-row sm:items-center sm:justify-between',
      fullBleed
        ? `${MAIN_PADDING_X} py-2 sm:py-2.5 ${MAIN_BLEED_X} ${bleedBottom ? MAIN_BLEED_BOTTOM : ''} rounded-none`
        : 'rounded-xl px-4 py-3 sm:px-6',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    <div className="flex min-w-0 items-center gap-2 text-xs sm:text-sm">{status}</div>
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
      {children}
    </div>
  </div>
);

export default StickyActionBar;
