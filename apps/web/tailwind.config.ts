import type { Config } from 'tailwindcss';

// Design tokens live here so components never hardcode hex values.
// See ARCHITECTURE.md → "Design system".
//
// NOTE: every token key that existed before is kept (pages reference them
// directly as utilities, e.g. `text-ink-500`, `border-ink-300`). New steps were
// added to the scales rather than renaming, so nothing can silently lose a style.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Indigo — the product's accent. Reserved for interactive/brand surfaces.
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
        },
        // Neutrals carry a slight cool cast so they sit with the indigo accent.
        ink: {
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          600: '#475569',
          500: '#64748b',
          400: '#94a3b8',
          300: '#cbd5e1',
          200: '#e2e8f0',
          100: '#f1f5f9',
          50: '#f8fafc',
        },
        // App background — softer than a flat slate, keeps white cards crisp.
        canvas: '#f6f7fb',
        success: '#16a34a',
        warning: '#d97706',
        danger: '#dc2626',
      },
      borderRadius: { xl: '0.9rem', '2xl': '1.15rem' },
      boxShadow: {
        // Layered rather than a single flat drop — reads as lift, not a border.
        card: '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px -2px rgba(15,23,42,0.06)',
        'card-hover': '0 2px 4px rgba(15,23,42,0.05), 0 12px 24px -6px rgba(15,23,42,0.10)',
        popover: '0 8px 32px -4px rgba(15,23,42,0.18), 0 2px 8px rgba(15,23,42,0.08)',
        btn: '0 1px 2px rgba(15,23,42,0.08)',
      },
      fontFamily: {
        sans: [
          'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto',
          'Helvetica Neue', 'Arial', 'sans-serif',
        ],
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': {
          from: { opacity: '0', transform: 'translateY(6px) scale(.985)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in .15s ease-out',
        'scale-in': 'scale-in .18s cubic-bezier(.16,1,.3,1)',
      },
    },
  },
  plugins: [],
};
export default config;
