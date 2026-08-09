import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createWorker } from 'tesseract.js';
import type { PageText } from './config.js';

/** Extract per-page text from a PDF buffer (pdf.js legacy build — pure JS, alpine-safe). */
export async function extractPdfPages(data: Buffer): Promise<PageText[]> {
  const doc = await getDocument({
    data: new Uint8Array(data),
    standardFontDataUrl: new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url).href,
  }).promise;
  try {
    const pages: PageText[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => {
          if ('str' in item) return item.str as string;
          return '';
        })
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text.length > 0) pages.push({ page: i, text });
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}

let ocrWorker: Awaited<ReturnType<typeof createWorker>> | null = null;

/** OCR an image (png/jpeg/webp) into a single page of text. */
export async function ocrImage(data: Buffer): Promise<PageText[]> {
  if (!ocrWorker) {
    ocrWorker = await createWorker('eng', 1, {
      // Offline-first: load trained data from the packaged assets when available,
      // otherwise fall back to tesseract.js' default CDN.
      ...(process.env.TESSDATA_PATH
        ? {
            langPath: process.env.TESSDATA_PATH,
            corePath: process.env.TESSDATA_PATH,
            gzip: true,
          }
        : { gzip: true }),
    });
  }
  const { data: result } = await ocrWorker.recognize(data);
  const text = (result.text ?? '').replace(/\s+/g, ' ').trim();
  return text.length > 0 ? [{ page: 0, text }] : [];
}

/** Extract text based on MIME type. */
export async function extractText(mimeType: string, data: Buffer): Promise<PageText[]> {
  switch (mimeType) {
    case 'application/pdf':
      return extractPdfPages(data);
    case 'image/png':
    case 'image/jpeg':
    case 'image/webp':
      return ocrImage(data);
    default:
      // Plain text formats
      const text = data
        .toString('utf8')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .trim();
      return text.length > 0 ? [{ page: 0, text }] : [];
  }
}
