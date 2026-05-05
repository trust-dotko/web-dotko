import { rateLimit } from '../../../_rateLimit.js';

// Same Sandbox.co.in platform as GST verification — module-level token cache
let cachedToken = null;
let tokenExpiry = null;

async function authenticate(base, apiKey, apiSecret) {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) return cachedToken;

  const res  = await fetch(`${base}/authenticate`, {
    method: 'POST',
    headers: {
      'x-api-key':     apiKey,
      'x-api-secret':  apiSecret,
      'x-api-version': '1.0',
    },
  });
  const data = await res.json();
  if (data.code === 200 && data.data?.access_token) {
    cachedToken = data.data.access_token;
    tokenExpiry = Date.now() + 23 * 3_600_000; // 23-hour cache, matching GST API
    return cachedToken;
  }
  throw new Error(`Sandbox auth failed (${data.code}): ${data.message || JSON.stringify(data)}`);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const { limited, retryAfter } = rateLimit(ip, 'entitylocker_initiate', 5, 60);
  if (limited) {
    return res.status(429).json({ error: 'Too many requests', retryAfter });
  }

  // Reuse the same Sandbox.co.in credentials already used for GST verification
  const useTest  = process.env.GST_USE_TEST_API === 'true';
  const BASE_URL = useTest ? 'https://test-api.sandbox.co.in' : 'https://api.sandbox.co.in';
  const API_KEY  = useTest ? process.env.GST_TEST_API_KEY  : process.env.GST_API_KEY;
  const SECRET   = useTest ? process.env.GST_TEST_API_SECRET : process.env.GST_API_SECRET;

  if (!API_KEY || !SECRET) {
    console.error('[entitylocker/initiate] GST_API_KEY / GST_API_SECRET not set');
    return res.status(500).json({ error: 'Verification service is not configured.' });
  }

  try {
    const token = await authenticate(BASE_URL, API_KEY, SECRET);

    const headers = {
      'Content-Type':  'application/json',
      'Authorization': token,
      'x-api-key':     API_KEY,
      'x-api-version': '1.0.0',
    };

    // ── 2. Create EntityLocker session ───────────────────────────────────────
    // Using standard API endpoint to bypass broken SDK popup
    const initRes = await fetch(`${BASE_URL}/kyc/entitylocker/sessions/init`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        '@entity': 'in.co.sandbox.kyc.entitylocker.session.request',
        'flow': 'signin',
        'redirect_url': process.env.ALLOWED_ORIGIN || 'https://dotko.in',
      }),
    });
    
    const initBody = await initRes.json().catch(() => ({}));

    if (!initRes.ok || (initBody.code && initBody.code !== 200)) {
      console.error('[entitylocker/initiate] Upstream error', initRes.status, initBody);
      return res.status(502).json({ error: initBody.message || 'Failed to initiate verification session.' });
    }

    const session_id = initBody.data?.id || initBody.session_id || initBody.data?.session_id;
    const authorization_url = initBody.data?.authorization_url || initBody.authorization_url || initBody.data?.session?.authorization_url;

    if (!session_id) {
      console.error('[entitylocker/initiate] No session_id in response', initBody);
      return res.status(502).json({ error: 'Verification provider returned an unexpected response.' });
    }

    return res.status(200).json({
      session_id,
      authorization_url,
      api_key: API_KEY,
      brand:   { name: 'Dotko', logo_url: process.env.BRAND_LOGO_URL || 'https://dotko.in/icon.png' },
      theme:   { mode: 'light' },
    });
  } catch (err) {
    console.error('[entitylocker/initiate] Exception:', err.message);
    return res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
}
