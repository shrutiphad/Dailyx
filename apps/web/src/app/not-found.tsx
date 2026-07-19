import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgb(var(--brand-100))_0%,transparent_70%)]"
      />
      <div className="card relative w-full max-w-md p-8 text-center">
        <span className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
            <path d="m3 7 9 6 9-6" />
          </svg>
        </span>
        <p className="text-5xl font-bold tracking-tight text-ink-900">404</p>
        <h1 className="mt-2 text-lg font-semibold text-ink-800">Page not found</h1>
        <p className="mt-1 text-sm text-ink-500">
          The page you’re looking for doesn’t exist or may have moved.
        </p>
        <Link href="/contacts" className="btn-primary mt-6 inline-flex">
          Back to DailyX
        </Link>
      </div>
    </div>
  );
}
