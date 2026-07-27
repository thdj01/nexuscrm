import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, Plus } from 'lucide-react';
import { Button, FormField, Input } from '../common/FormComponents';
import { SearchableSelect } from '../common/FormComponents.extended';
import StickyActionBar from '../common/StickyActionBar';
import Modal from '../common/Modal';
import CustomerForm from '../customer/CustomerForm';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { CUSTOMER_PERMISSIONS } from '../../constants/permissions';
import { fetchProjectPlanningOptions } from '../../api/projectService';
import ProjectPlanningGrid from './ProjectPlanningGrid';
import ProjectDocumentAttachments from './ProjectDocumentAttachments';
import { getLiveCustomerId, getLiveCustomerName, resolveCustomerRecord } from '../../utils/customerUtils';

const FALLBACK_DEPARTMENTS = ['Design', 'Production', 'Purchase', 'Automation', 'Store', 'QC'];
const FALLBACK_PANEL_TYPES = ['PLC', 'MCC', 'VFD', 'MCC cum PLC', 'FLP', 'RIO Box'];
const PANEL_ALIASES = { PLC_MCC: 'MCC cum PLC', MCC_CUM_PLC: 'MCC cum PLC' };
const FALLBACK_DISALLOWED_DEPARTMENTS_BY_PANEL = Object.freeze({
  MCC: ['Automation'],
  VFD: ['Automation'],
});

const PROJECT_DRAFT_VERSION = 1;

const readProjectDraft = (key, serverUpdatedAt) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== PROJECT_DRAFT_VERSION || !parsed?.data || !parsed?.savedAt) return null;

    const savedAt = new Date(parsed.savedAt).getTime();
    const serverTime = serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : 0;
    if (!Number.isFinite(savedAt) || (Number.isFinite(serverTime) && serverTime > 0 && savedAt <= serverTime)) {
      localStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
};

const writeProjectDraft = (key, data) => {
  const savedAt = new Date().toISOString();
  try {
    localStorage.setItem(key, JSON.stringify({
      version: PROJECT_DRAFT_VERSION,
      savedAt,
      data,
    }));
    return savedAt;
  } catch {
    return '';
  }
};

const removeProjectDraft = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Browser storage may be unavailable in private/restricted environments.
  }
};

const isDepartmentAllowedForPanel = (department, panelType, restrictions = FALLBACK_DISALLOWED_DEPARTMENTS_BY_PANEL) => (
  !(restrictions?.[panelType] || []).includes(department)
);

const uniqueDepartmentsFromSelections = (selections = []) => (
  [...new Set(selections.map((selection) => selection.department).filter(Boolean))]
);

const gridCompletionPercentage = (grid = {}) => {
  const tasks = Array.isArray(grid.planningTasks) ? grid.planningTasks : [];
  if (!tasks.length) return Math.max(0, Math.min(100, Number(grid.completionPercentage || 0)));
  const completed = tasks.filter((task) => String(task.status || '').trim() === 'Completed').length;
  return Math.round((completed / tasks.length) * 100);
};

const todayDateStr = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const toDateStr = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const getInquiryNumber = (project) => {
  if (!project || typeof project !== 'object') return '';

  return String(
    project.inquiryNumber
      || project.inquiryReference?.inquiryId
      || project.sourceInquirySnapshot?.inquiryId
      || ''
  ).trim();
};

const normalizeDepartment = (value) => {
  const text = String(value || '').trim().toLowerCase().replace(/[\-_]+/g, ' ').replace(/\s+/g, ' ');
  const aliases = {
    design: 'Design', electrical: 'Design', engineering: 'Design', 'engineering design': 'Design',
    production: 'Production', prod: 'Production', manufacturing: 'Production',
    purchase: 'Purchase', purchasing: 'Purchase', procurement: 'Purchase',
    automation: 'Automation', programmer: 'Automation', programming: 'Automation', software: 'Automation',
    store: 'Store', stores: 'Store', dispatch: 'Store', despatch: 'Store',
    qc: 'QC', qa: 'QC', quality: 'QC', 'quality control': 'QC',
  };
  return aliases[text] || '';
};

const normalizePanelType = (value) => {
  const raw = String(value || '').trim();
  const aliased = PANEL_ALIASES[raw] || raw;
  if (/plc/i.test(aliased) && /mcc/i.test(aliased)) return 'MCC cum PLC';
  if (/rio/i.test(aliased)) return 'RIO Box';
  if (/flp/i.test(aliased)) return 'FLP';
  if (/plc/i.test(aliased)) return 'PLC';
  if (/vfd/i.test(aliased)) return 'VFD';
  if (/mcc/i.test(aliased)) return 'MCC';
  return FALLBACK_PANEL_TYPES.includes(aliased) ? aliased : '';
};

const inferLegacyPanelType = (project = {}) => {
  const snapshot = project.sourceInquirySnapshot || {};
  return [
    ...(Array.isArray(snapshot.panelTypes) ? snapshot.panelTypes : []),
    snapshot.panelType,
    snapshot.productType,
    snapshot.inquiryType,
  ].map(normalizePanelType).find(Boolean) || 'MCC';
};

const selectionKey = (department, panelType) => `${department}::${panelType}`;
const gridIdFor = (department, panelType, unitNumber) => `${department}-${panelType}-${unitNumber ? `UNIT-${unitNumber}` : 'COMMON'}`.replace(/\s+/g, '-').toUpperCase();

const gridNameFor = ({ department, panelType, quantity, planningMode, unitNumber }) => {
  if (planningMode === 'separate') return `${department} · ${panelType} – Unit ${unitNumber}`;
  if (quantity > 1) return `${department} · ${panelType} – Common Grid – Quantity ${quantity}`;
  return `${department} · ${panelType} – Quantity 1`;
};

const cleanCatalogTask = (task, department, gridId, gridName, index) => ({
  taskId: `${gridId}-${index + 1}`,
  order: index + 1,
  gridId,
  gridName,
  taskType: department === 'Automation' ? 'Programming' : 'Production',
  department,
  taskName: task.taskName || `Task ${index + 1}`,
  assignedTo: null,
  dependency: index === 0 ? '' : `${gridId}-${index}`,
  totalDays: 1,
  duration: 1,
  plannedStartDate: '',
  plannedEndDate: '',
  status: 'Pending',
  delayDays: 0,
  remark: '',
});

const createGrid = (selection, tasksByDepartment = {}, unitNumber) => {
  const planningMode = selection.quantity === 1 ? 'common' : selection.planningMode;
  const actualUnit = planningMode === 'separate' ? unitNumber : undefined;
  const gridId = gridIdFor(selection.department, selection.panelType, actualUnit);
  const gridName = gridNameFor({ ...selection, planningMode, unitNumber: actualUnit });
  return {
    gridId,
    name: gridName,
    gridName,
    department: selection.department,
    panelType: selection.panelType,
    panelQuantity: selection.quantity,
    planningMode,
    unitNumber: actualUnit,
    isCommon: planningMode === 'common',
    completionPercentage: 0,
    projectEndDate: '',
    delayedDays: 0,
    planningTasks: (tasksByDepartment[selection.department] || []).map((task, index) => cleanCatalogTask(task, selection.department, gridId, gridName, index)),
  };
};

const normalizeExistingGrid = (rawGrid, index, fallbackPanelType) => {
  const { projectStartDate: _legacyProjectStartDate, projectStart: _legacyProjectStart, ...gridWithoutProjectStart } = rawGrid;
  const department = normalizeDepartment(rawGrid.department) || normalizeDepartment(rawGrid.planningTasks?.[0]?.department || rawGrid.planningTasks?.[0]?.taskType);
  const panelType = normalizePanelType(rawGrid.panelType) || fallbackPanelType;
  const panelQuantity = Number.isInteger(Number(rawGrid.panelQuantity || rawGrid.quantity)) && Number(rawGrid.panelQuantity || rawGrid.quantity) > 0
    ? Number(rawGrid.panelQuantity || rawGrid.quantity)
    : 1;
  const planningMode = panelQuantity === 1 ? 'common' : (rawGrid.planningMode === 'separate' || rawGrid.isCommon === false ? 'separate' : 'common');
  const unitNumber = planningMode === 'separate' ? Number(rawGrid.unitNumber || index + 1) : undefined;
  const gridId = String(rawGrid.gridId || gridIdFor(department || 'LEGACY', panelType, unitNumber));
  const gridName = rawGrid.gridName || rawGrid.name || gridNameFor({ department: department || 'Legacy', panelType, quantity: panelQuantity, planningMode, unitNumber });
  return {
    ...gridWithoutProjectStart,
    gridId,
    name: gridName,
    gridName,
    department,
    panelType,
    panelQuantity,
    planningMode,
    unitNumber,
    isCommon: planningMode === 'common',
    planningTasks: (rawGrid.planningTasks || []).filter((task) => !/^project[\s-]*kick[\s-]*off$/i.test(String(task.taskName || '').trim())).map((task, taskIndex) => ({
      ...task,
      taskId: task.taskId || `${gridId}-${taskIndex + 1}`,
      order: taskIndex + 1,
      gridId,
      gridName,
      department: department || normalizeDepartment(task.department),
      taskName: /^bom\s+preparation$/i.test(String(task.taskName || '').trim()) ? 'Engineering BOM Preparation' : task.taskName,
      totalDays: task.totalDays ?? task.duration ?? 1,
      duration: task.totalDays ?? task.duration ?? 1,
      plannedStartDate: toDateStr(task.plannedStartDate || task.startDate),
      plannedEndDate: toDateStr(task.plannedEndDate || task.endDate),
      remark: task.remark || task.taskRemark || task.comments || '',
      status: task.status === 'Hold' ? 'On Hold' : task.status === 'Delayed' ? 'Delay' : task.status === 'Not Started' ? 'Pending' : (task.status || 'Pending'),
    })),
  };
};

const buildInitialState = (initialData = null) => {
  const source = initialData || {};
  const fallbackPanelType = inferLegacyPanelType(source);
  let planningGrids = (source.planningGrids || []).map((grid, index) => normalizeExistingGrid(grid, index, fallbackPanelType));

  if (!planningGrids.length && Array.isArray(source.planningTasks) && source.planningTasks.length) {
    const grouped = new Map();
    source.planningTasks.forEach((task) => {
      const department = normalizeDepartment(task.department || task.taskType);
      if (!department) return;
      if (!grouped.has(department)) grouped.set(department, []);
      grouped.get(department).push(task);
    });
    planningGrids = [...grouped.entries()].map(([department, tasks], index) => normalizeExistingGrid({
      gridId: `${department}-LEGACY-${index + 1}`,
      department,
      panelType: fallbackPanelType,
      panelQuantity: Number(source.projectQuantity || source.quantity || 1),
      planningMode: 'common',
      planningTasks: tasks,
    }, index, fallbackPanelType));
  }

  let selectedDepartments = Array.isArray(source.selectedDepartments) && source.selectedDepartments.length
    ? [...new Set(source.selectedDepartments.map(normalizeDepartment).filter(Boolean))]
    : [...new Set(planningGrids.map((grid) => grid.department).filter(Boolean))];

  planningGrids = planningGrids.filter((grid) => (
    isDepartmentAllowedForPanel(grid.department, grid.panelType)
  ));

  let panelSelections = Array.isArray(source.panelSelections) ? source.panelSelections.map((selection) => ({
    department: normalizeDepartment(selection.department),
    panelType: normalizePanelType(selection.panelType),
    quantity: Number(selection.quantity || 1),
    planningMode: Number(selection.quantity || 1) === 1 ? 'common' : String(selection.planningMode || 'common').toLowerCase(),
  })).filter((selection) => (
    selection.department
    && selection.panelType
    && isDepartmentAllowedForPanel(selection.department, selection.panelType)
  )) : [];

  if (!panelSelections.length) {
    panelSelections = selectedDepartments.map((department) => {
      const related = planningGrids.find((grid) => grid.department === department);
      return {
        department,
        panelType: related?.panelType || fallbackPanelType,
        quantity: related?.panelQuantity || Number(source.projectQuantity || source.quantity || 1) || 1,
        planningMode: related?.planningMode || 'common',
      };
    }).filter((selection) => isDepartmentAllowedForPanel(selection.department, selection.panelType));
  }

  selectedDepartments = uniqueDepartmentsFromSelections(panelSelections);

  return {
    form: {
      customerRef: getLiveCustomerId(source),
      customerName: getLiveCustomerName(source),
      projectName: source.projectName || '',
      inquiryNumber: getInquiryNumber(source),
      projectQuantity: Number(source.projectQuantity || source.quantity || 1),
      orderDate: toDateStr(source.orderDate) || todayDateStr(),
      projectEndDate: toDateStr(source.projectEndDate),
    },
    selectedDepartments,
    panelSelections,
    planningGrids,
  };
};

const ProjectForm = ({
  initialData,
  onSubmit,
  loading,
  readOnly = false,
  canEditProject = true,
  canManagePlanning = true,
  canAddPlanningGrid = true,
  canUpdateCompletion = true,
  canManageDocuments = true,
  setSectionRef,
  setPlanningGridNavigation,
  onCancel,
  activeSection = 0,
  activePlanningGridId = '',
  isDocumentsActive = false,
}) => {
  const { hasPermission, user } = useAuth();
  const canCreateCustomer = hasPermission(CUSTOMER_PERMISSIONS.CREATE);
  const canViewCustomer = hasPermission(CUSTOMER_PERMISSIONS.VIEW);
  const initial = useMemo(() => buildInitialState(initialData), [initialData]);
  const initialSelectedPanelTypes = useMemo(
    () => [...new Set(initial.panelSelections.map((selection) => selection.panelType))],
    [initial.panelSelections]
  );
  const draftKey = useMemo(() => {
    const userKey = String(user?._id || user?.id || user?.email || 'user');
    const projectKey = String(initialData?._id || initialData?.id || 'new');
    return `nexus:project-form-draft:${userKey}:${projectKey}`;
  }, [initialData?._id, initialData?.id, user?._id, user?.id, user?.email]);
  const initialDraftData = useMemo(() => ({
    form: initial.form,
    selectedDepartments: initial.selectedDepartments,
    selectedPanelTypes: initialSelectedPanelTypes,
    panelSelections: initial.panelSelections,
    planningGrids: initial.planningGrids,
  }), [initial, initialSelectedPanelTypes]);
  const [form, setForm] = useState(initial.form);
  const [selectedDepartments, setSelectedDepartments] = useState(initial.selectedDepartments);
  const [selectedPanelTypes, setSelectedPanelTypes] = useState(initialSelectedPanelTypes);
  const [panelSelections, setPanelSelections] = useState(initial.panelSelections);
  const [planningGrids, setPlanningGrids] = useState(initial.planningGrids);
  const [planningOptions, setPlanningOptions] = useState({
    departments: FALLBACK_DEPARTMENTS,
    panelTypes: FALLBACK_PANEL_TYPES,
    disallowedDepartmentsByPanel: FALLBACK_DISALLOWED_DEPARTMENTS_BY_PANEL,
    tasksByDepartment: {},
    importIssues: [],
  });
  const [planningLoading, setPlanningLoading] = useState(true);
  const [pendingDocuments, setPendingDocuments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerCreateOpen, setCustomerCreateOpen] = useState(false);
  const [customerDetailsOpen, setCustomerDetailsOpen] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [errors, setErrors] = useState({});
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestoredAt, setDraftRestoredAt] = useState('');
  const [draftSavedAt, setDraftSavedAt] = useState('');
  const draftKeyRef = useRef(draftKey);

  const detailsReadOnly = readOnly || !canEditProject;
  const documentsReadOnly = readOnly || !canManageDocuments;
  const inquirySnapshot = initialData?.sourceInquirySnapshot;
  const hasInquirySource = Boolean(initialData?.inquiryReference || (inquirySnapshot && typeof inquirySnapshot === 'object' && Object.keys(inquirySnapshot).length));

  useEffect(() => {
    setDraftReady(false);
    draftKeyRef.current = draftKey;
    const restored = readOnly ? null : readProjectDraft(draftKey, initialData?.updatedAt);
    const next = restored?.data || initialDraftData;

    setForm(next.form || initial.form);
    setSelectedDepartments(Array.isArray(next.selectedDepartments) ? next.selectedDepartments : initial.selectedDepartments);
    setSelectedPanelTypes(Array.isArray(next.selectedPanelTypes) ? next.selectedPanelTypes : initialSelectedPanelTypes);
    setPanelSelections(Array.isArray(next.panelSelections) ? next.panelSelections : initial.panelSelections);
    setPlanningGrids(Array.isArray(next.planningGrids) ? next.planningGrids : initial.planningGrids);
    setPendingDocuments([]);
    setErrors({});
    setDraftRestoredAt(restored?.savedAt || '');
    setDraftSavedAt(restored?.savedAt || '');
    setDraftReady(true);
  }, [draftKey, initial, initialData?.updatedAt, initialDraftData, initialSelectedPanelTypes, readOnly]);

  useEffect(() => {
    if (!draftReady || readOnly || draftKeyRef.current !== draftKey) return undefined;

    const data = {
      form,
      selectedDepartments,
      selectedPanelTypes,
      panelSelections,
      planningGrids,
    };
    const isUnchanged = JSON.stringify(data) === JSON.stringify(initialDraftData);

    const persist = (updateIndicator = false) => {
      if (isUnchanged) {
        removeProjectDraft(draftKey);
        if (updateIndicator) setDraftSavedAt('');
        return;
      }
      const savedAt = writeProjectDraft(draftKey, data);
      if (updateIndicator && savedAt) setDraftSavedAt(savedAt);
    };

    const timer = window.setTimeout(() => persist(true), 350);
    const handleBeforeUnload = () => persist(false);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      persist(false);
    };
  }, [draftKey, draftReady, form, initialDraftData, panelSelections, planningGrids, readOnly, selectedDepartments, selectedPanelTypes]);

  useEffect(() => {
    const endDates = planningGrids.map((grid) => toDateStr(grid.projectEndDate)).filter(Boolean).sort();
    const latestEndDate = endDates[endDates.length - 1] || '';
    setForm((current) => current.projectEndDate === latestEndDate
      ? current
      : { ...current, projectEndDate: latestEndDate });
  }, [planningGrids]);

  useEffect(() => {
    setPlanningGridNavigation?.(planningGrids.map((grid, index) => ({
      id: String(grid.gridId || index + 1),
      gridId: String(grid.gridId || index + 1),
      title: grid.gridName || grid.name || `Planning Grid ${index + 1}`,
      label: grid.panelType || 'Panel',
    })));
  }, [planningGrids, setPlanningGridNavigation]);

  useEffect(() => {
    let cancelled = false;
    setPlanningLoading(true);
    fetchProjectPlanningOptions()
      .then((data) => {
        if (!cancelled) setPlanningOptions({
          departments: data.departments || FALLBACK_DEPARTMENTS,
          panelTypes: data.panelTypes || FALLBACK_PANEL_TYPES,
          disallowedDepartmentsByPanel: data.disallowedDepartmentsByPanel || FALLBACK_DISALLOWED_DEPARTMENTS_BY_PANEL,
          tasksByDepartment: data.tasksByDepartment || {},
          importIssues: data.importIssues || [],
          normalizationMappings: data.normalizationMappings || {},
        });
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPlanningLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const loadCustomers = useCallback(async () => {
    if (!canViewCustomer) return setCustomers([]);
    try {
      const { data } = await API.get('/customers', { params: { page: 1, limit: 1000 } });
      setCustomers(data.data || data.customers || []);
    } catch {
      setCustomers([]);
    }
  }, [canViewCustomer]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const customerOptions = useMemo(() => {
    const map = new Map();
    customers.forEach((customer) => {
      const value = String(customer._id || customer.id || '');
      const label = customer.customerName || customer.name || customer.customerId || '';
      if (value && label) map.set(value, { value, label });
    });
    if (form.customerRef && form.customerName && !map.has(String(form.customerRef))) map.set(String(form.customerRef), { value: String(form.customerRef), label: form.customerName });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [customers, form.customerName, form.customerRef]);

  const selectedCustomer = useMemo(() => (
    customers.find((customer) => String(customer._id || customer.id) === String(form.customerRef)) || resolveCustomerRecord(initialData)
  ), [customers, form.customerRef, initialData]);

  const planningProgress = useMemo(() => {
    const gridProgress = planningGrids.map((grid) => ({
      department: grid.department,
      percentage: gridCompletionPercentage(grid),
    }));
    const overallPercentage = gridProgress.length
      ? Math.round(gridProgress.reduce((sum, grid) => sum + grid.percentage, 0) / gridProgress.length)
      : 0;
    const departmentPercentages = selectedDepartments.map((department) => {
      const departmentGrids = gridProgress.filter((grid) => grid.department === department);
      const percentage = departmentGrids.length
        ? Math.round(departmentGrids.reduce((sum, grid) => sum + grid.percentage, 0) / departmentGrids.length)
        : 0;
      return { department, percentage };
    });
    return { overallPercentage, departmentPercentages };
  }, [planningGrids, selectedDepartments]);

  const discardRestoredDraft = () => {
    removeProjectDraft(draftKey);
    setForm(initial.form);
    setSelectedDepartments(initial.selectedDepartments);
    setSelectedPanelTypes(initialSelectedPanelTypes);
    setPanelSelections(initial.panelSelections);
    setPlanningGrids(initial.planningGrids);
    setPendingDocuments([]);
    setErrors({});
    setDraftRestoredAt('');
    setDraftSavedAt('');
  };

  const applyCustomer = (customer) => setForm((prev) => ({
    ...prev,
    customerRef: String(customer?._id || customer?.id || ''),
    customerName: customer?.customerName || customer?.name || '',
  }));

  const changeCustomer = (customerId) => {
    if (hasInquirySource || detailsReadOnly) return;
    const customer = customers.find((item) => String(item._id || item.id) === String(customerId));
    if (customer) applyCustomer(customer);
    else setForm((prev) => ({ ...prev, customerRef: '', customerName: '' }));
  };

  const handleCreateCustomer = async (payload) => {
    setCreatingCustomer(true);
    try {
      const { data } = await API.post('/customers', payload);
      const customer = data.data || data.customer;
      if (customer) {
        setCustomers((prev) => [customer, ...prev]);
        applyCustomer(customer);
      }
      setCustomerCreateOpen(false);
      return true;
    } finally {
      setCreatingCustomer(false);
    }
  };

  const syncGrids = useCallback((nextSelections, currentGrids = planningGrids) => {
    const selectedKeys = new Set(nextSelections.map((selection) => selectionKey(selection.department, selection.panelType)));
    const next = currentGrids.filter((grid) => selectedKeys.has(selectionKey(grid.department, grid.panelType)));

    nextSelections.forEach((selection) => {
      const key = selectionKey(selection.department, selection.panelType);
      const related = next.filter((grid) => selectionKey(grid.department, grid.panelType) === key);
      if (selection.quantity === 1 || selection.planningMode === 'common') {
        const base = related[0] || createGrid(selection, planningOptions.tasksByDepartment);
        const normalized = {
          ...base,
          gridId: gridIdFor(selection.department, selection.panelType),
          department: selection.department,
          panelType: selection.panelType,
          panelQuantity: selection.quantity,
          planningMode: 'common',
          unitNumber: undefined,
          isCommon: true,
        };
        normalized.name = normalized.gridName = gridNameFor({ ...selection, planningMode: 'common' });
        const withoutRelated = next.filter((grid) => selectionKey(grid.department, grid.panelType) !== key);
        next.length = 0;
        next.push(...withoutRelated, normalized);
      } else {
        let separate = related.map((grid, index) => ({
          ...grid,
          department: selection.department,
          panelType: selection.panelType,
          panelQuantity: selection.quantity,
          planningMode: 'separate',
          unitNumber: Number(grid.unitNumber || index + 1),
          isCommon: false,
        })).filter((grid) => grid.unitNumber <= selection.quantity);
        if (!separate.length) separate = [createGrid(selection, planningOptions.tasksByDepartment, 1)];
        separate = separate.map((grid) => ({ ...grid, name: gridNameFor({ ...selection, planningMode: 'separate', unitNumber: grid.unitNumber }), gridName: gridNameFor({ ...selection, planningMode: 'separate', unitNumber: grid.unitNumber }) }));
        const withoutRelated = next.filter((grid) => selectionKey(grid.department, grid.panelType) !== key);
        next.length = 0;
        next.push(...withoutRelated, ...separate);
      }
    });
    return next;
  }, [planningGrids, planningOptions.tasksByDepartment]);

  const updateSelections = (nextSelections) => {
    const validSelections = nextSelections.filter((selection) => (
      isDepartmentAllowedForPanel(
        selection.department,
        selection.panelType,
        planningOptions.disallowedDepartmentsByPanel
      )
    ));
    setPanelSelections(validSelections);
    setSelectedDepartments(uniqueDepartmentsFromSelections(validSelections));
    setPlanningGrids((current) => syncGrids(validSelections, current));
  };

  const togglePanelSelection = (panelType) => {
    if (!canManagePlanning || readOnly) return;
    if (selectedPanelTypes.includes(panelType)) {
      setSelectedPanelTypes((current) => current.filter((item) => item !== panelType));
      updateSelections(panelSelections.filter((selection) => selection.panelType !== panelType));
      return;
    }
    setSelectedPanelTypes((current) => [...current, panelType]);
  };

  const toggleDepartmentForPanel = (panelType, department) => {
    if (!canManagePlanning || readOnly) return;
    if (!isDepartmentAllowedForPanel(department, panelType, planningOptions.disallowedDepartmentsByPanel)) return;
    const key = selectionKey(department, panelType);
    const exists = panelSelections.some((selection) => selectionKey(selection.department, selection.panelType) === key);
    const next = exists
      ? panelSelections.filter((selection) => selectionKey(selection.department, selection.panelType) !== key)
      : [...panelSelections, { department, panelType, quantity: 1, planningMode: 'common' }];
    updateSelections(next);
  };

  const updatePanelSelection = (department, panelType, patch) => {
    const next = panelSelections.map((selection) => {
      if (selection.department !== department || selection.panelType !== panelType) return selection;
      const updated = { ...selection, ...patch };
      if (Number(updated.quantity) === 1) updated.planningMode = 'common';
      return updated;
    });
    updateSelections(next);
  };

  const addSeparateGrid = (selection) => {
    if (!canAddPlanningGrid || readOnly || selection.quantity <= 1 || selection.planningMode !== 'separate') return;
    const used = new Set(planningGrids.filter((grid) => grid.department === selection.department && grid.panelType === selection.panelType).map((grid) => Number(grid.unitNumber)));
    let unitNumber = 1;
    while (used.has(unitNumber) && unitNumber <= selection.quantity) unitNumber += 1;
    if (unitNumber > selection.quantity) return;
    setPlanningGrids((prev) => [...prev, createGrid(selection, planningOptions.tasksByDepartment, unitNumber)]);
  };

  const onDepartmentPlanningGridChange = (department, panelType, nextDepartmentGrids) => {
    setPlanningGrids((current) => {
      const replacements = new Map(
        nextDepartmentGrids.map((grid, index) => [String(grid.gridId || index), grid])
      );
      const next = [];

      current.forEach((grid, index) => {
        const isRelated = grid.department === department && grid.panelType === panelType;
        if (!isRelated) {
          next.push(grid);
          return;
        }

        const key = String(grid.gridId || index);
        if (replacements.has(key)) {
          next.push(replacements.get(key));
          replacements.delete(key);
        }
      });

      replacements.forEach((grid) => next.push(grid));
      return next;
    });
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.customerRef || !form.customerName.trim()) nextErrors.customer = 'Customer is required.';
    if (!form.projectName.trim()) nextErrors.projectName = 'Project name is required.';
    if (!Number.isInteger(Number(form.projectQuantity)) || Number(form.projectQuantity) < 1) nextErrors.projectQuantity = 'Project Quantity must be a positive whole number.';
    if (!selectedPanelTypes.length) nextErrors.panelTypes = 'Select at least one panel type.';

    selectedPanelTypes.forEach((panelType) => {
      const selections = panelSelections.filter((selection) => selection.panelType === panelType);
      if (!selections.length) nextErrors[`panel-${panelType}`] = `Select at least one department for ${panelType}.`;
      selections.forEach((selection) => {
        const department = selection.department;
        const key = selectionKey(department, panelType);
        if (!isDepartmentAllowedForPanel(department, panelType, planningOptions.disallowedDepartmentsByPanel)) {
          nextErrors[`department-${key}`] = `${department} is not available for ${panelType}.`;
        }
        if (!Number.isInteger(Number(selection.quantity)) || Number(selection.quantity) < 1) nextErrors[`quantity-${key}`] = 'Panel quantity must be a positive whole number.';
        if (Number(selection.quantity) > 1 && !['common', 'separate'].includes(selection.planningMode)) nextErrors[`mode-${key}`] = 'Choose Common or Separate.';
        const grids = planningGrids.filter((grid) => grid.department === department && grid.panelType === panelType);
        if (selection.planningMode === 'common' && grids.length !== 1) nextErrors[`grid-${key}`] = 'A common selection must have exactly one grid.';
        if (selection.planningMode === 'separate' && grids.length > Number(selection.quantity)) nextErrors[`grid-${key}`] = `Separate grids cannot exceed quantity ${selection.quantity}.`;
      });
    });

    planningGrids.forEach((grid, gridIndex) => {
      const tasks = grid.planningTasks || [];
      tasks.forEach((task, taskIndex) => {
        if (!String(task.taskName || '').trim()) nextErrors[`task-name-${gridIndex}-${taskIndex}`] = `${grid.gridName || grid.name}: task ${taskIndex + 1} name is required.`;
        if (!Number.isInteger(Number(task.totalDays ?? task.duration)) || Number(task.totalDays ?? task.duration) < 1) nextErrors[`task-days-${gridIndex}-${taskIndex}`] = `${grid.gridName || grid.name}: task ${taskIndex + 1} Days must be a positive whole number.`;
      });
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (readOnly || !validate()) return;
    const payloadGrids = planningGrids.map((grid) => {
      const { projectStartDate: _removedProjectStartDate, ...gridWithoutProjectStart } = grid;
      return {
        ...gridWithoutProjectStart,
        planningTasks: (grid.planningTasks || []).map((task, index) => ({
          ...task,
          order: index + 1,
          assignedTo: task.assignedTo?._id || task.assignedTo || null,
          totalDays: Number(task.totalDays ?? task.duration),
          duration: Number(task.totalDays ?? task.duration),
          plannedStartDate: task.plannedStartDate || undefined,
          plannedEndDate: task.plannedEndDate || undefined,
          actualCompletedDate: task.actualCompletedDate || undefined,
          remark: task.remark || '',
        })),
      };
    });
    const existingInquiryNumber = String(
      form.inquiryNumber || getInquiryNumber(initialData) || ''
    ).trim();

    const payload = {
      customerRef: form.customerRef,
      customerName: form.customerName.trim(),
      projectName: form.projectName.trim(),
      projectQuantity: Number(form.projectQuantity),
      orderDate: form.orderDate || undefined,
      selectedDepartments,
      panelSelections: panelSelections.map((selection) => ({ ...selection, quantity: Number(selection.quantity) })),
      planningGrids: payloadGrids,
      planningTasks: payloadGrids.flatMap((grid) => grid.planningTasks),
    };

    if (existingInquiryNumber) payload.inquiryNumber = existingInquiryNumber;
    if (pendingDocuments.length) payload._pendingDocuments = pendingDocuments;
    const result = await onSubmit(payload);
    if (result !== false) {
      removeProjectDraft(draftKey);
      setDraftRestoredAt('');
      setDraftSavedAt('');
      setPendingDocuments([]);
    }
  };

  const errorList = Object.values(errors).filter(Boolean);

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="w-full min-w-0 space-y-6">
        {!readOnly && (draftRestoredAt || draftSavedAt) && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            <span className="font-medium">
              {draftRestoredAt
                ? `Unsaved project draft restored from ${new Date(draftRestoredAt).toLocaleString('en-IN')}.`
                : `Draft saved locally at ${new Date(draftSavedAt).toLocaleTimeString('en-IN')}.`}
            </span>
            {draftRestoredAt && (
              <button type="button" onClick={discardRestoredDraft} className="font-bold text-amber-900 underline underline-offset-2">
                Discard restored draft
              </button>
            )}
          </div>
        )}
        <section
          id="project-section-details"
          ref={(element) => setSectionRef?.(0, element)}
          className={`scroll-mt-44 rounded-xl border p-4 shadow-sm ${activeSection === 0 ? 'border-blue-300 bg-blue-50/30 ring-2 ring-blue-100' : 'border-gray-200 bg-white'}`}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">1. Project Details</h3>
              <p className="mt-1 text-xs text-gray-500">Enter the core project information and configure department-wise planning below.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-700">{initialData?.projectId || 'NAPL-XXXX'}</span>
              {form.inquiryNumber && <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">INQ {form.inquiryNumber}</span>}
            </div>
          </div>

          <fieldset disabled={detailsReadOnly || loading} className="space-y-4 disabled:opacity-80">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <FormField label="Customer Name" required error={errors.customer}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <SearchableSelect value={form.customerRef} onChange={changeCustomer} options={customerOptions} placeholder="Select customer" disabled={hasInquirySource || detailsReadOnly} />
                  <div className="flex gap-1">
                    {canViewCustomer && <Button type="button" variant="outline" className="px-3" disabled={!selectedCustomer} onClick={() => setCustomerDetailsOpen(true)} title="View customer"><Eye size={15} /></Button>}
                    {canCreateCustomer && !hasInquirySource && <Button type="button" variant="outline" className="px-3" onClick={() => setCustomerCreateOpen(true)} title="Add customer"><Plus size={15} /></Button>}
                  </div>
                </div>
              </FormField>
              <FormField label="Project Name" required error={errors.projectName}>
                <Input value={form.projectName} disabled={hasInquirySource || detailsReadOnly} onChange={(event) => setForm((prev) => ({ ...prev, projectName: event.target.value }))} placeholder="Enter project name" />
              </FormField>
              <FormField label="Project Quantity" required error={errors.projectQuantity}>
                <Input type="number" min="1" step="1" value={form.projectQuantity} onChange={(event) => setForm((prev) => ({ ...prev, projectQuantity: event.target.value }))} />
              </FormField>
              <FormField label="Order Date">
                <Input type="date" value={form.orderDate} onChange={(event) => setForm((prev) => ({ ...prev, orderDate: event.target.value }))} />
              </FormField>
              <FormField label="Project End Date">
                <Input type="date" value={form.projectEndDate} disabled className="bg-gray-50" />
              </FormField>
              <div>
                <span className="mb-1.5 block text-sm font-medium text-gray-700">Overall Completion</span>
                <div className="flex h-10 items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-indigo-100">
                    <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${planningProgress.overallPercentage}%` }} />
                  </div>
                  <span className="min-w-[42px] text-right text-sm font-bold text-indigo-700">{planningProgress.overallPercentage}%</span>
                </div>
              </div>
              <div className="xl:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-gray-700">Department Completion</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                  {planningProgress.departmentPercentages.length ? planningProgress.departmentPercentages.map(({ department, percentage }) => (
                    <div key={department} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-gray-700">{department}</span>
                        <span className="text-xs font-bold text-indigo-700">{percentage}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-200">
                        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  )) : (
                    <div className="col-span-full rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-500">Select a panel and department to calculate completion.</div>
                  )}
                </div>
              </div>
            </div>
          </fieldset>
        </section>

        <section
          id="project-section-planning"
          ref={(element) => setSectionRef?.(1, element)}
          className={`scroll-mt-44 rounded-xl border p-4 shadow-sm ${activeSection === 1 ? 'border-indigo-300 bg-indigo-50/20 ring-2 ring-indigo-100' : 'border-gray-200 bg-white'}`}
        >
          <div className="mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">2. Panel & Department Planning</h3>
            <p className="mt-1 text-xs text-gray-500">Select the panel type first, then choose the required departments, panel quantity, and Common or Separate planning.</p>
          </div>

          <div className="space-y-4">
            <FormField label="Panel Types" required error={errors.panelTypes}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {planningOptions.panelTypes.map((panelType) => (
                  <label key={panelType} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${selectedPanelTypes.includes(panelType) ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600'}`}>
                    <input type="checkbox" checked={selectedPanelTypes.includes(panelType)} disabled={readOnly || !canManagePlanning || planningLoading} onChange={() => togglePanelSelection(panelType)} /> {panelType}
                  </label>
                ))}
              </div>
            </FormField>

            {selectedPanelTypes.map((panelType) => {
              const panelDepartmentSelections = panelSelections.filter((selection) => selection.panelType === panelType);
              const availableDepartments = planningOptions.departments.filter((department) => (
                isDepartmentAllowedForPanel(department, panelType, planningOptions.disallowedDepartmentsByPanel)
              ));
              const automationRestricted = planningOptions.departments.includes('Automation')
                && !availableDepartments.includes('Automation');

              return (
                <details key={panelType} open className="rounded-xl border border-gray-200 bg-gray-50">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-gray-800">{panelType} Panel Planning</summary>
                  <div className="space-y-3 border-t border-gray-200 p-4">
                    <FormField label="Departments" required error={errors[`panel-${panelType}`]}>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                        {availableDepartments.map((department) => {
                          const selected = panelDepartmentSelections.some((selection) => selection.department === department);
                          return (
                            <label key={department} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${selected ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600'}`}>
                              <input type="checkbox" checked={selected} disabled={readOnly || !canManagePlanning || planningLoading} onChange={() => toggleDepartmentForPanel(panelType, department)} /> {department}
                            </label>
                          );
                        })}
                      </div>
                      {automationRestricted && <p className="mt-2 text-[11px] font-medium text-amber-700">Automation is not applicable for {panelType} panels, so it is not available in this department list.</p>}
                    </FormField>

                    {panelDepartmentSelections.map((selection) => {
                      const department = selection.department;
                      const key = selectionKey(department, panelType);
                      const relatedGrids = planningGrids.filter((grid) => grid.department === department && grid.panelType === panelType);
                      return (
                        <div key={key} className="rounded-xl border border-indigo-100 bg-white p-3">
                          <div className="grid grid-cols-1 items-end gap-3 lg:grid-cols-[minmax(140px,0.7fr)_minmax(150px,0.5fr)_minmax(280px,1fr)_auto]">
                            <div><p className="text-xs font-bold text-indigo-700">{department}</p><p className="text-[11px] text-gray-500">{panelType} panel planning</p></div>
                            <FormField label="Panel Quantity" required error={errors[`quantity-${key}`]}>
                              <Input type="number" min="1" step="1" value={selection.quantity} disabled={readOnly || !canManagePlanning || planningLoading} onChange={(event) => updatePanelSelection(department, panelType, { quantity: event.target.value })} />
                            </FormField>
                            <FormField label={Number(selection.quantity) > 1 ? 'Your planning grid should be' : 'Planning Mode'} error={errors[`mode-${key}`]}>
                              {Number(selection.quantity) > 1 ? (
                                <div className="flex h-10 items-center gap-5 rounded-lg border border-gray-200 px-3">
                                  {['common', 'separate'].map((mode) => <label key={mode} className="flex items-center gap-2 text-sm font-medium capitalize"><input type="radio" name={`mode-${key}`} checked={selection.planningMode === mode} disabled={readOnly || !canManagePlanning || planningLoading} onChange={() => updatePanelSelection(department, panelType, { planningMode: mode })} /> {mode}</label>)}
                                </div>
                              ) : <div className="flex h-10 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-500">One planning grid</div>}
                            </FormField>
                            {Number(selection.quantity) > 1 && selection.planningMode === 'separate' && canAddPlanningGrid && (
                              <Button type="button" variant="outline" disabled={readOnly || planningLoading || relatedGrids.length >= Number(selection.quantity)} onClick={() => addSeparateGrid(selection)}><Plus size={14} /> Add Planning Grid ({relatedGrids.length}/{selection.quantity})</Button>
                            )}
                          </div>
                          {errors[`department-${key}`] && <p className="mt-2 text-xs font-medium text-red-600">{errors[`department-${key}`]}</p>}
                          {errors[`grid-${key}`] && <p className="mt-2 text-xs font-medium text-red-600">{errors[`grid-${key}`]}</p>}

                          <div className="mt-3 border-t border-indigo-100 pt-3">
                            <ProjectPlanningGrid
                              planningGrids={relatedGrids}
                              onChange={(nextGrids) => onDepartmentPlanningGridChange(department, panelType, nextGrids)}
                              readOnly={readOnly}
                              canManagePlanning={canManagePlanning}
                              canUpdateCompletion={canUpdateCompletion}
                              activeGridId={activePlanningGridId}
                              projectId={initialData?._id || ''}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>

          {Object.entries(errors).filter(([key]) => key.startsWith('grid-start-') || key.startsWith('task-')).length > 0 && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {Object.entries(errors).filter(([key]) => key.startsWith('grid-start-') || key.startsWith('task-')).map(([key, value]) => <p key={key}>• {value}</p>)}
            </div>
          )}
        </section>

        <div id="project-section-documents" ref={(element) => setSectionRef?.(2, element)} className={`scroll-mt-44 rounded-xl ${isDocumentsActive ? 'ring-2 ring-cyan-100' : ''}`}>
          <ProjectDocumentAttachments
            projectId={initialData?._id}
            documents={initialData?.documents || []}
            pendingDocuments={pendingDocuments}
            onPendingDocumentsChange={setPendingDocuments}
            readOnly={documentsReadOnly}
          />
        </div>

        {!readOnly && (
          <StickyActionBar
            bleedBottom={false}
            status={errorList.length ? <span className="font-medium text-red-600"><AlertTriangle size={15} /> Fix {errorList.length} validation issue{errorList.length !== 1 ? 's' : ''}</span> : <span className="font-medium text-emerald-700"><CheckCircle2 size={15} /> Ready to save</span>}
          >
            {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>}
            <Button type="submit" loading={loading}>{initialData?._id ? 'Update Project' : 'Create Project'}</Button>
          </StickyActionBar>
        )}
      </form>

      <Modal isOpen={customerCreateOpen} onClose={() => setCustomerCreateOpen(false)} title="Add Customer" size="xl">
        <CustomerForm onSubmit={handleCreateCustomer} loading={creatingCustomer} />
      </Modal>
      <Modal isOpen={customerDetailsOpen} onClose={() => setCustomerDetailsOpen(false)} title="Customer Details" size="xl">
        <CustomerForm initialData={selectedCustomer || { customerName: form.customerName }} onSubmit={() => false} readOnly />
      </Modal>
    </>
  );
};

export default ProjectForm;
