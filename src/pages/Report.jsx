import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, Briefcase, AlertTriangle, TrendingUp, BadgeCheck, Plus, Download } from 'lucide-react';
import Navbar from '../components/Navbar';
import ScoreRing from '../components/ScoreRing';
import TradeTable from '../components/TradeTable';
import StatCard from '../components/StatCard';
import Badge from '../components/Badge';
import SubmitTradeModal from '../components/SubmitTradeModal';
import { calculateTrustScore, getRiskLevel, getRiskHeadline, getTrustPhrase, getRiskColors, formatCurrency } from '../data/trustEngine';
import { db } from '../config/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';

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
        let bizSnap;
        try {
          bizSnap = await getDoc(doc(db, 'companies', gst));
        } catch (e) {
          console.warn('Firestore read error on companies doc:', e.message);
        }

        if (bizSnap?.exists()) {
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
        let tradesSnap;
        try {
          tradesSnap = await getDocs(collection(db, 'companies', gst, 'trades'));
          setTrades(tradesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
          console.warn('Firestore read error on trades:', e.message);
          setTrades([]);
        }
      } catch (err) {
        console.error('Report load error:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [gst]);

  const { score, autoFlagged } = useMemo(
    () => calculateTrustScore(trades, {
      status:            business?.status,
      incorporated:      business?.incorporated,
      registrationDate:  business?.incorporated,
      name:              business?.name,
      legalName:         business?.legalName,
      type:              business?.type,
      registeredAddress: business?.registeredAddress,
      city:              business?.city,
      state:             business?.state,
      isVerified:        business?.isVerified,
      verifiedByDotko:   business?.verifiedByDotko,
    }),
    [trades, business]
  );
  const risk     = useMemo(() => getRiskLevel(score),      [score]);
  const headline = useMemo(() => getRiskHeadline(risk),    [risk]);
  const phrase   = useMemo(() => getTrustPhrase(score),    [score]);
  const riskColors = useMemo(() => getRiskColors(risk),    [risk]);

  const paid        = trades.filter(t => t.status === 'Paid' || t.status === 'Paid on Time' || t.status === 'Paid Late').length;
  const delayed     = trades.filter(t => t.status === 'Delayed' || t.status === 'Paid Late' || t.status === 'Partially Paid').length;
  const unpaid      = trades.filter(t => t.status === 'Unpaid' || t.status === 'Default/Written Off').length;
  const defaulted   = trades.filter(t => t.status === 'Default/Written Off' || t.status === 'Unpaid').length;
  const totalVolume = trades.reduce((sum, t) => sum + (t.amount || 0), 0);

  // Called by SubmitTradeModal after a successful API submission
  const handleTradeSuccess = (newTrade) => {
    if (newTrade) {
      setTrades(prev => [...prev, newTrade]);
    }
  };

  const handleDownload = async () => {
    try {
      const { default: jsPDF }       = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');

      const element = document.getElementById('report-main');
      const canvas  = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');

      const pdf   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW  = pageW;
      const imgH  = (canvas.height * pageW) / canvas.width;

      let yPos = 0;
      while (yPos < imgH) {
        if (yPos > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, -yPos, imgW, imgH);
        yPos += pageH;
      }

      pdf.save(`${gst}-dotko-report.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('Could not generate PDF. Please try again.');
    }
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
      <main id="report-main" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          data-html2canvas-ignore="true"
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownload}
                    data-html2canvas-ignore="true"
                    className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-brand-800 border border-slate-200 hover:border-brand-300 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Download</span>
                  </button>
                  <Badge label={risk} size="lg" />
                </div>
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

              {/* Trust advisory */}
              {score !== null && (
                <div className={`mt-4 rounded-xl border px-4 py-3 ${riskColors.bg} ${riskColors.border}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${riskColors.text}`}>
                    {headline}
                  </p>
                  <p className={`text-sm ${riskColors.text}`}>{phrase}</p>
                  {autoFlagged && (
                    <p className="text-xs text-red-600 font-medium mt-1">
                      ⚠ Auto-flagged: 6 or more negative trades on record.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard icon={TrendingUp}    label="Total Volume"   value={formatCurrency(totalVolume)} />
          <StatCard icon={BadgeCheck}    label="Paid/Resolved" value={paid.toString()}      sub={`${trades.length} total trades`} />
          <StatCard icon={AlertTriangle} label="Late/Partial"  value={delayed.toString()} />
          <StatCard icon={AlertTriangle} label="Defaults"      value={defaulted.toString()} accent={defaulted > 0} />
        </div>

        {/* Trade history */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Trade History</h2>
            <button
              id="submit-trade-btn"
              data-html2canvas-ignore="true"
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-brand-800 hover:bg-brand-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Submit Trade
            </button>
          </div>
          <TradeTable trades={trades} />
        </div>


      </main>

      {showModal && business && (
        <SubmitTradeModal
          gst={gst}
          businessName={business.name}
          onClose={() => setShowModal(false)}
          onSuccess={handleTradeSuccess}
        />
      )}
    </div>
  );
}
