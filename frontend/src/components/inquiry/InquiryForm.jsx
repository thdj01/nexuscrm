import React, { useState, useEffect } from 'react';
import {
  FormField,
  Input,
  Select,
  Textarea,
  Button,
} from '../common/FormComponents';

const PRODUCT_TYPES = [
  { value: 'PLC', label: 'PLC' },
  { value: 'MCC', label: 'MCC' },
  { value: 'VFD', label: 'VFD' },
  { value: 'PLC_MCC', label: 'MCC cum PLC' },
];

const STATUSES = [
  'New',
  'Technical Evaluation',
  'Technical BoM Submitted',
  'BoM Approval Pending',
  'Revision',
  'Commercial BOM Submission',
  'Order Won',
  'Order Lost',
  'Inquiry Hold',
];

const LEGACY_STATUS_MAP = {
  'In Progress': 'Technical Evaluation',
  'Technical Submit': 'Technical BoM Submitted',
  'Technical BOM Submission': 'Technical BoM Submitted',
  'Technical BoM Submission': 'Technical BoM Submitted',
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

const normalizeInquiryStatus = (status = '') => LEGACY_STATUS_MAP[status] || status || 'New';

const defaultForm = {
  inquiryDate:
    new Date()
      .toISOString()
      .split('T')[0],

  customerName: '',
  contactPerson: '',
  mobileNumber: '',
  email: '',

  location: '',

  productType: 'MCC',
  projectName: '',

  status: 'New',

  nextFollowUpDate: '',
  remarks: '',
};

const InquiryForm = ({
  initialData,
  onSubmit,
  loading,
}) => {
  const [form, setForm] =
    useState(defaultForm);

  const [errors, setErrors] =
    useState({});

  // Edit Mode
  useEffect(() => {
    if (initialData) {
      setForm({
        ...defaultForm,
        ...initialData,

        inquiryDate:
          initialData.inquiryDate
            ? new Date(
                initialData.inquiryDate
              )
                .toISOString()
                .split('T')[0]
            : defaultForm.inquiryDate,

        nextFollowUpDate:
          initialData.nextFollowUpDate
            ? new Date(
                initialData.nextFollowUpDate
              )
                .toISOString()
                .split('T')[0]
            : '',


        location:
          initialData.location || '',

        status: normalizeInquiryStatus(initialData.status),
      });
    }
  }, [initialData]);

  // Handle Change
  const set =
    (field) => (e) => {
      setForm((prev) => ({
        ...prev,
        [field]: e.target.value,
      }));

      setErrors((prev) => ({
        ...prev,
        [field]: '',
      }));
    };

  // Validation
  const validate = () => {
    const errs = {};

    if (!form.customerName.trim()) {
      errs.customerName = 'Required';
    }

    if (!form.mobileNumber.trim()) {
      errs.mobileNumber = 'Required';
    }

    if (!form.productType) {
      errs.productType = 'Required';
    }

    return errs;
  };

  // Submit
  const handleSubmit = (e) => {
    e.preventDefault();

    const errs = validate();

    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    const payload = {
      ...form,
    };

    if (!payload.nextFollowUpDate) {
      delete payload.nextFollowUpDate;
    }


    delete payload.companyName;
    onSubmit(payload);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
    >

      {/* Row 1 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        <FormField
          label="Inquiry Date"
          required
        >
          <Input
            type="date"
            min={new Date().toISOString().split('T')[0]}
            value={form.inquiryDate}
            onChange={set(
              'inquiryDate'
            )}
          />
        </FormField>

        <FormField
          label="Customer Name"
          error={errors.customerName}
          required
        >
          <Input
            placeholder="Customer name"
            value={form.customerName}
            onChange={set(
              'customerName'
            )}
          />
        </FormField>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        <FormField label="Contact Person">
          <Input
            placeholder="Contact person"
            value={form.contactPerson}
            onChange={set(
              'contactPerson'
            )}
          />
        </FormField>

        <FormField
          label="Mobile Number"
          error={errors.mobileNumber}
          required
        >
          <Input
            placeholder="Mobile number"
            value={form.mobileNumber}
            onChange={set(
              'mobileNumber'
            )}
          />
        </FormField>

        <FormField label="Email">
          <Input
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={set('email')}
          />
        </FormField>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        <FormField label="Location">
          <Input
            placeholder="Location"
            value={form.location}
            onChange={set(
              'location'
            )}
          />
        </FormField>

        <FormField
          label="Product Type"
          error={errors.productType}
          required
        >
          <Select
            value={form.productType}
            onChange={set(
              'productType'
            )}
          >
            {PRODUCT_TYPES.map(
              (product) => (
                <option
                  key={product.value}
                  value={product.value}
                >
                  {product.label}
                </option>
              )
            )}
          </Select>
        </FormField>

        <FormField label="Project Name">
          <Input
            placeholder="Project name"
            value={form.projectName}
            onChange={set(
              'projectName'
            )}
          />
        </FormField>
      </div>

      {/* Row 4 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        <FormField label="Status">
          <Select
            value={form.status}
            onChange={set(
              'status'
            )}
          >
            {STATUSES.map(
              (status) => (
                <option
                  key={status}
                >
                  {status}
                </option>
              )
            )}
          </Select>
        </FormField>
      </div>

      {/* Row 5 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        <FormField label="Next Follow-up Date">
          <Input
            type="date"
            value={
              form.nextFollowUpDate
            }
            onChange={set(
              'nextFollowUpDate'
            )}
          />
        </FormField>

        <FormField label="Remarks">
          <Textarea
            placeholder="Additional remarks..."
            value={form.remarks}
            onChange={set('remarks')}
            rows={3}
          />
        </FormField>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 border-t border-gray-100 pt-2">

        <Button
          type="submit"
          loading={loading}
        >
          {initialData
            ? 'Update Inquiry'
            : 'Create Inquiry'}
        </Button>
      </div>
    </form>
  );
};

export default InquiryForm;