import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CompleteProfileGate from './CompleteProfileGate';

export default function ProtectedRoute({ children }) {
  const { user, loading, profileLoading, isProfileComplete } = useAuth();
  const location = useLocation();

  if (loading || (user && profileLoading)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-800 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated but business not yet verified → gate the entire app behind
  // the profile-completion popup (GST search).
  if (!isProfileComplete()) {
    return <CompleteProfileGate />;
  }

  return children;
}
