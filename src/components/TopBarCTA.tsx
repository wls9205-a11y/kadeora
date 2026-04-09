'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { trackConversion } from '@/lib/track-conversion';

function getMsg(path: string): { text: string; icon: string } | null {
  const t = typeof document !== 'undefined' ? document.title : '';
  const name = t.split(/[|·—\-]/)[0]?.trim()?.slice(0, 20);
  if (path.startsWith('/stock/')) return { text: `${name || '종목'} 급등/급락 알림 받기`, icon: '📈' };
  if (path.startsWith('/apt/')) return { text: `${name || '단지'} 시세 변동 알림 받기`, icon: '🏠' };
  if (path.startsWith('/blog/')) return { text: '이런 분석을 매일 받아보세요', icon: '📊' };
  return null;
}

const EXCLUDED = ['/', '/login', '/auth', '/onboarding', '/admin', '/terms', '/privacy', '/signup', '/feed', '/search', '/profile', '/settings'];

export default function TopBarCTA() {
  const { userId, loading } = useAuth();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  const tracked = useRef(false);

  useEffect(() => { tracked.current = false; }, [pathname]);

  useEffect(() => {
    if (!tracked.current && !userId && !loading) {
      const msg = getMsg(pathname);
      if (msg) {
        tracked.current = true;
        trackConversion('cta_view', 'topbar_cta', { pagePath: pathname });
      }
    }
  }, [userId, loading, pathname]);

  if (loading || userId || dismissed) return null;
  if (EXCLUDED.some(p => pathname === p || pathname.startsWith(p + '/'))) return null;

  const msg = getMsg(pathname);
  if (!msg) return null;

  const url = `/login?redirect=${encodeURIComponent(pathname)}&source=topbar_cta`;

  return (
    <div style={{
      background: 'linear-gradient(90deg, rgba(59,123,246,0.08), rgba(59,123,246,0.03))',
      borderBottom: '1px solid rgba(59,123,246,0.1)',
      padding: '7px 12px',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <span style={{ fontSize: 13 }}>{msg.icon}</span>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{msg.text}</span>
      <Link href={url}
        onClick={() => trackConversion('cta_click', 'topbar_cta', { pagePath: pathname })}
        style={{
          padding: '4px 12px', borderRadius: 12,
          background: '#FEE500', color: '#191919',
          fontSize: 11, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
        }}>카카오 가입</Link>
      <button onClick={() => { setDismissed(true); sessionStorage.setItem('kd_topbar_dismissed', '1'); }}
        style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 12, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
        aria-label="닫기">✕</button>
    </div>
  );
}