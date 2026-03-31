'use client';
import { isTossMode } from '@/lib/toss-mode';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';

/**
 * 로그인 후 자동 푸시 알림 프롬프트
 * - 푸시 구독 안 되어있으면 하단에 "알림 받기" 배너 1회 표시
 * - 버튼 하나 누르면: 권한 요청 → 구독 → DB 저장 → 알림 설정 자동 생성 (전부 ON)
 * - 한번 닫거나 구독하면 다시 안 뜸
 */
export default function AutoPushPrompt() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const { userId, loading: authLoading } = useAuth();

  useEffect(() => {
    if (isTossMode()) return;
    if (authLoading) return;
    if (!userId) return; // 비로그인이면 안 보여줌

    if (typeof window === 'undefined') return;
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) return;
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted' || Notification.permission === 'denied') return;

    const dismissed = localStorage.getItem('kd-push-dismissed');
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => {
        if (!sub) {
          setTimeout(() => setShow(true), 5000);
        }
      })
    ).catch(() => {});
  }, [userId, authLoading]);

  const handleEnable = async () => {
    setLoading(true);
    try {
      // 1. 권한 요청
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setShow(false);
        localStorage.setItem('kd-push-dismissed', String(Date.now()));
        return;
      }

      // 2. 서비스 워커 구독
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      // 3. 서버에 구독 정보 저장
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });

      // 4. 알림 설정 자동 생성 (전부 ON)
      await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          push_comments: true,
          push_likes: true,
          push_follows: true,
          push_apt_deadline: true,
          push_hot_posts: true,
          push_stock_alert: true,
          push_attendance: true,
          push_marketing: true,
        }),
      });

      setShow(false);
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

  return (
    <div style={{
      position: 'fixed', bottom: 72, left: 12, right: 12, zIndex: 60,
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '16px 20px',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', gap: 12,
      animation: 'slideUp 0.3s ease',
    }}>
      <div style={{ fontSize: 28, flexShrink: 0 }}>🔔</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
          알림을 켜시겠어요?
        </div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
          청약 마감, 종목 알림을 실시간으로 받아보세요
        </div>
      </div>
      <button
        onClick={handleEnable}
        disabled={loading}
        style={{
          padding: '10px 20px', borderRadius: 10, border: 'none',
          background: 'var(--brand)', color: 'white',
          fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer',
          flexShrink: 0, opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? '...' : '허용'}
      </button>
      <button
        onClick={handleDismiss}
        style={{
          background: 'none', border: 'none', color: 'var(--text-tertiary)',
          fontSize: 'var(--fs-md)', cursor: 'pointer', padding: 4, flexShrink: 0,
        }}
        aria-label="닫기"
      >
        ✕
      </button>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
