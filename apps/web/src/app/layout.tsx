import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PaperTrail — Searchable knowledge from messy documents',
  description:
    'Upload PDFs, notes and screenshots. PaperTrail OCRs, indexes and answers questions from your documents — deployed on Zerops.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
