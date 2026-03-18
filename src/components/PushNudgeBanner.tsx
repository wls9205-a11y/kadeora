'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export default function PushNudgeBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (localStorage.getItem('push_nudge_granted') === '1') return;
    if (Notification.permission === 'granted') return;
    const dismissed = localStorage.getItem('push_nudge_dismissed_at');
    if (dismissed && Date.now() - Number(dismissed) < 3 * 24 * 60 * 60 * 1000) return;
    createSupabaseBrowser().auth.getUser().then(({ data }) => { if (data.user) setShow(true); });
  }, []);

  const handleEnable = async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY });
        await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
        localStorage.setItem('push_nudge_granted', '1');
      }
    } catch {}
    setShow(false);
  };

  if (!show) return null;
  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(255,69,0,0.12), rgba(255,100,0,0.06))', border: '1px solid rgba(255,69,0,0.25)', borderRadius: 12, padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>🔔 새 글 알림 받기</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>놓치는 소식 없이 받아보세요</div>
      </div>
      <button onClick={handleEnable} style={{ padding: '7px 14px', borderRadius: 8, background: 'var(--brand)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>알림 설정</button>
      <button onClick={() => { localStorage.setItem('push_nudge_dismissed_at', String(Date.now())); setShow(false); }} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>나중에</button>
    </div>
  );
}
