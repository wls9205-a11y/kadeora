'use client';
// metadata is in layout or handled by redirect

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DailyRedirect() {
  const router = useRouter();
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('daily_region') : null;
    router.replace(`/daily/${encodeURIComponent(saved || '서울')}`);
  }, [router]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-tertiary)', fontSize: 14 }}>
      리포트 로딩 중...
    </div>
  );
}
