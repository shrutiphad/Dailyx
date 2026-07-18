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

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-sm text-ink-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-200 border-t-brand-600" />
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-8">
            <Link href="/contacts" className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white shadow-btn">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
              </span>
              <span className="text-lg font-bold tracking-tight text-ink-900">DailyX</span>
            </Link>
            <nav className="flex gap-1">
              {NAV.map((n) => {
                const active = pathname.startsWith(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100'
                        : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
                    }`}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden items-center gap-2 rounded-full border border-ink-200 bg-ink-50 py-1 pl-1 pr-3 sm:inline-flex">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                {(me?.account.name ?? '?').trim().charAt(0).toUpperCase()}
              </span>
              <span className="font-medium text-ink-700">{me?.account.name}</span>
            </span>
            <button
              onClick={logout}
              className="rounded-lg px-2.5 py-1.5 font-medium text-ink-600 transition-colors hover:bg-red-50 hover:text-danger"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
