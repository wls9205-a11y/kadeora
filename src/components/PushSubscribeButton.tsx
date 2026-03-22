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
    <div style={{
      fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', padding: '8px 0',
      textAlign: 'center', background: 'var(--bg-hover)', borderRadius: 10, marginTop: 8,
    }}>🔔 알림 설정됨</div>
  );

  return (
    <button onClick={handleSubscribe} disabled={status === 'loading'}
      style={{
        padding: '11px 16px',
        background: 'linear-gradient(135deg, #ef4444, #f97316)',
        color: '#fff', border: 'none', borderRadius: 10,
        fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', width: '100%', marginTop: 8,
        boxShadow: '0 4px 12px rgba(239,68,68,0.25)',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >
      {status === 'loading' ? '설정 중...' : '🔔 알림 받기'}
    </button>
  );
}
