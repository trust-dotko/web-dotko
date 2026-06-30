import React, { useState, useEffect, useRef } from 'react';
import { Loader2, ShieldCheck, Building2, AlertCircle, RefreshCw, Lock, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/**
 * CompleteProfileGate — full-screen popup shown after signup (and to any
 * authenticated user whose profile isn't complete). The user verifies their
 * business through EntityLocker; verified data is written server-side. Until
 * that succeeds, the rest of the app stays gated behind this overlay.
 */
export default function CompleteProfileGate() {
  const { startEntityLocker, completeProfile, logout } = useAuth();
  const [status, setStatus] = useState('idle'); // idle | starting | redirecting | completing | error
  const [error, setError] = useState('');
  const handledRef = useRef(false);

  // Handle the redirect back from EntityLocker (?session_id=… or ?state=…)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session_id') || params.get('state');
    if (!sid || handledRef.current) return;
    handledRef.current = true;

    // Clean the URL so a refresh doesn't re-trigger
    window.history.replaceState({}, '', window.location.pathname);

    (async () => {
      setStatus('completing');
      setError('');
      try {
        await completeProfile(sid); // on success, profile becomes complete → gate unmounts
      } catch (err) {
        setStatus('error');
        setError(err.message || 'We could not verify your business. Please try again.');
      }
    })();
  }, [completeProfile]);

  const startVerification = async () => {
    setStatus('starting');
    setError('');
    try {
      const { authorization_url } = await startEntityLocker();
      if (!authorization_url) throw new Error('Could not start verification. Please try again.');
      setStatus('redirecting');
      window.location.href = authorization_url;
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Could not start verification. Please try again.');
    }
  };

  const busy = status === 'starting' || status === 'redirecting' || status === 'completing';

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6">
        <div className="text-center mb-5">
          <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-6 h-6 text-brand-800" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Complete your profile</h2>
          <p className="text-sm text-slate-500 mt-1">
            Verify your business to unlock Dotko. It takes under a minute.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {status === 'completing' ? (
          <div className="flex flex-col items-center text-center gap-3 py-6">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="font-semibold text-slate-900">Fetching your verified business details…</p>
            <p className="text-sm text-slate-500">Hang tight, this only takes a moment.</p>
          </div>
        ) : status === 'redirecting' ? (
          <div className="flex flex-col items-center text-center gap-3 py-6">
            <ShieldCheck className="w-8 h-8 text-brand-800" />
            <p className="font-semibold text-slate-900">Redirecting to secure verification…</p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 text-sm text-slate-600 bg-slate-50 rounded-xl border border-slate-100 p-4 mb-4">
              <Lock className="w-5 h-5 text-brand-800 mt-0.5 flex-shrink-0" />
              <p>
                We use <span className="font-semibold text-slate-800">EntityLocker</span> to verify your
                business via official government records. Your credentials are processed by the
                government portal and never stored by Dotko.
              </p>
            </div>

            <button
              id="complete-profile-start"
              onClick={startVerification}
              disabled={busy}
              className="w-full bg-brand-800 text-white font-semibold py-3 rounded-xl hover:bg-brand-700 transition-colors flex items-center justify-center gap-2.5 text-sm disabled:opacity-60"
            >
              {status === 'starting'
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : status === 'error'
                  ? <RefreshCw className="w-5 h-5" />
                  : <ShieldCheck className="w-5 h-5" />}
              {status === 'starting' ? 'Preparing…' : status === 'error' ? 'Try Again' : 'Verify Business'}
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
