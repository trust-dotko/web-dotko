/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Brand: "Cobalt sky" ──────────────────────────────────────────────
        // 600 = cobalt #0047AB, 900 = navy #000080. Recoloring this scale
        // recolors every existing `brand-*` usage across the app.
        brand: {
          50:  '#eef4ff',
          100: '#d9e6ff',
          200: '#b3ccff',
          300: '#80a8ff',
          400: '#4d80f0',
          500: '#1f5fd6',
          600: '#0047ab', // cobalt
          700: '#003a8c',
          800: '#002a6b',
          900: '#000080', // navy
          950: '#000a40',
        },
        // ── Accent: yellow (primary CTA / emphasis, used sparingly) ───────────
        accent: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#facc15',
          500: '#f5b400',
          600: '#d99700',
          700: '#b37400',
          800: '#8f5a00',
          900: '#714600',
        },
        sky:       '#82c8e5',
        slateblue: '#6d8196',
        // Critical risk tier (unresolved default) — deep red / near-black.
        critical:  '#7f1d1d',
      },
      fontFamily: {
        sans:    ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Syne', 'Inter', 'ui-sans-serif', 'sans-serif'],
        mono:    ['DM Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'card':       '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.10), 0 2px 4px -1px rgba(0,0,0,0.06)',
        'glow-accent':'0 8px 30px -6px rgba(250,204,21,0.45)',
        'glow-brand': '0 10px 40px -10px rgba(0,71,171,0.5)',
      },
      backgroundImage: {
        'cobalt-night': 'linear-gradient(135deg, #000a40 0%, #000080 45%, #0047ab 100%)',
        'cobalt-sky':   'linear-gradient(120deg, #0047ab 0%, #1f5fd6 40%, #82c8e5 100%)',
        'gradient-text':'linear-gradient(110deg, #0047ab 0%, #4d80f0 35%, #82c8e5 60%, #facc15 100%)',
      },
      keyframes: {
        'fade-up':      { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'fade-in':      { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'gradient-pan': { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        'float':        { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-12px)' } },
      },
      animation: {
        'fade-up':      'fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in':      'fade-in 0.6s ease-out both',
        'gradient-pan': 'gradient-pan 8s ease-in-out infinite',
        'float':        'float 7s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
