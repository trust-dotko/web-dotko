import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  try {
    const projectId   = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
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
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Missing token' });
    }

    const decodedToken = await auth.verifyIdToken(authHeader.split('Bearer ')[1]);
    if (decodedToken.admin !== true && decodedToken.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }

    const { type, reportId, targetUid } = req.body || {};

    if (type === 'report') {
      if (!reportId) return res.status(400).json({ success: false, error: 'reportId is required' });
      await db.collection('reports').doc(reportId).delete();
      return res.status(200).json({ success: true, message: 'Report deleted successfully' });
    }

    if (type === 'user') {
      if (!targetUid) return res.status(400).json({ success: false, error: 'targetUid is required' });

      let authDeleted = false;
      try {
        await auth.deleteUser(targetUid);
        authDeleted = true;
      } catch (authErr) {
        if (authErr.code !== 'auth/user-not-found') throw authErr;
      }

      const subcollections = ['submittedTrades', 'searches'];
      for (const sub of subcollections) {
        const snap = await db.collection('users').doc(targetUid).collection(sub).get();
        if (!snap.empty) {
          const batch = db.batch();
          snap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }
      await db.collection('users').doc(targetUid).delete();

      return res.status(200).json({
        success: true,
        message: authDeleted ? 'User completely deleted' : 'Firestore record deleted (Auth user not found)',
      });
    }

    return res.status(400).json({ success: false, error: 'type must be "report" or "user"' });
  } catch (err) {
    console.error('Admin delete error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
}
