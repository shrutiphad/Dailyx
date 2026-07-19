import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DailyX — email campaigns by Olio',
  description: 'Contacts, audiences, campaigns and analytics. A DailyX product by Olio.',
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
