/**
 * /api/trade — single router for all trade actions (keeps us under Vercel's
 * 12-function limit). Dispatches on `action` to the underscore-prefixed handlers
 * (which Vercel does NOT count as separate functions):
 *
 *   action: 'submit'            → _submit.js  (file a trade / report a default)
 *   action: 'status' | 'settle' → _update.js  (submitter updates / settles)
 *   action: 'confirm' | 'appeal' (or legacy 'dispute') → _verify.js (counterparty)
 */

import submit from './_submit.js';
import update from './_update.js';
import verify from './_verify.js';
import { applySecurityHeaders } from '../_firebaseAdmin.js';

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const action = req.body?.action || 'submit';

  if (action === 'submit') return submit(req, res);
  if (['status', 'settle'].includes(action)) return update(req, res);
  if (['confirm', 'appeal', 'dispute'].includes(action)) return verify(req, res);

  return res.status(400).json({ error: `Unknown trade action: ${action}` });
}
