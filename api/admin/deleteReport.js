import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      initializeApp({
        credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
      });
    } else {
      initializeApp();
    }
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
  }
}

const db = getFirestore();
const auth = getAuth();

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // CORS headers for admin portal
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Missing token' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify token
    const decodedToken = await auth.verifyIdToken(idToken);
    
    // Check if caller is an admin
    if (decodedToken.admin !== true && decodedToken.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }

    const { reportId } = req.body || {};

    if (!reportId) {
      return res.status(400).json({ success: false, error: 'Report ID (reportId) is required' });
    }

    // Delete from Firestore (bypassing rules)
    await db.collection('reports').doc(reportId).delete();

    return res.status(200).json({ success: true, message: 'Report deleted successfully' });
  } catch (err) {
    console.error('Delete report error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
}
