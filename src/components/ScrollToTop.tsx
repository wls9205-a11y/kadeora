'use client';
import { useState, useEffect } from 'react';

export default function ScrollToTop() {
  const [show, setShow] = useState(false);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      setShow(window.scrollY > 400);
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      if (docH > 0) setPct(Math.min(window.scrollY / docH, 1));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!show) return null;

  const r = 16, c = 2 * Math.PI * r;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="맨 위로 스크롤"
      style={{
        position: 'fixed', bottom: 'calc(130px + env(safe-area-inset-bottom))', right: 16, zIndex: 98,
        width: 40, height: 40, borderRadius: '50%',
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        color: 'var(--text-secondary)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'var(--shadow-md)', padding: 0,
        transition: 'opacity 0.2s, transform 0.2s',
        opacity: show ? 1 : 0, transform: show ? 'scale(1)' : 'scale(0.8)',
      }}
    >
      {/* 진행률 링 */}
      <svg width="40" height="40" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--border)" strokeWidth="2" />
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--brand)" strokeWidth="2"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.15s' }} />
      </svg>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative', zIndex: 1 }}>
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  );
}
