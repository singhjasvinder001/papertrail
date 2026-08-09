import type { FastifyInstance } from 'fastify';
import { cache, meili, MEILI_INDEX, pool, env } from '../config.js';
import type { AuthedRequest } from '../auth.js';
import type { CollectionRow } from '../config.js';

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

interface FragmentHit {
  id: string;
  collectionId: string;
  documentId: string;
  text: string;
  page: number | null;
  chunkIndex: number;
  title: string;
  _formatted?: { text?: string };
}

/** Meilisearch filter values that are strings must be double-quoted. */
const fq = (v: string) => `"${v}"`;

/**
 * Normalize a user query for Meilisearch: lowercase (stopwords like "what" are
 * lowercase and matching is case-sensitive) and trim trailing punctuation so
 * `policy?` searches as `policy`.
 */
const cleanQuery = (v: string) => v.toLowerCase().replace(/[?!.,;:"'`]+$/g, '').trim();

export function registerSearchRoutes(fastify: FastifyInstance): void {
  fastify.post<{ Params: { id: string }; Body: { q?: string; limit?: number } }>(
    '/collections/:id/search',
    async (req, reply) => {
      const user = (req as AuthedRequest).user;
      const collection = await getOwnedCollection(fastify, user.id, req.params.id);
      const q = cleanQuery(req.body?.q ?? '').slice(0, 300);
      const limit = Math.min(Math.max(req.body?.limit ?? 10, 1), 50);
      if (!q) {
        return reply.code(400).send({ error: 'Query "q" is required' });
      }

      // Cache identical queries for 5 minutes — Valkey as a read cache
      const cacheKey = `search:${collection.id}:${q.toLowerCase().slice(0, 100)}:${limit}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return reply.send({ ...JSON.parse(cached), fromCache: true });
      }

      const res = await meili.index(MEILI_INDEX).search<FragmentHit>(q, {
        filter: `collectionId = ${fq(collection.id)}`,
        limit,
        attributesToRetrieve: ['text', 'page', 'documentId', 'chunkIndex', 'title'],
        attributesToHighlight: ['text'],
        highlightPreTag: '<mark>',
        highlightPostTag: '</mark>',
      });

      const hits = res.hits.map((h) => ({
        id: h.id,
        documentId: h.documentId,
        title: h.title,
        page: h.page,
        chunkIndex: h.chunkIndex,
        text: h.text,
        highlighted: h._formatted?.text ?? h.text,
      }));

      const body = { query: q, hits, estimatedTotalHits: res.estimatedTotalHits, fromCache: false };
      await cache.setex(cacheKey, 300, JSON.stringify({ query: q, hits, estimatedTotalHits: res.estimatedTotalHits }));
      return reply.send(body);
    }
  );

  fastify.post<{ Params: { id: string }; Body: { question?: string } }>(
    '/collections/:id/chat',
    async (req, reply) => {
      const user = (req as AuthedRequest).user;
      const collection = await getOwnedCollection(fastify, user.id, req.params.id);
      const raw = (req.body?.question ?? '').trim().slice(0, 500);
      if (!raw) {
        return reply.code(400).send({ error: 'Question is required' });
      }
      const question = raw; // keep original case for display/answer
      const searchQ = cleanQuery(question); // lowercase + punctuation-free for Meilisearch

      const res = await meili.index(MEILI_INDEX).search<FragmentHit>(searchQ, {
        filter: `collectionId = ${fq(collection.id)}`,
        limit: 6,
        attributesToRetrieve: ['text', 'page', 'documentId', 'chunkIndex', 'title'],
      });

      const sources = res.hits.map((h) => ({
        documentId: h.documentId,
        title: h.title,
        page: h.page,
        text: h.text.slice(0, 600),
      }));

      let answer: string;

      if (env.openaiApiKey) {
        // LLM-assisted grounded answer
        const context = sources.map((s, i) => `[${i + 1}] (${s.title}${s.page ? `, page ${s.page}` : ''})\n${s.text}`).join('\n\n');
        const llm = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.openaiApiKey}` },
          body: JSON.stringify({
            model: env.openaiModel,
            temperature: 0.2,
            messages: [
              {
                role: 'system',
                content:
                  'You answer questions strictly from the provided document excerpts. ' +
                  'Cite sources using [n] markers. If the excerpts do not contain the answer, say so plainly.',
              },
              { role: 'user', content: `Question: ${question}\n\nExcerpts:\n${context}` },
            ],
          }),
        });
        if (llm.ok) {
          const data = (await llm.json()) as { choices?: { message?: { content?: string } }[] };
          answer = data.choices?.[0]?.message?.content ?? 'No answer could be generated.';
        } else {
          answer = extractiveAnswer(question, sources);
        }
      } else {
        // Zero-dependency extractive answer — works without any LLM API key
        answer = extractiveAnswer(question, sources);
      }

      return reply.send({ question, answer, sources, mode: env.openaiApiKey ? 'llm' : 'extractive' });
    }
  );
}

function extractiveAnswer(question: string, sources: { title: string; page: number | null; text: string }[]): string {
  if (sources.length === 0) {
    return 'No matching content found in this collection. Try uploading documents first.';
  }
  const best = sources[0];
  const quote = best.text.length > 500 ? best.text.slice(0, 500) + '…' : best.text;
  const loc = best.page ? `page ${best.page} of "${best.title}"` : `"${best.title}"`;
  return `Based on ${loc}, the most relevant passage is:\n\n“${quote}”\n\nThis answer is extractive — ${sources.length} passage${sources.length > 1 ? 's were' : ' was'} retrieved by full-text search on your question "${question}". Add an OpenAI API key (OPENAI_API_KEY) to get a generated, grounded answer instead.`;
}
