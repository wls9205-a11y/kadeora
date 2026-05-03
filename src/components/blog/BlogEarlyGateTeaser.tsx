'use client';

/**
 * BlogEarlyGateTeaser — 블로그 최상단 (TLDR 바로 아래) 즉시 노출 티저.
 *
 * 85% 유저가 스크롤 25% 미만에서 이탈하므로 중후반 H2 gated wall 은 노출 0.
 * 상단 티저는 컴포넌트 마운트 + config 로드 즉시 cta_view 발송 (IntersectionObserver 불필요).
 *
 * 로그인 유저는 완전 숨김.
 */

import { useEffect, useRef, useState } from 'react';
import { trackCtaClick } from '@/lib/cta-track';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { getVariant, trackAbView, trackAbClick } from '@/lib/analytics/abTest';

const EXPERIMENT = 'blog_early_teaser_v223';

interface TeaserConfig {
  teaser_title: string;
  teaser_bullets: string[];
  cta_text: string;
  cta_name: string;
}

interface Props {
  slug: string;
  /** 서버에서 판단한 초기값 (생략 가능 — 컴포넌트가 항상 마운트되도록 무조건 렌더 권장) */
  enabled?: boolean;
  /** 서버에서 읽은 has_gated_content. undefined 면 컴포넌트 내부에서 blog_posts 조회로 재확인. */
  hasGatedContent?: boolean | null;
  /** 서버에서 읽은 로그인 여부. undefined 면 내부에서 get_my_access_level 결과 사용. */
  isLoggedInHint?: boolean | null;
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
      fetch('/api/events/cta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body, keepalive: true,
      }).then(() => {}, () => {});
    }
  } catch { /* silent */ }
}

export default function BlogEarlyGateTeaser({ slug, enabled = true, hasGatedContent: hasGatedProp, isLoggedInHint }: Props) {
  const [config, setConfig] = useState<TeaserConfig | null>(null);
  const [isAuth, setIsAuth] = useState<boolean | null>(typeof isLoggedInHint === 'boolean' ? isLoggedInHint : null);
  const [hasGated, setHasGated] = useState<boolean | null>(typeof hasGatedProp === 'boolean' ? hasGatedProp : null);
  const viewFired = useRef(false);
  // s222 G (blog_early_teaser_v223): A control / B 희소성 카피
  const [variant, setVariant] = useState<'A' | 'B' | null>(null);
  useEffect(() => {
    setVariant(getVariant(EXPERIMENT, ['A', 'B']) as 'A' | 'B');
  }, []);

  // 🔍 DEBUG probe — 마운트 즉시 log_teaser_debug('mount')
  useEffect(() => {
    try {
      const sb = createSupabaseBrowser();
      // .then 체인으로 fetch 강제 실행 (PostgrestBuilder 는 thenable — .catch 단독으로는 미실행)
      (sb.rpc as any)('log_teaser_debug', {
        p_event: 'mount',
        p_page_path: typeof window !== 'undefined' ? window.location.pathname : null,
        p_details: { slug, enabled, hasGatedProp: hasGatedProp ?? null, isLoggedInHint: isLoggedInHint ?? null },
      }).then(() => {}, () => {});
    } catch { /* silent */ }
  }, []);

  // hasGatedContent 서버 전달 없으면 blog_posts 직접 조회 (슬러그 기반)
  useEffect(() => {
    if (hasGated !== null) return;
    (async () => {
      try {
        const sb = createSupabaseBrowser();
        const { data } = await (sb as any)
          .from('blog_posts')
          .select('has_gated_content')
          .eq('slug', slug)
          .maybeSingle();
        setHasGated(!!data?.has_gated_content);
      } catch {
        setHasGated(false);
      }
    })();
  }, [slug, hasGated]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const sb = createSupabaseBrowser();
        const [cfgRes, accRes] = await Promise.all([
          (sb.rpc as any)('get_blog_teaser_config'),
          (sb.rpc as any)('get_my_access_level'),
        ]);
        if (cancelled) return;

        // 🔍 DEBUG — RPC 응답 수신
        try {
          (sb.rpc as any)('log_teaser_debug', {
            p_event: 'config_loaded',
            p_page_path: typeof window !== 'undefined' ? window.location.pathname : null,
            p_details: {
              has_config: !!cfgRes?.data,
              config_error: cfgRes?.error?.message ?? null,
              is_authenticated: (accRes?.data as any)?.is_authenticated ?? null,
              access_level: (accRes?.data as any)?.access_level ?? null,
              access_error: accRes?.error?.message ?? null,
            },
          }).then(() => {}, () => {});
        } catch { /* silent */ }

        const cfg = cfgRes?.data;
        if (cfg && typeof cfg === 'object') {
          setConfig({
            teaser_title: String((cfg as any).teaser_title || ''),
            teaser_bullets: Array.isArray((cfg as any).teaser_bullets) ? (cfg as any).teaser_bullets.map(String) : [],
            cta_text: String((cfg as any).cta_text || '로그인하고 계속 읽기'),
            cta_name: String((cfg as any).cta_name || 'blog_early_teaser'),
          });
        }
        const auth = accRes?.data;
        setIsAuth(auth && typeof auth === 'object' ? !!(auth as any).is_authenticated : false);
      } catch (e: any) {
        // 🔍 DEBUG — 예외 로깅
        try {
          const sb = createSupabaseBrowser();
          (sb.rpc as any)('log_teaser_debug', {
            p_event: 'config_exception',
            p_page_path: typeof window !== 'undefined' ? window.location.pathname : null,
            p_details: { message: String(e?.message || e).slice(0, 300) },
          }).then(() => {}, () => {});
        } catch { /* silent */ }
      }
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  // 🔍 DEBUG — render 판정
  useEffect(() => {
    if (config === null || isAuth === null || hasGated === null) return;
    try {
      const sb = createSupabaseBrowser();
      const willRender = !!(enabled && config && isAuth === false && hasGated);
      (sb.rpc as any)('log_teaser_debug', {
        p_event: 'render_decision',
        p_page_path: typeof window !== 'undefined' ? window.location.pathname : null,
        p_details: {
          will_render: willRender,
          enabled,
          has_config: !!config,
          is_auth: isAuth,
          has_gated: hasGated,
        },
      }).then(() => {}, () => {});
    } catch { /* silent */ }
  }, [config, isAuth, enabled, hasGated]);

  useEffect(() => {
    if (!config || isAuth !== false || !hasGated || viewFired.current || variant === null) return;
    viewFired.current = true;
    fireView(config.cta_name);
    trackAbView(EXPERIMENT, variant, { slug, has_gated: hasGated });
    // 🔍 DEBUG — view fired
    try {
      const sb = createSupabaseBrowser();
      // .then 체인으로 fetch 강제 실행 (PostgrestBuilder 는 thenable — .catch 단독으로는 미실행)
      (sb.rpc as any)('log_teaser_debug', {
        p_event: 'view_fired',
        p_page_path: typeof window !== 'undefined' ? window.location.pathname : null,
        p_details: { cta_name: config.cta_name },
      }).then(() => {}, () => {});
    } catch { /* silent */ }
  }, [config, isAuth, hasGated]);

  // 세션 150: CLS 방지 위해 판정 완료 전 자리 예약
  // 단, 서버에서 로그인 확정(hint=true) 또는 gated 아닌 것이 확정이면 자리 예약 안 함
  const shouldReserveSpace = isLoggedInHint !== true && hasGatedProp !== false;
  if (!enabled || !config) {
    return shouldReserveSpace
      ? <div aria-hidden="true" style={{ minHeight: 220, margin: '18px 0' }} />
      : null;
  }
  if (isAuth !== false || !hasGated) return null;

  const handleClick = () => {
    trackCtaClick({ cta_name: config.cta_name, category: 'signup', page_path: typeof window !== 'undefined' ? window.location.pathname : undefined });
    if (variant) trackAbClick(EXPERIMENT, variant, { slug });
    if (typeof window !== 'undefined') {
      window.location.href = `/login?source=${config.cta_name}&redirect=${encodeURIComponent(`/blog/${slug}`)}`;
    }
  };

  // s222 G B variant: 희소성 카피로 teaser_title 오버라이드.
  // locked_count = teaser_bullets.length 가 정확한 잠금 섹션 수 (DB config 기준). 0/null 이면 5 fallback.
  const lockedCount = config.teaser_bullets.length > 0 ? config.teaser_bullets.length : 5;
  const displayTitle = variant === 'B'
    ? `이 글의 핵심 ${lockedCount}개는 가입자만 볼 수 있어요`
    : config.teaser_title;

  return (
    <div
      role="group"
      aria-label={displayTitle}
      style={{
        margin: '20px 0',
        padding: '18px 18px 16px',
        borderRadius: 14,
        border: '2px solid #FBBF24',
        background: 'linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(254,229,0,0.08) 100%)',
        boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary, #e5e7eb)', marginBottom: 12, wordBreak: 'keep-all' }}>
        {displayTitle}
      </div>
      {config.teaser_bullets.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', display: 'grid', gap: 6 }}>
          {config.teaser_bullets.map((b, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.5 }}>
              <span aria-hidden style={{ color: '#FBBF24', marginTop: 1 }}>🔒</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b}</span>
            </li>
          ))}
        </ul>
      )}
      <button
        onClick={handleClick}
        style={{
          width: '100%',
          background: '#FEE500', color: '#000',
          fontWeight: 800, fontSize: 15,
          padding: '12px 20px', borderRadius: 10,
          border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        {config.cta_text}
      </button>
      <div style={{ fontSize: 11, textAlign: 'center', color: 'var(--text-tertiary, #94a3b8)', marginTop: 8 }}>
        가입 즉시 100P · 언제든 해지 가능
      </div>
    </div>
  );
}
