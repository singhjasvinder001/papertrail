import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { MeiliSearch } from 'meilisearch';

export const env = {
  port: Number(process.env.PORT ?? 3000),
  dbConnection: process.env.DB_CONNECTION ?? 'postgresql://postgres:postgres@localhost:5432/papertrail',
  cacheUrl: process.env.CACHE_URL ?? 'redis://localhost:6379',
  meiliUrl: process.env.MEILI_URL ?? 'http://localhost:7700',
  meiliKey: process.env.MEILI_KEY ?? '',
  s3Endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? 'minioadmin',
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? 'minioadmin',
  s3Bucket: process.env.S3_BUCKET ?? 'papertrail',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  // Upload limits
  maxFileSizeBytes: 25 * 1024 * 1024,
};

export const MEILI_INDEX = 'fragments';

export const pool = new Pool({
  connectionString: env.dbConnection,
  max: 10,
  idleTimeoutMillis: 30_000,
});

export const cache = new Redis(env.cacheUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 200, 2000),
});

export const s3 = new S3Client({
  endpoint: env.s3Endpoint,
  region: 'us-east-1',
  credentials: { accessKeyId: env.s3AccessKeyId, secretAccessKey: env.s3SecretAccessKey },
  forcePathStyle: true,
});

export const meili = new MeiliSearch({ host: env.meiliUrl, apiKey: env.meiliKey || undefined });

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  await s3.send(new PutObjectCommand({ Bucket: env.s3Bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function deleteObject(key: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: env.s3Bucket, Key: key }));
  } catch (err) {
    console.error('[s3] delete failed', key, err);
  }
}

/** Initialize the database schema (idempotent — runs on every boot). */
export async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS collections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes BIGINT NOT NULL,
      object_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      error TEXT,
      page_count INT,
      char_count INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents(collection_id);
    CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
  `);
  await cache.ping();
}

export type SessionRow = { token: string; user_id: string };
export type UserRow = { id: string; username: string };
export type CollectionRow = { id: string; owner_id: string; name: string; description: string; created_at: Date };
export type DocumentRow = {
  id: string;
  collection_id: string;
  owner_id: string;
  filename: string;
  mime_type: string;
  size_bytes: string;
  object_key: string;
  status: string;
  error: string | null;
  page_count: number | null;
  char_count: number | null;
  created_at: Date;
  updated_at: Date;
};
