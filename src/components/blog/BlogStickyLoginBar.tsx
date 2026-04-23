'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BlogStickyLoginBar() {
  const [show, setShow] = useState(false);
  const [redirect, setRedirect] = useState('/');
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setRedirect(window.location.pathname + window.location.search);

    const onScroll = () => setShow(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    try {
      import('@/lib/analytics').then((m: any) => {
        m.trackCTA?.('view', 'blog_sticky_bar', { page_path: window.location.pathname });
      });
    } catch {}

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!show || pathname?.startsWith('/login')) return null;

  const handleClick = () => {
    try {
      const body = JSON.stringify({
        event_type: 'cta_click',
        cta_name: 'blog_sticky_bar',
        category: 'signup',
        page_path: window.location.pathname,
      });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/events/cta', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/events/cta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {}
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(var(--mobile-nav-h, 56px) + env(safe-area-inset-bottom))',
        left: 0,
        right: 0,
        zIndex: 98,
        padding: '10px 16px',
        background: 'rgba(5,10,24,0.96)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderTop: '1px solid rgba(59,123,246,0.25)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 -8px 24px rgba(0,0,0,0.4)',
      }}
      role="region"
      aria-label="로그인 안내"
    >
      <div style={{ flex: 1, fontSize: 13, color: '#fff', fontWeight: 600, lineHeight: 1.4 }}>
        💎 가입하면 전체 분석과 알림을 무료로 이용하세요
      </div>
      <Link
        href={`/login?redirect=${encodeURIComponent(redirect)}&source=blog_sticky_bar`}
        onClick={handleClick}
        style={{
          padding: '9px 16px',
          borderRadius: 999,
          background: 'var(--brand)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 700,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(59,123,246,0.3)',
        }}
      >
        1초 로그인
      </Link>
    </div>
  );
}
