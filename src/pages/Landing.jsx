import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, TrendingUp, FileSearch, Lock, ChevronRight, CheckCircle, Zap, Users } from 'lucide-react';
import Navbar from '../components/Navbar';
import GSTSearchBar from '../components/GSTSearchBar';

const FEATURES = [
  { icon: FileSearch, title: 'Instant GST Lookup',  desc: 'Query any registered business by GSTIN and get a full trust snapshot in seconds.' },
  { icon: TrendingUp, title: 'AI Trust Scoring',    desc: 'Proprietary 0–100 score built from identity, compliance, and business consistency.' },
  { icon: Lock,       title: 'Risk Classification', desc: 'High Trust / Caution / High Risk labels so you can make credit decisions with confidence.' },
];

const STATS = [
  { value: '2.4M+', label: 'Businesses indexed' },
  { value: '98.6%', label: 'GST match accuracy' },
  { value: '<1s',   label: 'Average lookup time' },
];

const TESTIMONIALS = [
  { name: 'Priya Nair',   role: 'CFO, Horizons Pvt Ltd',        text: 'Dotko cut our bad-debt write-offs by 40% in the first quarter. The trust scoring is exactly what our credit team needed.' },
  { name: 'Rahul Sharma', role: 'Head of Procurement, InnoTech', text: 'We onboard 20+ vendors a month. Dotko makes due diligence a 30-second job instead of a 3-day one.' },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Hero */}
      <section className="hero-gradient text-white relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm mb-8 backdrop-blur-sm">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Live · India's MSME Trust Intelligence Platform
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold leading-tight tracking-tight mb-5">
            Know who you're<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-emerald-300">
              doing business with.
            </span>
          </h1>

          <p className="text-lg text-blue-100 max-w-2xl mx-auto mb-10 leading-relaxed">
            Dotko gives you instant trust intelligence on any GST-registered business in India —
            before you extend credit, sign a contract, or onboard a vendor.
          </p>

          {/* Search */}
          <div className="max-w-xl mx-auto bg-white rounded-2xl p-4 shadow-2xl">
            <GSTSearchBar large placeholder="Enter GSTIN to check trust score…" />
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap justify-center gap-8 mt-14">
            {STATS.map(s => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-bold text-white">{s.value}</div>
                <div className="text-sm text-blue-200 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
          Everything you need to trust faster
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300">
              <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-brand-800" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white border-y border-slate-200 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-8 text-center">
            {[
              { step: '01', icon: FileSearch, title: 'Enter GSTIN',          desc: 'Paste any valid 15-character GST number into the search bar.' },
              { step: '02', icon: Zap,        title: 'Instant Verification', desc: 'We verify against the official GST registry and compute a trust score.' },
              { step: '03', icon: Shield,     title: 'Get Trust Report',     desc: 'Receive a scored report with risk level and full business breakdown.' },
            ].map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-brand-800 text-white flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6" />
                </div>
                <div className="text-xs text-brand-600 font-bold mb-1">STEP {step}</div>
                <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">Trusted by finance teams</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {TESTIMONIALS.map(t => (
            <div key={t.name} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card hover:shadow-card-hover transition-shadow">
              <div className="flex gap-1 mb-4">
                {[1,2,3,4,5].map(i => <span key={i} className="text-amber-400 text-sm">★</span>)}
              </div>
              <p className="text-slate-700 text-sm leading-relaxed mb-4">"{t.text}"</p>
              <div>
                <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
                <p className="text-xs text-slate-500">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-brand-800 py-16 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        </div>
        <div className="max-w-3xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-3xl font-bold text-white mb-4">Start verifying businesses today</h2>
          <p className="text-blue-200 mb-8">Create an account to unlock unlimited searches and full reports.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              id="cta-get-started"
              onClick={() => navigate('/signup')}
              className="bg-white text-brand-800 font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
            >
              Get Started Free <ChevronRight className="w-4 h-4" />
            </button>
            <button
              id="cta-dashboard"
              onClick={() => navigate('/dashboard')}
              className="border border-white/30 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            >
              Open Dashboard
            </button>
          </div>
          <p className="text-xs text-blue-300 mt-6 flex items-center justify-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" /> Free during beta · No credit card needed
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-600 text-sm">
            <img src="/icon.png" alt="Dotko" className="w-5 h-5 rounded" />
            <span>dotko.in — MSME Trust Intelligence Platform</span>
          </div>
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} Dotko.in. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
