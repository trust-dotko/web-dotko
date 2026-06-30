import React, { useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { gsap, ScrollTrigger } from '../../hooks/useGSAP';

export default function CTASection() {
  const navigate = useNavigate();
  const sectionRef = useRef(null);
  const cardRef = useRef(null);
  const headingRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      // Card scale-in
      gsap.fromTo(
        cardRef.current,
        { scale: 0.85, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 70%',
            end: 'top 30%',
            scrub: 1,
          },
        }
      );

      // Heading words stagger
      if (headingRef.current) {
        const words = headingRef.current.querySelectorAll('.split-word-inner');
        gsap.fromTo(
          words,
          { y: '100%', opacity: 0 },
          {
            y: '0%',
            opacity: 1,
            duration: 0.6,
            stagger: 0.06,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: headingRef.current,
              start: 'top 75%',
              toggleActions: 'play none none none',
            },
          }
        );
      }

      // Content fade
      gsap.fromTo(
        contentRef.current,
        { y: 20, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: contentRef.current,
            start: 'top 80%',
            toggleActions: 'play none none none',
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // Magnetic button effect
  const handleMagnetic = useCallback((e) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(hover: none)').matches) return; // Disable on touch screens to prevent jumpy behavior on tap
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
  }, []);

  const handleMagneticLeave = useCallback((e) => {
    e.currentTarget.style.transform = 'translate(0, 0)';
  }, []);

  const ctaWords = ['Start', 'verifying', 'today'];

  return (
    <section ref={sectionRef} className="relative py-20 sm:py-28 px-4 bg-[#f8f9fb]">
      {/* Background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${8 + (i * 7.5)}%`,
              top: `${15 + ((i * 23) % 70)}%`,
              '--duration': `${6 + (i % 5) * 2}s`,
              '--delay': `${i * 0.5}s`,
              '--tx1': `${(i % 2 === 0 ? 1 : -1) * (20 + i * 3)}px`,
              '--ty1': `${-30 - i * 5}px`,
              '--tx2': `${(i % 2 === 0 ? -1 : 1) * (15 + i * 2)}px`,
              '--ty2': `${-60 - i * 3}px`,
              '--tx3': `${(i % 2 === 0 ? 1 : -1) * (25 + i * 2)}px`,
              '--ty3': `${-20 - i * 4}px`,
              width: `${3 + (i % 3)}px`,
              height: `${3 + (i % 3)}px`,
              opacity: 0.15 + (i % 4) * 0.05,
            }}
          />
        ))}
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        <div
          ref={cardRef}
          className="animated-border rounded-[3rem] relative opacity-0"
          style={{
            background: 'linear-gradient(135deg, #0047ab 0%, #1f5fd6 40%, #82c8e5 100%)',
          }}
        >
          <div className="rounded-[3rem] py-20 sm:py-24 px-8 text-center relative overflow-hidden">
            {/* Background accents */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-accent-400/15 rounded-full blur-[100px]" />

            <h2
              ref={headingRef}
              className="text-4xl sm:text-6xl lg:text-7xl font-display font-bold text-white mb-6 tracking-tight relative z-10"
            >
              {ctaWords.map((word, i) => (
                <span key={i} className="split-word mr-[0.25em]">
                  <span className="split-word-inner inline-block">{word}</span>
                </span>
              ))}
            </h2>

            <div ref={contentRef} className="opacity-0">
              <p className="text-blue-50/70 text-lg sm:text-xl mb-12 max-w-xl mx-auto leading-relaxed relative z-10">
                Create a free account to run unlimited searches, file trades, and protect your own trust score.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
                <button
                  id="cta-get-started"
                  onClick={() => navigate('/signup')}
                  className="magnetic-btn bg-accent-400 text-brand-950 font-bold px-10 py-5 rounded-2xl text-lg hover:bg-accent-300 active:scale-95 transition-all duration-300 shadow-glow-accent"
                  onMouseMove={handleMagnetic}
                  onMouseLeave={handleMagneticLeave}
                >
                  Get Started Free
                </button>
                <button
                  id="cta-dashboard"
                  onClick={() => navigate('/dashboard')}
                  className="magnetic-btn bg-white/15 backdrop-blur-md border border-white/25 font-bold px-10 py-5 rounded-2xl text-white hover:bg-white/25 active:scale-95 transition-all duration-300 text-lg"
                  onMouseMove={handleMagnetic}
                  onMouseLeave={handleMagneticLeave}
                >
                  Go to Dashboard
                </button>
              </div>

              <div className="mt-12 flex items-center justify-center gap-6 text-xs text-blue-50/50 font-bold uppercase tracking-widest relative z-10">
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-accent-400" /> Free Alpha
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-accent-400" /> No Card Required
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
