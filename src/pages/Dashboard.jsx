import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Building2, TrendingUp, ChevronRight, Shield, Users, MapPin, CheckCircle, Briefcase } from 'lucide-react';
import Navbar from '../components/Navbar';
import GSTSearchBar from '../components/GSTSearchBar';
import StatCard from '../components/StatCard';
import Badge from '../components/Badge';
import { getRiskLevel, formatDate } from '../data/trustEngine';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';



export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile }  = useAuth();
  const [recentSearches, setRecentSearches] = useState([]);

  useEffect(() => {
    const loadSearches = async () => {
      if (!user) { setRecentSearches([]); return; }
      try {
        const q = query(
          collection(db, 'users', user.uid, 'searches'),
          orderBy('searchedAt', 'desc'),
          limit(10)
        );
        const snap = await getDocs(q);
        setRecentSearches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch {
        setRecentSearches([]);
      }
    };
    loadSearches();
  }, [user]);

  const enriched = recentSearches.map(s => ({
    ...s,
    score: s.score ?? 50,
    risk:  getRiskLevel(s.score ?? 50),
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Search */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand-800" /> GST Search
          </h2>
          <GSTSearchBar placeholder="Search any GSTIN…" />
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
          <StatCard icon={TrendingUp} label="Recent Searches"    value={recentSearches.length.toString()} />
          <StatCard icon={Shield}     label="Profile Status"     value={profile?.profileComplete !== false ? "Active" : "Pending"} />
          <StatCard icon={Users}      label="Account Type"       value="User" />
        </div>

        {/* Recent searches */}
        {enriched.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 mb-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-800" /> Recent Searches
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    {['Business', 'GSTIN', 'Trust Score', 'Risk', 'Searched'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-2 px-3 first:pl-0">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enriched.map(s => (
                    <tr
                      key={s.gst}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/report/${s.gst}`)}
                    >
                      <td className="py-3 px-3 pl-0 font-medium text-slate-800">{s.name}</td>
                      <td className="py-3 px-3 font-mono text-xs text-slate-500">{s.gst}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{s.score}</td>
                      <td className="py-3 px-3"><Badge label={s.risk} /></td>
                      <td className="py-3 px-3 text-slate-500 text-xs">
                        {s.searchedAt
                          ? formatDate(typeof s.searchedAt === 'string' ? s.searchedAt : s.searchedAt.toDate().toISOString())
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick access */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-800" /> Quick Access
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {enriched.length > 0 ? (
              enriched.slice(0, 4).map(b => (
                <button
                  key={b.gst}
                  onClick={() => navigate(`/report/${b.gst}`)}
                  className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-brand-300 hover:bg-brand-50 transition-all text-left group"
                >
                  <div>
                    <p className="font-medium text-slate-800 text-sm">{b.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Trust Score: {b.score}</p>
                    <p className="font-mono text-xs text-slate-400 mt-1">{b.gst}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-800 transition-colors" />
                </button>
              ))
            ) : (
              <p className="text-sm text-slate-500 col-span-2">No recent searches. Try looking up a GSTIN above.</p>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
