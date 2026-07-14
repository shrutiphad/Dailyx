'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api, clearToken, getToken, ApiError } from '@/lib/api';

const NAV = [
  { href: '/contacts', label: 'Contacts' },
  { href: '/audiences', label: 'Audiences' },
  { href: '/campaigns', label: 'Campaigns' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<{ user: { name: string }; account: { name: string } } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    api
      .get<{ user: { name: string }; account: { name: string } }>('/api/auth/me')
      .then((res) => setMe(res))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          router.replace('/login');
        }
      })
      .finally(() => setReady(true));
  }, [router]);

  async function logout() {
    await api.post('/api/auth/logout').catch(() => undefined);
    clearToken();
    router.replace('/login');
  }

  if (!ready) return <div className="p-10 text-ink-500">Loading…</div>;

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-300/60 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <span className="text-lg font-bold text-brand-700">DailyX</span>
            <nav className="flex gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    pathname.startsWith(n.href)
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-ink-700 hover:bg-ink-100'
                  }`}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-ink-500">{me?.account.name}</span>
            <button onClick={logout} className="text-ink-700 hover:text-danger">Log out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
