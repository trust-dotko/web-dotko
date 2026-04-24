import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);

/**
 * GST verification — calls our own /api/gst-verify serverless function.
 * In dev: handled by the Vite dev middleware (vite.config.js).
 * In prod: handled by Vercel Serverless Functions (api/gst-verify.js).
 *
 * GST API secrets stay server-side only — never exposed to the browser.
 */
export async function verifyGSTIN(gstin) {
  const res = await fetch('/api/gst-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gstin }),
  });

  // Safely parse — a non-JSON response means the API endpoint is unreachable
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('Non-JSON response from /api/gst-verify:', text.slice(0, 200));
    throw new Error('Server returned an invalid response. Make sure the dev server is running.');
  }

  if (!res.ok || !data.success) {
    throw new Error(data.error || 'GST verification failed');
  }

  return data;
}
