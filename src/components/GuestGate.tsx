'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export function GuestGate({ children, isLoggedIn }: { children: React.ReactNode; isLoggedIn: boolean }) {
  const [showGate, setShowGate] = useState(false);

  useEffect(() => {
    // 서버에서 로그인 확인됐으면 즉시 리턴
    if (isLoggedIn) return;
    // 세션당 한 번만
    if (sessionStorage.getItem('kd_gate_shown')) return;

    // 클라이언트에서도 한번 더 확인 (chunked cookie 미인식 방어)
    const checkAuth = async () => {
      try {
        const { data } = await createSupabaseBrowser().auth.getSession();
        if (data.session) return; // 로그인 상태 → 게이트 안 띄움
      } catch { }

      const timer = setTimeout(() => {
        setShowGate(true);
        sessionStorage.setItem('kd_gate_shown', '1');
      }, 5000);
      return () => clearTimeout(timer);
    };

    checkAuth();
  }, [isLoggedIn]);

  return (
    <>
      {children}
      {showGate && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: 'var(--bg-surface)', borderRadius: 20, padding: '32px 28px',
            maxWidth: 380, width: '100%', textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👀</div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
              더 보려면 가입하세요
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
              주식 시세 · 청약 알림 · 실시간 토론<br />
              무료로 모든 기능을 이용할 수 있어요
            </div>
            <Link href="/login" style={{
              display: 'block', padding: '12px 0', borderRadius: 12,
              background: '#FEE500', color: '#191919', fontWeight: 700, fontSize: 'var(--fs-md)',
              textDecoration: 'none', marginBottom: 10,
            }}>
              카카오로 3초 가입
            </Link>
            <button onClick={() => setShowGate(false)} style={{
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
