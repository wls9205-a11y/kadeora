'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { haptic } from '@/lib/haptic';

export default function RefreshButton() {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  const handleRefresh = () => {
    if (spinning) return;
    haptic('light');
    setSpinning(true);
    router.refresh();
    setTimeout(() => setSpinning(false), 700);
  };

  return (
    <button onClick={handleRefresh} aria-label="새로고침"
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: 'transform 0.65s ease', transform: spinning ? 'rotate(360deg)' : 'rotate(0deg)' }}>
        <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
      </svg>
    </button>
  );
}
