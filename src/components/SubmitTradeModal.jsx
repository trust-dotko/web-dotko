import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ProfileGuard from './ProfileGuard';

export default function SubmitTradeModal({ gst, businessName, onClose, onSubmit }) {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]     = useState({ buyer: '', amount: '', creditDays: '', actualDays: '', status: 'Paid' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.buyer.trim())                e.buyer      = 'Required';
    if (!form.amount || Number(form.amount) <= 0)      e.amount     = 'Must be > 0';
    if (!form.creditDays || Number(form.creditDays) <= 0) e.creditDays = 'Must be > 0';
    if (!form.actualDays || Number(form.actualDays) <= 0) e.actualDays = 'Must be > 0';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) { navigate('/login'); return; }
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const trade = {
        buyer:      form.buyer.trim(),
        amount:     Number(form.amount),
        creditDays: Number(form.creditDays),
        actualDays: Number(form.actualDays),
        status:     form.status,
        submittedBy: user.uid,
      };
      await onSubmit(trade);
      setSuccess(true);
      setTimeout(onClose, 1200);
    } catch {
      setErrors({ submit: 'Submission failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ id, label, type = 'text', ...rest }) => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <input
        type={type}
        value={form[id]}
        onChange={e => { setForm(f => ({ ...f, [id]: e.target.value })); setErrors(er => ({ ...er, [id]: undefined })); }}
        className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${errors[id] ? 'border-red-300' : 'border-slate-200'}`}
        {...rest}
      />
      {errors[id] && <p className="text-red-600 text-xs mt-1">{errors[id]}</p>}
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold text-slate-900">Submit Trade</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">{gst} · {businessName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Profile Guard — blocks submission if profile is incomplete */}
        <ProfileGuard fallbackMessage="Complete your profile to submit trade reports.">
          {success ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="font-semibold text-slate-900">Trade submitted!</p>
              <p className="text-sm text-slate-500 mt-1">Trust score has been updated.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field id="buyer" label="Buyer / Party Name" />
              <Field id="amount" label="Trade Amount (₹)" type="number" min="1" />
              <div className="grid grid-cols-2 gap-3">
                <Field id="creditDays" label="Credit Days" type="number" min="1" />
                <Field id="actualDays" label="Actual Days Taken" type="number" min="1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  <option>Paid</option>
                  <option>Delayed</option>
                  <option>Unpaid</option>
                </select>
              </div>
              {errors.submit && <p className="text-red-600 text-sm">{errors.submit}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-800 text-white font-semibold py-2.5 rounded-lg hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Submitting…' : 'Submit Trade'}
              </button>
            </form>
          )}
        </ProfileGuard>
      </div>
    </div>
  );
}
