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
  if (Array.isArray(trades) && trades.length > 0) {
    const delayed   = trades.filter(t => ['Delayed', 'Paid Late', 'Partially Paid'].includes(t.status));
    const defaulted = trades.filter(t => ['Default/Written Off', 'Unpaid'].includes(t.status));
    const disputed  = trades.filter(t => t.status === 'Disputed');
    const negative  = delayed.length + defaulted.length + disputed.length;

    if (delayed.length > 0) {
      const delta = -(delayed.length * 5);
      score += delta;
      factors.push({ label: `Delayed Trades (${delayed.length} × −5)`, delta, color: 'amber' });
    }
    if (defaulted.length > 0) {
      const delta = -(defaulted.length * 5);
      score += delta;
      factors.push({ label: `Default Trades (${defaulted.length} × −5)`, delta, color: 'red' });
    }
    if (disputed.length > 0) {
      const delta = -(disputed.length * 5);
      score += delta;
      factors.push({ label: `Disputed Trades (${disputed.length} × −5)`, delta, color: 'amber' });
    }

    // 6+ negative trades → force Red regardless of base score
    if (negative >= 6) {
      factors.push({ label: 'Auto-flagged: High Risk (6+ negative trades)', delta: null, color: 'red' });
      return { score: Math.min(49, Math.max(0, score)), autoFlagged: true, factors };
    }
  }

  return { score: Math.max(0, Math.min(100, score)), autoFlagged: false, factors };
}

/**
 * getRiskLevel
 * ------------
 * 80–100 → Low   (Green)
 * 50–79  → Medium (Yellow)
 * 0–49   → High  (Red)
 */
export function getRiskLevel(score) {
  if (score >= 80) return 'Low';
  if (score >= 50) return 'Medium';
  return 'High';
}

/**
 * getRiskHeadline — short taglines shown alongside the score ring.
 */
export function getRiskHeadline(risk) {
  switch (risk) {
    case 'Low':    return 'Verified and Reliable · Safe to Trade · Low Risk Partner';
    case 'Medium': return 'Proceed with Caution · Monitor Closely · Start Small';
    default:       return 'High Risk · Advance Payment Recommended · Manual Review Required';
  }
}

/**
 * getTrustPhrase — advisory sentence shown below the score.
 */
export function getTrustPhrase(score) {
  if (score === null) return null;
  if (score >= 80) return "This partner has verified credentials and a reliable track record. You can proceed with standard terms.";
  if (score >= 50) return "This partner has moderate verification. Consider starting with smaller orders or shorter payment cycles.";
  return "This partner has limited verification or a concerning trade history. We recommend advance payment or using Dotko's protected payment options.";
}

export function getRiskColors(risk) {
  switch (risk) {
    case 'Low':    return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
    case 'Medium': return { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500'   };
    case 'High':   return { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500'     };
    default:       return { bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200',   dot: 'bg-slate-400'   };
  }
}

export function getScoreColor(score) {
  if (score >= 80) return '#10b981'; // emerald / green
  if (score >= 50) return '#f59e0b'; // amber  / yellow
  return '#ef4444';                  // red
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
