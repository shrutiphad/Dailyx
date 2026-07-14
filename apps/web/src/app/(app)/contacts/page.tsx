'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Badge, Modal, EmptyState } from '@/components/ui';

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  tags: string[];
  customFields: Record<string, string>;
}

interface ImportResult {
  message: string;
  added: number;
  skippedDuplicatesInFile: number;
  skippedAlreadyExisting: number;
  skippedMissingEmail: number;
}

const blank = { name: '', email: '', phone: '', city: '', tags: '', customFields: '' };

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<null | 'new' | Contact>(null);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await api.get<{ contacts: Contact[] }>(`/api/contacts?q=${encodeURIComponent(q)}`);
    setContacts(res.contacts);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  function openNew() {
    setForm(blank);
    setError('');
    setModal('new');
  }
  function openEdit(c: Contact) {
    setForm({
      name: c.name,
      email: c.email,
      phone: c.phone ?? '',
      city: c.city ?? '',
      tags: c.tags.join(', '),
      customFields: Object.entries(c.customFields ?? {})
        .map(([k, v]) => `${k}=${v}`)
        .join(', '),
    });
    setError('');
    setModal(c);
  }

  async function save() {
    setError('');
    const customFields: Record<string, string> = {};
    form.customFields
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((pair) => {
        const [k, ...rest] = pair.split('=');
        if (k) customFields[k.trim()] = rest.join('=').trim();
      });
    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone || null,
      city: form.city || null,
      tags: form.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      customFields,
    };
    try {
      if (modal === 'new') await api.post('/api/contacts', payload);
      else if (modal) await api.put(`/api/contacts/${modal.id}`, payload);
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this contact?')) return;
    await api.del(`/api/contacts/${id}`);
    load();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.upload<ImportResult>('/api/contacts/import', fd);
      setImportResult(res);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Import failed');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" onChange={onFile} className="hidden" />
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}>Import CSV</button>
          <button className="btn-primary" onClick={openNew}>Add contact</button>
        </div>
      </div>

      {importResult && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-brand-50 p-3 text-sm text-brand-700">
          <span>{importResult.message}</span>
          <button onClick={() => setImportResult(null)}>✕</button>
        </div>
      )}

      <input
        className="input mb-4 max-w-sm"
        placeholder="Search name, email or city…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {contacts.length === 0 ? (
        <EmptyState title="No contacts yet" hint="Add one manually or import the sample CSV." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-100 text-left text-ink-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 font-medium">City</th>
                <th className="px-4 py-2 font-medium">Tags</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-t border-ink-300/40">
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2 text-ink-700">{c.email}</td>
                  <td className="px-4 py-2 text-ink-700">{c.phone}</td>
                  <td className="px-4 py-2 text-ink-700">{c.city}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <Badge key={t} tone="brand">{t}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button className="mr-3 text-brand-600" onClick={() => openEdit(c)}>Edit</button>
                    <button className="text-danger" onClick={() => remove(c.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal !== null} onClose={() => setModal(null)} title={modal === 'new' ? 'Add contact' : 'Edit contact'}>
        {error && <div className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-danger">{error}</div>}
        <div className="space-y-3">
          <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Email</label><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="label">City</label><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          </div>
          <div><label className="label">Tags (comma separated)</label><input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
          <div><label className="label">Custom fields (key=value, comma separated)</label><input className="input" placeholder="plan_tier=pro, source=web" value={form.customFields} onChange={(e) => setForm({ ...form, customFields: e.target.value })} /></div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn-primary" onClick={save}>Save</button>
        </div>
      </Modal>
    </div>
  );
}
