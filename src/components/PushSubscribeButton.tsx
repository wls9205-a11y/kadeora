'use client';
import { useState, useEffect } from 'react';

type PushStatus = 'idle' | 'subscribed' | 'denied' | 'unsupported' | 'not-pwa' | 'loading';

export default function PushSubscribeButton() {
  const [status, setStatus] = useState<PushStatus>('loading');

  useEffect(() => {
    if (typeof window === 'undefined') { setStatus('unsupported'); return; }

    // iOS standalone 체크
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || navigator.standalone === true;

    if (!('PushManager' in window)) {
      // iOS Safari (PWA 아님)인 경우
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      setStatus(isIOS && !isStandalone ? 'not-pwa' : 'unsupported');
      return;
    }

    // Notification 권한 확인
    if ('Notification' in window && Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }

    navigator.serviceWorker?.ready?.then(reg =>
      reg.pushManager.getSubscription().then(sub => setStatus(sub ? 'subscribed' : 'idle'))
    ).catch(() => setStatus('idle'));
  }, []);

  const handleSubscribe = async () => {
    setStatus('loading');
    try {
      // iOS 16.4+ 에서는 Notification.requestPermission() 먼저 필요
      if ('Notification' in window && Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') { setStatus('denied'); return; }
      }

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

  const boxStyle = {
    fontSize: 'var(--fs-sm)', padding: '12px 16px', borderRadius: 10, marginTop: 8,
    lineHeight: 1.5, textAlign: 'center' as const,
  };

  if (status === 'loading') return null;

  if (status === 'subscribed') return (
    <div style={{ ...boxStyle, color: 'var(--accent-green)', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
      ✅ 푸시 알림 활성화됨
    </div>
  );

  if (status === 'not-pwa') return (
    <div style={{ ...boxStyle, color: 'var(--text-secondary)', background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
      📱 푸시 알림을 받으려면 <strong>홈 화면에 추가</strong> 후 앱에서 다시 설정해주세요.
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 6 }}>
        Safari 하단 공유 버튼 → &quot;홈 화면에 추가&quot;
      </div>
    </div>
  );

  if (status === 'denied') return (
    <div style={{ ...boxStyle, color: 'var(--accent-red)', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
      🚫 알림이 차단되어 있습니다.
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 6 }}>
        기기 설정 → 카더라 → 알림 허용을 켜주세요.
      </div>
    </div>
  );

  if (status === 'unsupported') return (
    <div style={{ ...boxStyle, color: 'var(--text-tertiary)', background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
      이 브라우저에서는 푸시 알림을 지원하지 않습니다.
    </div>
  );

  return (
    <button onClick={handleSubscribe}
      style={{
        padding: '12px 16px', width: '100%', marginTop: 8,
        background: 'var(--brand)', color: 'var(--text-inverse)',
        border: 'none', borderRadius: 10,
        fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer',
        transition: 'opacity 0.15s',
      }}
    >
      🔔 알림 받기
    </button>
  );
}
