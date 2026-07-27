import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bell,
  Briefcase,
  Camera,
  ChevronDown,
  Edit3,
  FileText,
  FolderKanban,
  Grid3X3,
  KeyRound,
  LifeBuoy,
  LogOut,
  Mail,
  Menu,
  Shield,
  Users,
  X,
} from 'lucide-react';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import Avatar from './Avatar';

const routeTitles = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/inquiries': 'Inquiries',
  '/inquiries/add': 'Add Inquiry',
  '/inquiries/new': 'Add Inquiry',
  '/projects': 'Projects',
  '/customers': 'Customers',
  '/tickets': 'Tickets',
  '/notifications': 'Notifications',
  '/users': 'User Management',
  '/timesheet': 'Timesheet',
  '/timesheet/admin': 'Timesheet Admin',
};

// Pages that render their own full page header via the shared <PageHeader>
// component (see components/common/PageHeader.jsx) instead of the global
// Topbar. This is the ONLY place that needs to know about those routes —
// no other file, and no Topbar-adjacent page, should special-case itself.
// Add a matcher here whenever a new page adopts <PageHeader>.
const FULL_PAGE_HEADER_ROUTES = [
  (path) => path.startsWith('/projects/') && path !== '/projects',
  (path) =>
    path === '/inquiries/add' ||
    path === '/inquiries/new' ||
    /^\/inquiries\/[^/]+(\/edit)?$/.test(path),
  (path) => path.startsWith('/tickets/') && path !== '/tickets',
  (path) => path.startsWith('/customers/') && path !== '/customers',
];

const hasOwnPageHeader = (pathname) =>
  FULL_PAGE_HEADER_ROUTES.some((matches) => matches(pathname));

const dashboardTabs = [
  { key: 'all', label: 'All', icon: Grid3X3 },
  { key: 'inquiry', label: 'Inquiry', icon: FileText },
  { key: 'project', label: 'Project', icon: FolderKanban },
  { key: 'ticket', label: 'Ticket', icon: LifeBuoy },
];

const roleLabel = (role) => {
  const map = {
    admin: 'Admin',
    hod: 'HOD',
    manager: 'Manager',
    team_lead: 'Team Lead',
    employee: 'Employee',
  };

  return map[role] || role || 'User';
};

const ProfileModalShell = ({ title, children, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4 py-4 backdrop-blur-sm sm:py-6">
    <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl sm:max-h-[calc(100vh-3rem)]">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      {children}
    </div>
  </div>
);

const ProfileMessage = ({ type, children }) => {
  if (!children) return null;

  const classes =
    type === 'success'
      ? 'border-green-200 bg-green-50 text-green-700'
      : 'border-red-200 bg-red-50 text-red-700';

  return <div className={`rounded-xl border px-4 py-3 text-sm ${classes}`}>{children}</div>;
};

const EditProfileModal = ({ user, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: user?.name || user?.fullName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const avatarInputRef = useRef(null);

  useEffect(() => {
    setForm({
      name: user?.name || user?.fullName || '',
      email: user?.email || '',
      phone: user?.phone || '',
    });
    setError('');
    setSuccess('');
  }, [user]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
    setSuccess('');
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type?.startsWith('image/')) {
      setError('Please upload a valid image file');
      event.target.value = '';
      return;
    }

    const payload = new FormData();
    payload.append('avatar', file);

    setAvatarUploading(true);
    setError('');
    setSuccess('');

    try {
      const { data } = await API.post('/auth/profile/avatar', payload);
      onSaved(data.user);
      setSuccess(data.message || 'Profile photo updated successfully');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to upload profile photo');
    } finally {
      setAvatarUploading(false);
      event.target.value = '';
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
    };

    if (!payload.name) {
      setError('Full name is required');
      return;
    }

    if (!payload.email) {
      setError('Email is required');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { data } = await API.put('/auth/profile', payload);
      onSaved(data.user);
      setSuccess(data.message || 'Profile updated successfully');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update profile');
    } finally {
      setSaving(false);
    }
  };

  const userRole = roleLabel(user?.role);
  const userDepartment = user?.department || user?.teamName || user?.team?.name || '';

  return (
    <ProfileModalShell title="Edit Profile" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <ProfileMessage type="error">{error}</ProfileMessage>
          <ProfileMessage type="success">{success}</ProfileMessage>

          <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <Avatar user={user} name={form.name || user?.name} size="xl" className="ring-2 ring-white shadow-sm" />

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">Profile Photo</p>
              <p className="mt-0.5 text-xs text-gray-500">JPG, PNG, WEBP or GIF up to 2 MB.</p>

              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={saving || avatarUploading}
              />

              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={saving || avatarUploading}
              >
                <Camera size={14} />
                {avatarUploading ? 'Uploading...' : 'Upload Photo'}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Enter full name"
              disabled={saving}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Enter email"
              disabled={saving}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone</label>
            <input
              type="text"
              value={form.phone}
              onChange={(event) => updateField('phone', event.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="+91XXXXXXXXXX"
              disabled={saving}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Role</label>
              <input
                type="text"
                value={userRole}
                readOnly
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500 outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Department / Team</label>
              <input
                type="text"
                value={userDepartment || '—'}
                readOnly
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </ProfileModalShell>
  );
};

const ChangePasswordModal = ({ onClose }) => {
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const inputClass = (fieldName) =>
    `w-full rounded-xl border px-3 py-2.5 text-sm text-gray-900 outline-none transition ${
      fieldErrors[fieldName]
        ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100'
        : 'border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
    }`;

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: '' }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextFieldErrors = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    };

    if (!form.currentPassword) {
      nextFieldErrors.currentPassword = 'Current password is required';
    }

    if (!form.newPassword) {
      nextFieldErrors.newPassword = 'New password is required';
    } else if (form.newPassword.length < 8) {
      nextFieldErrors.newPassword = 'New password must be at least 8 characters';
    }

    if (!form.confirmPassword) {
      nextFieldErrors.confirmPassword = 'Confirm password is required';
    } else if (form.newPassword !== form.confirmPassword) {
      nextFieldErrors.confirmPassword = 'New password and confirm password do not match';
    }

    if (
      nextFieldErrors.currentPassword ||
      nextFieldErrors.newPassword ||
      nextFieldErrors.confirmPassword
    ) {
      setFieldErrors(nextFieldErrors);
      setError('');
      setSuccess('');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    setFieldErrors(nextFieldErrors);

    try {
      const { data } = await API.put('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });

      setSuccess(data.message || 'Password changed successfully');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      const message = err.response?.data?.message || 'Unable to change password';
      const lowerMessage = String(message).toLowerCase();

      if (lowerMessage.includes('current password') || lowerMessage.includes('incorrect')) {
        setFieldErrors((current) => ({
          ...current,
          currentPassword: 'Current password does not match',
        }));
        setError('');
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProfileModalShell title="Change Password" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <ProfileMessage type="error">{error}</ProfileMessage>
          <ProfileMessage type="success">{success}</ProfileMessage>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Current Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={form.currentPassword}
              onChange={(event) => updateField('currentPassword', event.target.value)}
              className={inputClass('currentPassword')}
              placeholder="Enter current password"
              disabled={saving}
            />
            {fieldErrors.currentPassword && (
              <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.currentPassword}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              New Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={form.newPassword}
              onChange={(event) => updateField('newPassword', event.target.value)}
              className={inputClass('newPassword')}
              placeholder="Minimum 8 characters"
              disabled={saving}
            />
            {fieldErrors.newPassword && (
              <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.newPassword}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Confirm New Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(event) => updateField('confirmPassword', event.target.value)}
              className={inputClass('confirmPassword')}
              placeholder="Re-enter new password"
              disabled={saving}
            />
            {fieldErrors.confirmPassword && (
              <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.confirmPassword}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={saving}
          >
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </form>
    </ProfileModalShell>
  );
};

const Topbar = ({ onMenuClick = () => {} }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout, updateAuthUser } = useAuth();

  const [unreadCount, setUnreadCount] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeModal, setActiveModal] = useState('');

  const profileRef = useRef(null);

  const isDashboard = location.pathname === '/' || location.pathname === '/dashboard';

  const title =
    routeTitles[location.pathname] ||
    (location.pathname.startsWith('/timesheet')
      ? 'Timesheet'
      : location.pathname.startsWith('/projects/')
        ? 'Project Details'
        : 'Electrical CRM');

  const requestedDashboardTab = searchParams.get('dashboardTab') || 'all';

  const activeDashboardTab = dashboardTabs.some((tab) => tab.key === requestedDashboardTab)
    ? requestedDashboardTab
    : 'all';

  const userName = user?.name || user?.fullName || 'User';
  const userRole = roleLabel(user?.role);
  const userDepartment = user?.department || user?.teamName || user?.team?.name || '';
  const userEmail = user?.email || '';

  const currentDate = useMemo(
    () =>
      new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    []
  );

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const { data } = await API.get('/notifications?isRead=false&limit=1');
        setUnreadCount(data.unreadCount || 0);
      } catch {
        setUnreadCount(0);
      }
    };

    fetchUnread();
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDashboardTabClick = (tabKey) => {
    const params = new URLSearchParams(searchParams);

    if (tabKey === 'all') {
      params.delete('dashboardTab');
    } else {
      params.set('dashboardTab', tabKey);
    }

    const search = params.toString();

    navigate({
      pathname: '/',
      search: search ? `?${search}` : '',
    });
  };

  const handleLogout = () => {
    setProfileOpen(false);
    logout();
    navigate('/auth/login', { replace: true });
  };

  const openProfileModal = (modalName) => {
    setProfileOpen(false);
    setActiveModal(modalName);
  };

  const closeModal = () => setActiveModal('');

  const handleProfileSaved = (updatedUser) => {
    updateAuthUser(updatedUser);
  };

  if (hasOwnPageHeader(location.pathname)) {
    return null;
  }

  return (
    <>
      <header className="sticky top-0 z-[1000] border-b border-gray-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-6">
        <div className="relative flex min-h-[52px] items-center justify-between gap-2 sm:gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 pr-1 sm:pr-4">
            {/* Hamburger — opens the mobile sidebar drawer (mobile/tablet only) */}
            <button
              type="button"
              onClick={onMenuClick}
              aria-label="Open menu"
              className="-ml-1 inline-flex shrink-0 items-center justify-center rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 lg:hidden"
            >
              <Menu size={20} />
            </button>

            <div className="min-w-0 flex-1">
              {isDashboard ? (
                <>
                  <h1
                    className="truncate text-lg font-semibold tracking-tight text-gray-900 sm:text-xl"
                    style={{ fontFamily: '"Segoe UI", "Inter", Arial, sans-serif' }}
                  >
                    Hello, {userName} 👋
                  </h1>
                  <p className="mt-0.5 truncate text-xs font-medium text-gray-400">{currentDate}</p>
                </>
              ) : (
                <>
                  <h1 className="truncate text-lg font-semibold text-gray-900">{title}</h1>
                  <p className="truncate text-xs text-gray-400">{currentDate}</p>
                </>
              )}
            </div>
          </div>

          {isDashboard && (
            <nav
              className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 lg:block"
              aria-label="Dashboard module filters"
            >
              <div className="pointer-events-auto flex items-center justify-center gap-5">
                {dashboardTabs.map((tab, index) => {
                  const isActive = activeDashboardTab === tab.key;

                  return (
                    <React.Fragment key={tab.key}>
                      {index > 0 && (
                        <span
                          className="h-1 w-1 rounded-full bg-slate-300"
                          aria-hidden="true"
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => handleDashboardTabClick(tab.key)}
                        className={`group relative rounded-full px-1 py-2 text-xs font-extrabold uppercase tracking-[0.12em] transition-all duration-200 ${
                          isActive ? 'text-blue-700' : 'text-slate-600 hover:text-blue-700'
                        }`}
                        aria-pressed={isActive}
                      >
                        <span className="relative z-10">{tab.label}</span>
                        <span
                          className={`absolute inset-x-0 -bottom-1 mx-auto h-0.5 rounded-full transition-all duration-200 ${
                            isActive ? 'w-full bg-blue-700' : 'w-0 bg-blue-500 group-hover:w-full'
                          }`}
                        />
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            </nav>
          )}

          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="relative rounded-xl p-2.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label="Open notifications"
            >
              <Bell size={20} />

              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((value) => !value)}
                className="flex h-10 w-10 items-center justify-center rounded-full p-0.5 shadow-sm ring-1 ring-blue-100 transition-all hover:shadow-md"
                aria-expanded={profileOpen}
                aria-label="Open profile menu"
              >
                <Avatar user={user} name={userName} size="md" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 z-[1001] mt-2 max-h-[calc(100vh-6rem)] w-[calc(100vw-2rem)] max-w-xs overflow-y-auto rounded-2xl border border-gray-100 bg-white shadow-xl sm:w-80">
                  <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-5 text-white">
                    <div className="flex items-center gap-3">
                      <Avatar
                        user={user}
                        name={userName}
                        size="lg"
                        className="ring-1 ring-white/30 shadow-sm"
                        fallbackClassName="from-white/20 to-white/10 text-white"
                      />

                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold">{userName}</p>
                        <p className="text-xs text-blue-100">{userRole}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 border-b border-gray-100 p-4 text-sm">
                    <div className="flex items-start gap-3 text-gray-600">
                      <Shield size={16} className="mt-0.5 text-gray-400" />
                      <span>{userRole}</span>
                    </div>

                    {userDepartment && (
                      <div className="flex items-start gap-3 text-gray-600">
                        <Briefcase size={16} className="mt-0.5 text-gray-400" />
                        <span>{userDepartment}</span>
                      </div>
                    )}

                    {userEmail && (
                      <div className="flex items-start gap-3 text-gray-600">
                        <Mail size={16} className="mt-0.5 text-gray-400" />
                        <span className="break-all">{userEmail}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-2">
                    <button
                      type="button"
                      onClick={() => openProfileModal('editProfile')}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <Edit3 size={16} className="text-gray-400" />
                      Edit Profile
                    </button>

                    <button
                      type="button"
                      onClick={() => openProfileModal('changePassword')}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <KeyRound size={16} className="text-gray-400" />
                      Change Password
                    </button>

                    {user?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          navigate('/users');
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        <Users size={16} className="text-gray-400" />
                        User Management
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {isDashboard && (
          <nav className="mt-3 overflow-x-auto lg:hidden" aria-label="Dashboard module filters mobile">
            <div className="flex min-w-max items-center justify-start gap-4">
              {dashboardTabs.map((tab, index) => {
                const isActive = activeDashboardTab === tab.key;

                return (
                  <React.Fragment key={tab.key}>
                    {index > 0 && (
                      <span
                        className="h-1 w-1 rounded-full bg-slate-300"
                        aria-hidden="true"
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => handleDashboardTabClick(tab.key)}
                      className={`group relative rounded-full px-1 py-2 text-xs font-extrabold uppercase tracking-[0.12em] transition-all duration-200 ${
                        isActive ? 'text-blue-700' : 'text-slate-600 hover:text-blue-700'
                      }`}
                      aria-pressed={isActive}
                    >
                      <span className="relative z-10">{tab.label}</span>
                      <span
                        className={`absolute inset-x-0 -bottom-1 mx-auto h-0.5 rounded-full transition-all duration-200 ${
                          isActive ? 'w-full bg-blue-700' : 'w-0 bg-blue-500 group-hover:w-full'
                        }`}
                      />
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </nav>
        )}
      </header>

      {activeModal === 'editProfile' && (
        <EditProfileModal user={user} onClose={closeModal} onSaved={handleProfileSaved} />
      )}

      {activeModal === 'changePassword' && <ChangePasswordModal onClose={closeModal} />}
    </>
  );
};

export default Topbar;