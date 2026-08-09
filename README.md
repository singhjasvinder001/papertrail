PaperTrail: upload documents → automatic OCR + extraction → search with typos tolerated → chat with page-cited answers.
Built for the Zerops Challenge on 7 interconnected services (web, api, worker + db, cache, meili, storage).
Live demo: web-2d61.prg1.zerops.app — login judge_demo / demopass123

# PaperTrail — Document Intelligence Platform

**Zerops Challenge 2026 entry.** Upload documents (PDF, Markdown, text, images) → automatic OCR & text extraction → full-text search with typo tolerance → natural-language Q&A with page-level citations.

Built as **7 interdependent services on Zerops** — the platform is the architecture, not an afterthought:

| Service | Role | Zerops type | Access |
|---|---|---|---|
| `web` | Next.js 14 static export, dark UI | `static@1.0` (managed Nginx) | public |
| `api` | Fastify REST: auth, uploads, search, chat | `nodejs@22` | public |
| `worker` | Extraction pipeline: pdf.js + Tesseract OCR, chunking, indexing | `nodejs@22` | private |
| `db` | PostgreSQL 16 — users, collections, documents | `postgresql:single@16` | private |
| `cache` | Valkey 7.2 — `jobs:pending` queue + 5-min search cache | `valkey@7.2` | private |
| `meili` | Meilisearch 1.20 — `fragments` index with typo tolerance | `meilisearch@1.20` | private |
| `storage` | MinIO object storage (S3 API) — original files | `object-storage` | private |

## Architecture at a glance

```
Browser ──► web (static Nginx)
              │ NEXT_PUBLIC_API_URL = $api_zeropsSubdomain
              ▼
           api (Fastify, public)
              │                                        ▲
        ┌─────┼─────────────┬──────────────┐           │ private net
        ▼     ▼             ▼              ▼           │
      db   cache (queue)  meili         storage       │
      ▲     │              ▲              ▲            │
      │     ▼              │              │            │
      └── worker (private, polls jobs:pending) ────────┘
```

**Data flow:** `api` stores metadata in Postgres, original file in MinIO, pushes a job onto the Valkey queue → `worker` pulls it, extracts text (pdf.js for PDFs, Tesseract OCR for images), chunks into ~600-char page-scoped fragments, indexes them in Meilisearch, and marks the document `ready` → the frontend searches Meilisearch via `api` (cached in Valkey) and answers questions with cited passages.

**Chat needs no LLM key** — a zero-dependency extractive answer quotes the best-matching passage. Set `OPENAI_API_KEY` to switch to grounded LLM answers with `[n]` citations.

## Run it locally (macOS / Linux)

Needs: Node 20+, and local `postgresql@16`, `valkey`, `meilisearch`, `minio` (via `brew` or Docker).

```bash
npm run setup          # install all workspaces
npm run build          # compile api + worker, export static web
npm run dev:services   # start api + worker (schema auto-migrates at api startup)
```

Local env defaults (matching the Zerops variable references):

```
DB_CONNECTION=postgresql://pt_user:pt_pass@127.0.0.1:5432/papertrail
CACHE_URL=redis://127.0.0.1:6379
MEILI_URL=http://127.0.0.1:7700
MEILI_KEY=testMasterKey
S3_ENDPOINT=http://127.0.0.1:9000  S3_ACCESS_KEY_ID=minioadmin  S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=papertrail  TESSDATA_PATH=./assets/tesseract
```

## Deploy to Zerops

1. In the Zerops GUI: **Import services → zerops-import.yaml** — creates all 7 services (3 runtime + 4 managed) with the right types and access flags.
2. Connect the GitHub repo (or push via zcli) — `zerops.yaml` builds each service: static web export, Fastify API (health-checked on `/healthz`), worker with bundled Tesseract data.
3. Managed service credentials flow automatically via `$db_connectionString`, `$cache_connectionString`, `$meili_defaultAdminKey`, `$storage_*`, and the public API URL via `$api_zeropsSubdomain`.

## Live deployment

- Frontend: <https://web-2d61.prg1.zerops.app>
- API (health): <https://api-2d61-3000.prg1.zerops.app/healthz>
- Demo login: `judge_demo` / `demopass123` — the **Product Docs** collection already contains 3 processed documents (PDF with OCR, Markdown, invoice text). Try the typo-ridden search `refun polcy` and the chat question "What is the refund policy?".
- Stack: 7 services live on Zerops (`web`, `api`, `worker` runtime + `db`, `cache`, `meili`, `storage` managed).

## Sample documents

`samples/` contains a 2-page PDF (page 2 = refund policy — demo the "What is the refund policy?" question), a Markdown getting-started guide, and an invoice text file.

## AI disclosure (rule 12)

This project was developed with the assistance of AI coding tools. All logic, extraction, chunking, retrieval, and answer generation code was reviewed and validated by a human. The in-app chat uses extractive retrieval by default (no external LLM); the optional `OPENAI_API_KEY` mode is clearly labeled in the UI and disclosed here.

/////////////////////////// 
Option A — instant demo: Log in with the account that already has processed docs:
- username: judge_demo / password: demopass123
- Open Product docs → 8 ready documents → search refun polcy (typos!) → chat "What is the refund policy?"


Option B — full flow from scratch:
1. Register → create a collection → upload the 3 files in ~/papertrail/samples/ (PDF, .md, .txt)
2. Watch each row tick queued → processing → ready
3. Search + chat as above
