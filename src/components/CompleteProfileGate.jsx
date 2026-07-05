import React, { useState } from 'react';
import { Loader2, ShieldCheck, Building2, AlertCircle, Search, LogOut, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { verifyGSTIN } from '../config/firebase';
import { isValidGST } from '../data/trustEngine';

/**
 * CompleteProfileGate — full-screen popup shown after signup (and to any
 * authenticated user whose profile isn't complete). The user enters their GSTIN;
 * we auto-fetch the business details from the public GST registry, they review
 * and confirm, and the verified details are written to the profile server-side.
 * Until that succeeds, the rest of the app stays gated behind this overlay.
 */
export default function CompleteProfileGate() {
  const { completeProfile, logout } = useAuth();
  const [stage, setStage] = useState('input'); // input | preview
  const [gstin, setGstin] = useState('');
  const [business, setBusiness] = useState(null); // parsed preview from /api/gst-verify
  const [status, setStatus] = useState('idle'); // idle | searching | confirming
  const [error, setError] = useState('');

  const clean = gstin.trim().toUpperCase();
  const gstValid = isValidGST(clean);
  const busy = status === 'searching' || status === 'confirming';

  // Stage 1 — look up the GSTIN in the public registry and preview it.
  const fetchDetails = async (e) => {
    e?.preventDefault();
    if (!gstValid) { setError('Enter a valid 15-character GSTIN.'); return; }
    setStatus('searching');
    setError('');
    try {
      const res = await verifyGSTIN(clean);
      if (!res?.success || !res.data) {
        throw new Error(res?.error || 'We could not find that GSTIN. Please check and try again.');
      }
      setBusiness(res.data);
      setStage('preview');
    } catch (err) {
      setError(err.message || 'We could not find that GSTIN. Please check and try again.');
    } finally {
      setStatus('idle');
    }
  };

  // Stage 2 — confirm; the server re-fetches authoritatively and writes the profile.
  const confirm = async () => {
    setStatus('confirming');
    setError('');
    try {
      await completeProfile(clean); // on success, profile becomes complete → gate unmounts
    } catch (err) {
      setStatus('idle');
      setError(err.message || 'We could not complete your profile. Please try again.');
    }
  };

  const backToInput = () => {
    setStage('input');
    setBusiness(null);
    setError('');
  };

  const Row = ({ label, value }) => (
    <div className="flex justify-between gap-3 py-1.5">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="text-xs font-medium text-slate-900 text-right break-words">{value || '—'}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6">
        <div className="text-center mb-5">
          <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-6 h-6 text-brand-800" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Complete your profile</h2>
          <p className="text-sm text-slate-500 mt-1">
            {stage === 'preview'
              ? 'Confirm this is your business to unlock Dotko.'
              : 'Enter your GST number to verify your business. It takes a few seconds.'}
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {stage === 'input' ? (
          <form onSubmit={fetchDetails} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">GST Number (GSTIN)</label>
              <input
                id="complete-profile-gstin"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                value={gstin}
                onChange={(e) => { setGstin(e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 15)); setError(''); }}
                placeholder="22AAAAA0000A1Z5"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-mono tracking-wide focus:outline-none focus:ring-2 focus:ring-brand-500"
                maxLength={15}
              />
            </div>
            <button
              id="complete-profile-search"
              type="submit"
              disabled={busy || !gstValid}
              className="w-full bg-brand-800 text-white font-semibold py-3 rounded-xl hover:bg-brand-700 transition-colors flex items-center justify-center gap-2.5 text-sm disabled:opacity-60"
            >
              {status === 'searching' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              {status === 'searching' ? 'Fetching…' : 'Fetch business details'}
            </button>
          </form>
        ) : (
          <>
            <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-slate-900 truncate">
                  {business?.tradeName || business?.legalName}
                </span>
                <span className="text-[10px] bg-emerald-600 text-white font-medium px-2 py-0.5 rounded-full shrink-0">
                  {business?.status || 'Registered'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mb-2">{clean}</p>
              <div className="divide-y divide-slate-200/70">
                <Row label="Legal Name" value={business?.legalName} />
                <Row label="Entity Type" value={business?.constitutionOfBusiness} />
                <Row label="Registered" value={business?.registrationDate} />
                <Row
                  label="Location"
                  value={[business?.principalAddress?.district, business?.principalAddress?.state].filter(Boolean).join(', ')}
                />
              </div>
            </div>

            <button
              id="complete-profile-confirm"
              onClick={confirm}
              disabled={busy}
              className="w-full bg-brand-800 text-white font-semibold py-3 rounded-xl hover:bg-brand-700 transition-colors flex items-center justify-center gap-2.5 text-sm disabled:opacity-60"
            >
              {status === 'confirming' ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              {status === 'confirming' ? 'Completing…' : 'Confirm & Continue'}
            </button>

            <button
              onClick={backToInput}
              disabled={busy}
              className="w-full mt-3 text-xs text-slate-500 hover:text-slate-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Use a different GSTIN
            </button>
          </>
        )}

        <button
          onClick={logout}
          disabled={busy}
          className="w-full mt-4 text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </div>
    </div>
  );
}
