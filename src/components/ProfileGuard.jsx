import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/**
 * ProfileGuard — wraps any action that requires a complete profile.
 *
 * If the user's profile is incomplete, shows a warning card with a
 * redirect to profile completion instead of rendering `children`.
 *
 * Usage:
 *   <ProfileGuard fallbackMessage="Complete your profile to submit reports.">
 *     <button onClick={handleSubmit}>Submit Report</button>
 *   </ProfileGuard>
 */
export default function ProfileGuard({ children, fallbackMessage = 'Complete your profile to continue.' }) {
  const { user, isProfileComplete, loading } = useAuth();
  const navigate = useNavigate();

  // Still loading auth state
  if (loading) return null;

  // Not logged in → redirect to signup
  if (!user) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
        <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-2" />
        <p className="text-sm text-amber-800 font-medium mb-3">Sign in required</p>
        <button
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-brand-800 hover:bg-brand-700 px-4 py-2 rounded-lg transition-colors"
        >
          Sign In <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Profile incomplete → redirect to complete
  if (!isProfileComplete()) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
        <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-2" />
        <p className="text-sm text-amber-800 font-medium mb-1">{fallbackMessage}</p>
        <p className="text-xs text-amber-600 mb-3">
          Your profile is missing required information. Please complete it to proceed.
        </p>
        <button
          onClick={() => navigate('/profile/complete')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-brand-800 hover:bg-brand-700 px-4 py-2 rounded-lg transition-colors"
        >
          Complete Profile <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // All good — render children
  return <>{children}</>;
}
