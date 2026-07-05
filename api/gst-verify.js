/**
 * /api/gst-verify.js — Vercel Serverless Function
 *
 * Proxies public GST verification requests to the Sandbox API.
 * API keys live ONLY in server-side environment variables (see _gst.js).
 * The browser never sees GST_API_KEY or GST_API_SECRET.
 */

import { GSTIN_RE, searchGstin } from './_gst.js';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // CORS headers (public endpoint)
  const allowed = process.env.ALLOWED_ORIGIN || 'https://web.dotko.in';
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { gstin } = req.body || {};

  if (!gstin || typeof gstin !== 'string') {
    return res.status(400).json({ success: false, error: 'GSTIN is required' });
  }

  const clean = gstin.trim().toUpperCase();

  // Server-side format validation
  if (!GSTIN_RE.test(clean)) {
    return res.status(400).json({ success: false, error: 'Invalid GSTIN format' });
  }

  try {
    const result = await searchGstin(clean);

    if (result.notFound) {
      return res.status(404).json({ success: false, error: result.error, code: result.code });
    }
    if (result.failed || !result.data) {
      return res.status(502).json({ success: false, error: result.error || 'Failed to verify GSTIN', code: result.code });
    }

    return res.status(200).json({
      success: true,
      gstin: clean,
      data: result.data,
      transactionId: result.transactionId,
    });
  } catch (err) {
    console.error('GST verify error:', err);
    return res.status(500).json({
      success: false,
      error: 'GST verification service temporarily unavailable',
    });
  }
}
