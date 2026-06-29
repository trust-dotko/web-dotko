// web/api/kyc/entitylocker/_fetch.js
//
// Server-side EntityLocker (Sandbox.co.in) document fetch + parse.
// Used by the authenticated complete-profile endpoint so the verified business
// data is written from the server — the browser never supplies its own GST.
// (Files prefixed with "_" are ignored by Vercel's filesystem router.)

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

const DOC_TYPES = ['gstn_details', 'company_master_details', 'udhyam_certificate'];

function parseDocuments(documents, sessionMeta) {
  const gstn = documents.gstn_details || {};
  const company = documents.company_master_details || {};
  const udyam = documents.udhyam_certificate || {};
  const pick = (...vs) => vs.find(v => v && String(v).trim() !== '') ?? '';

  const gstin = pick(gstn.gstin, gstn.gstIn, sessionMeta?.gstin);
  const legalName = pick(gstn.legal_name, gstn.legalName, company.company_name, company.name, sessionMeta?.legal_name);
  const tradeName = pick(gstn.trade_name, gstn.tradeName, sessionMeta?.trade_name) || legalName;
  const status = pick(gstn.status, gstn.gst_status, sessionMeta?.status, 'Active');
  const registrationDate = pick(gstn.registration_date, gstn.registrationDate, sessionMeta?.registration_date);
  const constitution = pick(gstn.constitution_of_business, gstn.constitution, company.company_category, sessionMeta?.constitution_of_business);

  const addr = gstn.principal_address || gstn.address_details || {};
  const state = pick(addr.state, gstn.state, company.registered_address?.state, sessionMeta?.state);
  const district = pick(addr.district, addr.city, gstn.city, company.registered_address?.city, sessionMeta?.city);
  const fullAddress = pick(addr.full_address, addr.address, gstn.address, company.registered_address?.address, sessionMeta?.address);

  const natureOfBusiness = gstn.nature_of_business_activities ?? sessionMeta?.nature_of_business_activities ?? [];

  return {
    gstin,
    legalName,
    tradeName,
    status,
    registrationDate,
    constitutionOfBusiness: constitution,
    principalAddress: { state, district, fullAddress },
    natureOfBusinessActivities: Array.isArray(natureOfBusiness) ? natureOfBusiness : [],
    udyamRegistrationNumber: pick(udyam.udyam_registration_number, udyam.registration_number),
    entityLockerVerified: true,
    sessionId: sessionMeta?.session_id,
  };
}

/** Fetch + parse verified business data for a completed EntityLocker session. Throws on failure. */
export async function fetchEntityLockerData(session_id) {
  const useTest = process.env.GST_USE_TEST_API === 'true';
  const BASE = useTest ? 'https://test-api.sandbox.co.in' : 'https://api.sandbox.co.in';
  const KEY = useTest ? process.env.GST_TEST_API_KEY : process.env.GST_API_KEY;
  const SECRET = useTest ? process.env.GST_TEST_API_SECRET : process.env.GST_API_SECRET;
  if (!KEY || !SECRET) throw new Error('Verification service is not configured.');

  const token = await authenticate(BASE, KEY, SECRET);
  const headers = { Authorization: token, 'x-api-key': KEY, 'x-api-version': '1.0.0' };
  const sid = encodeURIComponent(session_id);

  const statusRes = await fetch(`${BASE}/kyc/entitylocker/sessions/${sid}/status`, { headers });
  const statusBody = await statusRes.json().catch(() => ({}));
  if (!statusRes.ok || (statusBody.code && statusBody.code !== 200)) {
    throw new Error(statusBody.message || 'Could not confirm verification status.');
  }

  const documents = {};
  await Promise.allSettled(DOC_TYPES.map(async (docType) => {
    const r = await fetch(`${BASE}/kyc/entitylocker/sessions/${sid}/documents/${docType}`, { headers });
    const b = await r.json().catch(() => ({}));
    if (r.ok || b.code === 200) documents[docType] = b.data ?? b;
  }));
  if (Object.keys(documents).length === 0) throw new Error('No verified documents returned.');

  const data = parseDocuments(documents, statusBody.data ?? statusBody);
  if (!data.gstin) throw new Error('Verified GST data is incomplete. Please try again.');
  return data;
}
