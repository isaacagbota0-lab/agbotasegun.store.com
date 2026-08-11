'use strict';

/**
 * Upload handling: memory-buffered uploads with strict validation —
 * declared MIME type must be on the allow-list AND the file's magic bytes
 * must match. Files are written to ./data/uploads with server-generated
 * names and served only through the authorized /api/files route.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const cfg = require('./config');

const ALLOWED = {
  image: {
    mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
    ext: { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' },
  },
  document: {
    mimes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/zip',
    ],
    ext: {
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'application/vnd.ms-powerpoint': '.ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
      'text/plain': '.txt',
      'text/markdown': '.md',
      'text/csv': '.csv',
      'application/zip': '.zip',
    },
  },
  voice: {
    mimes: ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/aac', 'audio/x-m4a', 'audio/mp3'],
    ext: {
      'audio/webm': '.webm',
      'audio/mp4': '.m4a',
      'audio/mpeg': '.mp3',
      'audio/ogg': '.ogg',
      'audio/wav': '.wav',
      'audio/x-wav': '.wav',
      'audio/aac': '.aac',
      'audio/x-m4a': '.m4a',
      'audio/mp3': '.mp3',
    },
  },
};

/** Minimal magic-byte sniffing for the types we accept. */
function sniffMime(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.toString('ascii', 0, 3) === 'GIF') return 'image/gif';
  if (buf.toString('ascii', 0, 4) === '%PDF') return 'application/pdf';
  if (buf.toString('ascii', 0, 4) === 'OggS') return 'audio/ogg';
  if (buf.toString('ascii', 0, 3) === 'ID3') return 'audio/mpeg';
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'audio/webm'; // EBML (webm)
  if (buf.toString('ascii', 4, 8) === 'ftyp') return 'audio/mp4';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE') return 'audio/wav';
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: cfg.maxUploadBytes, files: 1 },
});

function bucketFor(type) {
  if (type === 'image') return ALLOWED.image;
  if (type === 'voice') return ALLOWED.voice;
  return ALLOWED.document; // 'document' and receipt fallback
}

/**
 * Validate and persist an uploaded file. `type` is one of image|document|voice.
 * `ref` links the file to its database record so access checks can be made:
 *   { kind: 'm', id: <messageId> }  → /api/files/m/<messageId>
 *   { kind: 'p', id: <paymentId> }  → /api/files/p/<paymentId>
 * Returns { url, name, size, mime } or throws a friendly HttpError.
 */
function saveUpload(file, type, ref) {
  const bucket = bucketFor(type);
  if (!file) throw httpError(400, 'No file was uploaded.');
  if (!bucket.mimes.includes(file.mimetype)) {
    throw httpError(400, `File type "${file.mimetype || 'unknown'}" is not allowed here.`);
  }
  const sniffed = sniffMime(file.buffer);
  if (!sniffed || sniffed !== file.mimetype) {
    throw httpError(400, 'The file contents do not match its declared type. Upload was rejected.');
  }
  if (file.size > cfg.maxUploadBytes) {
    throw httpError(400, `File is too large. Maximum size is ${Math.round(cfg.maxUploadBytes / 1024 / 1024)} MB.`);
  }
  const kind = (ref && ref.kind) || 'm';
  const id = (ref && ref.id) || crypto.randomUUID();
  const filename = id + bucket.ext[file.mimetype];
  const dest = path.join(cfg.uploadsDir, filename);
  fs.writeFileSync(dest, file.buffer);
  return { url: `/api/files/${kind}/${id}`, name: file.originalname || filename, size: file.size, mime: file.mimetype };
}

function deleteUpload(url) {
  if (!url || !url.startsWith('/api/files/')) return;
  const id = url.split('/').pop();
  fs.readdirSync(cfg.uploadsDir).forEach((f) => {
    if (f.startsWith(id + '.')) {
      try { fs.unlinkSync(path.join(cfg.uploadsDir, f)); } catch (_) { /* ignore */ }
    }
  });
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = { upload, saveUpload, deleteUpload, httpError, sniffMime, ALLOWED };
