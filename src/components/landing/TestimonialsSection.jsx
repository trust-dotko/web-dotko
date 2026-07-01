import React, { useRef, useEffect } from 'react';
import { gsap, ScrollTrigger } from '../../hooks/useGSAP';

const TESTIMONIALS = [
  {
    name: 'Priya Nair',
    role: 'CFO, Horizons Pvt Ltd',
    text: 'Dotko cut our bad-debt write-offs by 40% in the first quarter. The trust scoring is exactly what our credit team needed.',
    initial: 'P',
  },
  {
    name: 'Rahul Sharma',
    role: 'Head of Procurement, InnoTech',
    text: 'The 7-day resolution window got us paid on two stuck invoices in a week. It changed how our vendors treat deadlines.',
    initial: 'R',
  },
  {
    name: 'Anitha Menon',
    role: 'Director, TradeFlow Exports',
    text: 'Before Dotko, we relied on word-of-mouth. Now every new vendor gets a trust check. It\'s become part of our SOP.',
    initial: 'A',
  },
  {
    name: 'Vikram Joshi',
    role: 'Founder, NexaParts India',
    text: 'We reported a default and it was resolved within 3 days. The transparency alone makes Dotko worth it for any MSME.',
    initial: 'V',
  },
];

export default function TestimonialsSection() {
  const sectionRef = useRef(null);
  const headingRef = useRef(null);
  const trackRef = useRef(null);

  useEffect(() => {
    if (!sectionRef.current || !trackRef.current) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 640;

    const ctx = gsap.context(() => {
      // Heading animation — slide only (never opacity-hide) so it can't vanish
      // if the ScrollTrigger mis-fires on mobile.
      if (!prefersReducedMotion) {
        gsap.from(headingRef.current, {
          y: 30,
          duration: 0.8,
          ease: 'power3.out',
          immediateRender: false,
          scrollTrigger: { trigger: headingRef.current, start: 'top 85%' },
        });
      }

      // Horizontal scroll (only for desktop / tablet where space permits)
      if (!prefersReducedMotion && !isMobile) {
        const track = trackRef.current;
        const cards = track.querySelectorAll('.testimonial-card');
        const totalWidth = Array.from(cards).reduce((sum, card) => {
          return sum + card.offsetWidth + 32;
        }, 0);
        const scrollDistance = totalWidth - window.innerWidth + 100;

        if (scrollDistance > 0) {
          gsap.to(track, {
            x: -scrollDistance,
            ease: 'none',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 15%',
              end: () => `+=${scrollDistance}`,
              pin: true,
              scrub: 1,
              anticipatePin: 1,
            },
          });
        }
      }

      // Staggered card slide-in — never opacity-hide (cards must stay visible
      // even if the trigger mis-fires on mobile).
      if (!prefersReducedMotion) {
        const track = trackRef.current;
        const cards = track.querySelectorAll('.testimonial-card');
        cards.forEach((card, i) => {
          gsap.from(card, {
            y: 30,
            duration: 0.6,
            ease: 'power2.out',
            immediateRender: false,
            delay: i * 0.15,
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 60%',
              toggleActions: 'play none none none',
            },
          });
        });
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative py-20 sm:py-28 overflow-hidden bg-[#f8f9fb]">
      <div className="relative z-10">
        {/* Heading */}
        <div ref={headingRef} className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 sm:mb-14">
          <span className="text-xs font-bold text-brand-600 uppercase tracking-[0.3em] mb-4 block">Social proof</span>
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-display font-bold text-slate-900 tracking-tight">
            Trusted by finance teams
          </h2>
        </div>

        {/* Mobile: vertical stack. Desktop (sm+): horizontal track driven by ScrollTrigger. */}
        <div className="px-4 sm:pl-8 sm:pr-0 lg:pl-16 sm:overflow-x-visible scrollbar-none">
          <div ref={trackRef} className="h-scroll-track pb-0">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="testimonial-card light-card rounded-2xl sm:rounded-3xl p-6 sm:p-10 group hover:border-brand-200 snap-center flex flex-col"
              >
                {/* Stars */}
                <div className="flex gap-1 mb-6">
                  {[1, 2, 3, 4, 5].map(n => (
                    <span key={n} className="text-accent-400 text-lg">★</span>
                  ))}
                </div>

                {/* Quote */}
                <p className="text-slate-700 text-lg leading-relaxed mb-8 italic">
                  &ldquo;{t.text}&rdquo;
                </p>

                {/* Author */}
                <div className="flex items-center gap-4 mt-auto">
                  <div className="w-10 h-10 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center font-bold text-brand-700 text-sm">
                    {t.initial}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{t.name}</p>
                    <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex-shrink-0 w-16" />
          </div>
        </div>
      </div>
    </section>
  );
}
