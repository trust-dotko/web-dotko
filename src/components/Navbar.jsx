import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2.5 group">
          <img
            src="/icon.png"
            alt="Dotko"
            className="w-8 h-8 rounded-lg object-contain group-hover:scale-105 transition-transform"
          />
          <div>
            <span className="font-bold text-slate-900 text-sm tracking-tight">dotko.in</span>
            <span className="hidden sm:inline-block text-xs text-slate-400 ml-2">MSME Trust Intelligence</span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="hidden sm:inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-brand-800 transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-red-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-brand-800 transition-colors px-3 py-1.5"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-brand-800 hover:bg-brand-700 transition-colors px-4 py-2 rounded-lg"
              >
                <UserPlus className="w-4 h-4" />
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
