'use strict';

const fs = require('fs');
const path = require('path');
const multer = require('multer');

const USERS_UPLOAD_FOLDER = 'users';
const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
const AVATAR_UPLOAD_DIR = path.join(UPLOAD_ROOT, USERS_UPLOAD_FOLDER);

fs.mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const getSafeExtension = (file = {}) => {
  const extension = path.extname(file.originalname || '').toLowerCase();
  return ALLOWED_EXTENSIONS.has(extension) ? extension : '.jpg';
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const uniquePart = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `avatar-${uniquePart}${getSafeExtension(file)}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
    return;
  }

  const error = new Error('Only JPG, PNG, WEBP, or GIF profile photos are allowed');
  error.statusCode = 400;
  cb(error, false);
};

const avatarUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

const buildUploadedAvatarPath = (file) => {
  if (!file?.filename) return '';
  return `/uploads/${USERS_UPLOAD_FOLDER}/${file.filename}`;
};

const deleteLocalUploadByUrl = async (avatarUrl = '') => {
  if (!avatarUrl || !avatarUrl.startsWith(`/uploads/${USERS_UPLOAD_FOLDER}/`)) return;

  const filename = path.basename(avatarUrl);
  const absolutePath = path.join(AVATAR_UPLOAD_DIR, filename);

  if (!absolutePath.startsWith(AVATAR_UPLOAD_DIR)) return;

  try {
    await fs.promises.unlink(absolutePath);
  } catch {
    // Ignore missing files. Avatar cleanup must never break profile saving.
  }
};

module.exports = {
  avatarUpload,
  buildUploadedAvatarPath,
  deleteLocalUploadByUrl,
};
