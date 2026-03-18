'use client';
import { useState, useEffect } from 'react';

export default function InstallBanner() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    const dismissed = localStorage.getItem('kd_install_dismissed');
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);
    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); setShow(true); };
    window.addEventListener('beforeinstallprompt', handler);
    if (ios) setTimeout(() => setShow(true), 4000);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setShow(false);
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
        position: 'fixed', bottom: 88, left: 12, right: 12, zIndex: 8000,
        background: 'linear-gradient(135deg, #FF4500, #FF6B35)',
        borderRadius: 16, padding: '14px 16px',
        boxShadow: '0 8px 32px rgba(255,69,0,0.45)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 30, flexShrink: 0 }}>📲</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 2 }}>앱처럼 사용하기</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>홈화면에 추가하면 푸시 알림도 받을 수 있어요!</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
          <button onClick={handleInstall} style={{
            padding: '8px 14px', background: '#fff', color: '#FF4500',
            border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer',
          }}>{isIOS ? '방법 보기' : '추가하기'}</button>
          <button onClick={handleDismiss} style={{
            padding: '3px 0', background: 'transparent',
            color: 'rgba(255,255,255,0.7)', border: 'none', fontSize: 11, cursor: 'pointer', textAlign: 'center',
          }}>나중에</button>
        </div>
      </div>

      {showIOSGuide && (
        <>
          <div onClick={() => setShowIOSGuide(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9000 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9001,
            background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', padding: '20px 24px 40px',
          }}>
            <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>📲 홈화면에 추가하기</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>Safari에서 아래 순서로 따라하세요</div>
            {[
              { n: '1', text: 'Safari 하단 가운데 공유 버튼(⬆️) 탭' },
              { n: '2', text: '스크롤해서 "홈 화면에 추가" 탭' },
              { n: '3', text: '오른쪽 상단 "추가" 탭 — 완료!' },
            ].map(s => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{s.n}</div>
                <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{s.text}</span>
              </div>
            ))}
            <button onClick={() => { setShowIOSGuide(false); setShow(false); handleDismiss(); }}
              style={{ marginTop: 20, width: '100%', padding: '14px 0', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              알겠어요!
            </button>
          </div>
        </>
      )}
    </>
  );
}
