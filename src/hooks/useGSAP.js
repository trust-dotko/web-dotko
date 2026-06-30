import { useEffect, useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register GSAP plugins once
gsap.registerPlugin(ScrollTrigger);

/**
 * Check if user prefers reduced motion.
 */
function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * useGSAPContext — creates a GSAP context scoped to a container ref.
 * All GSAP animations created inside the callback are automatically
 * reverted on unmount. Pass dependencies array to re-run.
 *
 * @param {Function} callback - receives (ctx, container) → create GSAP animations
 * @param {Array} deps - dependency array (like useEffect)
 * @returns {React.RefObject} - ref to attach to your container element
 */
export function useGSAPContext(callback, deps = []) {
  const containerRef = useRef(null);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      callback(ctx, containerRef.current);
    }, containerRef);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return containerRef;
}

/**
 * Re-export gsap and ScrollTrigger for convenience.
 */
export { gsap, ScrollTrigger };
