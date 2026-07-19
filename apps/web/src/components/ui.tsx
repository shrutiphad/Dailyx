'use client';
import { ReactNode, useEffect } from 'react';

// Shared UI primitives. Props/exports are unchanged — only the presentation.

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  // ring-inset gives each badge a crisp edge on both white and tinted surfaces.
  const tones: Record<string, string> = {
    neutral: 'bg-ink-100 text-ink-700 ring-ink-300/60',
    brand: 'bg-brand-50 text-brand-700 ring-brand-200',
    success: 'bg-green-50 text-success ring-green-200',
    warning: 'bg-amber-50 text-warning ring-amber-200',
    danger: 'bg-red-50 text-danger ring-red-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        tones[tone] ?? tones.neutral
      }`}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, string> = {
  DRAFT: 'neutral',
  SCHEDULED: 'warning',
  QUEUED: 'brand',
  SENDING: 'brand',
  SENT: 'success',
  CANCELED: 'neutral',
  FAILED: 'danger',
};

// Live states get a soft pulsing dot so "in flight" reads at a glance.
const STATUS_LIVE = new Set(['QUEUED', 'SENDING']);

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? 'neutral';
  return (
    <Badge tone={tone}>
      {STATUS_LIVE.has(status) && (
        <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {status.toLowerCase()}
    </Badge>
  );
}

export function Stat({
  label,
  value,
  hint,
  foot,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  foot?: ReactNode;
}) {
  return (
    <div className="card p-5 transition-shadow hover:shadow-card-hover">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-ink-900">{value}</div>
      {hint && <div className="mt-1.5 text-xs text-ink-500">{hint}</div>}
      {foot}
    </div>
  );
}

// Slim animated progress bar for rates (delivery / open %).
export function RateBar({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'success' | 'warning' }) {
  const fills: Record<string, string> = {
    brand: 'bg-brand-500',
    success: 'bg-success',
    warning: 'bg-warning',
  };
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${fills[tone]} transition-[width] duration-700 ease-out`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  // Close on Escape and lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-ink-200 bg-surface p-6 shadow-popover animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-900"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-1 px-6 py-16 text-center">
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      </div>
      <div className="text-base font-semibold text-ink-800">{title}</div>
      {hint && <div className="max-w-sm text-sm text-ink-500">{hint}</div>}
    </div>
  );
}
