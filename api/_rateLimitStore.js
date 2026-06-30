// web/api/_rateLimitStore.js
//
// Firestore-backed fixed-window rate limiter. Unlike the in-memory _rateLimit.js,
// this survives serverless cold starts and is shared across instances — which is
// what makes it usable to stop report-bombing a competitor's GSTIN.
//
// The `rate_limits` collection is server-only: it matches no rule in
// firestore.rules, so the default deny-all blocks every client read/write.

import { db } from './_firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

function encodeKey(key) {
  return String(key).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 400) || 'unknown';
}

/**
 * @param {string} key                 e.g. `trade:${uid}:${targetGSTIN}`
 * @param {number} maxRequests         allowed hits per window
 * @param {number} windowMs            window length in ms
 * @returns {Promise<{limited:boolean, retryAfter?:number, count:number}>}
 */
export async function rateLimitStore(key, maxRequests, windowMs) {
  const ref = db.collection('rate_limits').doc(encodeKey(key));
  const now = Date.now();
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : null;
      let windowStart = data?.windowStart ?? now;
      let count       = data?.count ?? 0;
      if (now - windowStart >= windowMs) { windowStart = now; count = 0; }
      if (count >= maxRequests) {
        return { limited: true, retryAfter: Math.ceil((windowStart + windowMs - now) / 1000), count };
      }
      tx.set(ref, { windowStart, count: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return { limited: false, count: count + 1 };
    });
  } catch {
    // Fail open on infrastructure error — never block a legitimate write because
    // the limiter store had a hiccup.
    return { limited: false, count: 0 };
  }
}
