import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, Briefcase, AlertTriangle, TrendingUp, BadgeCheck, Plus } from 'lucide-react';
import Navbar from '../components/Navbar';
import ScoreRing from '../components/ScoreRing';
import TradeTable from '../components/TradeTable';
import StatCard from '../components/StatCard';
import Badge from '../components/Badge';
import SubmitTradeModal from '../components/SubmitTradeModal';
import { calculateTrustScore, getRiskLevel, formatCurrency } from '../data/trustEngine';
import { db } from '../config/firebase';
import { doc, getDoc, collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';

export default function Report() {
  const { gst }     = useParams();
  const navigate    = useNavigate();
  const location    = useLocation();

  const [business,   setBusiness]   = useState(null);
  const [trades,     setTrades]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [notFound,   setNotFound]   = useState(false);
  const [showModal,  setShowModal]  = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        // 1. Try Firestore
        const bizSnap = await getDoc(doc(db, 'companies', gst));
        if (bizSnap.exists()) {
          setBusiness({ gst, ...bizSnap.data() });
        } else {
          // 2. Fall back to GST API data passed via router state
          const gstData = location.state?.gstData;
          if (gstData) {
            setBusiness({
              gst,
              name:               gstData.tradeName || gstData.legalName || gst,
              state:              gstData.principalAddress?.state || gstData.stateCode || '',
              city:               gstData.principalAddress?.district || '',
              type:               gstData.constitutionOfBusiness || '',
              incorporated:       gstData.registrationDate || '',
              industry:           '',
              registeredAddress:  gstData.principalAddress?.fullAddress || '',
              status:             gstData.status || '',
            });
          } else {
            setNotFound(true);
          }
        }

        // 3. Load trades subcollection
        const tradesSnap = await getDocs(collection(db, 'companies', gst, 'trades'));
        setTrades(tradesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Report load error:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [gst]);

  const score = useMemo(() => calculateTrustScore(trades), [trades]);
  const risk  = useMemo(() => getRiskLevel(score),         [score]);

  const paid        = trades.filter(t => t.status === 'Paid').length;
  const delayed     = trades.filter(t => t.status === 'Delayed').length;
  const unpaid      = trades.filter(t => t.status === 'Unpaid').length;
  const totalVolume = trades.reduce((sum, t) => sum + (t.amount || 0), 0);

  const handleTradeSubmit = async (newTrade) => {
    const ref = await addDoc(
      collection(db, 'companies', gst, 'trades'),
      { ...newTrade, createdAt: serverTimestamp() }
    );
    setTrades(prev => [...prev, { id: ref.id, ...newTrade }]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-brand-800 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">No data found</h2>
          <p className="text-slate-500 text-sm mb-6">
            We couldn't find any information for GSTIN{' '}
            <span className="font-mono font-medium">{gst}</span>.
          </p>
          <button onClick={() => navigate(-1)} className="text-sm text-brand-800 hover:underline">
            ← Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-800 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-6">
            <ScoreRing score={score} />
            <div className="flex-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{business.name}</h1>
                  <p className="font-mono text-sm text-slate-500 mt-0.5">{gst}</p>
                </div>
                <Badge label={risk} size="lg" />
              </div>
              <div className="mt-4 grid sm:grid-cols-2 gap-2 text-sm">
                {(business.city || business.state) && (
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <MapPin className="w-3.5 h-3.5" />
                    {[business.city, business.state].filter(Boolean).join(', ')}
                  </div>
                )}
                {business.type && (
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Briefcase className="w-3.5 h-3.5" />{business.type}
                  </div>
                )}
                {business.incorporated && (
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Calendar className="w-3.5 h-3.5" />Since {business.incorporated}
                  </div>
                )}
                {business.status && (
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <BadgeCheck className="w-3.5 h-3.5" />GST Status: {business.status}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard icon={TrendingUp}    label="Total Volume" value={formatCurrency(totalVolume)} />
          <StatCard icon={BadgeCheck}    label="Paid"         value={paid.toString()}    sub={`${trades.length} total trades`} />
          <StatCard icon={AlertTriangle} label="Delayed"      value={delayed.toString()} />
          <StatCard icon={AlertTriangle} label="Unpaid"       value={unpaid.toString()}  accent={unpaid > 0} />
        </div>

        {/* Trade history */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Trade History</h2>
            <button
              id="submit-trade-btn"
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-brand-800 hover:bg-brand-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Submit Trade
            </button>
          </div>
          <TradeTable trades={trades} />
        </div>

        {/* Score breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Score Breakdown</h2>
          {trades.length === 0 ? (
            <p className="text-sm text-slate-500">No trade history. Score defaults to 50.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Base score</span>
                <span className="font-medium">100</span>
              </div>
              {unpaid > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Unpaid trades ({unpaid} × −20)</span>
                  <span>−{unpaid * 20}</span>
                </div>
              )}
              {delayed > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Delayed trades ({delayed} × −10)</span>
                  <span>−{delayed * 10}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t border-slate-200 pt-2">
                <span>Final Trust Score</span>
                <span>{score}</span>
              </div>
            </div>
          )}
        </div>

      </main>

      {showModal && business && (
        <SubmitTradeModal
          gst={gst}
          businessName={business.name}
          onClose={() => setShowModal(false)}
          onSubmit={handleTradeSubmit}
        />
      )}
    </div>
  );
}
