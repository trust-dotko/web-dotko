import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, AlertCircle, Loader2 } from 'lucide-react';
import { isValidGST } from '../data/trustEngine';
import { verifyGSTIN } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

const FREE_SEARCH_LIMIT = 1;

export default function GSTSearchBar({ large = false, placeholder = 'Enter GSTIN to check trust score...' }) {
  const [value, setValue]     = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSearch = async (gst = value) => {
    const q = gst.trim().toUpperCase();
    setError('');

    if (!isValidGST(q)) {
      setError('Enter a valid 15-character GSTIN (e.g. 24CUUPP7030B1ZL)');
      return;
    }

    // Check search limit for non-authenticated users
    if (!user) {
      const count = parseInt(localStorage.getItem('dtk_search_count') || '0', 10);
      if (count >= FREE_SEARCH_LIMIT) {
        // Smoothly navigate to signup if they've used their free search
        navigate('/signup', { state: { prefillGst: q } });
        return;
      }
    }

    setLoading(true);
    try {
      const result = await verifyGSTIN(q);
      
      // Successfully got data, now increment guest counter if applicable
      if (!user) {
        const count = parseInt(localStorage.getItem('dtk_search_count') || '0', 10);
        localStorage.setItem('dtk_search_count', String(count + 1));
      }

      // Smooth transition to report
      navigate(`/report/${q}`, { state: { gstData: result.data } });
    } catch (err) {
      const msg = err?.message || 'Failed to fetch GST data. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = large
    ? 'flex-1 text-base px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 placeholder-slate-400'
    : 'flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 placeholder-slate-400';

  const btnCls = large
    ? 'bg-brand-800 text-white font-semibold px-6 py-3 rounded-xl hover:bg-brand-700 transition-colors flex items-center gap-2 disabled:opacity-60'
    : 'bg-brand-800 text-white font-medium px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-2 disabled:opacity-60';

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <input
          id="gst-search-input"
          type="text"
          value={value}
          onChange={e => { setValue(e.target.value.toUpperCase()); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder={placeholder}
          className={inputCls}
          maxLength={15}
        />
        <button id="gst-search-btn" onClick={() => handleSearch()} disabled={loading} className={btnCls}>
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Search className="w-4 h-4" />
          }
          {large && !loading && 'Search'}
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-red-600 text-sm mt-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
