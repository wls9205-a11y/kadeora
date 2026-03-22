'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

// VAPID 공개키 (환경변수에서)
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function PushNotificationSetup() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window && VAPID_PUBLIC_KEY) {
      setSupported(true);
      // 이미 구독 중인지 확인
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setSubscribed(!!sub);
        });
      });
    }
  }, []);

  async function subscribe() {
    if (!VAPID_PUBLIC_KEY) return;
    setLoading(true);
    try {
      const sb = createSupabaseBrowser();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { alert('로그인이 필요합니다'); setLoading(false); return; }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // 구독 정보 서버에 저장
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      setSubscribed(true);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function unsubscribe() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await fetch('/api/push/subscribe', { method: 'DELETE' });
        setSubscribed(false);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  if (!supported) return null;

  return (
    <button
      onClick={subscribed ? unsubscribe : subscribe}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
        border: subscribed ? '1px solid var(--success)' : '1px solid var(--border)',
        background: subscribed ? 'var(--success-bg)' : 'var(--bg-hover)',
        color: subscribed ? 'var(--success)' : 'var(--text-primary)',
        fontSize: 'var(--fs-base)', fontWeight: 600, opacity: loading ? 0.6 : 1,
        transition: 'all 0.15s', width: '100%',
      }}
    >
      {loading ? '⟳ 처리 중...' : subscribed ? '🔔 알림 켜짐 (끄려면 클릭)' : '🔔 푸시 알림 받기'}
    </button>
  );
}