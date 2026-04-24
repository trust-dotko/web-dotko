import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, TrendingUp, FileSearch, Lock, ChevronRight, CheckCircle, Zap } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-50 selection:bg-brand-100 selection:text-brand-900">
      <Navbar />

      {/* Hero */}
      <section className="hero-gradient text-white relative overflow-hidden transition-all duration-300">
        {/* Animated Background Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-1/2 -left-48 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute -bottom-32 right-1/4 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 text-center relative z-10 animate-in fade-in slide-in-from-bottom-5 duration-700 ease-out">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm mb-8 backdrop-blur-md shadow-inner">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
            <span className="font-medium">Live · India's MSME Trust Intelligence Platform</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-bold leading-[1.1] tracking-tight mb-8">
            Verify Trust in<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-blue-100 to-emerald-200">
              India's Digital B2B.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-blue-100/80 max-w-2xl mx-auto mb-12 leading-relaxed font-light">
            Dotko gives you instant trust intelligence on any GST-registered business —
            before you extend credit, sign a contract, or onboard a vendor.
          </p>

          {/* Search */}
          <div className="max-w-xl mx-auto bg-white rounded-2xl p-4 shadow-2xl relative z-20">
            <GSTSearchBar large placeholder="Enter GSTIN to check trust score…" />
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap justify-center gap-12 sm:gap-20 mt-20 sm:mt-24">
            {STATS.map(s => (
              <div key={s.label} className="text-center group cursor-default">
                <div className="text-3xl sm:text-4xl font-bold text-white group-hover:scale-110 transition-transform duration-300">
                  {s.value}
                </div>
                <div className="text-xs sm:text-sm text-blue-200/70 mt-2 font-medium tracking-wide uppercase">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="text-center mb-16 sm:mb-20 animate-in fade-in duration-500">
          <h2 className="text-sm font-bold text-brand-600 uppercase tracking-[0.2em] mb-4">Core Engine</h2>
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">
            Everything you need to trust faster
          </h2>
        </div>
        
        <div className="grid sm:grid-cols-3 gap-8">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="group bg-white rounded-3xl border border-slate-200 p-8 shadow-card hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 ease-out">
              <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-brand-600 transition-colors duration-300">
                <Icon className="w-6 h-6 text-brand-800 group-hover:text-white transition-colors duration-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-4">{title}</h3>
              <p className="text-slate-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works - Visual Flow */}
      <section className="bg-slate-900 text-white py-24 sm:py-32 relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <h2 className="text-3xl sm:text-5xl font-bold text-center mb-20 tracking-tight">How simple it is</h2>
          <div className="grid sm:grid-cols-3 gap-16 text-center relative">
            <div className="hidden sm:block absolute top-10 left-1/4 right-1/4 h-px border-t border-dashed border-white/20" />
            
            {[
              { step: '01', icon: FileSearch, title: 'Enter GSTIN',          desc: 'Paste any valid 15-character GST number into the search bar.' },
              { step: '02', icon: Zap,        title: 'Instant Verification', desc: 'We verify against the official GST registry and compute a trust score.' },
              { step: '03', icon: Shield,     title: 'Get Trust Report',     desc: 'Receive a scored report with risk level and full business breakdown.' },
            ].map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="flex flex-col items-center group">
                <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 text-white flex items-center justify-center mb-8 transform group-hover:rotate-6 transition-transform duration-300">
                  <Icon className="w-8 h-8 text-brand-400" />
                </div>
                <div className="text-xs text-brand-400 font-black mb-2 tracking-[0.3em]">STEP {step}</div>
                <h3 className="text-2xl font-bold mb-4">{title}</h3>
                <p className="text-slate-400 leading-relaxed font-light">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <h2 className="text-3xl sm:text-5xl font-bold text-slate-900 text-center mb-20 tracking-tight">Trusted by finance teams</h2>
        <div className="grid sm:grid-cols-2 gap-8">
          {TESTIMONIALS.map(t => (
            <div key={t.name} className="bg-white rounded-3xl border border-slate-100 p-10 shadow-card hover:shadow-xl transition-all duration-300">
              <div className="flex gap-1.5 mb-8">
                {[1,2,3,4,5].map(i => <span key={i} className="text-amber-400">★</span>)}
              </div>
              <p className="text-slate-700 italic text-lg leading-relaxed mb-8">"{t.text}"</p>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center font-bold text-brand-800">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-900 uppercase tracking-wide text-xs">{t.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.15em] mt-1">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner - Final Push */}
      <section className="max-w-6xl mx-auto px-4 mb-24">
        <div className="bg-brand-800 rounded-[3rem] py-20 px-8 text-center relative overflow-hidden shadow-2xl">
          {/* Internal gradients */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-400/5 rounded-full blur-3xl" />

          <h2 className="text-4xl sm:text-6xl font-bold text-white mb-6 tracking-tight">Start verifying today</h2>
          <p className="text-blue-100 text-lg sm:text-xl mb-12 max-w-xl mx-auto font-light leading-relaxed">
            Create an account to unlock unlimited searches and enterprise trust reports.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
            <button
              id="cta-get-started"
              onClick={() => navigate('/signup')}
              className="bg-white text-brand-800 font-bold px-10 py-5 rounded-2xl hover:bg-blue-50 hover:scale-105 active:scale-95 transition-all duration-300 text-lg shadow-xl shadow-black/20"
            >
              Get Started Free
            </button>
            <button
              id="cta-dashboard"
              onClick={() => navigate('/dashboard')}
              className="bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold px-10 py-5 rounded-2xl hover:bg-white/20 hover:scale-105 active:scale-95 transition-all duration-300 text-lg"
            >
              Go to Dashboard
            </button>
          </div>
          
          <div className="mt-12 flex items-center justify-center gap-6 text-xs text-blue-200/60 font-bold uppercase tracking-widest">
            <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /> Free Alpha</span>
            <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /> No Card Required</span>
          </div>
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
