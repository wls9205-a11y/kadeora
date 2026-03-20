'use client';
import { useState, useCallback } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export function useAuthGuard() {
  const [showLoginSheet, setShowLoginSheet] = useState(false);

  const requireAuth = useCallback(async (): Promise<boolean> => {
    const sb = createSupabaseBrowser();
    const { data } = await sb.auth.getSession();
    if (data.session) return true;
    setShowLoginSheet(true);
    return false;
  }, []);

  const LoginSheet = useCallback(() => {
    if (!showLoginSheet) return null;
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div onClick={() => setShowLoginSheet(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
        <div style={{ position: 'relative', background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', padding: '32px 24px 40px', zIndex: 1, maxWidth: 480, width: '100%', margin: '0 auto' }}>
          <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 24px' }} />
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>카더라에 참여하기</div>
            <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>글쓰기, 댓글, 좋아요를 하려면 로그인이 필요해요</div>
          </div>
          <a href="/login" style={{
            display: 'block', width: '100%', padding: '14px', borderRadius: 12,
            background: '#FEE500', color: '#191919', fontWeight: 700, fontSize: 15,
            textAlign: 'center', textDecoration: 'none', marginBottom: 12,
          }}>카카오로 시작하기</a>
          <a href="/login" style={{
            display: 'block', width: '100%', padding: '14px', borderRadius: 12,
            background: 'var(--bg-hover)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontWeight: 600, fontSize: 15,
            textAlign: 'center', textDecoration: 'none',
          }}>다른 방법으로 로그인</a>
        </div>
      </div>
    );
  }, [showLoginSheet]);

  return { requireAuth, LoginSheet, showLoginSheet, setShowLoginSheet };
}
