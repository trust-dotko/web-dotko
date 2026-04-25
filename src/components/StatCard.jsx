import React from 'react';

export default function StatCard({ icon: Icon, label, value, sub, accent = false, onClick, className = '' }) {
  return (
    <div
      onClick={onClick}
      className={`
        rounded-xl border p-4 flex items-start gap-3
        ${accent
          ? 'bg-brand-800 border-brand-700 text-white'
          : 'bg-white border-slate-200 shadow-card hover:shadow-card-hover transition-shadow'
        }
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {Icon && (
        <div className={`
          w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
          ${accent ? 'bg-brand-700' : 'bg-brand-50'}
        `}>
          <Icon className={`w-4.5 h-4.5 ${accent ? 'text-white' : 'text-brand-700'}`} size={18} />
        </div>
      )}
      <div>
        <p className={`text-xs font-medium ${accent ? 'text-brand-200' : 'text-slate-500'}`}>{label}</p>
        <p className={`text-xl font-bold leading-tight mt-0.5 ${accent ? 'text-white' : 'text-slate-900'}`}>{value}</p>
        {sub && <p className={`text-xs mt-0.5 ${accent ? 'text-brand-200' : 'text-slate-400'}`}>{sub}</p>}
      </div>
    </div>
  );
}
