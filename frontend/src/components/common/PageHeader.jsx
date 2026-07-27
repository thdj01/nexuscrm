import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// PageHeader — the ONE reusable sticky page-header shell.
//
// Every module page (Project, Inquiry, Ticket, Customer, ...) used to hand-roll
// its own "sticky top-0 -mx-* -mt-*" header with slightly different, often
// mismatched, breakpoint math. That produced the duplicate-topbar / extra-gap
// bugs across the app. This component is now the single place that:
//   1. Sticks the header to the top of <main> (MainLayout's scroll container)
//   2. Cancels <main>'s own padding so the header bleeds edge-to-edge with
//      zero gap above/around it
//   3. Restores matching inner padding so the header's content lines up with
//      the page content below it
//
// If MainLayout's <main> padding (currently px-3 sm:px-5 xl:px-6, same scale
// vertically) ever changes, update MAIN_BLEED_X / BLEED_TOP below and every
// page updates automatically. No page should ever again write its own
// "-mx-*"/"-mt-*" header hack.
// ─────────────────────────────────────────────────────────────────────────────

// Keep in sync with <main>'s padding in layouts/MainLayout.jsx (MAIN_PADDING)
const MAIN_BLEED_X = '-mx-3 sm:-mx-5 xl:-mx-6';
const MAIN_PADDING_X = 'px-3 sm:px-5 xl:px-6';
const BLEED_TOP = '-mt-3 sm:-mt-5 xl:-mt-6';

// For pages that render their content in a centered/boxed column (e.g. Ticket
// forms using max-w-5xl mx-auto) rather than the full width of <main>. The
// header still needs *some* horizontal bleed so it reads as a distinct card,
// but it bleeds relative to its own column, not to <main>'s real edge.
const CONTAINER_BLEED_X = '-mx-4 sm:-mx-6';
const CONTAINER_PADDING_X = 'px-4 sm:px-6';

const BLEED_X_CLASSES = {
  main: MAIN_BLEED_X,
  container: CONTAINER_BLEED_X,
  none: '',
};

const PADDING_X_CLASSES = {
  main: MAIN_PADDING_X,
  container: CONTAINER_PADDING_X,
  none: 'px-4',
};

/**
 * @param {'main'|'container'|'none'} bleed - how far the header bleeds horizontally.
 *   'main'      - full width of <main>, edge-to-edge (dashboards/wide forms: Project, Inquiry, Customer)
 *   'container' - bleeds slightly past its own centered column only (Ticket)
 *   'none'      - no horizontal bleed at all
 * @param {boolean} sticky - whether the header sticks to the top of <main> (default true)
 * @param {boolean} bleedTop - whether to cancel <main>'s top padding with a negative
 *   top margin (default true). Set false only for a route where <main> itself
 *   already renders zero top padding for that page (e.g. Project detail, which
 *   MainLayout special-cases) — otherwise the negative margin double-cancels
 *   padding that isn't there and pulls the header above the true top edge.
 * @param {string} zIndexClassName - stacking context, defaults to a value safely
 *   below the global Topbar (Topbar is not rendered on pages that use PageHeader,
 *   so this mostly matters relative to StickyActionBar and in-page content).
 */
const PageHeader = ({
  children,
  bleed = 'main',
  sticky = true,
  bleedTop = true,
  zIndexClassName = 'z-40',
  className = '',
  contentClassName = '',
}) => (
  <div
    data-page-header=""
    className={[
      sticky ? 'sticky top-0' : '',
      zIndexClassName,
      // Do not force w-full here. With horizontal negative margins, w-full
      // moves the header left but leaves the same padding-sized blank strip on
      // the right. Auto width lets the full-bleed math cover both edges.
      'w-auto border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur',
      'py-2.5 sm:py-3',
      PADDING_X_CLASSES[bleed] ?? PADDING_X_CLASSES.main,
      BLEED_X_CLASSES[bleed] ?? BLEED_X_CLASSES.main,
      bleedTop ? BLEED_TOP : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    <div className={contentClassName}>{children}</div>
  </div>
);

export default PageHeader;

// ── Optional building blocks for the common "simple" header shape ─────────
// (back link + icon/title/badges on the left, actions on the right).
// Pages with a bespoke header layout (e.g. Inquiry's multi-step stepper) can
// ignore these and pass their own markup as children to <PageHeader> instead
// — PageHeader only owns the sticky/bleed shell, never the content shape.

export const PageHeaderRow = ({ className = '', children }) => (
  <div
    className={`flex min-w-0 flex-col gap-2 lg:flex-row lg:items-start lg:justify-between ${className}`}
  >
    {children}
  </div>
);

export const PageHeaderActions = ({ className = '', children }) => (
  <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>{children}</div>
);
