import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Smartphone, Loader2, ArrowRight, AlertCircle, KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const RESEND_SECONDS = 30;

/**
 * Unified phone + WhatsApp OTP entry — serves both "Sign in" and "Get started".
 * Existing number → straight to the app. New number → the dashboard's
 * profile-completion gate takes over (EntityLocker business verification).
 */
export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sendOtp, verifyOtp } = useAuth();

  const [stage, setStage] = useState('phone'); // 'phone' | 'otp'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpRef = useRef(null);

  const destination = location.state?.from?.pathname || location.state?.from || '/dashboard';

  // Resend cooldown ticker
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (stage === 'otp') otpRef.current?.focus();
  }, [stage]);

  const cleanPhone = phone.replace(/\D/g, '').slice(-10);
  const phoneValid = /^[6-9]\d{9}$/.test(cleanPhone);

  const requestOtp = async (e) => {
    e?.preventDefault();
    if (!phoneValid) { setError('Enter a valid 10-digit mobile number.'); return; }
    setError('');
    setLoading(true);
    try {
      await sendOtp(cleanPhone);
      setStage('otp');
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(err.message || 'Could not send the code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (e) => {
    e?.preventDefault();
    if (!/^\d{6}$/.test(otp)) { setError('Enter the 6-digit code.'); return; }
    setError('');
    setLoading(true);
    try {
      await verifyOtp(cleanPhone, otp);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/icon.png" alt="Dotko" className="w-12 h-12 rounded-2xl mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">
            {stage === 'phone' ? 'Sign in to Dotko' : 'Enter the code'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {stage === 'phone'
              ? 'We’ll send a one-time code to your WhatsApp'
              : `Sent to +91 ${cleanPhone} on WhatsApp`}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {stage === 'phone' ? (
            <form onSubmit={requestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Mobile Number</label>
                <div className="flex items-center rounded-lg border border-slate-200 focus-within:ring-2 focus-within:ring-brand-500 overflow-hidden">
                  <span className="px-3 py-2.5 text-sm text-slate-500 bg-slate-50 border-r border-slate-200 select-none">+91</span>
                  <input
                    id="login-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setError(''); }}
                    placeholder="98XXXXXXXX"
                    className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
                    maxLength={10}
                  />
                </div>
              </div>
              <button
                id="login-send-otp"
                type="submit"
                disabled={loading || !phoneValid}
                className="w-full bg-brand-800 text-white font-semibold py-2.5 rounded-lg hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                {loading ? 'Sending…' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={submitOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">6-Digit Code</label>
                <input
                  ref={otpRef}
                  id="login-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                  placeholder="••••••"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-center text-lg tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                  maxLength={6}
                />
              </div>
              <button
                id="login-verify-otp"
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-brand-800 text-white font-semibold py-2.5 rounded-lg hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                {loading ? 'Verifying…' : 'Verify & Continue'}
              </button>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => { setStage('phone'); setOtp(''); setError(''); }}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  ← Change number
                </button>
                <button
                  type="button"
                  disabled={cooldown > 0 || loading}
                  onClick={requestOtp}
                  className="text-brand-800 hover:underline disabled:text-slate-400 disabled:no-underline"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          <Link to="/" className="hover:text-brand-800 transition-colors flex items-center justify-center gap-1">
            <ArrowRight className="w-3 h-3 rotate-180" /> Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
