import React, { useRef, useEffect } from 'react';
import { FileSearch, BellRing, Gavel } from 'lucide-react';
import { gsap, ScrollTrigger } from '../../hooks/useGSAP';

const STEPS = [
  {
    step: '01',
    icon: FileSearch,
    title: 'Look up a GSTIN',
    desc: 'Paste any 15-character GST number. We pull official registry data and compute a live trust score.',
  },
  {
    step: '02',
    icon: BellRing,
    title: 'Submit or Report',
    desc: 'Record a trade you did, or report a payment default. The other party is notified instantly over WhatsApp.',
  },
  {
    step: '03',
    icon: Gavel,
    title: '7-Day Resolution',
    desc: 'They settle or appeal with proof within 7 days. Unresolved defaults lock in and flag the business Critical.',
  },
];

export default function HowItWorksSection() {
  const sectionRef = useRef(null);
  const headingRef = useRef(null);
  const cardsContainerRef = useRef(null);
  const progressFillRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!sectionRef.current || !cardsContainerRef.current) return;

    const ctx = gsap.context(() => {
      // Heading reveal
      gsap.fromTo(
        headingRef.current,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: headingRef.current,
            start: 'top 80%',
          },
        }
      );

      const cards = cardsContainerRef.current.querySelectorAll('.stack-card');
      const totalCards = cards.length;

      // Pinned stacking effect
      cards.forEach((card, i) => {
        if (i === totalCards - 1) return;

        ScrollTrigger.create({
          trigger: card,
          start: () => `top ${80 + i * 24}px`,
          end: () => `+=${window.innerHeight * 0.6}`,
          pin: true,
          pinSpacing: false,
          onUpdate: (self) => {
            const scale = 1 - (self.progress * 0.05);
            const brightness = 1 - (self.progress * 0.2);
            gsap.set(card, {
              scale,
              filter: `brightness(${brightness})`,
            });
          },
        });
      });

      // Progress line fill
      if (progressFillRef.current) {
        gsap.fromTo(
          progressFillRef.current,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: cardsContainerRef.current,
              start: 'top 40%',
              end: 'bottom 60%',
              scrub: 1,
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative py-28 sm:py-40 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #0047ab 0%, #1f5fd6 30%, #000080 60%, #0047ab 100%)',
      }}
    >
      {/* Stripe texture */}
      <div className="hero-stripes" />

      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-sky/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-white/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Heading */}
        <div ref={headingRef} className="text-center mb-20 opacity-0">
          <span className="text-xs font-bold text-accent-400 uppercase tracking-[0.3em] mb-4 block">How it works</span>
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-display font-bold text-white tracking-tight">
            From lookup to settlement
          </h2>
          <p className="text-blue-200/60 mt-4 text-lg">Three steps. Zero ambiguity.</p>
        </div>

        {/* Stacking cards */}
        <div ref={cardsContainerRef} className="relative space-y-6">
          {/* Progress line */}
          <div className="progress-line hidden sm:block">
            <div ref={progressFillRef} className="progress-line-fill" />
          </div>

          {STEPS.map(({ step, icon: Icon, title, desc }, i) => (
            <div
              key={step}
              className="stack-card glass-card rounded-3xl p-8 sm:p-10 sm:pl-20 relative"
            >
              {/* Step indicator */}
              <div className="hidden sm:flex absolute left-6 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-accent-400/15 border border-accent-400/30 items-center justify-center">
                <span className="text-[10px] font-black text-accent-400 tracking-wider">{step}</span>
              </div>

              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-2xl bg-accent-400/10 border border-accent-400/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-7 h-7 text-accent-400" />
                </div>
                <div>
                  <div className="text-xs text-accent-400 font-black mb-1 tracking-[0.3em] sm:hidden">STEP {step}</div>
                  <h3 className="text-2xl font-display font-bold text-white mb-2">{title}</h3>
                  <p className="text-blue-100/60 leading-relaxed">{desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
