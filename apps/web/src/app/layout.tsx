import './globals.css';
import type { Metadata, Viewport } from 'next';

// Indigo rounded-square mail mark, inlined as an SVG data URI (no asset file).
const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%234f46e5'/%3E%3Cg fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='7' y='10' width='18' height='13' rx='2.5'/%3E%3Cpath d='M7.5 11.5 16 17l8.5-5.5'/%3E%3C/g%3E%3C/svg%3E";

export const metadata: Metadata = {
  title: 'DailyX — email campaigns by Olio',
  description: 'Contacts, audiences, campaigns and analytics. A DailyX product by Olio.',
  icons: { icon: FAVICON, apple: FAVICON },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0f17' },
  ],
};

// Runs before paint: applies the saved (or system) theme so there's no flash of
// the wrong theme on load. Mirrors the toggle logic in the app shell.
const themeInit = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var e=document.documentElement;e.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
