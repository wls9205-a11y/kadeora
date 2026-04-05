'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

/**
 * ScrollDepthGate — 스크롤 70% 도달 시 가입 유도 배너
 * - 비로그인 유저가 페이지 70% 이상 스크롤하면 하단 고정 배너 표시
 * - 세션당 1회, 닫으면 세션 동안 안 보임
 * - apt/stock 상세 페이지에서만 동작
 */
export default function ScrollDepthGate() {
  const [show, setShow] = useState(false);
  const { userId, loading } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined' || loading || userId) return;
    if (sessionStorage.getItem('kd_scroll_gate')) return;

    // apt/stock 상세만
    const isDetail = /^\/(apt|stock)\/[^/]+/.test(pathname);
    if (!isDetail) return;

    const handleScroll = () => {
      const scrollPct = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (scrollPct > 0.65) {
        sessionStorage.setItem('kd_scroll_gate', '1');
        setShow(true);
        window.removeEventListener('scroll', handleScroll);
      }
    };

    // 3초 후부터 감지
    const timer = setTimeout(() => {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }, 3000);

    return () => { clearTimeout(timer); window.removeEventListener('scroll', handleScroll); };
  }, [pathname, userId, loading]);

  if (!show) return null;

  const isApt = pathname.startsWith('/apt');
  const url = `/login?redirect=${encodeURIComponent(pathname)}`;

  return (
    <div style={{
      position: 'fixed', bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))', left: 0, right: 0,
      zIndex: 92, padding: '0 12px', animation: 'fadeInUp 0.3s ease-out',
    }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--brand-border, rgba(59,123,246,0.3))',
        borderRadius: 'var(--radius-card)', padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
      }}>
        <div style={{ fontSize: 20, flexShrink: 0 }}>{isApt ? '🏠' : '📈'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            {isApt ? '이 단지 관심등록 + 청약알림 받기' : '이 종목 급등알림 받기'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>무료 가입으로 모든 기능 이용</div>
        </div>
        <Link href={url} style={{
          background: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)',
          padding: '7px 14px', borderRadius: 'var(--radius-sm)',
          fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
        }}>가입</Link>
        <button onClick={() => setShow(false)} style={{
          background: 'transparent', border: 'none', color: 'var(--text-tertiary)',
          fontSize: 16, cursor: 'pointer', padding: 2, lineHeight: 1,
        }} aria-label="닫기">×</button>
      </div>
    </div>
  );
}
