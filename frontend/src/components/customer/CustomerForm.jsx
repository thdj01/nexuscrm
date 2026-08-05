import React, { useState, useEffect, useMemo, useId } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { FormField, Input, Textarea, Button } from '../common/FormComponents';
import { SearchableSelect } from '../common/FormComponents.extended';
import StickyActionBar from '../common/StickyActionBar';
import { DESIGNATION_OPTIONS } from '../../data/masterData';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

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

const DEFAULT_CONTACT = () => ({
  name: '',
  phone: '',
  email: '',
  designation: '',
});


const MOBILE_NUMBER_LENGTH = 10;
const MOBILE_NUMBER_PATTERN = /^\d{10}$/;
const normalizeMobileInput = (value = '') => String(value || '')
  .replace(/\D/g, '')
  .slice(0, MOBILE_NUMBER_LENGTH);

const defaultForm = {
  customerName: '',
  companyType: '',
  customCompanyType: '',
  contacts: [DEFAULT_CONTACT()],
  email: '',
  mobileNumber: '',
  city: '',
  address: '',
  gstNumber: '',
  notes: '',
  createdBy: '',
};

const normaliseSelectOptions = (options = []) =>
  options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));


const getId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return String(value._id || value.id || '');
  return '';
};

const getUserLabel = (user = {}) => {
  const name = String(user.name || '').trim();
  return name || 'Employee';
};

const buildEmployeeOption = (user = {}) => {
  const value = getId(user);
  if (!value) return null;
  return { value, label: getUserLabel(user) };
};

const mergeEmployeeOptions = (...sources) => {
  const map = new Map();
  sources.flat().forEach((user) => {
    const option = buildEmployeeOption(user);
    if (option && !map.has(option.value)) map.set(option.value, option);
  });
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
};

const normaliseCityOptions = (values = []) => {
  const map = new Map();

  values.forEach((value) => {
    const city = String(value || '').trim();
    if (!city) return;

    const key = city.toLowerCase();
    if (!map.has(key)) map.set(key, city);
  });

  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
};

const getExpandedTextareaRows = (value = '', minRows = 3) => {
  const text = String(value || '');
  const lineCount = text.split('\n').length;
  const wrappedLineCount = Math.ceil(text.length / 90);
  return Math.max(minRows, lineCount, wrappedLineCount);
};

const resolveCreatedByValue = (initialData = {}, currentUser = null) => {
  const selectedCreator = getId(initialData.createdBy);
  if (selectedCreator) return selectedCreator;

  const isExistingCustomer = Boolean(initialData?._id);
  if (!isExistingCustomer) return getId(currentUser);

  return '';
};

const normaliseContacts = (source = {}) => {
  const contacts = Array.isArray(source.contacts) ? source.contacts : [];
  const cleaned = contacts
    .map((contact) => ({
      name: contact?.name || contact?.contactPerson || '',
      phone: contact?.phone || contact?.mobileNumber || contact?.contactNumber || '',
      email: contact?.email || '',
      designation: contact?.designation || '',
    }))
    .filter((contact) => contact.name || contact.phone || contact.email || contact.designation);

  if (cleaned.length) return cleaned;

  if (source.contactPerson || source.mobileNumber || source.email) {
    return [{
      name: source.contactPerson || '',
      phone: source.mobileNumber || '',
      email: source.email || '',
      designation: source.designation || '',
    }];
  }

  return [DEFAULT_CONTACT()];
};

const buildInitialForm = (initialData = {}, currentUser = null) => {
  const knownCompanyType = COMPANY_TYPE_OPTIONS.includes(initialData.companyType);
  const companyType = initialData.companyType
    ? knownCompanyType
      ? initialData.companyType
      : 'Other'
    : '';

  return {
    ...defaultForm,
    ...initialData,
    customerName: initialData.customerName || initialData.companyName || '',
    companyType,
    customCompanyType: initialData.companyType && !knownCompanyType ? initialData.companyType : '',
    contacts: normaliseContacts(initialData),
    address: initialData.address || initialData.siteAddress || '',
    createdBy: resolveCreatedByValue(initialData, currentUser),
  };
};

const CustomerForm = ({
  initialData,
  onSubmit,
  loading,
  readOnly = false,
  fullPageActions = false,
  canChangeCreatedBy = true,
}) => {
  const { user } = useAuth() || {};
  const cityDatalistId = useId();
  const [form, setForm] = useState(() => buildInitialForm(initialData || {}, user));
  const [employeeUsers, setEmployeeUsers] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm(buildInitialForm(initialData || {}, user));
    setErrors({});
  }, [initialData, user?._id]);

  useEffect(() => {
    let active = true;

    const fetchEmployees = async () => {
      try {
        const { data } = await API.get('/users/assignable');
        const users = data?.users || data?.data || [];
        if (active) setEmployeeUsers(Array.isArray(users) ? users : []);
      } catch {
        if (active) setEmployeeUsers([]);
      }
    };

    fetchEmployees();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const fetchSavedCities = async () => {
      try {
        const { data } = await API.get('/customers/cities');
        const values = data?.data || data?.cities || [];
        if (active) setCityOptions(normaliseCityOptions(Array.isArray(values) ? values : []));
      } catch {
        if (active) setCityOptions([]);
      }
    };

    fetchSavedCities();

    return () => {
      active = false;
    };
  }, []);

  const set = (field) => (e) => {
    const value = typeof e === 'object' && e?.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const setContact = (index, field, value) => {
    const nextValue = field === 'phone' ? normalizeMobileInput(value) : value;
    setForm((prev) => ({
      ...prev,
      contacts: prev.contacts.map((contact, idx) => (
        idx === index ? { ...contact, [field]: nextValue } : contact
      )),
    }));
    setErrors((prev) => ({ ...prev, [`contacts.${index}.${field}`]: undefined }));
  };

  const addContact = () => {
    setForm((prev) => ({ ...prev, contacts: [...prev.contacts, DEFAULT_CONTACT()] }));
  };

  const removeContact = (index) => {
    setForm((prev) => ({
      ...prev,
      contacts: prev.contacts.filter((_, idx) => idx !== index),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (readOnly) return;

    const primaryContact = form.contacts?.[0] || {};
    const nextErrors = {};

    if (!String(form.customerName || '').trim()) {
      nextErrors.customerName = 'Customer name is required';
    }

    if (!String(primaryContact.name || '').trim()) {
      nextErrors['contacts.0.name'] = 'Primary contact name is required';
    }

    if (!String(primaryContact.phone || '').trim()) {
      nextErrors['contacts.0.phone'] = 'Primary contact mobile number is required';
    } else if (!MOBILE_NUMBER_PATTERN.test(String(primaryContact.phone || '').trim())) {
      nextErrors['contacts.0.phone'] = 'Enter exactly 10 digits';
    }

    form.contacts.forEach((contact, index) => {
      const phone = String(contact?.phone || '').trim();
      if (index > 0 && phone && !MOBILE_NUMBER_PATTERN.test(phone)) {
        nextErrors[`contacts.${index}.phone`] = 'Enter exactly 10 digits';
      }
    });

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const contacts = form.contacts
      .map((contact) => ({
        name: String(contact.name || '').trim(),
        phone: String(contact.phone || '').trim(),
        email: String(contact.email || '').trim(),
        designation: String(contact.designation || '').trim(),
      }))
      .filter((contact) => contact.name || contact.phone || contact.email || contact.designation);

    const primary = contacts[0] || {};
    const resolvedCompanyType = form.companyType === 'Other'
      ? form.customCompanyType.trim()
      : form.companyType;

    const payload = {
      ...form,
      customerName: form.customerName.trim(),
      companyType: resolvedCompanyType || '',
      contacts,
      contactPerson: primary.name || '',
      mobileNumber: primary.phone || '',
      email: primary.email || '',
      address: form.address || '',
      createdBy: form.createdBy || '',
    };

    delete payload.companyName;
    delete payload.customCompanyType;
    onSubmit(payload);
  };

  const contacts = Array.isArray(form.contacts) && form.contacts.length ? form.contacts : [DEFAULT_CONTACT()];

  const employeeOptions = useMemo(() => (
    mergeEmployeeOptions(employeeUsers, user ? [user] : [], initialData?.createdBy ? [initialData.createdBy] : [])
  ), [employeeUsers, initialData?.createdBy, user]);

  const savedCityOptions = useMemo(() => (
    normaliseCityOptions([...(cityOptions || []), form.city])
  ), [cityOptions, form.city]);

  const formClassName = fullPageActions
    ? 'w-full min-w-0 max-w-full space-y-0 pb-0'
    : 'space-y-5';

  const fieldsetClassName = [
    'space-y-5',
    fullPageActions ? 'rounded-none border-x-0 border-t-0 border-gray-100 bg-white p-3 shadow-sm sm:p-5 xl:p-6' : '',
    readOnly ? 'pointer-events-none opacity-90' : '',
  ].filter(Boolean).join(' ');

  return (
    <form onSubmit={handleSubmit} className={formClassName}>
      <fieldset disabled={readOnly || loading} className={fieldsetClassName}>
        <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${form.companyType === 'Other' ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
          <FormField label="Customer Name" required error={errors.customerName}>
            <Input placeholder="Customer name" value={form.customerName} onChange={set('customerName')} required />
          </FormField>

          <FormField label="Created By">
            <SearchableSelect
              value={form.createdBy}
              onChange={(value) => setForm((prev) => ({ ...prev, createdBy: value }))}
              options={employeeOptions}
              placeholder="Select employee"
              disabled={readOnly || loading || !canChangeCreatedBy}
            />
          </FormField>

          <FormField label="Company Type">
            <SearchableSelect
              value={form.companyType}
              onChange={(value) => {
                setForm((prev) => ({
                  ...prev,
                  companyType: value,
                  customCompanyType: value === 'Other' ? prev.customCompanyType : '',
                }));
              }}
              options={normaliseSelectOptions(COMPANY_TYPE_OPTIONS)}
              placeholder="Select company type"
              disabled={readOnly || loading}
            />
          </FormField>

          {form.companyType === 'Other' && (
            <FormField label="Other Company Type">
              <Input
                placeholder="Enter company type"
                value={form.customCompanyType}
                onChange={set('customCompanyType')}
              />
            </FormField>
          )}

          <FormField label="GST Number">
            <Input placeholder="GST number" value={form.gstNumber} onChange={set('gstNumber')} />
          </FormField>

          <FormField label="City of Location">
            <Input
              list={cityDatalistId}
              placeholder="City"
              value={form.city}
              onChange={set('city')}
            />
            {savedCityOptions.length > 0 && (
              <datalist id={cityDatalistId}>
                {savedCityOptions.map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
            )}
          </FormField>

          <FormField
            label="Location / Site Address"
            className={form.companyType === 'Other'
              ? 'md:col-span-2 xl:col-span-2'
              : 'md:col-span-2 xl:col-span-1'}
          >
            <Textarea placeholder="Full site address" value={form.address} onChange={set('address')} rows={2} />
          </FormField>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-gray-800">Contact Persons</h4>
              <p className="text-xs text-gray-500">Add primary and additional contact details.</p>
            </div>

            {!readOnly && (
              <Button type="button" variant="outline" size="sm" onClick={addContact} disabled={loading}>
                <Plus size={14} /> Add Contact
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {contacts.map((contact, index) => (
              <div key={`customer-contact-${index}`} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                      {index + 1}
                    </span>
                    {index === 0 ? 'Primary Contact' : `Contact ${index + 1}`}
                  </div>

                  {index > 0 && !readOnly && (
                    <button
                      type="button"
                      onClick={() => removeContact(index)}
                      disabled={loading}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Remove contact"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <FormField
                    label="Name"
                    required={index === 0}
                    error={errors[`contacts.${index}.name`]}
                  >
                    <Input
                      value={contact.name || ''}
                      onChange={(event) => setContact(index, 'name', event.target.value)}
                      placeholder="Contact name"
                      required={index === 0}
                    />
                  </FormField>

                  <FormField
                    label="Mobile Number"
                    required={index === 0}
                    error={errors[`contacts.${index}.phone`]}
                  >
                    <Input
                      value={contact.phone || ''}
                      onChange={(event) => setContact(index, 'phone', event.target.value)}
                      placeholder="10-digit mobile number"
                      inputMode="numeric"
                      maxLength={MOBILE_NUMBER_LENGTH}
                      pattern="[0-9]{10}"
                      title="Enter exactly 10 digits"
                      required={index === 0}
                    />
                  </FormField>

                  <FormField label="Email">
                    <Input
                      type="email"
                      value={contact.email || ''}
                      onChange={(event) => setContact(index, 'email', event.target.value)}
                      placeholder="email@example.com"
                    />
                  </FormField>

                  <FormField label="Designation">
                    <SearchableSelect
                      value={contact.designation || ''}
                      onChange={(value) => setContact(index, 'designation', value)}
                      options={normaliseSelectOptions(DESIGNATION_OPTIONS)}
                      placeholder="Select / Type Designation"
                      disabled={readOnly || loading}
                    />
                  </FormField>
                </div>
              </div>
            ))}
          </div>
        </div>

        <FormField label="Additional Notes">
          <Textarea
            placeholder="Additional notes"
            value={form.notes}
            onChange={set('notes')}
            rows={getExpandedTextareaRows(form.notes)}
            className="min-h-[96px] whitespace-pre-wrap overflow-hidden resize-y"
          />
        </FormField>
      </fieldset>

      {!readOnly && (
        <StickyActionBar
          fullBleed={fullPageActions}
          bleedBottom={false}
          className={fullPageActions ? '!mt-0' : ''}
          status={
            <span className="text-gray-400">
              {initialData ? 'Update customer details below.' : 'Ready to save.'}
            </span>
          }
        >
          <Button type="submit" loading={loading} className="h-8 w-full justify-center sm:w-auto sm:min-w-[145px]">
            {/* {initialData ? 'Update Customer' : 'Add Customer'} */}
            {initialData ? 'Update Customer' : 'New Customer'}
          </Button>
        </StickyActionBar>
      )}
    </form>
  );
};

export default CustomerForm;
