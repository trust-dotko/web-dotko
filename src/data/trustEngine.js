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
 * calculateTrustScore
 * -------------------
 * @param {Array} trades
 * @param {{ status?: string, registrationDate?: string }} businessMeta
 * @returns {{ score: number, factors: Array<{ label: string, delta: number|null, color: string }> }}
 */
export function calculateTrustScore(trades = [], businessMeta = {}) {
  businessMeta = businessMeta ?? {};

  const hasTrades = Array.isArray(trades) && trades.length > 0;

  const factors = [];
  let score;

  if (hasTrades) {
    factors.push({ label: 'Base score', delta: 100, color: 'neutral' });
    score = 100;

    // --- Legacy statuses (backward compat) ---
    const unpaid  = trades.filter(t => t.status === 'Unpaid').length;
    const delayed = trades.filter(t => t.status === 'Delayed').length;
    const late    = trades.filter(t => t.status === 'Paid' && t.actualDays > t.creditDays).length;

    if (unpaid > 0) {
      const delta = -(unpaid * 20);
      score += delta;
      factors.push({ label: `Unpaid trades (${unpaid} × −20)`, delta, color: 'red' });
    }
    if (delayed > 0) {
      const delta = -(delayed * 10);
      score += delta;
      factors.push({ label: `Delayed trades (${delayed} × −10)`, delta, color: 'amber' });
    }
    if (late > 0) {
      const delta = -(late * 5);
      score += delta;
      factors.push({ label: `Late payments (${late} × −5)`, delta, color: 'amber' });
    }

    // --- New lifecycle statuses ---
    const defaulted  = trades.filter(t => t.status === 'Default/Written Off').length;
    const paidLate   = trades.filter(t => t.status === 'Paid Late').length;
    const partial    = trades.filter(t => t.status === 'Partially Paid').length;
    const disputed   = trades.filter(t => t.status === 'Disputed').length;
    const pending    = trades.filter(t => t.status === 'Still Pending').length;

    if (defaulted > 0) {
      const delta = -(defaulted * 30);
      score += delta;
      factors.push({ label: `Default/Written Off (${defaulted} × −30)`, delta, color: 'red' });
    }
    if (partial > 0) {
      const delta = -(partial * 15);
      score += delta;
      factors.push({ label: `Partially Paid (${partial} × −15)`, delta, color: 'red' });
    }
    if (disputed > 0) {
      const delta = -(disputed * 10);
      score += delta;
      factors.push({ label: `Disputed trades (${disputed} × −10)`, delta, color: 'amber' });
    }
    if (paidLate > 0) {
      const delta = -(paidLate * 5);
      score += delta;
      factors.push({ label: `Paid Late (${paidLate} × −5)`, delta, color: 'amber' });
    }
    if (pending > 0) {
      const delta = -(pending * 5);
      score += delta;
      factors.push({ label: `Still Pending (${pending} × −5)`, delta, color: 'amber' });
    }
  } else {
    // No trade history — neutral base, businessMeta checks still apply
    score = 50;
  }

  // New-business penalty (< 30 days since registration) — always evaluated
  if (businessMeta.registrationDate) {
    const reg  = new Date(businessMeta.registrationDate);
    const now  = new Date();
    const days = Math.floor((now - reg) / (1000 * 60 * 60 * 24));
    if (days < 30) {
      score -= 20;
      factors.push({ label: 'New Business (< 30 days)', delta: -20, color: 'amber' });
    }
  }

  // GST Cancelled / Inactive cap — always evaluated
  const cappedStatuses = ['Cancelled', 'Inactive'];
  if (cappedStatuses.includes(businessMeta.status)) {
    const capActive = score > 30;
    factors.push({
      label: `GST Status: ${businessMeta.status}`,
      delta: capActive ? null : 0, // null → "capped at 30"; 0 → already below, no extra reduction
      color: 'red',
    });
    score = Math.min(score, 30);
  }

  return { score: Math.max(0, Math.min(100, score)), factors };
}

/**
 * getRiskLevel
 * ------------
 * 75–100 → Low
 * 40–74  → Medium
 * 0–39   → High
 */
export function getRiskLevel(score) {
  if (score >= 75) return 'Low';
  if (score >= 40) return 'Medium';
  return 'High';
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
  if (score >= 75) return '#10b981'; // emerald
  if (score >= 40) return '#f59e0b'; // amber
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
