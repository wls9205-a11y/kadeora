'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// C-4: noindex — 이 페이지는 /discuss로 리다이렉트만 하는 페이지
export default function DiscussionRoomPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/discuss'); }, [router]);
  return (
    <>
      <meta name="robots" content="noindex, nofollow" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-tertiary)', fontSize: 14 }}>
        라운지로 이동 중...
      </div>
    </>
  );
}
