import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

function friendlyError(code) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':    return 'Invalid email or password.';
    case 'auth/too-many-requests': return 'Too many attempts. Please try again later.';
    case 'auth/user-disabled':     return 'This account has been disabled.';
    default:                       return 'Sign in failed. Please try again.';
  }
}

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/icon.png" alt="Dotko" className="w-12 h-12 rounded-2xl mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">Sign in to Dotko</h1>
          <p className="text-sm text-slate-500 mt-1">Access real-time business trust data</p>
        </div>

        <form
          onSubmit={handleLogin}
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
              id="login-email"
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
              id="login-password"
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="w-full bg-brand-800 text-white font-semibold py-2.5 rounded-lg hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="text-center mt-6 space-y-2">
          <p className="text-sm text-slate-500">
            Don't have an account?{' '}
            <Link to="/signup" className="text-brand-800 hover:underline font-medium">Sign up</Link>
          </p>
          <p className="text-xs text-slate-400">
            <Link to="/" className="hover:text-brand-800 transition-colors">← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
