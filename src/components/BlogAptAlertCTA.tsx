'use client';
import { useState, useEffect, useRef } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { trackCTA } from '@/lib/analytics';
import { getVariant, trackAbView, trackAbClick } from '@/lib/analytics/abTest';

interface Props {
  aptName: string;      // 단지명 (post.tags[0])
  siteSlug?: string;    // apt_sites.slug (있으면 상세 링크)
  category?: string;    // 'apt' | 'unsold'
  loginUrl: string;     // 비로그인 시 가입 URL
}

const EXPERIMENT = 'apt_alert_cta_v223';

/**
 * BlogAptAlertCTA — 블로그 apt 포스트 본문 내 알림 CTA.
 *
 * s222 A/B (apt_alert_cta_v223):
 *   A (control): inline 위치, 기존 카피 ("{단지명} 가격 변동 알림 받기")
 *   B (treatment): 본문 80% 스크롤 시점 sticky bottom + 손실 회피 카피
 *     ("{단지명} 가격이 5% 떨어지면 알림 받기 · 놓치면 다시 못 만나요")
 *
 * 양 variant 모두 trackCTA('apt_alert_cta') + trackAb*(EXPERIMENT, variant) 동시 추적.
 */
export default function BlogAptAlertCTA({ aptName, siteSlug, category = 'apt', loginUrl }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'login_required'>('idle');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [variant, setVariant] = useState<'A' | 'B' | null>(null);
  const [scrollVisible, setScrollVisible] = useState(false);
  const viewFiredRef = useRef(false);

  useEffect(() => {
    setVariant(getVariant(EXPERIMENT, ['A', 'B']) as 'A' | 'B');
  }, []);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });
  }, []);

  // B variant: 본문 80% 스크롤 후만 노출
  useEffect(() => {
    if (variant !== 'B') return;
    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total <= 0) return;
      const pct = window.scrollY / total;
      setScrollVisible(pct >= 0.8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [variant]);

  // view 추적 — variant + isLoggedIn 결정 후 1회. B 는 sticky 노출 시점에 발화.
  useEffect(() => {
    if (variant === null || isLoggedIn === null || viewFiredRef.current) return;
    if (variant === 'B' && !scrollVisible) return; // B 는 80% 후만
    viewFiredRef.current = true;
    trackCTA('view', 'apt_alert_cta');
    trackAbView(EXPERIMENT, variant, { logged_in: isLoggedIn, category });
  }, [variant, isLoggedIn, scrollVisible, category]);

  const handleAlert = async () => {
    trackCTA('click', 'apt_alert_cta');
    if (variant) trackAbClick(EXPERIMENT, variant, { logged_in: isLoggedIn, category });
    if (!isLoggedIn) {
      window.location.href = loginUrl;
      return;
    }
    setStatus('loading');
    try {
      const sb = createSupabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { window.location.href = loginUrl; return; }
      await fetch(`/api/apt/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apt_name: aptName, site_slug: siteSlug || null, source: 'blog_cta' }),
      });
      setStatus('done');
    } catch {
      setStatus('done');
    }
  };

  // 판정 전 — CLS 방지 자리 예약 (A 만, B 는 sticky 라 인플로우 X)
  if (isLoggedIn === null || variant === null) {
    return <div aria-hidden="true" style={{ minHeight: 124, margin: '20px 0' }} />;
  }

  if (status === 'done') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px', borderRadius: 10, margin: '20px 0',
        background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
      }}>
        <span style={{ fontSize: 18 }}>✅</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            {aptName} 알림 등록 완료
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
            가격 변동 시 알림을 드립니다
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // B variant — sticky bottom + 손실 회피 카피
  // ─────────────────────────────────────────────
  if (variant === 'B') {
    if (!scrollVisible) return null;
    return (
      <div
        role="region"
        aria-label={`${aptName} 알림`}
        style={{
          position: 'fixed', left: '50%', bottom: 16,
          transform: 'translateX(-50%)',
          zIndex: 50,
          width: 'min(92vw, 420px)',
          padding: '12px 14px', borderRadius: 14,
          background: 'rgba(12,21,40,0.98)',
          border: '1px solid rgba(254,229,0,0.35)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', gap: 10,
          backdropFilter: 'blur(8px)',
        }}
      >
        <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>🔔</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', wordBreak: 'keep-all', lineHeight: 1.35 }}>
            {aptName} 가격이 5% 떨어지면 알림 받기
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
            놓치면 다시 못 만나요
          </div>
        </div>
        <button
          onClick={handleAlert}
          disabled={status === 'loading'}
          style={{
            padding: '9px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: '#FEE500', color: '#191919',
            fontSize: 12, fontWeight: 800, fontFamily: 'inherit',
            opacity: status === 'loading' ? 0.7 : 1,
            flexShrink: 0,
          }}
        >
          {status === 'loading' ? '등록 중' : isLoggedIn ? '알림 ON' : '무료 가입'}
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // A variant (control) — inline 기존 디자인
  // ─────────────────────────────────────────────
  return (
    <div style={{
      padding: '16px', borderRadius: 12, margin: '20px 0',
      background: 'rgba(254,229,0,0.04)', border: '1px solid rgba(254,229,0,0.15)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>🔔</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>
            {aptName} 가격 변동 알림 받기
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: 10 }}>
            실거래 등록 시 바로 알려드려요 · 무료
          </div>
          <button
            onClick={handleAlert}
            disabled={status === 'loading'}
            style={{
              padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: '#FEE500',
              color: '#191919', fontSize: 13, fontWeight: 800,
              opacity: status === 'loading' ? 0.7 : 1,
            }}
          >
            {status === 'loading' ? '등록 중...' : isLoggedIn ? '알림 ON' : '무료 가입 후 알림 받기'}
          </button>
        </div>
      </div>
    </div>
  );
}
