import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Eye, FileText, Trash2, UploadCloud } from 'lucide-react';
import { uploadProjectDocuments } from '../../api/projectService';
import { downloadProtectedFile } from '../../api/protectedFileService';
import { useToast } from '../../context/ToastContext';

const formatBytes = (bytes = 0) => {
  const size = Number(bytes || 0);
  if (!size) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatUploadDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getUploaderName = (doc = {}) => (
  doc.uploadedBy?.name || doc.uploadedBy?.email || '—'
);

const getDocumentPreviewKey = (doc = {}) => (
  doc._id || doc.id || doc.storagePath || doc.storedName || doc.name || ''
);

const ProjectDocumentAttachments = ({ projectId, documents = [], pendingDocuments = [], onPendingDocumentsChange, onChanged, readOnly = false }) => {
  const [items, setItems] = useState(Array.isArray(documents) ? documents : []);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    setItems(Array.isArray(documents) ? documents : []);
  }, [documents]);

  const canUpload = !readOnly;
  const sortedDocuments = useMemo(() => (
    [...items].sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0))
  ), [items]);
  const pendingList = Array.isArray(pendingDocuments) ? pendingDocuments : [];

  const applyProject = (project) => {
    const nextDocs = Array.isArray(project?.documents) ? project.documents : [];
    setItems(nextDocs);
    onChanged?.(project);
  };

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length || !canUpload) return;

    if (!projectId) {
      const nextPending = [...pendingList, ...files];
      onPendingDocumentsChange?.(nextPending);
      toast.success(`${files.length} document${files.length > 1 ? 's' : ''} added. They will upload after project creation.`);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    try {
      setUploading(true);
      const project = await uploadProjectDocuments(projectId, files);
      applyProject(project);
      toast.success(`${files.length} document${files.length > 1 ? 's' : ''} uploaded`);
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || 'Document upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handlePendingDelete = (indexToRemove) => {
    if (readOnly) return;
    onPendingDocumentsChange?.(pendingList.filter((_, index) => index !== indexToRemove));
  };

  const openDocumentPreview = (doc) => {
    if (!projectId) {
      toast.error('Please save the project before previewing uploaded documents.');
      return;
    }

    const documentKey = getDocumentPreviewKey(doc);
    if (!documentKey) {
      toast.error('Document preview key is missing.');
      return;
    }

    navigate(`/projects/${projectId}/documents/preview?doc=${encodeURIComponent(documentKey)}`);
  };

  const downloadDocument = async (doc) => {
    try {
      await downloadProtectedFile({
        resource: 'projects',
        recordId: projectId,
        attachment: doc,
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || 'Document download failed');
    }
  };

  return (
    <section className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-gray-200 bg-white p-3 space-y-4 sm:p-4">
      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">3. Document Attachment</h3>
          <p className="text-xs text-gray-400">Drag and drop documents or browse files. Uploaded files stay linked with this project.</p>
        </div>
        <span className="text-xs font-medium text-gray-500">{items.length + pendingList.length} file{items.length + pendingList.length !== 1 ? 's' : ''}</span>
      </div>

      <div
        role="button"
        tabIndex={0}
        onDragOver={(event) => {
          event.preventDefault();
          if (canUpload) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          handleFiles(event.dataTransfer.files);
        }}
        onClick={() => canUpload && inputRef.current?.click()}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && canUpload) inputRef.current?.click();
        }}
        className={`flex min-h-[120px] min-w-0 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-colors sm:p-6 ${dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/60'} ${!canUpload ? 'cursor-not-allowed opacity-70' : ''}`}
      >
        <UploadCloud className="mb-2 text-blue-500" size={28} />
        <p className="text-sm font-semibold text-gray-700">
          {uploading ? 'Uploading documents…' : 'Drop documents here or click to browse'}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          {projectId
            ? 'PDF, Word, Excel, images, ZIP and other project files are supported up to 25 MB each.'
            : 'Files selected now will upload automatically after the project is created.'}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          disabled={!canUpload || uploading}
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>

      <div className="w-full min-w-0 max-w-full overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full min-w-[680px] sm:min-w-[760px] text-left text-xs">
          <thead className="bg-slate-800 text-white">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Document Name</th>
              <th className="px-3 py-2.5 font-semibold w-32">Upload Date</th>
              <th className="px-3 py-2.5 font-semibold w-40">Uploaded By</th>
              <th className="px-3 py-2.5 font-semibold w-24">Size</th>
              <th className="px-3 py-2.5 font-semibold w-36 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedDocuments.length === 0 && pendingList.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-400">No documents uploaded yet.</td>
              </tr>
            ) : (
              <>
                {pendingList.map((file, index) => (
                  <tr key={`pending-${file.name}-${file.size}-${index}`} className="border-t border-blue-100 bg-blue-50/50">
                    <td className="px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2 font-medium text-gray-700">
                        <FileText size={15} className="text-blue-500" />
                        <span className="min-w-0 truncate">{file.name}</span>
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Pending upload</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">After save</td>
                    <td className="px-3 py-2.5 text-gray-600">Current user</td>
                    <td className="px-3 py-2.5 text-gray-500">{formatBytes(file.size)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-2">
                        {!readOnly && (
                          <button type="button" onClick={() => handlePendingDelete(index)} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50" title="Remove pending file">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {sortedDocuments.map((doc) => {
                  const hasFileReference = Boolean(doc.storedName || doc.storagePath);
                  return (
                    <tr key={doc.storedName || doc.storagePath || doc.name} className="border-t border-gray-100">
                      <td className="px-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-2 font-medium text-gray-700">
                          <FileText size={15} className="text-blue-500" />
                          <span className="min-w-0 truncate">{doc.name || doc.storedName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">{formatUploadDate(doc.uploadedAt)}</td>
                      <td className="px-3 py-2.5 text-gray-600">{getUploaderName(doc)}</td>
                      <td className="px-3 py-2.5 text-gray-500">{formatBytes(doc.sizeBytes)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-2">
                          {hasFileReference && (
                            <>
                              <button type="button" onClick={() => openDocumentPreview(doc)} className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50" title="View">
                                <Eye size={15} />
                              </button>
                              <button type="button" onClick={() => downloadDocument(doc)} className="rounded-lg p-1.5 text-green-600 hover:bg-green-50" title="Download">
                                <Download size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default ProjectDocumentAttachments;
