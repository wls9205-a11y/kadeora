'use client';
/**
 * ActionBar v4 — 카카오 하단 고정 바 (항상 표시)
 *
 * - 비로그인 유저에게 3초 후 등장 · 닫기 가능
 * - v4: SmartSectionGate 숨김 로직 제거 → 항상 표시
 * - 페이지 카테고리별 컨텍스트 메시지
 */
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { trackCTA } from '@/lib/analytics';

const EXCLUDED = ['/', '/login', '/auth', '/onboarding', '/admin', '/terms', '/privacy'];

function getContextMessage(path: string): { title: string; sub: string } {
  if (path.startsWith('/blog/')) return { title: '이 분석이 도움됐다면 알림 받아보세요', sub: '3초 가입 · 스팸 없음' };
  if (path.startsWith('/apt/redev')) return { title: '재개발 단계 변경 알림 받기', sub: '관심 구역 추적 · 무료' };
  if (path.startsWith('/apt/complex/')) return { title: '이 단지 시세 변동 알림 받기', sub: '거래 등록 시 알림 · 무료' };
  if (path.startsWith('/apt/compare')) return { title: '비교 결과 저장하기', sub: '3초 가입 · 무제한 비교' };
  if (path.startsWith('/apt/diagnose')) return { title: '내 가점 저장 + 단지 매칭', sub: '맞춤 청약 추천 · 무료' };
  if (path.startsWith('/apt/search')) return { title: '관심 단지 시세 추적하기', sub: '새 거래 등록 시 알림' };
  if (path.startsWith('/apt/map')) return { title: '내 지역 부동산 알림 받기', sub: '분양·청약·시세 소식' };
  if (path.startsWith('/apt/')) return { title: '청약 마감 알림 받기', sub: '3초 가입 · 스팸 없음' };
  if (path.startsWith('/stock/')) return { title: '이 종목 목표가 알림 받기', sub: '급등락 · AI 분석 · 실적 공시' };
  if (path.startsWith('/calc/')) return { title: '계산 결과 저장하기', sub: '3초 가입 · 무제한 이용' };
  if (path.startsWith('/feed')) return { title: '커뮤니티 참여하기', sub: '글쓰기 · 댓글 · 투표' };
  return { title: '청약·주식 알림 무료로 받기', sub: '3초 가입 · 스팸 없음' };
}

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
      trackCTA('view', 'action_bar', { page_path: pathname });
    }, 3000);
    return () => clearTimeout(timer);
  }, [pathname, userId, loading]);

  if (!visible || dismissed || loading || userId) return null;

  const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}&source=action_bar`;
  const msg = getContextMessage(pathname);

  return (
    <>
      <div style={{
        position: 'fixed',
        bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
        left: 8, right: 8, zIndex: 88,
        background: 'rgba(11,17,32,0.96)',
        borderRadius: 'var(--radius-card)',
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        border: '1px solid rgba(255,255,255,0.05)',
        animation: 'kdSlideUp .3s ease-out',
        backdropFilter: 'blur(12px)',
      }}>
        <svg width="18" height="18" viewBox="0 0 512 512" fill="#FEE500" style={{ flexShrink: 0 }}>
          <path d="M255.5 48C141.1 48 48 126.1 48 222.4c0 62.2 38.7 116.7 97 149.8l-24.1 89.7c-2.1 7.9 6.8 14.4 13.7 9.9l101.2-65.2c7.2 1 14.6 1.5 22.2 1.5 114.4 0 207.5-78.1 207.5-174.4S369.9 48 255.5 48z" />
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {msg.title}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 1 }}>
            {msg.sub}
          </div>
        </div>

        <a
          href={loginUrl}
          onClick={() => trackCTA('click', 'action_bar', { page_path: pathname })}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            background: '#FEE500', color: '#191919', borderRadius: 10,
            padding: '10px 16px', fontSize: 13, fontWeight: 500,
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 512 512" fill="rgba(0,0,0,0.9)"><path d="M255.5 48C141.1 48 48 126.1 48 222.4c0 62.2 38.7 116.7 97 149.8l-24.1 89.7c-2.1 7.9 6.8 14.4 13.7 9.9l101.2-65.2c7.2 1 14.6 1.5 22.2 1.5 114.4 0 207.5-78.1 207.5-174.4S369.9 48 255.5 48z" /></svg>
          카카오 가입
        </a>

        <button
          onClick={() => setDismissed(true)}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.15)', fontSize: 18, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
          aria-label="닫기"
        >×</button>
      </div>
      <style>{`@keyframes kdSlideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </>
  );
}
