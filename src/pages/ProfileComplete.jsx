import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, Loader2, Building2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import Navbar from '../components/Navbar';

const ENTITY_TYPES = [
  'Proprietorship', 'Partnership', 'LLP',
  'Private Limited', 'Public Limited', 'HUF', 'Trust', 'Other',
];

export default function ProfileComplete() {
  const { user, profile, refreshProfile, loading, profileLoading } = useAuth();
  // Locked once data exists — persists across renders because profile only grows, never shrinks
  const isNameLocked   = Boolean(profile?.businessName);
  const isGstLocked    = Boolean(profile?.gst);
  const isEntityLocked = Boolean(profile?.entityType);
  const isStateLocked  = Boolean(profile?.state);
  const isCityLocked   = Boolean(profile?.city);
  const isPanLocked    = Boolean(profile?.pan);
  const isMobileLocked = Boolean(profile?.mobileNumber);
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({
    businessName: '', gst: '', entityType: '', pan: '',
    city: '', state: '', address: '', mobileNumber: '', establishmentYear: '',
  });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);

  // Pre-fill from existing profile
  useEffect(() => {
    if (profile) {
      const derivedPAN = (!profile.pan && profile.gst?.length === 15) ? profile.gst.substring(2, 12) : '';
      setForm({
        businessName:      profile.businessName || profile.tradeName || '',
        gst:               profile.gst || '',
        entityType:        profile.entityType || '',
        pan:               profile.pan || derivedPAN,
        city:              profile.city || '',
        state:             profile.state || '',
        address:           profile.address || '',
        mobileNumber:      profile.mobileNumber || '',
        establishmentYear: profile.establishmentYear || '',
      });
    }
  }, [profile]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.businessName.trim()) { setError('Business name is required.'); return; }
    if (!form.gst.trim())          { setError('GST number is required.');     return; }
    if (!form.entityType)          { setError('Entity type is required.');     return; }

    setSaving(true);
    try {
      const isNewDoc = !profile; // no Firestore doc yet → hits CREATE rule
      const payload = {
        businessName:      form.businessName.trim(),
        gst:               form.gst.trim().toUpperCase(),
        entityType:        form.entityType,
        pan:               form.pan.trim().toUpperCase(),
        city:              form.city.trim(),
        state:             form.state.trim(),
        establishmentYear: form.establishmentYear || null,
        address:           form.address.trim(),
        mobileNumber:      form.mobileNumber.trim(),
        profileComplete:   true,
        onboardingCompleted: true,
        updatedAt:         serverTimestamp(),
      };
      // CREATE rule requires email + createdAt; UPDATE rule does not
      if (isNewDoc) {
        payload.email     = user.email;
        payload.createdAt = serverTimestamp();
      }
      // Write directly to Firestore — no Admin SDK / API needed
      await setDoc(doc(db, 'users', user.uid), payload, { merge: true });

      await refreshProfile(); // re-sync AuthContext from Firestore
      setSuccess(true);
      const destination = location.state?.from || '/dashboard';
      setTimeout(() => navigate(destination, { replace: true }), 1500);
    } catch (err) {
      console.error('Profile save error:', err);
      setError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Wait for both auth AND profile to load before rendering the form.
  // Without this, isNameLocked / isGstLocked are false during the flash,
  // the user sees editable fields, and the lock never activates.
  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-800 animate-spin" />
      </div>
    );
  }

  if (!user) {
    navigate('/login', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-6 h-6 text-brand-800" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Complete Your Profile</h1>
          <p className="text-sm text-slate-500 mt-1">
            Fill in the required details to submit reports and access all features.
          </p>
        </div>

        {success ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-8 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="font-semibold text-slate-900">Profile updated!</p>
            <p className="text-sm text-slate-500 mt-1">Redirecting to dashboard…</p>
          </div>
        ) : (
          <>
          {profile?.gst && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 mb-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-emerald-800 truncate">
                    {profile.businessName || profile.tradeName}
                  </span>
                  <span className="text-xs bg-emerald-600 text-white font-medium px-2 py-0.5 rounded-full">GST Verified</span>
                </div>
                <p className="text-xs text-emerald-700 mt-0.5 font-mono">{profile.gst}</p>
                {profile.gstStatus && (
                  <p className="text-xs text-emerald-600 mt-0.5">Status: {profile.gstStatus}</p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Business Name *
                {isNameLocked && <span className="ml-2 text-emerald-600 font-normal">verified</span>}
              </label>
              <input
                type="text"
                value={form.businessName}
                onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                disabled={isNameLocked}
                className={`w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${isNameLocked ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                placeholder="Your business name"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                GSTIN *
                {isGstLocked && <span className="ml-2 text-emerald-600 font-normal">verified</span>}
              </label>
              <input
                type="text"
                value={form.gst}
                onChange={e => setForm(f => ({ ...f, gst: e.target.value.toUpperCase() }))}
                disabled={isGstLocked}
                className={`w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 ${isGstLocked ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                placeholder="15-character GSTIN"
                maxLength={15}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Entity Type *
                {isEntityLocked && <span className="ml-2 text-emerald-600 font-normal">from GST</span>}
              </label>
              <select
                value={form.entityType}
                onChange={e => setForm(f => ({ ...f, entityType: e.target.value }))}
                disabled={isEntityLocked}
                className={`w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white ${isEntityLocked ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
              >
                <option value="">Select type…</option>
                {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  PAN
                  {isPanLocked && <span className="ml-2 text-emerald-600 font-normal">verified</span>}
                  {!isPanLocked && form.pan && <span className="ml-2 text-slate-400 font-normal">from GST</span>}
                </label>
                <input
                  type="text"
                  value={form.pan}
                  onChange={e => setForm(f => ({ ...f, pan: e.target.value.toUpperCase() }))}
                  disabled={isPanLocked}
                  className={`w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 ${isPanLocked ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Est. Year</label>
                <input
                  type="number"
                  value={form.establishmentYear}
                  onChange={e => setForm(f => ({ ...f, establishmentYear: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="e.g. 2018"
                  min="1900"
                  max={new Date().getFullYear()}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  City
                  {isCityLocked && <span className="ml-2 text-emerald-600 font-normal">from GST</span>}
                </label>
                <input
                  type="text"
                  value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  disabled={isCityLocked}
                  className={`w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${isCityLocked ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                  placeholder="Mumbai"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  State
                  {isStateLocked && <span className="ml-2 text-emerald-600 font-normal">from GST</span>}
                </label>
                <input
                  type="text"
                  value={form.state}
                  onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                  disabled={isStateLocked}
                  className={`w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${isStateLocked ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                  placeholder="Maharashtra"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Registered Address
                {profile?.address && <span className="ml-2 text-emerald-600 font-normal">from GST</span>}
              </label>
              <input
                type="text"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                disabled={Boolean(profile?.address)}
                className={`w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${profile?.address ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                placeholder="Registered business address"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Mobile Number
                {isMobileLocked && <span className="ml-2 text-emerald-600 font-normal">verified</span>}
              </label>
              <input
                type="tel"
                value={form.mobileNumber}
                onChange={e => setForm(f => ({ ...f, mobileNumber: e.target.value }))}
                disabled={isMobileLocked}
                className={`w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${isMobileLocked ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                placeholder="10-digit mobile number"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-brand-800 text-white font-semibold py-2.5 rounded-lg hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving…' : 'Save & Continue'}
            </button>
          </form>
          </>
        )}
      </main>
    </div>
  );
}
