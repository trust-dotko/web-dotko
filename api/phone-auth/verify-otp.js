// web/api/phone-auth/verify-otp.js — Vercel Serverless Function
//
// POST { phone, otp }  →  validates the OTP against the stored HMAC, then mints a
// Firebase custom token the browser exchanges via signInWithCustomToken().
// On first verification it provisions the Auth user + a minimal (incomplete)
// profile doc — all server-side, so identity is never client-forgeable.

import { db, adminAuth, clientIp, applySecurityHeaders } from '../_firebaseAdmin.js';
import { rateLimit } from '../_rateLimit.js';
import { PHONE_RE, MAX_VERIFY_ATTEMPTS, hashOtp } from './_otp.js';

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const phone = String(req.body?.phone || '').trim();
  const otp = String(req.body?.otp || '').trim();
  if (!PHONE_RE.test(phone)) return res.status(400).json({ error: 'Invalid phone number.' });
  if (!/^\d{6}$/.test(otp)) return res.status(400).json({ error: 'Enter the 6-digit code.' });

  const ip = clientIp(req);
  const rl = rateLimit(`otp-verify-ip:${ip}`, 20, 10 * 60 * 1000);
  if (rl.limited) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
  }

  try {
    const ref = db.collection('otp_codes').doc(phone);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(400).json({ error: 'No active code. Please request a new one.' });
    }
    const d = snap.data();

    if (Date.now() > d.expiresAt) {
      await ref.delete();
      return res.status(400).json({ error: 'Code expired. Please request a new one.' });
    }
    if ((d.attempts || 0) >= MAX_VERIFY_ATTEMPTS) {
      await ref.delete();
      return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.' });
    }
    if (hashOtp(phone, otp) !== d.hash) {
      await ref.update({ attempts: (d.attempts || 0) + 1 });
      return res.status(400).json({ error: 'Incorrect code. Please try again.' });
    }

    // ── Correct code — consume it immediately (single-use) ──────────────────
    await ref.delete();

    const uid = `phone_${phone}`;
    let isNewUser = false;
    try {
      await adminAuth.getUser(uid);
    } catch {
      isNewUser = true;
      await adminAuth.createUser({ uid, displayName: phone });
    }

    // Server-owned profile doc. Created minimal+incomplete on first sign-in;
    // verified business data is added later by /api/phone-auth/complete-profile.
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    let profileComplete = false;
    if (!userSnap.exists) {
      await userRef.set({
        mobileNumber: phone,
        profileComplete: false,
        onboardingCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } else {
      const u = userSnap.data();
      if (u.suspended === true) return res.status(403).json({ error: 'This account has been suspended.' });
      profileComplete = Boolean(u.profileComplete);
    }

    const token = await adminAuth.createCustomToken(uid, { phone });
    return res.status(200).json({ success: true, token, isNewUser, profileComplete });
  } catch (err) {
    console.error('[verify-otp]', err.message);
    return res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
}
