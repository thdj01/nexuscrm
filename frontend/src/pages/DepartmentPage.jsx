import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Edit2,
  Plus,
  RefreshCw,
  Search,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

import API from '../api/axios';
import {
  createDepartment,
  fetchDepartments,
  updateDepartment,
} from '../api/departmentService';
import { useToast } from '../context/ToastContext';

import Table from '../components/common/Table';
import Modal from '../components/common/Modal';
import DepartmentForm from '../components/department/DepartmentForm';
import {
  Button,
  Card,
  Input,
} from '../components/common/FormComponents';

const getDepartmentHods = (department = {}) => {
  if (Array.isArray(department.hods) && department.hods.length > 0) {
    return department.hods.filter(Boolean);
  }

  return department.hod ? [department.hod] : [];
};

const getDepartmentHodNames = (department = {}) => (
  getDepartmentHods(department)
    .map((hod) => hod?.name || '')
    .filter(Boolean)
);

const getDepartmentTeamLeadName = (department = {}) => (
  department.teamLead?.name || ''
);

const DepartmentPage = () => {
  const toast = useToast();
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [selected, setSelected] = useState(null);

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDepartments({ includeInactive: true });
      setDepartments(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await API.get('/users');
      setUsers((data?.data || []).filter((user) => user.isActive !== false));
    } catch {
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    loadDepartments();
    loadUsers();
  }, [loadDepartments, loadUsers]);

  const filteredDepartments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return departments;

    return departments.filter((department) => {
      const hodNames = getDepartmentHodNames(department).join(' ');
      const teamLeadName = getDepartmentTeamLeadName(department);
      const status = department.isActive ? 'active' : 'inactive';
      return [department.name, department.code, hodNames, teamLeadName, status]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [departments, search]);

  const handleCreate = async (payload) => {
    setSubmitting(true);
    try {
      await createDepartment(payload);
      toast.success('Department created successfully');
      setAddModal(false);
      loadDepartments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create department');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (payload) => {
    if (!selected?._id) return;

    setSubmitting(true);
    try {
      await updateDepartment(selected._id, payload);
      toast.success('Department updated successfully');
      setEditModal(false);
      setSelected(null);
      loadDepartments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update department');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (department) => {
    try {
      await updateDepartment(department._id, { isActive: !department.isActive });
      toast.success(department.isActive ? 'Department deactivated' : 'Department activated');
      loadDepartments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update department status');
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Department Name',
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <Building2 size={16} />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400">Created {row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-IN') : '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'code',
      label: 'Department Code',
      width: '160px',
      render: (value) => (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {value || '—'}
        </span>
      ),
    },
    {
      key: 'hods',
      label: 'HODs',
      width: '260px',
      render: (_, row) => {
        const hodNames = getDepartmentHodNames(row);

        if (hodNames.length === 0) return '—';

        return (
          <div className="flex flex-wrap gap-1">
            {hodNames.map((name) => (
              <span
                key={name}
                className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700"
              >
                {name}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'teamLead',
      label: 'Team Lead',
      width: '200px',
      render: (value) => (
        value?.name ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            {value.name}
          </span>
        ) : '—'
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      width: '120px',
      render: (value) => (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {value ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: '_id',
      label: 'Actions',
      width: '130px',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setSelected(row);
              setEditModal(true);
            }}
            className="rounded p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600"
            title="Edit department"
          >
            <Edit2 size={14} />
          </button>

          <button
            type="button"
            onClick={() => handleToggleStatus(row)}
            className={`rounded p-1.5 ${row.isActive ? 'text-red-400 hover:bg-red-50 hover:text-red-600' : 'text-green-500 hover:bg-green-50 hover:text-green-700'}`}
            title={row.isActive ? 'Deactivate department' : 'Activate department'}
          >
            {row.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Department Master</h2>
          <p className="text-sm text-gray-500">
            Manage departments used across users, planning and timesheet flows.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadDepartments}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <RefreshCw size={15} />
          </button>

          <Button onClick={() => setAddModal(true)}>
            <Plus size={16} />
            Add Department
          </Button>
        </div>
      </div>

      <Card>
        <div className="border-b border-gray-100 p-4 sm:p-6">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Search Departments
          </label>
          <div className="relative max-w-xl">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, code, HODs, Team Lead or status"
              className="pl-10"
            />
          </div>
        </div>

        <Table
          columns={columns}
          data={filteredDepartments}
          loading={loading}
          emptyMessage="No departments found."
        />
      </Card>

      <Modal
        isOpen={addModal}
        onClose={() => setAddModal(false)}
        title="Add Department"
        size="lg"
      >
        <DepartmentForm users={users} onSubmit={handleCreate} loading={submitting} />
      </Modal>

      <Modal
        isOpen={editModal}
        onClose={() => {
          setEditModal(false);
          setSelected(null);
        }}
        title="Edit Department"
        size="lg"
      >
        {selected && (
          <DepartmentForm
            initialData={selected}
            users={users}
            onSubmit={handleUpdate}
            loading={submitting}
          />
        )}
      </Modal>
    </div>
  );
};

export default DepartmentPage;
