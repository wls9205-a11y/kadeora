'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DiscussionRoomPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/discuss'); }, [router]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-tertiary)', fontSize: 14 }}>
      라운지로 이동 중...
    </div>
  );
}
