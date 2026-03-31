import { SkeletonList } from '@/components/Skeleton';

export default function SearchLoading() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <SkeletonList count={5} type="card" />
    </div>
  );
}
