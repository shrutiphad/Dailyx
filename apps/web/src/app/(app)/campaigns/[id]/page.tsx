'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Stat, StatusBadge, Badge, RateBar } from '@/components/ui';

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
        <div className="flex gap-2">
          {stats.status === 'SCHEDULED' && <button className="btn-danger" onClick={cancel}>Cancel schedule</button>}
          <button className="btn-ghost" onClick={duplicate}>Duplicate</button>
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
    </div>
  );
}
