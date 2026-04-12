'use client';
import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);

  return (
    <div
      style={{ touchAction: 'pan-y' }}
      onTouchStart={e => { if (window.scrollY < 5) startY.current = e.touches[0].clientY; else startY.current = 0; }}
      onTouchMove={e => { if (!startY.current) return; const dy = e.touches[0].clientY - startY.current; if (dy > 0 && dy < 100 && window.scrollY < 5) setPullY(dy); }}
      onTouchEnd={() => { if (pullY > 70) { setRefreshing(true); router.refresh(); setTimeout(() => { setRefreshing(false); setPullY(0); }, 800); } else { setPullY(0); } startY.current = 0; }}
    >
      {(pullY > 10 || refreshing) && (
        <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 8px)', left: '50%', transform: 'translateX(-50%)', zIndex: 100, width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: refreshing ? 'spin 0.7s linear infinite' : 'none', transform: refreshing ? undefined : `rotate(${pullY * 3}deg)` }} />
        </div>
      )}
      {children}
    </div>
  );
}
