// web/api/phone-auth/complete-profile.js — Vercel Serverless Function
//
// POST { session_id }  (Authorization: Bearer <idToken>)
// Finishes onboarding for a phone-authenticated user: fetches the EntityLocker
// session's verified business documents server-side and writes them to the user's
// profile. The EL session must have been initiated by THIS user (binding check),
// preventing anyone from claiming another business's verification.

import { db, verifyBearer, clientIp, applySecurityHeaders } from '../_firebaseAdmin.js';
import { rateLimit } from '../_rateLimit.js';
import { fetchEntityLockerData } from '../kyc/entitylocker/_fetch.js';

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

  const session_id = String(req.body?.session_id || '').trim();
  if (!session_id) return res.status(400).json({ error: 'session_id is required.' });

  const uid = decoded.uid;

  try {
    // Bind: the EL session must belong to the requesting user
    const sessRef = db.collection('el_sessions').doc(session_id);
    const sessSnap = await sessRef.get();
    if (!sessSnap.exists || sessSnap.data().uid !== uid) {
      return res.status(403).json({ error: 'This verification session is not valid for your account.' });
    }

    const biz = await fetchEntityLockerData(session_id);

    const profileData = {
      businessName: biz.tradeName || biz.legalName || '',
      legalName: biz.legalName || '',
      tradeName: biz.tradeName || '',
      gst: biz.gstin || '',
      entityType: biz.constitutionOfBusiness || '',
      gstStatus: biz.status || '',
      registrationDate: biz.registrationDate || '',
      state: biz.principalAddress?.state || '',
      city: biz.principalAddress?.district || '',
      address: biz.principalAddress?.fullAddress || '',
      natureOfBusiness: biz.natureOfBusinessActivities || [],
      udyamRegistrationNumber: biz.udyamRegistrationNumber || '',
      entityLockerVerified: true,
      profileComplete: true,
      onboardingCompleted: true,
      updatedAt: new Date().toISOString(),
    };

    await db.collection('users').doc(uid).set(profileData, { merge: true });
    // Session consumed — prevent replay
    await sessRef.delete().catch(() => {});

    const merged = (await db.collection('users').doc(uid).get()).data();
    return res.status(200).json({ success: true, profile: merged });
  } catch (err) {
    console.error('[complete-profile]', err.message);
    return res.status(502).json({ error: err.message || 'Could not complete your profile. Please try again.' });
  }
}
