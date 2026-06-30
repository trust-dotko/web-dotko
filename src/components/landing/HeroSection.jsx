import React, { useRef, useEffect } from 'react';
import { gsap, ScrollTrigger } from '../../hooks/useGSAP';
import GSTSearchBar from '../GSTSearchBar';

const STATS = [
  { value: '2.4M+', label: 'Businesses indexed' },
  { value: '98.6%', label: 'GST match accuracy' },
  { value: '7 days', label: 'To settle a default' },
];

export default function HeroSection() {
  const sectionRef = useRef(null);
  const headlineRef = useRef(null);
  const subRef = useRef(null);
  const searchRef = useRef(null);
  const statsRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      // Headline words
      if (headlineRef.current) {
        const words = headlineRef.current.querySelectorAll('.split-word-inner');
        tl.fromTo(words, { y: '110%', rotateX: -20 }, { y: '0%', rotateX: 0, duration: 0.8, stagger: 0.08 }, 0.2);
      }

      // Subtext
      tl.fromTo(subRef.current, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, 0.6);

      // Search card
      tl.fromTo(searchRef.current, { y: 40, opacity: 0, scale: 0.95 }, { y: 0, opacity: 1, scale: 1, duration: 0.7 }, 0.8);

      // Stats
      if (statsRef.current) {
        const statEls = statsRef.current.querySelectorAll('.stat-item');
        tl.fromTo(statEls, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.12 }, 1.0);
      }

      // Parallax on orbs
      const orbs = sectionRef.current.querySelectorAll('.hero-orb');
      orbs.forEach((orb, i) => {
        gsap.to(orb, {
          y: (i % 2 === 0) ? -60 : -40,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: 1.5,
          },
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const headlineWords1 = ['Know', 'who', 'you'];
  const headlineWords2 = ['trade', 'with.'];

  return (
    <section ref={sectionRef} className="hero-gradient-light relative overflow-hidden min-h-[90dvh] flex items-center justify-center">
      {/* Vertical stripe texture (Kaiko-style) */}
      <div className="hero-stripes" />

      {/* Floating orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="hero-orb absolute -top-32 -right-32 w-[500px] h-[500px] bg-white/10 rounded-full blur-[100px]" />
        <div className="hero-orb absolute top-1/2 -left-48 w-[400px] h-[400px] bg-sky/15 rounded-full blur-[100px]" />
        <div className="hero-orb absolute -bottom-40 right-1/4 w-[300px] h-[300px] bg-accent-400/8 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 text-center relative z-10">
        {/* Headline */}
        <h1 ref={headlineRef} className="text-4xl sm:text-6xl lg:text-7xl font-display font-bold text-white leading-[1.05] tracking-tight mb-3" style={{ perspective: '800px' }}>
          {headlineWords1.map((word, i) => (
            <span key={i} className="split-word mr-[0.25em]">
              <span className="split-word-inner">{word}</span>
            </span>
          ))}
          <br />
          {headlineWords2.map((word, i) => (
            <span key={`b-${i}`} className="split-word mr-[0.25em]">
              <span
                className="split-word-inner"
                style={i === 1 ? {
                  background: 'linear-gradient(110deg, #facc15 0%, #fde68a 50%, #ffffff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                } : undefined}
              >
                {word}
              </span>
            </span>
          ))}
        </h1>

        {/* Subtext */}
        <p ref={subRef} className="text-base sm:text-lg text-white/70 max-w-2xl mx-auto mb-5 leading-relaxed opacity-0">
          Verify any GST-registered business, see their real payment track record, and
          recover dues with a fair 7-day resolution window — before you extend credit.
        </p>

        {/* Search card — white glassmorphism */}
        <div ref={searchRef} className="max-w-xl mx-auto glass-card-white rounded-2xl p-3 shadow-2xl relative z-20 opacity-0">
          <GSTSearchBar large placeholder="Enter GSTIN to check trust score…" />
        </div>

        {/* Stats */}
        <div ref={statsRef} className="flex flex-wrap justify-center gap-10 sm:gap-16 mt-6 sm:mt-8">
          {STATS.map(s => (
            <div key={s.label} className="stat-item text-center group cursor-default">
              <div className="stat-value text-2xl sm:text-3xl font-display font-bold text-white group-hover:text-accent-300 transition-colors duration-500">
                {s.value}
              </div>
              <div className="text-xs text-white/50 mt-1 font-medium tracking-wide uppercase">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom fade into off-white body */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent to-[#f8f9fb] pointer-events-none z-10" />
    </section>
  );
}
