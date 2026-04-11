'use client';
import { useState, useEffect } from 'react';

export default function PushPromptBanner() {
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') return;
    if (sessionStorage.getItem('kd_push_dismissed')) return;
    const t = setTimeout(() => setShow(true), 5000);
    return () => clearTimeout(t);
  }, []);

  const handleAllow = async () => {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      setDone(true);
      fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type: 'cta_complete', cta_name: 'push_prompt_blog' }) }).catch(() => {});
      setTimeout(() => setShow(false), 2000);
    }
  };

  const dismiss = () => { sessionStorage.setItem('kd_push_dismissed', '1'); setShow(false); };

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: 16, right: 16, maxWidth: 400, margin: '0 auto',
      padding: '14px 16px', borderRadius: 14, zIndex: 999,
      background: 'linear-gradient(135deg, rgba(12,21,40,0.98), rgba(20,30,50,0.98))',
      border: '1px solid rgba(59,123,246,0.2)', backdropFilter: 'blur(12px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      {done ? (
        <div style={{ textAlign: 'center', fontSize: 14, color: '#10B981', fontWeight: 600 }}>✅ 알림 설정 완료!</div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>🔔 청약·종목 알림 받기</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>새 분석이 올라오면 바로 알려드려요</div>
            </div>
            <button onClick={dismiss} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 18, cursor: 'pointer', padding: 4 }}>×</button>
          </div>
          <button onClick={handleAllow} style={{
            width: '100%', marginTop: 10, padding: '10px', borderRadius: 8,
            border: 'none', background: '#3B7BF6', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>알림 허용하기</button>
        </>
      )}
    </div>
  );
}
