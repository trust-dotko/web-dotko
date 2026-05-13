/**
 * /api/storage/upload.js — Vercel Serverless Function
 *
 * Proxies file uploads to Firebase Storage using the Admin SDK,
 * bypassing the browser CORS restriction on the storage bucket.
 *
 * Request body (JSON):
 *   { fileBase64: string, contentType: string, userId: string, filename: string }
 * Response:
 *   { success: true, downloadUrl: string }
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';
import { randomUUID } from 'crypto';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '16mb',
    },
  },
};

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID   || process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  });
}

const adminAuth = getAuth();

async function verifyToken(req) {
  const header = req.headers?.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    return await adminAuth.verifyIdToken(header.slice(7));
  } catch {
    return null;
  }
}

const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']);
const MAX_BYTES = 10 * 1024 * 1024;

export default async function handler(req, res) {
  const allowed = process.env.ALLOWED_ORIGIN || 'https://web.dotko.in';
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const { fileBase64, contentType, userId, filename } = req.body || {};

  if (!fileBase64 || !contentType || !userId || !filename)
    return res.status(400).json({ error: 'Missing required fields' });

  if (decoded.uid !== userId)
    return res.status(403).json({ error: 'User ID mismatch' });

  if (!ALLOWED_TYPES.has(contentType))
    return res.status(400).json({ error: 'File type not allowed' });

  const buffer = Buffer.from(fileBase64, 'base64');

  if (buffer.byteLength > MAX_BYTES)
    return res.status(400).json({ error: 'File exceeds 10 MB limit' });

  const storagePath = `trade-documents/${userId}/${filename}`;
  const token = randomUUID();
  const bucket = getStorage().bucket();
  const fileRef = bucket.file(storagePath);

  await fileRef.save(buffer, {
    contentType,
    metadata: {
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  const bucketName = process.env.VITE_FIREBASE_STORAGE_BUCKET;
  const encodedPath = encodeURIComponent(storagePath);
  const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;

  return res.status(200).json({ success: true, downloadUrl });
}
