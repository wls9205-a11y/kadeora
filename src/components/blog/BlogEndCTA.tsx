'use client';

import { useCallback, useEffect, useRef } from 'react';
import { trackCtaClick } from '@/lib/cta-track';

interface Props {
  slug: string;
  isLoggedIn?: boolean;
}

function fireView(ctaName: string) {
  const body = JSON.stringify({
    event_type: 'cta_view',
    cta_name: ctaName,
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
}

export default function BlogEndCTA({ slug, isLoggedIn }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const viewFired = useRef(false);

  useEffect(() => {
    if (isLoggedIn) return;
    const node = ref.current;
    if (!node || viewFired.current) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || viewFired.current) return;
      viewFired.current = true;
      fireView('blog_end_cta');
      io.disconnect();
    }, { threshold: 0.3 });
    io.observe(node);
    return () => io.disconnect();
  }, [isLoggedIn]);

  const handle = useCallback(() => {
    trackCtaClick({ cta_name: 'blog_end_cta', category: 'signup', page_path: typeof window !== 'undefined' ? window.location.pathname : undefined });
    if (typeof window !== 'undefined') {
      window.location.href = `/login?redirect=${encodeURIComponent(`/blog/${slug}`)}&source=blog_end_cta`;
    }
  }, [slug]);

  if (isLoggedIn) return null;

  return (
    <div ref={ref} style={{
      margin: '28px 0',
      padding: '22px 20px',
      borderRadius: 16,
      background: 'linear-gradient(135deg, rgba(254,229,0,0.15) 0%, rgba(139,92,246,0.12) 100%)',
      border: '1px solid rgba(254,229,0,0.3)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary, #94a3b8)', marginBottom: 6 }}>이 글이 도움 되셨나요?</div>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 14, color: 'var(--text-primary)' }}>매주 알림 받기</div>
      <button onClick={handle} style={{
        background: '#FEE500', color: '#000', fontWeight: 800, fontSize: 15,
        padding: '12px 28px', borderRadius: 10, border: 'none', cursor: 'pointer',
        minWidth: 220, boxShadow: '0 6px 14px rgba(0,0,0,0.2)',
      }}>카카오로 1초 가입 · 100P 지급</button>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary, #94a3b8)', marginTop: 10 }}>언제든 알림 해지 가능 · 무료</div>
    </div>
  );
}
