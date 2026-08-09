# PaperTrail — Demo Script (90s video)

Run against the deployed app. Substitute `WEB` = web subdomain, `API` = api subdomain.

## 1. Register + create collection (~10s)
1. Open `<WEB>` → **Register** → `judge` / a strong password.
2. Click **+ New collection** → name it `Product docs`.
3. Note the empty state: *"No documents yet — upload your first file."*

## 2. Upload mixed formats (~20s)
1. Drag in all three files from `samples/`:
   - `product-spec.pdf` (2 pages — text layer)
   - `getting-started.md` (Markdown)
   - `invoice-sample.txt` (plain text)
2. Watch statuses tick `queued → processing → ready` live (worker on the private network; poll every 1s).
3. Open `product-spec.pdf` → fragments listed **in page order** with page numbers.

## 3. Typo-tolerant search (~10s)
In the search box type **`refun polcy`** (deliberate typos) → hits the refund-policy passage on page 2, highlighted.

## 4. Ask a question — no LLM key (~20s)
Chat: **"What is the refund policy?"** → extractive answer quoting page 2 with the 30-day money-back guarantee, labeled *"extractive — add an API key for generated answers"*.

## 5. Delete + scale-out story (~15s) — optional
1. Delete a document → it disappears from search instantly (fragments removed from Meili).
2. In the Zerops GUI, show the **7 services** running as separate containers (web, api, worker, db, cache, meili, storage) with their internal-network wiring.

## 6. Close (~5s)
Recap: *"Seven Zerops services — Postgres, Valkey queue, Meilisearch, object storage — connected by `$service_variable` wiring, no Dockerfiles, no K8s. Code on GitHub."*

## Recording tips
- Do steps 2–4 in one take; trim dead air.
- Zoom into the status pill `processing → ready` transition (that's the worker doing OCR + pdf.js extraction + chunking + indexing).
- End card: repo URL + live URL.
