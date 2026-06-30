import React, { useEffect, useRef, useCallback } from 'react';

/**
 * CustomCursor — dot + outline that follows the mouse.
 * Scales up on hover over interactive elements.
 * Hidden on touch devices via CSS.
 */
export default function CustomCursor() {
  const dotRef = useRef(null);
  const outlineRef = useRef(null);
  const mousePos = useRef({ x: -100, y: -100 });
  const outlinePos = useRef({ x: -100, y: -100 });
  const rafRef = useRef(null);
  const isHovering = useRef(false);

  const animate = useCallback(() => {
    // Lerp outline toward mouse
    outlinePos.current.x += (mousePos.current.x - outlinePos.current.x) * 0.15;
    outlinePos.current.y += (mousePos.current.y - outlinePos.current.y) * 0.15;

    if (dotRef.current) {
      dotRef.current.style.transform = `translate(${mousePos.current.x}px, ${mousePos.current.y}px) translate(-50%, -50%)`;
    }
    if (outlineRef.current) {
      outlineRef.current.style.transform = `translate(${outlinePos.current.x}px, ${outlinePos.current.y}px) translate(-50%, -50%)`;
    }

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    // Skip on touch devices
    if (window.matchMedia('(hover: none)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const handleMouseMove = (e) => {
      mousePos.current.x = e.clientX;
      mousePos.current.y = e.clientY;
    };

    const handleMouseOver = (e) => {
      const target = e.target;
      const isInteractive =
        target.closest('a, button, [role="button"], input, textarea, select, .tilt-card, .magnetic-btn');
      if (isInteractive && !isHovering.current) {
        isHovering.current = true;
        document.documentElement.classList.add('cursor-hover');
      }
    };

    const handleMouseOut = (e) => {
      const target = e.target;
      const isInteractive =
        target.closest('a, button, [role="button"], input, textarea, select, .tilt-card, .magnetic-btn');
      if (isInteractive && isHovering.current) {
        isHovering.current = false;
        document.documentElement.classList.remove('cursor-hover');
      }
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseover', handleMouseOver, { passive: true });
    document.addEventListener('mouseout', handleMouseOut, { passive: true });
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      cancelAnimationFrame(rafRef.current);
      document.documentElement.classList.remove('cursor-hover');
    };
  }, [animate]);

  return (
    <>
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
      <div ref={outlineRef} className="cursor-outline" aria-hidden="true" />
    </>
  );
}
