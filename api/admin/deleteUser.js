const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    // Requires FIREBASE_SERVICE_ACCOUNT_KEY in Vercel environment variables.
    // Or if running locally, rely on GOOGLE_APPLICATION_CREDENTIALS.
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
      });
    } else {
      // Fallback for default initialization (e.g., local or Google Cloud envs)
      admin.initializeApp();
    }
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
  }
}

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
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Check if caller is an admin (Custom claim `admin` strictly enforced)
    if (decodedToken.admin !== true && decodedToken.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }

    const { targetUid } = req.body || {};

    if (!targetUid) {
      return res.status(400).json({ success: false, error: 'Target user ID (targetUid) is required' });
    }

    // 1. Delete from Firebase Authentication
    await admin.auth().deleteUser(targetUid);

    // 2. Delete from Firestore (bypassing rules)
    await admin.firestore().collection('users').doc(targetUid).delete();

    return res.status(200).json({ success: true, message: 'User completely deleted' });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
}
