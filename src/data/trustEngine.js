/**
 * calculateTrustScore
 * -------------------
 * Rules:
 *  - No trades           → score = 50
 *  - Start score         = 100
 *  - status === 'Delayed' → -10
 *  - status === 'Unpaid'  → -20
 *  - actualDays > creditDays (AND not already penalised by status) → -5
 *  - Floor at 0, ceil at 100
 */
export function calculateTrustScore(trades = []) {
  if (!trades || trades.length === 0) return 50;

  let score = 100;

  for (const trade of trades) {
    if (trade.status === 'Unpaid') {
      score -= 20;
    } else if (trade.status === 'Delayed') {
      score -= 10;
    } else if (trade.actualDays > trade.creditDays) {
      // Paid but took longer than credit window
      score -= 5;
    }
  }

  return Math.max(0, Math.min(100, score));
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
