// web/api/_whatsapp.js
//
// Shared WhatsApp Cloud API sender. Used by OTP delivery and by trade/appeal
// lifecycle notifications so there is ONE place that talks to Meta's Graph API.
//
// IMPORTANT: free-form WhatsApp text is disallowed outside the 24h service
// window, so every message goes out as a Meta-APPROVED TEMPLATE. Template names
// are env-configurable, so new events light up the moment the template is
// approved — no code change required. Until a template is approved the send
// throws/returns a skip; callers for non-OTP events MUST treat delivery as
// best-effort (try/catch) and never block the primary Firestore write.

const GRAPH_VERSION = 'v24.0';

/** True only when the Cloud API credentials are present (server-side env). */
export function whatsappConfigured() {
  return !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/**
 * Send a Meta-approved WhatsApp template message.
 * @param {string|null} phone  10-digit Indian mobile (no country code), or null/empty to skip.
 * @param {{template:string, lang?:string, bodyParams?:Array, buttonParam?:string|null}} opts
 */
export async function sendWhatsAppTemplate(phone, { template, lang = 'en', bodyParams = [], buttonParam = null }) {
  if (!phone) return { skipped: 'no-phone' };
  if (!whatsappConfigured()) return { skipped: 'not-configured' };
  if (!template) throw new Error('WhatsApp template name is required');

  const token   = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const components = [];
  if (bodyParams.length) {
    components.push({ type: 'body', parameters: bodyParams.map(t => ({ type: 'text', text: String(t) })) });
  }
  if (buttonParam != null) {
    // Copy-code / one-tap URL button (Meta auth-template format)
    components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: String(buttonParam) }] });
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: `91${phone}`,
    type: 'template',
    template: { name: template, language: { code: lang }, ...(components.length ? { components } : {}) },
  };

  const r = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body.error) throw new Error(body.error?.message || `WhatsApp send failed (${r.status})`);
  return body;
}

// Trade/appeal lifecycle templates (configurable; approved separately in Meta).
const TRADE_TEMPLATES = {
  report_filed:   process.env.WHATSAPP_TRADE_REPORT_TEMPLATE  || 'dotko_report_filed',
  appeal_opened:  process.env.WHATSAPP_TRADE_APPEAL_TEMPLATE  || 'dotko_appeal_opened',
  settled:        process.env.WHATSAPP_TRADE_SETTLED_TEMPLATE || 'dotko_trade_settled',
  default_locked: process.env.WHATSAPP_TRADE_LOCKED_TEMPLATE  || 'dotko_default_locked',
};

/**
 * Best-effort lifecycle notification. Never throws to the caller's main flow —
 * resolves to a {skipped|error|...} object so a failed/unapproved template can't
 * block a trade write or appeal.
 */
export async function notifyWhatsAppTradeEvent(phone, event, bodyParams = []) {
  const template = TRADE_TEMPLATES[event];
  if (!template) return { skipped: 'unknown-event' };
  try {
    return await sendWhatsAppTemplate(phone, { template, bodyParams });
  } catch (err) {
    return { error: err.message };
  }
}
