'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, setToken, ApiError } from '@/lib/api';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ accountName: '', name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post<{ token: string }>('/api/auth/signup', form);
      setToken(res.token);
      router.push('/contacts');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign up failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgb(var(--brand-100))_0%,transparent_70%)]"
      />
      <form onSubmit={submit} className="card relative w-full max-w-sm p-8">
        <span className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-white shadow-btn">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
            <path d="m3 7 9 6 9-6" />
          </svg>
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">Create your workspace</h1>
        <p className="mb-6 mt-1 text-sm text-ink-500">Each workspace is fully isolated from every other.</p>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-danger">
            <svg className="mt-0.5 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <label className="label">Workspace / company name</label>
        <input className="input mb-4" value={form.accountName} onChange={set('accountName')} />
        <label className="label">Your name</label>
        <input className="input mb-4" value={form.name} onChange={set('name')} />
        <label className="label">Email</label>
        <input className="input mb-4" type="email" value={form.email} onChange={set('email')} />
        <label className="label">Password</label>
        <input className="input mb-6" type="password" value={form.password} onChange={set('password')} />
        <button className="btn-primary w-full" disabled={busy}>
          {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
          {busy ? 'Creating…' : 'Sign up'}
        </button>
        <p className="mt-5 text-center text-sm text-ink-500">
          Have an account?{' '}
          <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700 hover:underline underline-offset-2">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
