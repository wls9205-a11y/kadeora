'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { trackConversion } from '@/lib/track-conversion';

export default function ScrollToastCTA() {
  const { userId, loading } = useAuth();
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [mini, setMini] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const tracked = useRef(false);

  useEffect(() => {
    if (loading || userId) return;
    if (sessionStorage.getItem('kd_toast_dismissed')) return;
    // StickyBar가 아직 표시 중이면 ScrollToast 안 띄움 (같은 위치 겹침 방지)
    if (!sessionStorage.getItem('kd_sticky_dismissed')) return;

    let triggered = false;
    const trigger = () => {
      if (triggered) return;
      triggered = true;
      setShow(true);
      if (!tracked.current) {
        tracked.current = true;
        trackConversion('cta_view', 'scroll_toast', { pagePath: pathname });
      }
      setTimeout(() => setMini(true), 5000);
    };

    // 트리거 1: 스크롤 35%
    const onScroll = () => {
      const scrollPct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
      if (scrollPct > 0.35) trigger();
    };
    // 트리거 2: 12초 체류 (스크롤 없어도)
    const timer = setTimeout(trigger, 12000);

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(timer); };
  }, [pathname, userId, loading]);

  if (!show || dismissed || loading || userId) return null;

  const url = `/login?redirect=${encodeURIComponent(pathname)}&source=scroll_toast`;

  if (mini) {
    return (
      <div style={{
        position: 'fixed', bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))', right: 12, zIndex: 88,
      }}>
        <Link href={url}
          onClick={() => trackConversion('cta_click', 'scroll_toast_mini', { pagePath: pathname })}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 44, height: 44, borderRadius: '50%',
            background: '#FEE500', color: '#191919',
            fontSize: 12, fontWeight: 800, textDecoration: 'none',
            boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
          }}>🔔</Link>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))', left: 12, right: 12, zIndex: 88,
      background: 'var(--bg-surface, #0F1A2E)', border: '1px solid rgba(59,123,246,0.15)',
      borderRadius: 14, padding: '10px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
      animation: 'slideUp .3s ease-out',
      boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
          비슷한 분석 매일 받아보세요
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          관심 분야 맞춤 알림 · AI 분석 무료
        </div>
      </div>
      <Link href={url}
        onClick={() => trackConversion('cta_click', 'scroll_toast', { pagePath: pathname })}
        style={{
          padding: '7px 14px', borderRadius: 14,
          background: '#FEE500', color: '#191919',
          fontSize: 11, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
        }}>무료 가입</Link>
      <button onClick={() => {
        setDismissed(true);
        sessionStorage.setItem('kd_toast_dismissed', '1');
      }} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 12, cursor: 'pointer', padding: '0 2px' }}>✕</button>
    </div>
  );
}