import React, { useEffect } from 'react';
import '../styles/landing.css';

import Navbar from '../components/Navbar';
import CustomCursor from '../components/landing/CustomCursor';
import HeroSection from '../components/landing/HeroSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import HowItWorksSection from '../components/landing/HowItWorksSection';
import TestimonialsSection from '../components/landing/TestimonialsSection';
import CTASection from '../components/landing/CTASection';
import FooterSection from '../components/landing/FooterSection';

export default function Landing() {
  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'auto';

    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!isTouchDevice && !prefersReducedMotion) {
      document.documentElement.classList.add('custom-cursor-active');
    }

    return () => {
      document.documentElement.style.scrollBehavior = '';
      document.documentElement.classList.remove('custom-cursor-active');
    };
  }, []);

  return (
    <div className="min-h-screen selection:bg-accent-200 selection:text-brand-900 bg-[#f8f9fb]">
      <CustomCursor />
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <CTASection />
      <FooterSection />
    </div>
  );
}
