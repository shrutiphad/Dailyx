import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DailyX — email campaigns',
  description: 'Contacts, audiences, campaigns and analytics.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
