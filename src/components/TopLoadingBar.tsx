'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function TopLoadingBar() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // 페이지 전환 시작
    setLoading(true);
    setProgress(30);

    const t1 = setTimeout(() => setProgress(60), 100);
    const t2 = setTimeout(() => setProgress(80), 300);
    const t3 = setTimeout(() => {
      setProgress(100);
      setTimeout(() => { setLoading(false); setProgress(0); }, 200);
    }, 500);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [pathname]);

  if (!loading && progress === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
      height: 3, background: 'transparent', pointerEvents: 'none',
    }}>
      <div style={{
        height: '100%', background: 'var(--brand)',
        width: `${progress}%`,
        transition: progress === 100 ? 'width 0.2s, opacity 0.3s' : 'width 0.4s ease',
        opacity: progress === 100 ? 0 : 1,
        boxShadow: '0 0 8px rgba(37,99,235,0.5)',
      }} />
    </div>
  );
}
