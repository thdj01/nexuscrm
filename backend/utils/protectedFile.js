'use strict';

const fs = require('fs');
const path = require('path');

const UPLOAD_ROOT = path.resolve(__dirname, '..', 'uploads');

const normalizeStoredPath = (attachment = {}, fallbackDirectory = '') => {
  const rawPath = String(
    attachment.storagePath ||
    (attachment.storedName && fallbackDirectory
      ? `${fallbackDirectory}/${attachment.storedName}`
      : attachment.storedName) ||
    ''
  ).trim();

  // Old records may contain either "uploads/inquiry/file.pdf" or
  // "/uploads/inquiry/file.pdf". Store and resolve only the part beneath the
  // private uploads root.
  return rawPath
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^uploads\//i, '');
};

const attachmentMatchesKey = (attachment, key) => {
  if (!attachment || !key) return false;

  const requested = String(key);
  const candidates = [
    attachment._id,
    attachment.id,
    attachment.storedName,
    attachment.storagePath,
    attachment.storagePath && path.posix.basename(String(attachment.storagePath).replace(/\\/g, '/')),
  ].filter(Boolean).map(String);

  return candidates.includes(requested);
};

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};

const resolveProtectedPath = (attachment, fallbackDirectory = '') => {
  const relativePath = normalizeStoredPath(attachment, fallbackDirectory);
  if (!relativePath) throw createHttpError('Attachment path is missing', 404);

  const absolutePath = path.resolve(UPLOAD_ROOT, relativePath);
  if (
    absolutePath === UPLOAD_ROOT ||
    !absolutePath.startsWith(`${UPLOAD_ROOT}${path.sep}`)
  ) {
    throw createHttpError('Invalid attachment path', 400);
  }

  return absolutePath;
};

const getSafeInlineMimeType = (fileName = '') => {
  const extension = path.extname(fileName).toLowerCase();
  const safeTypes = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.txt': 'text/plain; charset=utf-8',
    '.log': 'text/plain; charset=utf-8',
    '.csv': 'text/plain; charset=utf-8',
    '.json': 'text/plain; charset=utf-8',
    '.xml': 'text/plain; charset=utf-8',
  };

  return safeTypes[extension] || '';
};

const sendProtectedFile = async ({
  req,
  res,
  next,
  attachment,
  fallbackDirectory = '',
}) => {
  try {
    const absolutePath = resolveProtectedPath(attachment, fallbackDirectory);

    let stats;
    try {
      stats = await fs.promises.stat(absolutePath);
    } catch (error) {
      if (error.code === 'ENOENT') throw createHttpError('File not found on server', 404);
      throw error;
    }

    if (!stats.isFile()) throw createHttpError('File not found on server', 404);

    const downloadName = path.basename(
      String(attachment.name || attachment.originalName || attachment.storedName || 'attachment')
    );
    const shouldDownload = String(req.query.download || '') === '1';
    const safeInlineMimeType = getSafeInlineMimeType(downloadName);

    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    if (shouldDownload) {
      return res.download(absolutePath, downloadName, (error) => {
        if (error && !res.headersSent) next(error);
      });
    }

    if (safeInlineMimeType) {
      res.setHeader('Content-Type', safeInlineMimeType);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${downloadName.replace(/["\\\r\n]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`
      );
    } else {
      // Never render arbitrary uploaded HTML, SVG, scripts or unknown formats
      // in the application origin. They are still downloadable.
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${downloadName.replace(/["\\\r\n]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`
      );
    }

    return res.sendFile(absolutePath, (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  UPLOAD_ROOT,
  attachmentMatchesKey,
  getSafeInlineMimeType,
  normalizeStoredPath,
  resolveProtectedPath,
  sendProtectedFile,
};
