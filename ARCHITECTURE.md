# Architecture

## Services

### web — Next.js 14 static export
- `apps/web`, built with `output: 'export'` → fully static site served by Zerops' managed Nginx.
- Dark, responsive UI: landing, login/register, dashboard, per-collection view with upload, search, and chat.
- The collection view lives at `/app/c?id=...` (query param) because static export cannot pre-render dynamic `[id]` routes.
- Talks to the API via `NEXT_PUBLIC_API_URL`, which resolves to `$api_zeropsSubdomain` at build time.

### api — Fastify 4
Routes:
- `POST /auth/register`, `POST /auth/login` — bcryptjs hashed passwords; sessions are 32-byte random tokens stored in Postgres with a Valkey fast-path (`session:{token}` → userId, 30-day TTL).
- `POST /collections` · `GET /collections` · `GET /collections/:id` · `DELETE /collections/:id`
- `POST /collections/:id/documents` — multipart upload → Postgres row + original file to MinIO (`PUT /{collection}/{doc}/{file}`) + job pushed to Valkey `jobs:pending`.
- `GET /collections/:id/documents` · `GET /documents/:docId` (with fragments) · `DELETE /documents/:docId`
- `POST /collections/:id/search` — Meilisearch with `collectionId` filter; identical queries cached in Valkey for 5 min; queries are lowercased and punctuation-trimmed before hitting the index (Meilisearch stopword matching is case-sensitive, so `What is…` must become `what is…`).
- `POST /collections/:id/chat` — same retrieval; extractive answer by default, optional LLM answer if `OPENAI_API_KEY` is set.
- `GET /healthz` — probes Postgres + Valkey; used for Zerops health/readiness checks.

### worker — processing pipeline (private service)
- Polls `jobs:pending` with `BRPOP`; processes one document at a time (no external task queue needed — Valkey is the queue).
- **PDF**: pdf.js (legacy build, `standardFontDataUrl` bundled) → per-page text.
- **Images**: Tesseract.js with `eng.traineddata` fetched at build time to `assets/tesseract/` (Alpine-safe: pure JS, no native `tesseract` binary needed).
- **Text/markdown**: raw UTF-8.
- Chunking: ~600-char fragments scoped to a page, keeping paragraph boundaries; fragment id = `{docId}-{chunkIndex}`.
- Indexes into Meilisearch `fragments` (primary key `id`, filterable `collectionId`/`documentId`, sortable `chunkIndex`, stopwords for question words, displayed attrs trimmed) and marks the document `ready`.
- Idempotent: re-running a document replaces its fragments (filtered delete + re-add).

### db — PostgreSQL 16 (managed)
Tables: `users`, `collections`, `documents` (`queued|processing|ready|failed`, S3 `object_key`), plus a `schema_migrations` marker. Migrations run idempotently at API startup.

### cache — Valkey 7.2 (managed)
- `jobs:pending` list (LPUSH/BRPOP) — decouples API from worker, survives restarts.
- `search:{collection}:{query}:{limit}` — 300s TTL read cache.

### meili — Meilisearch 1.20 (managed)
- `fragments` index. Typo tolerance is on, so "refun polcy" still finds the refund policy.

### storage — MinIO object storage (managed)
- Original files keyed `{collectionId}/{documentId}/{filename}`, private bucket accessed by API and worker over the internal network.

## Zero-config service wiring
Zerops generates per-service env variables on the private network, referenced directly in `zerops.yaml`:

| API/worker env | Zerops reference | Resolves to |
|---|---|---|
| `DB_CONNECTION` | `$db_connectionString` | `postgresql://db:...@db:5432/db` |
| `CACHE_URL` | `$cache_connectionString` | `redis://cache:...@cache:6379` |
| `MEILI_URL` | — | `http://meili:7700` (internal DNS) |
| `MEILI_KEY` | `$meili_defaultAdminKey` | managed admin key |
| `S3_*` | `$storage_apiUrl` / `$storage_accessKeyId` / `$storage_secretAccessKey` / `$storage_bucketName` | MinIO endpoint + credentials |
| `NEXT_PUBLIC_API_URL` (web build) | `$api_zeropsSubdomain` | `https://api-<project>.zerops.app` |

## Failure modes handled
- Meilisearch must be recreated → worker re-ensures index settings on boot; documents re-uploadable.
- Worker crash mid-job → document stays `processing`; API startup re-queues stale jobs (idempotent re-index).
- Search cache poisoning → empty results cached during debugging were the cause of a real bug; fixed by query normalization (lowercase + trailing-punctuation trim) and cache invalidation on document changes.
