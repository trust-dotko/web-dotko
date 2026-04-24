import React from 'react';
import Badge from './Badge';
import { formatCurrency } from '../data/trustEngine';
import { AlertTriangle } from 'lucide-react';

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
            {['Buyer / Party', 'Trade Amount', 'Credit Days', 'Actual Days', 'Delay', 'Status'].map(h => (
              <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4 first:pl-0 last:pr-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {trades.map(trade => {
            const overdue = trade.actualDays - trade.creditDays;
            return (
              <tr key={trade.id} className="hover:bg-slate-50 transition-colors group">
                <td className="py-3.5 px-4 pl-0 font-medium text-slate-800">{trade.buyer}</td>
                <td className="py-3.5 px-4 text-slate-700 font-mono text-xs">
                  {formatCurrency(trade.amount)}
                </td>
                <td className="py-3.5 px-4 text-slate-600">{trade.creditDays}d</td>
                <td className="py-3.5 px-4 text-slate-600">{trade.actualDays}d</td>
                <td className="py-3.5 px-4">
                  {overdue > 0 ? (
                    <span className="text-red-600 font-medium text-xs">+{overdue}d</span>
                  ) : (
                    <span className="text-emerald-600 text-xs">On time</span>
                  )}
                </td>
                <td className="py-3.5 px-4 pr-0">
                  <Badge label={trade.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
