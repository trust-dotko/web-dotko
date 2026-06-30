/**
 * /api/storage/download.js — Vercel Serverless Function
 *
 * Mints a SHORT-LIVED (15-min) signed URL for a trade document, but ONLY for a
 * party to the trade (the submitter, the counterparty GSTIN owner, or an admin).
 * This replaces permanent download tokens: leaked Firestore paths are useless
 * without an authenticated, authorized call here.
 *
 * Body: { path: 'trade-documents/{uid}/...', tradeId, companyGSTIN }
 */

import { getStorage } from 'firebase-admin/storage';
import { db, verifyBearer, applySecurityHeaders } from '../_firebaseAdmin.js';

const SIGN_TTL_MS = 15 * 60 * 1000;

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await verifyBearer(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  const uid = decoded.uid;

  const { path, tradeId, companyGSTIN } = req.body || {};
  if (!path || !path.startsWith('trade-documents/')) return res.status(400).json({ error: 'Invalid path' });
  if (!tradeId || !companyGSTIN) return res.status(400).json({ error: 'tradeId and companyGSTIN are required' });

  // Authorize: caller must be a party to the trade that references this file.
  const tradeSnap = await db.collection('companies').doc(String(companyGSTIN).toUpperCase())
    .collection('trades').doc(tradeId).get().catch(() => null);
  if (!tradeSnap?.exists) return res.status(404).json({ error: 'Trade not found' });
  const trade = tradeSnap.data();

  const refs = [...(trade.invoiceUrls || []), ...(trade.ledgerUrls || []),
    ...((trade.verificationResponse && trade.verificationResponse.proofUrls) || [])];
  if (!refs.includes(path)) return res.status(404).json({ error: 'File not part of this trade' });

  const isSubmitter = trade.submittedBy === uid;
  let isCounterparty = false;
  if (!isSubmitter) {
    const userDoc = await db.collection('users').doc(uid).get().catch(() => null);
    const callerGSTIN = (userDoc?.data()?.gst || '').toUpperCase();
    isCounterparty = callerGSTIN && callerGSTIN === String(companyGSTIN).toUpperCase();
  }
  const isAdmin = decoded.admin === true;
  if (!isSubmitter && !isCounterparty && !isAdmin) {
    return res.status(403).json({ error: 'Not authorized to view this document' });
  }

  try {
    const file = getStorage().bucket(process.env.VITE_FIREBASE_STORAGE_BUCKET).file(path);
    const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + SIGN_TTL_MS });
    return res.status(200).json({ success: true, url, expiresInSeconds: SIGN_TTL_MS / 1000 });
  } catch (err) {
    console.error('[storage/download]', err);
    return res.status(500).json({ error: 'Could not generate document link.' });
  }
}
