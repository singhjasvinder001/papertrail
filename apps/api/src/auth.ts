import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { cache, pool } from './config.js';
import type { UserRow } from './config.js';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await pool.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, userId]);
  await cache.setex(`session:${token}`, SESSION_TTL_SECONDS, userId);
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
  await cache.del(`session:${token}`);
}

async function userIdForToken(token: string): Promise<string | null> {
  // Fast path: Valkey-cached session
  const cached = await cache.get(`session:${token}`);
  if (cached) return cached;
  // Slow path: Postgres
  const { rows } = await pool.query<{ user_id: string }>('SELECT user_id FROM sessions WHERE token = $1', [token]);
  if (rows.length === 0) return null;
  // Warm the cache for subsequent requests
  await cache.setex(`session:${token}`, SESSION_TTL_SECONDS, rows[0].user_id);
  return rows[0].user_id;
}

export interface AuthedRequest extends FastifyRequest {
  user: UserRow;
}

declare module 'fastify' {
  interface FastifyContextConfig {
    /** Marks a route as reachable without authentication. */
    public?: boolean;
  }
}

/** Fastify plugin: authenticates Bearer tokens and attaches request.user. */
export function registerAuth(fastify: FastifyInstance): void {
  fastify.decorateRequest('user', null);

  fastify.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.routeOptions.config?.public) return;
    const header = req.headers.authorization ?? '';
    if (!header.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing authorization header' });
    }
    const token = header.slice(7).trim();
    const userId = await userIdForToken(token);
    if (!userId) {
      return reply.code(401).send({ error: 'Invalid or expired session' });
    }
    const { rows } = await pool.query<UserRow>('SELECT id, username FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) {
      return reply.code(401).send({ error: 'Invalid or expired session' });
    }
    (req as AuthedRequest).user = rows[0];
  });
}

export function isPublic(fastify: FastifyInstance, opts: { public?: boolean } = {}): void {
  void opts;
  void fastify;
}
