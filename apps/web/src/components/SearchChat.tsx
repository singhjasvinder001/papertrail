'use client';

import { useState } from 'react';
import { apiFetch, type ChatResponse, type ChatSource, type SearchHit } from '@/lib/api';

export function SearchPanel({ collectionId }: { collectionId: string }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ hits: SearchHit[]; fromCache: boolean; estimatedTotalHits?: number } | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res = await apiFetch<{ hits: SearchHit[]; fromCache: boolean; estimatedTotalHits?: number }>(
        `/collections/${collectionId}/search`,
        { method: 'POST', body: JSON.stringify({ q, limit: 12 }) }
      );
      setResults(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <form onSubmit={run} className="flex gap-2">
        <input
          className="input"
          placeholder="Search inside this collection… try a phrase from your documents"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" className="btn-primary shrink-0" disabled={searching || !q.trim()}>
          {searching ? '…' : 'Search'}
        </button>
      </form>

      {error && <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</div>}

      {results && (
        <div className="mt-6 space-y-4">
          <p className="text-xs text-slate-500">
            {results.hits.length === 0 ? 'No matches.' : `${results.hits.length} match${results.hits.length > 1 ? 'es' : ''}`}
            {results.estimatedTotalHits && results.estimatedTotalHits > results.hits.length ? ` (${results.estimatedTotalHits} total)` : ''}
            {results.fromCache && <span className="ml-2 chip border-cyan-400/30 bg-cyan-400/10 text-cyan-300">served from Valkey cache</span>}
          </p>
          {results.hits.map((h) => (
            <div key={h.id} className="card p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="chip border-white/10 bg-white/5 text-slate-300">📄 {h.title}</span>
                {h.page != null && h.page > 0 && (
                  <span className="chip border-accent-400/30 bg-accent-400/10 text-accent-300">page {h.page}</span>
                )}
              </div>
              <p
                className="text-sm leading-relaxed text-slate-300 [&_mark]:rounded [&_mark]:bg-accent-500/40 [&_mark]:px-0.5 [&_mark]:text-white"
                dangerouslySetInnerHTML={{ __html: h.highlighted }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChatPanel({ collectionId }: { collectionId: string }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string; sources?: ChatSource[]; mode?: string }[]>([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || asking) return;
    const q = question.trim();
    setQuestion('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setAsking(true);
    try {
      const res = await apiFetch<ChatResponse>(`/collections/${collectionId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ question: q }),
      });
      setMessages((m) => [...m, { role: 'bot', text: res.answer, sources: res.sources, mode: res.mode }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'bot', text: `⚠️ ${err instanceof Error ? err.message : 'Request failed'}` }]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="flex h-[560px] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-slate-400">Ask a question about the documents in this collection.</p>
            <p className="max-w-sm text-xs text-slate-600">
              Every answer cites the source document and page — no hallucinations, everything traceable.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === 'user' ? 'bg-accent-600 text-white' : 'card bg-ink-800/80 text-slate-200'
              }`}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.sources && m.sources.length > 0 && m.role === 'bot' && (
                <div className="mt-3 border-t border-white/10 pt-2">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Sources {m.mode === 'llm' ? '· LLM-grounded' : '· extractive mode'}
                  </p>
                  <div className="space-y-1.5">
                    {m.sources.map((s, j) => (
                      <div key={j} className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-400">
                        <span className="font-semibold text-accent-300">
                          [{j + 1}] {s.title}
                          {s.page != null && s.page > 0 ? ` · p.${s.page}` : ''}
                        </span>
                        <p className="mt-0.5 line-clamp-2">{s.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {asking && (
          <div className="flex justify-start">
            <div className="card bg-ink-800/80 px-4 py-3 text-sm text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulseSoft rounded-full bg-accent-400" />
                Reading your documents…
              </span>
            </div>
          </div>
        )}
      </div>
      <form onSubmit={ask} className="mt-4 flex gap-2">
        <input
          className="input"
          placeholder="e.g. What is the refund policy mentioned in the documents?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button type="submit" className="btn-primary shrink-0" disabled={asking || !question.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
