/**
 * Trade lifecycle statuses used in the new Submit Trade workflow.
 * Legacy statuses (Paid, Delayed, Unpaid) remain supported for backward compat.
 */
export const TRADE_STATUSES = [
  'Paid on Time',
  'Paid Late',
  'Partially Paid',
  'Default/Written Off',
  'Disputed',
  'Still Pending',
];

// ── Canonical trade-field accessors & status classifiers ────────────────────
// Single source of truth shared by Report.jsx, TradeTable.jsx and the engine
// so counts/volume never drift between views (fixes the old t.amount vs
// t.tradeValue mismatch that showed ₹0).

/** Canonical monetary value of a trade (new `tradeValue`, legacy `amount`). */
export function getTradeAmount(trade) {
  return Number(trade?.tradeValue ?? trade?.amount ?? 0) || 0;
}

/** Counts toward the "Paid / Resolved" metric. */
export function isPaidResolved(status) {
  return status === 'Paid' || status === 'Paid on Time' || status === 'Paid Late';
}

/** Counts toward the "Late / Partial" metric. */
export function isLatePartial(status) {
  return status === 'Delayed' || status === 'Paid Late' || status === 'Partially Paid';
}

/** A hard default / write-off (or legacy unpaid). */
export function isDefault(status) {
  return status === 'Default/Written Off' || status === 'Unpaid';
}

/** Any settled status (payment was ultimately received). */
export function isSettledStatus(status) {
  return ['Paid', 'Paid on Time', 'Paid Late', 'Delayed', 'Partially Paid'].includes(status);
}

// ── Appeal / resolution state machine (derived-on-read) ─────────────────────
// `appealStatus` ∈ none | open | appealed | settled | unresolved_dispute.
// We never need a cron: the locked "unresolved_dispute" terminal state is
// computed from the 7-day `verificationDeadline` whenever a trade is read.

/** Coerce a Firestore Timestamp | ISO string | Date into a Date (or null). */
function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** True once the 7-day appeal/verification window has elapsed. */
export function isDeadlinePassed(deadline) {
  const d = toDate(deadline);
  return d ? d.getTime() < Date.now() : false;
}

/**
 * resolveAppealState — terminal/effective state of a reported default.
 * Expired `open`/`appealed` windows collapse to `unresolved_dispute`.
 */
export function resolveAppealState(trade = {}) {
  const appeal = trade.appealStatus || 'none';
  if (appeal === 'settled') return 'settled';
  if (appeal === 'appealed') return isDeadlinePassed(trade.verificationDeadline) ? 'unresolved_dispute' : 'appealed';
  if (appeal === 'open')     return isDeadlinePassed(trade.verificationDeadline) ? 'unresolved_dispute' : 'open';
  return appeal; // 'none' | 'unresolved_dispute' (already locked) | unknown
}

/** Days remaining in an active appeal window (>=0), or null if not applicable. */
export function appealDaysLeft(trade = {}) {
  const state = resolveAppealState(trade);
  if (state !== 'open' && state !== 'appealed') return null;
  const d = toDate(trade.verificationDeadline);
  if (!d) return null;
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000));
}

/**
 * calculateTrustScore — MVP Logic
 * --------------------------------
 * Five pillars × 20 pts each = 100 max.
 * Trade history applies dynamic deductions on top.
 *
 * @param {Array} trades
 * @param {{
 *   status?: string,
 *   incorporated?: string,
 *   registrationDate?: string,
 *   name?: string,
 *   legalName?: string,
 *   type?: string,
 *   registeredAddress?: string,
 *   city?: string,
 *   state?: string,
 *   isVerified?: boolean,
 *   verifiedByDotko?: boolean,
 * }} businessMeta
 * @returns {{
 *   score: number|null,
 *   autoFlagged: boolean,
 *   factors: Array<{ label: string, delta: number|null, color: string }>
 * }}
 */
export function calculateTrustScore(trades = [], businessMeta = {}) {
  businessMeta = businessMeta ?? {};

  // Inactive / Cancelled GST — not scored
  const inactiveStatuses = ['Cancelled', 'Inactive'];
  if (inactiveStatuses.includes(businessMeta.status)) {
    return {
      score: null,
      autoFlagged: false,
      critical: false,
      tier: 'inactive',
      factors: [{ label: `GST Status: ${businessMeta.status} — Not Scored`, delta: null, color: 'red' }],
    };
  }

  const factors = [];
  let score = 0;

  // ── Pillar 1: Identity & Registration (0 / 10 / 20) ──────────────────────
  {
    const hasName       = !!(businessMeta.name || businessMeta.legalName);
    const hasEntityType = !!businessMeta.type;
    const pts = (hasName && hasEntityType) ? 20 : hasName ? 10 : 0;
    score += pts;
    factors.push({ label: 'Identity & Registration', delta: pts, color: pts === 20 ? 'green' : pts === 10 ? 'amber' : 'red' });
  }

  // ── Pillar 2: Business Age (0 / 10 / 20) ─────────────────────────────────
  {
    const regStr = businessMeta.incorporated || businessMeta.registrationDate;
    let pts = 10; // unknown → partial credit
    if (regStr) {
      const months = (Date.now() - new Date(regStr).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      pts = months >= 36 ? 20 : months >= 6 ? 10 : 0;
    }
    score += pts;
    factors.push({ label: 'Business Age', delta: pts, color: pts === 20 ? 'green' : pts === 10 ? 'amber' : 'red' });
  }

  // ── Pillar 3: GST Compliance (0 / 10 / 20) ───────────────────────────────
  {
    const gstStatus = (businessMeta.status || '').toLowerCase();
    const pts = gstStatus === 'active' ? 20 : (!gstStatus || gstStatus === 'provisional') ? 10 : 0;
    score += pts;
    factors.push({ label: 'GST Compliance', delta: pts, color: pts === 20 ? 'green' : pts === 10 ? 'amber' : 'red' });
  }

  // ── Pillar 4: Transparency & Verification (0 / 10 / 20) ──────────────────
  {
    const hasFullAddress = !!(businessMeta.registeredAddress && (businessMeta.city || businessMeta.state));
    const hasAnyAddress  = !!(businessMeta.registeredAddress || businessMeta.city || businessMeta.state);
    const pts = hasFullAddress ? 20 : hasAnyAddress ? 10 : 0;
    score += pts;
    factors.push({ label: 'Transparency & Verification', delta: pts, color: pts === 20 ? 'green' : pts === 10 ? 'amber' : 'red' });
  }

  // ── Pillar 5: Verified by Dotko (0 / 20) ─────────────────────────────────
  {
    const verified = !!(businessMeta.isVerified || businessMeta.verifiedByDotko);
    const pts = verified ? 20 : 0;
    score += pts;
    factors.push({ label: 'Verified by Dotko', delta: pts, color: pts === 20 ? 'green' : 'red' });
  }

  // ── Dynamic trade-based adjustments ──────────────────────────────────────
  let critical = false;
  if (Array.isArray(trades) && trades.length > 0) {
    const delayed   = trades.filter(t => isLatePartial(t.status));
    const defaulted = trades.filter(t => isDefault(t.status));
    const disputed  = trades.filter(t => t.status === 'Disputed');

    // Weight each negative trade by its appeal/verification state.
    //   • active appeal (appealed, window open)      → 0    (penalty HELD)
    //   • settled                                    → 0    (no penalty)
    //   • unresolved_dispute (window expired)        → 1.0  (full penalty + Critical)
    //   • pending window still open (not yet appealed)→ 0.5
    //   • verified / legacy                          → 1.0
    //   • counterparty-disputed (legacy flag)        → 0.3
    const negativeWeight = (trade) => {
      const appeal = resolveAppealState(trade);
      if (appeal === 'appealed' || appeal === 'settled') return 0;          // penalty held / released
      if (appeal === 'unresolved_dispute' || appeal === 'confirmed') return 1.0; // locked / acknowledged
      if (appeal === 'open') return 0.5;                                    // window still running
      const vs = trade.verificationStatus;
      if (!vs || vs === 'verified') return 1.0;
      if (vs === 'disputed') return 0.3;
      if (vs === 'pending_verification') return 0.5;
      return 1.0;
    };

    // Critical = at least one default that the counterparty acknowledged
    // (`confirmed`) or that locked as an unresolved dispute (window expired),
    // or a legacy verified default.
    critical = defaulted.some(t => {
      const appeal = resolveAppealState(t);
      if (appeal === 'unresolved_dispute' || appeal === 'confirmed') return true;
      if (appeal === 'appealed' || appeal === 'open' || appeal === 'settled') return false;
      const vs = t.verificationStatus;
      return !vs || vs === 'verified'; // legacy default
    });

    const verifiedNegative = [...delayed, ...defaulted, ...disputed]
      .filter(t => negativeWeight(t) === 1.0).length;

    if (delayed.length > 0) {
      const delta = -Math.round(delayed.reduce((s, t) => s + 5 * negativeWeight(t), 0) * 10) / 10;
      score += delta;
      factors.push({ label: `Delayed Trades (${delayed.length})`, delta, color: 'amber' });
    }
    if (defaulted.length > 0) {
      const delta = -Math.round(defaulted.reduce((s, t) => s + 5 * negativeWeight(t), 0) * 10) / 10;
      score += delta;
      factors.push({ label: `Default Trades (${defaulted.length})`, delta, color: 'red' });
    }
    if (disputed.length > 0) {
      const delta = -Math.round(disputed.reduce((s, t) => s + 5 * negativeWeight(t), 0) * 10) / 10;
      score += delta;
      factors.push({ label: `Disputed Trades (${disputed.length})`, delta, color: 'amber' });
    }

    // ── Positive trade-history bonus ─────────────────────────────────────
    // Good behavior should move the score, not just avoid hurting it: paying
    // on time and resolving a reported default (settling) both add points on
    // top of the pillar baseline. Each bucket is capped so trade volume alone
    // can't dominate the registration-based score.
    const cleanPaid = trades.filter(t => t.status === 'Paid on Time' || t.status === 'Paid');
    const settledDisputes = trades.filter(t => resolveAppealState(t) === 'settled');

    if (cleanPaid.length > 0) {
      const bonus = Math.min(cleanPaid.length * 2, 10);
      score += bonus;
      factors.push({ label: `Paid on Time (${cleanPaid.length})`, delta: bonus, color: 'green' });
    }
    if (settledDisputes.length > 0) {
      // Settling weighs more than a routine on-time payment — it reflects an
      // actively resolved dispute, a stronger trust signal.
      const bonus = Math.min(settledDisputes.length * 5, 15);
      score += bonus;
      factors.push({ label: `Resolved Disputes (${settledDisputes.length})`, delta: bonus, color: 'green' });
    }

    // 6+ fully-weighted negative trades → force Red regardless of base score
    if (verifiedNegative >= 6) {
      factors.push({ label: 'Auto-flagged: High Risk (6+ negative trades)', delta: null, color: 'red' });
      const flagged = Math.min(49, Math.max(0, score));
      return { score: flagged, autoFlagged: true, critical, tier: critical ? 'critical' : 'risk', factors };
    }
  }

  const finalScore = Math.max(0, Math.min(100, score));
  const tier = critical ? 'critical' : tierFromScore(finalScore);
  return { score: finalScore, autoFlagged: false, critical, tier, factors };
}

/** Score → base tier (ignores the Critical override, which is trade-driven). */
export function tierFromScore(score) {
  if (score === null || score === undefined) return 'inactive';
  if (score >= 80) return 'safe';
  if (score >= 50) return 'caution';
  return 'risk';
}

/** Human label for a tier. Adds the trade-driven `Critical` tier. */
export const TIER_LABEL = {
  safe:     'Low Risk',
  caution:  'Medium Risk',
  risk:     'High Risk',
  critical: 'Critical',
  inactive: 'Inactive',
};

/** Map a label (or tier key) back to a canonical tier key. */
function toTier(riskOrTier) {
  if (!riskOrTier) return 'inactive';
  if (TIER_LABEL[riskOrTier]) return riskOrTier;               // already a tier key
  switch (riskOrTier) {
    case 'Low Risk':    return 'safe';
    case 'Medium Risk': return 'caution';
    case 'High Risk':   return 'risk';
    case 'Critical':    return 'critical';
    default:            return 'inactive';
  }
}

/** Label for a tier key (e.g. 'critical' → 'Critical'). */
export function getTierLabel(tier) {
  return TIER_LABEL[toTier(tier)] || 'Inactive';
}

/**
 * getRiskLevel — score-only risk label (backward compatible).
 * 80–100 → Low · 50–79 → Medium · 0–49 → High.
 * NOTE: the trade-driven `Critical` tier comes from calculateTrustScore().tier.
 */
export function getRiskLevel(score) {
  if (score >= 80) return 'Low Risk';
  if (score >= 50) return 'Medium Risk';
  return 'High Risk';
}

/**
 * getScoreCaption — the single caption line under the score ring.
 * Avoids the old "Low Risk Risk" double-word bug.
 */
export function getScoreCaption(riskOrTier) {
  const tier = toTier(riskOrTier);
  if (tier === 'inactive') return 'Trust Score · Not Available';
  return `Trust Score · ${TIER_LABEL[tier]} · out of 100`;
}

/** Advisory text shown when a business has no trade history yet. */
export function getBaseScoreNote(score) {
  if (score === null || score === undefined) return 'GST inactive — not scored.';
  return 'No trade history yet — score reflects registration & GST compliance only.';
}

/** getRiskHeadline — short taglines shown alongside the score ring. */
export function getRiskHeadline(riskOrTier) {
  switch (toTier(riskOrTier)) {
    case 'safe':     return 'Verified and Reliable · Safe to Trade · Low Risk Partner';
    case 'caution':  return 'Proceed with Caution · Monitor Closely · Start Small';
    case 'critical': return 'Critical · Unresolved Default on Record · Trade at Your Own Risk';
    case 'risk':     return 'High Risk · Advance Payment Recommended · Manual Review Required';
    default:         return 'GST Inactive · Not Scored';
  }
}

/** getTrustPhrase — advisory sentence shown below the score. */
export function getTrustPhrase(score, tier) {
  const t = tier ? toTier(tier) : tierFromScore(score);
  if (t === 'inactive' || score === null) return null;
  switch (t) {
    case 'safe':     return 'This partner has verified credentials and a reliable track record. You can proceed with standard terms.';
    case 'caution':  return 'This partner has moderate verification. Consider starting with smaller orders or shorter payment cycles.';
    case 'critical': return 'This partner has an unresolved payment default on record. We strongly recommend advance payment and thorough due diligence before trading.';
    default:         return "This partner has limited verification or a concerning trade history. We recommend advance payment or using Dotko's protected payment options.";
  }
}

export function getRiskColors(riskOrTier) {
  switch (toTier(riskOrTier)) {
    case 'safe':     return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
    case 'caution':  return { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500'   };
    case 'risk':     return { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500'     };
    case 'critical': return { bg: 'bg-red-950/5',  text: 'text-red-900',     border: 'border-red-300',     dot: 'bg-red-800'     };
    default:         return { bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200',   dot: 'bg-slate-400'   };
  }
}

/** Ring/stroke color. Pass `tier` to honor the Critical override. */
export function getScoreColor(score, tier) {
  const t = tier ? toTier(tier) : tierFromScore(score);
  switch (t) {
    case 'safe':     return '#10b981'; // emerald
    case 'caution':  return '#f59e0b'; // amber
    case 'critical': return '#7f1d1d'; // deep red (near-black) — locked default
    case 'risk':     return '#ef4444'; // red
    default:         return '#94a3b8'; // slate (inactive/N/A)
  }
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style:                'currency',
    currency:             'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/** Validate GST format: 15-character alphanumeric */
export function isValidGST(gst = '') {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst.trim().toUpperCase());
}

/**
 * Map trade status to report status for admin portal compatibility
 * @param {string} tradeStatus - Status from trade submission
 * @returns {string} Mapped status for reports collection
 */
export function mapTradeStatusToReportStatus(tradeStatus) {
  const statusMap = {
    'Paid on Time':      'resolved',
    'Paid Late':         'resolved',
    'Partially Paid':    'under_discussion',
    'Default/Written Off': 'published',
    'Disputed':          'published',
    'Still Pending':     'pending'
  };
  return statusMap[tradeStatus] || 'pending';
}

/**
 * Map trade type to complaint type for admin portal compatibility
 * @param {string} tradeType - Type from trade submission
 * @returns {string} Mapped complaint type for reports collection
 */
export function mapTradeTypeToComplaintType(tradeType) {
  const typeMap = {
    'Sale':             'Payment Issue',
    'Purchase':         'Payment Issue',
    'Service Provided':  'Service Issue',
    'Service Received':  'Service Issue'
  };
  return typeMap[tradeType] || 'Payment Issue';
}
