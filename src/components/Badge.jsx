import React from 'react';

const variants = {
  Paid:    'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Delayed: 'bg-amber-50  text-amber-700   border border-amber-200',
  Unpaid:  'bg-red-50    text-red-700     border border-red-200',
  Low:     'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Medium:  'bg-amber-50  text-amber-700   border border-amber-200',
  High:    'bg-red-50    text-red-700     border border-red-200',
  default: 'bg-slate-100 text-slate-600   border border-slate-200',
};

const dots = {
  Paid:    'bg-emerald-500',
  Delayed: 'bg-amber-500',
  Unpaid:  'bg-red-500',
  Low:     'bg-emerald-500',
  Medium:  'bg-amber-500',
  High:    'bg-red-500',
  default: 'bg-slate-400',
};

export default function Badge({ label, showDot = true, size = 'sm' }) {
  const cls  = variants[label] || variants.default;
  const dot  = dots[label]     || dots.default;
  const text = size === 'lg' ? 'text-sm px-3 py-1' : 'text-xs px-2 py-0.5';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${cls} ${text}`}>
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
      {label}
    </span>
  );
}
