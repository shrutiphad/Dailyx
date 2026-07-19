'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Stat, StatusBadge, Badge, RateBar, Modal } from '@/components/ui';

// Format a Date as the value a <input type="datetime-local"> expects (local tz).
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Stats {
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  failed: number;
  pending: number;
  rates: { deliveryRate: number; openRate: number };
}
interface Campaign { id: string; name: string; subject: string; body: string; status: string }
interface Recipient { id: string; email: string; name: string | null; status: string; openCount: number }

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [reschedOpen, setReschedOpen] = useState(false);
  const [reschedAt, setReschedAt] = useState('');
  const [reschedBusy, setReschedBusy] = useState(false);
  const [reschedErr, setReschedErr] = useState('');

  const loadStats = useCallback(async () => {
    const [s, r] = await Promise.all([
      api.get<Stats>(`/api/campaigns/${id}/stats`),
      api.get<{ recipients: Recipient[] }>(`/api/campaigns/${id}/recipients`),
    ]);
    setStats(s);
    setRecipients(r.recipients);
  }, [id]);

  useEffect(() => {
    api.get<{ campaign: Campaign }>(`/api/campaigns/${id}`).then((r) => setCampaign(r.campaign));
    loadStats();
    // Poll every 4s so delivered/opened tick up without a manual refresh.
    const t = setInterval(loadStats, 4000);
    return () => clearInterval(t);
  }, [id, loadStats]);

  async function cancel() {
    await api.post(`/api/campaigns/${id}/cancel`);
    loadStats();
  }
  async function duplicate() {
    const res = await api.post<{ campaign: { id: string } }>(`/api/campaigns/${id}/duplicate`);
    router.push(`/campaigns/${res.campaign.id}`);
  }

  function openReschedule() {
    // Default to one hour from now, in the picker's local format.
    setReschedAt(toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
    setReschedErr('');
    setReschedOpen(true);
  }

  // Resend with the same content/recipients at a new time. Reuses the existing
  // duplicate + send endpoints: makes a fresh scheduled copy so the original
  // campaign's history/analytics stay untouched. No backend changes.
  async function rescheduleResend() {
    setReschedErr('');
    const when = new Date(reschedAt);
    if (!reschedAt || Number.isNaN(when.getTime())) {
      setReschedErr('Pick a date and time.');
      return;
    }
    if (when.getTime() < Date.now() + 60 * 1000) {
      setReschedErr('Choose a time at least a minute from now.');
      return;
    }
    setReschedBusy(true);
    try {
      const copy = await api.post<{ campaign: { id: string } }>(`/api/campaigns/${id}/duplicate`);
      await api.post(`/api/campaigns/${copy.campaign.id}/send`, { scheduledAt: when.toISOString() });
      setReschedOpen(false);
      router.push(`/campaigns/${copy.campaign.id}`);
    } catch (err) {
      setReschedErr(err instanceof ApiError ? err.message : 'Could not reschedule.');
    } finally {
      setReschedBusy(false);
    }
  }

  if (!campaign || !stats) return <div className="text-ink-500">Loading…</div>;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{campaign.name}</h1>
            <StatusBadge status={stats.status} />
          </div>
          <p className="mt-1 text-sm text-ink-500">{campaign.subject}</p>
          {stats.scheduledAt && stats.status === 'SCHEDULED' && (
            <p className="mt-1 text-sm text-warning">Scheduled for {new Date(stats.scheduledAt).toLocaleString()}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {stats.status === 'SCHEDULED' && <button className="btn-danger" onClick={cancel}>Cancel schedule</button>}
          <button className="btn-ghost" onClick={duplicate}>Duplicate</button>
          <button className="btn-primary" onClick={openReschedule}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 8v4l3 2" />
            </svg>
            Reschedule &amp; Resend
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Recipients" value={stats.total} hint={stats.failed ? `${stats.failed} failed` : 'in this campaign'} />
        <Stat label="Sent" value={stats.sent} hint={`${stats.pending} pending`} />
        <Stat
          label="Delivered"
          value={stats.delivered}
          hint={`${stats.rates.deliveryRate}% of sent`}
          foot={<RateBar value={stats.rates.deliveryRate} tone="success" />}
        />
        <Stat
          label="Opened"
          value={stats.opened}
          hint={`${stats.rates.openRate}% of delivered`}
          foot={<RateBar value={stats.rates.openRate} tone="brand" />}
        />
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-ink-500">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-success" />
        Live — refreshes every 4s
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-3 text-sm font-medium text-ink-700">Email preview</h2>
          <div className="rounded-lg border border-ink-300/60 p-4 text-sm" dangerouslySetInnerHTML={{ __html: campaign.body }} />
        </div>

        <div className="card overflow-hidden">
          <h2 className="p-4 pb-2 text-sm font-medium text-ink-700">Recipients ({recipients.length})</h2>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.id} className="border-t border-ink-300/40">
                    <td className="px-4 py-2">{r.name ?? r.email}</td>
                    <td className="px-4 py-2 text-ink-500">{r.email}</td>
                    <td className="px-4 py-2 text-right">
                      <Badge tone={r.status === 'OPENED' ? 'success' : r.status === 'FAILED' || r.status === 'BOUNCED' ? 'danger' : 'neutral'}>
                        {r.status.toLowerCase()}{r.openCount > 1 ? ` ×${r.openCount}` : ''}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={reschedOpen} onClose={() => setReschedOpen(false)} title="Reschedule & resend">
        <p className="mb-4 text-sm text-ink-500">
          Schedules a fresh copy of <span className="font-medium text-ink-700">{campaign.name}</span> with the
          same subject, body and recipients. The original campaign and its analytics stay untouched.
        </p>
        {reschedErr && <div className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-danger">{reschedErr}</div>}
        <label className="label">Send date &amp; time</label>
        <input
          type="datetime-local"
          className="input"
          value={reschedAt}
          onChange={(e) => setReschedAt(e.target.value)}
        />
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setReschedOpen(false)}>Cancel</button>
          <button className="btn-primary" disabled={reschedBusy} onClick={rescheduleResend}>
            {reschedBusy ? 'Scheduling…' : 'Schedule & resend'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
