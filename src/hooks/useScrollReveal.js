import { useEffect, useRef } from 'react';

/**
 * useScrollReveal — attaches an IntersectionObserver that adds `is-visible`
 * to the element the first time it scrolls into view, driving the `.reveal`
 * CSS transition (transform/opacity only → 60fps). Honors reduced-motion via
 * the CSS rule in index.css. Optional `delay` (ms) staggers the reveal.
 */
export function useScrollReveal({ threshold = 0.12, delay = 0 } = {}) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { el.classList.add('is-visible'); return; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (delay) el.style.transitionDelay = `${delay}ms`;
        el.classList.add('is-visible');
        io.unobserve(el);
      }
    }, { threshold, rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, delay]);
  return ref;
}
