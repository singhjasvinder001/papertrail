import type { FastifyInstance } from 'fastify';
import { pool } from '../config.js';
import { createSession, destroySession, hashPassword, verifyPassword } from '../auth.js';
import type { AuthedRequest } from '../auth.js';

const USERNAME_RE = /^[a-z0-9_-]{3,24}$/;

export function registerAuthRoutes(fastify: FastifyInstance): void {
  fastify.post<{ Body: { username?: string; password?: string } }>(
    '/auth/register',
    { config: { public: true } },
    async (req, reply) => {
      const username = (req.body?.username ?? '').trim().toLowerCase();
      const password = req.body?.password ?? '';

      if (!USERNAME_RE.test(username)) {
        return reply.code(400).send({ error: 'Username must be 3-24 chars: lowercase letters, numbers, _ or -' });
      }
      if (password.length < 8) {
        return reply.code(400).send({ error: 'Password must be at least 8 characters' });
      }

      const exists = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
      if (exists.rowCount) {
        return reply.code(409).send({ error: 'Username already taken' });
      }

      const { rows } = await pool.query<{ id: string }>(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
        [username, await hashPassword(password)]
      );
      const token = await createSession(rows[0].id);
      return reply.code(201).send({ token, user: { id: rows[0].id, username } });
    }
  );

  fastify.post<{ Body: { username?: string; password?: string } }>(
    '/auth/login',
    { config: { public: true } },
    async (req, reply) => {
      const username = (req.body?.username ?? '').trim().toLowerCase();
      const password = req.body?.password ?? '';

      const { rows } = await pool.query<{ id: string; password_hash: string }>(
        'SELECT id, password_hash FROM users WHERE username = $1',
        [username]
      );
      if (rows.length === 0 || !(await verifyPassword(password, rows[0].password_hash))) {
        return reply.code(401).send({ error: 'Invalid username or password' });
      }
      const token = await createSession(rows[0].id);
      return reply.send({ token, user: { id: rows[0].id, username } });
    }
  );

  fastify.post('/auth/logout', async (req, reply) => {
    const token = (req.headers.authorization ?? '').slice(7).trim();
    await destroySession(token);
    return reply.send({ ok: true });
  });

  fastify.get('/me', async (req, reply) => {
    const user = (req as AuthedRequest).user;
    const { rows } = await pool.query<{ collections: string; documents: string }>(
      `SELECT
         (SELECT count(*) FROM collections WHERE owner_id = $1)::text AS collections,
         (SELECT count(*) FROM documents WHERE owner_id = $1)::text AS documents`,
      [user.id]
    );
    return reply.send({ user, stats: rows[0] });
  });
}
