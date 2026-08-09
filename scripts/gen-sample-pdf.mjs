// Generates a small but *valid* PDF sample for the demo (correct xref offsets).
// Run: node scripts/gen-sample-pdf.mjs  →  writes samples/product-spec.pdf
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '..', 'samples', 'product-spec.pdf');

const pages = [
  [
    'PaperTrail Product Specification v1.0',
    '',
    'Overview',
    'PaperTrail is a document intelligence platform. Users upload PDFs, notes and',
    'screenshots; the platform extracts text, builds a searchable index and answers',
    'questions with citations back to the exact page of the source document.',
    '',
    'Core architecture',
    'The system is composed of seven services deployed on Zerops: a static frontend',
    '(Next.js on managed Nginx), a Fastify API runtime, a Node worker that performs',
    'OCR and text extraction, a PostgreSQL database, a Valkey job queue and cache, a',
    'Meilisearch full-text index and an S3-compatible object store for originals.',
    '',
    'The worker consumes jobs from the Valkey queue using a blocking BRPOP call.',
    'Each document is chunked into overlapping fragments that never cross page',
    'boundaries, so every search hit keeps an exact page citation.',
  ],
  [
    'Pricing and refunds',
    '',
    'PaperTrail offers a free tier with 3 collections and 50 documents per month.',
    'The Pro plan costs 9 euros per month and includes unlimited collections,',
    'OCR for image documents and priority processing.',
    '',
    'Refund policy',
    'All paid plans are covered by a 30-day money-back guarantee from the date of',
    'purchase. Refunds are processed within 5 business days of the request and are',
    'returned to the original payment method. Annual plans are refunded pro-rata',
    'for the unused portion after the first 30 days.',
    '',
    'Data retention',
    'Documents are stored in object storage with AES-256 encryption at rest. Users',
    'may export or permanently delete their data at any time from the settings page.',
  ],
];

// Build PDF objects
const pageObjects = [];
for (let i = 0; i < pages.length; i++) {
  const lines = pages[i];
  const stream = lines.map((l) => `(${escapePdf(l)}) Tj 0 -18 Td`).join('\n');
  const content = `BT\n/F1 12 Tf\n72 720 Td\n${stream}\nET`;
  pageObjects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${4 + i * 2} 0 R /Resources << /Font << /F1 6 0 R >> >> >>`);
  pageObjects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
}
const objects = [];
objects.push('<< /Type /Catalog /Pages 2 0 R >>');
objects.push(`<< /Type /Pages /Kids [${pageObjects
  .filter((_, i) => i % 2 === 0)
  .map((_, i) => `${3 + i * 2} 0 R`)
  .join(' ')}] /Count ${pages.length} >>`);
objects.push(...pageObjects);
objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

// Serialize with offsets
let pdf = '%PDF-1.4\n';
const offsets = [];
const bodyStart = Buffer.byteLength(pdf);
let cursor = bodyStart;
for (let i = 0; i < objects.length; i++) {
  offsets.push(cursor);
  const obj = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  pdf += obj;
  cursor = Buffer.byteLength(pdf);
}
const xrefOffset = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const o of offsets) {
  pdf += `${String(o).padStart(10, '0')} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

writeFileSync(outPath, pdf);
console.log(`wrote ${outPath} (${pdf.length} bytes)`);

function escapePdf(s) {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
