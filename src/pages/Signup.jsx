import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  UserPlus, Loader2, CheckCircle, AlertCircle,
  ShieldCheck, Building2, RefreshCw, Lock,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// ─── SDK loader ────────────────────────────────────────────────────────────────
const SDK_URL  = import.meta.env.VITE_ENTITYLOCKER_SDK_URL;
const SDK_NAME = 'EntityLockerSDK'; // global exposed by sdk.sandbox.co.in/kyc/entitylocker/sdk.js

async function loadSDK() {
  if (window[SDK_NAME]) return;

  if (!SDK_URL) {
    // Dev mock: mirrors the real EntityLockerSDK static API
    let _listener = null;
    window[SDK_NAME] = {
      setAPIKey:       () => {},
      EventListener:   function () {},
      setEventListener: (l) => { _listener = l; },
      open: () => {
        setTimeout(() => _listener?.onEvent({ type: 'session.completed', data: {} }), 2000);
      },
    };
    return;
  }

  return new Promise((resolve, reject) => {
    const s   = document.createElement('script');
    s.src     = SDK_URL;
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error('Failed to load verification SDK. Please check your connection and try again.'));
    document.head.appendChild(s);
  });
}

// ─── State machine labels ───────────────────────────────────────────────────────
const S = {
  IDLE:       'idle',
  INITIATING: 'initiating',
  SDK_OPEN:   'sdk_open',
  VERIFYING:  'verifying',
  FETCHING:   'fetching',
  SUCCESS:    'success',
  ERROR:      'error',
  CANCELLED:  'cancelled',
};

// ─── Component ─────────────────────────────────────────────────────────────────
export default function Signup() {
  const navigate  = useNavigate();
  const { signup } = useAuth();

  // ── Step 1 state ──────────────────────────────────────────────────────────
  const [step, setStep]         = useState(1);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [step1Err, setStep1Err] = useState('');

  // ── Step 2 state ──────────────────────────────────────────────────────────
  const [status,       setStatus]       = useState(S.IDLE);
  const [verifyErr,    setVerifyErr]    = useState('');
  const [bizData,      setBizData]      = useState(null);

  // Pre-loaded session so SDK.open() can be called synchronously on click
  const sessionRef    = useRef(null); // { session_id, api_key }
  const preloadingRef = useRef(false);

  // Prevents stale-closure issues inside SDK callbacks
  const completedRef = useRef(false);

  // Pre-load session as soon as Step 2 is visible
  useEffect(() => {
    if (step !== 2 || preloadingRef.current) return;
    preloadingRef.current = true;

    (async () => {
      try {
        const initBody = await fetch('/api/kyc/entitylocker/sdk/initiate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
        }).then(r => r.json());
        
        if (initBody.session_id) {
          sessionRef.current = {
            session_id: initBody.session_id,
            authorization_url: initBody.authorization_url,
            api_key:    initBody.api_key,
            brand:      initBody.brand,
            theme:      initBody.theme,
          };
        }
      } catch {
        // Non-fatal: startVerification will handle it if still null on click
      }
    })();
  }, [step]);

  // Handle returning from standard redirect flow
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session_id') || params.get('state');
    if (sid) {
      setStep(2);
      handleSDKSuccess(sid);
      // Clean up URL so refresh doesn't re-trigger
      window.history.replaceState({}, '', '/signup');
    }
  }, []);

  // ─── Step 1 → Step 2 ───────────────────────────────────────────────────────
  const handleContinue = (e) => {
    e.preventDefault();
    setStep1Err('');
    if (!email.trim())              { setStep1Err('Please enter your email address.'); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setStep1Err('Enter a valid email address.'); return; }
    if (password.length < 6)        { setStep1Err('Password must be at least 6 characters.'); return; }
    if (password !== confirm)       { setStep1Err('Passwords do not match.'); return; }
    setStep(2);
  };

  // ─── Start EntityLocker verification ───────────────────────────────────────
  const startVerification = async () => {
    setStatus(S.INITIATING);
    setVerifyErr('');
    completedRef.current = false;

    try {
      // Ensure session is ready
      if (!sessionRef.current) {
        const initBody = await fetch('/api/kyc/entitylocker/sdk/initiate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
        }).then(r => r.json());
        
        if (!initBody.session_id) throw new Error(initBody.error || 'Could not start a verification session.');
        
        sessionRef.current = {
          session_id: initBody.session_id,
          authorization_url: initBody.authorization_url,
          api_key:    initBody.api_key,
          brand:      initBody.brand,
          theme:      initBody.theme,
        };
      }

      const { session_id, authorization_url } = sessionRef.current;

      // Local mock fallback (no real Sandbox URL)
      if (authorization_url === 'mock-url' || session_id.startsWith('dev-session-')) {
        console.log('[Mock] Simulating verification flow...');
        setTimeout(() => handleSDKSuccess(session_id), 2000);
        return;
      }

      // Standard Redirect Flow (Bypasses broken SDK)
      if (authorization_url) {
        setStatus(S.VERIFYING);
        window.location.href = authorization_url;
        return;
      }

      throw new Error('No authorization URL returned from verification provider.');
    } catch (err) {
      setStatus(S.ERROR);
      setVerifyErr(err.message || 'Verification could not be started. Please try again.');
    }
  };

  // ─── SDK success → fetch results → create account ──────────────────────────
  const handleSDKSuccess = async (session_id) => {
    completedRef.current = true;
    setStatus(S.FETCHING);
    setVerifyErr('');

    try {
      // 4. Backend fetches verified documents from EntityLocker
      const res = await fetch('/api/kyc/entitylocker/sdk/results', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ session_id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to retrieve your verified business data.');

      const businessData = body.data;
      setBizData(businessData);

      // 5. Create Firebase account + write Firestore profile
      await signup(email.trim(), password, businessData);

      setStatus(S.SUCCESS);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      let msg = err.message || 'Account creation failed. Please try again.';
      if (err.code === 'auth/email-already-in-use') msg = 'An account with this email already exists. Try signing in.';
      else if (err.code === 'auth/invalid-email')   msg = 'That email address is not valid.';
      else if (err.code === 'auth/weak-password')   msg = 'Please choose a stronger password (min. 6 characters).';
      setStatus(S.ERROR);
      setVerifyErr(msg);
      completedRef.current = false;
    }
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const resetVerification = () => {
    setStatus(S.IDLE);
    setVerifyErr('');
    completedRef.current = false;
    sessionRef.current   = null;
    preloadingRef.current = false;
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Brand header */}
        <div className="text-center mb-8">
          <img src="/icon.png" alt="Dotko" className="w-12 h-12 rounded-2xl mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">
            {step === 1 ? 'Create Your Account' : 'Verify Your Business'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {step === 1
              ? 'Set up your login credentials to get started'
              : 'Securely verify your business via government records'}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                s < step
                  ? 'bg-emerald-500 text-white'
                  : s === step
                  ? 'bg-brand-800 text-white'
                  : 'bg-slate-200 text-slate-400'
              }`}>
                {s < step ? <CheckCircle className="w-4 h-4" /> : s}
              </div>
              {s < 2 && (
                <div className={`w-16 h-0.5 transition-all duration-300 ${step > s ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* ── Step 1: Account Details ─────────────────────────────────────── */}
        {step === 1 && (
          <form
            onSubmit={handleContinue}
            className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-4"
          >
            {step1Err && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {step1Err}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Email Address</label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setStep1Err(''); }}
                placeholder="you@company.com"
                autoComplete="email"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Password</label>
              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setStep1Err(''); }}
                placeholder="Min. 6 characters"
                autoComplete="new-password"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Confirm Password</label>
              <input
                id="signup-confirm"
                type="password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setStep1Err(''); }}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <button
              id="signup-continue"
              type="submit"
              className="w-full bg-brand-800 text-white font-semibold py-2.5 rounded-lg hover:bg-brand-700 transition-colors flex items-center justify-center gap-2"
            >
              Continue to Verification
            </button>
          </form>
        )}

        {/* ── Step 2: EntityLocker Business Verification ─────────────────── */}
        {step === 2 && (
          <div className="space-y-4">

            {/* Idle — call-to-action */}
            {status === S.IDLE && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-5">
                <div className="flex items-start gap-3 text-sm text-slate-600 bg-slate-50 rounded-xl border border-slate-100 p-4">
                  <Lock className="w-5 h-5 text-brand-800 mt-0.5 flex-shrink-0" />
                  <p>
                    We use <span className="font-semibold text-slate-800">EntityLocker</span> to securely
                    verify your business via official government records. A secure government portal
                    will open — your credentials are processed by the government, never stored by Dotko.
                  </p>
                </div>

                <button
                  id="signup-start-verification"
                  onClick={startVerification}
                  className="w-full bg-brand-800 text-white font-semibold py-3 rounded-xl hover:bg-brand-700 transition-colors flex items-center justify-center gap-2.5 text-sm"
                >
                  <ShieldCheck className="w-5 h-5" />
                  Start Business Verification
                </button>

                <p className="text-xs text-slate-400 text-center">
                  Powered by EntityLocker Sandbox 
                </p>

                <button
                  onClick={() => setStep(1)}
                  className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  ← Back to account details
                </button>
              </div>
            )}

            {/* Initiating */}
            {status === S.INITIATING && (
              <StatusCard
                icon={<Loader2 className="w-8 h-8 text-brand-800 animate-spin" />}
                title="Preparing Verification…"
                subtitle="Creating a secure session with EntityLocker."
              />
            )}

            {/* SDK Open / Verifying Redirect */}
            {(status === S.SDK_OPEN || status === S.VERIFYING) && (
              <StatusCard
                icon={
                  <div className="w-12 h-12 rounded-full bg-brand-800/10 flex items-center justify-center">
                    <ShieldCheck className="w-7 h-7 text-brand-800" />
                  </div>
                }
                title="Redirecting to Sandbox EntityLocker"
                subtitle="Please complete the verification on the government portal. You will be redirected automatically."
                accent
              >
                <div className="flex gap-1.5 items-center justify-center mt-3">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-brand-800 opacity-70 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </StatusCard>
            )}

            {/* Fetching results */}
            {status === S.FETCHING && (
              <StatusCard
                icon={<Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />}
                title="Verification Complete!"
                subtitle="Fetching your verified business details and creating your account…"
              />
            )}

            {/* Success — navigating, shown briefly */}
            {status === S.SUCCESS && (
              <StatusCard
                icon={<CheckCircle className="w-10 h-10 text-emerald-500" />}
                title="Account Created!"
                subtitle="Redirecting to your dashboard…"
              />
            )}

            {/* Cancelled */}
            {status === S.CANCELLED && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-4 text-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="font-semibold text-slate-800">Verification Cancelled</h3>
                  <p className="text-sm text-slate-500">
                    You closed the verification window. You can try again whenever you're ready.
                  </p>
                </div>
                <button
                  onClick={resetVerification}
                  className="w-full bg-brand-800 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
              </div>
            )}

            {/* Error */}
            {status === S.ERROR && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-4">
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-red-700">Verification Failed</p>
                    <p className="text-xs text-red-600 mt-0.5">{verifyErr}</p>
                  </div>
                </div>
                <button
                  onClick={resetVerification}
                  className="w-full bg-brand-800 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
                <button
                  onClick={() => setStep(1)}
                  className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  ← Back to account details
                </button>
              </div>
            )}

            {/* Verified business summary — shown while FETCHING/SUCCESS */}
            {bizData && [S.FETCHING, S.SUCCESS].includes(status) && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-emerald-900">
                      {bizData.tradeName || bizData.legalName || bizData.gstin}
                    </p>
                    {bizData.gstin && (
                      <p className="font-mono text-xs text-emerald-700 mt-0.5">{bizData.gstin}</p>
                    )}
                    {(bizData.constitutionOfBusiness || bizData.status) && (
                      <p className="text-xs text-emerald-600 mt-0.5">
                        {[bizData.constitutionOfBusiness, bizData.status && `GST ${bizData.status}`]
                          .filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-slate-400 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-800 hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

// ─── StatusCard helper ─────────────────────────────────────────────────────────
function StatusCard({ icon, title, subtitle, accent, children }) {
  return (
    <div className={`bg-white rounded-2xl border shadow-card p-8 flex flex-col items-center text-center gap-3 ${
      accent ? 'border-brand-800/20' : 'border-slate-200'
    }`}>
      {icon}
      <div>
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
