import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  MessageCircle,
  QrCode,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  Smartphone,
  Trash2,
  Users,
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

const defaultWhatsappForm = {
  isConfigured: false,
  source: 'env',
  isEnabled: true,
  notifyNumber: '',
  groupId: '',
  groupName: '',
  allowUnknownSenders: false,
  clientId: 'nexus-session',
  lastSavedAt: null,
};


const statusClass = (status = '') => {
  const key = String(status || '').toLowerCase();
  if (key === 'ready' || key === 'authenticated') return 'bg-green-50 text-green-700 border-green-200';
  if (['qr_required', 'initialising', 'restarting', 'session_clearing', 'ready_timeout_restarting'].includes(key)) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (['auth_failed', 'failed', 'disconnected'].includes(key)) return 'bg-red-50 text-red-700 border-red-200';
  if (key === 'disabled') return 'bg-gray-100 text-gray-600 border-gray-200';
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
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [whatsappAction, setWhatsappAction] = useState('');
  const [whatsapp, setWhatsapp] = useState(null);
  const [whatsappGroups, setWhatsappGroups] = useState([]);
  const [whatsappGroupsMessage, setWhatsappGroupsMessage] = useState('');
  const [emailForm, setEmailForm] = useState(defaultEmailForm);
  const [whatsappForm, setWhatsappForm] = useState(defaultWhatsappForm);

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
        setWhatsappForm({
          ...defaultWhatsappForm,
          ...(data.data?.whatsappSettings || {}),
        });
      }
    } catch (err) {
      if (!silent) {
        toast.error(err.response?.data?.message || 'Failed to load integration settings');
      }
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

  const updateWhatsappField = (field, value) => {
    setWhatsappForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveWhatsappSettings = async () => {
    try {
      setSavingWhatsapp(true);
      const { data } = await API.put('/integrations/whatsapp/settings', {
        isEnabled: Boolean(whatsappForm.isEnabled),
        notifyNumber: whatsappForm.notifyNumber,
        groupId: whatsappForm.groupId,
        groupName: whatsappForm.groupName,
        allowUnknownSenders: Boolean(whatsappForm.allowUnknownSenders),
        clientId: whatsappForm.clientId,
      });

      setWhatsappForm({
        ...defaultWhatsappForm,
        ...(data.data?.settings || {}),
      });
      setWhatsapp(data.data?.whatsapp || null);
      toast.success(data.message || 'WhatsApp settings saved');
    } catch (err) {
      const payload = err.response?.data;
      toast.error(payload?.message || 'Failed to save WhatsApp settings');
    } finally {
      setSavingWhatsapp(false);
      setTimeout(() => loadStatus({ silent: true }), 1000);
    }
  };

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
      if (action === 'logout') {
        setWhatsappGroups([]);
        setWhatsappGroupsMessage('Scan the new QR, wait for ready status, then load groups.');
        setWhatsappForm((previous) => ({
          ...previous,
          groupId: '',
          groupName: '',
        }));
      }
      toast.success(data.message || 'WhatsApp action completed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'WhatsApp action failed');
    } finally {
      setWhatsappAction('');
      setTimeout(() => loadStatus({ silent: true }), 1500);
    }
  };


  const runWhatsappTest = async (target) => {
    try {
      setWhatsappAction(`test-${target}`);
      const endpoint = target === 'group'
        ? '/integrations/whatsapp/test-group'
        : '/integrations/whatsapp/test-number';
      const { data } = await API.post(endpoint, {});
      toast.success(data.message || 'WhatsApp test message sent');
    } catch (err) {
      const payload = err.response?.data;
      toast.error(payload?.error || payload?.message || 'WhatsApp test failed');
    } finally {
      setWhatsappAction('');
      loadStatus({ silent: true });
    }
  };

  const loadWhatsappGroups = async () => {
    try {
      setWhatsappAction('groups');
      setWhatsappGroupsMessage('');
      const { data } = await API.get('/integrations/whatsapp/groups');
      const groups = Array.isArray(data.data?.groups) ? data.data.groups : [];
      const warning = data.warning || data.data?.warning || '';

      setWhatsappGroups(groups);
      setWhatsappGroupsMessage(warning || data.message || '');

      setWhatsappForm((previous) => {
        if (groups.length === 0) return previous;

        const savedGroupStillAvailable = groups.some(
          (group) => group.id === previous.groupId
        );

        if (savedGroupStillAvailable) return previous;

        if (groups.length === 1) {
          return {
            ...previous,
            groupId: groups[0].id,
            groupName: groups[0].name || '',
          };
        }

        return {
          ...previous,
          groupId: '',
          groupName: '',
        };
      });

      if (groups.length > 0) {
        toast.success(data.message || 'WhatsApp groups loaded');
      } else {
        toast.warning(warning || data.message || 'No WhatsApp groups found');
      }
    } catch (err) {
      const payload = err.response?.data;
      const message = payload?.error || payload?.message || 'Could not load WhatsApp groups';
      setWhatsappGroupsMessage(message);
      toast.error(message);
    } finally {
      setWhatsappAction('');
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  const whatsappConfig = whatsapp?.configuration || {};

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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className={`rounded-xl border p-3 ${whatsappConfig.browserAvailable ? 'border-green-100 bg-green-50' : 'border-red-100 bg-red-50'}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Chrome / Browser</p>
                <p className={`mt-1 text-sm font-semibold ${whatsappConfig.browserAvailable ? 'text-green-700' : 'text-red-700'}`}>
                  {whatsappConfig.browserAvailable ? 'Detected' : 'Missing'}
                </p>
                <p className="mt-1 break-all text-[11px] text-gray-500">
                  {whatsappConfig.browserExecutablePath || 'Set CHROME_EXECUTABLE_PATH in backend/.env'}
                </p>
              </div>

              <div className={`rounded-xl border p-3 ${whatsappConfig.dependencyAvailable ? 'border-green-100 bg-green-50' : 'border-red-100 bg-red-50'}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">WhatsApp Library</p>
                <p className={`mt-1 text-sm font-semibold ${whatsappConfig.dependencyAvailable ? 'text-green-700' : 'text-red-700'}`}>
                  {whatsappConfig.dependencyAvailable ? 'Installed' : 'Not available'}
                </p>
                {whatsappConfig.dependencyError && (
                  <p className="mt-1 text-[11px] text-red-600">{whatsappConfig.dependencyError}</p>
                )}
              </div>

              <div className={`rounded-xl border p-3 ${whatsappConfig.notifyNumberValid ? 'border-green-100 bg-green-50' : 'border-amber-100 bg-amber-50'}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Direct Recipient</p>
                <p className="mt-1 text-sm font-semibold text-gray-800">
                  {whatsappConfig.notifyNumberMasked || 'Not configured'}
                </p>
                <p className="mt-1 text-[11px] text-gray-500">Saved Integration Settings</p>
              </div>

              <div className={`rounded-xl border p-3 ${whatsappConfig.groupIdValid ? 'border-green-100 bg-green-50' : 'border-amber-100 bg-amber-50'}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Notification Group</p>
                <p className="mt-1 break-all text-sm font-semibold text-gray-800">
                  {whatsappConfig.groupIdMasked || 'Not configured'}
                </p>
                <p className="mt-1 text-[11px] text-gray-500">{whatsappConfig.groupName || 'Saved Integration Settings'}</p>
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

            <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <div>
                <p className="text-sm font-semibold text-gray-800">Connection Tests</p>
                <p className="text-xs text-gray-500">
                  WhatsApp must show ready before tests can be sent. Both tests use the values saved in Master → Integration Settings.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  variant="outline"
                  onClick={() => runWhatsappTest('number')}
                  loading={whatsappAction === 'test-number'}
                  disabled={!whatsapp?.isReady || !whatsappConfig.notifyNumberValid}
                  className="w-full"
                >
                  <Send size={16} /> Test Number
                </Button>
                <Button
                  variant="success"
                  onClick={() => runWhatsappTest('group')}
                  loading={whatsappAction === 'test-group'}
                  disabled={!whatsapp?.isReady || !whatsappConfig.groupIdValid}
                  className="w-full"
                >
                  <Send size={16} /> Test Group
                </Button>
              </div>
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

            <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Saved WhatsApp Configuration</p>
                  <p className="text-xs text-gray-500">
                    Scan the QR, load groups from the connected WhatsApp account, select one group, and save. No manual group ID is required.
                  </p>
                </div>
                <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${whatsappForm.source === 'database' ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                  {whatsappForm.source === 'database' ? 'Database settings active' : 'Environment fallback active'}
                </span>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(whatsappForm.isEnabled)}
                  onChange={(event) => updateWhatsappField('isEnabled', event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="font-medium text-gray-700">Enable WhatsApp integration</span>
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Notification Number">
                  <Input
                    value={whatsappForm.notifyNumber}
                    onChange={(event) => updateWhatsappField('notifyNumber', event.target.value.replace(/\D/g, ''))}
                    placeholder="919876543210"
                    disabled={!whatsappForm.isEnabled}
                  />
                </FormField>

                <FormField label="WhatsApp Client ID">
                  <Input
                    value={whatsappForm.clientId}
                    onChange={(event) => updateWhatsappField('clientId', event.target.value)}
                    placeholder="nexus-session"
                    disabled={!whatsappForm.isEnabled}
                  />
                </FormField>

              </div>

              <FormField label="Notification Group" required>
                <select
                  value={whatsappForm.groupId}
                  onChange={(event) => {
                    const selected = whatsappGroups.find((group) => group.id === event.target.value);
                    updateWhatsappField('groupId', event.target.value);
                    updateWhatsappField('groupName', selected?.name || '');
                  }}
                  disabled={!whatsappForm.isEnabled || !whatsapp?.isReady || whatsappGroups.length === 0}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="">
                    {!whatsapp?.isReady
                      ? 'Scan QR and wait for WhatsApp status: ready'
                      : whatsappGroups.length === 0
                        ? 'Click Load Groups to select a WhatsApp group'
                        : 'Select a WhatsApp group'}
                  </option>
                  {whatsappForm.groupId && !whatsappGroups.some((group) => group.id === whatsappForm.groupId) && (
                    <option value={whatsappForm.groupId}>
                      {whatsappForm.groupName || 'Previously saved WhatsApp group'}
                    </option>
                  )}
                  {whatsappGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} {group.participantCount ? `(${group.participantCount} members)` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Group IDs are loaded from the connected WhatsApp account. Manual group ID entry is disabled.
                </p>
                {whatsappGroupsMessage && (
                  <p className={`mt-1 text-xs ${whatsappGroups.length > 0 ? 'text-green-700' : 'text-amber-700'}`}>
                    {whatsappGroupsMessage}
                  </p>
                )}
                {whatsappForm.groupId && whatsappForm.groupName && (
                  <p className="mt-1 text-xs font-medium text-green-700">
                    Selected: {whatsappForm.groupName}
                  </p>
                )}
              </FormField>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(whatsappForm.allowUnknownSenders)}
                  onChange={(event) => updateWhatsappField('allowUnknownSenders', event.target.checked)}
                  disabled={!whatsappForm.isEnabled}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <span>
                  <span className="block font-medium text-gray-800">Allow unknown senders to update project planning</span>
                  <span className="block text-xs text-gray-500">Keep this off in production unless you intentionally accept commands from numbers not present in User Management.</span>
                </span>
              </label>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={loadWhatsappGroups}
                  loading={whatsappAction === 'groups'}
                  disabled={!whatsapp?.isReady}
                  className="w-full sm:w-auto"
                >
                  <Users size={16} /> Load Groups from WhatsApp
                </Button>
                <Button
                  variant="primary"
                  onClick={saveWhatsappSettings}
                  loading={savingWhatsapp}
                  className="w-full sm:w-auto"
                >
                  <Save size={16} /> Save WhatsApp Settings
                </Button>
              </div>
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
