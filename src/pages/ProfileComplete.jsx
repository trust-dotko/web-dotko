import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, Loader2, Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../config/firebase';
import Navbar from '../components/Navbar';

const ENTITY_TYPES = [
  'Proprietorship', 'Partnership', 'LLP',
  'Private Limited', 'Public Limited', 'HUF', 'Trust', 'Other',
];

export default function ProfileComplete() {
  const { user, profile, refreshProfile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({
    businessName: '',
    gst: '',
    entityType: '',
    pan: '',
    city: '',
    state: '',
    establishmentYear: '',
  });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);

  // Pre-fill from existing profile
  useEffect(() => {
    if (profile) {
      setForm({
        businessName: profile.businessName || profile.tradeName || '',
        gst: profile.gst || '',
        entityType: profile.entityType || '',
        pan: profile.pan || '',
        city: profile.city || '',
        state: profile.state || '',
        establishmentYear: profile.establishmentYear || '',
      });
    }
  }, [profile]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.businessName.trim()) { setError('Business name is required.'); return; }
    if (!form.gst.trim()) { setError('GST number is required.'); return; }
    if (!form.entityType) { setError('Entity type is required.'); return; }

    setSaving(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          businessName: form.businessName.trim(),
          gst: form.gst.trim().toUpperCase(),
          entityType: form.entityType,
          pan: form.pan.trim().toUpperCase(),
          city: form.city.trim(),
          state: form.state.trim(),
          establishmentYear: form.establishmentYear || null,
          profileComplete: true,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      await refreshProfile();
      setSuccess(true);
      const destination = location.state?.from || '/dashboard';
      setTimeout(() => navigate(destination, { replace: true }), 1500);
    } catch (err) {
      setError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
          <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Business Name *</label>
              <input
                type="text"
                value={form.businessName}
                onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Your business name"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">GSTIN *</label>
              <input
                type="text"
                value={form.gst}
                onChange={e => setForm(f => ({ ...f, gst: e.target.value.toUpperCase() }))}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="15-character GSTIN"
                maxLength={15}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Entity Type *</label>
              <select
                value={form.entityType}
                onChange={e => setForm(f => ({ ...f, entityType: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="">Select type…</option>
                {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">PAN</label>
                <input
                  type="text"
                  value={form.pan}
                  onChange={e => setForm(f => ({ ...f, pan: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                <label className="block text-xs font-medium text-slate-600 mb-1.5">City</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Mumbai"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">State</label>
                <input
                  type="text"
                  value={form.state}
                  onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Maharashtra"
                />
              </div>
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
        )}
      </main>
    </div>
  );
}
