import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  MessageCircle,
  QrCode,
  RefreshCw,
  Save,
  ShieldAlert,
  Smartphone,
  Trash2,
} from 'lucide-react';

import API from '../api/axios';
import { useToast } from '../context/ToastContext';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  FormField,
  Input,
} from '../components/common/FormComponents';

const defaultEmailForm = {
  isEnabled: false,
  provider: 'outlook',
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  username: '',
  fromEmail: '',
  password: '',
  passwordConfigured: false,
  lastVerifiedAt: null,
  lastVerificationStatus: 'Pending',
  lastVerificationError: '',
};

const statusClass = (status = '') => {
  const key = String(status || '').toLowerCase();
  if (key === 'ready' || key === 'authenticated') return 'bg-green-50 text-green-700 border-green-200';
  if (key === 'qr_required' || key === 'initialising' || key === 'restarting') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (key === 'auth_failed' || key === 'failed' || key === 'disconnected') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-gray-50 text-gray-700 border-gray-200';
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN');
};

const IntegrationSettingsPage = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [whatsappAction, setWhatsappAction] = useState('');
  const [whatsapp, setWhatsapp] = useState(null);
  const [emailForm, setEmailForm] = useState(defaultEmailForm);

  const loadStatus = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const { data } = await API.get('/integrations/status');
      setWhatsapp(data.data?.whatsapp || null);

      // Silent refresh runs every 3 seconds for WhatsApp QR/session status.
      // Do not refresh the email form during silent polling, otherwise fields
      // being edited by the admin get overwritten by the last saved DB values.
      if (!silent) {
        setEmailForm({
          ...defaultEmailForm,
          ...(data.data?.email || {}),
          password: '',
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load integration settings');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadStatus({ silent: true });
    }, 3000);

    return () => clearInterval(timer);
  }, [loadStatus]);

  const updateEmailField = (field, value) => {
    setEmailForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveEmailSettings = async () => {
    try {
      setSavingEmail(true);
      const { data } = await API.put('/integrations/email', {
        isEnabled: emailForm.isEnabled,
        provider: emailForm.provider || 'outlook',
        host: emailForm.host,
        port: Number(emailForm.port || 587),
        secure: Boolean(emailForm.secure),
        username: emailForm.username,
        fromEmail: emailForm.fromEmail || emailForm.username,
        password: emailForm.password,
      });

      setEmailForm((prev) => ({
        ...prev,
        ...(data.data || {}),
        password: '',
      }));
      toast.success('Email settings saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save email settings');
    } finally {
      setSavingEmail(false);
    }
  };

  const verifyEmailSettings = async () => {
    try {
      setVerifyingEmail(true);
      const { data } = await API.post('/integrations/email/verify', {
        host: emailForm.host,
        port: Number(emailForm.port || 587),
        secure: Boolean(emailForm.secure),
        username: emailForm.username,
        fromEmail: emailForm.fromEmail || emailForm.username,
        password: emailForm.password,
      });
      setEmailForm((prev) => ({
        ...prev,
        ...(data.data || {}),
        password: '',
      }));
      toast.success('Email login verified');
    } catch (err) {
      const payload = err.response?.data;
      if (payload?.data) {
        setEmailForm((prev) => ({ ...prev, ...payload.data, password: '' }));
      }
      toast.error(payload?.error || payload?.message || 'Email verification failed');
    } finally {
      setVerifyingEmail(false);
    }
  };

  const runWhatsappAction = async (action) => {
    const confirmMessage = action === 'logout'
      ? 'This will clear the current WhatsApp session and require scanning QR again. Continue?'
      : '';

    if (confirmMessage && !window.confirm(confirmMessage)) return;

    try {
      setWhatsappAction(action);
      const endpoint = action === 'logout'
        ? '/integrations/whatsapp/logout'
        : '/integrations/whatsapp/restart';
      const { data } = await API.post(endpoint);
      setWhatsapp(data.data || null);
      toast.success(data.message || 'WhatsApp action completed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'WhatsApp action failed');
    } finally {
      setWhatsappAction('');
      setTimeout(() => loadStatus({ silent: true }), 1500);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="fade-in mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Integration Settings</h2>
          <p className="text-sm text-gray-500">
            Admin-only setup for WhatsApp QR session and SMTP email login.
          </p>
        </div>
        <Button variant="outline" onClick={() => loadStatus()}>
          <RefreshCw size={16} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader
            title="WhatsApp Session"
            subtitle="Scan QR from browser when the server WhatsApp session expires."
            actions={(
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(whatsapp?.status)}`}>
                {whatsapp?.status || 'not_started'}
              </span>
            )}
          />
          <CardBody className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <Smartphone size={16} /> Linked Account
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  {whatsapp?.account?.number || 'Not linked'}
                </p>
                <p className="text-xs text-gray-400">
                  {whatsapp?.account?.pushname || whatsapp?.account?.platform || '—'}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <MessageCircle size={16} /> Last Ready
                </p>
                <p className="mt-2 text-sm text-gray-600">{formatDateTime(whatsapp?.lastReadyAt)}</p>
                {whatsapp?.lastError && (
                  <p className="mt-1 text-xs text-red-600">{whatsapp.lastError}</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-center">
              {whatsapp?.qrDataUrl ? (
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={whatsapp.qrDataUrl}
                    alt="WhatsApp QR"
                    className="h-64 w-64 max-w-full rounded-xl border border-gray-200 bg-white p-2"
                  />
                  <p className="text-sm text-gray-600">
                    Open WhatsApp → Linked Devices → Link a Device, then scan this QR.
                  </p>
                </div>
              ) : whatsapp?.qrAscii ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="max-w-full overflow-auto rounded-xl border border-gray-200 bg-white p-3">
                    <pre className="select-none text-left font-mono text-[7px] leading-[7px] text-black sm:text-[9px] sm:leading-[9px]">
                      {whatsapp.qrAscii}
                    </pre>
                  </div>
                  <p className="max-w-md text-sm text-gray-600">
                    Open WhatsApp → Linked Devices → Link a Device, then scan this QR. This fallback QR is shown when backend image QR generation is unavailable.
                  </p>
                </div>
              ) : whatsapp?.qr ? (
                <div className="flex flex-col items-center gap-2 py-8 text-amber-700">
                  <QrCode size={44} className="text-amber-300" />
                  <p className="text-sm font-medium">QR generated, but image conversion is not available.</p>
                  <p className="max-w-md text-xs">
                    Run npm install inside backend to install the qrcode package, then restart backend. Until then, scan the QR shown in backend terminal.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-8 text-gray-500">
                  <QrCode size={44} className="text-gray-300" />
                  <p className="text-sm font-medium">
                    {whatsapp?.isReady ? 'WhatsApp is connected.' : 'QR is not available yet.'}
                  </p>
                  <p className="max-w-md text-xs">
                    Click “Clear Session & New QR” if the session is logged out or expired.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => runWhatsappAction('restart')}
                loading={whatsappAction === 'restart'}
                className="w-full sm:w-auto"
              >
                <RefreshCw size={16} /> Restart Client
              </Button>
              <Button
                variant="danger"
                onClick={() => runWhatsappAction('logout')}
                loading={whatsappAction === 'logout'}
                className="w-full sm:w-auto"
              >
                <Trash2 size={16} /> Clear Session & New QR
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Email Login"
            subtitle="Use Microsoft 365, Gmail, or custom SMTP credentials/app password."
            actions={(
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                emailForm.lastVerificationStatus === 'Success'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : emailForm.lastVerificationStatus === 'Failed'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-gray-200 bg-gray-50 text-gray-700'
              }`}
              >
                {emailForm.lastVerificationStatus || 'Pending'}
              </span>
            )}
          />
          <CardBody className="space-y-4">
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
              <div className="flex gap-2">
                <ShieldAlert size={18} className="mt-0.5 shrink-0" />
                <p>
                  Use the SMTP password/app password for the Email/Login ID account. Password is saved encrypted in database.
                </p>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm">
              <input
                type="checkbox"
                checked={emailForm.isEnabled}
                onChange={(event) => updateEmailField('isEnabled', event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="font-medium text-gray-700">Use saved database SMTP settings for email sending</span>
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="SMTP Host" required>
                <Input
                  value={emailForm.host}
                  onChange={(event) => updateEmailField('host', event.target.value)}
                  placeholder="smtp.office365.com"
                />
              </FormField>
              <FormField label="SMTP Port" required>
                <Input
                  type="number"
                  value={emailForm.port}
                  onChange={(event) => updateEmailField('port', event.target.value)}
                  placeholder="587"
                />
              </FormField>
              <FormField label="Email / Login ID" required>
                <Input
                  type="email"
                  value={emailForm.username}
                  onChange={(event) => updateEmailField('username', event.target.value)}
                  placeholder="nexus@company.com"
                />
              </FormField>
              <FormField label="From Email">
                <Input
                  type="email"
                  value={emailForm.fromEmail}
                  onChange={(event) => updateEmailField('fromEmail', event.target.value)}
                  placeholder="Same as login ID"
                />
              </FormField>
              <FormField label={emailForm.passwordConfigured ? 'New Password / App Password' : 'Password / App Password'}>
                <Input
                  type="password"
                  value={emailForm.password}
                  onChange={(event) => updateEmailField('password', event.target.value)}
                  placeholder={emailForm.passwordConfigured ? 'Leave blank to keep existing' : 'Enter password'}
                />
              </FormField>
              <FormField label="Secure Connection">
                <label className="flex h-[42px] cursor-pointer items-center gap-3 rounded-lg border border-gray-300 px-3 text-sm">
                  <input
                    type="checkbox"
                    checked={emailForm.secure}
                    onChange={(event) => updateEmailField('secure', event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Use encrypted connection</span>
                </label>
              </FormField>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
              <p>Password saved: {emailForm.passwordConfigured ? 'Yes' : 'No'}</p>
              <p>Last verified: {formatDateTime(emailForm.lastVerifiedAt)}</p>
              {emailForm.lastVerificationError && (
                <p className="mt-1 text-red-600">{emailForm.lastVerificationError}</p>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={verifyEmailSettings}
                loading={verifyingEmail}
                disabled={!emailForm.username || (!emailForm.passwordConfigured && !emailForm.password)}
                className="w-full sm:w-auto"
              >
                <CheckCircle2 size={16} /> Verify Login
              </Button>
              <Button
                onClick={saveEmailSettings}
                loading={savingEmail}
                className="w-full sm:w-auto"
              >
                <Save size={16} /> Save Email Settings
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default IntegrationSettingsPage;
