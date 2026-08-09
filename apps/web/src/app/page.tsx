'use client';

import Link from 'next/link';
import { NavBar } from '@/components/Logo';

const pipeline = [
  { step: '01', title: 'Upload', text: 'Drag in PDFs, markdown, CSV or screenshots — up to 25 MB each, any number at once.' },
  { step: '02', title: 'Extract', text: 'A dedicated worker pulls the file from object storage and runs OCR or text extraction.' },
  { step: '03', title: 'Index', text: 'The worker chunks the text into page-scoped fragments and ships them to Meilisearch.' },
  { step: '04', title: 'Ask', text: 'Search with typo tolerance or ask questions. Every answer cites the exact page it came from.' },
];

const services = [
  { name: 'web', type: 'Next.js → Nginx (static)', accent: 'text-cyan-300 border-cyan-400/30 bg-cyan-400/10', note: 'public' },
  { name: 'api', type: 'Fastify · Node 22', accent: 'text-accent-300 border-accent-400/30 bg-accent-400/10', note: 'public' },
  { name: 'worker', type: 'OCR + indexing pipeline', accent: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10', note: 'private' },
  { name: 'db', type: 'PostgreSQL 16', accent: 'text-sky-300 border-sky-400/30 bg-sky-400/10', note: 'private' },
  { name: 'cache', type: 'Valkey queue + cache', accent: 'text-rose-300 border-rose-400/30 bg-rose-400/10', note: 'private' },
  { name: 'meili', type: 'Meilisearch index', accent: 'text-amber-300 border-amber-400/30 bg-amber-400/10', note: 'private' },
  { name: 'storage', type: 'MinIO object storage', accent: 'text-violet-300 border-violet-400/30 bg-violet-400/10', note: 'private' },
];

export default function HomePage() {
  return (
    <>
      <NavBar />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-20 pb-16 text-center">
        <span className="chip border-accent-400/30 bg-accent-400/10 text-accent-300">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-400 animate-pulseSoft" />
          Deployed on Zerops · 7 services · one weekend
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl">
          Your documents, finally{' '}
          <span className="bg-gradient-to-r from-accent-400 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
            searchable
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
          Upload the messy PDFs, invoices and screenshots collecting dust in your drive. PaperTrail extracts, indexes
          and answers questions from them — every answer cites the exact page it came from.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/register" className="btn-primary px-6 py-3 text-base">
            Try the live demo
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <a href="#how" className="btn-ghost px-6 py-3 text-base">
            How it works
          </a>
        </div>
      </section>

      {/* Architecture */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="card p-6 sm:p-10">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">The Zerops architecture</h2>
            <span className="chip border-white/10 bg-white/5 text-slate-300">3 runtimes + 4 managed services</span>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Public column */}
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Public traffic · L7 balancer</p>
              <div className="rounded-xl border border-dashed border-white/15 bg-ink-800/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-white">web</span>
                  <span className="chip border-white/10 bg-white/5 text-slate-400">static</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Next.js export on managed Nginx</p>
              </div>
              <div className="ml-6 h-8 w-px bg-white/10" />
              <div className="rounded-xl border border-dashed border-white/15 bg-ink-800/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-white">api</span>
                  <span className="chip border-white/10 bg-white/5 text-slate-400">node 22</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Fastify · auth · uploads · search · chat</p>
              </div>
            </div>

            {/* Private column */}
            <div className="space-y-4 lg:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Private network · VXLAN</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-ink-800/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold text-white">worker</span>
                    <span className="chip border-white/10 bg-white/5 text-slate-400">node 22</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">OCR (tesseract.js) · pdf.js · chunking · indexing</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-ink-800/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold text-white">db</span>
                    <span className="chip border-white/10 bg-white/5 text-slate-400">postgres</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Users, sessions, collections, documents</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-ink-800/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold text-white">cache</span>
                    <span className="chip border-white/10 bg-white/5 text-slate-400">valkey</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Job queue · session cache · search cache</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-ink-800/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold text-white">meili</span>
                    <span className="chip border-white/10 bg-white/5 text-slate-400">meilisearch</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Typo-tolerant full-text search</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-ink-800/50 p-4 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold text-white">storage</span>
                    <span className="chip border-white/10 bg-white/5 text-slate-400">s3 / minio</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Original files, uploaded by the API and read by the worker</p>
                </div>
              </div>
              <div className="rounded-xl border border-accent-500/25 bg-accent-500/5 p-4 text-sm text-slate-300">
                <span className="font-semibold text-accent-300">Why this shape?</span> Services only talk over the
                private network — no exposed database, queue or search engine. The worker scales horizontally by simply
                adding containers; the queue makes sure no job is lost.
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-2 sm:grid-cols-3">
            {services.map((s) => (
              <div key={s.name} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${s.accent}`}>
                <span className="font-mono text-sm font-semibold">{s.name}</span>
                <span className="text-xs opacity-80">{s.note}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section id="how" className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="mb-8 text-center text-3xl font-bold text-white">From upload to answer in four steps</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pipeline.map((p) => (
            <div key={p.step} className="card p-6">
              <span className="font-mono text-2xl font-bold text-accent-400/60">{p.step}</span>
              <h3 className="mt-3 text-lg font-semibold text-white">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-4 pb-24 text-center">
        <div className="card bg-gradient-to-br from-accent-600/20 to-cyan-500/10 p-10">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Stop searching. Start finding.</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">
            Create a free account and upload a document — you will be searching it in under a minute.
          </p>
          <Link href="/register" className="btn-primary mt-8 px-8 py-3 text-base">
            Open the app
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500">
        PaperTrail — built for The Zerops Challenge 2026 · <span className="font-mono">web · api · worker · db · cache · meili · storage</span>
      </footer>
    </>
  );
}
