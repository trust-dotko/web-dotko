import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function PendingVerificationBanner({ userGSTIN, onReview }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userGSTIN) return;
    const q = query(
      collection(db, 'companies', userGSTIN, 'trades'),
      where('verificationStatus', '==', 'pending_verification')
    );
    getDocs(q)
      .then(snap => {
        // Exclude trades filed by the user themselves
        const pending = snap.docs.filter(d => d.data().submitterGSTIN !== userGSTIN);
        setCount(pending.length);
      })
      .catch(() => {});
  }, [userGSTIN]);

  if (!count) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
        <div>
          <p className="font-semibold text-amber-900 text-sm">
            {count} trade{count > 1 ? 's' : ''} filed against your business need{count === 1 ? 's' : ''} your review
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            Unverified trades have reduced weight on your trust score. Confirm or dispute within 7 days.
          </p>
        </div>
      </div>
      <button
        onClick={onReview}
        className="flex-shrink-0 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
      >
        Review Trades
      </button>
    </div>
  );
}
