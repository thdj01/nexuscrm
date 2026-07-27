import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, ExternalLink, FileText, RefreshCw } from 'lucide-react';
import Spinner from '../components/common/Spinner';
import StatusBadge from '../components/common/StatusBadge';
import { fetchProject as apiFetchProject, getProjectDocumentUrl } from '../api/projectService';
import { useToast } from '../context/ToastContext';

const OFFICE_PREVIEW_EXTENSIONS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

const formatBytes = (bytes = 0) => {
  const size = Number(bytes || 0);
  if (!size) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileExtension = (doc = {}) => (
  String(doc.name || doc.storedName || doc.storagePath || '')
    .split('?')[0]
    .split('#')[0]
    .split('.')
    .pop()
    .toLowerCase()
);

const getDocumentPreviewKey = (doc = {}) => (
  doc._id || doc.id || doc.storagePath || doc.storedName || doc.name || ''
);

const getPreviewKind = (doc = {}) => {
  const mime = String(doc.mimeType || '').toLowerCase();
  const ext = getFileExtension(doc);

  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('text/') || ['txt', 'csv', 'log', 'json', 'xml'].includes(ext)) return 'text';
  if (OFFICE_PREVIEW_EXTENSIONS.includes(ext)) return 'office';
  return 'unsupported';
};

const getAbsoluteDocumentUrl = (url = '') => {
  const cleaned = String(url || '').trim();
  if (!cleaned) return '';
  if (/^https?:\/\//i.test(cleaned)) return cleaned;

  try {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return new URL(cleaned, window.location.origin).href;
    }
  } catch {}

  return cleaned;
};

const isPrivatePreviewHost = (host = '') => {
  const hostname = String(host || '').toLowerCase();
  return (
    !hostname ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
};

const getOfficePreviewUrl = (url = '') => {
  const absoluteUrl = getAbsoluteDocumentUrl(url);
  if (!/^https?:\/\//i.test(absoluteUrl)) return '';

  try {
    const parsed = new URL(absoluteUrl);
    if (isPrivatePreviewHost(parsed.hostname)) return '';
  } catch {
    return '';
  }

  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absoluteUrl)}`;
};

const appendPdfViewerOptions = (url = '') => {
  const cleaned = String(url || '').trim();
  if (!cleaned) return '';
  const separator = cleaned.includes('#') ? '&' : '#';
  return `${cleaned}${separator}toolbar=1&navpanes=1&view=FitH`;
};

const ProjectDocumentPreviewPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const requestedDocumentKey = searchParams.get('doc') || '';
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [textPreview, setTextPreview] = useState({ loading: false, value: '', error: '' });

  const loadProject = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    try {
      const data = await apiFetchProject(id);
      setProject(data);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to load project document preview');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const document = useMemo(() => {
    const documents = Array.isArray(project?.documents) ? project.documents : [];
    if (!documents.length) return null;

    const requested = String(requestedDocumentKey || '').trim();
    return documents.find((doc) => {
      const possibleKeys = [
        doc._id,
        doc.id,
        doc.storagePath,
        doc.storedName,
        doc.name,
        getDocumentPreviewKey(doc),
      ].filter(Boolean).map((value) => String(value));

      return possibleKeys.includes(requested);
    }) || documents[0];
  }, [project, requestedDocumentKey]);

  const previewUrl = document ? getProjectDocumentUrl(document) : '';
  const previewKind = document ? getPreviewKind(document) : 'unsupported';
  const officePreviewUrl = previewKind === 'office' ? getOfficePreviewUrl(previewUrl) : '';

  useEffect(() => {
    if (!document || previewKind !== 'text' || !previewUrl) {
      setTextPreview({ loading: false, value: '', error: '' });
      return () => {};
    }

    const controller = new AbortController();
    setTextPreview({ loading: true, value: '', error: '' });

    fetch(previewUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load text preview.');
        return response.text();
      })
      .then((text) => {
        if (!controller.signal.aborted) {
          setTextPreview({ loading: false, value: text, error: '' });
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setTextPreview({ loading: false, value: '', error: error.message || 'Unable to load text preview.' });
      });

    return () => controller.abort();
  }, [document, previewKind, previewUrl]);

  const goBackToProject = () => {
    navigate(id ? `/projects/${id}` : '/projects');
  };

  const renderPreview = () => {
    if (!document || !previewUrl) {
      return (
        <div className="flex h-full min-h-[560px] items-center justify-center rounded-2xl bg-white p-8 text-center">
          <div className="max-w-md">
            <FileText size={44} className="mx-auto mb-3 text-gray-400" />
            <p className="text-sm font-semibold text-gray-800">Document preview is not available.</p>
            <p className="mt-1 text-xs text-gray-500">The selected file could not be found in this project.</p>
          </div>
        </div>
      );
    }

    if (previewKind === 'pdf') {
      return (
        <iframe
          title={document.name || 'Project document preview'}
          src={appendPdfViewerOptions(previewUrl)}
          className="h-full min-h-[640px] w-full rounded-2xl border-0 bg-white shadow-sm"
          allowFullScreen
        />
      );
    }

    if (previewKind === 'image') {
      return (
        <div className="flex h-full min-h-[640px] items-center justify-center rounded-2xl bg-white p-4 shadow-sm">
          <img src={previewUrl} alt={document.name || 'Project attachment'} className="max-h-full max-w-full object-contain" />
        </div>
      );
    }

    if (previewKind === 'text') {
      if (textPreview.loading) {
        return <div className="flex min-h-[640px] items-center justify-center rounded-2xl bg-white p-8 text-sm font-medium text-gray-500 shadow-sm">Loading preview…</div>;
      }

      if (textPreview.error) {
        return (
          <div className="flex min-h-[640px] items-center justify-center rounded-2xl bg-white p-8 text-center shadow-sm">
            <div className="max-w-md">
              <FileText size={44} className="mx-auto mb-3 text-gray-400" />
              <p className="text-sm font-semibold text-gray-800">Text preview could not be loaded.</p>
              <p className="mt-1 text-xs text-gray-500">{textPreview.error}</p>
            </div>
          </div>
        );
      }

      return (
        <pre className="min-h-[640px] w-full overflow-auto whitespace-pre-wrap rounded-2xl bg-white p-4 text-left text-xs leading-relaxed text-gray-800 shadow-sm sm:p-5">
          {textPreview.value}
        </pre>
      );
    }

    if (previewKind === 'office' && officePreviewUrl) {
      return (
        <iframe
          title={document.name || 'Project document preview'}
          src={officePreviewUrl}
          className="h-full min-h-[640px] w-full rounded-2xl border-0 bg-white shadow-sm"
          allowFullScreen
        />
      );
    }

    return (
      <div className="flex min-h-[640px] items-center justify-center rounded-2xl bg-white p-8 text-center shadow-sm">
        <div className="max-w-lg">
          <FileText size={44} className="mx-auto mb-3 text-gray-400" />
          <p className="text-sm font-semibold text-gray-800">Preview is not available for this file type here.</p>
          {previewKind === 'office' ? (
            <p className="mt-1 text-xs leading-5 text-gray-500">
              Word, Excel and PowerPoint preview needs a public browser-accessible file URL or server-side conversion. Local/private files like localhost uploads cannot be opened by Office online preview, so use Download for this file.
            </p>
          ) : (
            <p className="mt-1 text-xs leading-5 text-gray-500">PDF, images, text, CSV, JSON and XML files can be shown directly. Other files need to be downloaded.</p>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const projectTitle = project?.projectId || project?.projectName || 'Project';
  const documentName = document?.name || document?.storedName || 'Document';

  return (
    <div className="fade-in mx-auto flex min-h-[calc(100dvh-120px)] w-full min-w-0 max-w-none flex-col space-y-4 xl:max-w-7xl">
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:px-5">
        <button
          type="button"
          onClick={goBackToProject}
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 transition-colors hover:text-gray-800"
        >
          <ArrowLeft size={15} /> Back to Project
        </button>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="min-w-0 break-words text-lg font-bold text-gray-900 sm:text-xl">Document Preview</h2>
              {project?.projectStatus && <StatusBadge status={project.projectStatus} />}
            </div>
            <p className="mt-1 truncate text-sm font-semibold text-gray-800">{documentName}</p>
            <p className="mt-0.5 text-xs text-gray-500">
              {projectTitle} · {formatBytes(document?.sizeBytes)} · Preview opens inside Nexus with sidebar and topbar visible.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadProject}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                <ExternalLink size={14} /> Open Tab
              </a>
            )}
            {previewUrl && (
              <a
                href={previewUrl}
                download={document?.name}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-green-700"
              >
                <Download size={14} /> Download
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 rounded-2xl border border-gray-200 bg-gray-100 p-2 shadow-sm sm:p-4">
        <div className="h-[calc(100dvh-265px)] min-h-[640px] overflow-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          {renderPreview()}
        </div>
      </div>
    </div>
  );
};

export default ProjectDocumentPreviewPage;
