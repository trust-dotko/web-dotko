/**
 * /api/trade/verify.js — Vercel Serverless Function
 *
 * Called when a counterparty confirms or disputes a trade filed against them.
 *
 *  1. Verifies Firebase ID token
 *  2. Validates caller's GSTIN matches the trade's counterpartyGSTIN
 *  3. Updates verificationStatus on the trade document
 *  4. Sends notification to the original submitter
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { notifyWhatsAppTradeEvent } from '../_whatsapp.js';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth
  const authHeader = req.headers.authorization || '';
  const token      = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid auth token' });
  }

  const { tradeId, companyGSTIN, notes, proofUrls } = req.body || {};
  // 'appeal' is the new label; 'dispute' kept as a backward-compatible alias.
  const action = req.body?.action === 'dispute' ? 'appeal' : req.body?.action;

  if (!tradeId || !companyGSTIN || !['confirm', 'appeal'].includes(action)) {
    return res.status(400).json({ error: 'tradeId, companyGSTIN, and action (confirm|appeal) are required' });
  }

  // Load the trade
  const tradeRef  = db.collection('companies').doc(companyGSTIN).collection('trades').doc(tradeId);
  const tradeSnap = await tradeRef.get();
  if (!tradeSnap.exists) return res.status(404).json({ error: 'Trade not found' });

  const trade = tradeSnap.data();

  // Verify the caller's GSTIN matches the counterparty on the trade
  // The caller's GSTIN is stored on their user profile
  const userRecord = await adminAuth.getUser(decoded.uid).catch(() => null);
  if (!userRecord) return res.status(403).json({ error: 'User not found' });

  // Look up caller's GSTIN from their Firestore profile
  const userDoc = await db.collection('users').doc(decoded.uid).get().catch(() => null);
  const callerGSTIN = userDoc?.data()?.gst || '';

  if (callerGSTIN.toUpperCase() !== companyGSTIN.toUpperCase()) {
    return res.status(403).json({ error: 'You are not authorised to respond to this trade' });
  }

  if (['verified', 'disputed'].includes(trade.verificationStatus) ||
      ['appealed', 'settled', 'confirmed'].includes(trade.appealStatus)) {
    return res.status(409).json({ error: 'This trade has already been responded to' });
  }

  // Build update payload.
  //  • confirm → counterparty acknowledges the report. For a default this is a
  //    `confirmed` terminal state (full penalty + Critical); for a normal trade
  //    it just marks the record verified.
  //  • appeal  → counterparty contests with proof. The penalty is HELD while the
  //    7-day window runs (appealStatus 'appealed'); on expiry the engine locks it
  //    to 'unresolved_dispute' on read.
  const update = {
    verificationStatus: action === 'confirm' ? 'verified' : 'disputed',
    updatedAt:          FieldValue.serverTimestamp(),
  };

  if (action === 'confirm') {
    update.appealStatus = 'confirmed';
  } else {
    update.appealStatus = 'appealed';
    update.verificationResponse = {
      respondedAt: FieldValue.serverTimestamp(),
      respondedBy: decoded.uid,
      notes:       notes || '',
      proofUrls:   Array.isArray(proofUrls) ? proofUrls.slice(0, 10) : [],
    };
  }

  await tradeRef.update(update);

  // Mirror update to submitter's submittedTrades copy
  if (trade.submittedBy) {
    const mirrorRef = db.collection('users').doc(trade.submittedBy).collection('submittedTrades').doc(tradeId);
    await mirrorRef.update(update).catch(() => {});
  }

  // Notify the original submitter (in-app always; WhatsApp on appeal if we have a phone)
  if (trade.submittedBy) {
    const actionLabel    = action === 'confirm' ? 'confirmed' : 'appealed';
    const responderLabel = trade.counterpartyName || callerGSTIN || companyGSTIN;
    const amountStr      = `₹${(trade.tradeValue || 0).toLocaleString('en-IN')}`;
    await db.collection('notifications').add({
      recipientId: trade.submittedBy,
      type:        action === 'confirm' ? 'trade_confirmed' : 'trade_appealed',
      tradeId,
      title:       action === 'confirm' ? 'Trade confirmed' : 'Trade appealed',
      message:     action === 'confirm'
        ? `${responderLabel} confirmed the ${amountStr} trade you filed.`
        : `${responderLabel} appealed the ${amountStr} default you filed and uploaded proof. You have until the 7-day window closes to review or settle.`,
      read:        false,
      createdAt:   FieldValue.serverTimestamp(),
      updatedAt:   FieldValue.serverTimestamp(),
    });

    if (action === 'appeal') {
      try {
        const subDoc = await db.collection('users').doc(trade.submittedBy).get();
        const phone  = subDoc.exists ? subDoc.data().mobileNumber : null;
        if (phone) await notifyWhatsAppTradeEvent(phone, 'appeal_opened', [responderLabel, amountStr]);
      } catch { /* best-effort */ }
    }
  }

  return res.status(200).json({ success: true, verificationStatus: update.verificationStatus, appealStatus: update.appealStatus });
}
