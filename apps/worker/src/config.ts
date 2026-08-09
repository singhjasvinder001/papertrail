import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { MeiliSearch } from 'meilisearch';

export const env = {
  dbConnection: process.env.DB_CONNECTION ?? 'postgresql://postgres:postgres@localhost:5432/papertrail',
  cacheUrl: process.env.CACHE_URL ?? 'redis://localhost:6379',
  meiliUrl: process.env.MEILI_URL ?? 'http://localhost:7700',
  meiliKey: process.env.MEILI_KEY ?? '',
  s3Endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? 'minioadmin',
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? 'minioadmin',
  s3Bucket: process.env.S3_BUCKET ?? 'papertrail',
};

export const MEILI_INDEX = 'fragments';
export const QUEUE_KEY = 'jobs:pending';

export const pool = new Pool({
  connectionString: env.dbConnection,
  max: 5,
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

export async function downloadObject(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: env.s3Bucket, Key: key }));
  const stream = res.Body as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

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
};

/** Ensure the Meilisearch index exists with the right settings and primary key. */
export async function ensureIndex(): Promise<void> {
  try {
    const raw = await meili.index(MEILI_INDEX).getRawInfo();
    if (!raw.primaryKey) {
      // The index was auto-created without a primary key — recreate with explicit key.
      // (Fragments carry id + collectionId + documentId, so inference is ambiguous.)
      await meili.deleteIndex(MEILI_INDEX);
      await meili.createIndex(MEILI_INDEX, { primaryKey: 'id' });
    }
  } catch {
    await meili.createIndex(MEILI_INDEX, { primaryKey: 'id' });
  }
  const index = meili.index(MEILI_INDEX);
  await index.updateFilterableAttributes(['collectionId', 'documentId']);
  await index.updateSortableAttributes(['chunkIndex']);
  await index.updateDisplayedAttributes(['id', 'collectionId', 'documentId', 'title', 'page', 'chunkIndex', 'text']);
  // Question words would otherwise act as required search terms ("what is the refund policy?").
  await index.updateStopWords([
    'what', 'is', 'the', 'a', 'an', 'of', 'to', 'in', 'for', 'on', 'with', 'how', 'do', 'does', 'can',
    'are', 'was', 'were', 'and', 'or', 'at', 'by', 'from', 'this', 'that', 'it', 'its', 'my', 'your',
    'our', 'we', 'i', 'me', 'be', 'have', 'has', 'will', 'would', 'should', 'could', 'tell', 'give',
    'list', 'about', 'please', 'explain', 'summarize', 'describe',
  ]);
}

/** Per-page extracted text. */
export interface PageText {
  page: number;
  text: string;
}
