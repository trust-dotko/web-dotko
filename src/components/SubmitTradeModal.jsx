import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CheckCircle2, Loader2, Search, Lock, Upload, FileText, Image, Trash2, Paperclip, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ProfileGuard from './ProfileGuard';
import { TRADE_STATUSES, isValidGST } from '../data/trustEngine';
import { uploadTradeFile, ACCEPTED_TYPES, MAX_FILE_SIZE, MAX_FILES } from '../utils/fileUpload';

const TRADE_TYPES = ['Sale', 'Purchase', 'Service Provided', 'Service Received'];

// Status options differ by mode: a "trade" is a routine record; a "report" is a
// payment default that opens the 7-day appeal window.
const REPORT_STATUS = 'Default/Written Off';
const TRADE_STATUS_OPTIONS = ['Paid on Time', 'Paid Late', 'Partially Paid', 'Still Pending'];

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
 */
function DatePicker({ value, onChange, error }) {
  const [day,   setDay]   = useState('');
  const [month, setMonth] = useState('');
  const [year,  setYear]  = useState('');

  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-');
      setYear(y); setMonth(m); setDay(d);
    }
  }, []);

  const emit = (d, m, y) => {
    if (d && m && y && y.length === 4) {
      const padD = String(d).padStart(2, '0');
      const padM = String(m).padStart(2, '0');
      const iso  = `${y}-${padM}-${padD}`;
      const date = new Date(iso);
      onChange(isNaN(date.getTime()) ? '' : iso);
    } else {
      onChange('');
    }
  };

  return (
    <div className={`flex gap-1.5 w-full rounded-lg border text-sm focus-within:ring-2 focus-within:ring-brand-500 ${error ? 'border-red-300' : 'border-slate-200'}`}>
      <input type="number" min="1" max="31" placeholder="DD" value={day}
        onChange={e => { setDay(e.target.value); emit(e.target.value, month, year); }}
        className="w-12 px-2 py-2 text-center focus:outline-none bg-transparent border-r border-slate-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <select value={month} onChange={e => { setMonth(e.target.value); emit(day, e.target.value, year); }}
        className="flex-1 px-1 py-2 focus:outline-none bg-transparent border-r border-slate-200 text-slate-700"
      >
        <option value="">MM</option>
        {MONTHS.map((m, i) => (
          <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
        ))}
      </select>
      <input type="number" min="2000" max="2099" placeholder="YYYY" value={year}
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

/** File chip shown after a file is selected */
function FileChip({ file, onRemove }) {
  const isImage = file.type.startsWith('image/');
  return (
    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
      {isImage
        ? <Image className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
        : <FileText className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
      <span className="text-slate-700 truncate max-w-[140px]">{file.name}</span>
      <span className="text-slate-400 flex-shrink-0">
        {(file.size / 1024).toFixed(0)} KB
      </span>
      <button type="button" onClick={onRemove} className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function SubmitTradeModal({ gst: prefilledGST, businessName: prefilledName, mode = 'trade', onClose, onSuccess }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const isReport = mode === 'report';
  const isLocked = Boolean(prefilledGST);

  const [form, setForm] = useState({
    counterpartyGSTIN: prefilledGST  || '',
    counterpartyName:  prefilledName || '',
    tradeType:         'Sale',
    invoiceNumber:     '',
    tradeValue:        '',
    creditPeriod:      '',
    invoiceDate:       '',
    paymentDueDate:    '',
    status:            isReport ? REPORT_STATUS : 'Still Pending',
  });
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [gstLookup, setGstLookup] = useState({ loading: false, done: false, error: '' });

  // File upload state
  const [invoiceFiles, setInvoiceFiles] = useState([]); // File[]
  const [ledgerFiles,  setLedgerFiles]  = useState([]); // File[]
  const [uploadStatus, setUploadStatus] = useState('');  // progress label
  const invoiceInputRef = useRef(null);
  const ledgerInputRef  = useRef(null);

  // Auto-recalculate paymentDueDate
  useEffect(() => {
    setForm(f => ({ ...f, paymentDueDate: calcDueDate(f.invoiceDate, f.creditPeriod) }));
  }, [form.invoiceDate, form.creditPeriod]);

  const set = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: undefined }));
  };

  // GST lookup
  const handleGSTLookup = useCallback(async () => {
    const clean = (form.counterpartyGSTIN || '').trim().toUpperCase();
    if (!isValidGST(clean)) {
      setErrors(e => ({ ...e, counterpartyGSTIN: 'Enter a valid 15-character GSTIN first' }));
      return;
    }
    setGstLookup({ loading: true, done: false, error: '' });
    try {
      const res  = await fetch('/api/gst-verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gstin: clean }) });
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

  // File pickers
  const addFiles = (existing, incoming, setter) => {
    const fileErr = [];
    const valid = Array.from(incoming).filter(f => {
      if (!ACCEPTED_TYPES.includes(f.type)) { fileErr.push(`${f.name}: only PDF, JPG, PNG allowed`); return false; }
      if (f.size > MAX_FILE_SIZE)            { fileErr.push(`${f.name}: exceeds 3 MB limit`);         return false; }
      return true;
    });
    const next = [...existing, ...valid].slice(0, MAX_FILES);
    if (next.length < existing.length + valid.length) fileErr.push(`Max ${MAX_FILES} files`);
    if (fileErr.length) setErrors(e => ({ ...e, files: fileErr.join(' · ') }));
    setter(next);
  };

  const validate = () => {
    const e = {};
    if (!isValidGST(form.counterpartyGSTIN)) e.counterpartyGSTIN = 'Valid 15-character GSTIN required';
    if (!form.tradeType)                      e.tradeType         = 'Required';
    if (!form.tradeValue || Number(form.tradeValue) <= 0) e.tradeValue = 'Must be > 0';
    if (!form.creditPeriod || Number(form.creditPeriod) <= 0) e.creditPeriod = 'Must be > 0';
    if (!form.invoiceDate)                    e.invoiceDate       = 'Required';
    if (!form.status)                         e.status            = 'Required';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) { navigate('/login'); return; }
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    // A default report requires at least one piece of evidence.
    if (isReport && invoiceFiles.length === 0 && ledgerFiles.length === 0) {
      setErrors(e => ({ ...e, files: 'Attach an invoice or ledger as proof of the default.' }));
      return;
    }

    setLoading(true);
    try {
      const getToken = () => user.getIdToken();

      // 1. Upload files through the authenticated proxy (returns storage paths + hashes)
      const allFiles = [
        ...invoiceFiles.map(f => ({ file: f, category: 'invoice' })),
        ...ledgerFiles .map(f => ({ file: f, category: 'ledger'  })),
      ];
      const invoiceUrls = [];
      const ledgerUrls  = [];
      const fileHashes  = [];

      for (let i = 0; i < allFiles.length; i++) {
        const { file, category } = allFiles[i];
        setUploadStatus(`Uploading ${i + 1}/${allFiles.length}: ${file.name}…`);
        const { path, hash } = await uploadTradeFile(file, getToken);
        if (category === 'invoice') invoiceUrls.push(path);
        else                        ledgerUrls.push(path);
        fileHashes.push(hash);
      }
      setUploadStatus('Saving…');

      // 2. Submit through the authoritative server endpoint (it writes all docs).
      const token = await getToken();
      const res = await fetch('/api/trade', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action:            'submit',
          counterpartyGSTIN: form.counterpartyGSTIN.trim().toUpperCase(),
          counterpartyName:  form.counterpartyName.trim(),
          tradeType:         form.tradeType,
          invoiceNumber:     form.invoiceNumber.trim(),
          tradeValue:        Number(form.tradeValue),
          creditPeriod:      Number(form.creditPeriod),
          invoiceDate:       form.invoiceDate,
          paymentDueDate:    form.paymentDueDate,
          status:            form.status,
          invoiceUrls,
          ledgerUrls,
          fileHashes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || (data.fields ? Object.values(data.fields)[0] : 'Submission failed'));
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.(data.trade);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Trade submit error:', err);
      setErrors({ submit: err.message || 'Submission failed. Please try again.' });
    } finally {
      setLoading(false);
      setUploadStatus('');
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
            <h2 className="font-semibold text-slate-900">
              {isReport ? 'Report a Default' : 'Submit a Trade'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isReport
                ? <>Report non-payment by {isLocked ? <span className="font-mono">{prefilledGST}</span> : 'a business'} · opens a 7-day appeal window</>
                : <>Record a trade you did with {isLocked ? <span className="font-mono">{prefilledGST}</span> : 'a business'}</>}
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
                  <input type="text" value={form.counterpartyGSTIN} readOnly
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-slate-50 text-slate-500 cursor-not-allowed font-mono"
                  />
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
                    <button type="button" onClick={handleGSTLookup} disabled={gstLookup.loading}
                      className="px-3 py-2 rounded-lg border border-slate-200 hover:border-brand-300 hover:bg-brand-50 transition-colors text-sm text-slate-600 flex items-center gap-1"
                    >
                      {gstLookup.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
                {gstLookup.error && <p className="text-red-600 text-xs mt-1">{gstLookup.error}</p>}
              </InputField>

              {/* Business Name */}
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
                <select value={form.tradeType} onChange={e => set('tradeType', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white ${errors.tradeType ? 'border-red-300' : 'border-slate-200'}`}
                >
                  {TRADE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                {errors.tradeType && <p className="text-red-600 text-xs mt-1">{errors.tradeType}</p>}
              </div>

              {/* Invoice No + Trade Value */}
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Invoice No. (optional)" value={form.invoiceNumber}
                  onChange={v => set('invoiceNumber', v)} error={errors.invoiceNumber} placeholder="e.g. INV-2024-001"
                />
                <InputField label="Trade Value (₹)" type="number" value={form.tradeValue}
                  onChange={v => set('tradeValue', v)} error={errors.tradeValue} min="1" step="1"
                />
              </div>

              {/* Invoice Date + Credit Period */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Invoice Date</label>
                  <DatePicker value={form.invoiceDate} onChange={v => set('invoiceDate', v)} error={errors.invoiceDate} />
                  {errors.invoiceDate && <p className="text-red-600 text-xs mt-1">{errors.invoiceDate}</p>}
                </div>
                <InputField label="Credit Period (days)" type="number" value={form.creditPeriod}
                  onChange={v => set('creditPeriod', v)} error={errors.creditPeriod} min="1" step="1"
                />
              </div>

              {/* Payment Due Date (auto) */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Payment Due Date (auto)</label>
                <div className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-slate-50 text-slate-500 min-h-[38px]">
                  {form.paymentDueDate
                    ? displayDate(form.paymentDueDate)
                    : <span className="text-slate-400">Fill invoice date + credit period</span>}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Current Status</label>
                {isReport ? (
                  <div className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700 font-medium">
                    <AlertTriangle className="w-4 h-4" /> Default / Written Off
                  </div>
                ) : (
                  <select value={form.status} onChange={e => set('status', e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white ${errors.status ? 'border-red-300' : 'border-slate-200'}`}
                  >
                    {TRADE_STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                )}
                {errors.status && <p className="text-red-600 text-xs mt-1">{errors.status}</p>}
              </div>

              {/* ── File Attachments ── */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <p className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5" /> Attach Documents <span className="font-normal text-slate-400">(optional · PDF, JPG, PNG · max 3 MB each)</span>
                </p>

                {/* Invoice Copies */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Invoice Copies</label>
                  <input
                    ref={invoiceInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    multiple
                    className="hidden"
                    onChange={e => {
                      addFiles(invoiceFiles, e.target.files, setInvoiceFiles);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => invoiceInputRef.current?.click()}
                    className="flex items-center gap-2 text-xs text-brand-800 border border-dashed border-brand-300 bg-brand-50 hover:bg-brand-100 transition-colors rounded-lg px-3 py-2 w-full justify-center"
                  >
                    <Upload className="w-3.5 h-3.5" /> Add invoice file(s)
                  </button>
                  {invoiceFiles.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {invoiceFiles.map((f, i) => (
                        <FileChip key={i} file={f} onRemove={() => setInvoiceFiles(arr => arr.filter((_, j) => j !== i))} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Ledger Copy */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Ledger Copy</label>
                  <input
                    ref={ledgerInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    multiple
                    className="hidden"
                    onChange={e => {
                      addFiles(ledgerFiles, e.target.files, setLedgerFiles);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => ledgerInputRef.current?.click()}
                    className="flex items-center gap-2 text-xs text-brand-800 border border-dashed border-brand-300 bg-brand-50 hover:bg-brand-100 transition-colors rounded-lg px-3 py-2 w-full justify-center"
                  >
                    <Upload className="w-3.5 h-3.5" /> Add ledger file(s)
                  </button>
                  {ledgerFiles.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ledgerFiles.map((f, i) => (
                        <FileChip key={i} file={f} onRemove={() => setLedgerFiles(arr => arr.filter((_, j) => j !== i))} />
                      ))}
                    </div>
                  )}
                </div>

                {errors.files && (
                  <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{errors.files}</p>
                )}
              </div>

              {errors.submit && (
                <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{errors.submit}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${isReport ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-800 hover:bg-brand-700'}`}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? (uploadStatus || 'Submitting…') : (isReport ? 'File Default Report' : 'Submit Trade')}
              </button>
            </form>
          )}
        </ProfileGuard>
      </div>
    </div>
  );
}
