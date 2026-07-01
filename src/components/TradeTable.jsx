import React from 'react';
import { formatCurrency, formatDate, getBaseScoreNote, getTradeAmount } from '../data/trustEngine';
import { AlertTriangle } from 'lucide-react';

const STATUS_COLORS = {
  'Paid on Time':        'text-emerald-600',
  'Paid Late':           'text-amber-600',
  'Partially Paid':      'text-orange-600',
  'Default/Written Off': 'text-red-600',
  'Disputed':            'text-purple-600',
  'Still Pending':       'text-slate-500',
  'Paid':                'text-emerald-600',
  'Delayed':             'text-amber-600',
  'Unpaid':              'text-red-600',
};

const STATUS_REMARKS = {
  'Paid on Time':        'Settled on time',
  'Paid Late':           'Settled (late)',
  'Partially Paid':      'Partially settled',
  'Default/Written Off': 'Unpaid – Written off',
  'Disputed':            'Disputed',
  'Still Pending':       'Unpaid – Pending',
  'Paid':                'Settled',
  'Delayed':             'Settled (late)',
  'Unpaid':              'Unpaid',
};

const VERIFICATION_CHIPS = {
  pending_verification: { label: 'Pending Verification', cls: 'bg-slate-100 text-slate-500' },
  disputed:             { label: 'Disputed by Party',    cls: 'bg-amber-50 text-amber-600 border border-amber-200' },
  expired:              { label: 'Unverified',           cls: 'bg-slate-100 text-slate-400' },
};

function getDaysDue(trade) {
  const settled = ['Paid on Time', 'Paid', 'Paid Late', 'Delayed', 'Partially Paid'].includes(trade.status);
  const dueDate = trade.paymentDueDate;
  const creditPeriod = trade.creditPeriod ?? trade.creditDays;

  if (settled && creditPeriod != null) {
    return { label: `${creditPeriod}d`, cls: 'text-slate-600' };
  }

  if (dueDate) {
    const daysOverdue = Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000);
    if (daysOverdue > 0)  return { label: `+${daysOverdue}d overdue`, cls: 'text-red-600 font-medium' };
    if (daysOverdue < 0)  return { label: `Due in ${-daysOverdue}d`, cls: 'text-emerald-600' };
    return { label: 'Due today', cls: 'text-amber-600 font-medium' };
  }

  if (creditPeriod != null) return { label: `${creditPeriod}d`, cls: 'text-slate-600' };
  return { label: '—', cls: 'text-slate-400' };
}

function resolveVerificationStatus(trade) {
  const vs = trade.verificationStatus;
  if (!vs || vs === 'verified') return null;
  if (vs === 'pending_verification' && trade.verificationDeadline) {
    const deadline = trade.verificationDeadline?.toDate?.() || new Date(trade.verificationDeadline);
    if (deadline < new Date()) return 'expired';
  }
  return vs;
}

const PUBLIC_HEADERS  = ['Reported By', 'Amount', 'Invoice Date', 'Due Date', 'Days Due', 'Remark'];
const PDF_ONLY_HEADER = 'Invoice No.';

export default function TradeTable({ trades, score }) {
  if (!trades || trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <AlertTriangle className="w-8 h-8 mb-3 text-amber-400" />
        <p className="font-medium text-slate-500">No trade records found</p>
        <p className="text-sm mt-1">{getBaseScoreNote(score)}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {PUBLIC_HEADERS.map(h => (
              <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4 first:pl-0">
                {h}
              </th>
            ))}
            <th className="pdf-only text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4">
              {PDF_ONLY_HEADER}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {trades.map(trade => {
            const partyName   = trade.submitterName  || trade.buyer || '—';
            const partyGSTIN  = trade.submitterGSTIN || null;
            const amount      = getTradeAmount(trade);
            const invoiceDate = trade.invoiceDate || null;
            const dueDate     = trade.paymentDueDate || null;
            const daysDue     = getDaysDue(trade);
            const remark      = STATUS_REMARKS[trade.status] || trade.status || '—';
            const vStatus     = resolveVerificationStatus(trade);
            const chip        = vStatus ? VERIFICATION_CHIPS[vStatus] : null;
            const isDefaulted = trade.status === 'Default/Written Off' || trade.status === 'Unpaid';

            return (
              <tr
                key={trade.id}
                className={`hover:bg-slate-50 transition-colors ${isDefaulted ? 'border-l-4 border-l-red-500 bg-red-50/40' : ''}`}
              >
                {/* Reported By */}
                <td className="py-3.5 px-4 pl-0">
                  <p className="font-medium text-slate-800">{partyName}</p>
                  {partyGSTIN && <p className="font-mono text-xs text-slate-400 mt-0.5">{partyGSTIN}</p>}
                  {trade.tradeType && <p className="text-xs text-slate-400 mt-0.5">{trade.tradeType}</p>}
                </td>

                {/* Amount */}
                <td className="py-3.5 px-4 text-slate-700 font-mono text-xs">
                  {amount > 0
                    ? <span className={isDefaulted ? 'font-bold text-base text-red-700' : ''}>{formatCurrency(amount)}</span>
                    : '—'}
                </td>

                {/* Invoice Date */}
                <td className="py-3.5 px-4 text-slate-600 text-xs">
                  {invoiceDate ? formatDate(invoiceDate) : '—'}
                </td>

                {/* Due Date */}
                <td className="py-3.5 px-4 text-slate-600 text-xs">
                  {dueDate ? formatDate(dueDate) : '—'}
                </td>

                {/* Days Due */}
                <td className={`py-3.5 px-4 text-xs ${daysDue.cls}`}>
                  {daysDue.label}
                </td>

                {/* Remark */}
                <td className="py-3.5 px-4">
                  <span className={`text-xs font-medium ${STATUS_COLORS[trade.status] || 'text-slate-500'}`}>
                    {remark}
                  </span>
                  {isDefaulted && (
                    <span className="ml-1.5 text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">DEFAULT</span>
                  )}
                  {chip && (
                    <span className={`block mt-1 text-xs px-1.5 py-0.5 rounded w-fit ${chip.cls}`}>
                      {chip.label}
                    </span>
                  )}
                </td>

                {/* Invoice No. — visible only in PDF download */}
                <td className="pdf-only py-3.5 px-4 text-slate-600 text-xs font-mono">
                  {trade.invoiceNumber || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
