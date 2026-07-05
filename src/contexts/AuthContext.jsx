import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithCustomToken, signOut } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext(null);

/** Authenticated fetch — attaches the current user's Firebase ID token. */
async function authedFetch(path, body) {
  const current = auth.currentUser;
  if (!current) throw new Error('Not signed in.');
  const token = await current.getIdToken();
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still loading
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Listen to Firebase Auth state and load the user's profile.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser ?? null);

      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          const profileData = snap.exists() ? snap.data() : null;

          // Enforce suspension: sign out suspended users immediately
          if (profileData?.suspended === true) {
            await signOut(auth);
            setUser(null);
            setProfile(null);
            setProfileLoading(false);
            return;
          }
          setProfile(profileData);
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

  const refreshProfile = async () => {
    if (!auth.currentUser) return null;
    try {
      const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const profileData = snap.exists() ? snap.data() : null;
      setProfile(profileData);
      return profileData;
    } catch {
      return null;
    }
  };

  // ── Phone + WhatsApp OTP authentication ────────────────────────────────────

  /** Request an OTP for a 10-digit Indian mobile number. */
  const sendOtp = async (phone) => {
    const res = await fetch('/api/phone-auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not send the code.');
    return data;
  };

  /**
   * Verify the OTP. On success the server returns a Firebase custom token which
   * we exchange for a session. Returns { isNewUser, profileComplete }.
   */
  const verifyOtp = async (phone, otp) => {
    const res = await fetch('/api/phone-auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Verification failed.');
    await signInWithCustomToken(auth, data.token);
    return { isNewUser: Boolean(data.isNewUser), profileComplete: Boolean(data.profileComplete) };
  };

  // ── Profile completion (GST search) ────────────────────────────────────────

  /**
   * Finish onboarding by verifying a GSTIN against the public GST registry.
   * The server fetches the business details and writes them to the profile.
   */
  const completeProfile = async (gstin) => {
    const data = await authedFetch('/api/phone-auth/complete-profile', { gstin });
    if (data.profile) setProfile(data.profile);
    return data;
  };

  const logout = () => signOut(auth);

  /** A profile is complete once business verification has been written by the server. */
  const isProfileComplete = () =>
    Boolean(profile?.profileComplete) && Boolean(profile?.gst);

  const value = {
    user,
    profile,
    loading: user === undefined,
    profileLoading,
    sendOtp,
    verifyOtp,
    completeProfile,
    refreshProfile,
    logout,
    isProfileComplete,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
