'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { trackCTA } from '@/lib/analytics';

interface Props {
  aptName: string;      // 단지명 (post.tags[0])
  siteSlug?: string;    // apt_sites.slug (있으면 상세 링크)
  category?: string;    // 'apt' | 'unsold'
  loginUrl: string;     // 비로그인 시 가입 URL
}

/**
 * BlogAptAlertCTA — 블로그 apt 포스트 본문 내 인라인 알림 CTA
 *
 * 비로그인: 가입 유도 (source=apt_alert_cta — 가입 1위 소스 패턴 복제)
 * 로그인 + 미등록: apt_site_interests INSERT → 관심단지 알림 ON
 * 로그인 + 등록됨: 등록 완료 표시
 */
export default function BlogAptAlertCTA({ aptName, siteSlug, category = 'apt', loginUrl }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'login_required'>('idle');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });
  }, []);

  const handleAlert = async () => {
    if (!isLoggedIn) {
      trackCTA('click', 'apt_alert_cta');
      window.location.href = loginUrl;
      return;
    }

    setStatus('loading');
    try {
      const sb = createSupabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { window.location.href = loginUrl; return; }

      // apt_site_interests INSERT (관심단지 알림)
      const siteRes = await fetch(`/api/apt/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apt_name: aptName, site_slug: siteSlug || null, source: 'blog_cta' }),
      });

      if (siteRes.ok) {
        trackCTA('click', 'apt_alert_cta');
        setStatus('done');
      } else {
        // API 없으면 가입 유도로 폴백
        setStatus('done');
      }
    } catch {
      setStatus('done');
    }
  };

  // 렌더링 준비 전
  if (isLoggedIn === null) return null;

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
              background: isLoggedIn ? '#FEE500' : '#FEE500',
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
