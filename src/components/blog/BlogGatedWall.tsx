'use client';

/**
 * BlogGatedWall — 로그인/프리미엄 게이트 섹션. 미로그인 유저에게 preview + 블러 + CTA 버튼.
 *
 * 서버에서 섹션 HTML 을 preview/full 로 분리해 props 로 전달.
 * 로그인 유저는 서버에서 gate 체크 후 full 만 렌더 → 이 컴포넌트 미사용.
 */

import { useCallback, useEffect, useRef } from 'react';
import { trackCtaClick } from '@/lib/cta-track';

interface Props {
  h2: string;
  previewHtml: string;
  gate: 'login' | 'premium';
  ctaText?: string;
  redirectPath?: string;
  ctaSource?: string;
  position?: number;
}

export default function BlogGatedWall({ h2, previewHtml, gate, ctaText, redirectPath, ctaSource, position }: Props) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const viewFired = useRef(false);

  // IntersectionObserver 로 cta_view 1회 발송 (threshold 0.3)
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || viewFired.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || viewFired.current) return;
      viewFired.current = true;
      const ctaName = ctaSource || (gate === 'premium' ? 'blog_gated_premium' : 'blog_gated_login');
      const body = JSON.stringify({
        event_type: 'cta_view',
        cta_name: ctaName,
        category: 'signup',
        page_path: typeof window !== 'undefined' ? window.location.pathname : null,
        gate_position: typeof position === 'number' ? position : null,
      });
      try {
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
      } catch { /* silent */ }
      observer.disconnect();
    }, { threshold: 0.3 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [gate, ctaSource, position]);

  const handleClick = useCallback(() => {
    const source = ctaSource || (gate === 'premium' ? 'blog_gated_premium' : 'blog_gated_login');
    try { trackCtaClick({ cta_name: source, category: 'signup', page_path: redirectPath || (typeof window !== 'undefined' ? window.location.pathname : '') }); } catch { /* silent */ }
    if (typeof window === 'undefined') return;
    const dest = gate === 'premium' ? '/premium?from=gated' : `/login?redirect=${encodeURIComponent(redirectPath || window.location.pathname)}&source=${source}`;
    window.location.href = dest;
  }, [gate, redirectPath, ctaSource]);

  const isPremium = gate === 'premium';
  const label = isPremium ? '프리미엄 회원 전용' : '로그인 후 전체 보기';
  const btnLabel = ctaText || (isPremium ? '프리미엄 가입하기' : '카카오로 1초 로그인');

  return (
    <section ref={sectionRef} style={{ margin: '24px 0' }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 12px', color: 'var(--text-primary, #e5e7eb)' }}>{h2}</h2>

      <div style={{ position: 'relative' }}>
        <div
          style={{
            color: 'var(--text-primary, #e5e7eb)',
            lineHeight: 1.75,
            fontSize: 15,
            maxHeight: 220,
            overflow: 'hidden',
          }}
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 'auto 0 0 0', height: 120,
            background: 'linear-gradient(to top, var(--bg-base, #0b1220) 20%, rgba(11,18,32,0) 100%)',
            pointerEvents: 'none',
          }}
        />
      </div>

      <div
        role="group"
        style={{
          marginTop: 12,
          padding: '20px 20px 18px',
          borderRadius: 14,
          background: 'rgba(251,191,36,0.08)',
          border: `2px solid ${isPremium ? '#EC4899' : '#FBBF24'}`,
          textAlign: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--text-tertiary, #94a3b8)', marginBottom: 6 }}>
          🔒 이 섹션은 {label}
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14, color: 'var(--text-primary, #e5e7eb)', wordBreak: 'keep-all' }}>
          {ctaText || '카더라의 전체 분석을 열람해 보세요'}
        </div>
        <button
          onClick={handleClick}
          style={{
            background: isPremium ? '#EC4899' : '#FEE500',
            color: isPremium ? '#fff' : '#000',
            fontWeight: 800,
            fontSize: 15,
            padding: '12px 28px',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            minWidth: 220,
            boxShadow: '0 6px 14px rgba(0,0,0,0.2)',
          }}
        >
          {btnLabel}
        </button>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary, #94a3b8)', marginTop: 10 }}>
          가입 즉시 100P 지급 · 언제든 해지 가능
        </div>
      </div>
    </section>
  );
}
