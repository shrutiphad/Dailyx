'use client';
import { useEffect, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api, clearToken, getToken, ApiError } from '@/lib/api';

/* ── icons ──────────────────────────────────────────────────────────────── */
type IconProps = { className?: string };
const Icon = (p: IconProps & { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" className={p.className}>{p.children}</svg>
);
const ContactsIcon = (p: IconProps) => <Icon {...p}><path d="M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" /><circle cx="9" cy="8" r="3.5" /><path d="M17.5 15A4 4 0 0 1 22 19v1M16 4.5a3.5 3.5 0 0 1 0 6.9" /></Icon>;
const AudiencesIcon = (p: IconProps) => <Icon {...p}><path d="M3 5h18M6 12h12M10 19h4" /></Icon>;
const CampaignsIcon = (p: IconProps) => <Icon {...p}><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></Icon>;
const SunIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon>;
const MoonIcon = (p: IconProps) => <Icon {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></Icon>;
const LogoutIcon = (p: IconProps) => <Icon {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Icon>;
const MailMark = (p: IconProps) => <Icon {...p}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="m3 7 9 6 9-6" /></Icon>;

const NAV: { href: string; label: string; icon: ComponentType<IconProps> }[] = [
  { href: '/contacts', label: 'Contacts', icon: ContactsIcon },
  { href: '/audiences', label: 'Audiences', icon: AudiencesIcon },
  { href: '/campaigns', label: 'Campaigns', icon: CampaignsIcon },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<{ user: { name: string }; account: { name: string } } | null>(null);
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

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

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', next === 'dark');
    try { localStorage.setItem('theme', next); } catch { /* ignore */ }
    setTheme(next);
  }

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

  const initial = (me?.account.name ?? '?').trim().charAt(0).toUpperCase();

  const Brand = (
    <Link href="/contacts" className="flex items-center gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-btn">
        <MailMark className="h-[18px] w-[18px]" />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight text-ink-900">DailyX</span>
        <span className="block text-[11px] font-medium text-ink-500">by Olio · Global adtech</span>
      </span>
    </Link>
  );

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {NAV.map((n) => {
        const active = pathname.startsWith(n.href);
        const I = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200/70'
                : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
            }`}
          >
            <I className={`h-[18px] w-[18px] ${active ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-600'}`} />
            {n.label}
          </Link>
        );
      })}
    </>
  );

  const ThemeToggle = (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 bg-surface text-ink-600 shadow-btn transition-colors hover:bg-ink-100 hover:text-ink-900"
    >
      {theme === 'dark' ? <SunIcon className="h-[18px] w-[18px]" /> : <MoonIcon className="h-[18px] w-[18px]" />}
    </button>
  );

  return (
    <div className="min-h-screen">
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-ink-200 bg-surface md:flex">
        <div className="border-b border-ink-200 px-5 py-5">{Brand}</div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Workspace
          </p>
          <NavLinks />
        </nav>

        <div className="space-y-3 border-t border-ink-200 p-3">
          <div className="flex items-center gap-3 rounded-lg bg-ink-50 px-3 py-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
              {initial}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold text-ink-800">{me?.account.name}</span>
              <span className="block truncate text-[11px] text-ink-500">{me?.user.name}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {ThemeToggle}
            <button
              onClick={logout}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm font-medium text-ink-600 shadow-btn transition-colors hover:border-danger/30 hover:bg-red-50 hover:text-danger"
            >
              <LogoutIcon className="h-4 w-4" /> Log out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile top bar ──────────────────────────────────────────────── */}
      <div className="md:pl-64">
        <header className="sticky top-0 z-30 border-b border-ink-200 bg-surface/85 backdrop-blur-md md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            {Brand}
            <div className="flex items-center gap-2">
              {ThemeToggle}
              <button
                onClick={logout}
                aria-label="Log out"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 bg-surface text-ink-600 shadow-btn hover:text-danger"
              >
                <LogoutIcon className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3">
            <NavLinks />
          </nav>
        </header>

        <main className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
