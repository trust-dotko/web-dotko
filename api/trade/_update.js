/**
 * /api/trade/update.js — Vercel Serverless Function
 *
 * Submitter-only updates to a trade they filed (status changes + "settle").
 * Server-authoritative: the client cannot write trade docs directly.
 *
 * Body: { tradeId, companyGSTIN, action: 'status'|'settle', status? }
 *   - 'status': change the trade status (re-opens / closes the appeal window if
 *               the status crosses the default boundary).
 *   - 'settle': creditor confirms payment received → status 'Paid Late',
 *               appealStatus 'settled', penalty released, score restored.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { db, verifyBearer, applySecurityHeaders } from '../_firebaseAdmin.js';
import { notifyWhatsAppTradeEvent } from '../_whatsapp.js';

const VALID_STATUSES = [
  'Paid on Time', 'Paid Late', 'Partially Paid', 'Default/Written Off',
  'Disputed', 'Still Pending',
];
const APPEAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const isDefaultStatus = (s) => s === 'Default/Written Off' || s === 'Unpaid';

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await verifyBearer(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  const uid = decoded.uid;

  const { tradeId, companyGSTIN, action = 'status', status } = req.body || {};
  if (!tradeId || !companyGSTIN) return res.status(400).json({ error: 'tradeId and companyGSTIN are required' });
  if (action === 'status' && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const cleanGSTIN = String(companyGSTIN).trim().toUpperCase();
  const tradeRef   = db.collection('companies').doc(cleanGSTIN).collection('trades').doc(tradeId);
  const snap       = await tradeRef.get();
  if (!snap.exists) return res.status(404).json({ error: 'Trade not found' });
  const trade = snap.data();

  if (trade.submittedBy !== uid) {
    return res.status(403).json({ error: 'Only the submitter can update this trade.' });
  }

  const now = FieldValue.serverTimestamp();
  let update;
  let event = null;

  if (action === 'settle') {
    update = {
      status: 'Paid Late',
      appealStatus: 'settled',
      verificationStatus: 'verified',
      settledAt: now,
      updatedAt: now,
    };
    event = 'settled';
  } else {
    const becomesDefault = isDefaultStatus(status);
    const wasDefault     = isDefaultStatus(trade.status);
    update = { status, updatedAt: now };
    if (becomesDefault && !wasDefault) {
      // Status escalated to a default → open a fresh appeal window.
      update.appealStatus = 'open';
      update.verificationStatus = 'pending_verification';
      update.verificationDeadline = new Date(Date.now() + APPEAL_WINDOW_MS);
      update.verificationResponse = null;
    } else if (!becomesDefault && wasDefault) {
      // De-escalated away from default → close the appeal flow.
      update.appealStatus = 'settled';
    }
  }

  try {
    const batch = db.batch();
    batch.update(tradeRef, update);
    batch.set(db.collection('users').doc(uid).collection('submittedTrades').doc(tradeId), update, { merge: true });
    batch.set(db.collection('reports').doc(tradeId), { updatedAt: now, ...(update.status ? { status: ({
      'Paid on Time': 'resolved', 'Paid Late': 'resolved', 'Partially Paid': 'under_discussion',
      'Default/Written Off': 'published', 'Disputed': 'published', 'Still Pending': 'pending',
    })[update.status] || 'pending' } : {}) }, { merge: true });
    await batch.commit();

    // Notify the counterparty if registered.
    try {
      const cpSnap = await db.collection('users').where('gst', '==', cleanGSTIN).limit(1).get();
      if (!cpSnap.empty) {
        const cp = cpSnap.docs[0];
        await db.collection('notifications').add({
          recipientId: cp.id,
          recipientGSTIN: cleanGSTIN,
          type: event === 'settled' ? 'trade_settled' : 'trade_updated',
          title: event === 'settled' ? 'Trade marked as settled' : 'Trade status updated',
          message: event === 'settled'
            ? `${trade.submitterName || 'The supplier'} marked your ₹${(trade.tradeValue || 0).toLocaleString('en-IN')} trade as settled. Your trust score is restored.`
            : `${trade.submitterName || 'The supplier'} updated a trade on your GSTIN to "${update.status}".`,
          tradeId, read: false, createdAt: now, updatedAt: now,
        });
        if (event === 'settled' && cp.data().mobileNumber) {
          await notifyWhatsAppTradeEvent(cp.data().mobileNumber, 'settled',
            [`₹${(trade.tradeValue || 0).toLocaleString('en-IN')}`, trade.submitterName || 'the supplier']);
        }
      }
    } catch { /* best-effort */ }

    return res.status(200).json({ success: true, status: update.status, appealStatus: update.appealStatus });
  } catch (err) {
    console.error('[trade/update]', err);
    return res.status(500).json({ error: 'Failed to update the trade.' });
  }
}
