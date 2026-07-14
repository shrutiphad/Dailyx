'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, setToken, ApiError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('demo@dailyx.app');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post<{ token: string }>('/api/auth/login', { email, password });
      setToken(res.token);
      router.push('/contacts');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-brand-700">DailyX</h1>
        <p className="mb-6 mt-1 text-sm text-ink-500">Log in to your workspace</p>
        {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-danger">{error}</div>}
        <label className="label">Email</label>
        <input className="input mb-4" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        <label className="label">Password</label>
        <input className="input mb-6" value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</button>
        <p className="mt-4 text-center text-sm text-ink-500">
          No account? <Link href="/signup" className="text-brand-600">Sign up</Link>
        </p>
      </form>
    </div>
  );
}
