'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';

/**
 * SmartPushPrompt — 전 플랫폼 알림 유도
 * 
 * 표시 조건:
 * - 로그인 유저 + 푸시 미구독 + 3회 이상 방문 + 24시간 쿨다운
 * 
 * 플랫폼별 처리:
 * - Android/Desktop Chrome: 바로 알림 요청
 * - iOS Safari (non-PWA): PWA 설치 안내
 * - iOS PWA: 바로 알림 요청
 * - 알림 거부됨: 기기 설정 안내
 * - 미지원 브라우저: 미표시
 */

type Platform = 'android' | 'ios-safari' | 'ios-pwa' | 'desktop' | 'unsupported';
type PushState = 'idle' | 'subscribed' | 'denied' | 'needs-pwa' | 'unsupported';

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'unsupported';
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  if (isIOS && isStandalone) return 'ios-pwa';
  if (isIOS) return 'ios-safari';
  if (/Android/.test(ua)) return 'android';
  if ('PushManager' in window) return 'desktop';
  return 'unsupported';
}

function getPushState(platform: Platform): PushState {
  if (platform === 'unsupported') return 'unsupported';
  if (platform === 'ios-safari') return 'needs-pwa';
  if (!('PushManager' in window)) return 'unsupported';
  if ('Notification' in window && Notification.permission === 'denied') return 'denied';
  return 'idle';
}

const LS_KEY = 'kd_push_prompt_at';
const LS_VISITS = 'kd_visit_count';

export default function SmartPushPrompt() {
  const { userId } = useAuth();
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<Platform>('unsupported');
  const [pushState, setPushState] = useState<PushState>('unsupported');
  const [subscribing, setSubscribing] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const p = detectPlatform();
    setPlatform(p);
    const state = getPushState(p);
    setPushState(state);

    // 이미 구독됨 → 미표시
    if (state === 'unsupported') return;
    if ('Notification' in window && Notification.permission === 'granted') {
      navigator.serviceWorker?.ready?.then(reg =>
        reg.pushManager.getSubscription().then(sub => { if (sub) setPushState('subscribed'); })
      ).catch(() => {});
      return;
    }

    // 방문 횟수 체크 (3회 이상)
    const visits = parseInt(localStorage.getItem(LS_VISITS) || '0') + 1;
    localStorage.setItem(LS_VISITS, String(visits));
    if (visits < 3) return;

    // 24시간 쿨다운
    const lastPrompt = localStorage.getItem(LS_KEY);
    if (lastPrompt && Date.now() - parseInt(lastPrompt) < 24 * 60 * 60 * 1000) return;

    // 2초 딜레이 후 표시 (페이지 로드 직후가 아닌 자연스러운 타이밍)
    const timer = setTimeout(() => setShow(true), 2000);
    return () => clearTimeout(timer);
  }, [userId]);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(LS_KEY, String(Date.now()));
  };

  const subscribe = async () => {
    setSubscribing(true);
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') { setPushState('denied'); setSubscribing(false); return; }
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
      setDone(true);
      setPushState('subscribed');
      setTimeout(() => setShow(false), 2000);
    } catch (e) {
      console.error('[SmartPushPrompt]', e);
    }
    setSubscribing(false);
  };

  if (!show || pushState === 'subscribed' || pushState === 'unsupported') return null;

  const cardStyle: React.CSSProperties = {
    position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
    width: 'calc(100% - 32px)', maxWidth: 400, zIndex: 9999,
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 16, padding: '16px 18px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
    animation: 'slideUp 0.3s ease-out',
  };

  return (
    <>
      <style>{`@keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>
      <div style={cardStyle}>
        <button onClick={dismiss} style={{
          position: 'absolute', top: 10, right: 12, background: 'none', border: 'none',
          color: 'var(--text-tertiary)', fontSize: 16, cursor: 'pointer',
        }}>✕</button>

        {done ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>🎉</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-green)' }}>알림 설정 완료!</div>
          </div>
        ) : pushState === 'needs-pwa' ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              📱 알림을 받으려면 앱 설치가 필요해요
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
              iPhone에서는 홈 화면에 추가해야 알림을 받을 수 있어요.
            </div>
            <div style={{
              background: 'var(--bg-base)', borderRadius: 10, padding: '12px 14px',
              fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8,
            }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>설치 방법 (10초)</div>
              <div>1️⃣ 하단 <strong style={{ color: 'var(--brand)' }}>공유 버튼</strong> (⬆️) 탭</div>
              <div>2️⃣ <strong style={{ color: 'var(--brand)' }}>"홈 화면에 추가"</strong> 탭</div>
              <div>3️⃣ 우측 상단 <strong style={{ color: 'var(--brand)' }}>"추가"</strong> 탭</div>
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
                추가 후 홈 화면에서 카더라 앱을 열면 알림 설정이 가능해요
              </div>
            </div>
          </>
        ) : pushState === 'denied' ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              🔕 알림이 차단되어 있어요
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {platform === 'android' ? (
                <>Chrome 설정 → 사이트 설정 → kadeora.app → 알림 허용</>
              ) : platform === 'ios-pwa' ? (
                <>설정 → 카더라 → 알림 → 허용</>
              ) : (
                <>브라우저 주소창 왼쪽 🔒 아이콘 → 알림 → 허용</>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              🔔 청약 마감·시세 변동 알림 받기
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
              관심 단지 청약 마감, 종목 급등락, 새 분석 리포트를 실시간으로 받아보세요.
            </div>
            <button onClick={subscribe} disabled={subscribing} style={{
              width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
              background: 'var(--brand)', color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: subscribing ? 'not-allowed' : 'pointer',
              opacity: subscribing ? 0.6 : 1,
            }}>
              {subscribing ? '설정 중...' : '알림 허용하기'}
            </button>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, textAlign: 'center' }}>
              언제든 알림 설정에서 끌 수 있어요
            </div>
          </>
        )}
      </div>
    </>
  );
}
