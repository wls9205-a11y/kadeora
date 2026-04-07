'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { trackConversion } from '@/lib/track-conversion';

const EXCLUDED = ['/', '/login', '/auth', '/onboarding', '/admin', '/terms', '/privacy', '/signup'];

function getMessage(path: string): { text: string; icon: string } | null {
  // document.title에서 엔티티명 추출 (SSR 후 hydration 시점)
  const title = typeof document !== 'undefined' ? document.title : '';
  const entityName = title.split(' ')[0]?.replace(/[|·—-]/g, '').trim();

  if (path.startsWith('/stock/')) {
    return { text: `${entityName || '종목'} 알림 받기`, icon: 'bell' };
  }
  if (path.startsWith('/apt/')) {
    return { text: `${entityName || '단지'} 청약 알림`, icon: 'home' };
  }
  if (path.startsWith('/blog/')) {
    return { text: '이 분석 저장 + 알림', icon: 'bookmark' };
  }
  if (path.startsWith('/feed')) {
    return { text: '토론에 참여하기', icon: 'chat' };
  }
  return { text: '무료 알림 받기', icon: 'bell' };
}

const ICONS: Record<string, string> = {
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>',
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
};

export default function StickyBar() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { userId, loading } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || userId) return;
    if (EXCLUDED.some(p => pathname === p || pathname.startsWith(p + '/'))) return;
    if (sessionStorage.getItem('kd_sticky_dismissed')) { setDismissed(true); return; }

    const timer = setTimeout(() => {
      setVisible(true);
      trackConversion('cta_view', 'sticky_bar', { pagePath: pathname });
    }, 8000);
    return () => clearTimeout(timer);
  }, [pathname, userId, loading]);

  if (!visible || dismissed || loading || userId) return null;

  const msg = getMessage(pathname);
  if (!msg) return null;

  const url = `/login?redirect=${encodeURIComponent(pathname)}`;

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
      left: 0, right: 0, zIndex: 88,
      background: 'var(--bg-surface, #0F1A2E)',
      borderTop: '1px solid var(--brand-border, rgba(59,123,246,0.2))',
      padding: '8px 16px',
      display: 'flex', alignItems: 'center', gap: 8,
      animation: 'slideUp .3s ease-out',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="var(--brand, #3B82F6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: ICONS[msg.icon] }} />
      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{msg.text}</span>
      <Link href={url}
        onClick={() => trackConversion('cta_click', 'sticky_bar', { pagePath: pathname })}
        style={{
          padding: '6px 16px', borderRadius: 16,
          background: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)',
          fontSize: 11, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
        }}>3초 무료 가입</Link>
      <button onClick={() => {
        setDismissed(true);
        sessionStorage.setItem('kd_sticky_dismissed', '1');
      }} style={{
        background: 'none', border: 'none', color: 'var(--text-tertiary)',
        fontSize: 14, cursor: 'pointer', padding: 2, lineHeight: 1,
      }} aria-label="닫기">x</button>
    </div>
  );
}
