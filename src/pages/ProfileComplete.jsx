import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2, Building2, ShieldCheck, Smartphone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import Navbar from '../components/Navbar';

/**
 * Your Profile — verified business details (read-only, sourced from EntityLocker)
 * plus the one optional field a user may edit client-side: establishment year.
 * Business verification itself happens through the CompleteProfileGate popup.
 */
export default function ProfileComplete() {
  const { user, profile, refreshProfile, loading, profileLoading } = useAuth();
  const navigate = useNavigate();

  const [establishmentYear, setEstablishmentYear] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) setEstablishmentYear(profile.establishmentYear || '');
  }, [profile]);

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-800 animate-spin" />
      </div>
    );
  }
  if (!user) { navigate('/login', { replace: true }); return null; }

  const saveYear = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        { establishmentYear: establishmentYear || null, updatedAt: serverTimestamp() },
        { merge: true },
      );
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Profile save error:', err);
      setError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, value }) => (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm text-slate-900 font-medium break-words">{value || '—'}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-6 h-6 text-brand-800" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Your Profile</h1>
          <p className="text-sm text-slate-500 mt-1">Verified business details on your Dotko account.</p>
        </div>

        {profile?.gst && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 mb-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-emerald-800 truncate">
                  {profile.businessName || profile.tradeName}
                </span>
                <span className="text-xs bg-emerald-600 text-white font-medium px-2 py-0.5 rounded-full">
                  GST Verified
                </span>
              </div>
              <p className="text-xs text-emerald-700 mt-0.5 font-mono">{profile.gst}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 grid grid-cols-2 gap-x-4 gap-y-5">
          <Field label="Legal Name" value={profile?.legalName} />
          <Field label="Trade Name" value={profile?.tradeName} />
          <Field label="Entity Type" value={profile?.entityType} />
          <Field label="GST Status" value={profile?.gstStatus} />
          <Field label="City" value={profile?.city} />
          <Field label="State" value={profile?.state} />
          <div className="col-span-2"><Field label="Registered Address" value={profile?.address} /></div>
          <div className="col-span-2">
            <p className="text-xs font-medium text-slate-500 mb-0.5 flex items-center gap-1">
              <Smartphone className="w-3 h-3" /> Mobile (verified)
            </p>
            <p className="text-sm text-slate-900 font-medium">+91 {profile?.mobileNumber || '—'}</p>
          </div>
        </div>

        {/* Optional, user-editable */}
        <form onSubmit={saveYear} className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 mt-4 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Establishment Year <span className="text-slate-400">(optional)</span></label>
            <input
              type="number"
              value={establishmentYear}
              onChange={(e) => setEstablishmentYear(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g. 2018"
              min="1900"
              max={new Date().getFullYear()}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-brand-800 text-white font-semibold py-2.5 rounded-lg hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saved ? <><CheckCircle className="w-4 h-4" /> Saved</> : saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      </main>
    </div>
  );
}
