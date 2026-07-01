/**
 * /api/storage/upload.js — Vercel Serverless Function (single upload path)
 *
 * The browser's ONLY way to put a file in Storage. Uses the Admin SDK (bypasses
 * Storage rules). Hardened: ID-token auth, magic-byte MIME sniff (not just the
 * client-declared contentType), 3 MB cap, SHA-256 evidence hash, and NO permanent
 * download token. Reads happen later via /api/storage/download.js (short-lived
 * signed URLs, party-checked). We return the storage PATH + hash, never a public
 * URL — so leaked Firestore data can't expose documents.
 */

import { getStorage } from 'firebase-admin/storage';
import crypto from 'crypto';
import { verifyBearer, clientIp, applySecurityHeaders } from '../_firebaseAdmin.js';
import { rateLimit } from '../_rateLimit.js';

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB
const ALLOWED = {
  'application/pdf':  (b) => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46, // %PDF
  'image/png':       (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47, // \x89PNG
  'image/jpeg':      (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,                  // JPEG SOI
};
ALLOWED['image/jpg'] = ALLOWED['image/jpeg'];

function safeName(name = '') {
  const dot = name.lastIndexOf('.');
  const base = (dot > 0 ? name.slice(0, dot) : name).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  return ext ? `${base}.${ext}` : base;
}

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await verifyBearer(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  const uid = decoded.uid;

  const rl = rateLimit(`upload:${clientIp(req)}`, 60, 60 * 60 * 1000);
  if (rl.limited) { res.setHeader('Retry-After', String(rl.retryAfter)); return res.status(429).json({ error: 'Too many uploads. Try again later.' }); }

  const { fileBase64, contentType, filename, sha256 } = req.body || {};
  if (!fileBase64 || !contentType || !filename) return res.status(400).json({ error: 'Missing required fields' });
  if (!ALLOWED[contentType]) return res.status(400).json({ error: 'File type not allowed' });

  let buffer;
  try { buffer = Buffer.from(fileBase64, 'base64'); }
  catch { return res.status(400).json({ error: 'Invalid file encoding' }); }

  if (buffer.byteLength > MAX_BYTES) return res.status(400).json({ error: 'File exceeds 3 MB limit' });
  if (!ALLOWED[contentType](buffer)) return res.status(400).json({ error: 'File content does not match its type' });

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  if (sha256 && sha256 !== hash) return res.status(400).json({ error: 'File integrity check failed' });

  const storagePath = `trade-documents/${uid}/${Date.now()}_${safeName(filename)}`;
  try {
    const file = getStorage().bucket(process.env.VITE_FIREBASE_STORAGE_BUCKET).file(storagePath);
    await file.save(buffer, {
      contentType,
      resumable: false,
      metadata: { metadata: { uploadedBy: uid, sha256: hash } }, // NOTE: no firebaseStorageDownloadTokens
    });
    return res.status(200).json({ success: true, path: storagePath, hash });
  } catch (err) {
    console.error('[storage/upload]', err);
    return res.status(500).json({ error: 'Upload failed. Please try again.' });
  }
}
