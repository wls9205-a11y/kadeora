'use client';
import { isTossMode } from '@/lib/toss-mode';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { trackConversion } from '@/lib/track-conversion';
import { usePathname } from 'next/navigation';

/**
 * AutoPushPrompt v2 — 비로그인 + 스크롤 트리거 + 맥락별 메시지
 *
 * v1: 로그인 필수 + 5초 딜레이 → 구독자 0명 (실패)
 * v2: 비로그인 OK + 글 75% 스크롤 후 트리거 + 카테고리 맞춤
 *
 * 비로그인: visitor_id로 push_subscriptions에 저장
 * 로그인: user_id로 push_subscriptions에 저장 + notification_settings 생성
 */
export default function AutoPushPrompt() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const { userId, loading: authLoading } = useAuth();
  const pathname = usePathname();

  const getContextMessage = useCallback(() => {
    if (pathname.includes('/blog/apt') || pathname.includes('/apt/'))
      return { title: '이 단지 관련 새 글 알림', desc: '가격 변동·청약 마감 소식을 바로 받아보세요' };
    if (pathname.includes('/blog/stock') || pathname.includes('/stock/'))
      return { title: '이 종목 관련 알림', desc: '급등/급락·AI 분석 리포트를 받아보세요' };
    if (pathname.includes('/blog/redev'))
      return { title: '재개발 진행 알림', desc: '단계 변경·조합 소식을 놓치지 마세요' };
    return { title: '새 글이 올라오면 알림 받기', desc: '관심 분야 업데이트를 실시간으로 받아보세요' };
  }, [pathname]);

  useEffect(() => {
    if (isTossMode()) return;
    if (authLoading) return;
    if (typeof window === 'undefined') return;
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted' || Notification.permission === 'denied') return;

    // 쿨다운: 7일 (닫은 후)
    const dismissed = localStorage.getItem('kd-push-dismissed');
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    // 이미 구독했으면 표시 안 함
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => {
        if (sub) return; // 이미 구독됨

        // v2: 스크롤 75% 이상 도달 시 표시
        const handleScroll = () => {
          const scrollTop = window.scrollY || document.documentElement.scrollTop;
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          if (docHeight <= 0) return;
          const scrollPercent = scrollTop / docHeight;
          if (scrollPercent >= 0.75) {
            window.removeEventListener('scroll', handleScroll);
            // 0.5초 딜레이 (스크롤 멈추면 표시)
            setTimeout(() => setShow(true), 500);
          }
        };

        // 블로그/상세 페이지에서만 스크롤 트리거
        const isDetailPage = pathname.includes('/blog/') || pathname.includes('/apt/') || pathname.includes('/stock/');
        if (isDetailPage) {
          window.addEventListener('scroll', handleScroll, { passive: true });
          return () => window.removeEventListener('scroll', handleScroll);
        }
      })
    ).catch(() => {});
  }, [userId, authLoading, pathname]);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setShow(false);
        localStorage.setItem('kd-push-dismissed', String(Date.now()));
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), visitor_id: localStorage.getItem('kd_visitor_id') }),
      });

      // 로그인 유저만 notification_settings 생성
      if (userId) {
        await fetch('/api/notifications/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            push_comments: true, push_likes: true, push_follows: true,
            push_apt_deadline: true, push_hot_posts: true,
            push_stock_alert: true, push_attendance: true, push_marketing: true,
          }),
        });
      }

      setShow(false);
      localStorage.setItem('kd-push-subscribed', '1');
      trackConversion('cta_complete', 'push_prompt');
    } catch {
      setShow(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('kd-push-dismissed', String(Date.now()));
  };

  if (!show) return null;

  const ctx = getContextMessage();

  return (
    <div style={{
      position: 'fixed', bottom: 'calc(60px + env(safe-area-inset-bottom, 0px))',
      left: 12, right: 12, maxWidth: 480, margin: '0 auto', zIndex: 60,
      background: 'var(--bg-surface)', border: '1px solid var(--brand-border)',
      borderRadius: 'var(--radius-lg)', padding: '14px 16px',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', gap: 10,
      animation: 'slideUp 0.3s ease',
    }}>
      <div style={{ fontSize: 24, flexShrink: 0 }}>🔔</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
          {ctx.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
          {ctx.desc}
        </div>
      </div>
      <button onClick={handleEnable} disabled={loading} style={{
        padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none',
        background: 'var(--brand)', color: 'white',
        fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer',
        flexShrink: 0, opacity: loading ? 0.6 : 1,
      }}>{loading ? '...' : '허용'}</button>
      <button onClick={handleDismiss} aria-label="닫기" style={{
        background: 'none', border: 'none', color: 'var(--text-tertiary)',
        fontSize: 16, cursor: 'pointer', padding: 4, lineHeight: 1, flexShrink: 0,
      }}>✕</button>
    </div>
  );
}
