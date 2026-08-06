import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit2,
  Eye,
  EyeOff,
  RefreshCw,
  UserCheck,
  UserX,
} from 'lucide-react';

import API from '../api/axios';
import { fetchDepartments, getDepartmentId, getDepartmentName } from '../api/departmentService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import {
  ALL_CUSTOMER_PERMISSIONS,
  ALL_EMPLOYEE_PERMISSIONS,
  ALL_INQUIRY_PERMISSIONS,
  ALL_PROJECT_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  CUSTOMER_PERMISSION_OPTIONS,
  INQUIRY_PERMISSIONS,
  INQUIRY_PERMISSION_OPTIONS,
  PROJECT_PERMISSION_OPTIONS,
  UNIVERSAL_EMPLOYEE_PERMISSIONS,
} from '../constants/permissions';

import Table from '../components/common/Table';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import Avatar from '../components/common/Avatar';

import {
  Button,
  Card,
  FormField,
  Input,
  Select,
} from '../components/common/FormComponents';

const ROLES = ['admin', 'hod', 'team_lead', 'employee'];

const normalizeDepartmentOption = (department) => {
  if (!department) return null;
  if (typeof department === 'string') {
    return { value: department, label: department, name: department, code: '' };
  }

  const value = getDepartmentId(department);
  const label = getDepartmentName(department);
  if (!value || !label) return null;

  return {
    ...department,
    value,
    label,
  };
};

const buildDepartmentOptions = (departments = []) => {
  const options = [];
  const seen = new Set();

  departments.forEach((department) => {
    const option = normalizeDepartmentOption(department);
    if (!option) return;
    const key = String(option.value || option.label).toUpperCase();
    if (seen.has(key)) return;
    seen.add(key);
    options.push(option);
  });

  return options.sort((a, b) => String(a.label || '').localeCompare(String(b.label || '')));
};

const getDepartmentDisplayValue = (value, departments = []) => {
  if (!value) return '';
  const key = String(getDepartmentId(value) || value).trim();
  const found = departments.find((department) => {
    const option = normalizeDepartmentOption(department);
    return option && (
      String(option.value) === key ||
      String(option.label).toUpperCase() === key.toUpperCase() ||
      String(option.code || '').toUpperCase() === key.toUpperCase()
    );
  });

  return found ? getDepartmentName(found) : getDepartmentName(value) || key;
};

const ensureSelectedDepartmentOption = (options = [], selectedValue = '') => {
  if (!selectedValue) return options;

  const selectedKey = String(getDepartmentId(selectedValue) || selectedValue).trim();
  if (!selectedKey) return options;

  const exists = options.some((department) => {
    const option = normalizeDepartmentOption(department);
    if (!option) return false;
    return (
      String(option.value) === selectedKey ||
      String(option.label).toUpperCase() === selectedKey.toUpperCase() ||
      String(option.code || '').toUpperCase() === selectedKey.toUpperCase()
    );
  });

  if (exists) return options;

  return [
    ...options,
    {
      value: selectedKey,
      label: `${getDepartmentName(selectedValue) || selectedKey} (legacy)`,
      legacy: true,
    },
  ];
};

const defaultForm = {
  name: '',
  email: '',
  password: '',
  role: 'employee',
  phone: '',
  avatar: '',
  department: '',
  hodDepartments: [],
  employeeAccess: [],
  isActive: true,
};

const ROLE_LABELS = {
  admin: 'Admin',
  hod: 'HOD',
  team_lead: 'Team Lead',
  employee: 'Employee',
};

const roleLabel = (role) =>
  ROLE_LABELS[role] ?? role.charAt(0).toUpperCase() + role.slice(1);

const getTeamName = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return '';
  return value.name ?? '';
};

const normalizeHodDepartments = (user = {}) => {
  if (Array.isArray(user.hodDepartments)) {
    return user.hodDepartments.map((item) => getDepartmentId(item) || item).filter(Boolean);
  }
  if (user.hodOfTeam) return [getDepartmentId(user.hodOfTeam) || user.hodOfTeam];
  return [];
};

const getUserDepartmentDisplay = (user = {}) => {
  if (user.role === 'admin') {
    return 'All';
  }

  if (user.role === 'hod') {
    if (Array.isArray(user.hodDepartmentNames) && user.hodDepartmentNames.length > 0) {
      return user.hodDepartmentNames.join(', ');
    }

    if (Array.isArray(user.hodDepartments) && user.hodDepartments.length > 0) {
      return user.hodDepartments.map((item) => getDepartmentDisplayValue(item)).join(', ');
    }

    return user.departmentName || getDepartmentDisplayValue(user.department) || getTeamName(user.teamId) || '—';
  }

  return user.departmentName || getDepartmentDisplayValue(user.department) || getTeamName(user.teamId) || '—';
};

const DepartmentChecklist = ({ value = [], onChange, departments = [] }) => {
  const selected = new Set(value);
  const departmentOptions = value.reduce(
    (options, departmentValue) => ensureSelectedDepartmentOption(options, departmentValue),
    departments
  );

  const toggleDepartment = (department) => {
    if (selected.has(department)) {
      onChange(value.filter((item) => item !== department));
    } else {
      onChange([...value, department]);
    }
  };

  const selectAll = () => {
    onChange(departments.map((department) => department.value));
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-700">
            Select HOD Department Ownership
          </p>
          <p className="text-xs text-gray-400">
            {value.length} selected
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={selectAll}
            disabled={departments.length === 0}
            className="font-medium text-blue-600 hover:text-blue-800 disabled:cursor-not-allowed disabled:text-gray-300"
          >
            Select All
          </button>

          <span className="text-gray-300">|</span>

          <button
            type="button"
            onClick={clearAll}
            className="font-medium text-red-500 hover:text-red-700"
          >
            Deselect All
          </button>
        </div>
      </div>

      {departmentOptions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-500">
          No active departments found. Please add departments in Department Master first.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {departmentOptions.map((department) => {
            const checked = selected.has(department.value);

            return (
              <label
                key={department.value}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  checked
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                } ${department.legacy ? 'border-amber-200 bg-amber-50 text-amber-700' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleDepartment(department.value)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>{department.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};


const getSuggestedEmployeeAccess = ({ role, department, hodDepartments = [] }, departments = []) => {
  if (role === 'admin') return [...ALL_EMPLOYEE_PERMISSIONS];

  const next = new Set(UNIVERSAL_EMPLOYEE_PERMISSIONS);
  const selectedDepartments = role === 'hod' ? hodDepartments : [department];
  const departmentNames = selectedDepartments.map((value) => (
    getDepartmentDisplayValue(value, departments).toUpperCase()
  ));

  if (departmentNames.some((name) => name === 'SALES' || name === 'ESTIMATION')) {
    ALL_INQUIRY_PERMISSIONS.forEach((permission) => next.add(permission));
    ALL_CUSTOMER_PERMISSIONS.forEach((permission) => next.add(permission));
  }

  if (departmentNames.some((name) => (
    name === 'DESIGN' || name === 'AUTOMATION' || name === 'PRODUCTION'
  ))) {
    ALL_PROJECT_PERMISSIONS.forEach((permission) => next.add(permission));
  }

  return ALL_EMPLOYEE_PERMISSIONS.filter((permission) => next.has(permission));
};

const hasCreateInquiryAccess = (permissions = []) => (
  Array.isArray(permissions) && permissions.includes(INQUIRY_PERMISSIONS.CREATE)
);

const normalizeEmployeeAccessDependencies = (permissions = []) => {
  const allowed = new Set(ALL_EMPLOYEE_PERMISSIONS);
  const next = new Set(
    (Array.isArray(permissions) ? permissions : []).filter((permission) => allowed.has(permission))
  );

  UNIVERSAL_EMPLOYEE_PERMISSIONS.forEach((permission) => next.add(permission));

  if (next.has(INQUIRY_PERMISSIONS.COMMERCIAL_SUBMIT)) {
    next.add(INQUIRY_PERMISSIONS.EDIT);
  }

  if (next.has(CUSTOMER_PERMISSIONS.EDIT)) {
    next.add(CUSTOMER_PERMISSIONS.VIEW);
  }

  // Creating an Inquiry requires Customer Master access. Other Inquiry
  // permissions do not automatically grant Customer access.
  if (hasCreateInquiryAccess([...next])) {
    ALL_CUSTOMER_PERMISSIONS.forEach((permission) => next.add(permission));
  }

  return ALL_EMPLOYEE_PERMISSIONS.filter((permission) => next.has(permission));
};

const AccessChecklist = ({
  title,
  description,
  options,
  value = [],
  onChange,
  disabled = false,
  onApplySuggested,
  footer,
  lockedKeys = [],
  lockedReason = '',
}) => {
  const selected = new Set(normalizeEmployeeAccessDependencies(value));
  const locked = new Set(lockedKeys);

  const toggle = (item) => {
    if (disabled || item.universal || locked.has(item.key)) return;
    const next = new Set(selected);

    if (next.has(item.key)) {
      next.delete(item.key);
      if (item.key === INQUIRY_PERMISSIONS.EDIT) {
        next.delete(INQUIRY_PERMISSIONS.COMMERCIAL_SUBMIT);
      }
      if (item.key === CUSTOMER_PERMISSIONS.VIEW) {
        next.delete(CUSTOMER_PERMISSIONS.EDIT);
      }
    } else {
      next.add(item.key);
      if (item.key === CUSTOMER_PERMISSIONS.EDIT) {
        next.add(CUSTOMER_PERMISSIONS.VIEW);
      }
    }

    onChange(normalizeEmployeeAccessDependencies([...next]));
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-800">{title}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={onApplySuggested}
            className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
          >
            Apply Suggested Access
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((item) => {
          const checked = selected.has(item.key);
          const dependencyLocked = locked.has(item.key);
          const itemDisabled = disabled || item.universal || dependencyLocked;
          return (
            <label
              key={item.key}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                checked
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600'
              } ${itemDisabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
              title={
                item.universal
                  ? 'View access is available to every authenticated user'
                  : dependencyLocked
                    ? lockedReason
                    : undefined
              }
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={itemDisabled}
                onChange={() => toggle(item)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                {item.label}
                {item.universal && <span className="ml-1 text-[10px] font-semibold uppercase text-blue-500">All</span>}
              </span>
            </label>
          );
        })}
      </div>

      {footer && <p className="mt-2 text-xs text-gray-500">{footer}</p>}
    </div>
  );
};

const InquiryAccessChecklist = (props) => (
  <AccessChecklist
    {...props}
    title="Inquiry Employee Access"
    description="View Inquiry is available to all. SALES / ESTIMATION is the suggested owner for the remaining actions."
    options={INQUIRY_PERMISSION_OPTIONS}
    footer="Delete Inquiry remains unavailable because all delete APIs are removed."
  />
);

const ProjectAccessChecklist = (props) => (
  <AccessChecklist
    {...props}
    title="Project Employee Access"
    description="View Project is available to all. DESIGN / AUTOMATION / PRODUCTION is the suggested owner for the remaining actions."
    options={PROJECT_PERMISSION_OPTIONS}
  />
);

const CustomerAccessChecklist = ({ createInquiryActive = false, ...props }) => (
  <AccessChecklist
    {...props}
    title="Customer Employee Access"
    description="Customer access is granted automatically when Create Inquiry is enabled."
    options={CUSTOMER_PERMISSION_OPTIONS}
    lockedKeys={createInquiryActive ? ALL_CUSTOMER_PERMISSIONS : []}
    lockedReason="Customer access is required while Create Inquiry is enabled."
    footer={
      createInquiryActive
        ? 'Automatically enabled because Create Inquiry is selected. Uncheck Create Inquiry before changing Customer access separately.'
        : 'Customer deletion remains unavailable because all delete APIs are removed.'
    }
  />
);

const UserForm = ({
  initialData,
  onSubmit,
  loading,
  departments = [],
}) => {
  const [form, setForm] = useState({ ...defaultForm });
  const [showPass, setShowPass] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');

  useEffect(() => {
    if (initialData) {
      setForm({
        ...defaultForm,
        name: initialData.name ?? '',
        email: initialData.email ?? '',
        password: '',
        role: initialData.role ?? 'employee',
        phone: initialData.phone ?? '',
        avatar: initialData.avatar ?? '',
        department: getDepartmentId(initialData.department) || initialData.department || '',
        hodDepartments: normalizeHodDepartments(initialData),
        employeeAccess: normalizeEmployeeAccessDependencies(
          initialData.employeeAccess ?? initialData.effectiveEmployeeAccess ?? []
        ),
        isActive: initialData.isActive ?? true,
      });
      setAvatarPreview(initialData.avatar ?? '');
      setAvatarFile(null);
    } else {
      setForm({ ...defaultForm });
      setAvatarPreview('');
      setAvatarFile(null);
    }
  }, [initialData]);

  const set =
    (field) => (e) =>
      setForm((prev) => ({
        ...prev,
        [field]: e.target.value,
      }));

  const handleAvatarFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleRoleChange = (e) => {
    const role = e.target.value;

    setForm((prev) => {
      const next = {
        ...prev,
        role,
      };

      if (role === 'admin') {
        next.department = '';
        next.hodDepartments = [];
      }

      if (role === 'hod') {
        next.department = '';
      }

      if (role === 'team_lead' || role === 'employee') {
        next.hodDepartments = [];
      }

      next.employeeAccess = getSuggestedEmployeeAccess(next, departments);
      return next;
    });
  };

  const handleDepartmentChange = (event) => {
    const department = event.target.value;
    setForm((prev) => {
      const next = { ...prev, department };
      next.employeeAccess = getSuggestedEmployeeAccess(next, departments);
      return next;
    });
  };

  const applySuggestedModuleAccess = (modulePermissions) => {
    setForm((prev) => {
      const suggested = new Set(getSuggestedEmployeeAccess(prev, departments));
      const next = new Set(normalizeEmployeeAccessDependencies(prev.employeeAccess));

      modulePermissions.forEach((permission) => next.delete(permission));
      modulePermissions.forEach((permission) => {
        if (suggested.has(permission)) next.add(permission);
      });

      return {
        ...prev,
        employeeAccess: normalizeEmployeeAccessDependencies([...next]),
      };
    });
  };

  const applySuggestedInquiryAccess = () => applySuggestedModuleAccess(ALL_INQUIRY_PERMISSIONS);
  const applySuggestedProjectAccess = () => applySuggestedModuleAccess(ALL_PROJECT_PERMISSIONS);
  const applySuggestedCustomerAccess = () => applySuggestedModuleAccess(ALL_CUSTOMER_PERMISSIONS);

  const showDepartment = form.role === 'employee' || form.role === 'team_lead';
  const showHodDepartments = form.role === 'hod';
  const departmentOptions = ensureSelectedDepartmentOption(departments, form.department);
  const createInquiryActive = form.role === 'admin' || hasCreateInquiryAccess(form.employeeAccess);

  const handleSubmit = (e) => {
    e.preventDefault();

    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      avatar: form.avatar,
      role: form.role,
      isActive: form.isActive,
      department: form.department,
      hodDepartments: form.hodDepartments,
      employeeAccess: form.role === 'admin'
        ? [...ALL_EMPLOYEE_PERMISSIONS]
        : normalizeEmployeeAccessDependencies(form.employeeAccess),
    };

    if (form.password) {
      payload.password = form.password;
    }

    if (form.role === 'admin') {
      payload.department = '';
      payload.hodDepartments = [];
    }

    if (form.role === 'hod') {
      payload.department = '';
    }

    if (form.role === 'team_lead' || form.role === 'employee') {
      payload.hodDepartments = [];
    }

    onSubmit(payload, avatarFile);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
        <Avatar
          user={{ ...initialData, ...form, avatar: avatarPreview || form.avatar }}
          name={form.name || initialData?.name}
          src={avatarPreview || form.avatar}
          size="xl"
          className="ring-2 ring-white shadow-sm"
        />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">Profile Photo</p>
          <p className="mt-0.5 text-xs text-gray-500">Optional. JPG, PNG, WEBP or GIF up to 2 MB.</p>
          <input
            type="file"
            accept="image/*"
            onChange={handleAvatarFileChange}
            className="mt-3 block w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
            disabled={loading}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="Full Name"
          required
        >
          <Input
            placeholder="Full name"
            value={form.name}
            onChange={set('name')}
            required
          />
        </FormField>

        <FormField
          label="Email"
          required
        >
          <Input
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={set('email')}
            required
          />
        </FormField>

        <FormField
          label={
            initialData
              ? 'New Password (leave blank to keep)'
              : 'Password'
          }
          required={!initialData}
        >
          <div className="relative">
            <Input
              type={
                showPass
                  ? 'text'
                  : 'password'
              }
              placeholder={
                initialData
                  ? 'Leave blank to keep current'
                  : 'Min 8 characters'
              }
              value={form.password}
              onChange={set('password')}
              required={!initialData}
              minLength={
                !initialData
                  ? 8
                  : undefined
              }
              className="pr-10"
            />

            <button
              type="button"
              onClick={() =>
                setShowPass(!showPass)
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPass ? (
                <EyeOff size={15} />
              ) : (
                <Eye size={15} />
              )}
            </button>
          </div>
        </FormField>

        <FormField label="Phone">
          <Input
            placeholder="Phone number"
            value={form.phone}
            onChange={set('phone')}
          />
        </FormField>

        <FormField label="Designation / Role">
          <Select
            value={form.role}
            onChange={handleRoleChange}
          >
            {ROLES.map((r) => (
              <option
                key={r}
                value={r}
              >
                {roleLabel(r)}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Status">
          <Select
            value={form.isActive}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                isActive:
                  e.target.value ===
                  'true',
              }))
            }
          >
            <option value="true">
              Active
            </option>

            <option value="false">
              Inactive
            </option>
          </Select>
        </FormField>

        {showDepartment && (
          <FormField
            label="Department / Team"
            required
          >
            <Select
              value={form.department}
              onChange={handleDepartmentChange}
              required
              disabled={departmentOptions.length === 0}
            >
              <option value="">
                Select Department / Team
              </option>

              {departmentOptions.length === 0 && (
                <option value="" disabled>
                  No active departments found
                </option>
              )}

              {departmentOptions.map((department) => (
                <option
                  key={department.value}
                  value={department.value}
                >
                  {department.label}
                </option>
              ))}
            </Select>
          </FormField>
        )}

        {showHodDepartments && (
          <div className="sm:col-span-2">
            <FormField
              label="HOD Department Ownership"
              required
            >
              <DepartmentChecklist
                value={form.hodDepartments}
                departments={departments}
                onChange={(nextDepartments) =>
                  setForm((prev) => {
                    const next = {
                      ...prev,
                      hodDepartments: nextDepartments,
                    };
                    next.employeeAccess = getSuggestedEmployeeAccess(next, departments);
                    return next;
                  })
                }
              />
            </FormField>
          </div>
        )}

        <div className="sm:col-span-2">
          <InquiryAccessChecklist
            value={form.role === 'admin' ? ALL_EMPLOYEE_PERMISSIONS : form.employeeAccess}
            disabled={form.role === 'admin'}
            onApplySuggested={applySuggestedInquiryAccess}
            onChange={(employeeAccess) => setForm((prev) => ({ ...prev, employeeAccess }))}
          />
          <div className="mt-3">
            <ProjectAccessChecklist
              value={form.role === 'admin' ? ALL_EMPLOYEE_PERMISSIONS : form.employeeAccess}
              disabled={form.role === 'admin'}
              onApplySuggested={applySuggestedProjectAccess}
              onChange={(employeeAccess) => setForm((prev) => ({ ...prev, employeeAccess }))}
            />
          </div>
          <div className="mt-3">
            <CustomerAccessChecklist
              value={form.role === 'admin' ? ALL_EMPLOYEE_PERMISSIONS : form.employeeAccess}
              disabled={form.role === 'admin'}
              createInquiryActive={createInquiryActive}
              onApplySuggested={applySuggestedCustomerAccess}
              onChange={(employeeAccess) => setForm((prev) => ({ ...prev, employeeAccess }))}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-gray-100">
        <Button
          type="submit"
          loading={loading}
        >
          {initialData
            ? 'Update User'
            : 'Create User'}
        </Button>
      </div>
    </form>
  );
};

const UsersPage = () => {
  const toast = useToast();

  const { user: currentUser, updateAuthUser } =
    useAuth();

  const [users, setUsers] = useState(
    []
  );

  const [departments, setDepartments] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [addModal, setAddModal] =
    useState(false);

  const [editModal, setEditModal] =
    useState(false);

  const [selected, setSelected] =
    useState(null);

  const [selectedRoleFilters, setSelectedRoleFilters] = useState([]);

  const fetchDepartmentOptions = useCallback(async () => {
    try {
      const data = await fetchDepartments();
      setDepartments(buildDepartmentOptions(Array.isArray(data) ? data : []));
    } catch {
      setDepartments([]);
      toast.error('Failed to load Department Master');
    }
  }, [toast]);

  const fetchUsers = useCallback(
    async () => {
      setLoading(true);

      try {
        const { data } =
          await API.get('/users');

        setUsers(data.data);
      } catch {
        toast.error(
          'Failed to load users'
        );
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    fetchDepartmentOptions();
    fetchUsers();
  }, [fetchDepartmentOptions, fetchUsers]);

  useEffect(() => {
    const handleAuthUserUpdated = (event) => {
      const updatedUser = event.detail;
      if (!updatedUser?._id) return;

      setUsers((current) =>
        current.map((item) =>
          item._id === updatedUser._id ? { ...item, ...updatedUser } : item
        )
      );
    };

    window.addEventListener('nexus:user-updated', handleAuthUserUpdated);
    return () => window.removeEventListener('nexus:user-updated', handleAuthUserUpdated);
  }, []);

  const uploadUserAvatar = async (userId, file) => {
    if (!userId || !file) return null;

    const payload = new FormData();
    payload.append('avatar', file);

    const { data } = await API.post(`/users/${userId}/avatar`, payload);
    return data.data;
  };

  const handleAdd = async (
    formData,
    avatarFile
  ) => {
    setSubmitting(true);

    try {
      const { data } = await API.post(
        '/users',
        formData
      );

      if (avatarFile && data.data?._id) {
        await uploadUserAvatar(data.data._id, avatarFile);
      }

      toast.success(
        'User created successfully'
      );

      setAddModal(false);

      fetchUsers();
    } catch (err) {
      toast.error(
        err.response?.data
          ?.message ||
        'Failed to create user'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (
    formData,
    avatarFile
  ) => {
    setSubmitting(true);

    try {
      const { data } = await API.put(
        `/users/${selected._id}`,
        formData
      );

      let updatedUser = data.data;

      if (avatarFile) {
        updatedUser = await uploadUserAvatar(selected._id, avatarFile);
      }

      if (currentUser?._id === selected._id && updatedUser) {
        updateAuthUser(updatedUser);
      }

      toast.success(
        'User updated successfully'
      );

      setEditModal(false);

      setSelected(null);

      await Promise.all([
        fetchUsers(),
        fetchDepartmentOptions(),
      ]);
    } catch (err) {
      toast.error(
        err.response?.data
          ?.message ||
        'Failed to update user'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const toggleRoleFilter = (role) => {
    setSelectedRoleFilters((current) => (
      current.includes(role)
        ? current.filter((item) => item !== role)
        : [...current, role]
    ));
  };

  const clearRoleFilters = () => {
    setSelectedRoleFilters([]);
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',

      render: (v, row) => (
        <div className="flex items-center gap-3">
          <Avatar user={row} name={v} size="sm" />

          <div>
            <p className="font-medium text-gray-800">
              {v}
            </p>

            <p className="text-xs text-gray-400">
              {row.email}
            </p>
          </div>
        </div>
      ),
    },

    {
      key: 'phone',
      label: 'Phone',
      width: '130px',

      render: (v) => v || '—',
    },

    {
      key: 'role',
      label: 'Designation',
      width: '130px',

      render: (v) => (
        <StatusBadge
          status={roleLabel(v)}
        />
      ),
    },

    {
      key: 'department',
      label: 'Department / Team',
      width: '220px',

      render: (_, row) =>
        getUserDepartmentDisplay(row),
    },

    {
      key: 'isActive',
      label: 'Status',
      width: '90px',

      render: (v) => (
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${v
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
            }`}
        >
          {v ? (
            <UserCheck size={12} />
          ) : (
            <UserX size={12} />
          )}

          {v
            ? 'Active'
            : 'Inactive'}
        </span>
      ),
    },

    {
      key: 'createdAt',
      label: 'Joined',
      width: '110px',

      render: (v) =>
        new Date(v).toLocaleDateString(
          'en-IN'
        ),
    },

    {
      key: '_id',
      label: 'Actions',
      width: '100px',

      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setSelected(row);
              setEditModal(true);
            }}
            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded"
          >
            <Edit2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  const admins = users.filter((u) => u.role === 'admin').length;
  const hods = users.filter((u) => u.role === 'hod').length;
  const teamLeads = users.filter((u) => u.role === 'team_lead').length;
  const employees = users.filter((u) => u.role === 'employee').length;

  const roleStats = [
    {
      role: 'admin',
      label: 'Admins',
      count: admins,
      color: 'bg-purple-50 border-purple-200',
      activeColor: 'border-purple-500 bg-purple-100 ring-purple-100',
      text: 'text-purple-700',
    },
    {
      role: 'hod',
      label: 'HODs',
      count: hods,
      color: 'bg-indigo-50 border-indigo-200',
      activeColor: 'border-indigo-500 bg-indigo-100 ring-indigo-100',
      text: 'text-indigo-700',
    },
    {
      role: 'team_lead',
      label: 'Team Leads',
      count: teamLeads,
      color: 'bg-blue-50 border-blue-200',
      activeColor: 'border-blue-500 bg-blue-100 ring-blue-100',
      text: 'text-blue-700',
    },
    {
      role: 'employee',
      label: 'Employees',
      count: employees,
      color: 'bg-green-50 border-green-200',
      activeColor: 'border-green-500 bg-green-100 ring-green-100',
      text: 'text-green-700',
    },
  ];

  const filteredUsers = selectedRoleFilters.length === 0
    ? users
    : users.filter((user) => selectedRoleFilters.includes(user.role));

  return (
    <div className="space-y-4 fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            User Management
          </h2>

          <p className="text-sm text-gray-500">
            {selectedRoleFilters.length > 0
              ? `${filteredUsers.length} of ${users.length} users shown`
              : `${users.length} total users`}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              fetchDepartmentOptions();
              fetchUsers();
            }}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw size={15} />
          </button>

          <Button
            onClick={() =>
              setAddModal(true)
            }
            className="flex-1 justify-center sm:flex-none"
          >
            <Plus size={16} />
            Add User
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {roleStats.map(({ role, label, count, color, activeColor, text }) => {
          const selected = selectedRoleFilters.includes(role);

          return (
            <button
              key={role}
              type="button"
              onClick={() => toggleRoleFilter(role)}
              aria-pressed={selected}
              className={`rounded-xl border p-4 text-center transition-all hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus:ring-2 ${
                selected ? `${activeColor} ring-2` : color
              }`}
            >
              <p className={`text-2xl font-bold ${text}`}>{count}</p>
              <p className="mt-1 text-sm text-gray-500">{label}</p>
              {selected && (
                <p className="mt-1 text-[11px] font-medium text-gray-500">Filter applied</p>
              )}
            </button>
          );
        })}
      </div>

      {selectedRoleFilters.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          <span>
            Showing: {selectedRoleFilters.map((role) => roleLabel(role)).join(', ')}
          </span>
          <button
            type="button"
            onClick={clearRoleFilters}
            className="font-medium text-blue-700 hover:text-blue-900"
          >
            Clear filters
          </button>
        </div>
      )}

      <Card>
        <Table
          columns={columns}
          data={filteredUsers}
          loading={loading}
          emptyMessage={selectedRoleFilters.length > 0 ? 'No users found for selected filters.' : 'No users found.'}
        />
      </Card>

      <Modal
        isOpen={addModal}
        onClose={() =>
          setAddModal(false)
        }
        title="Add New User"
        size="md"
      >
        <UserForm
          onSubmit={handleAdd}
          loading={submitting}
          departments={departments}
        />
      </Modal>

      <Modal
        isOpen={editModal}
        onClose={() => {
          setEditModal(false);
          setSelected(null);
        }}
        title="Edit User"
        size="md"
      >
        {selected && (
          <UserForm
            initialData={selected}
            onSubmit={handleEdit}
            loading={submitting}
            departments={departments}
          />
        )}
      </Modal>
    </div>
  );
};

export default UsersPage;