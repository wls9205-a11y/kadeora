import { SkeletonList } from '@/components/Skeleton';

export default function Loading() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <SkeletonList count={4} type="card" />
    </div>
  );
}
