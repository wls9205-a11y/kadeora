import { SkeletonList } from '@/components/Skeleton';

export default function Loading() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px' }}>
      <SkeletonList count={8} type="stock" />
    </div>
  );
}
