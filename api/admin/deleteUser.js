import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  try {
    // Requires FIREBASE_SERVICE_ACCOUNT_KEY in Vercel environment variables.
    // Or if running locally, rely on GOOGLE_APPLICATION_CREDENTIALS.
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      let serviceAccount;
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      } catch (parseError) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', parseError);
      }

      if (serviceAccount && serviceAccount.project_id) {
        initializeApp({
          credential: cert(serviceAccount),
        });
      } else {
        // Fallback for default initialization (e.g., local or Google Cloud envs)
        initializeApp();
      }
    } else {
      // Fallback for default initialization (e.g., local or Google Cloud envs)
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

  // CORS handled by vercel.json
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
    
    // Check if caller is an admin (Custom claim `admin` strictly enforced)
    if (decodedToken.admin !== true && decodedToken.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }

    const { targetUid } = req.body || {};

    if (!targetUid) {
      return res.status(400).json({ success: false, error: 'Target user ID (targetUid) is required' });
    }

    // 1. Delete from Firebase Authentication
    await auth.deleteUser(targetUid);

    // 2. Delete from Firestore (bypassing rules)
    await db.collection('users').doc(targetUid).delete();

    return res.status(200).json({ success: true, message: 'User completely deleted' });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
}
