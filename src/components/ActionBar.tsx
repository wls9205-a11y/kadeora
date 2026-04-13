'use client';
/**
 * ActionBar v3 — 카카오 원버튼 하단 고정 바
 * 
 * - 비로그인 유저에게 3초 후 등장 · 닫기 가능
 * - SmartSectionGate 게이트 카드가 viewport에 있으면 자동 숨김
 * - 페이지 카테고리별 컨텍스트 메시지
 */
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { trackCTA } from '@/lib/analytics';

const EXCLUDED = ['/', '/login', '/auth', '/onboarding', '/admin', '/terms', '/privacy'];

function getContextMessage(path: string): { title: string; sub: string } {
  if (path.startsWith('/blog/')) return { title: '이 분석 전체 보기 · 무료', sub: '스팸 없음 · 3초 가입' };
  if (path.startsWith('/apt/')) return { title: '이 단지 가격 변동 알림 받기', sub: '실거래 등록 시 알림 · 무료' };
  if (path.startsWith('/stock/')) return { title: '이 종목 알림 받기 · 무료', sub: '급등락 · AI 분석 · 실적 공시' };
  if (path.startsWith('/calc/')) return { title: '계산 결과 저장하기 · 무료', sub: '3초 가입 · 무제한 이용' };
  return { title: '청약·주식 알림 무료로 받기', sub: '스팸 없음 · 3초 가입 · 전체 분석 무료' };
}

export default function ActionBar() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [gateVisible, setGateVisible] = useState(false);
  const { userId, loading } = useAuth();
  const pathname = usePathname();
  const obsRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    setVisible(false);
    setDismissed(false);
    setGateVisible(false);
  }, [pathname]);

  // SmartSectionGate 게이트 카드 감지 — 겹치면 숨김
  useEffect(() => {
    if (loading || userId) return;
    const gate = document.querySelector('[data-cta="content-gate"]');
    if (!gate) return;
    obsRef.current = new IntersectionObserver(([e]) => {
      setGateVisible(e.isIntersecting);
    }, { threshold: 0.1 });
    obsRef.current.observe(gate);
    return () => { obsRef.current?.disconnect(); };
  }, [pathname, userId, loading, visible]);

  useEffect(() => {
    if (loading || userId) return;
    if (EXCLUDED.includes(pathname)) return;
    const timer = setTimeout(() => {
      setVisible(true);
      trackCTA('view', 'action_bar_kakao', { page_path: pathname });
    }, 3000);
    return () => clearTimeout(timer);
  }, [pathname, userId, loading]);

  if (!visible || dismissed || loading || userId || gateVisible) return null;

  const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}&source=action_bar`;
  const msg = getContextMessage(pathname);

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
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4F8', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {msg.title}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(224,232,240,0.3)', marginTop: 2 }}>
            {msg.sub}
          </div>
        </div>

        <a
          href={loginUrl}
          onClick={() => trackCTA('click', 'action_bar_kakao', { page_path: pathname })}
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
