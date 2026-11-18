import { lazy, Suspense } from 'react';

const SpecialMessageCard = lazy(() => import('./SpecialMessageCard'));

export default function LazySpecialMessageCard(props) {
  return (
    <Suspense fallback={<div className="specialMessageCard specialMessageLoading" role="status" aria-label="Loading attachment preview">Loading attachment…</div>}>
      <SpecialMessageCard {...props} />
    </Suspense>
  );
}
