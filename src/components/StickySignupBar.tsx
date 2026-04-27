'use client';
/**
 * StickySignupBar — s183 신규.
 *
 * 비로그인 유저에게만 표시되는 하단 고정 가입 유도 바.
 * 과거 ActionBar (CTR 0.03%) 를 대체. 디자인/동작 전면 리디자인.
 *
 * 표시 조건:
 *   - userId 없음 (비로그인)
 *   - scrollY > 300px
 *   - localStorage(kd_sticky_bar_closed) 가 24h 이내가 아님
 *   - InstallBanner 활성 중이 아님 (window.kd_install_banner_active 체크)
 *
 * z-index: 90 (InstallBanner 100 보다 아래, BlogFloatingBar 50 보다 위)
 */
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { trackCTA } from '@/lib/analytics';

const EXCLUDED = ['/', '/login', '/auth', '/onboarding', '/admin', '/terms', '/privacy'];
const CLOSE_KEY = 'kd_sticky_bar_closed';
const CLOSE_TTL_MS = 24 * 60 * 60 * 1000;

declare global { interface Window { kd_install_banner_active?: boolean } }

export default function StickySignupBar() {
  const { userId, loading } = useAuth();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [installActive, setInstallActive] = useState(false);

  useEffect(() => {
    setVisible(false);
  }, [pathname]);

  useEffect(() => {
    if (loading || userId) return;
    if (EXCLUDED.includes(pathname) || EXCLUDED.some(p => p !== '/' && pathname.startsWith(p + '/'))) return;

    try {
      const closedAt = parseInt(localStorage.getItem(CLOSE_KEY) || '0', 10);
      if (closedAt && Date.now() - closedAt < CLOSE_TTL_MS) return;
    } catch { /* localStorage 차단 환경 */ }

    const onScroll = () => {
      if (window.kd_install_banner_active) {
        setInstallActive(true);
        setVisible(false);
        return;
      }
      setInstallActive(false);
      setVisible(window.scrollY > 300);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [loading, userId, pathname]);

  useEffect(() => {
    if (visible) trackCTA('view', 'sticky_signup_bar', { page_path: pathname });
  }, [visible, pathname]);

  if (loading || userId || !visible || installActive) return null;

  const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}&source=sticky_signup_bar`;

  const handleClose = () => {
    try { localStorage.setItem(CLOSE_KEY, String(Date.now())); } catch {}
    trackCTA('dismiss', 'sticky_signup_bar', { page_path: pathname });
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="가입 유도"
      style={{
        position: 'fixed',
        left: 0, right: 0,
        bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
        zIndex: 90,
        height: 52,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 14px',
        background: 'linear-gradient(135deg, #0F1B3E, #1a2b55)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 -6px 24px rgba(0,0,0,0.35)',
        animation: 'kdStickyBarSlide .3s ease-out',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        🔔 청약·주식 알림 무료
      </span>
      <a
        href={loginUrl}
        onClick={() => trackCTA('click', 'sticky_signup_bar', { page_path: pathname })}
        style={{
          flexShrink: 0,
          padding: '8px 16px',
          borderRadius: 999,
          background: '#FEE500',
          color: '#191919',
          fontSize: 13,
          fontWeight: 800,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        카카오 3초 가입
      </a>
      <button
        onClick={handleClose}
        aria-label="닫기"
        style={{
          flexShrink: 0,
          width: 28, height: 28,
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.5)',
          fontSize: 18,
          cursor: 'pointer',
          padding: 0,
          lineHeight: 1,
        }}
      >×</button>
      <style>{`@keyframes kdStickyBarSlide{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );
}
