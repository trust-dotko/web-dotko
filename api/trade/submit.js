/**
 * /api/trade/submit.js — Vercel Serverless Function (AUTHORITATIVE TRADE WRITER)
 *
 * Security model: the browser NEVER writes score-affecting data. This endpoint is
 * the single writer of trades/companies/reports — using the Admin SDK, which
 * bypasses Firestore rules (the rules deny all client writes to those paths).
 * That makes submittedBy / submitterGSTIN / amounts / verificationStatus
 * impossible to spoof from the client.
 *
 * Flow:
 *   1. Verify Firebase ID token.
 *   2. Persistent rate-limit per (submitter, target GSTIN) + daily report-bomb cap.
 *   3. Validate payload; derive submitter identity SERVER-SIDE from the profile.
 *   4. Write: companies/{gst} (merge), companies/{gst}/trades/{id},
 *      users/{uid}/submittedTrades/{id}, reports/{id} (admin portal), notification.
 *   5. Best-effort WhatsApp to a registered counterparty (never blocks the write).
 */

import { FieldValue } from 'firebase-admin/firestore';
import { db, adminAuth, verifyBearer, clientIp, applySecurityHeaders } from '../_firebaseAdmin.js';
import { rateLimit } from '../_rateLimit.js';
import { rateLimitStore } from '../_rateLimitStore.js';
import { notifyWhatsAppTradeEvent } from '../_whatsapp.js';

const VALID_STATUSES = [
  'Paid on Time', 'Paid Late', 'Partially Paid', 'Default/Written Off',
  'Disputed', 'Still Pending',
  'Paid', 'Delayed', 'Unpaid', // legacy
];
const VALID_TRADE_TYPES = ['Sale', 'Purchase', 'Service Provided', 'Service Received'];
const APPEAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function isValidGSTIN(g = '') {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(g.trim().toUpperCase());
}
function isDefaultStatus(s) {
  return s === 'Default/Written Off' || s === 'Unpaid';
}
function mapTradeStatusToReportStatus(s) {
  return ({ 'Paid on Time': 'resolved', 'Paid Late': 'resolved', 'Partially Paid': 'under_discussion',
    'Default/Written Off': 'published', 'Disputed': 'published', 'Still Pending': 'pending' })[s] || 'pending';
}
function mapTradeTypeToComplaintType(t) {
  return ({ Sale: 'Payment Issue', Purchase: 'Payment Issue',
    'Service Provided': 'Service Issue', 'Service Received': 'Service Issue' })[t] || 'Payment Issue';
}

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await verifyBearer(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  const uid = decoded.uid;

  const body = req.body || {};
  const cleanGSTIN = String(body.counterpartyGSTIN || '').trim().toUpperCase();

  // ── Validation ─────────────────────────────────────────────────────────────
  const errors = {};
  if (!isValidGSTIN(cleanGSTIN)) errors.counterpartyGSTIN = 'Valid 15-character GSTIN required';
  if (!VALID_TRADE_TYPES.includes(body.tradeType)) errors.tradeType = 'Invalid trade type';
  if (!(Number(body.tradeValue) > 0)) errors.tradeValue = 'tradeValue must be positive';
  if (!(Number(body.creditPeriod) > 0)) errors.creditPeriod = 'creditPeriod must be positive';
  if (!body.invoiceDate) errors.invoiceDate = 'invoiceDate is required';
  if (!VALID_STATUSES.includes(body.status)) errors.status = 'Invalid status';
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Validation failed', fields: errors });

  // ── Rate limiting (abuse / report-bombing) ──────────────────────────────────
  const ipRl = rateLimit(`trade-ip:${clientIp(req)}`, 30, 60 * 60 * 1000);
  if (ipRl.limited) { res.setHeader('Retry-After', String(ipRl.retryAfter)); return res.status(429).json({ error: 'Too many requests. Try again later.' }); }
  const pairRl = await rateLimitStore(`trade:${uid}:${cleanGSTIN}`, 5, 24 * 60 * 60 * 1000);
  if (pairRl.limited) { res.setHeader('Retry-After', String(pairRl.retryAfter)); return res.status(429).json({ error: 'You have filed several trades against this GSTIN recently. Please try again later.' }); }
  const dailyRl = await rateLimitStore(`trade-daily:${uid}`, 25, 24 * 60 * 60 * 1000);
  if (dailyRl.limited) { res.setHeader('Retry-After', String(dailyRl.retryAfter)); return res.status(429).json({ error: 'Daily trade-submission limit reached.' }); }

  // ── Submitter identity (SERVER-AUTHORITATIVE, from profile — never trusted from client) ──
  const submitterDoc = await db.collection('users').doc(uid).get().catch(() => null);
  const submitter = submitterDoc?.data() || {};
  const submitterGSTIN = String(submitter.gst || '').trim().toUpperCase();
  const submitterName  = String(submitter.businessName || submitter.legalName || '').trim();
  if (!submitterGSTIN || !isValidGSTIN(submitterGSTIN)) {
    return res.status(403).json({ error: 'Complete your business profile before filing a trade.' });
  }
  if (submitterGSTIN === cleanGSTIN) {
    return res.status(400).json({ error: 'You cannot file a trade against your own GSTIN.' });
  }

  const isDefault = isDefaultStatus(body.status);
  const now = FieldValue.serverTimestamp();
  const deadline = new Date(Date.now() + APPEAL_WINDOW_MS);

  const trade = {
    counterpartyGSTIN:    cleanGSTIN,
    counterpartyName:     String(body.counterpartyName || '').trim(),
    tradeType:            body.tradeType,
    invoiceNumber:        String(body.invoiceNumber || '').trim(),
    tradeValue:           Number(body.tradeValue),
    creditPeriod:         Number(body.creditPeriod),
    invoiceDate:          body.invoiceDate,
    paymentDueDate:       body.paymentDueDate || '',
    status:               body.status,
    intent:               isDefault ? 'report' : 'trade',
    submittedBy:          uid,                 // server-set
    submitterGSTIN,                            // server-set
    submitterName,                             // server-set
    invoiceUrls:          Array.isArray(body.invoiceUrls) ? body.invoiceUrls.slice(0, 5) : [],
    ledgerUrls:           Array.isArray(body.ledgerUrls)  ? body.ledgerUrls.slice(0, 5)  : [],
    fileHashes:           Array.isArray(body.fileHashes)  ? body.fileHashes.slice(0, 10) : [],
    // Appeal / verification state machine
    appealStatus:         isDefault ? 'open' : 'none',
    verificationStatus:   'pending_verification',
    verificationDeadline: deadline,
    verificationResponse: null,
    createdAt:            now,
    updatedAt:            now,
  };

  try {
    const tradeRef = db.collection('companies').doc(cleanGSTIN).collection('trades').doc();
    const tradeId  = tradeRef.id;

    const batch = db.batch();
    batch.set(db.collection('companies').doc(cleanGSTIN),
      { gst: cleanGSTIN, name: trade.counterpartyName || cleanGSTIN, updatedAt: now }, { merge: true });
    batch.set(tradeRef, trade);
    batch.set(db.collection('users').doc(uid).collection('submittedTrades').doc(tradeId),
      { ...trade, companyTradeId: tradeId });
    batch.set(db.collection('reports').doc(tradeId), {
      tradeId,
      customerName:         trade.counterpartyName || cleanGSTIN,
      customerGSTIN:        cleanGSTIN,
      supplierBusinessName: submitterName,
      supplierGSTIN:        submitterGSTIN,
      supplierId:           uid,
      amount:               trade.tradeValue,
      invoiceNumber:        trade.invoiceNumber,
      status:               mapTradeStatusToReportStatus(trade.status),
      typeOfComplaint:      mapTradeTypeToComplaintType(trade.tradeType),
      appealDeadline:       deadline,
      createdAt:            now,
      updatedAt:            now,
    });
    await batch.commit();

    // ── Notify the counterparty (in-app always; WhatsApp if registered) ────────
    let recipientId = null, recipientPhone = null, recipientEmail = '';
    try {
      const cpSnap = await db.collection('users').where('gst', '==', cleanGSTIN).limit(1).get();
      if (!cpSnap.empty) {
        const cp = cpSnap.docs[0];
        recipientId    = cp.id;
        recipientPhone = cp.data().mobileNumber || null;
        recipientEmail = cp.data().email || '';
      }
    } catch { /* best-effort */ }

    const amountStr = `₹${trade.tradeValue.toLocaleString('en-IN')}`;
    await db.collection('notifications').add({
      ...(recipientId ? { recipientId } : {}),
      recipientGSTIN: cleanGSTIN,
      recipientEmail,
      type:    isDefault ? 'default_reported' : 'trade_filed',
      title:   isDefault ? 'Payment default reported' : 'New trade report filed',
      message: isDefault
        ? `A default of ${amountStr} was reported against your GSTIN by ${submitterName || 'a verified business'}. You have 7 days to appeal or settle before it impacts your trust score.`
        : `${submitterName || 'A verified business'} recorded a ${amountStr} trade with your GSTIN.`,
      tradeId, submitterGSTIN, read: false, createdAt: now, updatedAt: now,
    });

    if (isDefault && recipientPhone) {
      await notifyWhatsAppTradeEvent(recipientPhone, 'report_filed',
        [trade.counterpartyName || cleanGSTIN, amountStr, submitterName || 'a verified business']);
    }

    return res.status(200).json({
      success: true,
      trade: { id: tradeId, ...trade, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), verificationDeadline: deadline.toISOString() },
    });
  } catch (err) {
    console.error('[trade/submit]', err);
    return res.status(500).json({ error: 'Failed to record the trade. Please try again.' });
  }
}
