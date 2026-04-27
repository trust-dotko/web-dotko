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
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

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

  // Signup — creates auth user + writes profile directly to Firestore
  const signup = async (email, password, gstData = {}) => {
    // 1. Create Firebase Auth user
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // 2. Send verification email
    try {
      await sendEmailVerification(cred.user);
    } catch (e) {
      console.warn('Email verification send failed:', e.message);
    }

    // 3. Write profile directly to Firestore (works in both dev and prod,
    //    no Admin SDK required). This ensures ProfileComplete always has
    //    pre-filled, locked data from the GST verification step.
    const businessName = gstData.tradeName || gstData.legalName || '';
    try {
      const profileData = {
        email,
        businessName,
        legalName:        gstData.legalName || '',
        tradeName:        gstData.tradeName || '',
        gst:              gstData.gstin || '',
        entityType:       gstData.constitutionOfBusiness || '',
        gstStatus:        gstData.status || '',
        registrationDate: gstData.registrationDate || '',
        state:            gstData.principalAddress?.state || '',
        city:             gstData.principalAddress?.district || '',
        address:          gstData.principalAddress?.fullAddress || '',
        createdAt:        serverTimestamp(),
        updatedAt:        serverTimestamp(),
        profileComplete:  Boolean(gstData.gstin),
        onboardingCompleted: Boolean(gstData.gstin),
      };
      await setDoc(doc(db, 'users', cred.user.uid), profileData, { merge: true });
      setProfile(profileData);
    } catch (e) {
      console.warn('Direct Firestore profile write failed:', e.message);
      // Profile can be completed later via /profile/complete
    }

    // 4. Also call the API for any server-side work (best-effort; failures are non-fatal)
    try {
      const token = await cred.user.getIdToken();
      await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          email,
          gst: gstData.gstin || '',
          businessName,
          legalName:        gstData.legalName || '',
          tradeName:        gstData.tradeName || '',
          entityType:       gstData.constitutionOfBusiness || '',
          gstStatus:        gstData.status || '',
          registrationDate: gstData.registrationDate || '',
          address:          gstData.principalAddress?.fullAddress || '',
          state:            gstData.principalAddress?.state || '',
          city:             gstData.principalAddress?.district || '',
          natureOfBusiness: gstData.natureOfBusinessActivities || [],
        }),
      });
    } catch (e) {
      console.warn('Register API call failed (non-fatal):', e.message);
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
    // GST and businessName are the critical ones for reporting.
    // Entity type is good to have, but shouldn't block reporting if they've verified GST.
    const required = ['gst', 'businessName'];
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
