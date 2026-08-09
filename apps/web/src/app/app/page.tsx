'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, clearToken, getToken, getUser, type Collection } from '@/lib/api';
import { NavBar } from '@/components/Logo';

export default function DashboardPage() {
  const router = useRouter();
  const [user] = useState(getUser);
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    try {
      const res = await apiFetch<{ collections: Collection[] }>('/collections');
      setCollections(res.collections);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  };

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await apiFetch('/collections', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      });
      setName('');
      setDescription('');
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  const logout = () => {
    clearToken();
    router.push('/');
  };

  return (
    <>
      <NavBar username={user?.username} onLogout={logout} />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Your collections</h1>
            <p className="mt-1 text-sm text-slate-400">
              {collections === null
                ? 'Loading…'
                : collections.length === 0
                  ? 'Create a collection to start uploading documents.'
                  : `${collections.length} collection${collections.length > 1 ? 's' : ''}`}
            </p>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? 'Cancel' : '+ New collection'}
          </button>
        </div>

        {showCreate && (
          <form onSubmit={create} className="card mt-8 grid gap-4 p-6 sm:grid-cols-[1fr_2fr_auto]">
            <div>
              <label className="label">Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Research papers" required maxLength={80} />
            </div>
            <div>
              <label className="label">Description (optional)</label>
              <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What lives in this collection?" maxLength={300} />
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full sm:w-auto" disabled={creating}>
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        )}

        {error && (
          <div className="card mt-8 border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
        )}

        {collections !== null && collections.length === 0 && !showCreate && (
          <div className="card mt-10 flex flex-col items-center gap-4 p-14 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7l7-4z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <p className="max-w-sm text-slate-400">
              Collections keep your documents together — create one and start uploading.
            </p>
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              Create your first collection
            </button>
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(collections ?? []).map((c) => {
            const total = Number(c.document_count ?? 0);
            const ready = Number(c.ready_count ?? 0);
            const progress = total > 0 ? Math.round((ready / total) * 100) : 100;
            return (
              <Link key={c.id} href={`/app/c?id=${c.id}`} className="card group p-6 transition hover:border-accent-500/40 hover:bg-ink-800/70">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-white group-hover:text-accent-300">{c.name}</h3>
                  <span className="chip border-white/10 bg-white/5 text-slate-400">{total} docs</span>
                </div>
                <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm text-slate-400">{c.description || 'No description'}</p>
                <div className="mt-5">
                  <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                    <span>{ready}/{total} indexed</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-gradient-to-r from-accent-500 to-cyan-400 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}
