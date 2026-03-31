import { SkeletonCard, SkeletonChart } from '@/components/Skeleton';

export default function BlogDetailLoading() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <SkeletonChart height={40} />
      <SkeletonCard lines={5} />
      <SkeletonCard lines={3} />
    </div>
  );
}
