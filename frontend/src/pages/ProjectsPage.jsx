import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, RefreshCw, X,
  AlertTriangle, Activity, Edit2,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Table from '../components/common/Table';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import ProjectForm from '../components/project/ProjectForm';
import ProjectActivityLogHistory from '../components/activity/ProjectActivityLogHistory';
import { PROJECT_PERMISSIONS } from '../constants/permissions';
import { Button, Select, Card } from '../components/common/FormComponents';
import {
  fetchProjects as apiFetchProjects,
  updateProject as apiUpdate,
  computeDelay,
  getProjectId,
} from '../api/projectService';

const PAGE_SIZE_BASE_OPTIONS = [50, 100, 250];
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


const getPageSizeOptions = (total = 0, selectedLimit = 50) => {
  const numericTotal = Number(total) || 0;
  const options = [...PAGE_SIZE_BASE_OPTIONS];

  if (numericTotal > 250) {
    let nextSize = 500;

    while (nextSize < numericTotal) {
      options.push(nextSize);
      nextSize += nextSize < 1000 ? 500 : 1000;
    }

    options.push(nextSize);
  }

  if (selectedLimit) {
    options.push(Number(selectedLimit));
  }

  return [...new Set(options)].sort((a, b) => a - b);
};


const PANEL_TYPE_LABELS = {
  PLC: 'PLC',
  MCC: 'MCC',
  VFD: 'VFD',
  PLC_MCC: 'MCC cum PLC',
  'MCC cum PLC': 'MCC cum PLC',
};

const getPanelTypeLabel = (value = '') => {
  const text = String(value || '').trim();
  return PANEL_TYPE_LABELS[text] || text || '—';
};

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '—';

const getInquiryNumber = (project = {}) => (
  project?.inquiryNumber ||
  project?.inquiryReference?.inquiryId ||
  project?.sourceInquirySnapshot?.inquiryId ||
  ''
);

const fmtTime = (time) => {
  if (!time) return '—';
  const [hours = '', minutes = ''] = String(time).split(':');
  if (!hours || !minutes) return time;
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const formatKickoffAttendees = (attendees = []) => {
  if (!Array.isArray(attendees) || attendees.length === 0) return '—';
  return attendees.map(user => user?.name || user?.email || user).filter(Boolean).join(', ');
};

const ProjectsPage = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const { hasPermission, hasAnyPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const canCreateProject = hasPermission(PROJECT_PERMISSIONS.CREATE);
  const canManagePlanning = hasPermission(PROJECT_PERMISSIONS.PLANNING_GRID);
  const canOpenProjectEditor = hasAnyPermission([
    PROJECT_PERMISSIONS.EDIT,
    PROJECT_PERMISSIONS.PLANNING_GRID,
    PROJECT_PERMISSIONS.ADD_DUPLICATE_PLANNING_GRID,
    PROJECT_PERMISSIONS.UPDATE_COMPLETION,
    PROJECT_PERMISSIONS.MARK_COMPLETED,
  ]);

  const [projects, setProjects] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 50 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterOrderDate, setFilterOrderDate] = useState(() => searchParams.get('orderDate') || '');
  const [financialYear, setFinancialYear] = useState(() => searchParams.get('financialYear') || getStoredFinancialYear() || getCurrentFinancialYear());
  const riskFilter = searchParams.get('riskFilter') || '';
  const financialYearOptions = [ALL_YEARS_VALUE, ...generateFinancialYearOptions()];
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const [editModal, setEditModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [activityModal, setActivityModal] = useState(false);
  const [selected, setSelected] = useState(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (search) params.search = search;
      if (filterOrderDate) params.orderDate = filterOrderDate;
      if (financialYear) params.financialYear = financialYear;
      if (riskFilter) params.riskFilter = riskFilter;

      const result = await apiFetchProjects(params);

      const enriched = (result.data || []).map((p) => {
        try {
          return {
            ...p,
            ...computeDelay(p),
          };
        } catch (err) {
          console.error('ComputeDelay Error:', err);
          return p;
        }
      });

      setProjects(enriched);
      setPagination({
        total: result.pagination?.total || 0,
        page: result.pagination?.page || page,
        pages: result.pagination?.pages || 1,
        limit: result.pagination?.limit || limit,
      });
    } catch (err) {
      console.error('Projects Load Error:', err);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, filterOrderDate, financialYear, riskFilter, toast]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);
  useEffect(() => {
    if (!searchParams.has('projectStatus')) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('projectStatus');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);
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

  useEffect(() => { setPage(1); }, [search, filterOrderDate, financialYear, riskFilter, limit]);

  const handleEdit = async (formData) => {
    setSubmitting(true);
    try {
      await apiUpdate(selected._id, formData);
      toast.success('Project updated successfully');
      setEditModal(false);
      setSelected(null);
      fetchProjects();
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update project');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleInlineEndDateUpdate = async (projectId, dbId, newEndDate) => {
    try {
      await apiUpdate(dbId, { projectEndDate: newEndDate });
      toast.success('End date updated and saved');
      fetchProjects();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update end date');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setFilterOrderDate('');
    if (riskFilter) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('riskFilter');
      setSearchParams(nextParams, { replace: true });
    }
  };

  const openProjectView = (project) => {
    const projectId = getProjectId(project);
    if (!projectId) {
      toast.error('Invalid project id. Please refresh the project list.');
      return;
    }
    navigate(`/projects/${projectId}`);
  };

  const columns = [
    {
      key: 'projectId',
      label: 'Project ID',
      width: '110px',
      render: (value, row) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openProjectView(row); }}
          className="font-mono text-xs font-semibold text-blue-700 hover:underline"
          title="View project"
        >
          {value}
        </button>
      ),
    },
    {
      key: 'inquiryNumber',
      label: 'INQ No',
      width: '120px',
      render: (_, row) => {
        const inquiryNo = getInquiryNumber(row);
        return inquiryNo ? (
          <span className="font-mono text-xs font-semibold text-emerald-700">{inquiryNo}</span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        );
      },
    },
    {
      key: 'customerName',
      label: 'Customer / Project',
      render: (value, row) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openProjectView(row); }}
          className="text-left"
          title="View project"
        >
          <p className="font-medium text-gray-800 hover:text-blue-700 hover:underline">{value}</p>
          <p className="text-xs text-gray-400">{row.projectName}</p>
        </button>
      ),
    },
    {
      key: 'projectQuantity',
      label: 'Project Quantity',
      width: '125px',
      render: (value, row) => <span className="font-semibold text-gray-700">{value || row.quantity || 1}</span>,
    },
    {
      key: 'selectedDepartments',
      label: 'Departments / Panels',
      width: '230px',
      render: (value, row) => {
        const departments = Array.isArray(value) ? value : [];
        const panels = Array.isArray(row.panelSelections)
          ? [...new Set(row.panelSelections.map((item) => item.panelType).filter(Boolean))]
          : [];
        return (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-700">{departments.join(', ') || '—'}</p>
            <p className="text-[11px] text-indigo-600">{panels.join(', ') || '—'}</p>
          </div>
        );
      },
    },
    {
      key: 'projectStatus',
      label: 'Status',
      width: '110px',
      render: (value) => <StatusBadge status={value} size="xs" />,
    },
    {
      key: 'completionPercentage',
      label: 'Progress',
      width: '110px',
      render: (value) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${value || 0}%` }} />
          </div>
          <span className="w-8 text-xs text-gray-500">{value || 0}%</span>
        </div>
      ),
    },
    {
      key: 'projectEndDate',
      label: 'End Date',
      width: '120px',
      render: (value) => <span className="text-xs text-gray-700">{fmt(value)}</span>,
    },
    {
      key: '_id',
      label: 'Actions',
      width: '130px',
      render: (_, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {canOpenProjectEditor && (
            <button
              type="button"
              title="Edit"
              aria-label="Edit"
              onClick={(e) => {
                e.stopPropagation();
                const projectId = getProjectId(row);
                if (!projectId) {
                  toast.error('Invalid project id. Please refresh the project list.');
                  return;
                }
                navigate(`/projects/${projectId}/edit`);
              }}
              className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
            >
              <Edit2 size={14} />
            </button>
          )}

          <button
            type="button"
            title="Activity Graph"
            aria-label="Activity Graph"
            onClick={(e) => { e.stopPropagation(); navigate(`/projects/${getProjectId(row)}/activity`); }}
            className="rounded p-1.5 text-gray-400 hover:bg-purple-50 hover:text-purple-600"
          >
            <Activity size={14} />
          </button>
        </div>
      ),
    },
  ];

  const limitOptions = getPageSizeOptions(pagination?.total || 0, limit);
  const hasFilters = search || filterOrderDate || riskFilter;

  return (
    <div className="fade-in w-full min-w-0 max-w-full space-y-4 overflow-x-hidden">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900">All Projects</h2>
          <p className="text-xs text-gray-500 mt-0.5">{pagination.total} project(s) total</p>
        </div>

        {canCreateProject && (
          <Button onClick={() => navigate('/projects/new')} className="w-full justify-center sm:w-auto flex items-center gap-2">
            <Plus size={15} /> New Project
          </Button>
        )}
      </div>

      <Card className="sticky top-0 z-30 min-w-0 max-w-full p-3">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full min-w-0 sm:min-w-[220px] sm:max-w-[320px] sm:flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

            <input
              type="text"
              placeholder="Search Project ID, INQ No, customer, project…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-gray-300 py-2 pl-9 pr-8 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:flex-wrap sm:items-center">
            <input
              type="date"
              value={filterOrderDate}
              onChange={(e) => setFilterOrderDate(e.target.value)}
              className="h-9 w-full sm:w-[150px] sm:shrink-0 rounded-lg border border-gray-300 bg-white px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Filter by order date"
            />

            <Select
              value={financialYear}
              onChange={(e) => handleFinancialYearChange(e.target.value)}
              className="h-9 w-full sm:w-[120px] sm:shrink-0"
              aria-label="Financial year"
            >
              {financialYearOptions.map((year) => <option key={year} value={year}>{year === ALL_YEARS_VALUE ? 'All Years' : year}</option>)}
            </Select>

            <Select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="h-9 w-full sm:w-[105px] sm:shrink-0"
              aria-label="Records per page"
            >
              {limitOptions.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </Select>
          </div>

          <div className="flex min-w-0 items-center justify-end gap-2">
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-sm text-red-500 hover:bg-red-50 hover:text-red-700"
              >
                <X size={14} /> Reset
              </button>
            )}

            <button
              type="button"
              onClick={fetchProjects}
              className="h-9 shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              title="Refresh"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>
      </Card>

      <Card className="min-w-0 max-w-full overflow-hidden">
        <Table
          columns={columns}
          data={projects}
          loading={loading}
          pagination={pagination}
          onPageChange={setPage}
          onRowClick={openProjectView}
          emptyMessage="No projects found. Add your first project!"
        />
      </Card>

      <Modal isOpen={editModal} onClose={() => { setEditModal(false); setSelected(null); }} title="Edit" size="xxl">
        {selected && (
          <ProjectForm initialData={selected} onSubmit={handleEdit} loading={submitting} canManagePlanning={canManagePlanning} />
        )}
      </Modal>

      <Modal isOpen={detailModal} onClose={() => { setDetailModal(false); setSelected(null); }} title="Project Details" size="md">
        {selected && (() => {
          const { isDelayed, delayedDays } = computeDelay(selected);

          return (
            <div className="space-y-3 text-sm">
              {isDelayed && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
                  <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
                  <p className="text-red-700 font-medium">
                    This project is <strong>{delayedDays} day(s)</strong> past its end date.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  ['Project ID', selected.projectId],
                  ['Inquiry No.', getInquiryNumber(selected)],
                  ['Customer', selected.customerName],
                  ['Company', selected.companyName],
                  ['Project Name', selected.projectName],
                  ['Project Quantity', selected.projectQuantity || selected.quantity || 1],
                  ['Departments', (selected.selectedDepartments || []).join(', ')],
                  ['Panel Planning', (selected.panelSelections || []).map((item) => `${item.department}: ${item.panelType} × ${item.quantity}`).join('; ')],
                  ['Order Date', fmt(selected.orderDate)],
                  ['Project End Date', fmt(selected.projectEndDate)],
                  ['Completed On', fmt(selected.completedAt)],
                  ['Production', selected.productionStatus],
                  ['Dispatch', selected.dispatchStatus],
                  ['Installation', selected.installationStatus],
                  ['Payment', selected.paymentStatus],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-gray-50 p-3">
                    <p className="mb-0.5 text-xs text-gray-500">{label}</p>
                    <p className="font-medium text-gray-800">
                      {value || '—'}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg bg-gray-50 p-3">
                <p className="mb-2 text-xs text-gray-500">Overall Completion</p>

                <div className="flex items-center gap-3">
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${selected.completionPercentage || 0}%` }} />
                  </div>
                  <span className="font-semibold text-gray-800">{selected.completionPercentage || 0}%</span>
                </div>

                {Array.isArray(selected.planningGrids) && selected.planningGrids.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {selected.planningGrids.map((grid) => (
                      <div key={grid.gridId} className="rounded-lg bg-white border border-gray-100 p-2">
                        <p className="text-xs text-gray-500">{grid.name || `Project Planning Grid - ${grid.gridId}`}</p>
                        <p className="font-semibold text-blue-700">{grid.completionPercentage || 0}%</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selected.kickoffMeeting && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-700">Kick-off Meeting</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-blue-500">Date</p>
                      <p className="font-medium text-gray-800">{fmt(selected.kickoffMeeting.scheduledAt || selected.kickoffMeeting.date)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-500">Time</p>
                      <p className="font-medium text-gray-800">{fmtTime(selected.kickoffMeeting.time)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-500">Persons</p>
                      <p className="font-medium text-gray-800">{formatKickoffAttendees(selected.kickoffMeeting.attendees)}</p>
                    </div>
                  </div>
                  {(selected.kickoffMeeting.agenda || selected.kickoffMeeting.meetingLink) && (
                    <div className="mt-3 space-y-2">
                      {selected.kickoffMeeting.agenda && (
                        <div>
                          <p className="text-xs text-blue-500">Agenda</p>
                          <p className="font-medium text-gray-800">{selected.kickoffMeeting.agenda}</p>
                        </div>
                      )}
                      {selected.kickoffMeeting.meetingLink && (
                        <div>
                          <p className="text-xs text-blue-500">Meeting Link</p>
                          <a href={selected.kickoffMeeting.meetingLink} target="_blank" rel="noreferrer" className="font-medium text-blue-700 hover:underline">
                            {selected.kickoffMeeting.meetingLink}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}


              <div className="border-t pt-3">
                <ProjectActivityLogHistory project={selected} projectId={selected._id} compact />
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal
        isOpen={activityModal}
        onClose={() => { setActivityModal(false); setSelected(null); }}
        title={`Activity Graph — ${selected?.projectId || ''}`}
        size="xxl"
      >
        {selected && <ProjectActivityLogHistory project={selected} projectId={selected._id} />}
      </Modal>

    </div>
  );
};

export default ProjectsPage;