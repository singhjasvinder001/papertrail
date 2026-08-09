import type { FastifyInstance } from 'fastify';
import { meili, MEILI_INDEX, pool } from '../config.js';
import type { AuthedRequest } from '../auth.js';
import type { CollectionRow } from '../config.js';

async function getOwnedCollection(fastify: FastifyInstance, userId: string, id: string) {
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

export function registerCollectionRoutes(fastify: FastifyInstance): void {
  fastify.get('/collections', async (req, reply) => {
    const user = (req as AuthedRequest).user;
    const { rows } = await pool.query<CollectionRow & { document_count: string; ready_count: string }>(
      `SELECT c.*,
              (SELECT count(*)::text FROM documents d WHERE d.collection_id = c.id) AS document_count,
              (SELECT count(*)::text FROM documents d WHERE d.collection_id = c.id AND d.status = 'ready') AS ready_count
       FROM collections c WHERE c.owner_id = $1 ORDER BY c.created_at DESC`,
      [user.id]
    );
    return reply.send({ collections: rows });
  });

  fastify.post<{ Body: { name?: string; description?: string } }>('/collections', async (req, reply) => {
    const user = (req as AuthedRequest).user;
    const name = (req.body?.name ?? '').trim();
    if (!name || name.length > 80) {
      return reply.code(400).send({ error: 'Collection name is required (max 80 chars)' });
    }
    const description = (req.body?.description ?? '').trim().slice(0, 300);
    const { rows } = await pool.query<CollectionRow>(
      'INSERT INTO collections (owner_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [user.id, name, description]
    );
    return reply.code(201).send({ collection: rows[0] });
  });

  fastify.get<{ Params: { id: string } }>('/collections/:id', async (req, reply) => {
    const user = (req as AuthedRequest).user;
    const collection = await getOwnedCollection(fastify, user.id, req.params.id);
    const { rows } = await pool.query<{ document_count: string; ready_count: string; processing_count: string }>(
      `SELECT
         (SELECT count(*)::text FROM documents d WHERE d.collection_id = $1) AS document_count,
         (SELECT count(*)::text FROM documents d WHERE d.collection_id = $1 AND d.status = 'ready') AS ready_count,
         (SELECT count(*)::text FROM documents d WHERE d.collection_id = $1 AND d.status IN ('queued','processing')) AS processing_count`,
      [collection.id]
    );
    return reply.send({ collection, stats: rows[0] });
  });

  fastify.delete<{ Params: { id: string } }>('/collections/:id', async (req, reply) => {
    const user = (req as AuthedRequest).user;
    const collection = await getOwnedCollection(fastify, user.id, req.params.id);

    // Remove index entries, then rows (object keys are deleted with documents individually)
    try {
      await meili.index(MEILI_INDEX).deleteDocuments({ filter: `collectionId = "${collection.id}"` });
    } catch (err) {
      fastify.log.warn({ err }, 'meili cleanup failed for collection');
    }
    await pool.query('DELETE FROM collections WHERE id = $1', [collection.id]);
    return reply.send({ ok: true });
  });
}
