import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Edit2, Plus, RefreshCw, UserRound } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import API from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { CUSTOMER_PERMISSIONS } from '../constants/permissions';
import Spinner from '../components/common/Spinner';
import CustomerForm from '../components/customer/CustomerForm';
import { Button, Card } from '../components/common/FormComponents';
import PageHeader from '../components/common/PageHeader';

const CustomerDetailPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const normalizedPath = String(location.pathname || '').replace(/\/+$/, '');
  const isNew = id === 'new' || normalizedPath.endsWith('/customers/new');
  const searchParams = new URLSearchParams(location.search || '');
  const openInEdit = searchParams.get('mode') === 'edit' || location.state?.edit === true;
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canCreateCustomer = hasPermission(CUSTOMER_PERMISSIONS.CREATE);
  const canViewCustomer = hasPermission(CUSTOMER_PERMISSIONS.VIEW);
  const canEditCustomer = hasPermission(CUSTOMER_PERMISSIONS.EDIT);

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [submitting, setSubmitting] = useState(false);
  const [readOnly, setReadOnly] = useState(true);

  const loadCustomer = useCallback(async () => {
    if (isNew) {
      setCustomer(null);
      setReadOnly(false);
      setLoading(false);
      return;
    }

    if (!id) {
      setCustomer(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await API.get(`/customers/${id}`);
      const detail = data?.data;
      setCustomer(detail?.customer || detail || null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load customer');
      navigate('/customers');
    } finally {
      setLoading(false);
    }
  }, [id, isNew, navigate, toast]);

  useEffect(() => {
    if (isNew) {
      setCustomer(null);
      setReadOnly(false);
      setLoading(false);
      return;
    }

    setReadOnly(!(openInEdit && canEditCustomer));
    loadCustomer();
  }, [isNew, openInEdit, canEditCustomer, loadCustomer]);

  const handleSubmit = async (formData) => {
    if (!isNew && !customer?._id) return;

    if (isNew && !canCreateCustomer) {
      toast.error('You do not have permission to create customers');
      return;
    }

    if (!isNew && !canEditCustomer) {
      toast.error('You do not have permission to edit customers');
      setReadOnly(true);
      return;
    }

    setSubmitting(true);
    try {
      if (isNew) {
        await API.post('/customers', formData);
        toast.success('Customer added successfully');
        navigate(canViewCustomer ? '/customers' : '/', { replace: true });
        return;
      }

      const { data } = await API.put(`/customers/${customer._id}`, formData);
      toast.success('Customer updated successfully');
      setCustomer(data?.data || { ...customer, ...formData });
      setReadOnly(true);
      navigate(canViewCustomer ? '/customers' : '/', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || (isNew ? 'Failed to add customer' : 'Failed to update customer'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isNew && !customer) {
    return (
      <Card className="p-8 text-center">
        <p className="font-medium text-gray-800">Customer not found.</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/customers')}>
          Back to Customers
        </Button>
      </Card>
    );
  }

  return (
    <div className="fade-in w-full max-w-none space-y-0 pb-0">
      <PageHeader bleed="main" bleedTop={false} contentClassName="px-1 sm:px-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate('/customers')}
              className="mb-2 flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-800"
            >
              <ChevronLeft size={16} />
              Back to Customers
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {isNew ? <Plus size={18} className="text-blue-600" /> : <UserRound size={18} className="text-blue-600" />}
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 break-words">
                {/* {isNew ? 'Add Customer' : readOnly ? 'View Customer' : 'Edit Customer'}{customer?.customerId ? ` — ${customer.customerId}` : ''} */}
                {isNew ? 'New Customer' : readOnly ? 'View Customer' : 'Edit Customer'}{customer?.customerId ? ` — ${customer.customerId}` : ''}
              </h2>
            </div>

            {/* <p className="mt-0.5 text-sm text-gray-500">
              {isNew ? 'Create a new customer using the same full-page customer form.' : readOnly ? 'Customer details are read-only. Click Edit to make changes.' : 'Update customer details below.'}
            </p> */}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isNew && (
              <Button variant="secondary" onClick={loadCustomer} className="flex items-center gap-2">
                <RefreshCw size={15} /> Refresh
              </Button>
            )}
            {!isNew && readOnly && canEditCustomer && (
              <Button onClick={() => setReadOnly(false)} className="flex items-center gap-2">
                <Edit2 size={15} /> Edit
              </Button>
            )}
          </div>
        </div>
      </PageHeader>

      <CustomerForm
        initialData={isNew ? null : customer}
        onSubmit={handleSubmit}
        loading={submitting}
        readOnly={isNew ? !canCreateCustomer : readOnly}
        fullPageActions
      />
    </div>
  );
};

export default CustomerDetailPage;
