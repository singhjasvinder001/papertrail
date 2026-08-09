import type { PageText } from './config.js';

export interface Fragment {
  id: string;
  collectionId: string;
  documentId: string;
  title: string;
  page: number | null;
  chunkIndex: number;
  text: string;
}

const TARGET_CHARS = 600;
const OVERLAP_CHARS = 120;

/**
 * Split per-page text into overlapping fragments. Fragments never cross page
 * boundaries so every hit keeps an exact page citation for the UI.
 */
export function chunkPages(
  pages: PageText[],
  opts: { collectionId: string; documentId: string; title: string }
): Fragment[] {
  const fragments: Fragment[] = [];
  let chunkIndex = 0;

  for (const page of pages) {
    const words = page.text.split(' ');
    let buffer: string[] = [];
    let bufferChars = 0;

    const flush = () => {
      if (buffer.length === 0) return;
      const text = buffer.join(' ').trim();
      if (text.length < 40) return; // drop meaningless fragments
      fragments.push({
        id: `${opts.documentId}-${chunkIndex}`,
        collectionId: opts.collectionId,
        documentId: opts.documentId,
        title: opts.title,
        page: page.page || null,
        chunkIndex,
        text,
      });
      chunkIndex++;
      // overlap: keep the tail words of the emitted fragment
      let overlap: string[] = [];
      let overlapChars = 0;
      for (let i = buffer.length - 1; i >= 0; i--) {
        overlap.unshift(buffer[i]);
        overlapChars += buffer[i].length + 1;
        if (overlapChars >= OVERLAP_CHARS) break;
      }
      buffer = [...overlap];
      bufferChars = overlapChars;
    };

    for (const word of words) {
      buffer.push(word);
      bufferChars += word.length + 1;
      if (bufferChars >= TARGET_CHARS) flush();
    }
    flush();
  }

  return fragments;
}
