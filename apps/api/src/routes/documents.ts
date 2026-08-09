import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { cache, env, meili, MEILI_INDEX, pool, putObject, deleteObject } from '../config.js';
import type { AuthedRequest } from '../auth.js';
import type { CollectionRow, DocumentRow } from '../config.js';

const QUEUE_KEY = 'jobs:pending';

const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

async function getOwnedCollection(fastify: FastifyInstance, userId: string, id: string): Promise<CollectionRow> {
  const { rows } = await pool.query<CollectionRow>('SELECT * FROM collections WHERE id = $1 AND owner_id = $2', [
    id,
    userId,
  ]);
  if (rows.length === 0) {
    const err = new Error('Collection not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }
  return rows[0];
}

export function registerDocumentRoutes(fastify: FastifyInstance): void {
  // Multipart upload: one or more files per request
  fastify.post<{ Params: { id: string } }>('/collections/:id/documents', async (req, reply) => {
    const user = (req as AuthedRequest).user;
    const collection = await getOwnedCollection(fastify, user.id, req.params.id);
    const created: DocumentRow[] = [];

    for await (const part of req.parts()) {
      if (part.type !== 'file') continue;

      const filename = (part.filename ?? 'file').split('/').pop()?.split('\\').pop() ?? 'file';
      const ext = filename.split('.').pop()?.toLowerCase() ?? '';
      const mime = EXT_TO_MIME[ext];
      if (!mime) {
        return reply.code(400).send({ error: `Unsupported file type ".${ext}". Allowed: ${Object.keys(EXT_TO_MIME).join(', ')}` });
      }

      // Stream the upload into memory (bounded by the size limit)
      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of part.file) {
        total += chunk.length;
        if (total > env.maxFileSizeBytes) {
          return reply.code(413).send({ error: `"${filename}" exceeds the 25 MB limit` });
        }
        chunks.push(chunk);
      }
      const data = Buffer.concat(chunks);

      const documentId = randomUUID();
      const objectKey = `${collection.id}/${documentId}/${filename}`;

      const { rows } = await pool.query<DocumentRow>(
        `INSERT INTO documents (id, collection_id, owner_id, filename, mime_type, size_bytes, object_key, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'queued') RETURNING *`,
        [documentId, collection.id, user.id, filename, mime, data.length, objectKey]
      );

      // Original file → object storage
      await putObject(objectKey, data, mime);
      // Processing job → Valkey queue (consumed by the worker over the private network)
      await cache.lpush(QUEUE_KEY, JSON.stringify({ documentId }));

      created.push(rows[0]);
    }

    if (created.length === 0) {
      return reply.code(400).send({ error: 'No files provided (multipart field "files")' });
    }
    return reply.code(201).send({ documents: created });
  });

  fastify.get<{ Params: { id: string } }>('/collections/:id/documents', async (req, reply) => {
    const user = (req as AuthedRequest).user;
    await getOwnedCollection(fastify, user.id, req.params.id);
    const { rows } = await pool.query<DocumentRow>(
      'SELECT * FROM documents WHERE collection_id = $1 ORDER BY created_at DESC LIMIT 200',
      [req.params.id]
    );
    return reply.send({ documents: rows });
  });

  fastify.get<{ Params: { docId: string } }>('/documents/:docId', async (req, reply) => {
    const user = (req as AuthedRequest).user;
    const { rows } = await pool.query<DocumentRow>('SELECT * FROM documents WHERE id = $1 AND owner_id = $2', [
      req.params.docId,
      user.id,
    ]);
    if (rows.length === 0) {
      return reply.code(404).send({ error: 'Document not found' });
    }
    const doc = rows[0];

    // Pull indexed fragments back from Meilisearch for the detail view
    let fragments: unknown[] = [];
    try {
      const res = await meili.index(MEILI_INDEX).search('', {
        filter: `documentId = "${doc.id}"`,
        limit: 200,
        attributesToRetrieve: ['text', 'page', 'chunkIndex'],
        sort: ['chunkIndex:asc'],
      });
      fragments = res.hits;
    } catch {
      fragments = [];
    }

    return reply.send({ document: doc, fragments });
  });

  fastify.delete<{ Params: { docId: string } }>('/documents/:docId', async (req, reply) => {
    const user = (req as AuthedRequest).user;
    const { rows } = await pool.query<DocumentRow>('SELECT * FROM documents WHERE id = $1 AND owner_id = $2', [
      req.params.docId,
      user.id,
    ]);
    if (rows.length === 0) {
      return reply.code(404).send({ error: 'Document not found' });
    }
    const doc = rows[0];
    await deleteObject(doc.object_key);
    try {
      await meili.index(MEILI_INDEX).deleteDocuments({ filter: `documentId = "${doc.id}"` });
    } catch {
      // best effort
    }
    await pool.query('DELETE FROM documents WHERE id = $1', [doc.id]);
    return reply.send({ ok: true });
  });
}
