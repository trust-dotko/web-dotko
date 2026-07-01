import React, { useRef, useEffect } from 'react';
import { gsap } from '../../hooks/useGSAP';

export default function FooterSection() {
  const footerRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!footerRef.current) return;

    const ctx = gsap.context(() => {
      // Subtle slide-up only — NEVER animate opacity here. The footer must stay
      // visible even if ScrollTrigger mis-fires on mobile or the animation is
      // skipped (reduced-motion). immediateRender:false keeps it at its natural
      // position until the trigger actually runs.
      gsap.from(footerRef.current, {
        y: 24,
        duration: 0.7,
        ease: 'power2.out',
        immediateRender: false,
        scrollTrigger: {
          trigger: footerRef.current,
          start: 'top 95%',
          toggleActions: 'play none none none',
        },
      });
    }, footerRef);

    return () => ctx.revert();
  }, []);

  return (
    <footer
      ref={footerRef}
      className="border-t border-slate-200 pt-14 pb-24 sm:pb-16 bg-white"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-start justify-between gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-slate-900 font-display font-bold text-lg">
            <img src="/icon.png" alt="Dotko" className="w-6 h-6 rounded" />
            <span>
              dotko<span className="text-accent-500">.</span>in
            </span>
          </div>
          <p className="text-sm text-slate-500 max-w-sm">
            India's MSME Trust & Settlement Network. Verify, trade, and get paid with confidence.
          </p>
          <p className="text-xs text-slate-400 mt-2">
            © {new Date().getFullYear()} Dotko.in. All rights reserved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-12 sm:gap-24">
          <div className="flex flex-col gap-3 text-sm">
            <h4 className="font-bold text-slate-900 uppercase tracking-widest text-xs mb-1">Contact</h4>
            <a href="mailto:trust@dotko.in" className="text-slate-500 hover:text-brand-600 transition-colors link-underline">
              Email: trust@dotko.in
            </a>
            <a href="https://dotko.in" className="text-slate-500 hover:text-brand-600 transition-colors link-underline">
              Website: dotko.in
            </a>
          </div>
          <div className="flex flex-col gap-3 text-sm">
            <h4 className="font-bold text-slate-900 uppercase tracking-widest text-xs mb-1">Legal</h4>
            <a href="https://www.dotko.in/privacy-policy.html" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-brand-600 transition-colors link-underline">
              Privacy Policy
            </a>
            <a href="https://www.dotko.in/delete-account.html" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-brand-600 transition-colors link-underline">
              Delete Account
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
