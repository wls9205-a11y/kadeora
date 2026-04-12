'use client';
/**
 * ActionBar v2 — 카카오 원버튼 하단 고정 바
 * 
 * 비로그인 유저에게 3초 후 등장 · 닫기 가능
 * 카카오 노란색 통일 디자인
 */
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { trackCTA } from '@/lib/analytics';

const EXCLUDED = ['/', '/login', '/auth', '/onboarding', '/admin', '/terms', '/privacy'];

export default function ActionBar() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { userId, loading } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    setVisible(false);
    setDismissed(false);
  }, [pathname]);

  useEffect(() => {
    if (loading || userId) return;
    if (EXCLUDED.includes(pathname)) return;
    const timer = setTimeout(() => {
      setVisible(true);
      trackCTA('view', 'action_bar_kakao');
    }, 3000);
    return () => clearTimeout(timer);
  }, [pathname, userId, loading]);

  if (!visible || dismissed || loading || userId) return null;

  const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}&source=action_bar`;

  return (
    <>
      <div style={{
        position: 'fixed',
        bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
        left: 8, right: 8, zIndex: 88,
        background: '#0C1528',
        borderRadius: 'var(--radius-card)',
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        border: '1px solid rgba(254,229,0,0.08)',
        animation: 'kdSlideUp .3s ease-out',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
      }}>
        {/* 텍스트 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4F8', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            청약·주식 알림 무료로 받기
          </div>
          <div style={{ fontSize: 10, color: 'rgba(224,232,240,0.3)', marginTop: 2 }}>
            스팸 없음 · 3초 가입 · 전체 분석 무료
          </div>
        </div>

        {/* 카카오 버튼 */}
        <a
          href={loginUrl}
          onClick={() => trackCTA('click', 'action_bar_kakao')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#FEE500', color: '#191919', borderRadius: 'var(--radius-md)',
            padding: '8px 14px', fontSize: 12, fontWeight: 700,
            textDecoration: 'none', whiteSpace: 'nowrap',
            boxShadow: '0 0 16px rgba(254,229,0,0.1)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 512 512" fill="#191919"><path d="M255.5 48C141.1 48 48 126.1 48 222.4c0 62.2 38.7 116.7 97 149.8l-24.1 89.7c-2.1 7.9 6.8 14.4 13.7 9.9l101.2-65.2c7.2 1 14.6 1.5 22.2 1.5 114.4 0 207.5-78.1 207.5-174.4S369.9 48 255.5 48z" /></svg>
          카카오 시작
        </a>

        {/* 닫기 */}
        <button
          onClick={() => setDismissed(true)}
          style={{ background: 'none', border: 'none', color: 'rgba(224,232,240,0.2)', fontSize: 18, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
          aria-label="닫기"
        >×</button>
      </div>
      <style>{`@keyframes kdSlideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </>
  );
}
