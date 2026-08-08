import API from './axios';

const RESOURCE_PATHS = Object.freeze({
  inquiries: 'inquiries',
  projects: 'projects',
  tickets: 'tickets',
});

export const getProtectedFileKey = (attachment = {}) => {
  const storagePath = String(attachment.storagePath || '').replace(/\\/g, '/');
  return String(
    attachment._id ||
    attachment.id ||
    attachment.storedName ||
    storagePath.split('/').filter(Boolean).pop() ||
    ''
  );
};

const getProtectedFileEndpoint = ({ resource, recordId, attachment }) => {
  const resourcePath = RESOURCE_PATHS[resource];
  const fileKey = getProtectedFileKey(attachment);

  if (!resourcePath || !recordId || !fileKey) {
    throw new Error('The attachment reference is incomplete.');
  }

  const segment = resource === 'projects' ? 'documents' : 'attachments';
  return `/${resourcePath}/${encodeURIComponent(recordId)}/${segment}/${encodeURIComponent(fileKey)}`;
};

export const fetchProtectedFileBlob = async ({
  resource,
  recordId,
  attachment,
  download = false,
  signal,
}) => {
  const response = await API.get(
    getProtectedFileEndpoint({ resource, recordId, attachment }),
    {
      params: download ? { download: 1 } : undefined,
      responseType: 'blob',
      signal,
    }
  );

  return response.data;
};

export const downloadProtectedFile = async ({ resource, recordId, attachment }) => {
  const blob = await fetchProtectedFileBlob({
    resource,
    recordId,
    attachment,
    download: true,
  });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const downloadName = attachment?.name || attachment?.originalName || attachment?.storedName || 'attachment';

  link.href = objectUrl;
  link.download = downloadName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Keep the object URL alive long enough for slower browsers/downloads to
  // consume it before releasing the in-memory blob.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
};

export const openProtectedFile = async ({ resource, recordId, attachment }) => {
  const previewWindow = window.open('about:blank', '_blank');
  if (previewWindow) previewWindow.opener = null;

  try {
    const blob = await fetchProtectedFileBlob({ resource, recordId, attachment });
    const objectUrl = URL.createObjectURL(blob);

    if (!previewWindow) throw new Error('The browser blocked the preview window.');
    previewWindow.location.href = objectUrl;

    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    previewWindow?.close();
    throw error;
  }
};
