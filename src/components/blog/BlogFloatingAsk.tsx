'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { trackCtaClick } from '@/lib/cta-track';

interface Props {
  slug: string;
  isLoggedIn?: boolean;
}

export default function BlogFloatingAsk({ slug, isLoggedIn }: Props) {
  const [show, setShow] = useState(false);

  const viewFired = useRef(false);

  useEffect(() => {
    if (isLoggedIn) return;
    const onScroll = () => {
      const scrolled = window.scrollY;
      const total = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      setShow(scrolled / total > 0.5);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [isLoggedIn]);

  // show=true 로 전환 시 cta_view 1회 발송
  useEffect(() => {
    if (!show || viewFired.current) return;
    viewFired.current = true;
    const body = JSON.stringify({
      event_type: 'cta_view',
      cta_name: 'blog_floating_ask',
      category: 'signup',
      page_path: typeof window !== 'undefined' ? window.location.pathname : null,
    });
    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/events/cta', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/events/cta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
      }
    } catch { /* silent */ }
  }, [show]);

  const handle = useCallback(() => {
    trackCtaClick({ cta_name: 'blog_floating_ask', category: 'signup', page_path: typeof window !== 'undefined' ? window.location.pathname : undefined });
    window.location.href = `/login?redirect=${encodeURIComponent(`/blog/${slug}`)}&source=blog_floating_ask`;
  }, [slug]);

  if (isLoggedIn || !show) return null;

  return (
    <button
      onClick={handle}
      aria-label="로그인하고 질문하기"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 24,
        zIndex: 900,
        background: '#FEE500',
        color: '#000',
        fontWeight: 800,
        fontSize: 13,
        padding: '12px 18px',
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 10px 24px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span aria-hidden>💬</span> 궁금한 거 물어보기
    </button>
  );
}
