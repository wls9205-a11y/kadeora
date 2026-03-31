'use client';
import { isTossMode } from '@/lib/toss-mode';
import { useState, useEffect } from 'react';

export default function InstallBanner() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (isTossMode()) return; // 토스 미니앱에서 숨김
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    const dismissed = localStorage.getItem('kd_install_dismissed');
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    // GuestWelcome이 처리될 때까지 대기
    const cookieConsent = localStorage.getItem('kd_cookie_consent');
    if (cookieConsent !== 'accepted' && cookieConsent !== 'declined') {
      const interval = setInterval(() => {
        const c = localStorage.getItem('kd_cookie_consent');
        if (c === 'accepted' || c === 'declined') {
          clearInterval(interval);
          // GuestWelcome 닫은 직후라면 10초 유예
          setTimeout(() => showBanner(), 10000);
        }
      }, 2000);
      return () => clearInterval(interval);
    }

    // 이미 쿠키 동의된 상태면 바로 (단, GuestWelcome 닫은 직후면 유예)
    const welcomeDismissed = localStorage.getItem('kd-welcome-dismissed');
    if (welcomeDismissed && Date.now() - Number(welcomeDismissed) < 10000) {
      setTimeout(() => showBanner(), 10000 - (Date.now() - Number(welcomeDismissed)));
      return;
    }

    showBanner();

    function showBanner() {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      setIsIOS(ios);
      const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); setShow(true); };
      window.addEventListener('beforeinstallprompt', handler);
      if (ios) setTimeout(() => setShow(true), 4000);
    }
  }, []);

  const hap = (s: 'light' | 'medium' | 'heavy' = 'light') => { try { if ('vibrate' in navigator) navigator.vibrate(s === 'heavy' ? [15, 5, 15] : s === 'medium' ? 12 : 6); } catch {} };

  const logInstall = (platform: string) => {
    fetch('/api/pwa/install', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform }) }).catch(() => {});
  };

  const requestPush = async () => {
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
      if (Notification.permission !== 'default') return;
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY });
      await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
    } catch {}
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') { setShow(false); hap('heavy'); logInstall('android'); setTimeout(requestPush, 1500); }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('kd_install_dismissed', String(Date.now()));
  };

  if (!show) return null;

  return (
    <>
      <div style={{
        position: 'fixed', bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))', left: 12, right: 12, zIndex: 60,
        background: 'linear-gradient(135deg, var(--brand), var(--accent-blue))',
        borderRadius: 'var(--radius-lg)', padding: 'var(--card-p) var(--sp-lg)',
        boxShadow: '0 8px 32px rgba(37,99,235,0.45)',
        display: 'flex', alignItems: 'center', gap: 'var(--sp-md)',
      }}>
        <div style={{ fontSize: 'var(--fs-2xl)', flexShrink: 0 }}>📲</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-inverse)', marginBottom: 2 }}>앱처럼 사용하기</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'rgba(255,255,255,0.9)' }}>홈화면에 추가하면 푸시 알림도 받을 수 있어요!</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xs)', flexShrink: 0 }}>
          <button onClick={() => { hap('light'); handleInstall(); }} style={{
            padding: '8px 14px', background: 'var(--bg-primary)', color: 'var(--brand)',
            border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)', fontWeight: 800, cursor: 'pointer',
          }}>{isIOS ? '방법 보기' : '📲 설치하기'}</button>
          <button onClick={handleDismiss} style={{
            padding: '3px 0', background: 'transparent',
            color: 'rgba(255,255,255,0.7)', border: 'none', fontSize: 'var(--fs-xs)', cursor: 'pointer', textAlign: 'center',
          }}>나중에</button>
        </div>
      </div>

      {showIOSGuide && (
        <>
          <div onClick={() => setShowIOSGuide(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 80 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 90,
            background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', padding: '20px 24px 40px',
          }}>
            <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--sp-xs)' }}>📲 홈화면에 추가하기</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-xl)' }}>Safari에서 아래 순서로 따라하세요</div>
            {[
              { n: '1', text: 'Safari 하단 가운데 공유 버튼(⬆️) 탭' },
              { n: '2', text: '스크롤해서 "홈 화면에 추가" 탭' },
              { n: '3', text: '오른쪽 상단 "추가" 탭 — 완료!' },
            ].map(s => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand)', color: 'var(--text-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-sm)', fontWeight: 800, flexShrink: 0 }}>{s.n}</div>
                <span style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)' }}>{s.text}</span>
              </div>
            ))}
            <button onClick={() => { hap('light'); setShowIOSGuide(false); handleDismiss(); logInstall('ios'); setTimeout(requestPush, 1000); }}
              style={{ marginTop: 'var(--sp-xl)', width: '100%', padding: '14px 0', background: 'var(--brand)', color: 'var(--text-inverse)', border: 'none', borderRadius: 'var(--radius-card)', fontSize: 'var(--fs-md)', fontWeight: 700, cursor: 'pointer' }}>
              알겠어요!
            </button>
          </div>
        </>
      )}
    </>
  );
}
