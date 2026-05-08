import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, Loader2, Upload, FileText, Image, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { formatCurrency, formatDate } from '../data/trustEngine';

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE  = 10 * 1024 * 1024;

function sanitizeFilename(name) {
  const dot  = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext  = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
  return ext ? `${base.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100)}.${ext}` : base.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
}

async function uploadProof(file, userId) {
  const filename  = `${Date.now()}_${sanitizeFilename(file.name)}`;
  const storageRef = ref(storage, `trade-disputes/${userId}/${filename}`);
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, { contentType: file.type });
    task.on('state_changed', null, reject, async () => {
      try { resolve(await getDownloadURL(task.snapshot.ref)); }
      catch (e) { reject(e); }
    });
  });
}

function TradeCard({ trade, companyGSTIN, onDone }) {
  const { user } = useAuth();
  const [mode,    setMode]    = useState(null); // null | 'dispute'
  const [notes,   setNotes]   = useState('');
  const [files,   setFiles]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState('');

  const invoiceDate = trade.invoiceDate ? formatDate(trade.invoiceDate) : '—';
  const dueDate     = trade.paymentDueDate ? formatDate(trade.paymentDueDate) : '—';

  const addFiles = (incoming) => {
    const valid = Array.from(incoming).filter(f =>
      ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE
    );
    setFiles(prev => [...prev, ...valid]);
  };

  const confirm = async () => {
    setLoading(true);
    setError('');
    try {
      const token = await user.getIdToken();
      const res   = await fetch('/api/trade/verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ tradeId: trade.id, companyGSTIN, action: 'confirm' }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setDone(true);
      onDone?.(trade.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const dispute = async () => {
    if (!notes.trim()) { setError('Please describe the dispute.'); return; }
    setLoading(true);
    setError('');
    try {
      const token     = await user.getIdToken();
      const proofUrls = [];
      for (const f of files) {
        proofUrls.push(await uploadProof(f, user.uid));
      }
      const res = await fetch('/api/trade/verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ tradeId: trade.id, companyGSTIN, action: 'dispute', notes: notes.trim(), proofUrls }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setDone(true);
      onDone?.(trade.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 text-emerald-600 text-sm py-3 border-b border-slate-100 last:border-0">
        <CheckCircle2 className="w-4 h-4" />
        Response submitted for trade filed by {trade.submitterName || trade.submitterGSTIN}.
      </div>
    );
  }

  return (
    <div className="border-b border-slate-100 last:border-0 py-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
        <div>
          <p className="text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Filed By</p>
          <p className="text-slate-800 font-medium">{trade.submitterName || '—'}</p>
          {trade.submitterGSTIN && <p className="font-mono text-slate-400">{trade.submitterGSTIN}</p>}
        </div>
        <div>
          <p className="text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Amount</p>
          <p className="text-slate-800 font-medium font-mono">{(trade.tradeValue ?? trade.amount) ? formatCurrency(trade.tradeValue ?? trade.amount) : '—'}</p>
        </div>
        <div>
          <p className="text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Invoice Date</p>
          <p className="text-slate-700">{invoiceDate}</p>
        </div>
        <div>
          <p className="text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Due Date</p>
          <p className="text-slate-700">{dueDate}</p>
        </div>
      </div>
      <div className="text-xs mb-1">
        <span className="text-slate-400">Status filed: </span>
        <span className="font-medium text-slate-700">{trade.status}</span>
        {trade.tradeType && <span className="ml-2 text-slate-400">· {trade.tradeType}</span>}
      </div>

      {!mode && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={confirm}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            Confirm Trade
          </button>
          <button
            onClick={() => setMode('dispute')}
            className="flex items-center gap-1.5 text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <AlertTriangle className="w-3 h-3" /> Dispute
          </button>
        </div>
      )}

      {mode === 'dispute' && (
        <div className="mt-3 bg-red-50 border border-red-100 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-red-700">Describe the dispute</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Payment was made on time. Invoice amount is incorrect."
            className="w-full text-xs px-3 py-2 rounded-lg border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-300 bg-white resize-none"
          />
          <div>
            <p className="text-xs text-slate-500 mb-1">Attach proof (optional · PDF, JPG, PNG)</p>
            <label className="flex items-center gap-2 text-xs text-red-600 border border-dashed border-red-300 bg-white hover:bg-red-50 transition-colors rounded-lg px-3 py-2 cursor-pointer w-full justify-center">
              <Upload className="w-3.5 h-3.5" /> Add file(s)
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple className="hidden"
                onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
            </label>
            {files.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs">
                    {f.type.startsWith('image/') ? <Image className="w-3 h-3 text-blue-500" /> : <FileText className="w-3 h-3 text-red-500" />}
                    <span className="truncate max-w-[100px]">{f.name}</span>
                    <button type="button" onClick={() => setFiles(arr => arr.filter((_, j) => j !== i))}>
                      <Trash2 className="w-2.5 h-2.5 text-slate-400 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={dispute}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {loading && <Loader2 className="w-3 h-3 animate-spin" />}
              Submit Dispute
            </button>
            <button onClick={() => { setMode(null); setError(''); }} className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5">
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
    </div>
  );
}

export default function TradeVerificationModal({ userGSTIN, onClose }) {
  const [trades,  setTrades]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(new Set());

  useEffect(() => {
    if (!userGSTIN) return;
    const q = query(
      collection(db, 'companies', userGSTIN, 'trades'),
      where('verificationStatus', '==', 'pending_verification')
    );
    getDocs(q)
      .then(snap => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(t => t.submitterGSTIN !== userGSTIN);
        setTrades(list);
        setPending(new Set(list.map(t => t.id)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userGSTIN]);

  const handleDone = (id) => {
    setPending(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4 py-6 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 my-auto animate-in">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold text-slate-900">Trades Filed Against You</h2>
            <p className="text-xs text-slate-500 mt-0.5">Review each trade and confirm or dispute within 7 days.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : trades.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
            <p>No pending trades to review.</p>
          </div>
        ) : (
          <div>
            {trades.map(trade => (
              <TradeCard
                key={trade.id}
                trade={trade}
                companyGSTIN={userGSTIN}
                onDone={handleDone}
              />
            ))}
          </div>
        )}

        {!loading && pending.size === 0 && trades.length > 0 && (
          <div className="mt-4 text-center">
            <button
              onClick={onClose}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
