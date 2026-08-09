'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { CollectionView } from '@/components/CollectionView';

export default function CollectionPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm text-slate-500">Loading collection…</div>}>
      <CollectionInner />
    </Suspense>
  );
}

function CollectionInner() {
  const params = useSearchParams();
  const id = params.get('id');
  if (!id) {
    return <div className="p-10 text-center text-sm text-slate-500">No collection selected.</div>;
  }
  return <CollectionView collectionId={id} />;
}
