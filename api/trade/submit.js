/**
 * /api/trade/submit.js — Vercel Serverless Function
 *
 * Called after the client has already written the trade to Firestore.
 * This function's sole job is to create the in-app notification for the
 * counterparty (requires Admin SDK to look up their email by GSTIN).
 *
 *  1. Verifies Firebase ID token
 *  2. Validates minimal required fields
 *  3. Looks up counterparty user by GSTIN to find recipientEmail
 *  4. Writes to notifications collection
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { rateLimit } from '../_rateLimit.js';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

const db        = getFirestore();
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

const VALID_STATUSES = [
  'Paid on Time',
  'Paid Late',
  'Partially Paid',
  'Default/Written Off',
  'Disputed',
  'Still Pending',
  // legacy statuses kept for backward compat
  'Paid',
  'Delayed',
  'Unpaid',
];

const VALID_TRADE_TYPES = ['Sale', 'Purchase', 'Service Provided', 'Service Received'];

function isValidGSTIN(gstin = '') {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(
    gstin.trim().toUpperCase()
  );
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowed = process.env.ALLOWED_ORIGIN || 'https://web.dotko.in';
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const rl = rateLimit(`trade:${ip}`, 30, 60 * 60 * 1000);
  if (rl.limited) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });
  }

  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const uid  = decoded.uid;
  const body = req.body || {};

  // --- Validation ---
  const {
    counterpartyGSTIN,
    counterpartyName,
    tradeType,
    invoiceNumber,
    tradeValue,
    creditPeriod,
    invoiceDate,
    paymentDueDate,
    status,
    submitterGSTIN,
    submitterName,
  } = body;

  const errors = {};
  if (!counterpartyGSTIN || !isValidGSTIN(counterpartyGSTIN))
    errors.counterpartyGSTIN = 'Valid 15-character GSTIN required';
  if (!tradeType || !VALID_TRADE_TYPES.includes(tradeType))
    errors.tradeType = `tradeType must be one of: ${VALID_TRADE_TYPES.join(', ')}`;
  if (!tradeValue || Number(tradeValue) <= 0)
    errors.tradeValue = 'tradeValue must be a positive number';
  if (!creditPeriod || Number(creditPeriod) <= 0)
    errors.creditPeriod = 'creditPeriod must be a positive number';
  if (!invoiceDate)
    errors.invoiceDate = 'invoiceDate is required';
  if (!status || !VALID_STATUSES.includes(status))
    errors.status = `status must be one of: ${VALID_STATUSES.join(', ')}`;

  if (Object.keys(errors).length > 0)
    return res.status(400).json({ error: 'Validation failed', fields: errors });

  const cleanGSTIN = counterpartyGSTIN.trim().toUpperCase();
  const now        = FieldValue.serverTimestamp();

  const tradePayload = {
    counterpartyGSTIN:  cleanGSTIN,
    counterpartyName:   (counterpartyName || '').trim(),
    tradeType,
    invoiceNumber:      (invoiceNumber || '').trim(),
    tradeValue:         Number(tradeValue),
    creditPeriod:       Number(creditPeriod),
    invoiceDate,
    paymentDueDate:     paymentDueDate || '',
    status,
    submittedBy:        uid,
    submitterGSTIN:     (submitterGSTIN || '').trim().toUpperCase(),
    submitterName:      (submitterName || '').trim(),
    createdAt:          now,
    updatedAt:          now,
  };

  // The tradeId is sent by the client after it has already written to Firestore
  const tradeId = body.tradeId || '';

  try {
    // Look up counterparty's email by GSTIN for the notification
    let recipientEmail = '';
    try {
      const usersSnap = await db
        .collection('users')
        .where('gst', '==', cleanGSTIN)
        .limit(1)
        .get();
      if (!usersSnap.empty) {
        recipientEmail = usersSnap.docs[0].data().email || '';
      }
    } catch {
      // Best-effort lookup
    }

    await db.collection('notifications').add({
      recipientGSTIN:  cleanGSTIN,
      recipientEmail,
      type:            'trade_filed',
      title:           'New Trade Report Filed',
      message:         `A trade report (${tradeType}, ₹${Number(tradeValue).toLocaleString('en-IN')}) has been filed against your GSTIN by ${(submitterName || 'a verified business')}.`,
      tradeId,
      submitterGSTIN:  (submitterGSTIN || '').trim().toUpperCase(),
      read:            false,
      createdAt:       now,
      updatedAt:       now,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[trade/submit] Notification error:', err);
    return res.status(500).json({ error: 'Failed to create notification.' });
  }
}
