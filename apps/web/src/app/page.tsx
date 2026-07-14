'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(getToken() ? '/contacts' : '/login');
  }, [router]);
  return <div className="p-10 text-ink-500">Loading…</div>;
}
