import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, AlertCircle, Loader2 } from 'lucide-react';
import { isValidGST } from '../data/trustEngine';
import { verifyGSTIN } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

const FREE_SEARCH_LIMIT = 1;
const EXAMPLE_GSTS = ['27AADCB2230M1ZP', '29ABCFM9634R1ZF', '07AAHCS1429D1ZX'];

export default function GSTSearchBar({ large = false, placeholder = 'Enter GSTIN…' }) {
  const [value, setValue]     = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSearch = async (gst = value) => {
    const q = gst.trim().toUpperCase();
    setError('');

    if (!isValidGST(q)) {
      setError('Enter a valid 15-character GSTIN (e.g. 27AADCB2230M1ZP)');
      return;
    }

    // Enforce free search limit for non-authenticated users
    if (!user) {
      const count = parseInt(localStorage.getItem('dtk_search_count') || '0', 10);
      if (count >= FREE_SEARCH_LIMIT) {
        navigate('/login');
        return;
      }
      localStorage.setItem('dtk_search_count', String(count + 1));
    }

    setLoading(true);
    try {
      const result = await verifyGSTIN(q);
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
          onChange={e => { setValue(e.target.value); setError(''); }}
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
        <p className="flex items-center gap-1.5 text-red-600 text-sm mt-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </p>
      )}

      {large && (
        <div className="flex flex-wrap gap-2 mt-3 justify-center">
          <span className="text-xs text-slate-400">Try:</span>
          {EXAMPLE_GSTS.map(g => (
            <button
              key={g}
              onClick={() => { setValue(g); handleSearch(g); }}
              className="text-xs text-brand-600 hover:text-brand-800 font-mono underline underline-offset-2"
            >
              {g}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
