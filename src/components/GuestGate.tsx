'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface GuestGateProps {
  children: React.ReactNode;
  isLoggedIn: boolean;
}

export function GuestGate({ children, isLoggedIn }: GuestGateProps) {
  const pathname = usePathname();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (isLoggedIn) return;
    if (typeof window === 'undefined') return;
    try {
      const val = localStorage.getItem('kd_login_dismissed');
      if (val && Date.now() - JSON.parse(val).ts < 86400000) return;
    } catch {}

    // 15초 후 표시
    const timer = setTimeout(() => setShowPrompt(true), 15000);

    // 스크롤 500px 넘으면 표시
    const handleScroll = () => {
      if (window.scrollY > 500) setShowPrompt(true);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isLoggedIn]);

  const dismiss = () => {
    setShowPrompt(false);
    try { localStorage.setItem('kd_login_dismissed', JSON.stringify({ ts: Date.now() })); } catch {}
  };

  return (
    <>
      {children}

      {showPrompt && !isLoggedIn && (
        <div style={{
          position: 'fixed', bottom: 68, left: '50%', transform: 'translateX(-50%)',
          width: 'min(420px, calc(100vw - 32px))',
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '16px 20px', zIndex: 9000,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              카더라 멤버가 되면 더 많은 소문을 볼 수 있어요 👀
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              로그인하고 좋아요·댓글·공유까지
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} style={{
              padding: '8px 16px', borderRadius: 20, background: 'var(--brand)',
              color: 'white', fontSize: 13, fontWeight: 700, textDecoration: 'none',
            }}>로그인</Link>
            <button onClick={dismiss} style={{
              width: 28, height: 28, borderRadius: '50%', border: 'none',
              background: 'var(--bg-hover)', color: 'var(--text-tertiary)',
              fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
          </div>
        </div>
      )}
    </>
  );
}
