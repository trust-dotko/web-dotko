// web/api/_firebaseAdmin.js
//
// Shared Firebase Admin singleton + request helpers for all serverless functions.
// Admin SDK writes bypass Firestore security rules, so every privileged write
// (profiles, OTP records, custom tokens) is funneled through here — the browser
// never holds Admin credentials and never writes trust-sensitive data directly.

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

export const db = getFirestore();
export const adminAuth = getAuth();

/** Verify the `Authorization: Bearer <idToken>` header. Returns decoded token or null. */
export async function verifyBearer(req) {
  const header = req.headers?.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    return await adminAuth.verifyIdToken(header.slice(7));
  } catch {
    return null;
  }
}

/** Best-effort client IP for rate limiting. */
export function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
}

/** Standard CORS + hardening headers, matching the existing /api/auth/* endpoints. */
export function applySecurityHeaders(res) {
  const allowed = process.env.ALLOWED_ORIGIN || 'https://web.dotko.in';
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
