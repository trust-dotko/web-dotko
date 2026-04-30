/**
 * /api/gst-otp.js — Vercel Serverless Function
 *
 * Sends GST OTP via Sandbox API.
 * Checks Firestore to prevent duplicate GST registrations.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { rateLimit } from '../_rateLimit.js';

// Initialize Firebase Admin (reuse across warm invocations)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

const SANDBOX_API_BASE = 'https://api.sandbox.co.in';
const SANDBOX_TEST_API_BASE = 'https://test-api.sandbox.co.in';

// Module-level token cache (persists across warm invocations)
let cachedToken = null;
let tokenExpiry = null;

function getBaseURL() {
  return process.env.GST_USE_TEST_API === 'true'
    ? SANDBOX_TEST_API_BASE
    : SANDBOX_API_BASE;
}

function getCredentials() {
  const useTest = process.env.GST_USE_TEST_API === 'true';
  return {
    apiKey: useTest ? process.env.GST_TEST_API_KEY : process.env.GST_API_KEY,
    apiSecret: useTest ? process.env.GST_TEST_API_SECRET : process.env.GST_API_SECRET,
  };
}

async function authenticate() {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const { apiKey, apiSecret } = getCredentials();
  const base = getBaseURL();

  const res = await fetch(`${base}/authenticate`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'x-api-secret': apiSecret,
      'x-api-version': '1.0',
    },
  });

  if (!res.ok) {
    throw new Error(`Sandbox auth failed: ${res.status}`);
  }

  const data = await res.json();

  if (data.code === 200 && data.data?.access_token) {
    cachedToken = data.data.access_token;
    tokenExpiry = Date.now() + 23 * 60 * 60 * 1000; // 23h
    return cachedToken;
  }

  throw new Error('Failed to get Sandbox access token');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const origin = req.headers.origin || '';
  const allowed = process.env.ALLOWED_ORIGIN || 'https://web.dotko.in';
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const rl = rateLimit(`otp:${ip}`, 3, 10 * 60 * 1000);
  if (rl.limited) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });
  }

  const { gstin, username, phone } = req.body || {};

  if (!gstin || typeof gstin !== 'string') {
    return res.status(400).json({ success: false, error: 'GSTIN is required' });
  }
  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ success: false, error: 'GST portal username is required' });
  }

  const clean = gstin.trim().toUpperCase();

  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(clean)) {
    return res.status(400).json({ success: false, error: 'Invalid GSTIN format' });
  }

  // Check Firestore: reject if GST already registered
  try {
    const snapshot = await db.collection('users').where('gst', '==', clean).limit(1).get();
    if (!snapshot.empty) {
      return res.status(409).json({
        success: false,
        error: 'An account already exists for this GST number. Please sign in.',
      });
    }
  } catch (err) {
    console.error('Firestore GST check error:', err);
    return res.status(500).json({ success: false, error: 'Database check failed' });
  }

  try {
    const token = await authenticate();
    const { apiKey } = getCredentials();
    const base = getBaseURL();

    // Correct endpoint: /gst/compliance/tax-payer/otp (hyphenated)
    // Requires both gstin and gst portal username in body
    const apiRes = await fetch(`${base}/gst/compliance/tax-payer/otp`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'x-api-key': apiKey,
        'x-api-version': '1.0.0',
        'x-source': 'primary',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ gstin: clean, username: username.trim() }),
    });

    const data = await apiRes.json();

    if (data.code === 200) {
      return res.status(200).json({ success: true, refId: data.data?.ref_id });
    }

    return res.status(502).json({
      success: false,
      error: data.message || 'OTP generation failed',
    });
  } catch (err) {
    console.error('GST OTP error:', err);
    return res.status(500).json({
      success: false,
      error: 'OTP service temporarily unavailable',
    });
  }
}
