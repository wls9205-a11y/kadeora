'use client';
import { useState, useEffect } from 'react';

type InstallState = 'loading' | 'installed' | 'can-install' | 'ios-safari' | 'unsupported';

export default function GuideInstallButton() {
  const [state, setState] = useState<InstallState>('loading');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') { setState('unsupported'); return; }

    // 이미 설치됨
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
      setState('installed');
      return;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    // 글로벌 캡처된 프롬프트 확인
    if (window.__pwaPrompt) {
      setDeferredPrompt(window.__pwaPrompt);
      setState('can-install');
      return;
    }

    // 새로 발생할 수도 있으므로 리스너도 등록
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setState('can-install');
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS Safari
    if (isIOS) {
      setState('ios-safari');
    } else {
      // 3초 기다려도 안 오면 unsupported
      const timer = setTimeout(() => {
        setState(prev => prev === 'loading' ? 'unsupported' : prev);
      }, 3000);
      return () => { clearTimeout(timer); window.removeEventListener('beforeinstallprompt', handler); };
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setState('installed');
      // 설치 후 푸시 알림도 자동 요청
      try {
        if ('Notification' in window && Notification.permission === 'default') {
          const perm = await Notification.requestPermission();
          if (perm === 'granted' && 'serviceWorker' in navigator) {
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
          }
        }
      } catch {}
      fetch('/api/pwa/install', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: 'guide' }) }).catch(() => {});
    }
    setDeferredPrompt(null);
    setInstalling(false);
  };

  const cardStyle = {
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '28px 24px', textAlign: 'center' as const,
  };

  if (state === 'loading') return null;

  if (state === 'installed') return (
    <div style={cardStyle}>
      <div style={{ fontSize: 48, marginBottom: 'var(--sp-md)' }}>✅</div>
      <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--accent-green)', marginBottom: 'var(--sp-sm)' }}>
        설치 완료!
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
        카더라가 이미 설치되어 있습니다.<br />
        홈 화면에서 바로 실행할 수 있어요.
      </div>
    </div>
  );

  if (state === 'can-install') return (
    <div style={cardStyle}>
      <div style={{ fontSize: 48, marginBottom: 'var(--sp-md)' }}>📲</div>
      <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)' }}>
        카더라 앱 설치
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: 'var(--sp-xl)' }}>
        앱스토어 없이 바로 설치!<br />
        푸시 알림 · 빠른 실행 · 오프라인 지원
      </div>
      <button
        onClick={handleInstall}
        disabled={installing}
        style={{
          padding: '16px 40px', borderRadius: 'var(--radius-lg)', border: 'none',
          background: 'var(--brand)', color: 'white',
          fontSize: 'var(--fs-base)', fontWeight: 800, cursor: 'pointer',
          width: '100%', maxWidth: 320,
          opacity: installing ? 0.6 : 1,
          boxShadow: '0 4px 16px rgba(37,99,235,0.3)',
        }}
      >
        {installing ? '설치 중...' : '📲 설치하기'}
      </button>
    </div>
  );

  if (state === 'ios-safari') return (
    <div style={cardStyle}>
      <div style={{ fontSize: 48, marginBottom: 'var(--sp-md)' }}>📱</div>
      <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)' }}>
        카더라 앱 설치
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', lineHeight: 1.8, marginBottom: 'var(--sp-xs)' }}>
        Safari 하단 <strong style={{ color: 'var(--text-primary)' }}>공유 버튼(⬆️)</strong> 누르기
      </div>
      <div style={{ fontSize: 28, margin: '8px 0' }}>⬇️</div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', lineHeight: 1.8 }}>
        <strong style={{ color: 'var(--text-primary)' }}>&quot;홈 화면에 추가&quot;</strong> 누르면 끝!
      </div>
      <div style={{
        marginTop: 'var(--sp-lg)', padding: '12px 16px', borderRadius: 'var(--radius-md)',
        background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)',
        fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.6,
      }}>
        설치 후 앱을 열면 알림 허용 팝업이 자동으로 떠요
      </div>
    </div>
  );

  // unsupported
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 48, marginBottom: 'var(--sp-md)' }}>💻</div>
      <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)' }}>
        카더라 앱 설치
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: 'var(--sp-lg)' }}>
        Chrome 또는 Edge 주소창 오른쪽의<br />
        <strong style={{ color: 'var(--text-primary)' }}>설치(⊕) 아이콘</strong>을 클릭하세요
      </div>
      <div style={{
        padding: '12px 16px', borderRadius: 'var(--radius-md)',
        background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)',
        fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.6,
      }}>
        Firefox 등 일부 브라우저는 미지원 · Chrome/Edge 권장
      </div>
    </div>
  );
}
