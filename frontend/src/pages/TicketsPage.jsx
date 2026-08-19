import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Eye,
  Edit2,
  RefreshCw,
  X,
  ChevronDown,
  Check,
} from 'lucide-react';

import { fetchTickets } from '../api/ticketService';
import API from '../api/axios';
import { fetchDepartments, getDepartmentName } from '../api/departmentService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

import Table from '../components/common/Table';
import StatusBadge from '../components/common/StatusBadge';
import { Button, Card } from '../components/common/FormComponents';
import { canCreateTicket } from '../components/ticket/ticketPermissions';


const getMultiSearchParam = (searchParams, key) => {
  const values = searchParams.getAll(key).flatMap((value) => String(value || '').split(','));
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
};


const ALL_YEARS_VALUE = 'all';
const FINANCIAL_YEAR_STORAGE_KEY = 'dashboardFinancialYear';

const getStoredFinancialYear = () => {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(FINANCIAL_YEAR_STORAGE_KEY) || '';
};

const setStoredFinancialYear = (value) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FINANCIAL_YEAR_STORAGE_KEY, value || '');
};

const padYearSuffix = (year) => String(year % 100).padStart(2, '0');
const getFinancialYearStartYear = (date = new Date()) => (
  date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1
);
const formatFinancialYear = (startYear) => `${startYear}-${padYearSuffix(startYear + 1)}`;
const getCurrentFinancialYear = () => formatFinancialYear(getFinancialYearStartYear());
const generateFinancialYearOptions = (yearsBack = 2, yearsForward = 2) => {
  const currentStartYear = getFinancialYearStartYear();
  return Array.from({ length: yearsBack + yearsForward + 1 }, (_, index) => (
    formatFinancialYear(currentStartYear - yearsBack + index)
  ));
};

const TICKET_STATUSES = [
  'New',
  'Assigned',
  'Working',
  'Customer Side Pending',
  'Closed',
  'Void',
];

const DASHBOARD_CARDS = [
  {
    label: 'Total',
    value: '',
    key: 'total',
    activeClass: 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm',
    defaultClass: 'border-blue-100 bg-blue-50/60 text-blue-700 hover:bg-blue-50',
  },
  {
    label: 'New',
    value: 'New',
    key: 'New',
    activeClass: 'border-sky-500 bg-sky-50 text-sky-700 shadow-sm',
    defaultClass: 'border-sky-100 bg-sky-50/60 text-sky-700 hover:bg-sky-50',
  },
  {
    label: 'Assigned',
    value: 'Assigned',
    key: 'Assigned',
    activeClass: 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm',
    defaultClass: 'border-indigo-100 bg-indigo-50/60 text-indigo-700 hover:bg-indigo-50',
  },
  {
    label: 'Working',
    value: 'Working',
    key: 'Working',
    activeClass: 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm',
    defaultClass: 'border-amber-100 bg-amber-50/60 text-amber-700 hover:bg-amber-50',
  },
  {
    label: 'Customer Side Pending',
    value: 'Customer Side Pending',
    key: 'Customer Side Pending',
    activeClass: 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm',
    defaultClass: 'border-orange-100 bg-orange-50/60 text-orange-700 hover:bg-orange-50',
  },
  {
    label: 'Closed',
    value: 'Closed',
    key: 'Closed',
    activeClass: 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm',
    defaultClass: 'border-emerald-100 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-50',
  },
  {
    label: 'Void',
    value: 'Void',
    key: 'Void',
    activeClass: 'border-red-500 bg-red-50 text-red-700 shadow-sm',
    defaultClass: 'border-red-100 bg-red-50/60 text-red-700 hover:bg-red-50',
  },
];

const TICKET_TYPES = ['N/A', 'Support', 'Repairing & Replacement'];
const TICKET_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

const emptyDashboardCounts = {
  total: 0,
  New: 0,
  Assigned: 0,
  Working: 0,
  'Customer Side Pending': 0,
  Closed: 0,
  Void: 0,
};

const fmtDate = (iso) => {
  if (!iso) return '—';

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';

  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getCustomerName = (ticket) =>
  ticket?.customer?.customerName ||
  ticket?.customer?.contactPerson ||
  ticket?.customer?.name ||
  '';

const getAssignedName = (ticket) =>
  ticket?.assignedTo?.name ||
  ticket?.assignedTo?.email ||
  '';

const getAssignedId = (ticket) =>
  ticket?.assignedTo?._id ||
  ticket?.assignedTo ||
  '';

const getEntityId = (value) => String(value?._id || value?.id || value || '');

const getCreatedByName = (ticket = {}) => {
  const createdBy = ticket.createdBy;
  if (!createdBy || typeof createdBy === 'string') return '—';
  return createdBy.name || createdBy.email || '—';
};

const getTicketList = (result) =>
  result?.tickets ||
  result?.data ||
  [];

const getPagination = (result) =>
  result?.pagination ||
  {};

const includesText = (value, query) =>
  String(value || '').toLowerCase().includes(query);

const toggleValue = (list, value) =>
  list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];

const normalizeOptions = (options) =>
  options.map((option) =>
    typeof option === 'string'
      ? { value: option, label: option }
      : option
  );

const MultiSelectFilter = ({
  label,
  placeholder,
  options,
  value,
  onChange,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const normalizedOptions = normalizeOptions(options);

  const selectedLabels = normalizedOptions
    .filter((option) => value.includes(option.value))
    .map((option) => option.label);

  const displayText =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length === 1
        ? selectedLabels[0]
        : `${selectedLabels.length} selected`;

  const clear = (event) => {
    event.stopPropagation();
    onChange([]);
  };

  return (
    <div className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex h-8 w-full min-w-0 items-center justify-between gap-1.5 rounded-md border bg-white px-2.5 text-left text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          value.length
            ? 'border-blue-300 text-gray-800'
            : 'border-gray-300 text-gray-500'
        }`}
      >
        <span className="min-w-0 truncate">
          {displayText}
        </span>

        <span className="flex flex-shrink-0 items-center gap-1">
          {value.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={clear}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') clear(event);
              }}
              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown size={14} className="text-gray-400" />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 max-h-56 w-full min-w-[145px] overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg">
          <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {label}
          </div>

          {normalizedOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">
              No options
            </div>
          ) : (
            normalizedOptions.map((option) => {
              const checked = value.includes(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange(toggleValue(value, option.value))}
                  className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] transition-colors ${
                    checked
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                      checked
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    {checked && <Check size={11} />}
                  </span>
                  <span className="min-w-0 truncate">
                    {option.label}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

const TicketsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();

  const [allTickets, setAllTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [assignableUsers, setAssignableUsers] = useState([]);
  const [assignableUsersLoaded, setAssignableUsersLoaded] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [departmentsLoaded, setDepartmentsLoaded] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => getMultiSearchParam(searchParams, 'status'));
  const [priorityFilter, setPriorityFilter] = useState(() => getMultiSearchParam(searchParams, 'priority'));
  const [financialYear, setFinancialYear] = useState(() => searchParams.get('financialYear') || getStoredFinancialYear() || getCurrentFinancialYear());
  const financialYearOptions = [ALL_YEARS_VALUE, ...generateFinancialYearOptions()];
  const [departmentFilter, setDepartmentFilter] = useState([]);
  const [typeFilter, setTypeFilter] = useState([]);
  const [assigneeFilter, setAssigneeFilter] = useState([]);
  const [filterCreatedBy, setFilterCreatedBy] = useState('');
  const [creatorOptions, setCreatorOptions] = useState([]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const loadAssignableUsers = useCallback(async () => {
    if (assignableUsersLoaded) return;

    try {
      const { data } = await API.get('/users/assignable');
      const users = data.users ?? data.data ?? [];

      setAssignableUsers(
        users
          .filter((item) => item?._id && item?.name)
          .map((item) => ({
            value: item._id,
            label: item.teamId?.name ? `${item.name} — ${item.teamId.name}` : item.name,
          }))
      );
    } catch {
      setAssignableUsers([]);
    } finally {
      setAssignableUsersLoaded(true);
    }
  }, [assignableUsersLoaded]);

  useEffect(() => {
    loadAssignableUsers();
  }, [loadAssignableUsers]);

  const loadDepartments = useCallback(async () => {
    if (departmentsLoaded) return;

    try {
      const rows = await fetchDepartments();
      setDepartments(Array.isArray(rows) ? rows : []);
    } catch {
      setDepartments([]);
    } finally {
      setDepartmentsLoaded(true);
    }
  }, [departmentsLoaded]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const loadTickets = useCallback(async () => {
    setLoading(true);

    try {
      const requestParams = { page: 1, limit: 100 };
      if (financialYear) requestParams.financialYear = financialYear;
      if (filterCreatedBy) requestParams.createdBy = filterCreatedBy;

      const firstResult = await fetchTickets(requestParams);
      setCreatorOptions(Array.isArray(firstResult.filters?.creators) ? firstResult.filters.creators : []);

      const firstTickets = getTicketList(firstResult);
      const pagination = getPagination(firstResult);

      const totalPages =
        pagination.totalPages ||
        pagination.pages ||
        Math.ceil((pagination.total || firstTickets.length) / 100) ||
        1;

      const safeTotalPages = Math.min(Math.max(1, totalPages), 50);

      if (safeTotalPages <= 1) {
        setAllTickets(firstTickets);
        return;
      }

      const pageRequests = [];

      for (let nextPage = 2; nextPage <= safeTotalPages; nextPage += 1) {
        pageRequests.push(fetchTickets({ ...requestParams, page: nextPage }));
      }

      const pageResults = await Promise.all(pageRequests);
      const remainingTickets = pageResults.flatMap((result) => getTicketList(result));

      setAllTickets([...firstTickets, ...remainingTickets]);
    } catch {
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [financialYear, filterCreatedBy, toast]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);
  useEffect(() => {
    const urlFinancialYear = searchParams.get('financialYear');
    if (urlFinancialYear && urlFinancialYear !== financialYear) {
      setFinancialYear(urlFinancialYear);
      setStoredFinancialYear(urlFinancialYear);
    }
  }, [searchParams, financialYear]);

  const handleFinancialYearChange = (value) => {
    setFinancialYear(value);
    setStoredFinancialYear(value);
    setPage(1);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('financialYear', value);
    setSearchParams(nextParams, { replace: true });
  };


  const assigneeOptions = useMemo(() => {
    const map = new Map();

    assignableUsers.forEach((assignee) => {
      map.set(assignee.value, assignee.label);
    });

    allTickets.forEach((ticket) => {
      const id = getAssignedId(ticket);
      const label = getAssignedName(ticket);

      if (id && label && !map.has(id)) {
        map.set(id, label);
      }
    });

    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [allTickets, assignableUsers]);

  const departmentOptions = useMemo(() => {
    const values = new Set();

    departments.forEach((department) => {
      const name = getDepartmentName(department);
      if (name) values.add(name);
    });

    allTickets.forEach((ticket) => {
      if (ticket?.department) values.add(ticket.department);
    });

    departmentFilter.forEach((department) => {
      if (department) values.add(department);
    });

    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [allTickets, departmentFilter, departments]);

  const baseFilteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return allTickets.filter((ticket) => {
      if (query) {
        const matchesSearch =
          includesText(ticket.ticketId, query) ||
          includesText(ticket.title, query) ||
          includesText(getCustomerName(ticket), query);

        if (!matchesSearch) return false;
      }

      if (priorityFilter.length && !priorityFilter.includes(ticket.priority)) return false;
      if (departmentFilter.length && !departmentFilter.includes(ticket.department)) return false;
      if (typeFilter.length && !typeFilter.includes(ticket.ticketType || 'N/A')) return false;
      if (assigneeFilter.length && !assigneeFilter.includes(getAssignedId(ticket))) return false;

      return true;
    });
  }, [
    allTickets,
    search,
    priorityFilter,
    departmentFilter,
    typeFilter,
    assigneeFilter,
  ]);

  const dashboardCounts = useMemo(() => {
    const counts = {
      ...emptyDashboardCounts,
      total: baseFilteredTickets.length,
    };

    baseFilteredTickets.forEach((ticket) => {
      if (Object.prototype.hasOwnProperty.call(counts, ticket.status)) {
        counts[ticket.status] += 1;
      }
    });

    return counts;
  }, [baseFilteredTickets]);

  const filteredTickets = useMemo(() => {
    if (!statusFilter.length) return baseFilteredTickets;

    return baseFilteredTickets.filter((ticket) =>
      statusFilter.includes(ticket.status)
    );
  }, [baseFilteredTickets, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / limit));

  const visibleTickets = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;
    return filteredTickets.slice(start, start + limit);
  }, [filteredTickets, page, totalPages, limit]);

  const pagination = useMemo(() => {
    const safePage = Math.min(page, totalPages);

    return {
      page: safePage,
      pages: totalPages,
      totalPages,
      total: filteredTickets.length,
      limit,
    };
  }, [filteredTickets.length, page, totalPages, limit]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    statusFilter,
    priorityFilter,
    departmentFilter,
    typeFilter,
    assigneeFilter,
    filterCreatedBy,
    financialYear,
    limit,
  ]);

  const hasFilters =
    search ||
    statusFilter.length ||
    priorityFilter.length ||
    departmentFilter.length ||
    typeFilter.length ||
    assigneeFilter.length ||
    filterCreatedBy;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter([]);
    setPriorityFilter([]);
    setDepartmentFilter([]);
    setTypeFilter([]);
    setAssigneeFilter([]);
    setFilterCreatedBy('');
  };

  const openCreatePage = () => {
    navigate('/tickets/new');
  };

  const openViewPage = (ticket) => {
    navigate(`/tickets/${ticket._id}`);
  };

  const openEditPage = (ticket) => {
    navigate(`/tickets/${ticket._id}/edit`);
  };

  const columns = [
    {
      key: 'ticketId',
      label: 'Ticket ID',
      width: '105px',
      render: (value) => (
        <span className="font-mono text-xs font-semibold text-blue-700">
          {value}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date',
      width: '95px',
      render: (value) => (
        <span className="text-xs text-gray-500">
          {fmtDate(value)}
        </span>
      ),
    },
    {
      key: 'title',
      label: 'Subject',
      render: (value, row) => {
        const customerName = getCustomerName(row);

        return (
          <div className="min-w-0">
            <p className="max-w-[220px] truncate text-sm font-medium text-gray-800">
              {value || '—'}
            </p>
            {customerName && (
              <p className="max-w-[220px] truncate text-xs text-gray-400">
                {customerName}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'ticketType',
      label: 'Type',
      width: '120px',
      render: (value) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            value === 'Repairing & Replacement'
              ? 'bg-amber-100 text-amber-800'
              : value === 'N/A'
                ? 'bg-gray-100 text-gray-700'
                : 'bg-sky-100 text-sky-800'
          }`}
        >
          {value === 'Repairing & Replacement' ? 'R&R' : value || 'N/A'}
        </span>
      ),
    },
    {
      key: 'createdBy',
      label: 'Created By',
      width: '135px',
      render: (_, row) => {
        const creatorId = getEntityId(row.createdBy);
        const currentUserId = getEntityId(user?._id || user?.id);
        const isCurrentUser = Boolean(creatorId && currentUserId && creatorId === currentUserId);

        return (
          <span className="text-sm text-gray-700">
            {getCreatedByName(row)}
            {isCurrentUser && (
              <span className="ml-1 text-[11px] font-normal text-gray-400">(you)</span>
            )}
          </span>
        );
      },
    },
    {
      key: 'assignedTo',
      label: 'Assigned To',
      width: '120px',
      render: (value) =>
        value?.name ? (
          <span className="text-sm text-gray-700">
            {value.name}
          </span>
        ) : (
          <span className="text-xs italic text-gray-400">
            Unassigned
          </span>
        ),
    },
    {
      key: 'priority',
      label: 'Priority',
      width: '80px',
      render: (value) => <StatusBadge status={value} size="xs" />,
    },
    {
      key: 'status',
      label: 'Status',
      width: '125px',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      key: '_id',
      label: 'Actions',
      width: '75px',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openViewPage(row);
            }}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
            title="View ticket"
          >
            <Eye size={14} />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openEditPage(row);
            }}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
            title="Edit ticket"
          >
            <Edit2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="fade-in max-w-full min-w-0 space-y-4 overflow-x-hidden">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900">
            Tickets
          </h2>
          <p className="text-sm text-gray-500">
            {pagination.total} total records
          </p>
        </div>

        {canCreateTicket(user) && (
          <Button onClick={openCreatePage}>
            <Plus size={16} />
            New Ticket
          </Button>
        )}
      </div>

<div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
  {DASHBOARD_CARDS.map((card) => {
    const active =
      card.value === ''
        ? statusFilter.length === 0
        : statusFilter.includes(card.value);

    const count = dashboardCounts[card.key] ?? 0;

    return (
      <button
        key={card.key}
        type="button"
        onClick={() => {
          if (card.value === '') {
            setStatusFilter([]);
          } else {
            setStatusFilter((prev) => toggleValue(prev, card.value));
          }
        }}
        className={`min-w-0 rounded-xl border px-3.5 py-3 text-left transition-all min-h-[96px] ${
          active ? card.activeClass : card.defaultClass
        }`}
      >
        <p className="line-clamp-2 text-[11px] font-semibold uppercase leading-tight tracking-wide opacity-85">
          {card.label}
        </p>

        <p className="mt-2 text-2xl font-bold leading-none">
          {count}
        </p>
      </button>
    );
  })}
</div>
<Card>
  <div className="grid min-w-0 grid-cols-2 items-center gap-2 p-3 sm:grid-cols-3 lg:flex lg:flex-nowrap lg:overflow-visible">
    <div className="relative col-span-2 w-full sm:col-span-3 lg:w-[210px] lg:shrink-0">
      <Search
        size={13}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        type="text"
        placeholder="Search ticket ID..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="h-8 w-full rounded-md border border-gray-300 py-1.5 pl-8 pr-7 text-base lg:text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {search && (
        <button
          type="button"
          onClick={() => setSearch('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X size={12} />
        </button>
      )}
    </div>

    <MultiSelectFilter
      label="Status"
      placeholder="Status"
      options={TICKET_STATUSES}
      value={statusFilter}
      onChange={setStatusFilter}
      className="w-full lg:w-[105px] lg:shrink-0"
    />

    <MultiSelectFilter
      label="Priority"
      placeholder="Priority"
      options={TICKET_PRIORITIES}
      value={priorityFilter}
      onChange={setPriorityFilter}
      className="w-full lg:w-[105px] lg:shrink-0"
    />

    <MultiSelectFilter
      label="Department"
      placeholder="Department"
      options={departmentOptions}
      value={departmentFilter}
      onChange={setDepartmentFilter}
      className="w-full lg:w-[125px] lg:shrink-0"
    />

    <MultiSelectFilter
      label="Type"
      placeholder="Type"
      options={TICKET_TYPES}
      value={typeFilter}
      onChange={setTypeFilter}
      className="w-full lg:w-[105px] lg:shrink-0"
    />

    <MultiSelectFilter
      label="Assignee"
      placeholder="Assignee"
      options={assigneeOptions}
      value={assigneeFilter}
      onChange={setAssigneeFilter}
      className="w-full lg:w-[125px] lg:shrink-0"
    />

    <select
      value={filterCreatedBy}
      onChange={(event) => setFilterCreatedBy(event.target.value)}
      className="h-8 w-full lg:w-[135px] lg:shrink-0 rounded-md border border-gray-300 bg-white px-2 text-base lg:text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      aria-label="Filter tickets by creator"
    >
      <option value="">All Created By</option>
      {creatorOptions.map((creator) => (
        <option key={creator._id} value={creator._id}>
          {creator.name || creator.email || 'Unknown User'}
        </option>
      ))}
    </select>

    <select
      value={financialYear}
      onChange={(event) => handleFinancialYearChange(event.target.value)}
      className="h-8 w-full lg:w-[92px] lg:shrink-0 rounded-md border border-gray-300 bg-white px-2 text-base lg:text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      aria-label="Financial year"
    >
      {financialYearOptions.map((year) => <option key={year} value={year}>{year === ALL_YEARS_VALUE ? 'All Years' : year}</option>)}
    </select>


    <div className="col-span-2 flex items-center justify-end gap-1 sm:col-span-3 lg:col-span-1 lg:contents">
      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="flex h-8 shrink-0 items-center gap-1 whitespace-nowrap px-1.5 text-xs text-red-500 hover:text-red-700"
        >
          <X size={12} />
          Clear
        </button>
      )}

      <button
        type="button"
        onClick={loadTickets}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        title="Refresh"
      >
        <RefreshCw size={13} />
      </button>
    </div>
  </div>
</Card>


      <Card className="min-w-0 max-w-full overflow-hidden">
        <Table
          columns={columns}
          data={visibleTickets}
          loading={loading}
          pagination={pagination}
          onPageChange={setPage}
          onPageSizeChange={(value) => { setLimit(value); setPage(1); }}
          paginationTotalLabel="records"
          onRowClick={openViewPage}
          emptyMessage="No tickets found. Click 'New Ticket' to create one."
        />
      </Card>
    </div>
  );
};

export default TicketsPage;