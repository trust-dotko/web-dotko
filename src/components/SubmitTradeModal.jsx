import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CheckCircle2, Loader2, Search, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ProfileGuard from './ProfileGuard';
import { TRADE_STATUSES, isValidGST } from '../data/trustEngine';
import { db } from '../config/firebase';
import {
  collection, addDoc, doc, setDoc, serverTimestamp,
} from 'firebase/firestore';

const TRADE_TYPES = ['Sale', 'Purchase', 'Service Provided', 'Service Received'];

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Compute payment due date from invoiceDate + creditPeriod days */
function calcDueDate(invoiceDate, creditPeriod) {
  if (!invoiceDate || !creditPeriod || Number(creditPeriod) <= 0) return '';
  const d = new Date(invoiceDate);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + Number(creditPeriod));
  return d.toISOString().split('T')[0];
}

/** Format ISO date for display: YYYY-MM-DD → DD Mon YYYY */
function displayDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

/**
 * Split date input: three separate fields (day / month / year).
 * Avoids browser native date-picker year-entry quirks.
 * onChange(isoString) — emits YYYY-MM-DD or '' when incomplete.
 */
function DatePicker({ value, onChange, error }) {
  const [day,   setDay]   = useState('');
  const [month, setMonth] = useState('');
  const [year,  setYear]  = useState('');

  // Sync inbound ISO value → split parts
  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-');
      setYear(y);
      setMonth(m);
      setDay(d);
    }
  }, []);  // only on mount — controlled from outside after that

  const emit = (d, m, y) => {
    if (d && m && y && y.length === 4) {
      const padD = String(d).padStart(2, '0');
      const padM = String(m).padStart(2, '0');
      const iso = `${y}-${padM}-${padD}`;
      const date = new Date(iso);
      onChange(isNaN(date.getTime()) ? '' : iso);
    } else {
      onChange('');
    }
  };

  return (
    <div className={`flex gap-1.5 w-full rounded-lg border text-sm focus-within:ring-2 focus-within:ring-brand-500 ${error ? 'border-red-300' : 'border-slate-200'}`}>
      {/* Day */}
      <input
        type="number"
        min="1" max="31"
        placeholder="DD"
        value={day}
        onChange={e => { setDay(e.target.value); emit(e.target.value, month, year); }}
        className="w-12 px-2 py-2 text-center focus:outline-none bg-transparent border-r border-slate-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {/* Month */}
      <select
        value={month}
        onChange={e => { setMonth(e.target.value); emit(day, e.target.value, year); }}
        className="flex-1 px-1 py-2 focus:outline-none bg-transparent border-r border-slate-200 text-slate-700"
      >
        <option value="">MM</option>
        {MONTHS.map((m, i) => (
          <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
        ))}
      </select>
      {/* Year */}
      <input
        type="number"
        min="2000" max="2099"
        placeholder="YYYY"
        value={year}
        onChange={e => { setYear(e.target.value); emit(day, month, e.target.value); }}
        className="w-16 px-2 py-2 text-center focus:outline-none bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </div>
  );
}

/** Hoisted outside the modal so React never unmounts it on re-render */
function InputField({ label, type = 'text', value, onChange, error, readOnly = false, children, ...rest }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      {children || (
        <input
          type={type}
          value={value ?? ''}
          readOnly={readOnly}
          onChange={readOnly ? undefined : e => onChange(e.target.value)}
          className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand-500
            ${error ? 'border-red-300' : 'border-slate-200'}
            ${readOnly ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
          {...rest}
        />
      )}
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
}

export default function SubmitTradeModal({ gst: prefilledGST, businessName: prefilledName, onClose, onSuccess }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const isLocked = Boolean(prefilledGST); // counterparty pre-filled from Report page

  const [form, setForm] = useState({
    counterpartyGSTIN: prefilledGST  || '',
    counterpartyName:  prefilledName || '',
    tradeType:         'Sale',
    invoiceNumber:     '',
    tradeValue:        '',
    creditPeriod:      '',
    invoiceDate:       '',
    paymentDueDate:    '',
    status:            'Still Pending',
  });
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [gstLookup, setGstLookup] = useState({ loading: false, done: false, error: '' });

  // Auto-recalculate paymentDueDate whenever invoiceDate or creditPeriod changes
  useEffect(() => {
    setForm(f => ({
      ...f,
      paymentDueDate: calcDueDate(f.invoiceDate, f.creditPeriod),
    }));
  }, [form.invoiceDate, form.creditPeriod]);

  const set = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: undefined }));
  };

  // GST lookup for non-locked (open) mode
  const handleGSTLookup = useCallback(async () => {
    const clean = (form.counterpartyGSTIN || '').trim().toUpperCase();
    if (!isValidGST(clean)) {
      setErrors(e => ({ ...e, counterpartyGSTIN: 'Enter a valid 15-character GSTIN first' }));
      return;
    }
    setGstLookup({ loading: true, done: false, error: '' });
    try {
      const res = await fetch('/api/gst-verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ gstin: clean }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        const name = data.data.tradeName || data.data.legalName || clean;
        setForm(f => ({ ...f, counterpartyGSTIN: clean, counterpartyName: name }));
        setGstLookup({ loading: false, done: true, error: '' });
      } else {
        setGstLookup({ loading: false, done: false, error: data.error || 'GSTIN not found' });
      }
    } catch {
      setGstLookup({ loading: false, done: false, error: 'Lookup failed. Please try again.' });
    }
  }, [form.counterpartyGSTIN]);

  const validate = () => {
    const e = {};
    if (!isValidGST(form.counterpartyGSTIN)) e.counterpartyGSTIN = 'Valid 15-character GSTIN required';
    if (!form.tradeType) e.tradeType = 'Required';
    if (!form.tradeValue || Number(form.tradeValue) <= 0) e.tradeValue = 'Must be > 0';
    if (!form.creditPeriod || Number(form.creditPeriod) <= 0) e.creditPeriod = 'Must be > 0';
    if (!form.invoiceDate) e.invoiceDate = 'Required';
    if (!form.status) e.status = 'Required';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) { navigate('/login'); return; }
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const cleanGSTIN = form.counterpartyGSTIN.trim().toUpperCase();
      const tradePayload = {
        counterpartyGSTIN: cleanGSTIN,
        counterpartyName:  form.counterpartyName.trim(),
        tradeType:         form.tradeType,
        invoiceNumber:     form.invoiceNumber.trim(),
        tradeValue:        Number(form.tradeValue),
        creditPeriod:      Number(form.creditPeriod),
        invoiceDate:       form.invoiceDate,
        paymentDueDate:    form.paymentDueDate,
        status:            form.status,
        submittedBy:       user.uid,
        submitterGSTIN:    (profile?.gst || '').trim().toUpperCase(),
        submitterName:     (profile?.businessName || profile?.legalName || '').trim(),
        createdAt:         serverTimestamp(),
        updatedAt:         serverTimestamp(),
      };

      // 1. Write trade to the company's public subcollection
      const tradeRef = await addDoc(
        collection(db, 'companies', cleanGSTIN, 'trades'),
        tradePayload
      );

      // 2. Ensure the company document exists so the Report page can load it
      await setDoc(
        doc(db, 'companies', cleanGSTIN),
        { gst: cleanGSTIN, name: tradePayload.counterpartyName, updatedAt: serverTimestamp() },
        { merge: true }
      );

      // 3. Mirror to user's submittedTrades for My Trades page
      await setDoc(
        doc(db, 'users', user.uid, 'submittedTrades', tradeRef.id),
        { ...tradePayload, companyTradeId: tradeRef.id }
      );

      // 4. Fire-and-forget: ask the API to create the in-app notification
      //    (works in production; fails silently in dev — that's acceptable)
      user.getIdToken().then(token =>
        fetch('/api/trade/submit', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ ...tradePayload, tradeId: tradeRef.id }),
        })
      ).catch(() => {});

      const savedTrade = { id: tradeRef.id, ...tradePayload };
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.(savedTrade);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Trade submit error:', err);
      setErrors({ submit: err.message || 'Submission failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4 py-6 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 animate-in my-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold text-slate-900">Submit Trade Report</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Report a trade against {isLocked ? <span className="font-mono">{prefilledGST}</span> : 'a business'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <ProfileGuard fallbackMessage="Complete your profile to submit trade reports.">
          {success ? (
            <div className="text-center py-10">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="font-semibold text-slate-900">Trade submitted!</p>
              <p className="text-sm text-slate-500 mt-1">Trust score will reflect this report.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Counterparty GSTIN */}
              <InputField label={
                <span className="flex items-center gap-1">
                  Counterparty GSTIN
                  {isLocked && <Lock className="w-3 h-3 text-slate-400 inline" />}
                </span>
              } error={errors.counterpartyGSTIN}>
                {isLocked ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={form.counterpartyGSTIN}
                      readOnly
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-slate-50 text-slate-500 cursor-not-allowed font-mono"
                    />
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.counterpartyGSTIN}
                      onChange={e => {
                        set('counterpartyGSTIN', e.target.value.toUpperCase());
                        setGstLookup({ loading: false, done: false, error: '' });
                        setForm(f => ({ ...f, counterpartyName: '' }));
                      }}
                      maxLength={15}
                      placeholder="e.g. 27AAPFU0939F1ZV"
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 ${errors.counterpartyGSTIN ? 'border-red-300' : 'border-slate-200'}`}
                    />
                    <button
                      type="button"
                      onClick={handleGSTLookup}
                      disabled={gstLookup.loading}
                      className="px-3 py-2 rounded-lg border border-slate-200 hover:border-brand-300 hover:bg-brand-50 transition-colors text-sm text-slate-600 flex items-center gap-1"
                    >
                      {gstLookup.loading
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Search className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
                {gstLookup.error && <p className="text-red-600 text-xs mt-1">{gstLookup.error}</p>}
              </InputField>

              {/* Counterparty Name (auto-filled or pre-filled) */}
              <InputField
                label="Business Name"
                value={form.counterpartyName}
                onChange={v => set('counterpartyName', v)}
                error={errors.counterpartyName}
                readOnly={isLocked || gstLookup.done}
                placeholder={gstLookup.done || isLocked ? '' : 'Auto-filled after GSTIN lookup'}
              />

              {/* Trade Type */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Trade Type</label>
                <select
                  value={form.tradeType}
                  onChange={e => set('tradeType', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white ${errors.tradeType ? 'border-red-300' : 'border-slate-200'}`}
                >
                  {TRADE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                {errors.tradeType && <p className="text-red-600 text-xs mt-1">{errors.tradeType}</p>}
              </div>

              {/* Invoice Number + Trade Value */}
              <div className="grid grid-cols-2 gap-3">
                <InputField
                  label="Invoice No. (optional)"
                  value={form.invoiceNumber}
                  onChange={v => set('invoiceNumber', v)}
                  error={errors.invoiceNumber}
                  placeholder="e.g. INV-2024-001"
                />
                <InputField
                  label="Trade Value (₹)"
                  type="number"
                  value={form.tradeValue}
                  onChange={v => set('tradeValue', v)}
                  error={errors.tradeValue}
                  min="1"
                  step="1"
                />
              </div>

              {/* Invoice Date + Credit Period */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Invoice Date</label>
                  <DatePicker
                    value={form.invoiceDate}
                    onChange={v => set('invoiceDate', v)}
                    error={errors.invoiceDate}
                  />
                  {errors.invoiceDate && <p className="text-red-600 text-xs mt-1">{errors.invoiceDate}</p>}
                </div>
                <InputField
                  label="Credit Period (days)"
                  type="number"
                  value={form.creditPeriod}
                  onChange={v => set('creditPeriod', v)}
                  error={errors.creditPeriod}
                  min="1"
                  step="1"
                />
              </div>

              {/* Payment Due Date (read-only, auto-calculated) */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Payment Due Date (auto)</label>
                <div className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-slate-50 text-slate-500 min-h-[38px]">
                  {form.paymentDueDate ? displayDate(form.paymentDueDate) : <span className="text-slate-400">Fill invoice date + credit period</span>}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Current Status</label>
                <select
                  value={form.status}
                  onChange={e => set('status', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white ${errors.status ? 'border-red-300' : 'border-slate-200'}`}
                >
                  {TRADE_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
                {errors.status && <p className="text-red-600 text-xs mt-1">{errors.status}</p>}
              </div>

              {errors.submit && (
                <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{errors.submit}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-800 text-white font-semibold py-2.5 rounded-lg hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Submitting…' : 'Submit Trade Report'}
              </button>
            </form>
          )}
        </ProfileGuard>
      </div>
    </div>
  );
}
