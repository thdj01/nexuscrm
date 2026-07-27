import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit2, RefreshCw, X, Phone, Mail, MapPin } from 'lucide-react';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { CUSTOMER_PERMISSIONS } from '../constants/permissions';
import Table from '../components/common/Table';
import StatusBadge from '../components/common/StatusBadge';
import { Button, Card } from '../components/common/FormComponents';

const getPrimaryContact = (customer = {}) => {
  const contacts = Array.isArray(customer.contacts) ? customer.contacts : [];
  return contacts.find((contact) => contact?.name || contact?.phone || contact?.email) || {
    name: customer.contactPerson || '',
    phone: customer.mobileNumber || '',
    email: customer.email || '',
    designation: customer.designation || '',
  };
};

const getCreatedByName = (customer = {}) => {
  const createdBy = customer.createdBy;
  if (!createdBy) return '—';
  if (typeof createdBy === 'string') return '—';
  return createdBy.name || '—';
};

const CustomersPage = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canCreateCustomer = hasPermission(CUSTOMER_PERMISSIONS.CREATE);
  const canEditCustomer = hasPermission(CUSTOMER_PERMISSIONS.EDIT);
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 50 });
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const pageSizeOptions = useMemo(() => {
    const options = [50, 100, 150, 200, 250];
    const total = Number(pagination.total) || 0;

    if (total > 250) {
      const roundedTotal = Math.ceil(total / 50) * 50;
      for (let size = 300; size <= roundedTotal; size += 50) {
        options.push(size);
      }
    }

    if (!options.includes(limit)) options.push(limit);
    return [...new Set(options)].sort((a, b) => a - b);
  }, [pagination.total, limit]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      const keyword = appliedSearch.trim();
      if (keyword) params.search = keyword;
      const { data } = await API.get('/customers', { params });
      setCustomers(data.data);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [page, limit, appliedSearch]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextSearch = searchInput.trim();
      if (nextSearch !== appliedSearch) {
        setPage(1);
        setAppliedSearch(nextSearch);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput, appliedSearch]);

  const handleSearch = (e) => {
    e?.preventDefault?.();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setAppliedSearch('');
    setPage(1);
  };

  const handleLimitChange = (e) => {
    setLimit(Number(e.target.value));
    setPage(1);
  };

  const columns = [
    {
      key: 'customerId',
      label: 'ID',
      width: '100px',
      render: (v) => <span className="font-mono text-xs text-blue-700 font-semibold">{v}</span>,
    },
    {
      key: 'customerName',
      label: 'Customer',
      render: (v) => <p className="font-medium text-gray-800">{v || '—'}</p>,
    },
    {
      key: 'companyType',
      label: 'Company Type',
      width: '140px',
      render: (v) => <span className="text-sm text-gray-600">{v || '—'}</span>,
    },
    {
      key: 'createdBy',
      label: 'Created',
      width: '140px',
      render: (_v, row) => <span className="text-sm text-gray-600">{getCreatedByName(row)}</span>,
    },
    {
      key: 'mobileNumber',
      label: 'Contact',
      render: (_v, row) => {
        const primary = getPrimaryContact(row);
        return (
          <div>
            <p className="text-sm text-gray-700 flex items-center gap-1"><Phone size={11} className="text-gray-400" /> {primary.phone || '—'}</p>
            <p className="text-xs text-gray-400 flex items-center gap-1"><Mail size={11} /> {primary.email || '—'}</p>
            {primary.name && <p className="text-xs text-gray-500 truncate">{primary.name}</p>}
          </div>
        );
      },
    },
    {
      key: 'city',
      label: 'City',
      width: '100px',
      render: (v) => v ? <span className="flex items-center gap-1 text-sm"><MapPin size={11} className="text-gray-400" />{v}</span> : '—',
    },
    {
      key: 'totalProjects',
      label: 'Projects',
      width: '80px',
      render: (v) => (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
          {v || 0}
        </span>
      ),
    },
    ...(canEditCustomer ? [{
      key: '_id',
      label: 'Actions',
      width: '100px',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); navigate(`/customers/${row._id}?mode=edit`); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit"><Edit2 size={14} /></button>
        </div>
      ),
    }] : []),
  ];

  return (
    <div className="space-y-4 fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Customers</h2>
          <p className="text-sm text-gray-500">{pagination.total} total records</p>
        </div>
        {canCreateCustomer && (
          <Button onClick={() => navigate('/customers/new')} className="w-full justify-center sm:w-auto"><Plus size={16} /> New Customer</Button>
        )}
      </div>

      <Card>
        <form onSubmit={handleSearch} className="p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-96">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by customer, phone, email, city..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-9 py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={fetchCustomers}
              className="inline-flex items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              title="Refresh customers"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          <div className="flex items-center justify-end">
            <select
              aria-label="Records per page"
              value={limit}
              onChange={handleLimitChange}
              className="min-w-[72px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Records per page"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </form>
      </Card>

      <Card>
        <Table columns={columns} data={customers} loading={loading} pagination={pagination} onPageChange={setPage} onRowClick={(row) => navigate(`/customers/${row._id}`)} emptyMessage="No customers found." />
      </Card>


    </div>
  );
};

export default CustomersPage;