// components/ticket/TicketForm.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertCircle, CheckCircle2, Eye, Plus, Trash2 } from 'lucide-react';

import {
  SectionCard,
  ExtendedFormField,
  SearchableSelect,
  InlineToggle,
  Input,
  Textarea,
  Button,
} from '../common/FormComponents.extended';

import { Select } from '../common/FormComponents';

import {
  DESIGNATION_OPTIONS,
  TICKET_SOURCES,
  TICKET_SUPPORT_TYPES,
} from '../../data/masterData';
import { fetchDepartments, getDepartmentName } from '../../api/departmentService';

import { assignTicket, createTicket, updateTicket } from '../../api/ticketService';
import API from '../../api/axios';
import Modal from '../common/Modal';
import CustomerForm from '../customer/CustomerForm';
import StickyActionBar from '../common/StickyActionBar';
import { useAuth } from '../../context/AuthContext';
import { CUSTOMER_PERMISSIONS } from '../../constants/permissions';

const TICKET_TYPE_OPTIONS = [
  'N/A',
  'Support',
  'Repairing & Replacement',
];

const PRODUCT_TYPES = [
  'N/A',
  'HMI',
  'PLC',
  'Servo',
  'VFD',
  'SCADA',
  'Industrial PC',
  'Other',
];

const COMPANY_TYPE_OPTIONS = [
  'End User',
  'OEM',
  'Consultant',
  'Contractor',
  'System Integrator',
  'Panel Builder',
  'Dealer / Trader',
  'Other',
];

const DEFAULT_NEW_CUSTOMER_CONTACT = () => ({
  name: '',
  phone: '',
  email: '',
  designation: '',
});

const createDefaultNewCustomer = () => ({
  customerName: '',
  companyType: '',
  customCompanyType: '',
  gstNumber: '',
  city: '',
  address: '',
  notes: '',
  contacts: [DEFAULT_NEW_CUSTOMER_CONTACT()],
});

const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'];

const REPAIR_STATUS_OPTIONS = [
  'N/A',
  'Pending',
  'In Progress',
  'Under Inspection',
  'Repair Done',
  'Replacement Done',
  'Ready for Dispatch',
  'Dispatched',
  'Vendor Return',
  'Scrap',
];

const getId = (value) => value?._id ?? value ?? '';

const normaliseSelectOptions = (options = []) =>
  options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));

const dateOnly = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().split('T')[0];
};

const isAssignableTicketEmployee = (user) => {
  const role = String(user?.role || '').trim().toLowerCase().replace(/\s+/g, '_');
  return role === 'employee';
};

const buildDepartmentOption = (department) => {
  const name = getDepartmentName(department);
  return name ? { value: name, label: name } : null;
};

const validate = (form) => {
  const errors = {};

  if (!form.customer) errors.customer = 'Customer is required';
  if (!form.contactPerson.trim()) errors.contactPerson = 'Contact person is required';
  if (!form.contactNumber.trim()) errors.contactNumber = 'Contact number is required';
  if (!form.title.trim()) errors.title = 'Subject is required';
  if (!form.ticketType) errors.ticketType = 'Ticket type is required';
  if (!form.source) errors.source = 'Source is required';
  if (!form.department) errors.department = 'Department is required';

  if (form.ticketType !== 'Repairing & Replacement' && !form.description.trim()) {
    errors.description = 'Problem reported is required';
  }

  return errors;
};

const buildInitialForm = (initialData) => {
  const repairReplacement = initialData?.repairReplacement || {};

  return {
    customer: getId(initialData?.customer),
    contactPerson: initialData?.contactPerson ?? '',
    contactNumber: initialData?.contactNumber ?? '',

    title: initialData?.title ?? '',
    assignedTo: getId(initialData?.assignedTo),
    ticketType: initialData?.ticketType ?? 'N/A',
    source: initialData?.source ?? 'Other',
    priority: initialData?.priority ?? 'Medium',
    department: initialData?.department ?? '',

    productType: initialData?.product?.productType ?? 'N/A',
    partNumber: initialData?.product?.partNumber ?? '',
    serialNumber: initialData?.product?.serialNumber ?? '',

    description: initialData?.description ?? '',
    additionalDescription: initialData?.additionalDescription ?? '',
    resolution: initialData?.resolution ?? '',

    supportType: initialData?.supportType ?? 'Free',

    rr: {
      underWarranty: repairReplacement.underWarranty ?? false,
      inspectionObservation: repairReplacement.inspectionObservation ?? '',
      repairStatus: repairReplacement.repairStatus ?? repairReplacement.rrSolutionStatus ?? 'N/A',
      productReceivedDate: dateOnly(repairReplacement.productReceivedDate ?? repairReplacement.receivedDate),
      dateOfReplacement: dateOnly(repairReplacement.dateOfReplacement ?? repairReplacement.expectedDispatchDate),
      replacementSerialNumber: repairReplacement.replacementSerialNumber ?? '',
    },
  };
};

const TicketForm = ({ initialData, activeSection = 0, onSuccess, onCancel, onTicketTypeChange }) => {
  const isEdit = !!initialData?._id;
  const { hasPermission } = useAuth();
  const canCreateCustomer = hasPermission(CUSTOMER_PERMISSIONS.CREATE);
  const canViewCustomer = hasPermission(CUSTOMER_PERMISSIONS.VIEW);

  const [form, setForm] = useState(() => buildInitialForm(initialData));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [customerCreateOpen, setCustomerCreateOpen] = useState(false);
  const [customerDetailsOpen, setCustomerDetailsOpen] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState(() => createDefaultNewCustomer());

  useEffect(() => {
    onTicketTypeChange?.(form.ticketType);
  }, [form.ticketType, onTicketTypeChange]);

  const [customers, setCustomers] = useState([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);

  const loadCustomers = useCallback(async () => {
    if (customersLoaded) return;
    if (!canViewCustomer) {
      setCustomers([]);
      setCustomersLoaded(true);
      return;
    }

    try {
      const { data } = await API.get('/customers', { params: { limit: 500 } });
      setCustomers(data.data ?? data.customers ?? []);
    } catch {
      // Non-critical — select stays empty
    } finally {
      setCustomersLoaded(true);
    }
  }, [customersLoaded, canViewCustomer]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const customerOptions = customers.map((c) => ({
    value: c._id,
    label: c.customerName || c.name || c._id,
  }));

  const selectedCustomerForDetails = useMemo(() => (
    customers.find((customer) => String(customer?._id || customer?.id || '') === String(form.customer || '')) ||
    (initialData?.customer && typeof initialData.customer === 'object' ? initialData.customer : null)
  ), [customers, form.customer, initialData?.customer]);

  const [departments, setDepartments] = useState([]);
  const [departmentsLoaded, setDepartmentsLoaded] = useState(false);

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

  const departmentOptions = useMemo(() => {
    const seen = new Set();
    const options = [];

    departments
      .map(buildDepartmentOption)
      .filter(Boolean)
      .forEach((option) => {
        if (seen.has(option.value)) return;
        seen.add(option.value);
        options.push(option);
      });

    if (form.department && !seen.has(form.department)) {
      options.unshift({ value: form.department, label: form.department });
    }

    return options;
  }, [departments, form.department]);

  const [assignableUsers, setAssignableUsers] = useState([]);
  const [assignableUsersLoaded, setAssignableUsersLoaded] = useState(false);

  const loadAssignableUsers = useCallback(async () => {
    if (assignableUsersLoaded) return;
    try {
      const { data } = await API.get('/users/assignable');
      const users = data.users ?? data.data ?? [];

      setAssignableUsers(
        users
          .filter((user) => user?._id && user?.name && isAssignableTicketEmployee(user))
          .map((user) => ({
            value: user._id,
            label: user.teamId?.name ? `${user.name} — ${user.teamId.name}` : user.name,
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

  const clearError = (field) => {
    if (!errors[field]) return;
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const set = (field) => (e) => {
    const value = typeof e === 'object' && e?.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [field]: value }));
    clearError(field);
  };

  const setRR = (field) => (e) => {
    const value = typeof e === 'object' && e?.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, rr: { ...prev.rr, [field]: value } }));
  };

  const isRR = form.ticketType === 'Repairing & Replacement';
  const currentAssignedTo = getId(initialData?.assignedTo);

  const openCreateCustomer = () => {
    setNewCustomer({
      ...createDefaultNewCustomer(),
      contacts: [{
        name: form.contactPerson || '',
        phone: form.contactNumber || '',
        email: '',
        designation: '',
      }],
    });

    setErrors((prev) => {
      const next = { ...prev };
      delete next._customerCreate;
      return next;
    });

    setCustomerCreateOpen(true);
  };

  const clearCustomerCreateError = () => {
    if (!errors._customerCreate) return;
    setErrors((prev) => {
      const next = { ...prev };
      delete next._customerCreate;
      return next;
    });
  };

  const setNewCustomerField = (field) => (e) => {
    const value = typeof e === 'object' && e?.target ? e.target.value : e;
    setNewCustomer((prev) => ({ ...prev, [field]: value }));
    clearCustomerCreateError();
  };

  const setNewCustomerContact = (index, field, value) => {
    setNewCustomer((prev) => ({
      ...prev,
      contacts: (Array.isArray(prev.contacts) && prev.contacts.length ? prev.contacts : [DEFAULT_NEW_CUSTOMER_CONTACT()])
        .map((contact, idx) => (idx === index ? { ...contact, [field]: value } : contact)),
    }));
    clearCustomerCreateError();
  };

  const addNewCustomerContact = () => {
    setNewCustomer((prev) => ({
      ...prev,
      contacts: [
        ...(Array.isArray(prev.contacts) && prev.contacts.length ? prev.contacts : [DEFAULT_NEW_CUSTOMER_CONTACT()]),
        DEFAULT_NEW_CUSTOMER_CONTACT(),
      ],
    }));
  };

  const removeNewCustomerContact = (index) => {
    setNewCustomer((prev) => ({
      ...prev,
      contacts: (Array.isArray(prev.contacts) && prev.contacts.length ? prev.contacts : [DEFAULT_NEW_CUSTOMER_CONTACT()])
        .filter((_, idx) => idx !== index),
    }));
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();

    if (!canCreateCustomer) {
      setErrors((prev) => ({
        ...prev,
        _customerCreate: 'You do not have permission to create customers',
      }));
      return;
    }

    if (!newCustomer.customerName.trim()) {
      setErrors((prev) => ({
        ...prev,
        _customerCreate: 'Customer name is required',
      }));
      return;
    }

    setCreatingCustomer(true);

    try {
      const contacts = (Array.isArray(newCustomer.contacts) ? newCustomer.contacts : [])
        .map((contact) => ({
          name: String(contact.name || '').trim(),
          phone: String(contact.phone || '').trim(),
          email: String(contact.email || '').trim(),
          designation: String(contact.designation || '').trim(),
        }))
        .filter((contact) => contact.name || contact.phone || contact.email || contact.designation);

      const primary = contacts[0] || {};
      const resolvedCompanyType = newCustomer.companyType === 'Other'
        ? String(newCustomer.customCompanyType || '').trim()
        : newCustomer.companyType;

      const payload = {
        customerName: newCustomer.customerName.trim(),
        companyType: resolvedCompanyType || '',
        gstNumber: String(newCustomer.gstNumber || '').trim(),
        city: String(newCustomer.city || '').trim(),
        address: String(newCustomer.address || '').trim(),
        notes: String(newCustomer.notes || '').trim(),
        contacts,
        contactPerson: primary.name || '',
        mobileNumber: primary.phone || '',
        email: primary.email || '',
      };

      const { data } = await API.post('/customers', payload);
      const createdCustomer = data.data || data.customer;

      if (!createdCustomer?._id) {
        throw new Error('Customer was created but response is invalid');
      }

      setCustomers((prev) => [
        createdCustomer,
        ...prev.filter((item) => item._id !== createdCustomer._id),
      ]);

      setForm((prev) => ({
        ...prev,
        customer: createdCustomer._id,
        contactPerson: prev.contactPerson || primary.name || createdCustomer.contactPerson || '',
        contactNumber: prev.contactNumber || primary.phone || createdCustomer.mobileNumber || '',
      }));

      setErrors((prev) => {
        const next = { ...prev };
        delete next.customer;
        delete next._customerCreate;
        return next;
      });

      setCustomerCreateOpen(false);
      setNewCustomer(createDefaultNewCustomer());
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        _customerCreate:
          err?.response?.data?.message || 'Failed to create customer. Please try again.',
      }));
    } finally {
      setCreatingCustomer(false);
    }
  };

  const handleSubmit = async () => {
    const errs = validate(form);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        customer: form.customer,
        contactPerson: form.contactPerson.trim(),
        contactNumber: form.contactNumber.trim(),
        ticketType: form.ticketType,
        source: form.source,
        priority: form.priority,
        department: form.department,
        supportType: form.ticketType === 'Support' || form.ticketType === 'N/A' ? form.supportType : undefined,
        description: form.description.trim(),
        additionalDescription: form.additionalDescription.trim(),
        resolution: form.resolution.trim(),
        product: {
          productType: form.productType || 'N/A',
          brand: '',
          panelFamily: '',
          partNumber: form.partNumber.trim(),
          serialNumber: form.serialNumber.trim(),
        },
      };

      if (!isEdit && form.assignedTo) {
        payload.assignedTo = form.assignedTo;
      }

      if (isRR) {
        payload.repairReplacement = {
          underWarranty: form.rr.underWarranty,
          inspectionObservation: form.rr.inspectionObservation.trim(),
          repairStatus: form.rr.repairStatus,
          rrSolutionStatus: form.rr.repairStatus,
          replacementSerialNumber: form.rr.replacementSerialNumber.trim(),
        };

        if (form.rr.productReceivedDate) {
          payload.repairReplacement.productReceivedDate = form.rr.productReceivedDate;
          payload.repairReplacement.receivedDate = form.rr.productReceivedDate;
        }

        if (form.rr.dateOfReplacement) {
          payload.repairReplacement.dateOfReplacement = form.rr.dateOfReplacement;
          payload.repairReplacement.expectedDispatchDate = form.rr.dateOfReplacement;
        }
      }

      let saved = isEdit
        ? await updateTicket(initialData._id, payload)
        : await createTicket(payload);

      if (isEdit && form.assignedTo && form.assignedTo !== currentAssignedTo) {
        saved = await assignTicket(initialData._id, { assignedTo: form.assignedTo });
      }

      onSuccess(saved);
    } catch (err) {
      const serverMsg = err?.response?.data?.message;
      if (serverMsg) {
        setErrors({ _server: serverMsg });
      } else {
        setErrors({ _server: 'Failed to save ticket. Please try again.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isSectionActive = (index) => activeSection === index;
  const newCustomerContacts = Array.isArray(newCustomer.contacts) && newCustomer.contacts.length
    ? newCustomer.contacts
    : [DEFAULT_NEW_CUSTOMER_CONTACT()];

  return (
    <div className="space-y-5">
      {errors._server && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
          {errors._server}
        </div>
      )}

      <div id="ticket-section-customer" className="scroll-mt-32">
        <SectionCard number="1" title="Customer Information" color="blue" active={isSectionActive(0)}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ExtendedFormField label="Customer" required error={errors.customer}>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <SearchableSelect
                    value={form.customer}
                    onChange={set('customer')}
                    options={customerOptions}
                    placeholder={canViewCustomer ? 'Select customer…' : 'Customer View access required'}
                    error={errors.customer}
                    disabled={!canViewCustomer}
                  />
                </div>

                {canViewCustomer && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCustomerDetailsOpen(true)}
                    disabled={!form.customer}
                    className="shrink-0 px-3"
                    title="View customer details"
                  >
                    <Eye size={14} />
                  </Button>
                )}

                {canCreateCustomer && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={openCreateCustomer}
                    className="shrink-0"
                  >
                    <Plus size={14} />
                    New
                  </Button>
                )}
              </div>
            </ExtendedFormField>

            <ExtendedFormField label="Contact Person" required error={errors.contactPerson}>
              <Input
                value={form.contactPerson}
                onChange={set('contactPerson')}
                placeholder="e.g. Rajan Mehta"
                error={errors.contactPerson}
              />
            </ExtendedFormField>

            <ExtendedFormField label="Contact Number" required error={errors.contactNumber}>
              <Input
                value={form.contactNumber}
                onChange={set('contactNumber')}
                placeholder="e.g. +91 98765 43210"
                inputMode="tel"
                error={errors.contactNumber}
              />
            </ExtendedFormField>
          </div>
        </SectionCard>
      </div>

      <div id="ticket-section-info" className="scroll-mt-32">
        <SectionCard number="2" title="Ticket Information" color="orange" active={isSectionActive(1)}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ExtendedFormField label="Ticket Type" required error={errors.ticketType}>
                <Select value={form.ticketType} onChange={set('ticketType')}>
                  {TICKET_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </Select>
              </ExtendedFormField>

              <ExtendedFormField label="Assigned To">
                <SearchableSelect
                  value={form.assignedTo}
                  onChange={set('assignedTo')}
                  options={assignableUsers}
                  placeholder="Assign employee later or select now…"
                />
              </ExtendedFormField>
            </div>

            {!isRR ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
                <ExtendedFormField label="Subject" required error={errors.title}>
                  <Input
                    value={form.title}
                    onChange={set('title')}
                    placeholder="Brief description of the issue…"
                    error={errors.title}
                  />
                </ExtendedFormField>

                <ExtendedFormField label="Support Type">
                  <Select value={form.supportType} onChange={set('supportType')}>
                    {TICKET_SUPPORT_TYPES.map((supportType) => (
                      <option key={supportType} value={supportType}>{supportType}</option>
                    ))}
                  </Select>
                </ExtendedFormField>
              </div>
            ) : (
              <ExtendedFormField label="Subject" required error={errors.title}>
                <Input
                  value={form.title}
                  onChange={set('title')}
                  placeholder="Brief description of the issue…"
                  error={errors.title}
                />
              </ExtendedFormField>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <ExtendedFormField label="Source" required error={errors.source}>
                <Select value={form.source} onChange={set('source')}>
                  {TICKET_SOURCES.map((source) => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </Select>
              </ExtendedFormField>

              <ExtendedFormField label="Priority">
                <Select value={form.priority} onChange={set('priority')}>
                  {PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>{priority}</option>
                  ))}
                </Select>
              </ExtendedFormField>

              <ExtendedFormField label="Department" required error={errors.department}>
                <Select value={form.department} onChange={set('department')}>
                  <option value="">Select department…</option>
                  {departmentOptions.map((department) => (
                    <option key={department.value} value={department.value}>{department.label}</option>
                  ))}
                  {departmentOptions.length === 0 && (
                    <option value="" disabled>No active departments found</option>
                  )}
                </Select>
              </ExtendedFormField>
            </div>
          </div>
        </SectionCard>
      </div>

      <div id="ticket-section-product" className="scroll-mt-32">
        <SectionCard number="3" title="Product Information" color="purple" active={isSectionActive(2)}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ExtendedFormField label="Product Type">
              <Select value={form.productType} onChange={set('productType')}>
                {PRODUCT_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </Select>
            </ExtendedFormField>

            <ExtendedFormField label="Part Number">
              <Input
                value={form.partNumber}
                onChange={set('partNumber')}
                placeholder="e.g. 6ES7 516-3AN01"
              />
            </ExtendedFormField>

            <ExtendedFormField label="Serial Number">
              <Input
                value={form.serialNumber}
                onChange={set('serialNumber')}
                placeholder="e.g. SN-00123456"
              />
            </ExtendedFormField>
          </div>
        </SectionCard>
      </div>

      {!isRR ? (
        <div id="ticket-section-description" className="scroll-mt-32">
          <SectionCard number="4" title="Description" color="green" active={isSectionActive(3)}>
            <div className="space-y-4">
              <ExtendedFormField label="Problem Reported" required error={errors.description}>
                <Textarea
                  value={form.description}
                  onChange={set('description')}
                  placeholder="Describe the problem reported by the customer…"
                  rows={4}
                  error={errors.description}
                />
              </ExtendedFormField>

              <ExtendedFormField label="Additional Description">
                <Textarea
                  value={form.additionalDescription}
                  onChange={set('additionalDescription')}
                  placeholder="Add extra details, observations, or internal notes…"
                  rows={4}
                />
              </ExtendedFormField>

              <ExtendedFormField label="Resolution">
                <Textarea
                  value={form.resolution}
                  onChange={set('resolution')}
                  placeholder="Add resolution details when available…"
                  rows={4}
                />
              </ExtendedFormField>
            </div>
          </SectionCard>
        </div>
      ) : (
        <div id="ticket-section-rr" className="scroll-mt-32">
          <SectionCard number="4" title="REPAIRING & REPLACEMENT" color="amber" active={isSectionActive(3)}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
                <ExtendedFormField label="Under Warranty">
                  <div className="max-w-[220px]">
                    <InlineToggle
                      value={form.rr.underWarranty}
                      onChange={setRR('underWarranty')}
                    />
                  </div>
                </ExtendedFormField>

                <ExtendedFormField label="Repair Status">
                  <Select value={form.rr.repairStatus} onChange={setRR('repairStatus')}>
                    {REPAIR_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </Select>
                </ExtendedFormField>

                <ExtendedFormField label="Replacement Serial Number">
                  <Input
                    value={form.rr.replacementSerialNumber}
                    onChange={setRR('replacementSerialNumber')}
                    placeholder="e.g. SN-00654321"
                  />
                </ExtendedFormField>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ExtendedFormField label="Product Received Date">
                  <Input
                    type="date"
                    value={form.rr.productReceivedDate}
                    onChange={setRR('productReceivedDate')}
                  />
                </ExtendedFormField>

                <ExtendedFormField label="Date of Replacement">
                  <Input
                    type="date"
                    value={form.rr.dateOfReplacement}
                    onChange={setRR('dateOfReplacement')}
                  />
                </ExtendedFormField>
              </div>

              <ExtendedFormField label="Inspection Observation">
                <Textarea
                  value={form.rr.inspectionObservation}
                  onChange={setRR('inspectionObservation')}
                  placeholder="Describe inspection observations…"
                  rows={4}
                />
              </ExtendedFormField>

              <ExtendedFormField label="Additional Description">
                <Textarea
                  value={form.additionalDescription}
                  onChange={set('additionalDescription')}
                  placeholder="Add extra details, observations, or internal notes…"
                  rows={4}
                />
              </ExtendedFormField>

              <ExtendedFormField label="Resolution">
                <Textarea
                  value={form.resolution}
                  onChange={set('resolution')}
                  placeholder="Add resolution details when available…"
                  rows={4}
                />
              </ExtendedFormField>
            </div>
          </SectionCard>
        </div>
      )}

<Modal
  isOpen={canCreateCustomer && customerCreateOpen}
  onClose={() => {
    if (!creatingCustomer) {
      setCustomerCreateOpen(false);
      setNewCustomer(createDefaultNewCustomer());
    }
  }}
  title="Create New Customer"
  size="customer"
  topOffset="topbar"
  bodyMaxHeight="calc(100vh - 11rem)"
>
  <form onSubmit={handleCreateCustomer} className="space-y-5">
    {errors._customerCreate && (
      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
        {errors._customerCreate}
      </div>
    )}

    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <ExtendedFormField label="Customer Name" required>
        <Input
          value={newCustomer.customerName}
          onChange={setNewCustomerField('customerName')}
          placeholder="Customer name"
          required
        />
      </ExtendedFormField>

      <ExtendedFormField label="Company Type">
        <SearchableSelect
          value={newCustomer.companyType}
          onChange={(value) => {
            setNewCustomer((prev) => ({
              ...prev,
              companyType: value,
              customCompanyType: value === 'Other' ? prev.customCompanyType : '',
            }));
            clearCustomerCreateError();
          }}
          options={normaliseSelectOptions(COMPANY_TYPE_OPTIONS)}
          placeholder="Select company type"
        />
      </ExtendedFormField>

      <ExtendedFormField label="GST Number">
        <Input
          value={newCustomer.gstNumber}
          onChange={setNewCustomerField('gstNumber')}
          placeholder="GST number"
        />
      </ExtendedFormField>

      {newCustomer.companyType === 'Other' && (
        <ExtendedFormField label="Other Company Type">
          <Input
            value={newCustomer.customCompanyType}
            onChange={setNewCustomerField('customCompanyType')}
            placeholder="Enter company type"
          />
        </ExtendedFormField>
      )}

      <ExtendedFormField label="City of Location">
        <Input
          value={newCustomer.city}
          onChange={setNewCustomerField('city')}
          placeholder="City"
        />
      </ExtendedFormField>

      <ExtendedFormField label="Location / Site Address" className={newCustomer.companyType === 'Other' ? '' : 'xl:col-span-2'}>
        <Textarea
          value={newCustomer.address}
          onChange={setNewCustomerField('address')}
          placeholder="Full site address"
          rows={2}
        />
      </ExtendedFormField>
    </div>

    <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-800">Contact Persons</h4>
          <p className="text-xs text-gray-500">Add primary and additional contact details.</p>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={addNewCustomerContact} disabled={creatingCustomer}>
          <Plus size={14} /> Add Contact
        </Button>
      </div>

      <div className="space-y-4">
        {newCustomerContacts.map((contact, index) => (
          <div key={`ticket-new-customer-contact-${index}`} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                  {index + 1}
                </span>
                {index === 0 ? 'Primary Contact' : `Contact ${index + 1}`}
              </div>

              {index > 0 && (
                <button
                  type="button"
                  onClick={() => removeNewCustomerContact(index)}
                  disabled={creatingCustomer}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Remove contact"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <ExtendedFormField label="Name">
                <Input
                  value={contact.name || ''}
                  onChange={(event) => setNewCustomerContact(index, 'name', event.target.value)}
                  placeholder="Contact name"
                />
              </ExtendedFormField>

              <ExtendedFormField label="Phone">
                <Input
                  value={contact.phone || ''}
                  onChange={(event) => setNewCustomerContact(index, 'phone', event.target.value)}
                  placeholder="10-digit phone"
                  inputMode="tel"
                />
              </ExtendedFormField>

              <ExtendedFormField label="Email">
                <Input
                  type="email"
                  value={contact.email || ''}
                  onChange={(event) => setNewCustomerContact(index, 'email', event.target.value)}
                  placeholder="email@example.com"
                />
              </ExtendedFormField>

              <ExtendedFormField label="Designation">
                <SearchableSelect
                  value={contact.designation || ''}
                  onChange={(value) => setNewCustomerContact(index, 'designation', value)}
                  options={normaliseSelectOptions(DESIGNATION_OPTIONS)}
                  placeholder="Select / Type Designation"
                />
              </ExtendedFormField>
            </div>
          </div>
        ))}
      </div>
    </div>

    <ExtendedFormField label="Notes">
      <Textarea
        value={newCustomer.notes}
        onChange={setNewCustomerField('notes')}
        placeholder="Additional notes"
        rows={2}
      />
    </ExtendedFormField>

    <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
      <Button
        type="button"
        variant="outline"
        disabled={creatingCustomer}
        onClick={() => {
          setCustomerCreateOpen(false);
          setNewCustomer(createDefaultNewCustomer());
        }}
      >
        Cancel
      </Button>

      <Button type="submit" loading={creatingCustomer}>
        Create Customer
      </Button>
    </div>
  </form>
</Modal>

<Modal
  isOpen={canViewCustomer && customerDetailsOpen && Boolean(selectedCustomerForDetails)}
  onClose={() => setCustomerDetailsOpen(false)}
  title="Customer Details"
  size="customer"
  topOffset="topbar"
  bodyMaxHeight="calc(100vh - 11rem)"
>
  <CustomerForm
    initialData={selectedCustomerForDetails}
    readOnly
  />
</Modal>

      <StickyActionBar
        fullBleed
        bleedBottom={false}
        className="!mt-0"
        status={
          Object.keys(errors).length > 0 ? (
            <>
              <AlertCircle size={16} className="text-red-500" />
              <span className="font-medium text-red-600">
                {Object.keys(errors).length} error(s) to fix
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span className="text-gray-400">Ready to submit</span>
            </>
          )
        }
      >
          <Button variant="outline" onClick={onCancel} disabled={submitting} className="w-full justify-center sm:w-auto">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting} className="h-8 w-full justify-center sm:w-auto sm:min-w-[145px]">
            {submitting
              ? (isEdit ? 'Saving…' : 'Creating…')
              : (isEdit ? 'Save Changes' : 'Create Ticket')}
          </Button>
      </StickyActionBar>
    </div>
  );
};

export default TicketForm;