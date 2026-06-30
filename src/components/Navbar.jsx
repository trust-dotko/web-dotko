import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useMatch, useLocation } from 'react-router-dom';
import { LayoutDashboard, LogOut, LogIn, UserPlus, FileText, Briefcase, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isReportPage = useMatch('/report/:gst');
  const isLanding = location.pathname === '/';

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!isLanding) return;
    const handleScroll = () => {
      setScrolled(window.scrollY > 60);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLanding]);

  const handleSubmitTrade = () => {
    if (isReportPage) {
      document.getElementById('submit-trade-btn')?.click();
    } else {
      navigate('/my-trades', { state: { openModal: true } });
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // Navbar styling: frosted white background with subtle border and shadow for premium feel
  const navClasses = 'sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm';

  // Text colors: slate for links and dark brand color for the logo
  const linkTextClass = 'text-slate-600 hover:text-brand-800';
  const logoTextClass = 'font-display font-bold text-brand-700 text-base tracking-tight';
  const subtitleClass = 'hidden sm:inline-block text-xs text-slate-400 ml-2';

  return (
    <nav className={navClasses}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2.5 group">
          <img
            src="/icon.png"
            alt="Dotko"
            className="w-8 h-8 rounded-lg object-contain group-hover:scale-105 transition-transform"
          />
          <div>
            <span className={logoTextClass}>dotko<span className="text-accent-400">.</span>in</span>
            <span className={subtitleClass}>MSME Trust Intelligence</span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className={`hidden sm:inline-flex items-center gap-1.5 text-sm transition-colors ${linkTextClass}`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
              <Link
                to="/my-trades"
                className={`hidden sm:inline-flex items-center gap-1.5 text-sm transition-colors ${linkTextClass}`}
              >
                <Briefcase className="w-4 h-4" />
                My Trades
              </Link>
              {profile?.gst && (
                <Link
                  to={`/report/${profile.gst}`}
                  className={`hidden sm:inline-flex items-center gap-1.5 text-sm transition-colors ${linkTextClass}`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  My Trust Score
                </Link>
              )}
              <Link
                to="/profile/complete"
                className={`hidden sm:inline-flex items-center gap-1.5 text-sm transition-colors ${linkTextClass}`}
              >
                <User className="w-4 h-4" />
                Profile
              </Link>
              <button
                onClick={handleSubmitTrade}
                className={`hidden sm:inline-flex items-center gap-1.5 text-sm transition-colors ${linkTextClass}`}
              >
                <FileText className="w-4 h-4" />
                Submit Trade
              </button>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-sm transition-colors px-3 py-1.5 rounded-lg text-slate-600 hover:text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className={`inline-flex items-center gap-1.5 text-sm transition-colors px-3 py-1.5 ${linkTextClass}`}
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </Link>
              <Link
                to="/signup"
                className="btn-accent inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg"
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
