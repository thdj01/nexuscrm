import React, { useEffect, useState } from 'react';

import {
  Button,
  FormField,
  Input,
  Select,
} from '../common/FormComponents';

const defaultForm = {
  name: '',
  code: '',
  hods: [],
  teamLead: '',
  isActive: true,
};

const getUserId = (user) => String(user?._id || user?.id || user || '');

const normalizeInitialHods = (department = {}) => {
  if (Array.isArray(department.hods) && department.hods.length > 0) {
    return department.hods.map(getUserId).filter(Boolean);
  }

  if (department.hod) {
    return [getUserId(department.hod)].filter(Boolean);
  }

  return [];
};

const normalizeInitialTeamLead = (department = {}) => getUserId(department.teamLead);

const DepartmentForm = ({
  initialData = null,
  users = [],
  loading = false,
  onSubmit,
}) => {
  const [form, setForm] = useState({ ...defaultForm });

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || '',
        code: initialData.code || '',
        hods: normalizeInitialHods(initialData),
        teamLead: normalizeInitialTeamLead(initialData),
        isActive: initialData.isActive !== false,
      });
      return;
    }

    setForm({ ...defaultForm });
  }, [initialData]);

  const set = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({
      ...prev,
      [field]: field === 'isActive' ? value === 'true' : value,
    }));
  };

  const toggleHod = (userId) => {
    setForm((prev) => {
      const current = new Set(prev.hods || []);
      if (current.has(userId)) {
        current.delete(userId);
      } else {
        current.add(userId);
      }

      return {
        ...prev,
        hods: [...current],
      };
    });
  };

  const clearHods = () => {
    setForm((prev) => ({ ...prev, hods: [] }));
  };

  const setTeamLead = (userId) => {
    setForm((prev) => ({
      ...prev,
      teamLead: prev.teamLead === userId ? '' : userId,
    }));
  };

  const clearTeamLead = () => {
    setForm((prev) => ({ ...prev, teamLead: '' }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const hods = Array.from(new Set(form.hods || [])).filter(Boolean);

    onSubmit?.({
      name: form.name,
      code: form.code,
      hods,
      // Backward-compatible first HOD value for older backend code during deployment.
      hod: hods[0] || null,
      teamLead: form.teamLead || null,
      isActive: form.isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Department Name" required>
          <Input
            value={form.name}
            onChange={set('name')}
            placeholder="Example: DESIGN"
            required
          />
        </FormField>

        <FormField label="Department Code" required>
          <Input
            value={form.code}
            onChange={set('code')}
            placeholder="Example: DES"
            required
          />
        </FormField>

        <div className="sm:col-span-2">
          <FormField label="HODs">
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Select one or more HODs</p>
                  <p className="text-xs text-gray-400">
                    All active employees are shown · {form.hods.length} selected
                  </p>
                </div>

                <button
                  type="button"
                  onClick={clearHods}
                  className="text-xs font-medium text-red-500 hover:text-red-700"
                >
                  Clear
                </button>
              </div>

              {users.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-500">
                  No active employees found.
                </div>
              ) : (
                <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                  {users.map((user) => {
                    const userId = getUserId(user);
                    const checked = form.hods.includes(userId);

                    return (
                      <label
                        key={userId}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                          checked
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleHod(userId)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="min-w-0 truncate">
                          {user.name} {user.role ? `(${user.role})` : ''}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </FormField>
        </div>

        <div className="sm:col-span-2">
          <FormField label="Team Lead">
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Select one Team Lead</p>
                  <p className="text-xs text-gray-400">
                    Only one employee can be selected
                  </p>
                </div>

                {form.teamLead && (
                  <button
                    type="button"
                    onClick={clearTeamLead}
                    className="text-xs font-medium text-red-500 hover:text-red-700"
                  >
                    Clear
                  </button>
                )}
              </div>

              {users.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-500">
                  No active employees found.
                </div>
              ) : (
                <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                  {users.map((user) => {
                    const userId = getUserId(user);
                    const checked = form.teamLead === userId;

                    return (
                      <label
                        key={userId}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                          checked
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="departmentTeamLead"
                          checked={checked}
                          onChange={() => setTeamLead(userId)}
                          className="h-4 w-4 border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="min-w-0 truncate">
                          {user.name} {user.role ? `(${user.role})` : ''}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </FormField>
        </div>

        <FormField label="Status">
          <Select value={String(form.isActive)} onChange={set('isActive')}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </FormField>
      </div>

      <div className="flex justify-end border-t border-gray-100 pt-4">
        <Button type="submit" loading={loading}>
          {initialData ? 'Update Department' : 'Create Department'}
        </Button>
      </div>
    </form>
  );
};

export default DepartmentForm;
