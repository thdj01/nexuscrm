import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  FolderKanban,
  Users,
  UserCog,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Clock,
  ShieldCheck,
  LifeBuoy,
  Building2,
  Settings,
  X as CloseIcon,
} from 'lucide-react';

import nexusFullLogo from '../../assets/nexus-logo-full.png';
import nexusXLogo from '../../assets/nexus-logo-x.png';

import { useAuth } from '../../context/AuthContext';
import { CUSTOMER_PERMISSIONS, INQUIRY_PERMISSIONS } from '../../constants/permissions';
import Avatar from './Avatar';

const navItems = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inquiries',    icon: FileText,        label: 'Inquiries' },
  { to: '/projects',     icon: FolderKanban,    label: 'Projects' },
  { to: '/customers',    icon: Users,           label: 'Customers' },
  { to: '/tickets',      icon: LifeBuoy,        label: 'Tickets' },
  // Points to /timesheet/list; NavLink will be active for any /timesheet/* path
  { to: '/timesheet',    icon: Clock,           label: 'Timesheet' },
];

const getMasterItems = ({ isAdmin, canAccessTimesheetAdmin }) => [
  ...(canAccessTimesheetAdmin
    ? [{ to: '/timesheet/admin', icon: ShieldCheck, label: 'Timesheet' }]
    : []),
  ...(isAdmin
    ? [
        { to: '/users', icon: UserCog, label: 'User Management' },
        { to: '/masters/departments', icon: Building2, label: 'Department' },
        { to: '/masters/integrations', icon: Settings, label: 'Integration Settings' },
      ]
    : []),
];

/**
 * Responsive sidebar.
 *
 *  Desktop (lg+): fixed rail, toggleable between w-60 (labels) and w-16 (icons).
 *  Mobile (<lg) : off-canvas drawer (always full w-60 with labels) that slides in
 *                 from the left and is dismissed via backdrop / close button /
 *                 selecting a nav item.
 *
 * `collapsed` / `onToggleCollapse` and `mobileOpen` / `onMobileClose` are normally
 * controlled by MainLayout, but the component also works standalone (internal
 * collapse fallback) so it never crashes if rendered without props.
 */
const Sidebar = ({
  mobileOpen = false,
  onMobileClose = () => {},
  collapsed: collapsedProp,
  onToggleCollapse,
}) => {
  const [collapsedInternal, setCollapsedInternal] = useState(false);
  const { user, logout, isAdmin, isHod, isTeamLead, hasPermission } = useAuth();
  const canAccessTimesheetAdmin =
    isAdmin ||
    isHod ||
    isTeamLead ||
    user?.role === 'manager';
  const masterAccessItems = getMasterItems({ isAdmin, canAccessTimesheetAdmin });
  const location = useLocation();
  const visibleNavItems = navItems.flatMap((item) => {
    if (item.to === '/inquiries') {
      if (hasPermission(INQUIRY_PERMISSIONS.VIEW)) return [item];
      if (hasPermission(INQUIRY_PERMISSIONS.CREATE)) {
        return [{ ...item, to: '/inquiries/new' }];
      }
      return [];
    }

    if (item.to === '/customers') {
      if (hasPermission(CUSTOMER_PERMISSIONS.VIEW)) return [item];
      if (hasPermission(CUSTOMER_PERMISSIONS.CREATE)) {
        return [{ ...item, to: '/customers/new' }];
      }
      return [];
    }

    return [item];
  });

  const collapsed = collapsedProp !== undefined ? collapsedProp : collapsedInternal;
  const toggleCollapse =
    onToggleCollapse || (() => setCollapsedInternal((v) => !v));

  // On mobile the drawer is always full width; collapse only applies at lg+.
  const widthCls = collapsed ? 'w-[min(18rem,calc(100vw-1rem))] lg:w-16' : 'w-[min(18rem,calc(100vw-1rem))] lg:w-60';
  const slideCls = mobileOpen ? 'translate-x-0' : '-translate-x-full';

  const linkClass = ({ isActive }) =>
    `flex min-w-0 items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'text-slate-400 hover:text-white hover:bg-slate-800'
    }`;

  const getMainNavActive = (to, isActive) => {
    if (to !== '/timesheet') return isActive;

    // /timesheet/admin has its own Admin menu item, so keep the normal
    // Timesheet menu inactive on that page.
    return isActive && !location.pathname.startsWith('/timesheet/admin');
  };

  // When collapsed, hide a label on desktop only — it stays visible inside the
  // mobile drawer (which is never collapsed).
  const labelCls = collapsed ? 'min-w-0 truncate lg:hidden' : 'min-w-0 truncate';

  return (
    <>
      {/* Note: the mobile backdrop is rendered once by MainLayout (single
          shared overlay for the whole app) — Sidebar only needs to make sure
          it stacks above both that backdrop and the global Topbar (z-[1000])
          while the drawer is open, so it never slides in underneath either. */}
      <aside
        className={`fixed left-0 top-0 z-[1100] flex h-full max-w-full flex-col bg-slate-900 text-white transition-all duration-300 ${widthCls} ${slideCls} lg:translate-x-0 lg:z-50`}
      >
      {/* Logo + mobile close */}
      <div className={`flex min-w-0 items-center border-b border-slate-700 px-3 py-4 ${collapsed ? 'gap-0 lg:justify-center' : 'gap-3'}`}>
        <div className={`${collapsed ? 'hidden lg:flex' : 'hidden'} h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden`}>
          <img
            src={nexusXLogo}
            alt="Nexus"
            className="h-9 w-9 object-contain"
            draggable="false"
          />
        </div>

        <div className={`${collapsed ? 'flex lg:hidden' : 'flex'} min-w-0 flex-1 items-center overflow-hidden`}>
          <img
            src={nexusFullLogo}
            alt="Nexus"
            className="h-10 w-full object-contain object-left"
            draggable="false"
          />
        </div>

        {/* Close drawer (mobile only) */}
        <button
          type="button"
          onClick={onMobileClose}
          aria-label="Close menu"
          className="ml-auto rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white lg:hidden"
        >
          <CloseIcon size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4">
        <ul className="space-y-1 px-2">
          {visibleNavItems.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                onClick={onMobileClose}
                className={({ isActive }) =>
                  linkClass({ isActive: getMainNavActive(to, isActive) })
                }
              >
                <Icon size={18} className="flex-shrink-0" />
                <span className={labelCls}>{label}</span>
              </NavLink>
            </li>
          ))}

          {masterAccessItems.length > 0 && (
            <>
              <li className={`px-3 pt-4 pb-1 ${collapsed ? 'lg:hidden' : ''}`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Master
                </p>
              </li>

              {masterAccessItems.map(({ to, icon: Icon, label }) => (
                <li key={to}>
                  <NavLink to={to} onClick={onMobileClose} className={linkClass}>
                    <Icon size={18} className="flex-shrink-0" />
                    <span className={labelCls}>{label}</span>
                  </NavLink>
                </li>
              ))}
            </>
          )}
        </ul>
      </nav>

      {/* User & Collapse */}
      <div className="border-t border-slate-700 p-2">
        <div className="mb-1 flex items-center gap-3 px-3 py-2">
          <Avatar
            user={user}
            size="sm"
            className="ring-1 ring-slate-700"
            fallbackClassName="from-slate-700 to-slate-800 text-white"
          />

          <div className={collapsed ? 'min-w-0 lg:hidden' : 'min-w-0'}>
            <p className="truncate text-sm font-medium text-white">{user?.name}</p>
            <p className="text-xs capitalize text-slate-400">{user?.role}</p>
          </div>
        </div>

        <button
          onClick={() => {
            onMobileClose();
            logout();
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-all hover:bg-slate-800 hover:text-white"
        >
          <LogOut size={18} className="flex-shrink-0" />
          <span className={labelCls}>Logout</span>
        </button>

        {/* Collapse toggle — desktop only */}
        <button
          onClick={toggleCollapse}
          className="mt-1 hidden w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-500 transition-all hover:text-slate-300 lg:flex"
        >
          {collapsed ? (
            <ChevronRight size={14} />
          ) : (
            <>
              <ChevronLeft size={14} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
      </aside>
    </>
  );
};

export default Sidebar;
