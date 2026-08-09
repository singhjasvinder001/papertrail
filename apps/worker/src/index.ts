import {
  cache,
  downloadObject,
  ensureIndex,
  meili,
  MEILI_INDEX,
  pool,
  QUEUE_KEY,
  type DocumentRow,
} from './config.js';
import { extractText } from './extract.js';
import { chunkPages } from './chunk.js';

const MAX_ATTEMPTS = 3;
let shuttingDown = false;

async function setStatus(docId: string, status: string, error: string | null = null, extra: Record<string, unknown> = {}) {
  const keys = Object.keys(extra);
  const setClause = keys.length
    ? `status = $2, error = $3, updated_at = now(), ${keys.map((k, i) => `${k} = $${i + 4}`).join(', ')}`
    : `status = $2, error = $3, updated_at = now()`;
  await pool.query(`UPDATE documents SET ${setClause} WHERE id = $1`, [docId, status, error, ...keys.map((k) => extra[k])]);
}

async function processJob(payload: { documentId: string }, attempt: number): Promise<void> {
  const { documentId } = payload;

  const { rows } = await pool.query<DocumentRow>('SELECT * FROM documents WHERE id = $1', [documentId]);
  if (rows.length === 0) {
    console.log(`[worker] document ${documentId} not found — skipping`);
    return;
  }
  const doc = rows[0];

  console.log(`[worker] processing ${doc.filename} (${doc.id}) attempt ${attempt}`);
  await setStatus(doc.id, 'processing');

  try {
    // 1. Pull the original file from object storage
    const data = await downloadObject(doc.object_key);

    // 2. Extract text (PDF → pdf.js, images → OCR, everything else → raw)
    const pages = await extractText(doc.mime_type, data);
    const charCount = pages.reduce((sum, p) => sum + p.text.length, 0);
    if (charCount < 10) {
      throw new Error('No text could be extracted from this file');
    }

    // 3. Chunk into page-scoped fragments
    const fragments = chunkPages(pages, {
      collectionId: doc.collection_id,
      documentId: doc.id,
      title: doc.filename,
    });
    if (fragments.length === 0) {
      throw new Error('Text extracted, but no searchable fragments were produced');
    }

    // 4. Re-index into Meilisearch (delete previous fragments first for idempotency)
    await meili.index(MEILI_INDEX).deleteDocuments({ filter: `documentId = "${doc.id}"` });
    const task = await meili.index(MEILI_INDEX).addDocuments(fragments);
    await meili.index(MEILI_INDEX).waitForTask(task.taskUid, { timeOutMs: 30_000 });

    // 5. Mark ready
    const pageCount = Math.max(...fragments.map((f) => f.page ?? 0));
    await setStatus(doc.id, 'ready', null, { page_count: pageCount || null, char_count: charCount });
    console.log(`[worker] done ${doc.filename} — ${fragments.length} fragments, ${charCount} chars`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker] failed ${doc.filename}: ${message}`);
    if (attempt < MAX_ATTEMPTS) {
      // Re-enqueue for a retry with a small delay
      setTimeout(() => {
        void cache.lpush(QUEUE_KEY, JSON.stringify({ documentId: doc.id })).catch(() => {});
      }, 2_000 * attempt);
    } else {
      await setStatus(doc.id, 'failed', message.slice(0, 500));
    }
  }
}

async function main(): Promise<void> {
  await ensureIndex();
  console.log('[worker] PaperTrail worker online — watching queue', QUEUE_KEY);

  while (!shuttingDown) {
    let raw: string | null = null;
    try {
      // Blocking pop with a 5s timeout — cheap when the queue is empty
      const result = await cache.brpop(QUEUE_KEY, 5);
      raw = result?.[1] ?? null;
    } catch (err) {
      console.error('[worker] queue error', err);
      await new Promise((r) => setTimeout(r, 2_000));
      continue;
    }

    if (!raw) continue;

    try {
      const payload = JSON.parse(raw) as { documentId: string };
      if (!payload.documentId) throw new Error('malformed job');
      await processJob(payload, 1);
    } catch (err) {
      console.error('[worker] malformed job', raw, err);
    }
  }

  console.log('[worker] shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => {
  shuttingDown = true;
  setTimeout(() => process.exit(1), 15_000).unref();
});
process.on('SIGINT', () => {
  shuttingDown = true;
});

main().catch((err) => {
  console.error('[worker] fatal', err);
  process.exit(1);
});
