import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Edit2,
  RefreshCw,
  X,
  Calendar,
  Clock,
  Users,
  Check,
  ChevronDown,
} from 'lucide-react';

import API from '../api/axios';
import { downloadProtectedFile } from '../api/protectedFileService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { INQUIRY_PERMISSIONS } from '../constants/permissions';

import Table from '../components/common/Table';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';

import { Button, Select, Card, Input, FormField, Textarea } from '../components/common/FormComponents';
import { getLiveCustomerName } from '../utils/customerUtils';

const STATUS_OPTIONS = [
  { value: 'New', label: 'New' },
  { value: 'Technical Evaluation', label: 'Technical Evaluation' },
  { value: 'Technical BoM Submitted', label: 'Technical BoM Submitted' },
  { value: 'BoM Approval Pending', label: 'BoM Approval Pending' },
  { value: 'Revision', label: 'Revision' },
  { value: 'Commercial BOM Submission', label: 'Commercial BOM Submission' },
  { value: 'Order Won', label: 'Project Won' },
  { value: 'Order Lost', label: 'Order Lost' },
  { value: 'Inquiry Hold', label: 'Inquiry Hold' },
];

const getStatusLabel = (status = '') => {
  const normalized = normalizeInquiryStatus(status);
  return STATUS_OPTIONS.find((option) => option.value === normalized)?.label || normalized;
};

const LEGACY_STATUS_MAP = {
  'In Progress': 'Technical Evaluation',
  'Technical Submit': 'Technical BoM Submitted',
  'Technical BOM Submission': 'Technical BoM Submitted',
  'Technical BoM Submission': 'Technical BoM Submitted',
  'BOM Submitted': 'Technical BoM Submitted',
  'Bom Submitted': 'Technical BoM Submitted',
  'BOM SUBMITTED': 'Technical BoM Submitted',
  'BoM Submitted': 'Technical BoM Submitted',
  'Technical BOM Submitted': 'Technical BoM Submitted',
  'Technical BoM Submitted': 'Technical BoM Submitted',
  'Technical BOM Approval': 'BoM Approval Pending',
  'Technical BoM Approval': 'BoM Approval Pending',
  'Commercial Submit': 'Commercial BOM Submission',
  'Commercial Discussion': 'Commercial BOM Submission',
  'Quotation Submit': 'Commercial BOM Submission',
  'Order Received': 'Order Won',
  'Order Recieved': 'Order Won',
  'Project Won': 'Order Won',
  'Inquiry Lost': 'Order Lost',
  'Inq. Lost': 'Order Lost',
};

const LEGACY_STATUS_KEY_MAP = {
  technicalbomsubmission: 'Technical BoM Submitted',
  technicalbomsubmitted: 'Technical BoM Submitted',
  bomsubmitted: 'Technical BoM Submitted',
  technicalbomapproval: 'BoM Approval Pending',
};

const getLegacyStatusKey = (status = '') => String(status || '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const ORDER_LOST_REASONS = ['Price', 'Commercial', 'Priority', 'Timing', 'Trust Issue', 'Certification'];
const HOLD_REASONS = ['Due to Customer', 'Specification', 'Technical', 'Commercial'];

const normalizeInquiryStatus = (status = '') => LEGACY_STATUS_MAP[status] || LEGACY_STATUS_KEY_MAP[getLegacyStatusKey(status)] || status || 'New';
const isOrderWonStatus = (status = '') => normalizeInquiryStatus(status) === 'Order Won';

const getBomRevisionLabel = (attachment = {}) => {
  const revisionNumber = Number(attachment?.revisionNumber);
  return Number.isFinite(revisionNumber) ? `Revision ${revisionNumber}` : '';
};

const getLatestBomRevisionLabel = (attachments = []) => {
  if (!Array.isArray(attachments) || attachments.length === 0) return '';

  const latest = attachments
    .map((attachment) => ({ attachment, revisionNumber: Number(attachment?.revisionNumber) }))
    .filter((item) => Number.isFinite(item.revisionNumber))
    .sort((a, b) => b.revisionNumber - a.revisionNumber)[0];

  return latest ? getBomRevisionLabel(latest.attachment) : '';
};

const formatUploadDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getUploadedByName = (attachment = {}) => {
  const uploadedBy = attachment?.uploadedBy;
  if (!uploadedBy || typeof uploadedBy === 'string') return '';
  return uploadedBy.name || uploadedBy.email || '';
};

const isFileObject = (value) => (
  typeof File !== 'undefined' && value instanceof File
);

const getInitialStatusModalForm = () => ({
  orderLostReason: '',
  orderLostRemark: '',
  holdReason: '',
  revisionCustomerComment: '',
  revisionInternalNotes: '',
  revisionFile: null,
  technicalBomFile: null,
  bomSubmissionRemarks: '',
  bomApprovalRemark: '',
});



const FileDropInput = ({ file, onFileChange }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputId = 'status-technical-bom-document-input';

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const droppedFile = event.dataTransfer?.files?.[0];
    if (droppedFile) onFileChange(droppedFile);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/40'
      }`}
    >
      <input
        id={inputId}
        type="file"
        className="hidden"
        onChange={(event) => onFileChange(event.target.files?.[0] || null)}
      />
      <label htmlFor={inputId} className="block cursor-pointer">
        <span className="block text-sm font-semibold text-gray-700">
          Drag and drop Technical BoM document here
        </span>
        <span className="mt-1 block text-xs text-gray-500">
          or click to choose file
        </span>
        <span className="mt-3 inline-flex max-w-full items-center rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700">
          <span className="truncate">{file?.name || 'No file selected'}</span>
        </span>
      </label>
    </div>
  );
};

const PANEL_TYPE_OPTIONS = [
  { value: 'PLC', label: 'PLC Panel' },
  { value: 'MCC', label: 'MCC Panel' },
  { value: 'VFD', label: 'VFD Panel' },
  { value: 'MCC cum PLC', label: 'MCC cum PLC Panel' },
  { value: 'FLP', label: 'FLP Panel' },
  { value: 'RIO Box', label: 'RI/O Box Panel' },
];

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

const parseFilterValues = (value = '') => (
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
);

const MultiSelectFilter = ({ label, options, values, onChange, className = '' }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = new Set(values);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const buttonLabel = values.length === 0
    ? label
    : values.length === 1
      ? options.find((option) => option.value === values[0])?.label || values[0]
      : `${values.length} selected`;

  const toggleValue = (value) => {
    const next = selected.has(value)
      ? values.filter((item) => item !== value)
      : [...values, value];
    onChange(next);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 text-left text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      >
        <span className="truncate">{buttonLabel}</span>
        <ChevronDown size={14} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 max-h-72 w-full min-w-[210px] overflow-y-auto rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl" role="listbox" aria-multiselectable="true">
          {options.map((option) => {
            const checked = selected.has(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={checked}
                onClick={() => toggleValue(option.value)}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm ${checked ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white'}`}>
                  {checked && <Check size={11} strokeWidth={3} />}
                </span>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const getInitialKickoffForm = () => ({
  date: '',
  time: '',
  attendees: [],
  agenda: 'Kick-off Meeting to review customer requirements, scope, responsibilities, timeline, and next actions.',
  meetingLink: '',
  finalTechnicalBomDocument: null,
});

const normalizeUserList = (payload) => {
  if (Array.isArray(payload?.users)) return payload.users;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
};

const getUserId = (user) => String(user?._id || user || '');

const getKickoffStatus = (inquiry) => inquiry?.kickoffMeeting?.status || '';

const isKickoffScheduledOrReady = (inquiry) => ['Scheduled', 'Ready For Completion'].includes(getKickoffStatus(inquiry));

const isKickoffTimeCompleted = (inquiry) => {
  const scheduledAt = inquiry?.kickoffMeeting?.scheduledAt;
  if (!scheduledAt) return false;
  return new Date(scheduledAt).getTime() <= Date.now();
};

const buildKickoffFormFromInquiry = (inquiry) => {
  const meeting = inquiry?.kickoffMeeting || {};
  return {
    date: meeting.date || (meeting.scheduledAt ? new Date(meeting.scheduledAt).toISOString().slice(0, 10) : ''),
    time: meeting.time || (meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''),
    attendees: Array.isArray(meeting.attendees) ? meeting.attendees.map(getUserId).filter(Boolean) : [],
    agenda: meeting.agenda || getInitialKickoffForm().agenda,
    meetingLink: meeting.meetingLink || '',
    finalTechnicalBomDocument: meeting.finalTechnicalBomDocument || null,
  };
};

const getEntityId = (value) => {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || value.value || '');
  return String(value);
};

const isEstimationAccount = (account = {}) => {
  const values = [
    account.department,
    account.departmentName,
    account.departmentCode,
    account.teamId?.name,
    ...(Array.isArray(account.hodDepartmentNames) ? account.hodDepartmentNames : []),
    ...(Array.isArray(account.hodDepartmentInfo)
      ? account.hodDepartmentInfo.flatMap((department) => [department?.name, department?.code])
      : []),
  ];

  return values.some((value) => {
    const token = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return token === 'estimation' || token === 'estimator' ||
      token.startsWith('estimation') || token.startsWith('estimator');
  });
};

const isSalesAccount = (account = {}) => {
  const values = [
    account.department,
    account.departmentName,
    account.departmentCode,
    account.teamId?.name,
    ...(Array.isArray(account.hodDepartmentNames) ? account.hodDepartmentNames : []),
    ...(Array.isArray(account.hodDepartmentInfo)
      ? account.hodDepartmentInfo.flatMap((department) => [department?.name, department?.code])
      : []),
  ];

  return values.some((value) => {
    const token = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return token === 'sales' || token.startsWith('sales');
  });
};

const getCreatedByName = (inquiry = {}) => {
  const createdBy = inquiry.createdBy;
  if (!createdBy || typeof createdBy === 'string') return '—';
  return createdBy.name || createdBy.email || '—';
};

const InquiriesPage = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const canCreateInquiry = hasPermission(INQUIRY_PERMISSIONS.CREATE);
  const canEditInquiry = hasPermission(INQUIRY_PERMISSIONS.EDIT);
  const canManageFollowUp = hasPermission(INQUIRY_PERMISSIONS.FOLLOW_UP);
  const canCommercialSubmit = hasPermission(INQUIRY_PERMISSIONS.COMMERCIAL_SUBMIT);
  const canCompleteKickoff = useCallback((inquiry = {}) => {
    if (user?.role === 'admin' || isEstimationAccount(user)) return true;
    const isSalesLeadership = ['hod', 'manager', 'team_lead'].includes(user?.role) &&
      isSalesAccount(user);
    if (isSalesLeadership) return true;
    const currentUserId = getEntityId(user?._id || user?.id);
    const creatorId = getEntityId(inquiry.createdBy);
    return Boolean(currentUserId && creatorId && currentUserId === creatorId);
  }, [user]);
  const canEditInquiryRecord = useCallback((inquiry = {}) => {
    if (!canEditInquiry) return false;
    if (typeof inquiry.canEdit === 'boolean') return inquiry.canEdit;

    const currentUserId = getEntityId(user?._id || user?.id);
    const creatorId = getEntityId(inquiry.createdBy);
    return user?.role === 'admin' || Boolean(currentUserId && creatorId && currentUserId === creatorId);
  }, [canEditInquiry, user]);

  const [inquiries, setInquiries] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
    limit: 50,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState('');
  const [filterStatuses, setFilterStatuses] = useState(() => parseFilterValues(searchParams.get('statuses') || searchParams.get('status')));
  const [filterPanelTypes, setFilterPanelTypes] = useState(() => parseFilterValues(searchParams.get('panelTypes')));
  const [filterCreatedBy, setFilterCreatedBy] = useState(() => searchParams.get('createdBy') || '');
  const [creatorOptions, setCreatorOptions] = useState([]);
  const [financialYear, setFinancialYear] = useState(() => searchParams.get('financialYear') || getStoredFinancialYear() || getCurrentFinancialYear());
  const financialYearOptions = [ALL_YEARS_VALUE, ...generateFinancialYearOptions()];
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [kickoffModal, setKickoffModal] = useState(false);
  const [kickoffMode, setKickoffMode] = useState('schedule');
  const [pendingConversion, setPendingConversion] = useState(null);
  const [kickoffForm, setKickoffForm] = useState(getInitialKickoffForm);
  const [kickoffErrors, setKickoffErrors] = useState({});
  const [meetingUsers, setMeetingUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [usersDropdownOpen, setUsersDropdownOpen] = useState(false);
  const [statusModal, setStatusModal] = useState({ isOpen: false, type: '', inquiry: null, nextStatus: '' });
  const [statusModalForm, setStatusModalForm] = useState(getInitialStatusModalForm);
  const [statusModalErrors, setStatusModalErrors] = useState({});
  const [followUpModal, setFollowUpModal] = useState({
    isOpen: false,
    inquiry: null,
    nextFollowUpDate: '',
    remarks: '',
  });
  const [followUpError, setFollowUpError] = useState('');

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (search) params.search = search;
      if (filterStatuses.length > 0) params.statuses = filterStatuses.join(',');
      if (filterPanelTypes.length > 0) params.panelTypes = filterPanelTypes.join(',');
      if (filterCreatedBy) params.createdBy = filterCreatedBy;
      if (financialYear) params.financialYear = financialYear;

      const { data } = await API.get('/inquiries', { params });
      setInquiries(data.data || []);
      setCreatorOptions(Array.isArray(data.filters?.creators) ? data.filters.creators : []);
      setPagination({
        total: data.pagination?.total || 0,
        page: data.pagination?.page || page,
        pages: data.pagination?.pages || 1,
        limit: data.pagination?.limit || limit,
      });
    } catch {
      toast.error('Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, filterStatuses, filterPanelTypes, filterCreatedBy, financialYear, toast]);

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);
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

  useEffect(() => { setPage(1); }, [search, filterStatuses, filterPanelTypes, filterCreatedBy, financialYear, limit]);

  const fetchMeetingUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const { data } = await API.get('/users/kickoff-attendees');
      setMeetingUsers(normalizeUserList(data));
    } catch {
      toast.error('Failed to load users from User Management');
      setMeetingUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [toast]);

  const openKickoffModal = (inquiry) => {
    setKickoffMode('schedule');
    setPendingConversion(inquiry);
    setKickoffForm(getInitialKickoffForm());
    setKickoffErrors({});
    setUserSearch('');
    setUsersDropdownOpen(false);
    setKickoffModal(true);
    fetchMeetingUsers();
  };

  const openScheduledKickoffModal = (inquiry) => {
    setKickoffMode('view');
    setPendingConversion(inquiry);
    setKickoffForm(buildKickoffFormFromInquiry(inquiry));
    setKickoffErrors({});
    setUserSearch('');
    setUsersDropdownOpen(false);
    setKickoffModal(true);
    fetchMeetingUsers();
  };

  const downloadInquiryFile = async (inquiry, attachment) => {
    try {
      await downloadProtectedFile({
        resource: 'inquiries',
        recordId: inquiry?._id,
        attachment,
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || 'Attachment download failed');
    }
  };

  // ── Convert / Status workflow ───────────────────────────────────────────
  const updateInquiryStatus = async (inquiry, nextStatus, extraPayload = {}, options = {}) => {
    try {
      if (!options.skipOptimistic) {
        setInquiries(prev =>
          prev.map(item =>
            item._id === inquiry._id
              ? { ...item, status: nextStatus, ...extraPayload.optimisticPatch }
              : item
          )
        );
      }

      const payload = extraPayload.formData || { status: nextStatus, ...(extraPayload.body || {}) };
      const { data } = await API.patch(`/inquiries/${inquiry._id}/status`, payload);
      const updatedInquiry = data?.data;

      if (updatedInquiry?._id) {
        setInquiries(prev =>
          prev.map(item =>
            item._id === updatedInquiry._id
              ? { ...item, ...updatedInquiry }
              : item
          )
        );
      }

      toast.success('Status updated');
      return true;
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
        'Failed to update status'
      );

      if (!options.skipOptimistic) {
        setInquiries(prev =>
          prev.map(item =>
            item._id === inquiry._id ? inquiry : item
          )
        );
      }
      return false;
    }
  };

  const closeStatusModal = () => {
    setStatusModal({ isOpen: false, type: '', inquiry: null, nextStatus: '' });
    setStatusModalForm(getInitialStatusModalForm());
    setStatusModalErrors({});
  };

  const openStatusModal = (inquiry, nextStatus) => {
    const type = nextStatus === 'Order Lost'
      ? 'orderLost'
      : nextStatus === 'Inquiry Hold'
        ? 'inquiryHold'
        : nextStatus === 'BoM Approval Pending'
          ? 'bomApproval'
          : nextStatus === 'Technical BoM Submitted'
            ? 'technicalBom'
            : 'revision';

    setStatusModal({ isOpen: true, type, inquiry, nextStatus });
    setStatusModalForm(getInitialStatusModalForm());
    setStatusModalErrors({});
  };

  const setStatusModalValue = (field, value) => {
    setStatusModalForm(prev => ({ ...prev, [field]: value }));
    setStatusModalErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleStatusChange = (inquiry, nextStatus) => {
    if (!canEditInquiryRecord(inquiry)) {
      toast.error('Only the inquiry creator, Estimation, or Admin can change this inquiry');
      return;
    }

    if (nextStatus === 'Commercial BOM Submission' && !canCommercialSubmit) {
      toast.error('Commercial Submit permission is required');
      return;
    }

    const currentStatus = normalizeInquiryStatus(inquiry.status);

    if (nextStatus === currentStatus && nextStatus !== 'Revision') return;

    if (nextStatus === 'Order Won') {
      openKickoffModal(inquiry);
      return;
    }

    if (['Order Lost', 'Inquiry Hold', 'BoM Approval Pending', 'Technical BoM Submitted', 'Revision'].includes(nextStatus)) {
      openStatusModal(inquiry, nextStatus);
      return;
    }

    updateInquiryStatus(inquiry, nextStatus);
  };

  const handleStatusModalSave = async () => {
    const { inquiry, nextStatus, type } = statusModal;
    if (!inquiry) return;

    const errors = {};
    let body = { status: nextStatus };
    let formData = null;

    if (type === 'orderLost') {
      if (!statusModalForm.orderLostReason) errors.orderLostReason = 'Reason is required';
      body.statusDetails = {
        orderLost: {
          reason: statusModalForm.orderLostReason,
          additionalRemark: statusModalForm.orderLostRemark,
        },
      };
    }

    if (type === 'inquiryHold') {
      if (!statusModalForm.holdReason) errors.holdReason = 'Hold reason is required';
      body.statusDetails = {
        inquiryHold: { reason: statusModalForm.holdReason },
      };
    }

    if (type === 'bomApproval') {
      body.statusDetails = {
        bomApproval: {
          additionalRemark: statusModalForm.bomApprovalRemark,
        },
      };
    }

    if (type === 'technicalBom') {
      if (!statusModalForm.technicalBomFile) {
        errors.technicalBomFile = 'Technical BoM Document is required';
      }

      body.statusDetails = {
        revision: {
          customerComment: statusModalForm.revisionCustomerComment,
          internalNotes: statusModalForm.revisionInternalNotes,
        },
      };
      body.bomSubmissionRemarks = statusModalForm.bomSubmissionRemarks;

      if (statusModalForm.technicalBomFile) {
        formData = new FormData();
        formData.append('_json', JSON.stringify({
          ...body,
          keptBomAttachments: inquiry.bomAttachments || [],
          bomSubmissionRemarks: statusModalForm.bomSubmissionRemarks,
        }));
        formData.append('bomAttachments', statusModalForm.technicalBomFile);
      }
    }

    if (type === 'revision') {
      if (!statusModalForm.revisionFile) {
        errors.revisionFile = 'Technical BoM Document is required';
      }

      body.statusDetails = {
        revision: {
          customerComment: statusModalForm.revisionCustomerComment,
          internalNotes: statusModalForm.revisionInternalNotes,
        },
      };
      body.bomSubmissionRemarks = statusModalForm.bomSubmissionRemarks;

      if (statusModalForm.revisionFile) {
        formData = new FormData();
        formData.append('_json', JSON.stringify({
          ...body,
          keptBomAttachments: inquiry.bomAttachments || [],
          bomSubmissionRemarks: statusModalForm.bomSubmissionRemarks,
        }));
        formData.append('bomAttachments', statusModalForm.revisionFile);
      }
    }

    if (Object.keys(errors).length) {
      setStatusModalErrors(errors);
      if (errors.technicalBomFile || errors.revisionFile) {
        toast.error('Please upload Technical BoM Document before changing status');
      }
      return;
    }

    try {
      setSubmitting(true);
      const saved = await updateInquiryStatus(
        inquiry,
        nextStatus,
        formData ? { formData } : { body },
        { skipOptimistic: true }
      );
      if (saved) closeStatusModal();
    } finally {
      setSubmitting(false);
    }
  };

  const closeKickoffModal = () => {
    setKickoffModal(false);
    setKickoffMode('schedule');
    setPendingConversion(null);
    setKickoffForm(getInitialKickoffForm());
    setKickoffErrors({});
    setUserSearch('');
    setUsersDropdownOpen(false);
  };

  const handleKickoffInputChange = (field, value) => {
    setKickoffForm(prev => ({ ...prev, [field]: value }));
    setKickoffErrors(prev => ({ ...prev, [field]: '' }));
  };

  const toggleKickoffUser = (userId) => {
    setKickoffForm(prev => {
      const exists = prev.attendees.includes(userId);
      return {
        ...prev,
        attendees: exists
          ? prev.attendees.filter(id => id !== userId)
          : [...prev.attendees, userId],
      };
    });
    setKickoffErrors(prev => ({ ...prev, attendees: '' }));
  };

  const validateKickoffForm = () => {
    const nextErrors = {};

    if (!kickoffForm.date) nextErrors.date = 'Date is required';
    if (!kickoffForm.time) nextErrors.time = 'Time is required';
    if (!kickoffForm.attendees.length) nextErrors.attendees = 'Select at least one person';
    if (!kickoffForm.agenda.trim()) nextErrors.agenda = 'Agenda is required';

    setKickoffErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleScheduleKickoffMeeting = async () => {
    if (!pendingConversion || !validateKickoffForm()) return;

    try {
      setSubmitting(true);

      const payload = {
        date: kickoffForm.date,
        time: kickoffForm.time,
        attendees: kickoffForm.attendees,
        agenda: kickoffForm.agenda,
        meetingLink: kickoffForm.meetingLink,
      };

      if (isFileObject(kickoffForm.finalTechnicalBomDocument)) {
        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          formData.append(key, Array.isArray(value) ? JSON.stringify(value) : value);
        });
        formData.append('finalTechnicalBomDocument', kickoffForm.finalTechnicalBomDocument);

        await API.post(`/kickoff-workflows/${pendingConversion._id}/schedule`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await API.post(`/kickoff-workflows/${pendingConversion._id}/schedule`, payload);
      }

      toast.success(kickoffMode === 'edit' ? 'Kick-off Meeting updated. WhatsApp and Outlook confirmations sent/queued.' : 'Kick-off Meeting scheduled. WhatsApp and Outlook confirmations sent/queued.');
      closeKickoffModal();
      fetchInquiries();
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
        'Failed to schedule Kick-off Meeting'
      );
      fetchInquiries();
    } finally {
      setSubmitting(false);
    }
  };


  const handleKickoffMeetingDone = async () => {
    if (!pendingConversion) return;
    if (!canCompleteKickoff(pendingConversion)) {
      toast.error('Only Sales HOD/TL, the inquiry creator, an Estimation user, or an Admin can complete the kickoff');
      return;
    }

    if (!isKickoffTimeCompleted(pendingConversion)) {
      toast.error('Kick-off Meeting can be marked done only after the scheduled date/time is completed');
      return;
    }

    try {
      setSubmitting(true);
      await API.post(`/kickoff-workflows/${pendingConversion._id}/complete`);
      toast.success('Kick-off Meeting marked done and project created');
      closeKickoffModal();
      fetchInquiries();
      navigate('/projects');
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
        'Failed to complete Kick-off Meeting and create project'
      );
      fetchInquiries();
    } finally {
      setSubmitting(false);
    }
  };

  const openFollowUpModal = (inquiry) => {
    if (!canManageFollowUp || !canEditInquiryRecord(inquiry)) return;
    setFollowUpModal({
      isOpen: true,
      inquiry,
      nextFollowUpDate: inquiry?.nextFollowUpDate
        ? new Date(inquiry.nextFollowUpDate).toISOString().slice(0, 10)
        : '',
      remarks: inquiry?.remarks || '',
    });
    setFollowUpError('');
  };

  const closeFollowUpModal = (force = false) => {
    if (submitting && !force) return;
    setFollowUpModal({
      isOpen: false,
      inquiry: null,
      nextFollowUpDate: '',
      remarks: '',
    });
    setFollowUpError('');
  };

  const saveFollowUpReminder = async () => {
    const inquiry = followUpModal.inquiry;
    if (!inquiry) return;

    if (!followUpModal.nextFollowUpDate) {
      setFollowUpError('Follow-up date is required');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await API.patch(`/inquiries/${inquiry._id}/follow-up`, {
        nextFollowUpDate: followUpModal.nextFollowUpDate,
        remarks: followUpModal.remarks,
      });

      if (data?.data?._id) {
        setInquiries((current) => current.map((item) => (
          item._id === data.data._id ? { ...item, ...data.data } : item
        )));
      }

      toast.success('Follow-up reminder updated');
      closeFollowUpModal(true);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update follow-up reminder');
    } finally {
      setSubmitting(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setFilterStatuses([]);
    setFilterPanelTypes([]);
    setFilterCreatedBy('');
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns = [
    {
      key: 'inquiryId', label: 'ID', width: '100px',
      render: v => <span className="font-mono text-xs font-semibold text-blue-700">{v}</span>,
    },
    {
      key: 'inquiryDate', label: 'Date', width: '100px',
      render: v => new Date(v).toLocaleDateString('en-IN'),
    },
    {
      key: 'customerName',
      label: 'Customer / Project Name',
      render: (_v, row) => (
        <div>
          <p className="font-medium text-gray-800 text-sm">{getLiveCustomerName(row) || '—'}</p>
          <p className="text-xs text-gray-400">
            {row.projectName || row.projectReference?.projectName || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'createdBy',
      label: 'Created By',
      width: '150px',
      render: (_value, row) => {
        const currentUserId = getEntityId(user?._id || user?.id);
        const creatorId = getEntityId(row.createdBy);
        const isCurrentUser = Boolean(currentUserId && creatorId && currentUserId === creatorId);

        return (
          <span className="text-sm font-medium text-gray-700">
            {getCreatedByName(row)}
            {isCurrentUser && (
              <span className="ml-1 text-xs font-normal text-gray-400">(You)</span>
            )}
          </span>
        );
      },
    },
    { key: 'mobileNumber', label: 'Mobile', width: '120px' },
    {
      key: 'panelTypes', label: 'Panel Type', width: '140px',
      render: (v, row) => {
        const types = Array.isArray(v) && v.length ? v : (row.productType ? [row.productType] : []);
        return (
          <div className="flex flex-wrap gap-1">
            {types.slice(0, 2).map(t => (
              <span key={`${t}-${getPanelTypeLabel(t)}`} className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">{getPanelTypeLabel(t)}</span>
            ))}
            {types.length > 2 && <span className="text-xs text-gray-400">+{types.length - 2}</span>}
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      width: '300px',
      render: (v, row) => {
        const currentStatus = normalizeInquiryStatus(v);
        const selectValue = currentStatus === 'Revision' ? 'Revision_CURRENT' : currentStatus;

        if (!canEditInquiryRecord(row)) {
          return <StatusBadge status={getStatusLabel(currentStatus)} />;
        }

        return (
          <Select
            value={selectValue}
            onChange={(e) => {
              const selectedStatus = e.target.value === 'Revision_CURRENT' ? 'Revision' : e.target.value;
              handleStatusChange(row, selectedStatus);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full min-w-[270px]"
          >
            {STATUS_OPTIONS.map(({ value, label }) => {
              if (currentStatus === 'Revision' && value === 'Revision') {
                return <option key="Revision_CURRENT" value="Revision_CURRENT">Revision</option>;
              }

              return (
                <option
                  key={value}
                  value={value}
                  disabled={value === 'Commercial BOM Submission' && !canCommercialSubmit}
                >
                  {label}
                </option>
              );
            })}
            {currentStatus === 'Revision' && (
              <option key="Revision_UPLOAD" value="Revision">Upload New Revision</option>
            )}
          </Select>
        );
      },
    },
    {
      key: '_id', label: 'Actions', width: '220px',
      render: (_, row) => {
        const latestBomRevisionLabel = getLatestBomRevisionLabel(row.bomAttachments);
        const canEditRow = canEditInquiryRecord(row);

        return (
          <div className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {canEditRow && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/inquiries/${row._id}/edit`);
              }}
              className="rounded p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
              title="Edit inquiry"
            >
              <Edit2 size={14} />
            </button>
          )}

          {canManageFollowUp && canEditRow && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openFollowUpModal(row);
              }}
              className="rounded p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
              title="Set follow-up reminder"
            >
              <Clock size={14} />
            </button>
          )}

          {latestBomRevisionLabel && (
            <span
              className="rounded bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700"
              title="Latest Technical BoM revision"
            >
              {latestBomRevisionLabel}
            </span>
          )}

          {(canEditRow || canCompleteKickoff(row)) && isOrderWonStatus(row.status) && !row.convertedToProject && isKickoffScheduledOrReady(row) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openScheduledKickoffModal(row);
              }}
              className={`rounded px-2 py-1 text-[11px] font-semibold ${isKickoffTimeCompleted(row) ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
              title={row.kickoffMeeting?.scheduledAt ? `Kick-off: ${new Date(row.kickoffMeeting.scheduledAt).toLocaleString('en-IN')}` : 'Kick-off Meeting scheduled'}
            >
              {isKickoffTimeCompleted(row) ? 'Mark Kickoff Done' : 'Kickoff Scheduled'}
            </button>
          )}

          {isOrderWonStatus(row.status) && row.convertedToProject && (
            <span
              className="rounded bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-700"
              title={row.projectReference?.projectId ? `Linked project: ${row.projectReference.projectId}` : 'Project already created'}
            >
              Project Created
            </span>
          )}
          </div>
        );
      },
    },
  ];

  const limitOptions = getPageSizeOptions(pagination?.total || 0, limit);
  const hasFilters = search || filterStatuses.length > 0 || filterPanelTypes.length > 0 || filterCreatedBy;
  const existingKickoffUsers = Array.isArray(pendingConversion?.kickoffMeeting?.attendees)
    ? pendingConversion.kickoffMeeting.attendees.filter(user => typeof user === 'object' && user?._id)
    : [];
  const mergedMeetingUsers = [
    ...meetingUsers,
    ...existingKickoffUsers.filter(user => !meetingUsers.some(item => getUserId(item) === getUserId(user))),
  ];
  const selectedMeetingUsers = mergedMeetingUsers.filter(user => kickoffForm.attendees.includes(getUserId(user)));
  const filteredMeetingUsers = meetingUsers.filter(user => {
    const keyword = userSearch.trim().toLowerCase();
    if (!keyword) return true;
    return [
      user.name,
      user.email,
      user.role,
      user.teamId?.name,
      user.departmentName,
      user.departmentCode,
      ...(Array.isArray(user.hodDepartmentNames) ? user.hodDepartmentNames : []),
    ]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(keyword));
  });

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="fade-in min-w-0 space-y-4">

      {/* Header */}
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900">All Inquiries</h2>
          <p className="text-sm text-gray-500">{pagination.total} total records</p>
        </div>

        {canCreateInquiry && (
          <Button onClick={() => navigate('/inquiries/new')} className="w-full justify-center sm:w-auto">
            <Plus size={16} />
            New Inquiry
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="p-3 sm:sticky sm:top-0 sm:z-30">
        <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="relative w-full min-w-0 lg:min-w-[220px] lg:flex-1 lg:max-w-[360px]">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search Inquiry ID, Customer, Mobile.."
              value={search}
              onChange={e => setSearch(e.target.value)}
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

          <div className="grid w-full min-w-0 grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:w-auto lg:flex lg:flex-wrap lg:items-center">
            <MultiSelectFilter
              label="All Statuses"
              options={STATUS_OPTIONS}
              values={filterStatuses}
              onChange={setFilterStatuses}
              className="w-full lg:w-[180px] lg:shrink-0"
            />

            <MultiSelectFilter
              label="All Panel Types"
              options={PANEL_TYPE_OPTIONS}
              values={filterPanelTypes}
              onChange={setFilterPanelTypes}
              className="w-full lg:w-[180px] lg:shrink-0"
            />

            <Select
              value={filterCreatedBy}
              onChange={(e) => setFilterCreatedBy(e.target.value)}
              className="h-9 w-full lg:w-[170px] lg:shrink-0"
              aria-label="Filter inquiries by creator"
            >
              <option value="">All Created By</option>
              {creatorOptions.map((creator) => (
                <option key={creator._id} value={creator._id}>
                  {creator.name || creator.email || 'Unknown User'}
                </option>
              ))}
            </Select>

            <Select
              value={financialYear}
              onChange={(e) => handleFinancialYearChange(e.target.value)}
              className="h-9 w-full lg:w-[120px] lg:shrink-0"
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
              className="h-9 w-full lg:w-[105px] lg:shrink-0"
              aria-label="Records per page"
            >
              {limitOptions.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </Select>
          </div>

          <div className="flex w-full items-center justify-end gap-2 lg:w-auto">
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-sm text-red-500 hover:bg-red-50 hover:text-red-700"
              >
                <X size={14} /> Clear
              </button>
            )}

            <button
              type="button"
              onClick={fetchInquiries}
              className="h-9 shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              title="Refresh"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="min-w-0 overflow-hidden">
        <Table
          columns={columns}
          data={inquiries}
          loading={loading}
          pagination={pagination}
          onPageChange={setPage}
          onRowClick={(row) => navigate(`/inquiries/${row._id}`)}
          emptyMessage={canCreateInquiry ? "No inquiries found. Click 'New Inquiry' to add one." : 'No inquiries found.'}
        />
      </Card>

      <Modal
        isOpen={followUpModal.isOpen}
        onClose={submitting ? undefined : closeFollowUpModal}
        title="Follow-up / Reminder"
        size="sm"
        topOffset="topbar"
      >
        <div className="space-y-4">
          {followUpModal.inquiry && (
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-800">
                {followUpModal.inquiry.projectName || getLiveCustomerName(followUpModal.inquiry)}
              </p>
              <p className="text-xs text-gray-500">
                Inquiry: {followUpModal.inquiry.inquiryId}
              </p>
            </div>
          )}

          <FormField label="Next Follow-up Date" required error={followUpError}>
            <Input
              type="date"
              value={followUpModal.nextFollowUpDate}
              onChange={(event) => {
                setFollowUpModal((current) => ({
                  ...current,
                  nextFollowUpDate: event.target.value,
                }));
                setFollowUpError('');
              }}
              disabled={submitting}
            />
          </FormField>

          <FormField label="Follow-up Note">
            <Textarea
              value={followUpModal.remarks}
              onChange={(event) => setFollowUpModal((current) => ({
                ...current,
                remarks: event.target.value,
              }))}
              rows={3}
              placeholder="Enter follow-up note"
              disabled={submitting}
            />
          </FormField>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
            <Button type="button" variant="secondary" onClick={closeFollowUpModal} disabled={submitting}>
              Cancel
            </Button>
            <Button type="button" onClick={saveFollowUpReminder} loading={submitting}>
              Save Reminder
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Status workflow modal ───────────────────────────────────────────── */}
      <Modal
        isOpen={statusModal.isOpen}
        onClose={submitting ? undefined : closeStatusModal}
        title={statusModal.nextStatus || 'Update Status'}
        size="md"
        topOffset="topbar"
      >
        <div className="space-y-5">
          {statusModal.inquiry && (
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-800">{statusModal.inquiry.projectName || getLiveCustomerName(statusModal.inquiry)}</p>
              <p className="text-xs text-gray-500">Inquiry: {statusModal.inquiry.inquiryId}</p>
            </div>
          )}

          {statusModal.type === 'orderLost' && (
            <>
              <FormField label="Reason for Order Lost" required error={statusModalErrors.orderLostReason}>
                <Select
                  value={statusModalForm.orderLostReason}
                  onChange={(e) => setStatusModalValue('orderLostReason', e.target.value)}
                >
                  <option value="">Select reason</option>
                  {ORDER_LOST_REASONS.map(reason => <option key={reason} value={reason}>{reason}</option>)}
                </Select>
              </FormField>

              <FormField label="Additional Remark">
                <Textarea
                  value={statusModalForm.orderLostRemark}
                  onChange={(e) => setStatusModalValue('orderLostRemark', e.target.value)}
                  placeholder="Write any extra reason or note..."
                  rows={4}
                />
              </FormField>
            </>
          )}

          {statusModal.type === 'inquiryHold' && (
            <FormField label="Hold Reason" required error={statusModalErrors.holdReason}>
              <Select
                value={statusModalForm.holdReason}
                onChange={(e) => setStatusModalValue('holdReason', e.target.value)}
              >
                <option value="">Select hold reason</option>
                {HOLD_REASONS.map(reason => <option key={reason} value={reason}>{reason}</option>)}
              </Select>
            </FormField>
          )}

          {statusModal.type === 'bomApproval' && (
            <FormField label="Additional Remark">
              <Textarea
                value={statusModalForm.bomApprovalRemark}
                onChange={(e) => setStatusModalValue('bomApprovalRemark', e.target.value)}
                placeholder="Write BoM approval pending remark..."
                rows={4}
              />
            </FormField>
          )}

          {['technicalBom', 'revision'].includes(statusModal.type) && (
            <>
              <FormField label="Customer Comment">
                <Input
                  value={statusModalForm.revisionCustomerComment}
                  onChange={(e) => setStatusModalValue('revisionCustomerComment', e.target.value)}
                  placeholder="Customer comment"
                />
              </FormField>

              <FormField label="Internal Notes">
                <Textarea
                  value={statusModalForm.revisionInternalNotes}
                  onChange={(e) => setStatusModalValue('revisionInternalNotes', e.target.value)}
                  placeholder="Internal notes"
                  rows={4}
                />
              </FormField>

              <FormField label="Technical BoM Remarks">
                <Textarea
                  value={statusModalForm.bomSubmissionRemarks}
                  onChange={(e) => setStatusModalValue('bomSubmissionRemarks', e.target.value)}
                  placeholder={statusModal.type === 'revision' ? 'Enter revision remarks' : 'Enter Technical BOM remarks'}
                  rows={3}
                />
              </FormField>

              <FormField
                label="Technical BoM Document"
                required
                error={statusModal.type === 'revision' ? statusModalErrors.revisionFile : statusModalErrors.technicalBomFile}
              >
                <FileDropInput
                  file={statusModal.type === 'revision' ? statusModalForm.revisionFile : statusModalForm.technicalBomFile}
                  onFileChange={(file) => setStatusModalValue(
                    statusModal.type === 'revision' ? 'revisionFile' : 'technicalBomFile',
                    file
                  )}
                />
              </FormField>

              {Array.isArray(statusModal.inquiry?.bomAttachments) && statusModal.inquiry.bomAttachments.length > 0 && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                  <p className="text-sm font-semibold text-slate-800">Uploaded Technical BOM Documents</p>
                  <div className="mt-2 space-y-2">
                    {statusModal.inquiry.bomAttachments.map((file, index) => (
                      <div
                        key={file?.storedName || file?.storagePath || index}
                        className="rounded-lg border border-indigo-100 bg-white px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => downloadInquiryFile(statusModal.inquiry, file)}
                            className="min-w-0 truncate text-sm font-medium text-blue-700 hover:underline"
                          >
                            {file?.name || file?.originalName || file?.storedName || 'Technical BoM Document'}
                          </button>
                          <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                            {getBomRevisionLabel(file) || file?.versionLabel || `Document ${index + 1}`}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {file?.uploadedAt ? `Uploaded: ${formatUploadDateTime(file.uploadedAt)}` : ''}
                          {getUploadedByName(file) ? ` · Uploaded by: ${getUploadedByName(file)}` : ''}
                          {file?.remarks ? ` · ${file.remarks}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="secondary" onClick={closeStatusModal} disabled={submitting}>
              Cancel
            </Button>
            <Button type="button" onClick={handleStatusModalSave} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Kick-off Meeting Schedule Modal ─────────────────────────────────── */}
      <Modal isOpen={kickoffModal} onClose={closeKickoffModal} title={kickoffMode === 'view' ? 'Kick-off Meeting' : kickoffMode === 'edit' ? 'Edit Kick-off Meeting' : 'Schedule Kick-off Meeting'} size="md" topOffset="topbar">
        <div className="space-y-5">
          <div>
            <p className="text-base font-semibold text-gray-900">{kickoffMode === 'view' ? 'Kick-off Meeting Scheduled' : kickoffMode === 'edit' ? 'Edit Kick-off Meeting' : 'Schedule Kick-off Meeting'}</p>
            <p className="mt-1 text-sm text-gray-500">
              {kickoffMode === 'view'
                ? 'Review the scheduled meeting details. Use Edit to change date, time, persons, agenda, or meeting link.'
                : kickoffMode === 'edit'
                  ? 'Update the Kick-off Meeting details. WhatsApp and Outlook confirmations will be sent/queued again after saving.'
                  : 'Select the meeting date, time, and persons from User Management. WhatsApp and Outlook confirmations will include assigned persons, date/time, agenda, and meeting link when available.'}
            </p>
          </div>

          {pendingConversion && (
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-800">{pendingConversion.projectName || getLiveCustomerName(pendingConversion)}</p>
              <p className="text-xs text-gray-500">Inquiry: {pendingConversion.inquiryId}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Date" required error={kickoffErrors.date}>
              <div className="relative">
                <Calendar size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  type="date"
                  value={kickoffForm.date}
                  onChange={(e) => handleKickoffInputChange('date', e.target.value)}
                  className="pl-9"
                  disabled={submitting || kickoffMode === 'view'}
                />
              </div>
            </FormField>

            <FormField label="Time" required error={kickoffErrors.time}>
              <div className="relative">
                <Clock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  type="time"
                  value={kickoffForm.time}
                  onChange={(e) => handleKickoffInputChange('time', e.target.value)}
                  className="pl-9"
                  disabled={submitting || kickoffMode === 'view'}
                />
              </div>
            </FormField>
          </div>

          <FormField label="Agenda" required error={kickoffErrors.agenda}>
            <textarea
              value={kickoffForm.agenda}
              onChange={(e) => handleKickoffInputChange('agenda', e.target.value)}
              rows={3}
              disabled={submitting || kickoffMode === 'view'}
              placeholder="Enter kickoff agenda..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </FormField>

          <FormField label="Meeting Link">
            <Input
              type="url"
              value={kickoffForm.meetingLink}
              onChange={(e) => handleKickoffInputChange('meetingLink', e.target.value)}
              disabled={submitting || kickoffMode === 'view'}
              placeholder="Paste Teams / Google Meet / Zoom link if available"
            />
          </FormField>

          <FormField label="Final Technical BoM Document">
            <Input
              type="file"
              onChange={(e) => handleKickoffInputChange('finalTechnicalBomDocument', e.target.files?.[0] || null)}
              disabled={submitting || kickoffMode === 'view'}
            />
            {kickoffForm.finalTechnicalBomDocument && !(isFileObject(kickoffForm.finalTechnicalBomDocument)) && (
              <p className="mt-2 text-xs text-gray-500">
                Attached:&nbsp;
                <button
                  type="button"
                  onClick={() => downloadInquiryFile(pendingConversion, kickoffForm.finalTechnicalBomDocument)}
                  className="font-semibold text-blue-700 underline"
                >
                  {kickoffForm.finalTechnicalBomDocument.name || kickoffForm.finalTechnicalBomDocument.storedName || 'Final Technical BoM'}
                </button>
              </p>
            )}
            {isFileObject(kickoffForm.finalTechnicalBomDocument) && (
              <p className="mt-2 text-xs text-gray-500">
                Selected: {kickoffForm.finalTechnicalBomDocument.name}
              </p>
            )}
          </FormField>

          <FormField label="Persons" required error={kickoffErrors.attendees}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setUsersDropdownOpen(prev => !prev)}
                disabled={submitting || usersLoading || kickoffMode === 'view'}
                className="flex min-h-[42px] w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex items-center gap-2 text-gray-700">
                  <Users size={15} className="text-gray-400" />
                  {usersLoading
                    ? 'Loading users...'
                    : selectedMeetingUsers.length
                      ? `${selectedMeetingUsers.length} person(s) selected`
                      : 'Select persons'}
                </span>
                <span className="text-xs text-gray-400">▾</span>
              </button>

              {selectedMeetingUsers.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedMeetingUsers.map(user => {
                    const selectedUserId = getUserId(user);
                    return (
                      <span key={selectedUserId} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                        {user.name || user.email}
                        <button
                          type="button"
                          onClick={() => toggleKickoffUser(selectedUserId)}
                          className="text-blue-400 hover:text-blue-700"
                          disabled={submitting || kickoffMode === 'view'}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {usersDropdownOpen && (
                <div className="absolute z-50 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-xl">
                  <div className="border-b border-gray-100 p-2">
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search by name, email, role or department..."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="border-b border-gray-100 px-3 py-1.5 text-xs text-gray-400">
                    {filteredMeetingUsers.length} of {meetingUsers.length} active user(s)
                  </div>

                  <div className="max-h-64 overflow-y-auto py-1">
                    {filteredMeetingUsers.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-gray-400">No users found</p>
                    ) : (
                      filteredMeetingUsers.map(user => {
                        const userId = getUserId(user);
                        const checked = kickoffForm.attendees.includes(userId);
                        return (
                          <button
                            type="button"
                            key={user._id}
                            onClick={() => toggleKickoffUser(userId)}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-blue-50"
                          >
                            <span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white'}`}>
                              {checked && <Check size={12} />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-gray-800">{user.name}</span>
                              <span className="block truncate text-xs text-gray-400">
                                {[user.email, user.role, user.departmentName || user.teamId?.name].filter(Boolean).join(' • ')}
                              </span>
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </FormField>

          {kickoffMode === 'view' && pendingConversion && (
            <div className={`rounded-lg p-3 text-sm ${isKickoffTimeCompleted(pendingConversion) ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'}`}>
              {isKickoffTimeCompleted(pendingConversion)
                ? canCompleteKickoff(pendingConversion)
                  ? 'Meeting time is completed. Click Kickoff Meeting Done to create the project.'
                  : 'Meeting time is completed. Sales HOD/TL, the inquiry creator, an Estimation user, or an Admin must mark it done.'
                : 'Kick-off Meeting is scheduled. The Done button will be available after the scheduled date/time.'}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={closeKickoffModal} disabled={submitting}>
              {kickoffMode === 'view' ? 'Close' : 'Cancel'}
            </Button>

            {kickoffMode === 'view' ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setKickoffMode('edit');
                    setKickoffErrors({});
                    setUsersDropdownOpen(false);
                  }}
                  disabled={submitting || !pendingConversion}
                >
                  <Edit2 size={14} />
                  Edit
                </Button>

                {canCompleteKickoff(pendingConversion) && (
                  <Button
                    type="button"
                    onClick={handleKickoffMeetingDone}
                    disabled={submitting || !pendingConversion || !isKickoffTimeCompleted(pendingConversion)}
                  >
                    {submitting ? 'Creating Project...' : 'Kickoff Meeting Done'}
                  </Button>
                )}
              </>
            ) : (
              <Button type="button" onClick={handleScheduleKickoffMeeting} disabled={submitting || usersLoading}>
                {submitting ? (kickoffMode === 'edit' ? 'Updating...' : 'Scheduling...') : (kickoffMode === 'edit' ? 'Update Kick-off Meeting' : 'Save / Schedule Workflow')}
              </Button>
            )}
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default InquiriesPage;
