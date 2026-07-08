/**
 * web/api/_gst.js — shared Sandbox GST API helpers.
 *
 * Sandbox authentication (with a warm-invocation token cache), the public GSTIN
 * registry search, and response normalization live here so the token-cache and
 * parsing logic exists in exactly one place. Used by:
 *   - /api/gst-verify              (public report lookups)
 *   - /api/phone-auth/complete-profile (authenticated profile completion)
 *
 * GST API secrets stay server-side only — never exposed to the browser.
 */

const SANDBOX_API_BASE = 'https://api.sandbox.co.in';
const SANDBOX_TEST_API_BASE = 'https://test-api.sandbox.co.in';

/** GSTIN format: 2-digit state, 5-letter PAN, 4 digits, 1 letter, 1 entity, Z, 1 checksum. */
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// Module-level token cache (persists across warm invocations)
let cachedToken = null;
let tokenExpiry = null;

export function getBaseURL() {
  return process.env.GST_USE_TEST_API === 'true'
    ? SANDBOX_TEST_API_BASE
    : SANDBOX_API_BASE;
}

export function getCredentials() {
  const useTest = process.env.GST_USE_TEST_API === 'true';
  return {
    apiKey: useTest ? process.env.GST_TEST_API_KEY : process.env.GST_API_KEY,
    apiSecret: useTest ? process.env.GST_TEST_API_SECRET : process.env.GST_API_SECRET,
  };
}

export async function authenticate() {
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

/** Normalize a raw GSTN registry record into the shape the app consumes. */
export function parseGSTData(raw) {
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

/**
 * Search the public GST registry for a (pre-validated, uppercase) GSTIN.
 * Returns one of:
 *   { data, transactionId }                — success
 *   { notFound: true, error, code }         — registry has no such GSTIN
 *   { failed: true, error, code }           — upstream returned a non-200 code
 * Throws on network / auth failure (caller maps to 500).
 */
export async function searchGstin(clean) {
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
      return {
        notFound: true,
        error: data.data.error.message || 'GSTIN not found',
        code: data.data.error.error_cd || 'NOT_FOUND',
      };
    }
    return {
      data: parseGSTData(data.data?.data || data.data),
      transactionId: data.transaction_id,
    };
  }

  return {
    failed: true,
    error: data.message || 'Failed to verify GSTIN',
    code: data.code,
  };
}
