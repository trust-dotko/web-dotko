import React from 'react';
import Badge from './Badge';
import { formatCurrency, formatDate } from '../data/trustEngine';
import { AlertTriangle } from 'lucide-react';

const STATUS_COLORS = {
  'Paid on Time':        'text-emerald-600',
  'Paid Late':           'text-amber-600',
  'Partially Paid':      'text-orange-600',
  'Default/Written Off': 'text-red-600',
  'Disputed':            'text-purple-600',
  'Still Pending':       'text-slate-500',
  // legacy
  'Paid':    'text-emerald-600',
  'Delayed': 'text-amber-600',
  'Unpaid':  'text-red-600',
};

export default function TradeTable({ trades }) {
  if (!trades || trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <AlertTriangle className="w-8 h-8 mb-3 text-amber-400" />
        <p className="font-medium text-slate-500">No trade records found</p>
        <p className="text-sm mt-1">Score defaulted to 50 due to no trade history</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {['Reported By', 'Trade Amount', 'Credit Period', 'Due Date', 'Status'].map(h => (
              <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4 first:pl-0 last:pr-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {trades.map(trade => {
            // submitterName = who filed the report; shown on the counterparty's report page
            const partyName    = trade.submitterName     || trade.buyer            || '—';
            const partyGSTIN   = trade.submitterGSTIN    || null;
            const amount       = trade.tradeValue        ?? trade.amount           ?? 0;
            const creditPeriod = trade.creditPeriod      ?? trade.creditDays       ?? null;
            const dueDate      = trade.paymentDueDate    || null;
            // For legacy trades: compute delay indicator
            const legacyOverdue = (trade.actualDays != null && trade.creditDays != null)
              ? trade.actualDays - trade.creditDays
              : null;

            const isDefaulted = trade.status === 'Default/Written Off' || trade.status === 'Unpaid';

            return (
              <tr
                key={trade.id}
                className={`hover:bg-slate-50 transition-colors group ${isDefaulted ? 'border-l-4 border-l-red-500 bg-red-50/40' : ''}`}
              >
                {/* Party — who submitted this trade report */}
                <td className="py-3.5 px-4 pl-0">
                  <p className="font-medium text-slate-800">{partyName}</p>
                  {partyGSTIN && (
                    <p className="font-mono text-xs text-slate-400 mt-0.5">{partyGSTIN}</p>
                  )}
                  {trade.tradeType && (
                    <p className="text-xs text-slate-400 mt-0.5">{trade.tradeType}</p>
                  )}
                </td>

                {/* Amount */}
                <td className="py-3.5 px-4 text-slate-700 font-mono text-xs">
                  {amount > 0
                    ? <span className={isDefaulted ? 'font-bold text-base text-red-700' : ''}>
                        {formatCurrency(amount)}
                      </span>
                    : '—'}
                </td>

                {/* Credit Period */}
                <td className="py-3.5 px-4 text-slate-600">
                  {creditPeriod != null ? `${creditPeriod}d` : '—'}
                </td>

                {/* Due Date */}
                <td className="py-3.5 px-4 text-slate-600 text-xs">
                  {dueDate
                    ? formatDate(dueDate)
                    : legacyOverdue != null
                      ? (legacyOverdue > 0
                          ? <span className="text-red-600 font-medium">+{legacyOverdue}d late</span>
                          : <span className="text-emerald-600">On time</span>)
                      : '—'}
                </td>

                {/* Status */}
                <td className="py-3.5 px-4 pr-0">
                  <Badge label={trade.status} />
                  {isDefaulted && (
                    <span className="ml-1 text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">DEFAULT</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
