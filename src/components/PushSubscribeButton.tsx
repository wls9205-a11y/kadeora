'use client';
import { useState, useEffect } from 'react';

export default function PushSubscribeButton() {
  const [status, setStatus] = useState<'idle' | 'subscribed' | 'denied' | 'loading'>('idle');

  useEffect(() => {
    if (typeof window === 'undefined' || !('PushManager' in window)) { setStatus('denied'); return; }
    navigator.serviceWorker?.ready?.then(reg =>
      reg.pushManager.getSubscription().then(sub => setStatus(sub ? 'subscribed' : 'idle'))
    ).catch(() => {});
  }, []);

  const handleSubscribe = async () => {
    setStatus('loading');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      setStatus('subscribed');
    } catch {
      setStatus('idle');
    }
  };

  if (status === 'denied') return null;
  if (status === 'subscribed') return (
    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '6px 0' }}>🔔 알림 구독 중</div>
  );

  return (
    <button onClick={handleSubscribe} disabled={status === 'loading'}
      style={{
        padding: '10px 16px', background: 'var(--brand)', color: '#fff',
        border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
        cursor: 'pointer', width: '100%', marginTop: 8,
      }}>
      {status === 'loading' ? '설정 중...' : '🔔 알림 받기'}
    </button>
  );
}
