'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui';

interface Audience { id: string; name: string; count: number }
interface Facets { tags: string[] }
interface MatchResult { recipients: { email: string; name: string | null }[]; unmatched: string[] }

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [form, setForm] = useState({ name: '', subject: '', body: '' });
  const [source, setSource] = useState<'AUDIENCE' | 'TAG' | 'MANUAL'>('AUDIENCE');
  const [audienceId, setAudienceId] = useState('');
  const [tag, setTag] = useState('');
  const [manualText, setManualText] = useState('');
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])]);
    e.target.value = '';
  }
  function removeFile(i: number) {
    setFiles((prev) => prev.filter((_, j) => j !== i));
  }

  useEffect(() => {
    api.get<{ audiences: Audience[] }>('/api/audiences').then((r) => {
      setAudiences(r.audiences);
      if (r.audiences[0]) setAudienceId(r.audiences[0].id);
    });
    api.get<Facets>('/api/contacts/facets').then((r) => {
      setTags(r.tags);
      if (r.tags[0]) setTag(r.tags[0]);
    });
  }, []);

  // Live lookup of pasted emails/phones against saved contacts.
  useEffect(() => {
    if (source !== 'MANUAL' || !manualText.trim()) {
      setMatch(null);
      return;
    }
    const t = setTimeout(async () => {
      const entries = manualText.split(/[\n,;]/).map((s) => s.trim()).filter(Boolean);
      const res = await api.post<MatchResult>('/api/campaigns/match', { entries });
      setMatch(res);
    }, 350);
    return () => clearTimeout(t);
  }, [manualText, source]);

  async function submit() {
    setError('');
    setBusy(true);
    try {
      const manualEntries = manualText.split(/[\n,;]/).map((s) => s.trim()).filter(Boolean);
      const iso = when === 'later' && scheduledAt ? new Date(scheduledAt).toISOString() : null;
      const created = await api.post<{ campaign: { id: string } }>('/api/campaigns', {
        ...form,
        source,
        audienceId: source === 'AUDIENCE' ? audienceId : null,
        tag: source === 'TAG' ? tag : null,
        manualEntries: source === 'MANUAL' ? manualEntries : [],
        scheduledAt: iso,
      });
      // Upload any attachments to the freshly-created campaign before sending.
      for (const f of files) {
        const fd = new FormData();
        fd.append('file', f);
        await api.upload(`/api/campaigns/${created.campaign.id}/attachments`, fd);
      }
      await api.post(`/api/campaigns/${created.campaign.id}/send`, { scheduledAt: iso });
      router.push(`/campaigns/${created.campaign.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create campaign');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold">New campaign</h1>
      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-danger">{error}</div>}

      <div className="card space-y-4 p-6">
        <div><label className="label">Campaign name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><label className="label">Subject</label><input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
        <div><label className="label">Body (HTML allowed)</label><textarea className="input min-h-[160px]" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
      </div>

      <div className="card mt-4 space-y-4 p-6">
        <div className="text-sm font-medium text-ink-700">Recipients</div>
        <div className="flex gap-2">
          {(['AUDIENCE', 'TAG', 'MANUAL'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${source === s ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-300 text-ink-700'}`}
            >
              {s === 'AUDIENCE' ? 'Audience' : s === 'TAG' ? 'Tag' : 'Paste emails/phones'}
            </button>
          ))}
        </div>

        {source === 'AUDIENCE' && (
          <select className="input" value={audienceId} onChange={(e) => setAudienceId(e.target.value)}>
            {audiences.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.count})</option>)}
          </select>
        )}
        {source === 'TAG' && (
          <select className="input" value={tag} onChange={(e) => setTag(e.target.value)}>
            {tags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {source === 'MANUAL' && (
          <div>
            <textarea
              className="input min-h-[120px]"
              placeholder="Paste emails or phone numbers, one per line or comma-separated"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
            />
            {match && (
              <div className="mt-3 space-y-2">
                <div className="text-sm text-success">{match.recipients.length} matched</div>
                <div className="flex flex-wrap gap-1">
                  {match.recipients.map((r) => (
                    <Badge key={r.email} tone="success">{r.name ?? r.email}</Badge>
                  ))}
                </div>
                {match.unmatched.length > 0 && (
                  <>
                    <div className="text-sm text-danger">{match.unmatched.length} not found</div>
                    <div className="flex flex-wrap gap-1">
                      {match.unmatched.map((u) => <Badge key={u} tone="danger">{u}</Badge>)}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card mt-4 space-y-4 p-6">
        <div className="text-sm font-medium text-ink-700">When to send</div>
        <div className="flex gap-2">
          <button onClick={() => setWhen('now')} className={`rounded-lg border px-3 py-1.5 text-sm ${when === 'now' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-300 text-ink-700'}`}>Send now</button>
          <button onClick={() => setWhen('later')} className={`rounded-lg border px-3 py-1.5 text-sm ${when === 'later' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-300 text-ink-700'}`}>Schedule</button>
        </div>
        {when === 'later' && (
          <input type="datetime-local" className="input max-w-xs" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-ghost" onClick={() => router.push('/campaigns')}>Cancel</button>
        <button className="btn-primary" disabled={busy || !form.name || !form.subject || !form.body} onClick={submit}>
          {busy ? 'Working…' : when === 'now' ? 'Send now' : 'Schedule'}
        </button>
      </div>
    </div>
  );
}
