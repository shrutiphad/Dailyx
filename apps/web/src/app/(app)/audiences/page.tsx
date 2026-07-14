'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Modal, EmptyState, Badge } from '@/components/ui';

interface Rule { field: string; op: string; value?: string }
interface Filter { match: 'all' | 'any'; rules: Rule[] }
interface Audience { id: string; name: string; filter: Filter; count: number }
interface Facets { tags: string[]; cities: string[]; customFields: { key: string; label: string }[] }

const OPS = [
  { v: 'eq', label: 'is' },
  { v: 'neq', label: 'is not' },
  { v: 'contains', label: 'contains' },
  { v: 'has_tag', label: 'has tag' },
  { v: 'not_has_tag', label: 'does not have tag' },
  { v: 'exists', label: 'is set' },
  { v: 'not_exists', label: 'is not set' },
];

export default function AudiencesPage() {
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [facets, setFacets] = useState<Facets>({ tags: [], cities: [], customFields: [] });
  const [modal, setModal] = useState<null | 'new' | Audience>(null);
  const [name, setName] = useState('');
  const [filter, setFilter] = useState<Filter>({ match: 'all', rules: [{ field: 'tag', op: 'has_tag', value: '' }] });
  const [preview, setPreview] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [a, f] = await Promise.all([
      api.get<{ audiences: Audience[] }>('/api/audiences'),
      api.get<Facets>('/api/contacts/facets'),
    ]);
    setAudiences(a.audiences);
    setFacets(f);
  }, []);
  useEffect(() => { load(); }, [load]);

  // Live count preview whenever the filter changes.
  useEffect(() => {
    if (modal === null) return;
    const t = setTimeout(async () => {
      const res = await api.post<{ count: number }>('/api/audiences/preview', { filter });
      setPreview(res.count);
    }, 250);
    return () => clearTimeout(t);
  }, [filter, modal]);

  function openNew() {
    setName('');
    setFilter({ match: 'all', rules: [{ field: 'tag', op: 'has_tag', value: '' }] });
    setModal('new');
  }
  function openEdit(a: Audience) {
    setName(a.name);
    setFilter(a.filter);
    setModal(a);
  }
  function setRule(i: number, patch: Partial<Rule>) {
    setFilter((f) => ({ ...f, rules: f.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  }
  function addRule() {
    setFilter((f) => ({ ...f, rules: [...f.rules, { field: 'city', op: 'eq', value: '' }] }));
  }
  function removeRule(i: number) {
    setFilter((f) => ({ ...f, rules: f.rules.filter((_, j) => j !== i) }));
  }

  async function save() {
    const payload = { name, filter };
    if (modal === 'new') await api.post('/api/audiences', payload);
    else if (modal) await api.put(`/api/audiences/${modal.id}`, payload);
    setModal(null);
    load();
  }
  async function remove(id: string) {
    if (!confirm('Delete this audience?')) return;
    await api.del(`/api/audiences/${id}`);
    load();
  }

  const fieldOptions = [
    { v: 'tag', label: 'Tag' },
    { v: 'city', label: 'City' },
    { v: 'name', label: 'Name' },
    { v: 'email', label: 'Email' },
    ...facets.customFields.map((c) => ({ v: `custom:${c.key}`, label: c.label })),
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Audiences</h1>
        <button className="btn-primary" onClick={openNew}>New audience</button>
      </div>

      {audiences.length === 0 ? (
        <EmptyState title="No audiences yet" hint="Create a saved filter of contacts to target campaigns." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {audiences.map((a) => (
            <div key={a.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{a.name}</div>
                  <div className="mt-1 text-sm text-ink-500">{a.count} contacts</div>
                </div>
                <Badge tone="brand">{a.filter.match === 'all' ? 'AND' : 'OR'}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {a.filter.rules.map((r, i) => (
                  <Badge key={i}>{r.field} {r.op} {r.value}</Badge>
                ))}
              </div>
              <div className="mt-4 flex gap-3 text-sm">
                <button className="text-brand-600" onClick={() => openEdit(a)}>Edit</button>
                <button className="text-danger" onClick={() => remove(a.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal !== null} onClose={() => setModal(null)} title={modal === 'new' ? 'New audience' : 'Edit audience'}>
        <label className="label">Name</label>
        <input className="input mb-4" value={name} onChange={(e) => setName(e.target.value)} />

        <div className="mb-2 flex items-center gap-2 text-sm">
          <span>Match</span>
          <select className="input w-auto" value={filter.match} onChange={(e) => setFilter({ ...filter, match: e.target.value as 'all' | 'any' })}>
            <option value="all">all</option>
            <option value="any">any</option>
          </select>
          <span>of these rules</span>
        </div>

        <div className="space-y-2">
          {filter.rules.map((r, i) => (
            <div key={i} className="flex gap-2">
              <select className="input" value={r.field} onChange={(e) => setRule(i, { field: e.target.value })}>
                {fieldOptions.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
              <select className="input" value={r.op} onChange={(e) => setRule(i, { op: e.target.value })}>
                {OPS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
              {!['exists', 'not_exists'].includes(r.op) && (
                <input className="input" value={r.value ?? ''} placeholder="value" onChange={(e) => setRule(i, { value: e.target.value })} />
              )}
              <button className="px-2 text-ink-500 hover:text-danger" onClick={() => removeRule(i)}>✕</button>
            </div>
          ))}
        </div>
        <button className="mt-2 text-sm text-brand-600" onClick={addRule}>+ Add rule</button>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm text-ink-500">Matches {preview ?? '…'} contacts</span>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={!name}>Save</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
