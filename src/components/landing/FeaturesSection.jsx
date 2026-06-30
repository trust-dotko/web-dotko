import React, { useRef, useEffect, useCallback } from 'react';
import { FileSearch, TrendingUp, Scale } from 'lucide-react';
import { gsap, ScrollTrigger } from '../../hooks/useGSAP';

const FEATURES = [
  {
    icon: FileSearch,
    title: 'Instant GST Lookup',
    desc: 'Search any GST-registered business and get a full trust snapshot — score, risk tier, and trade history — in seconds.',
  },
  {
    icon: TrendingUp,
    title: 'Evidence-Based Score',
    desc: 'A transparent 0–100 score built from registration, GST compliance, and verified trade outcomes — not opinions.',
  },
  {
    icon: Scale,
    title: 'Appeal & Resolution',
    desc: 'Reported a default? The counterparty gets 7 days to settle or appeal with proof. Fair, on the record, and built to get you paid.',
  },
];

export default function FeaturesSection() {
  const sectionRef = useRef(null);
  const headingOutlineRef = useRef(null);
  const headingFillRef = useRef(null);
  const cardsRef = useRef([]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      // Color fill on scroll for heading
      if (headingFillRef.current) {
        gsap.fromTo(
          headingFillRef.current,
          { clipPath: 'inset(0 100% 0 0)' },
          {
            clipPath: 'inset(0 0% 0 0)',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 70%',
              end: 'top 20%',
              scrub: 1,
            },
          }
        );
      }

      // Staggered card reveal
      cardsRef.current.forEach((card, i) => {
        if (!card) return;
        gsap.fromTo(
          card,
          { y: 80, opacity: 0, rotateX: -8 },
          {
            y: 0,
            opacity: 1,
            rotateX: 0,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 85%',
              end: 'top 50%',
              toggleActions: 'play none none none',
            },
            delay: i * 0.15,
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // Card tilt handler
  const handleMouseMove = useCallback((e, card) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -6;
    const rotateY = ((x - centerX) / centerX) * 6;

    const inner = card.querySelector('.tilt-card-inner');
    if (inner) {
      inner.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    }
    card.style.setProperty('--mouse-x', `${(x / rect.width) * 100}%`);
    card.style.setProperty('--mouse-y', `${(y / rect.height) * 100}%`);
  }, []);

  const handleMouseLeave = useCallback((card) => {
    const inner = card.querySelector('.tilt-card-inner');
    if (inner) {
      inner.style.transform = 'rotateX(0deg) rotateY(0deg)';
    }
  }, []);

  return (
    <section ref={sectionRef} className="relative py-28 sm:py-40 overflow-hidden bg-[#f8f9fb]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section label */}
        <div className="text-center mb-6">
          <span className="text-xs font-bold text-brand-600 uppercase tracking-[0.3em]">The trust engine</span>
        </div>

        {/* Color-fill heading */}
        <div className="text-center mb-20 sm:mb-28">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight relative inline-block">
            <span ref={headingOutlineRef} className="text-slate-300">
              Everything you need to trade with confidence
            </span>
            <span
              ref={headingFillRef}
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(110deg, #000080 0%, #0047ab 35%, #4d80f0 70%, #facc15 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                clipPath: 'inset(0 100% 0 0)',
              }}
              aria-hidden="true"
            >
              Everything you need to trade with confidence
            </span>
          </h2>
        </div>

        {/* Feature cards */}
        <div className="grid sm:grid-cols-3 gap-6 lg:gap-8" style={{ perspective: '1000px' }}>
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <div
              key={title}
              ref={el => (cardsRef.current[i] = el)}
              className="tilt-card opacity-0"
              onMouseMove={(e) => handleMouseMove(e, e.currentTarget)}
              onMouseLeave={(e) => handleMouseLeave(e.currentTarget)}
            >
              <div className="tilt-card-inner light-card rounded-3xl p-8 sm:p-10 h-full relative group">
                {/* Glow overlay */}
                <div className="card-glow rounded-3xl" />

                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center mb-7 group-hover:bg-brand-600 group-hover:border-brand-600 transition-all duration-500">
                    <Icon className="w-6 h-6 text-brand-600 group-hover:text-white transition-colors duration-500" />
                  </div>
                  <h3 className="text-xl font-display font-bold text-slate-900 mb-3">{title}</h3>
                  <p className="text-slate-500 leading-relaxed text-[15px]">{desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
