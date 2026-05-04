import React from 'react';
import { X, ShieldCheck, Clock, Building2, FileCheck, Award, BadgeCheck } from 'lucide-react';

const PILLARS = [
  {
    icon: Building2,
    label: 'Identity & Registration',
    points: 20,
    desc: 'Business name, entity type, and GSTIN registration details.',
  },
  {
    icon: Clock,
    label: 'Business Age',
    points: 20,
    desc: '20 pts for 3+ years · 10 pts for 6 months–3 years · 0 pts for under 6 months.',
  },
  {
    icon: FileCheck,
    label: 'GST Compliance',
    points: 20,
    desc: '20 pts if GST status is Active · 10 pts if unknown/provisional · 0 pts if Cancelled.',
  },
  {
    icon: BadgeCheck,
    label: 'Transparency & Verification',
    points: 20,
    desc: 'Full registered address and location details disclosed on the GST portal.',
  },
  {
    icon: Award,
    label: 'Verified by Dotko',
    points: 20,
    desc: 'Business has been reviewed and manually verified by the Dotko team.',
  },
];

const TIERS = [
  {
    range: '80 – 100',
    label: 'Verified and Reliable',
    tags: ['Safe to Trade', 'Low Risk Partner'],
    phrase: 'This partner has verified credentials and a reliable track record. You can proceed with standard terms.',
    desc: 'Strong foundational credentials — consider for standard credit terms.',
    color: 'emerald',
    hex: '#10b981',
  },
  {
    range: '50 – 79',
    label: 'Proceed with Caution',
    tags: ['Monitor Closely', 'Start Small'],
    phrase: 'This partner has moderate verification. Consider starting with smaller orders or shorter payment cycles.',
    desc: 'Moderate credentials — recommend limited exposure, shorter payment terms, or partial advance.',
    color: 'amber',
    hex: '#f59e0b',
  },
  {
    range: '0 – 49',
    label: 'High Risk',
    tags: ['Advance Payment Recommended', 'Manual Review Required'],
    phrase: "This partner has limited verification or a concerning trade history. We recommend advance payment or using Dotko's protected payment options.",
    desc: 'Limited verification — protect transactions with upfront payment or escrow.',
    color: 'red',
    hex: '#ef4444',
  },
];

const ADJUSTMENTS = [
  { status: 'Paid on Time', effect: 'No change', color: 'emerald' },
  { status: 'Delayed', effect: '−5 points', color: 'amber' },
  { status: 'Default / Written Off', effect: '−5 points', color: 'red' },
  { status: '6 or more negative trades', effect: 'Auto-flagged as High Risk regardless of base score', color: 'red' },
];

const tierStyle = {
  emerald: {
    bar: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200',
    text: 'text-emerald-700', tag: 'bg-emerald-100 text-emerald-700',
  },
  amber: {
    bar: 'bg-amber-400', bg: 'bg-amber-50', border: 'border-amber-200',
    text: 'text-amber-700', tag: 'bg-amber-100 text-amber-700',
  },
  red: {
    bar: 'bg-red-500', bg: 'bg-red-50', border: 'border-red-200',
    text: 'text-red-700', tag: 'bg-red-100 text-red-700',
  },
};

const adjustmentStyle = {
  emerald: { dot: 'bg-emerald-500', text: 'text-emerald-700 font-semibold' },
  amber:   { dot: 'bg-amber-400',   text: 'text-amber-700 font-semibold'   },
  red:     { dot: 'bg-red-500',     text: 'text-red-700 font-semibold'     },
};

export default function TrustScoreInfoModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white w-full sm:max-w-xl sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col">

        {/* Sticky header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between rounded-t-2xl z-10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-800 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm leading-tight">How Trust Score is Calculated</h2>
              <p className="text-xs text-slate-400">Dotko Trust Score · MVP Logic</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-5 py-5 space-y-6">

          {/* Intro */}
          <p className="text-sm text-slate-600 leading-relaxed">
            The Dotko Trust Score is calculated out of{' '}
            <span className="font-semibold text-slate-900">100 points</span> using five inputs,
            each worth <span className="font-semibold text-slate-900">20 points</span>. Each input
            is scored as <span className="font-medium">0</span> (not met),{' '}
            <span className="font-medium">10</span> (partially met), or{' '}
            <span className="font-medium">20</span> (fully met).
          </p>

          {/* Five Pillars */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Five Pillars · 20 pts each
            </h3>
            <div className="space-y-2">
              {PILLARS.map(({ icon: Icon, label, points, desc }, i) => (
                <div
                  key={label}
                  className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <div className="w-8 h-8 rounded-lg bg-brand-800/8 border border-brand-800/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-brand-800" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-800">{label}</span>
                      <span className="text-xs font-bold text-brand-800 tabular-nums shrink-0">
                        {points} pts
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Score Tiers */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Score Thresholds
            </h3>
            <div className="space-y-2">
              {TIERS.map(({ range, label, tags, phrase, desc, color }) => {
                const s = tierStyle[color];
                return (
                  <div key={range} className={`rounded-xl border ${s.bg} ${s.border} p-3.5`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${s.bar} shrink-0`} />
                      <span className={`text-sm font-bold ${s.text}`}>{label}</span>
                      <span className={`ml-auto text-xs font-bold tabular-nums ${s.text} opacity-60`}>
                        {range}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {tags.map(t => (
                        <span key={t} className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.tag}`}>
                          {t}
                        </span>
                      ))}
                    </div>
                    <p className={`text-xs ${s.text} leading-relaxed opacity-80`}>{desc}</p>
                    <p className={`text-xs ${s.text} leading-relaxed mt-1.5 italic opacity-70`}>
                      "{phrase}"
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Dynamic Adjustments */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Dynamic Trade Adjustments
            </h3>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Trade Status
                    </th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Score Impact
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ADJUSTMENTS.map(({ status, effect, color }, i) => {
                    const s = adjustmentStyle[color];
                    return (
                      <tr
                        key={status}
                        className={`border-b border-slate-100 last:border-0 ${i % 2 === 1 ? 'bg-slate-50/60' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot} shrink-0`} />
                            <span className="text-xs font-medium text-slate-700">{status}</span>
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-xs ${s.text}`}>{effect}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
              The more <span className="font-medium text-emerald-600">Paid on Time</span> trades a business has, the lower the risk classification. The more{' '}
              <span className="font-medium text-red-600">Delayed or Default</span> trades, the higher the risk.
            </p>
          </section>

          {/* Footer note */}
          <div className="rounded-xl bg-brand-800/5 border border-brand-800/10 px-4 py-3 mb-1">
            <p className="text-xs text-brand-800 leading-relaxed">
              <span className="font-semibold">MVP Design —</span> This logic is simple to implement,
              explainable to users, and adaptable as more data becomes available. No manual calls,
              no complex algorithms required.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
