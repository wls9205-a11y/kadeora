'use client';

/**
 * BlogMidGate — 블로그 본문 50% 스크롤 시 inline 게이트.
 *
 * 동작:
 *   - isGatedPost=true 또는 로그인 유저 → null
 *   - 세션당 1회: sessionStorage key blog_mid_gate_shown_${blogId}
 *   - <div data-mid-gate-sentinel /> 를 본문 파싱 시 50% 지점에 inject
 *   - sentinel ref 가 IntersectionObserver 진입 시 setVisible(true)
 *   - variants DB 로드 (cta_message_variants WHERE cta_name='blog_mid_gate' variant_key='default')
 *     실패 시 하드코딩 폴백
 *
 * 이벤트:
 *   view: cta_view('blog_mid_gate')
 *   click: cta_click('blog_mid_gate')
 *   dismiss: cta_click('blog_mid_gate_dismiss') (별도 CTA 이름)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { trackCtaClick, trackCtaView } from '@/lib/cta-track';

interface Variant {
  title: string;
  body: string;
}

const FALLBACK: Variant = {
  title: '이 글 끝까지 보는 사람 8%뿐',
  body: '핵심 정보는 아래에 있어요. 3초 가입하면 모든 글을 끝까지 읽을 수 있어요.',
};

interface Props {
  blogId: number;
  isGatedPost?: boolean;
  isLoggedIn?: boolean;
  sentinelSelector?: string;
  className?: string;
}

export default function BlogMidGate({ blogId, isGatedPost, isLoggedIn, sentinelSelector, className }: Props) {
  const [variant, setVariant] = useState<Variant>(FALLBACK);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const viewFired = useRef(false);

  const skip = !!(isGatedPost || isLoggedIn);

  // 세션 캐시 체크 (1회 노출 제한)
  useEffect(() => {
    if (skip) return;
    if (typeof sessionStorage === 'undefined') return;
    try {
      const key = `blog_mid_gate_shown_${blogId}`;
      if (sessionStorage.getItem(key)) setDismissed(true);
    } catch { /* silent */ }
  }, [blogId, skip]);

  // variants 로드
  useEffect(() => {
    if (skip || dismissed) return;
    (async () => {
      try {
        const sb = createSupabaseBrowser();
        const { data } = await (sb as any)
          .from('cta_message_variants')
          .select('title, body')
          .eq('cta_name', 'blog_mid_gate')
          .eq('variant_key', 'default')
          .eq('is_active', true)
          .maybeSingle();
        if (data && typeof data === 'object') {
          setVariant({
            title: String((data as any).title || FALLBACK.title),
            body: String((data as any).body || FALLBACK.body),
          });
        }
      } catch { /* keep fallback */ }
    })();
  }, [skip, dismissed]);

  // sentinel 관측
  useEffect(() => {
    if (skip || dismissed) return;
    if (typeof document === 'undefined') return;
    const selector = sentinelSelector || '[data-mid-gate-sentinel]';
    const sentinel = document.querySelector(selector) as HTMLElement | null;
    if (!sentinel) {
      // 폴백: window scroll 50% 도달 시 노출
      const onScroll = () => {
        const scrolled = window.scrollY;
        const total = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        if (scrolled / total >= 0.5) {
          setVisible(true);
          window.removeEventListener('scroll', onScroll);
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
      return () => window.removeEventListener('scroll', onScroll);
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        io.disconnect();
      }
    }, { threshold: 0.1 });
    io.observe(sentinel);
    return () => io.disconnect();
  }, [skip, dismissed, sentinelSelector]);

  // view 이벤트 1회
  useEffect(() => {
    if (!visible || viewFired.current || skip || dismissed) return;
    viewFired.current = true;
    try {
      trackCtaView({
        cta_name: 'blog_mid_gate',
        category: 'signup',
        page_path: window.location.pathname,
      });
      sessionStorage.setItem(`blog_mid_gate_shown_${blogId}`, '1');
    } catch { /* silent */ }
  }, [visible, skip, dismissed, blogId]);

  const onClick = useCallback(() => {
    try {
      trackCtaClick({ cta_name: 'blog_mid_gate', category: 'signup', page_path: window.location.pathname });
    } catch { /* silent */ }
    if (typeof window !== 'undefined') {
      window.location.href = `/login?source=blog_mid_gate&redirect=${encodeURIComponent(window.location.pathname)}`;
    }
  }, []);

  const onDismiss = useCallback(() => {
    try {
      trackCtaClick({ cta_name: 'blog_mid_gate_dismiss', category: 'engagement', page_path: window.location.pathname });
    } catch { /* silent */ }
    setDismissed(true);
    try { sessionStorage.setItem(`blog_mid_gate_shown_${blogId}`, '1'); } catch { /* silent */ }
  }, [blogId]);

  if (skip || dismissed || !visible) return null;

  return (
    <div
      role="group"
      aria-label={variant.title}
      className={className}
      style={{
        margin: '24px 0',
        padding: '22px 22px 18px',
        borderRadius: 14,
        background: 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(255,255,255,0.02) 60%, rgba(255,255,255,0.02) 100%)',
        border: '2px solid rgba(99,102,241,0.4)',
        position: 'relative',
        boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
      }}
    >
      <button
        onClick={onDismiss}
        aria-label="닫기"
        style={{
          position: 'absolute', top: 8, right: 10,
          background: 'transparent', border: 'none',
          color: 'var(--text-tertiary, #94a3b8)',
          fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 4,
        }}
      >×</button>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary, #e5e7eb)', wordBreak: 'keep-all' }}>
        {variant.title}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary, #cbd5e1)', marginBottom: 14, lineHeight: 1.55 }}>
        {variant.body}
      </div>
      <button
        onClick={onClick}
        style={{
          width: '100%',
          background: '#FEE500', color: '#000',
          fontWeight: 800, fontSize: 15,
          padding: '12px 20px', borderRadius: 10,
          border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}
      >
        3초 가입하고 계속 읽기
      </button>
      <div style={{ fontSize: 11, textAlign: 'center', color: 'var(--text-tertiary, #94a3b8)', marginTop: 8 }}>
        가입 즉시 100P · 언제든 해지 가능
      </div>
    </div>
  );
}
