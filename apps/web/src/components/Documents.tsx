'use client';

import { useCallback, useRef, useState } from 'react';
import { apiFetch, formatBytes, type DocumentRow } from '@/lib/api';

const ACCEPTED = '.pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp';

export function UploadDropzone({ collectionId, onUploaded }: { collectionId: string; onUploaded: (docs: DocumentRow[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      setUploading(true);
      setError(null);
      try {
        const form = new FormData();
        for (const f of list) form.append('files', f, f.name);
        const res = await apiFetch<{ documents: DocumentRow[] }>(`/collections/${collectionId}/documents`, {
          method: 'POST',
          body: form,
        });
        onUploaded(res.documents);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [collectionId, onUploaded]
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void upload(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${
          dragOver ? 'border-accent-400 bg-accent-500/10' : 'border-white/15 bg-ink-900/50 hover:border-accent-500/50 hover:bg-ink-800/50'
        }`}
      >
        <input ref={inputRef} type="file" multiple accept={ACCEPTED} className="hidden" onChange={(e) => e.target.files && void upload(e.target.files)} />
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent-600/20">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V4M7 9l5-5 5 5" />
            <path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
          </svg>
        </div>
        <p className="mt-4 text-sm font-medium text-slate-200">
          {uploading ? 'Uploading…' : 'Drop documents here, or click to browse'}
        </p>
        <p className="mt-1 text-xs text-slate-500">PDF · TXT · MD · CSV · JSON · PNG · JPG · WEBP — up to 25 MB each</p>
      </div>
      {error && <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</div>}
    </div>
  );
}

export function statusMeta(status: DocumentRow['status']) {
  switch (status) {
    case 'queued':
      return { label: 'Queued', cls: 'border-slate-400/30 bg-slate-400/10 text-slate-300', dot: 'bg-slate-400' };
    case 'processing':
      return { label: 'Processing', cls: 'border-amber-400/30 bg-amber-400/10 text-amber-300', dot: 'bg-amber-400 animate-pulseSoft' };
    case 'ready':
      return { label: 'Indexed', cls: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300', dot: 'bg-emerald-400' };
    case 'failed':
      return { label: 'Failed', cls: 'border-rose-400/30 bg-rose-400/10 text-rose-300', dot: 'bg-rose-400' };
  }
}

export function DocList({
  documents,
  onChanged,
}: {
  documents: DocumentRow[];
  onChanged: () => void;
}) {
  const remove = async (id: string) => {
    if (!window.confirm('Delete this document and remove it from the index?')) return;
    try {
      await apiFetch(`/documents/${id}`, { method: 'DELETE' });
      onChanged();
    } catch {
      // ignore
    }
  };

  if (documents.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">No documents yet — upload something above.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03] text-left text-xs uppercase tracking-wider text-slate-500">
            <th className="px-4 py-3 font-semibold">Document</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="hidden px-4 py-3 font-semibold sm:table-cell">Indexed</th>
            <th className="hidden px-4 py-3 font-semibold md:table-cell">Size</th>
            <th className="hidden px-4 py-3 font-semibold md:table-cell">Uploaded</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => {
            const meta = statusMeta(d.status);
            return (
              <tr key={d.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-slate-400">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
                        <path d="M14 2v6h6" />
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-200" title={d.filename}>
                        {d.filename}
                      </p>
                      {d.error && <p className="truncate text-xs text-rose-400">{d.error}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`chip ${meta.cls}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-slate-400 sm:table-cell">
                  {d.status === 'ready' ? (
                    <span>
                      {d.page_count ?? '—'} pages · {new Intl.NumberFormat().format(d.char_count ?? 0)} chars
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="hidden px-4 py-3 text-slate-400 md:table-cell">{formatBytes(Number(d.size_bytes))}</td>
                <td className="hidden px-4 py-3 text-slate-500 md:table-cell">{new Date(d.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => void remove(d.id)}
                    className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
                    title="Delete"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                    </svg>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
