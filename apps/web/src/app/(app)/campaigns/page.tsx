'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { StatusBadge, EmptyState } from '@/components/ui';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  audience: { name: string } | null;
  source: string;
}

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  async function load() {
    const res = await api.get<{ campaigns: Campaign[] }>('/api/campaigns');
    setCampaigns(res.campaigns);
  }
  useEffect(() => { load(); }, []);

  async function duplicate(id: string) {
    const res = await api.post<{ campaign: { id: string } }>(`/api/campaigns/${id}/duplicate`);
    router.push(`/campaigns/${res.campaign.id}`);
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This also removes its recipients and analytics. This can't be undone.`)) return;
    await api.del(`/api/campaigns/${id}`);
    load();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Campaigns</h1>
        <Link href="/campaigns/new" className="btn-primary">New campaign</Link>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState title="No campaigns yet" hint="Create one and send it to an audience, tag, or a pasted list." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-100 text-left text-ink-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Subject</th>
                <th className="px-4 py-2 font-medium">Recipients</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-t border-ink-300/40">
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/campaigns/${c.id}`} className="text-brand-700 hover:underline">{c.name}</Link>
                  </td>
                  <td className="px-4 py-2 text-ink-700">{c.subject}</td>
                  <td className="px-4 py-2 text-ink-700">{c.audience?.name ?? c.source.toLowerCase()}</td>
                  <td className="px-4 py-2"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-2 text-ink-500">
                    {c.sentAt ? new Date(c.sentAt).toLocaleString()
                      : c.scheduledAt ? `⏰ ${new Date(c.scheduledAt).toLocaleString()}`
                      : '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button className="mr-3 text-brand-600" onClick={() => duplicate(c.id)}>Duplicate</button>
                    <button className="text-danger" onClick={() => remove(c.id, c.name)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
