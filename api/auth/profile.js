/**
 * /api/auth/profile.js — Vercel Serverless Function
 *
 * GET  — Fetch current user profile from Firestore
 * POST — Update profile fields
 *
 * All Firestore operations happen server-side.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const uid = decoded.uid;

  // GET — fetch profile
  if (req.method === 'GET') {
    try {
      const snap = await db.collection('users').doc(uid).get();
      return res.status(200).json({
        success: true,
        profile: snap.exists ? snap.data() : null,
      });
    } catch (err) {
      console.error('Profile fetch error:', err);
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }
  }

  // POST — update profile
  if (req.method === 'POST') {
    const body = req.body || {};

    // Only allow safe fields
    const allowed = [
      'businessName', 'gst', 'entityType', 'pan',
      'city', 'state', 'establishmentYear', 'profileComplete',
    ];
    const update = { updatedAt: new Date().toISOString() };
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }

    try {
      await db.collection('users').doc(uid).set(update, { merge: true });
      const snap = await db.collection('users').doc(uid).get();
      return res.status(200).json({
        success: true,
        profile: snap.exists ? snap.data() : null,
      });
    } catch (err) {
      console.error('Profile update error:', err);
      return res.status(500).json({ error: 'Failed to update profile' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
