'use client';
import { useRouter } from 'next/navigation';

export default function BackButton({ label = '← 뒤로' }: { label?: string }) {
  const router = useRouter();
  return (
    <button onClick={() => router.back()} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 'var(--fs-base)', color: 'var(--text-secondary)',
      background: 'var(--bg-hover)', border: 'none',
      borderRadius: 8, padding: '8px 12px', cursor: 'pointer', marginBottom: 16,
    }}>{label}</button>
  );
}
