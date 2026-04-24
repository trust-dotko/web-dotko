import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, RefreshCw, CheckCircle, Loader2 } from 'lucide-react';
import { sendEmailVerification } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';

export default function EmailVerify() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [resending, setResending] = useState(false);
  const [resent, setResent]       = useState(false);
  const [checking, setChecking]   = useState(false);

  // Poll for email verification
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      await user.reload();
      if (user.emailVerified) {
        clearInterval(interval);
        navigate('/dashboard', { replace: true });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [user, navigate]);

  const handleResend = async () => {
    if (!user || resending) return;
    setResending(true);
    setResent(false);
    try {
      await sendEmailVerification(user);
      setResent(true);
    } catch {
      // Rate-limited, ignore
    } finally {
      setResending(false);
    }
  };

  const handleCheckNow = async () => {
    if (!user) return;
    setChecking(true);
    await user.reload();
    if (user.emailVerified) {
      navigate('/dashboard', { replace: true });
    }
    setChecking(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-800 animate-spin" />
      </div>
    );
  }

  if (!user) {
    navigate('/signup', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Mail className="w-8 h-8 text-brand-800" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Check your email</h1>
        <p className="text-sm text-slate-500 mb-1">
          We sent a verification link to
        </p>
        <p className="text-sm font-medium text-slate-700 mb-6">{user.email}</p>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-4">
          <p className="text-xs text-slate-500">
            Click the link in the email to verify your account.
            This page will update automatically once verified.
          </p>

          <button
            onClick={handleCheckNow}
            disabled={checking}
            className="w-full bg-brand-800 text-white font-semibold py-2.5 rounded-lg hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {checking ? 'Checking...' : "I've Verified - Continue"}
          </button>

          <button
            onClick={handleResend}
            disabled={resending}
            className="w-full text-sm text-slate-600 hover:text-brand-800 transition-colors flex items-center justify-center gap-1.5 py-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
            {resent ? 'Email resent!' : resending ? 'Resending...' : 'Resend verification email'}
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-6">
          {"Didn't receive it? Check your spam folder or try resending."}
        </p>
      </div>
    </div>
  );
}
