/**
 * /api/auth/register.js — Vercel Serverless Function
 *
 * Creates a user profile in Firestore after Firebase Auth signup.
 * Receives a Firebase ID token in Authorization header to verify the user.
 * All Firestore writes happen server-side — the browser never talks to Firestore directly.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin (reuse across warm invocations)
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const uid = decoded.uid;
  const body = req.body || {};

  const profileData = {
    email: body.email || decoded.email || '',
    gst: body.gst || '',
    businessName: body.businessName || '',
    legalName: body.legalName || '',
    tradeName: body.tradeName || '',
    entityType: body.entityType || '',
    gstStatus: body.gstStatus || '',
    registrationDate: body.registrationDate || '',
    address: body.address || '',
    state: body.state || '',
    city: body.city || '',
    natureOfBusiness: body.natureOfBusiness || [],
    profileComplete: false,
    onboardingComplete: false,
    emailVerified: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await db.collection('users').doc(uid).set(profileData, { merge: true });
    return res.status(200).json({ success: true, profile: profileData });
  } catch (err) {
    console.error('Firestore write error:', err);
    return res.status(500).json({ error: 'Failed to save profile' });
  }
}
