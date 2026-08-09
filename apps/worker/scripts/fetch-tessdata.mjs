// Fetches the Tesseract English language data so OCR works offline in the
// runtime container. Run during the Zerops build (see zerops.yaml).
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const targetDir = join(__dirname, '..', 'assets', 'tesseract');
const targetFile = join(targetDir, 'eng.traineddata.gz');

const SOURCES = [
  'https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz',
  'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@4.0.0/eng.traineddata.gz',
];

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`[tessdata] downloaded ${dest} (${(res.headers.get('content-length') ?? '?')} bytes)`);
}

if (existsSync(targetFile)) {
  console.log('[tessdata] already present, skipping');
} else {
  await mkdir(targetDir, { recursive: true });
  for (const url of SOURCES) {
    try {
      await download(url, targetFile);
      break;
    } catch (err) {
      console.warn(`[tessdata] failed ${url}:`, err.message);
    }
  }
  if (!existsSync(targetFile)) {
    console.error('[tessdata] all mirrors failed — OCR will fall back to CDN at runtime');
    process.exit(0); // non-fatal: worker still runs, OCR uses CDN
  }
}
