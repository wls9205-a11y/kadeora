'use client';
/**
 * SignupNudgeModal — 비로그인 사용자에게 3페이지뷰 후 가입 모달 노출
 *
 * 목표: 일 608 방문자 중 0.34% 로그인 페이지 진입 → 가입 동선 강화 (1% → 3%)
 * 트리거: localStorage.pv_count >= 3 + signup_nudge_dismissed_at 미존재
 * 노출 빈도: 14일에 1회 (dismissed_at 기록 후)
 *
 * v4-C4: 전역 가입 모달을 이 한 벌로 줄였다 (SignupPopupModal 제거).
 *   3페이지뷰가 스크롤 %보다 관심 신호로서 근거가 낫다.
 *   쿨다운 7일 → 14일, 현장 상세(/apt/{slug})에서는 아예 띄우지 않는다 —
 *   그 화면의 1순위 전환은 리드폼이고 가입 유도가 그것과 경쟁하면 안 된다.
 *
 * ⚠️ 2026-08-23 현재 이 컴포넌트는 어디에도 마운트돼 있지 않다.
 *   되살리려면 ClientShell 의 AuthProvider 트리 안에 <SignupNudgeModal /> 한 줄.
 *
 * 데이터 소스: get_signup_value_props() RPC (SECURITY DEFINER + EXCEPTION 핸들러)
 *   → value_props 5개 + real_active_users + community_post_count + apt_active_count
 *
 * 가입 path: 카카오 1-tap (현재 가입의 79% 경로) 강조
 */
import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { isAptSiteDetailPath } from '@/lib/apt/is-site-detail';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { errMsg } from '@/lib/error-utils';
import { useInAppBrowser } from '@/hooks/useInAppBrowser';

interface ValueProp {
  icon: string;
  title: string;
  desc: string;
}
interface SignupValueProps {
  value_props: ValueProp[];
  real_active_users?: number;
  community_post_count?: number;
  apt_active_count?: number;
  blog_count?: number;
  calc_count?: number;
  stock_count?: number;
}

const PV_KEY = 'kd_pv_count';
const DISMISSED_KEY = 'kd_signup_nudge_dismissed_at';
const SHOWN_KEY = 'kd_signup_nudge_shown_at';
const TRIGGER_THRESHOLD = 3;
const COOLDOWN_DAYS = 14;

// 기본 value_props (RPC 실패 시 fallback)
const DEFAULT_PROPS: ValueProp[] = [
  { icon: '🏠', title: '관심 단지 알림', desc: '실거래가·청약 마감 자동 알림' },
  { icon: '📊', title: '계산 결과 저장', desc: '50개 계산기 결과 영구 보관·공유' },
  { icon: '📈', title: '관심 종목 추적', desc: '실시간 주가·AI 분석 받기' },
];

export default function SignupNudgeModal() {
  const { userId, loading: authLoading } = useAuth();
  // Rule #14 — 훅은 조기 반환보다 위에서 무조건 호출한다.
  const pathname = usePathname() ?? '';
  const [show, setShow] = useState(false);
  const [props, setProps] = useState<SignupValueProps | null>(null);
  const [loginLoading, setLoginLoading] = useState<'kakao' | 'google' | null>(null);
  const [loginError, setLoginError] = useState('');
  // SU A-1: 게이트가 «없던» 진입점. /login 과 같은 훅에서 정책이 나오게 한다 —
  // 정책 상수를 컴포넌트마다 따로 두면 두 진입점이 곧 갈라진다.
  const inApp = useInAppBrowser();

  // 트리거 체크: 페이지 진입 시 pv_count++ 후 임계값 도달 검사
  useEffect(() => {
    if (authLoading || userId) return; // 로그인 사용자는 무시
    if (typeof window === 'undefined') return;
    // v4-C4-2: 현장 상세는 리드폼이 1순위 전환이다. 가입 모달을 겹치지 않는다.
    if (isAptSiteDetailPath(pathname)) return;

    try {
      // 7일 cooldown 체크
      const dismissedAt = localStorage.getItem(DISMISSED_KEY);
      if (dismissedAt) {
        const elapsed = Date.now() - new Date(dismissedAt).getTime();
        if (elapsed < COOLDOWN_DAYS * 24 * 60 * 60 * 1000) return;
        // cooldown 만료 → 카운트 리셋
        localStorage.removeItem(DISMISSED_KEY);
        localStorage.removeItem(PV_KEY);
        localStorage.removeItem(SHOWN_KEY);
      }

      const count = parseInt(localStorage.getItem(PV_KEY) || '0', 10) + 1;
      localStorage.setItem(PV_KEY, count.toString());

      if (count >= TRIGGER_THRESHOLD && !localStorage.getItem(SHOWN_KEY)) {
        setShow(true);
        localStorage.setItem(SHOWN_KEY, new Date().toISOString());
      }
    } catch {
      // localStorage 차단 환경 — 무시
    }
  }, [authLoading, userId]);

  // value_props RPC 로드 (모달 노출 시점에만)
  useEffect(() => {
    if (!show || props) return;
    const sb = createSupabaseBrowser();
    (async () => {
      try {
        const { data, error } = await (sb as any).rpc('get_signup_value_props');
        if (error) {
          console.warn('[SignupNudgeModal] RPC error:', error);
          setProps({ value_props: DEFAULT_PROPS });
          return;
        }
        setProps((data as unknown as SignupValueProps) || { value_props: DEFAULT_PROPS });
      } catch (e) {
        console.warn('[SignupNudgeModal] RPC throw:', e);
        setProps({ value_props: DEFAULT_PROPS });
      }
    })();
  }, [show, props]);

  const handleLogin = useCallback(async (provider: 'kakao' | 'google') => {
    setLoginLoading(provider);
    setLoginError('');
    try {
      // 가입 시도 추적 (실패해도 무시)
      fetch('/api/auth/track-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, source: 'signup_nudge_modal', redirect_path: window.location.pathname, success: false }),
      }).catch(() => {});

      const sb = createSupabaseBrowser();
      const redirect = window.location.pathname + window.location.search;
      const { error } = await sb.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}&source=signup_nudge_modal`,
        },
      });
      if (error) throw error;
    } catch (e: unknown) {
      setLoginError(e instanceof Error ? errMsg(e) : '로그인 중 오류가 발생했습니다');
      setLoginLoading(null);
    }
  }, []);

  const handleClose = useCallback(() => {
    try {
      localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
    } catch {}
    setShow(false);
  }, []);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
  }, [handleClose]);

  // ESC 키로 닫기
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show, handleClose]);

  if (!show || userId) return null;
  // OAuth 가 «둘 다» 막히는 인앱(다음·당근·페북/인스타/라인·일반 webview)에서는
  // 눌러도 실패로 끝난다. 전환되지 않는 모달을 띄우지 않는다.
  if (inApp.resolved && inApp.isInApp && !inApp.canDoOAuth) return null;
  const googleAllowed = inApp.canDoOAuthBy.google;

  const valueProps = props?.value_props && props.value_props.length > 0 ? props.value_props.slice(0, 4) : DEFAULT_PROPS;
  const activeUsers = props?.real_active_users ?? 110;
  const communityPosts = props?.community_post_count ?? 600;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="signup-nudge-title"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(12px, 4vw, 24px)',
        animation: 'kdNudgeFadeIn 0.2s ease',
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface)', color: 'var(--text-primary)',
          borderRadius: 20, maxWidth: 420, width: '100%',
          padding: 'clamp(20px, 5vw, 28px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          border: '1px solid var(--border)',
          maxHeight: '90vh', overflowY: 'auto',
          animation: 'kdNudgeSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={handleClose}
          aria-label="닫기"
          style={{
            position: 'absolute', top: 12, right: 12,
            width: 32, height: 32, borderRadius: '50%', border: 'none',
            background: 'transparent', cursor: 'pointer',
            color: 'var(--text-tertiary)', fontSize: 20, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ×
        </button>

        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🚀</div>
          <h2 id="signup-nudge-title" style={{ margin: 0, fontSize: 'clamp(18px, 5vw, 22px)', fontWeight: 900, color: 'var(--text-primary)' }}>
            저장·알림은 로그인 후 이용할 수 있습니다
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-sm, 13px)', color: 'var(--text-secondary)' }}>
            지금 <strong style={{ color: 'var(--brand)' }}>{activeUsers.toLocaleString('ko-KR')}명</strong>이 활동 중 · 커뮤니티 글 <strong>{communityPosts.toLocaleString('ko-KR')}+</strong>
          </p>
        </div>

        {/* 카카오 1-tap CTA (가장 강조) */}
        <button
          onClick={() => handleLogin('kakao')}
          disabled={loginLoading !== null}
          style={{
            width: '100%', padding: '14px 20px', marginBottom: 10,
            borderRadius: 12, border: 'none',
            cursor: loginLoading ? 'not-allowed' : 'pointer',
            background: 'var(--kakao-bg)', color: '#191919',
            fontWeight: 800, fontSize: 'var(--fs-md, 15px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            opacity: loginLoading === 'google' ? 0.5 : 1,
            transition: 'transform 0.15s, box-shadow 0.15s',
            boxShadow: '0 4px 12px rgba(254, 229, 0, 0.4)',
          }}
        >
          {loginLoading === 'kakao' ? (
            <span style={{ width: 20, height: 20, border: '2px solid #191919', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'kdNudgeSpin 0.8s linear infinite' }} />
          ) : (
            <span style={{ fontSize: 18 }}>💬</span>
          )}
          {loginLoading === 'kakao' ? '로그인 중...' : '카카오로 로그인'}
        </button>

        {/* Google 보조 옵션 — 인앱 웹뷰에서는 구글이 OAuth 를 거부한다(A-1) */}
        {googleAllowed ? (
          <button
            onClick={() => handleLogin('google')}
            disabled={loginLoading !== null}
            style={{
              width: '100%', padding: '12px 20px', marginBottom: 16,
              borderRadius: 12, border: '1px solid var(--border)',
              cursor: loginLoading ? 'not-allowed' : 'pointer',
              background: 'var(--bg-hover)', color: 'var(--text-primary)',
              fontWeight: 600, fontSize: 'var(--fs-sm, 13px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: loginLoading === 'kakao' ? 0.5 : 1,
            }}
          >
            {loginLoading === 'google' ? (
              <span style={{ width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'kdNudgeSpin 0.8s linear infinite' }} />
            ) : (
              <span>G</span>
            )}
            {loginLoading === 'google' ? '로그인 중...' : 'Google 계정으로 가입'}
          </button>
        ) : (
          <p style={{ margin: '0 0 16px', padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 'var(--fs-xs, 12px)', lineHeight: 1.6, textAlign: 'center' }}>
            Google 로그인은 기본 브라우저에서 가능해요 — 카카오로 계속하거나, 우측 상단 메뉴에서 &lsquo;다른 브라우저로 열기&rsquo;를 눌러주세요
          </p>
        )}

        {loginError && (
          <p style={{ margin: '0 0 12px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', borderRadius: 8, fontSize: 'var(--fs-xs, 12px)', textAlign: 'center' }}>
            {loginError}
          </p>
        )}

        {/* 가치 제안 리스트 */}
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {valueProps.map((p, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 'var(--fs-sm, 13px)', color: 'var(--text-secondary)' }}>
              <span style={{ fontSize: 18, lineHeight: 1.2, flexShrink: 0 }}>{p.icon}</span>
              <span>
                <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{p.title}</strong>
                <span style={{ display: 'block', marginTop: 2, fontSize: 'var(--fs-xs, 12px)', opacity: 0.85 }}>{p.desc}</span>
              </span>
            </li>
          ))}
        </ul>

        {/* 나중에 보기 (subtle) */}
        <button
          onClick={handleClose}
          style={{
            width: '100%', padding: '8px', background: 'transparent', border: 'none',
            cursor: 'pointer', color: 'var(--text-tertiary)',
            fontSize: 'var(--fs-xs, 12px)', textDecoration: 'underline',
          }}
        >
          나중에 보기 (7일간 안 보기)
        </button>
      </div>

      <style>{`
        @keyframes kdNudgeFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes kdNudgeSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes kdNudgeSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
