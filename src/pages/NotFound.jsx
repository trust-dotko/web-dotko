import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="text-center">
        <img src="/icon.png" alt="Dotko" className="w-16 h-16 rounded-2xl mx-auto mb-6" />
        <h1 className="text-6xl font-bold text-slate-900 mb-2">404</h1>
        <p className="text-slate-500 mb-8">This page doesn't exist.</p>
        <Link
          to="/"
          className="bg-brand-800 text-white font-semibold px-6 py-3 rounded-xl hover:bg-brand-700 transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
