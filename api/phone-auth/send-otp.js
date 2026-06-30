// web/api/phone-auth/send-otp.js — Vercel Serverless Function
//
// POST { phone }  →  generates a 6-digit OTP, stores only its HMAC in Firestore
// (server-only `otp_codes` collection), and delivers it over WhatsApp.
// Rate limited per-IP and per-phone. Never reveals whether the number is registered.

import { db, clientIp, applySecurityHeaders } from '../_firebaseAdmin.js';
import { rateLimit } from '../_rateLimit.js';
import {
  OTP_TTL_MS, RESEND_COOLDOWN_MS, PHONE_RE,
  hashOtp, generateOtp, sendWhatsAppOtp,
} from './_otp.js';

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const phone = String(req.body?.phone || '').trim();
  if (!PHONE_RE.test(phone)) {
    return res.status(400).json({ error: 'Enter a valid 10-digit Indian mobile number.' });
  }

  // Rate limit: per-IP (anti-abuse) and per-phone (anti-spam to a real user)
  const ip = clientIp(req);
  const ipRl = rateLimit(`otp-send-ip:${ip}`, 10, 10 * 60 * 1000);
  if (ipRl.limited) {
    res.setHeader('Retry-After', String(ipRl.retryAfter));
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  const phoneRl = rateLimit(`otp-send-phone:${phone}`, 5, 60 * 60 * 1000);
  if (phoneRl.limited) {
    res.setHeader('Retry-After', String(phoneRl.retryAfter));
    return res.status(429).json({ error: 'Too many codes requested for this number. Try again later.' });
  }

  try {
    const ref = db.collection('otp_codes').doc(phone);
    const snap = await ref.get();

    // Enforce resend cooldown
    if (snap.exists) {
      const prev = snap.data();
      const since = Date.now() - (prev.lastSentAt || 0);
      if (since < RESEND_COOLDOWN_MS) {
        const wait = Math.ceil((RESEND_COOLDOWN_MS - since) / 1000);
        res.setHeader('Retry-After', String(wait));
        return res.status(429).json({ error: `Please wait ${wait}s before requesting a new code.` });
      }
    }

    const otp = generateOtp();
    await ref.set({
      hash: hashOtp(phone, otp),
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
      lastSentAt: Date.now(),
      createdAt: snap.exists ? (snap.data().createdAt || Date.now()) : Date.now(),
    });

    await sendWhatsAppOtp(phone, otp);

    return res.status(200).json({ success: true, expiresInSeconds: OTP_TTL_MS / 1000 });
  } catch (err) {
    console.error('[send-otp]', err.message);
    return res.status(502).json({ error: 'Could not send the verification code. Please try again.' });
  }
}
