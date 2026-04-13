'use client';
import { errMsg } from '@/lib/error-utils';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface LoginFormProps {
  redirect: string;
}

function LoginForm({ redirect }: LoginFormProps) {
  const [loading, setLoading] = useState<'kakao' | 'google' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    if (invite) localStorage.setItem('kd_invite_code', invite);
  }, []);

  const login = async (provider: 'kakao' | 'google') => {
    setLoading(provider);
    setError('');
    const source = new URLSearchParams(window.location.search).get('source') || 'direct';
    // 가입 시도 추적
    fetch('/api/auth/track-attempt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, source, redirect_path: redirect, success: false }) }).catch(() => {});
    try {
      const sb = createSupabaseBrowser();
      const { error: err } = await sb.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}&source=${source}`,
        },
      });
      if (err) throw err;
    } catch (e: unknown) {
      setError(e instanceof Error ? errMsg(e) : '로그인 중 오류가 발생했습니다');
      setLoading(null);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: 400 }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--brand)', fontFamily: 'monospace', letterSpacing: '-1px', marginBottom: 'var(--sp-sm)' }}>
          카더라
        </div>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--fs-base)' }}>아는 사람만 아는 그 정보</p>
      </div>

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '36px 32px', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center' }}>로그인</h2>
        {(() => {
          const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
          const source = params?.get('source') || '';
          const action = params?.get('action') || '';
          const MSG: Record<string, { icon: string; text: string }> = {
            content_gate: { icon: '📊', text: '가입하면 7,600+ 분석 전문을 무제한 열람할 수 있어요' },
            action_bar_bookmark: { icon: '📌', text: '가입하면 이 분석을 저장하고 나중에 다시 볼 수 있어요' },
            action_bar_alert: { icon: '🔔', text: '가입하면 이 단지의 가격 변동 알림을 받을 수 있어요' },
            action_bar_watchlist: { icon: '⭐', text: '가입하면 관심 종목을 추가하고 시세 알림을 받을 수 있어요' },
            action_bar_comment: { icon: '💬', text: '가입하면 댓글을 달고 토론에 참여할 수 있어요' },
            calc_gate: { icon: '🎯', text: '가입하면 맞춤 전략과 지역별 커트라인을 확인할 수 있어요' },
            smart_gate: { icon: '🔓', text: '가입하면 전체 분석과 AI 투자 의견을 무료로 볼 수 있어요' },
          };
          const key = action ? `${source}_${action}` : source;
          const msg = MSG[key] || MSG[source];
          if (!msg) return <p style={{ margin: '0 0 32px', color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', textAlign: 'center', lineHeight: 1.5 }}>소셜 계정으로 간편하게 시작하세요</p>;
          return (
            <div style={{ margin: '0 0 24px', padding: '12px 16px', borderRadius: 12, background: 'rgba(59,123,246,0.06)', border: '1px solid rgba(59,123,246,0.1)', textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{msg.icon}</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.5 }}>{msg.text}</div>
            </div>
          );
        })()}

        <button
          onClick={() => login('kakao')}
          disabled={!!loading}
          style={{ width: '100%', padding: '14px 20px', marginBottom: 'var(--sp-md)', borderRadius: 'var(--radius-card)', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)', fontWeight: 700, fontSize: 'var(--fs-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: loading === 'google' ? 0.5 : 1, transition: 'all 0.15s' }}
        >
          {loading === 'kakao' ? (
            <div style={{ width: 24, height: 24, border: '2px solid var(--kakao-text, #191919)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 512 512" fill="currentColor">
              <path d="M255.5 48C141.1 48 48 126.1 48 222.4c0 62.2 38.7 116.7 97 149.8l-24.1 89.7c-2.1 7.9 6.8 14.4 13.7 9.9l101.2-65.2c7.2 1 14.6 1.5 22.2 1.5 114.4 0 207.5-78.1 207.5-174.4S369.9 48 255.5 48z"/>
            </svg>
          )}
          {loading === 'kakao' ? '로그인 중...' : '카카오로 계속하기'}
        </button>

        <button
          onClick={() => login('google')}
          disabled={!!loading}
          style={{ width: '100%', padding: '14px 20px', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', cursor: loading ? 'not-allowed' : 'pointer', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontWeight: 700, fontSize: 'var(--fs-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: loading === 'kakao' ? 0.5 : 1, transition: 'all 0.15s' }}
        >
          {loading === 'google' ? (
            <div style={{ width: 24, height: 24, border: '2px solid var(--text-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          {loading === 'google' ? '로그인 중...' : 'Google로 계속하기'}
        </button>

        {error && (
          <div style={{ marginTop: 'var(--sp-lg)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: 'var(--error)', fontSize: 'var(--fs-sm)' }}>
            ⚠ {error}
          </div>
        )}

        <p style={{ margin: '24px 0 0', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.6 }}>
          로그인 시{' '}
          <a href="/terms" style={{ color: 'var(--brand)', textDecoration: 'none' }}>이용약관</a>
          {' '}및{' '}
          <a href="/privacy" style={{ color: 'var(--brand)', textDecoration: 'none' }}>개인정보처리방침</a>
          에 동의하게 됩니다
        </p>
      </div>
    </div>
  );
}

export default function LoginClient() {
  const [redirect, setRedirect] = useState('/feed');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('redirect');
    if (r && r.startsWith('/')) setRedirect(r);
  }, []);
  return <LoginForm redirect={redirect} />;
}