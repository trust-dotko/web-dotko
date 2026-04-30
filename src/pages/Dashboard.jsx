import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TrendingUp, Shield, Users, MapPin, CheckCircle, Briefcase } from 'lucide-react';
import Navbar from '../components/Navbar';
import GSTSearchBar from '../components/GSTSearchBar';
import StatCard from '../components/StatCard';
import Badge from '../components/Badge';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import { collection, getCountFromServer } from 'firebase/firestore';



export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile }  = useAuth();
  const location = useLocation();
  useEffect(() => {
    if (location.state?.focusSearch) {
      document.getElementById('gst-search-input')?.focus();
    }
  }, [location.state]);
  const [submittedTradeCount, setSubmittedTradeCount] = useState(null);

  useEffect(() => {
    if (!user) { setSubmittedTradeCount(0); return; }
    getCountFromServer(collection(db, 'users', user.uid, 'submittedTrades'))
      .then(snap => setSubmittedTradeCount(snap.data().count))
      .catch(() => setSubmittedTradeCount(0));
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Search */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-brand-800" /> GST Search
            </h2>
            <button
              onClick={() => navigate('/report/new')} // We can make a generic report page or focus search
              className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-brand-800 hover:bg-brand-700 px-4 py-2 rounded-lg transition-colors"
            >
              <TrendingUp className="w-4 h-4" /> Submit Trade Report
            </button>
          </div>
          <GSTSearchBar placeholder="Search any GSTIN to view report or submit trade…" />
        </div>

        {/* User's Business Profile */}
        {user && (
          <div className="bg-brand-800 text-white rounded-2xl border border-brand-700 shadow-xl p-6 mb-6 relative overflow-hidden">
             {/* Background blobs for aesthetics */}
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-emerald-400/20 rounded-full blur-xl" />
            
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-brand-200 uppercase tracking-wider mb-2">My Profile</h2>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-bold">{profile?.businessName || profile?.legalName || user.email}</h1>
                  {profile?.gstStatus === 'Active' && <CheckCircle className="w-5 h-5 text-emerald-400" />}
                </div>
                {profile?.gst && <p className="font-mono text-brand-200 mt-1">GSTIN: {profile.gst}</p>}
                
                <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-brand-100">
                  {(profile?.city || profile?.state) && (
                    <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {profile.city}{profile.city && profile.state ? ', ' : ''}{profile.state}</span>
                  )}
                  {profile?.entityType && (
                    <span className="flex items-center gap-1.5"><Briefcase className="w-4 h-4" /> {profile.entityType}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                 <Badge label={profile?.profileComplete !== false ? "Profile Active" : "Profile Pending"} size="lg" />
                 {(!profile || !profile.gst) && (
                    <button onClick={() => navigate('/profile/complete')} className="bg-white text-brand-900 text-xs font-bold px-4 py-2 rounded-lg hover:bg-brand-50 transition-colors">
                      Complete Profile
                    </button>
                 )}
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard icon={TrendingUp} label="Searches Done" value="0" />
          <StatCard icon={Shield}     label="Profile Status"    value={profile?.profileComplete !== false ? "Active" : "Pending"} />
          <StatCard
            icon={Briefcase}
            label="Submitted Trades"
            value={submittedTradeCount === null ? '…' : submittedTradeCount.toString()}
            onClick={() => navigate('/my-trades')}
            className="cursor-pointer hover:border-brand-300 hover:bg-brand-50 transition-colors"
          />
          <StatCard icon={Users}      label="Account Type"      value="User" />
        </div>


      </main>
    </div>
  );
}
