import React from 'react';
import { getScoreColor, getRiskLevel } from '../data/trustEngine';
import Badge from './Badge';

export default function ScoreRing({ score }) {
  const risk   = getRiskLevel(score);
  const color  = getScoreColor(score);
  const radius = 54;
  const circ   = 2 * Math.PI * radius;
  const dash   = circ - (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-40 h-40 score-pulse rounded-full">
        <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
          {/* Track */}
          <circle
            cx="70" cy="70" r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="10"
          />
          {/* Progress */}
          <circle
            cx="70" cy="70" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={dash}
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        {/* Centre label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-slate-900 leading-none">{score}</span>
          <span className="text-xs text-slate-500 mt-1">/ 100</span>
        </div>
      </div>
      <Badge label={risk} size="lg" />
      <p className="text-xs text-slate-500">Trust Score · {risk} Risk</p>
    </div>
  );
}
