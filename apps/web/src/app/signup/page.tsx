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
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-brand-700">Create your workspace</h1>
        <p className="mb-6 mt-1 text-sm text-ink-500">Each workspace is fully isolated.</p>
        {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-danger">{error}</div>}
        <label className="label">Workspace / company name</label>
        <input className="input mb-4" value={form.accountName} onChange={set('accountName')} />
        <label className="label">Your name</label>
        <input className="input mb-4" value={form.name} onChange={set('name')} />
        <label className="label">Email</label>
        <input className="input mb-4" type="email" value={form.email} onChange={set('email')} />
        <label className="label">Password</label>
        <input className="input mb-6" type="password" value={form.password} onChange={set('password')} />
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Sign up'}</button>
        <p className="mt-4 text-center text-sm text-ink-500">
          Have an account? <Link href="/login" className="text-brand-600">Log in</Link>
        </p>
      </form>
    </div>
  );
}
