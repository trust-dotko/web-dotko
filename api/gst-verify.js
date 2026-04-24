/**
 * /api/gst-verify.js — Vercel Serverless Function
 *
 * Proxies GST verification requests to the Sandbox API.
 * API keys live ONLY in server-side environment variables.
 * The browser never sees GST_API_KEY or GST_API_SECRET.
 */

const SANDBOX_API_BASE = 'https://api.sandbox.co.in';
const SANDBOX_TEST_API_BASE = 'https://test-api.sandbox.co.in';

// Module-level token cache (persists across warm invocations)
let cachedToken = null;
let tokenExpiry = null;

function getBaseURL() {
  return process.env.GST_USE_TEST_API === 'true'
    ? SANDBOX_TEST_API_BASE
    : SANDBOX_API_BASE;
}

function getCredentials() {
  const useTest = process.env.GST_USE_TEST_API === 'true';
  return {
    apiKey: useTest ? process.env.GST_TEST_API_KEY : process.env.GST_API_KEY,
    apiSecret: useTest ? process.env.GST_TEST_API_SECRET : process.env.GST_API_SECRET,
  };
}

async function authenticate() {
  // Reuse cached token if still valid
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const { apiKey, apiSecret } = getCredentials();
  const base = getBaseURL();

  const res = await fetch(`${base}/authenticate`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'x-api-secret': apiSecret,
      'x-api-version': '1.0',
    },
  });

  if (!res.ok) {
    throw new Error(`Sandbox auth failed: ${res.status}`);
  }

  const data = await res.json();

  if (data.code === 200 && data.data?.access_token) {
    cachedToken = data.data.access_token;
    tokenExpiry = Date.now() + 23 * 60 * 60 * 1000; // 23h
    return cachedToken;
  }

  throw new Error('Failed to get Sandbox access token');
}

function parseGSTData(raw) {
  if (!raw) return null;

  const parseAddr = (addrObj) => {
    if (!addrObj) return null;
    const a = addrObj.addr || {};
    const parts = [a.bnm, a.bno, a.flno, a.st, a.loc, a.locality, a.dst, a.stcd, a.pncd].filter(Boolean);
    return {
      buildingName: a.bnm || '',
      street: a.st || '',
      location: a.loc || '',
      district: a.dst || '',
      state: a.stcd || '',
      pincode: a.pncd || '',
      fullAddress: parts.join(', '),
      natureOfBusiness: Array.isArray(addrObj.ntr) ? addrObj.ntr : [addrObj.ntr].filter(Boolean),
    };
  };

  return {
    gstin: raw.gstin,
    legalName: raw.lgnm,
    tradeName: raw.tradeNam || raw.lgnm,
    status: raw.sts,
    registrationDate: raw.rgdt,
    cancellationDate: raw.cxdt || raw.canclDt || null,
    lastUpdated: raw.lstupdt || raw.lstupddt,
    constitutionOfBusiness: raw.ctb,
    taxpayerType: raw.dty,
    natureOfBusinessActivities: raw.nba || [],
    eInvoiceEnabled: raw.einvoiceStatus === 'Yes',
    stateJurisdiction: raw.stj,
    centerJurisdiction: raw.ctj,
    principalAddress: parseAddr(raw.pradr),
    additionalAddresses: (raw.adadr || []).map(parseAddr),
    stateCode: raw.gstin ? raw.gstin.substring(0, 2) : '',
  };
}

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { gstin } = req.body || {};

  if (!gstin || typeof gstin !== 'string') {
    return res.status(400).json({ success: false, error: 'GSTIN is required' });
  }

  const clean = gstin.trim().toUpperCase();

  // Server-side format validation
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(clean)) {
    return res.status(400).json({ success: false, error: 'Invalid GSTIN format' });
  }

  try {
    const token = await authenticate();
    const { apiKey } = getCredentials();
    const base = getBaseURL();

    const apiRes = await fetch(`${base}/gst/compliance/public/gstin/search`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'x-api-key': apiKey,
        'x-api-version': '1.0.0',
        'x-accept-cache': 'true',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ gstin: clean }),
    });

    const data = await apiRes.json();

    if (data.code === 200) {
      if (data.data?.error) {
        return res.status(404).json({
          success: false,
          error: data.data.error.message || 'GSTIN not found',
          code: data.data.error.error_cd || 'NOT_FOUND',
        });
      }

      return res.status(200).json({
        success: true,
        gstin: clean,
        data: parseGSTData(data.data?.data || data.data),
        transactionId: data.transaction_id,
      });
    }

    return res.status(502).json({
      success: false,
      error: data.message || 'Failed to verify GSTIN',
      code: data.code,
    });
  } catch (err) {
    console.error('GST verify error:', err);
    return res.status(500).json({
      success: false,
      error: 'GST verification service temporarily unavailable',
    });
  }
}
