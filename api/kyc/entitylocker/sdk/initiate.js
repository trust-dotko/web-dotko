// web/api/kyc/entitylocker/sdk/initiate.js — Vercel Serverless Function
//
// Starts an EntityLocker (Sandbox.co.in) verification session for the signed-in
// user. Requires a valid Firebase ID token, records a session→uid binding so the
// completion step can verify ownership, and returns ONLY the authorization URL —
// the Sandbox API key never reaches the browser.

import { db, verifyBearer, clientIp, applySecurityHeaders } from '../../../_firebaseAdmin.js';
import { rateLimit } from '../../../_rateLimit.js';

let cachedToken = null;
let tokenExpiry = null;

async function authenticate(base, apiKey, apiSecret) {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch(`${base}/authenticate`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'x-api-secret': apiSecret, 'x-api-version': '1.0' },
  });
  const data = await res.json();
  if (data.code === 200 && data.data?.access_token) {
    cachedToken = data.data.access_token;
    tokenExpiry = Date.now() + 23 * 3_600_000;
    return cachedToken;
  }
  throw new Error(`Sandbox auth failed (${data.code}): ${data.message || JSON.stringify(data)}`);
}

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await verifyBearer(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const ip = clientIp(req);
  const { limited, retryAfter } = rateLimit(`el-initiate:${ip}`, 5, 60_000);
  if (limited) {
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const useTest = process.env.GST_USE_TEST_API === 'true';
  const BASE_URL = useTest ? 'https://test-api.sandbox.co.in' : 'https://api.sandbox.co.in';
  const API_KEY = useTest ? process.env.GST_TEST_API_KEY : process.env.GST_API_KEY;
  const SECRET = useTest ? process.env.GST_TEST_API_SECRET : process.env.GST_API_SECRET;

  if (!API_KEY || !SECRET) {
    console.error('[entitylocker/initiate] GST_API_KEY / GST_API_SECRET not set');
    return res.status(500).json({ error: 'Verification service is not configured.' });
  }

  try {
    const token = await authenticate(BASE_URL, API_KEY, SECRET);
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': token,
      'x-api-key': API_KEY,
      'x-api-version': '1.0.0',
    };

    const origin = req.headers.origin
      || (req.headers.referer ? new URL(req.headers.referer).origin : process.env.ALLOWED_ORIGIN)
      || 'https://web.dotko.in';
    // Return to the gated dashboard; the profile-completion gate reads ?session_id
    const redirectUrl = `${origin}/dashboard`;

    const initRes = await fetch(`${BASE_URL}/kyc/entitylocker/sessions/init`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        '@entity': 'in.co.sandbox.kyc.entitylocker.session.request',
        'flow': 'signin',
        'redirect_url': redirectUrl,
      }),
    });
    const initBody = await initRes.json().catch(() => ({}));

    if (!initRes.ok || (initBody.code && initBody.code !== 200)) {
      console.error('[entitylocker/initiate] Upstream error', initRes.status, initBody);
      return res.status(502).json({ error: initBody.message || 'Failed to initiate verification session.' });
    }

    const session_id = initBody.data?.id || initBody.session_id || initBody.data?.session_id;
    const authorization_url = initBody.data?.authorization_url || initBody.authorization_url || initBody.data?.session?.authorization_url;

    if (!session_id || !authorization_url) {
      console.error('[entitylocker/initiate] Missing session_id/authorization_url', initBody);
      return res.status(502).json({ error: 'Verification provider returned an unexpected response.' });
    }

    // Bind this session to the user so completion can verify ownership
    await db.collection('el_sessions').doc(session_id).set({
      uid: decoded.uid,
      createdAt: Date.now(),
    });

    return res.status(200).json({ session_id, authorization_url });
  } catch (err) {
    console.error('[entitylocker/initiate] Exception:', err.message);
    return res.status(500).json({ error: 'Could not start verification. Please try again.' });
  }
}
