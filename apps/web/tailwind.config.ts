import type { Config } from 'tailwindcss';

// Design tokens. Colors are CSS-variable-backed (channel triplets) so the SAME
// utility class (e.g. `text-ink-900`, `bg-brand-50`) resolves to different values
// in light vs dark mode — the theme switch happens entirely in globals.css, and
// every existing page adapts with no markup changes.
//
// darkMode: 'class' → the `.dark` class on <html> flips all the variables.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'),
        surface: token('surface'),
        'surface-2': token('surface-2'),
        brand: {
          50: token('brand-50'),
          100: token('brand-100'),
          200: token('brand-200'),
          300: token('brand-300'),
          400: token('brand-400'),
          500: token('brand-500'),
          600: token('brand-600'),
          700: token('brand-700'),
          800: token('brand-800'),
        },
        ink: {
          900: token('ink-900'),
          800: token('ink-800'),
          700: token('ink-700'),
          600: token('ink-600'),
          500: token('ink-500'),
          400: token('ink-400'),
          300: token('ink-300'),
          200: token('ink-200'),
          100: token('ink-100'),
          50: token('ink-50'),
        },
        // Semantic accents + their soft washes (only the 50/200 steps are used).
        success: token('success'),
        warning: token('warning'),
        danger: token('danger'),
        red: { 50: token('red-50'), 200: token('red-200') },
        green: { 50: token('green-50'), 200: token('green-200') },
        amber: { 50: token('amber-50'), 200: token('amber-200') },
      },
      borderRadius: { xl: '0.9rem', '2xl': '1.15rem' },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px -2px rgba(15,23,42,0.06)',
        'card-hover': '0 2px 4px rgba(15,23,42,0.05), 0 14px 28px -8px rgba(15,23,42,0.12)',
        popover: '0 8px 32px -4px rgba(15,23,42,0.20), 0 2px 8px rgba(15,23,42,0.10)',
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
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in .15s ease-out',
        'scale-in': 'scale-in .18s cubic-bezier(.16,1,.3,1)',
        'slide-in': 'slide-in .2s ease-out',
      },
    },
  },
  plugins: [],
};
export default config;
