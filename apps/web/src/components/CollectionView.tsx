'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, clearToken, getToken, getUser, type Collection, type DocumentRow } from '@/lib/api';
import { NavBar } from '@/components/Logo';
import { UploadDropzone, DocList } from '@/components/Documents';
import { SearchPanel, ChatPanel } from '@/components/SearchChat';

type Tab = 'documents' | 'search' | 'chat';

export function CollectionView({ collectionId }: { collectionId: string }) {
  const router = useRouter();
  const [user] = useState(getUser);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [tab, setTab] = useState<Tab>('documents');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [colRes, docsRes] = await Promise.all([
        apiFetch<{ collection: Collection; stats: { document_count: string; ready_count: string; processing_count: string } }>(
          `/collections/${collectionId}`
        ),
        apiFetch<{ documents: DocumentRow[] }>(`/collections/${collectionId}/documents`),
      ]);
      setCollection(colRes.collection);
      setDocuments(docsRes.documents);
      setError(null);

      // Keep polling while any document is still processing
      const busy = docsRes.documents.some((d) => d.status === 'queued' || d.status === 'processing');
      if (busy) {
        if (!pollTimer.current) {
          pollTimer.current = setInterval(() => void load(), 2500);
        }
      } else if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [collectionId]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    void load();
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [collectionId, load, router]);

  const onUploaded = (docs: DocumentRow[]) => {
    setDocuments((prev) => [...docs, ...prev]);
    // force a refresh + start polling for the new jobs
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => void load(), 2500);
    void load();
  };

  const removeCollection = async () => {
    if (!window.confirm('Delete this collection and all its documents?')) return;
    setDeleting(true);
    try {
      await apiFetch(`/collections/${collectionId}`, { method: 'DELETE' });
      router.push('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  };

  const logout = () => {
    clearToken();
    router.push('/');
  };

  const ready = documents.filter((d) => d.status === 'ready').length;
  const busy = documents.some((d) => d.status === 'queued' || d.status === 'processing');

  return (
    <>
      <NavBar username={user?.username} onLogout={logout} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/app" className="text-xs font-medium text-slate-500 transition hover:text-accent-400">
              ← All collections
            </Link>
            <h1 className="mt-1 text-3xl font-bold text-white">{collection?.name ?? '…'}</h1>
            <p className="mt-1 text-sm text-slate-400">{collection?.description}</p>
          </div>
          <div className="flex items-center gap-3">
            {busy && (
              <span className="chip border-amber-400/30 bg-amber-400/10 text-amber-300">
                <span className="h-1.5 w-1.5 animate-pulseSoft rounded-full bg-amber-400" />
                Processing…
              </span>
            )}
            <span className="chip border-white/10 bg-white/5 text-slate-300">
              {ready}/{documents.length} indexed
            </span>
            <button className="btn-ghost !py-2 text-rose-300 hover:bg-rose-500/10" onClick={() => void removeCollection()} disabled={deleting}>
              Delete collection
            </button>
          </div>
        </div>

        {error && <div className="card mt-6 border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}

        <div className="mt-8 space-y-8">
          <UploadDropzone collectionId={collectionId} onUploaded={onUploaded} />

          <div className="flex gap-1 rounded-xl border border-white/10 bg-ink-900/60 p-1">
            {(
              [
                { id: 'documents', label: `Documents (${documents.length})` },
                { id: 'search', label: 'Search' },
                { id: 'chat', label: 'Ask' },
              ] as { id: Tab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  tab === t.id ? 'bg-accent-600 text-white shadow-lg shadow-accent-600/25' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'documents' && <DocList documents={documents} onChanged={() => void load()} />}
          {tab === 'search' && <SearchPanel collectionId={collectionId} />}
          {tab === 'chat' && <ChatPanel collectionId={collectionId} />}
        </div>
      </main>
    </>
  );
}
