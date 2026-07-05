import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useMatch, useLocation } from 'react-router-dom';
import { LayoutDashboard, LogOut, LogIn, UserPlus, FileText, Briefcase, User, ShieldCheck, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isReportPage = useMatch('/report/:gst');
  const isLanding = location.pathname === '/';

  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLanding) return;
    const handleScroll = () => {
      setScrolled(window.scrollY > 60);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLanding]);

  // Close the mobile menu on every route change (link click or back/forward).
  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

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
                className="hidden sm:inline-flex items-center gap-1.5 text-sm transition-colors px-3 py-1.5 rounded-lg text-slate-600 hover:text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
              {/* Mobile: hamburger opens Dashboard/My Trades/My Trust Score/Profile/Submit Trade/Logout — none of those links are reachable otherwise below the sm breakpoint. */}
              <button
                onClick={() => setMobileMenuOpen(o => !o)}
                aria-label="Menu"
                aria-expanded={mobileMenuOpen}
                className="sm:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-600 hover:text-brand-800 hover:bg-slate-100 transition-colors"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Link
                to="/login"
                className={`inline-flex items-center gap-1.5 text-sm whitespace-nowrap transition-colors px-2.5 py-1.5 ${linkTextClass}`}
              >
                <LogIn className="w-4 h-4 shrink-0" />
                Sign In
              </Link>
              <Link
                to="/signup"
                className="btn-accent inline-flex items-center gap-1.5 text-sm whitespace-nowrap px-3.5 sm:px-4 py-2 rounded-lg"
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile menu panel */}
      {user && mobileMenuOpen && (
        <div className="sm:hidden border-t border-slate-200/60 bg-white/95 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col">
            <Link to="/dashboard" className="flex items-center gap-2.5 text-sm text-slate-700 hover:text-brand-800 hover:bg-slate-50 rounded-lg px-3 py-3 transition-colors">
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </Link>
            <Link to="/my-trades" className="flex items-center gap-2.5 text-sm text-slate-700 hover:text-brand-800 hover:bg-slate-50 rounded-lg px-3 py-3 transition-colors">
              <Briefcase className="w-4 h-4" /> My Trades
            </Link>
            {profile?.gst && (
              <Link to={`/report/${profile.gst}`} className="flex items-center gap-2.5 text-sm text-slate-700 hover:text-brand-800 hover:bg-slate-50 rounded-lg px-3 py-3 transition-colors">
                <ShieldCheck className="w-4 h-4" /> My Trust Score
              </Link>
            )}
            <Link to="/profile/complete" className="flex items-center gap-2.5 text-sm text-slate-700 hover:text-brand-800 hover:bg-slate-50 rounded-lg px-3 py-3 transition-colors">
              <User className="w-4 h-4" /> Profile
            </Link>
            <button onClick={() => { setMobileMenuOpen(false); handleSubmitTrade(); }} className="flex items-center gap-2.5 text-sm text-slate-700 hover:text-brand-800 hover:bg-slate-50 rounded-lg px-3 py-3 transition-colors text-left">
              <FileText className="w-4 h-4" /> Submit Trade
            </button>
            <div className="my-1 border-t border-slate-100" />
            <button onClick={handleLogout} className="flex items-center gap-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg px-3 py-3 transition-colors text-left">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
