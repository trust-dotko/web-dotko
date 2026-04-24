import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Loader2, Search, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isValidGST } from '../data/trustEngine';
import { verifyGSTIN } from '../config/firebase';

export default function Signup() {
  const [step, setStep]         = useState(1); // 1: GST, 2: Account
  const [gst, setGst]           = useState('');
  const [gstData, setGstData]   = useState(null);
  const [gstError, setGstError] = useState('');
  const [gstLoading, setGstLoading] = useState(false);

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const navigate = useNavigate();
  const { signup } = useAuth();

  // Step 1 — Verify GST
  const handleGSTVerify = async () => {
    const q = gst.trim().toUpperCase();
    setGstError('');

    if (!isValidGST(q)) {
      setGstError('Enter a valid 15-character GSTIN (e.g. 27AADCB2230M1ZP)');
      return;
    }

    setGstLoading(true);
    try {
      const result = await verifyGSTIN(q);
      setGstData(result.data);
      setStep(2);
    } catch (err) {
      setGstError(err.message || 'GST verification failed. Please try again.');
    } finally {
      setGstLoading(false);
    }
  };

  // Step 2 — Create account
  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password || !confirm) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await signup(email, password, gstData);
      navigate('/verify-email');
    } catch (err) {
      const code = err.code;
      if (code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Try signing in.');
      } else if (code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else if (code === 'auth/weak-password') {
        setError('Password is too weak. Use at least 6 characters.');
      } else {
        console.error('Signup error:', err);
        setError(err.message || 'Signup failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <img src="/icon.png" alt="Dotko" className="w-12 h-12 rounded-2xl mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">
            {step === 1 ? 'Verify Your Business' : 'Create Your Account'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {step === 1
              ? 'Enter your GST number to get started'
              : `Signing up as ${gstData?.tradeName || gstData?.legalName || ''}`}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                s <= step ? 'bg-brand-800 text-white' : 'bg-slate-200 text-slate-400'
              }`}>
                {s < step ? <CheckCircle className="w-4 h-4" /> : s}
              </div>
              {s < 2 && <div className={`w-12 h-0.5 ${s < step ? 'bg-brand-800' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>

        {step === 1 ? (
          /* Step 1: GST Verification */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">GSTIN Number</label>
              <div className="flex gap-2">
                <input
                  id="signup-gst-input"
                  type="text"
                  value={gst}
                  onChange={e => { setGst(e.target.value.toUpperCase()); setGstError(''); }}
                  placeholder="e.g. 27AADCB2230M1ZP"
                  className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                  maxLength={15}
                  onKeyDown={e => e.key === 'Enter' && handleGSTVerify()}
                />
                <button
                  id="signup-gst-verify"
                  onClick={handleGSTVerify}
                  disabled={gstLoading}
                  className="bg-brand-800 text-white font-medium px-4 py-2.5 rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-2 disabled:opacity-60"
                >
                  {gstLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Verify
                </button>
              </div>
              {gstError && (
                <p className="flex items-center gap-1.5 text-red-600 text-sm mt-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {gstError}
                </p>
              )}
            </div>
            <p className="text-xs text-slate-400 text-center">
              Your GST details will be automatically verified via the official registry.
            </p>
          </div>
        ) : (
          /* Step 2: Account Creation */
          <div className="space-y-4">
            {/* GST summary card */}
            {gstData && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-emerald-900">{gstData.tradeName || gstData.legalName}</p>
                    <p className="text-emerald-700 text-xs mt-0.5">{gst.toUpperCase()}</p>
                    <p className="text-emerald-600 text-xs mt-0.5">
                      {gstData.constitutionOfBusiness} · GST {gstData.status}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <form
              onSubmit={handleSignup}
              className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-4"
            >
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Email</label>
                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Password</label>
                <input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Confirm Password</label>
                <input
                  id="signup-confirm"
                  type="password"
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError(''); }}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                />
              </div>

              <button
                id="signup-submit"
                type="submit"
                disabled={loading}
                className="w-full bg-brand-800 text-white font-semibold py-2.5 rounded-lg hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {loading ? 'Creating Account…' : 'Create Account'}
              </button>
            </form>
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
