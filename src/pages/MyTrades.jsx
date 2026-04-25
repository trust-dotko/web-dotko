import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileText, ChevronRight, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import Navbar from '../components/Navbar';
import Badge from '../components/Badge';
import SubmitTradeModal from '../components/SubmitTradeModal';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import {
  collection, query, orderBy, getDocs,
  doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { TRADE_STATUSES, formatCurrency, formatDate } from '../data/trustEngine';

const STATUS_COLORS = {
  'Paid on Time':       'bg-emerald-100 text-emerald-700',
  'Paid Late':          'bg-amber-100 text-amber-700',
  'Partially Paid':     'bg-orange-100 text-orange-700',
  'Default/Written Off':'bg-red-100 text-red-700',
  'Disputed':           'bg-purple-100 text-purple-700',
  'Still Pending':      'bg-slate-100 text-slate-600',
  // legacy
  'Paid':    'bg-emerald-100 text-emerald-700',
  'Delayed': 'bg-amber-100 text-amber-700',
  'Unpaid':  'bg-red-100 text-red-700',
};

export default function MyTrades() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const location = useLocation();

  const [trades,        setTrades]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [updating,      setUpdating]      = useState(null); // tradeId being updated
  const [showModal,     setShowModal]     = useState(false);
  const [filterStatus,  setFilterStatus]  = useState('All');

  // Auto-open modal when navigated from Navbar's "Submit Trade" button
  useEffect(() => {
    if (location.state?.openModal) {
      setShowModal(true);
      // Clear the state so refreshing doesn't re-open it
      window.history.replaceState({}, '');
    }
  }, []);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users', user.uid, 'submittedTrades'),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setTrades(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('MyTrades load error:', err);
      setTrades([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]);

  const handleStatusUpdate = async (trade, newStatus) => {
    setUpdating(trade.id);
    try {
      const now = serverTimestamp();
      // Update in user's submittedTrades
      await updateDoc(
        doc(db, 'users', user.uid, 'submittedTrades', trade.id),
        { status: newStatus, updatedAt: now }
      );
      // Mirror update to the company's trades subcollection
      if (trade.counterpartyGSTIN) {
        await updateDoc(
          doc(db, 'companies', trade.counterpartyGSTIN, 'trades', trade.id),
          { status: newStatus, updatedAt: now }
        );
      }
      setTrades(prev =>
        prev.map(t => t.id === trade.id ? { ...t, status: newStatus } : t)
      );
    } catch (err) {
      console.error('Status update failed:', err);
      alert('Could not update status. Please try again.');
    } finally {
      setUpdating(null);
    }
  };

  const filtered = filterStatus === 'All'
    ? trades
    : trades.filter(t => t.status === filterStatus);

  const allStatuses = ['All', ...TRADE_STATUSES];

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Trades</h1>
            <p className="text-sm text-slate-500 mt-1">
              Trade reports you've submitted · {trades.length} total
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2 rounded-lg border border-slate-200 hover:border-brand-300 hover:bg-brand-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-slate-500" />
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-brand-800 hover:bg-brand-700 px-4 py-2 rounded-lg transition-colors"
            >
              <FileText className="w-4 h-4" />
              New Trade
            </button>
          </div>
        </div>

        {/* Status filter chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          {allStatuses.map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filterStatus === s
                  ? 'bg-brand-800 text-white border-brand-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-7 h-7 text-brand-800 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-12 text-center">
            <AlertTriangle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-medium text-slate-700">
              {trades.length === 0 ? 'No trade reports yet' : 'No trades match this filter'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {trades.length === 0
                ? 'Use "New Trade" to file your first report.'
                : 'Try a different status filter above.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(trade => (
              <div
                key={trade.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-brand-200 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Business info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        onClick={() => navigate(`/report/${trade.counterpartyGSTIN}`)}
                        className="font-semibold text-slate-900 hover:text-brand-800 truncate text-sm flex items-center gap-1"
                      >
                        {trade.counterpartyName || trade.counterpartyGSTIN}
                        <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                      </button>
                    </div>
                    <p className="font-mono text-xs text-slate-400">{trade.counterpartyGSTIN}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                      {trade.tradeType && <span className="bg-slate-100 px-2 py-0.5 rounded">{trade.tradeType}</span>}
                      {trade.tradeValue > 0 && <span>{formatCurrency(trade.tradeValue)}</span>}
                      {trade.invoiceDate && <span>Invoice: {formatDate(trade.invoiceDate)}</span>}
                      {trade.paymentDueDate && <span>Due: {formatDate(trade.paymentDueDate)}</span>}
                      {trade.invoiceNumber && <span>#{trade.invoiceNumber}</span>}
                    </div>
                  </div>

                  {/* Status selector */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[trade.status] || 'bg-slate-100 text-slate-600'}`}>
                      {trade.status}
                    </span>
                    <div className="relative">
                      <select
                        value={trade.status}
                        disabled={updating === trade.id}
                        onChange={e => handleStatusUpdate(trade, e.target.value)}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 cursor-pointer"
                      >
                        {TRADE_STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                      {updating === trade.id && (
                        <Loader2 className="w-3 h-3 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-brand-600 pointer-events-none" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Submitted date */}
                {trade.createdAt && (
                  <p className="text-xs text-slate-400 mt-2">
                    Submitted{' '}
                    {formatDate(
                      typeof trade.createdAt === 'string'
                        ? trade.createdAt
                        : trade.createdAt?.toDate?.()?.toISOString?.() || ''
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <SubmitTradeModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}
