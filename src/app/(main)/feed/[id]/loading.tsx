import { SkeletonCard } from '@/components/Skeleton';

export default function Loading() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <SkeletonCard lines={5} />
      <SkeletonCard lines={2} />
      <SkeletonCard lines={2} />
    </div>
  );
}
