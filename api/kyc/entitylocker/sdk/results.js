import { rateLimit } from '../../../_rateLimit.js';

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
    tokenExpiry = Date.now() + 23 * 3_600_000;
    return cachedToken;
  }
  throw new Error(`Sandbox auth failed (${data.code}): ${data.message || JSON.stringify(data)}`);
}

// Document types requested during session creation — fetched individually after consent
const DOC_TYPES = ['gstn_details', 'company_master_details', 'udhyam_certificate'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const { limited, retryAfter } = rateLimit(ip + '_results', 10, 60000);
  if (limited) {
    return res.status(429).json({ error: 'Too many requests', retryAfter });
  }

  const { session_id } = req.body || {};
  if (!session_id || typeof session_id !== 'string' || !session_id.trim()) {
    return res.status(400).json({ error: 'session_id is required.' });
  }

  const sid      = session_id.trim();
  const useTest  = process.env.GST_USE_TEST_API === 'true';
  const BASE_URL = useTest ? 'https://test-api.sandbox.co.in' : 'https://api.sandbox.co.in';
  const API_KEY  = useTest ? process.env.GST_TEST_API_KEY   : process.env.GST_API_KEY;
  const SECRET   = useTest ? process.env.GST_TEST_API_SECRET : process.env.GST_API_SECRET;

  if (!API_KEY || !SECRET) {
    console.error('[entitylocker/results] GST_API_KEY / GST_API_SECRET not set');
    return res.status(500).json({ error: 'Verification service is not configured.' });
  }

  try {
    const token   = await authenticate(BASE_URL, API_KEY, SECRET);
    const headers = { 'Authorization': token, 'x-api-key': API_KEY, 'x-api-version': '1.0.0' };

    // ── 1. Confirm session is complete ───────────────────────────────────────
    const statusRes  = await fetch(
      `${BASE_URL}/kyc/entitylocker/sessions/${encodeURIComponent(sid)}/status`,
      { method: 'GET', headers }
    );
    const statusBody = await statusRes.json().catch(() => ({}));

    if (!statusRes.ok || (statusBody.code && statusBody.code !== 200)) {
      console.error('[entitylocker/results] Status check failed', statusRes.status, statusBody);
      return res.status(502).json({ error: statusBody.message || 'Could not confirm verification status.' });
    }

    // ── 2. Fetch each document type ──────────────────────────────────────────
    const documents = {};
    await Promise.allSettled(
      DOC_TYPES.map(async (docType) => {
        const docRes  = await fetch(
          `${BASE_URL}/kyc/entitylocker/sessions/${encodeURIComponent(sid)}/documents/${docType}`,
          { method: 'GET', headers }
        );
        const docBody = await docRes.json().catch(() => ({}));
        if (docRes.ok || docBody.code === 200) {
          documents[docType] = docBody.data ?? docBody;
        } else {
          console.warn(`[entitylocker/results] Doc ${docType} not available (${docRes.status})`);
        }
      })
    );

    if (Object.keys(documents).length === 0) {
      console.error('[entitylocker/results] No documents returned', statusBody);
      return res.status(502).json({ error: 'No verified documents returned. Please try again.' });
    }

    // ── 3. Parse into app's business data shape ──────────────────────────────
    const data = parseDocuments(documents, statusBody.data ?? statusBody);

    if (!data.gstin) {
      console.error('[entitylocker/results] GSTIN missing from documents', documents);
      return res.status(502).json({ error: 'Verified GST data is incomplete. Please try again.' });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[entitylocker/results] Exception:', err.stack);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}

function parseDocuments(documents, sessionMeta) {
  // gstn_details is the primary GST source
  const gstn    = documents.gstn_details        || {};
  const company = documents.company_master_details || {};
  const udyam   = documents.udhyam_certificate  || {};
  const pick    = (...vs) => vs.find(v => v && String(v).trim() !== '') ?? '';

  const gstin            = pick(gstn.gstin,               gstn.gstIn,               sessionMeta?.gstin);
  const legalName        = pick(gstn.legal_name,          gstn.legalName,           company.company_name, company.name, sessionMeta?.legal_name);
  const tradeName        = pick(gstn.trade_name,          gstn.tradeName,           sessionMeta?.trade_name) || legalName;
  const status           = pick(gstn.status,              gstn.gst_status,          sessionMeta?.status, 'Active');
  const registrationDate = pick(gstn.registration_date,   gstn.registrationDate,    sessionMeta?.registration_date);
  const constitution     = pick(gstn.constitution_of_business, gstn.constitution,   company.company_category, sessionMeta?.constitution_of_business);

  const addr        = gstn.principal_address || gstn.address_details || {};
  const state       = pick(addr.state,         gstn.state,    company.registered_address?.state,   sessionMeta?.state);
  const district    = pick(addr.district,      addr.city,     gstn.city,    company.registered_address?.city,    sessionMeta?.city);
  const fullAddress = pick(addr.full_address,  addr.address,  gstn.address, company.registered_address?.address, sessionMeta?.address);

  const natureOfBusiness = gstn.nature_of_business_activities ?? sessionMeta?.nature_of_business_activities ?? [];

  return {
    gstin,
    legalName,
    tradeName,
    status,
    registrationDate,
    constitutionOfBusiness: constitution,
    principalAddress:       { state, district, fullAddress },
    natureOfBusinessActivities: Array.isArray(natureOfBusiness) ? natureOfBusiness : [],
    udyamRegistrationNumber: pick(udyam.udyam_registration_number, udyam.registration_number),
    entityLockerVerified:   true,
    sessionId:              sessionMeta?.session_id,
  };
}
