import type { Config } from 'tailwindcss';

// Design tokens live here so components never hardcode hex values.
// See ARCHITECTURE.md → "Design system".
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        ink: {
          900: '#0f172a',
          700: '#334155',
          500: '#64748b',
          300: '#cbd5e1',
          100: '#f1f5f9',
        },
        success: '#16a34a',
        warning: '#d97706',
        danger: '#dc2626',
      },
      borderRadius: { xl: '0.9rem' },
      boxShadow: { card: '0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)' },
    },
  },
  plugins: [],
};
export default config;
