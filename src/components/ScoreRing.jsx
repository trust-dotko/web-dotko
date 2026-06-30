import React, { useState } from 'react';
import { getScoreColor, getTierLabel, getScoreCaption, tierFromScore } from '../data/trustEngine';
import Badge from './Badge';
import TrustScoreInfoModal from './TrustScoreInfoModal';

export default function ScoreRing({ score, tier }) {
  const [showInfo, setShowInfo] = useState(false);

  const isNA      = score === null;
  // Prefer the engine-provided tier (carries the trade-driven Critical state);
  // fall back to score-derived tier for callers that don't pass it.
  const effTier   = isNA ? 'inactive' : (tier || tierFromScore(score));
  const label     = getTierLabel(effTier);
  const color     = getScoreColor(score, effTier);
  const radius     = 54;
  const circ   = 2 * Math.PI * radius;
  const dash   = isNA ? circ : circ - (score / 100) * circ;

  return (
    <>
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
            {/* Progress — hidden (full dash offset) when N/A, showing only the gray track */}
            {!isNA && (
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
            )}
          </svg>
          {/* Centre label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {isNA ? (
              <span className="text-4xl font-bold text-slate-400 leading-none">N/A</span>
            ) : (
              <>
                <span className="text-4xl font-bold text-slate-900 leading-none">{score}</span>
                <span className="text-xs text-slate-500 mt-1">/ 100</span>
              </>
            )}
          </div>
        </div>

        <Badge label={isNA ? 'Inactive' : label} size="lg" />

        <p className="text-xs text-slate-500">
          {getScoreCaption(effTier)}
        </p>

        <button
          onClick={() => setShowInfo(true)}
          className="text-xs text-slate-400 hover:text-brand-800 transition-colors underline underline-offset-2 decoration-dotted -mt-1"
        >
          How is trust score calculated?
        </button>
      </div>

      {showInfo && <TrustScoreInfoModal onClose={() => setShowInfo(false)} />}
    </>
  );
}
