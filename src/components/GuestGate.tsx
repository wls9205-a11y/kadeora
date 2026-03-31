'use client';
import { isTossMode } from '@/lib/toss-mode';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export function GuestGate({ children, isLoggedIn }: { children: React.ReactNode; isLoggedIn: boolean }) {
  const [showGate, setShowGate] = useState(false);
  const { userId } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (isTossMode()) return;
    if (isLoggedIn || userId) return;

    // 이전에 닫은 적 있으면 3일간 안 보여줌
    const dismissed = localStorage.getItem('kd_gate_dismissed');
    if (dismissed && Date.now() - Number(dismissed) < 3 * 24 * 60 * 60 * 1000) return;

    // 방문 횟수 카운터 — 5회차부터 게이트 표시
    const visitCount = parseInt(localStorage.getItem('kd_visit_count') || '0') + 1;
    localStorage.setItem('kd_visit_count', String(visitCount));

    if (visitCount < 5) return;

    const timer = setTimeout(() => {
      setShowGate(true);
    }, 30000);
    return () => clearTimeout(timer);
  }, [isLoggedIn, userId]);

  const handleDismiss = () => {
    setShowGate(false);
    localStorage.setItem('kd_gate_dismissed', String(Date.now()));
  };

  return (
    <>
      {children}
      {showGate && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 80,
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: 'var(--bg-surface)', borderRadius: 'var(--radius-xl)', padding: '32px 28px',
            maxWidth: 380, width: '100%', textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 'var(--sp-md)' }}>👀</div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)' }}>
              더 보려면 가입하세요
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--sp-xl)' }}>
              주식 시세 · 청약 알림 · 실시간 토론<br />
              무료로 모든 기능을 이용할 수 있어요
            </div>
            <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} style={{
              display: 'block', padding: '12px 0', borderRadius: 'var(--radius-card)',
              background: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)', fontWeight: 700, fontSize: 'var(--fs-md)',
              textDecoration: 'none', marginBottom: 10,
            }}>
              카카오로 3초 가입
            </Link>
            <button onClick={handleDismiss} style={{
              background: 'none', border: 'none', color: 'var(--text-tertiary)',
              fontSize: 'var(--fs-sm)', cursor: 'pointer', padding: '8px 0',
            }}>
              나중에 할게요
            </button>
          </div>
        </div>
      )}
    </>
  );
}
