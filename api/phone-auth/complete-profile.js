// web/api/phone-auth/complete-profile.js — Vercel Serverless Function
//
// POST { gstin }  (Authorization: Bearer <idToken>)
// Finishes onboarding for a phone-authenticated user: looks up the GSTIN in the
// public GST registry server-side and writes the verified business details to the
// user's profile. If the GSTIN is already linked to a DIFFERENT account, the
// request is rejected — one business, one account.

import { db, verifyBearer, clientIp, applySecurityHeaders } from '../_firebaseAdmin.js';
import { rateLimit } from '../_rateLimit.js';
import { GSTIN_RE, searchGstin } from '../_gst.js';

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await verifyBearer(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const ip = clientIp(req);
  const rl = rateLimit(`complete-profile:${ip}`, 10, 60 * 1000);
  if (rl.limited) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const clean = String(req.body?.gstin || '').trim().toUpperCase();
  if (!clean) return res.status(400).json({ error: 'GSTIN is required.' });
  if (!GSTIN_RE.test(clean)) return res.status(400).json({ error: 'Invalid GSTIN format.' });

  const uid = decoded.uid;

  try {
    // Duplicate guard: reject if this GST already belongs to a different account.
    const claimed = await db.collection('users').where('gst', '==', clean).limit(2).get();
    if (claimed.docs.some((d) => d.id !== uid)) {
      return res.status(409).json({ error: 'An account already exists for this GST number. Please sign in.' });
    }

    const result = await searchGstin(clean);
    if (result.notFound) return res.status(404).json({ error: result.error || 'GSTIN not found.' });
    if (result.failed || !result.data) {
      return res.status(502).json({ error: result.error || 'Could not verify this GSTIN. Please try again.' });
    }

    const biz = result.data;
    const profileData = {
      businessName: biz.tradeName || biz.legalName || '',
      legalName: biz.legalName || '',
      tradeName: biz.tradeName || '',
      gst: biz.gstin || clean,
      entityType: biz.constitutionOfBusiness || '',
      gstStatus: biz.status || '',
      registrationDate: biz.registrationDate || '',
      state: biz.principalAddress?.state || '',
      city: biz.principalAddress?.district || '',
      address: biz.principalAddress?.fullAddress || '',
      natureOfBusiness: biz.natureOfBusinessActivities || [],
      gstVerified: true,
      profileComplete: true,
      onboardingCompleted: true,
      updatedAt: new Date().toISOString(),
    };

    await db.collection('users').doc(uid).set(profileData, { merge: true });
    const merged = (await db.collection('users').doc(uid).get()).data();
    return res.status(200).json({ success: true, profile: merged });
  } catch (err) {
    console.error('[complete-profile]', err.message);
    return res.status(502).json({ error: err.message || 'Could not complete your profile. Please try again.' });
  }
}
