// Generates a simple BMP test image with blocky text (no dependencies)
// Usage: node scripts/gen-test-image.mjs out.bmp
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = process.argv[2] ?? join(__dirname, '..', 'test-ocr-input.bmp');

// 5x7 bitmap font (uppercase + digits)
const FONT = {
  H: [0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001, 0b10001],
  E: [0b11111, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000, 0b11111],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  '2': [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  '0': [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  '6': [0b01110, 0b10000, 0b11110, 0b10001, 0b10001, 0b10001, 0b01110],
  ' ': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000],
};

const text = 'HELLO WORLD 2026';
const cellW = 6, cellH = 8, scale = 14;
const W = (text.length * cellW + 1) * scale;
const H = 7 * cellH * scale;

// BMP: 24-bit BGR, rows bottom-up, padded to 4 bytes
const rowSize = Math.ceil((W * 3) / 4) * 4;
const pixels = Buffer.alloc(H * rowSize);
for (let py = 0; py < H; py++) {
  const glyphRow = Math.floor(py / (cellH * scale));
  const glyphY = Math.floor((py % (cellH * scale)) / scale);
  if (glyphRow > 6) continue;
  for (let px = 0; px < W; px++) {
    const charIndex = Math.floor(px / (cellW * scale));
    const glyphX = Math.floor((px % (cellW * scale)) / scale);
    const ch = text[charIndex] ?? ' ';
    const bits = FONT[ch] ?? FONT[' '];
    const on = (bits[glyphY] >> (4 - glyphX)) & 1;
    const value = on ? 0 : 255; // black text on white
    const destRow = H - 1 - py; // bottom-up
    const off = destRow * rowSize + px * 3;
    pixels[off] = value;     // B
    pixels[off + 1] = value; // G
    pixels[off + 2] = value; // R
  }
}

const fileSize = 54 + rowSize * H;
const header = Buffer.alloc(54);
header.write('BM', 0, 'ascii');
header.writeUInt32LE(fileSize, 2);
header.writeUInt32LE(54, 10);
header.writeUInt32LE(40, 14);
header.writeInt32LE(W, 18);
header.writeInt32LE(H, 22);
header.writeUInt16LE(1, 26);
header.writeUInt16LE(24, 28);
header.writeUInt32LE(0, 30);
header.writeUInt32LE(rowSize * H, 34);
header.writeInt32LE(2835, 38);
header.writeInt32LE(2835, 42);

writeFileSync(outPath, Buffer.concat([header, pixels]));
console.log(`wrote ${outPath} (${W}x${H}, ${fileSize} bytes)`);
