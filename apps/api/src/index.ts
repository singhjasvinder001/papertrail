import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { env, migrate, pool, cache } from './config.js';
import { registerAuth } from './auth.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerCollectionRoutes } from './routes/collections.js';
import { registerDocumentRoutes } from './routes/documents.js';
import { registerSearchRoutes } from './routes/search.js';

async function main(): Promise<void> {
  console.log('[api] booting — db connection', env.dbConnection.replace(/:[^:@/]+@/, ':***@'));
  await migrate();
  console.log('[api] db + cache ready');

  const fastify = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
    bodyLimit: 2 * 1024 * 1024,
    requestTimeout: 30_000,
  });

  await fastify.register(cors, { origin: true });
  await fastify.register(multipart, {
    limits: { fileSize: env.maxFileSizeBytes, files: 20 },
    attachFieldsToBody: false,
  });

  registerAuth(fastify);
  registerAuthRoutes(fastify);
  registerCollectionRoutes(fastify);
  registerDocumentRoutes(fastify);
  registerSearchRoutes(fastify);

  fastify.get('/healthz', { config: { public: true } }, async () => {
    // Lightweight dependency check — used by Zerops health/readiness probes
    let dbOk = false;
    let cacheOk = false;
    try {
      await pool.query('SELECT 1');
      dbOk = true;
    } catch {
      dbOk = false;
    }
    try {
      await cache.ping();
      cacheOk = true;
    } catch {
      cacheOk = false;
    }
    return { ok: dbOk && cacheOk, db: dbOk, cache: cacheOk, service: 'papertrail-api', ts: Date.now() };
  });

  fastify.setErrorHandler((err, req, reply) => {
    const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500;
    if (statusCode >= 500) {
      req.log.error(err);
    }
    reply.code(statusCode).send({ error: statusCode >= 500 ? 'Internal server error' : err.message });
  });

  const stop = async () => {
    await fastify.close();
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  await fastify.listen({ host: '0.0.0.0', port: env.port });
}

main().catch((err) => {
  console.error('[api] fatal', err);
  process.exit(1);
});
