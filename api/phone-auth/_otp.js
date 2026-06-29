// web/api/phone-auth/_otp.js
//
// Shared OTP helpers used by send-otp and verify-otp.
// The plaintext OTP is NEVER stored — only an HMAC. The secret is server-only.
// (Files prefixed with "_" are ignored by Vercel's filesystem router.)

import crypto from 'crypto';

export const OTP_TTL_MS = 5 * 60 * 1000;       // 5 minutes
export const RESEND_COOLDOWN_MS = 30 * 1000;   // 30s between sends to a number
export const MAX_VERIFY_ATTEMPTS = 5;          // wrong guesses before the code dies
export const PHONE_RE = /^[6-9]\d{9}$/;        // Indian 10-digit mobile

export function hashOtp(phone, otp) {
  const secret = process.env.OTP_HASH_SECRET
    || process.env.FIREBASE_PRIVATE_KEY      // always present server-side
    || 'dotko-otp-fallback';
  return crypto.createHmac('sha256', secret).update(`${phone}:${otp}`).digest('hex');
}

export function generateOtp() {
  return String(crypto.randomInt(100000, 1000000)); // always 6 digits, CSPRNG
}

/**
 * Send the OTP over WhatsApp using a Meta-approved AUTHENTICATION template.
 * The template name/language are configurable so the flow works the moment the
 * template is approved without a code change.
 */
export async function sendWhatsAppOtp(phone, otp) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const template = process.env.WHATSAPP_OTP_TEMPLATE || 'dotko_otp';
  const lang = process.env.WHATSAPP_OTP_TEMPLATE_LANG || 'en';
  if (!token || !phoneId) throw new Error('WhatsApp is not configured');

  const payload = {
    messaging_product: 'whatsapp',
    to: `91${phone}`,
    type: 'template',
    template: {
      name: template,
      language: { code: lang },
      components: [
        // Body variable {{1}} — the verification code
        { type: 'body', parameters: [{ type: 'text', text: otp }] },
        // Copy-code / one-tap button carries the same code (Meta auth-template format)
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: otp }] },
      ],
    },
  };

  const r = await fetch(`https://graph.facebook.com/v24.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body.error) {
    throw new Error(body.error?.message || `WhatsApp send failed (${r.status})`);
  }
  return body;
}
