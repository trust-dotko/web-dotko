import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(undefined); // undefined = loading
  const [profile, setProfile]   = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser ?? null);

      if (firebaseUser) {
        // Load profile directly from Firestore (no Admin SDK needed)
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          setProfile(snap.exists() ? snap.data() : null);
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setProfileLoading(false);
    });
    return unsub;
  }, []);

  // Refresh profile directly from Firestore
  const refreshProfile = async () => {
    if (!user) return null;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const profileData = snap.exists() ? snap.data() : null;
      setProfile(profileData);
      return profileData;
    } catch {
      return null;
    }
  };

  // Login
  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  // Signup — creates auth user, then saves profile via API
  const signup = async (email, password, gstData = {}) => {
    // 1. Create Firebase Auth user (client-side — this is how Firebase Auth works)
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // 2. Send verification email
    try {
      await sendEmailVerification(cred.user);
    } catch (e) {
      console.warn('Email verification send failed:', e.message);
    }

    // 3. Save profile via our API (not direct Firestore)
    try {
      const token = await cred.user.getIdToken();
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          gst: gstData.gstin || '',
          businessName: gstData.tradeName || gstData.legalName || '',
          legalName: gstData.legalName || '',
          tradeName: gstData.tradeName || '',
          entityType: gstData.constitutionOfBusiness || '',
          gstStatus: gstData.status || '',
          registrationDate: gstData.registrationDate || '',
          address: gstData.principalAddress?.fullAddress || '',
          state: gstData.principalAddress?.state || '',
          city: gstData.principalAddress?.district || '',
          natureOfBusiness: gstData.natureOfBusinessActivities || [],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile || null);
      } else {
        console.warn('Profile creation via API failed, user can complete later');
      }
    } catch (e) {
      console.warn('Profile API call failed:', e.message);
      // Auth user is created — profile can be completed later via /profile/complete
    }

    return cred;
  };

  // Logout
  const logout = () => signOut(auth);

  // Reset Password
  const resetPassword = (email) => sendPasswordResetEmail(auth, email);

  // Check if profile is complete enough to submit reports
  const isProfileComplete = () => {
    if (!profile) return false;
    const required = ['gst', 'businessName', 'entityType'];
    return required.every((key) => profile[key] && String(profile[key]).trim() !== '');
  };

  const value = {
    user,
    profile,
    loading: user === undefined,
    profileLoading,
    login,
    signup,
    logout,
    resetPassword,
    refreshProfile,
    isProfileComplete,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
