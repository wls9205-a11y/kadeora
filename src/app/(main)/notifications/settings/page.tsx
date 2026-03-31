'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/Toast';

type PushState = 'loading' | 'unsupported' | 'not-pwa' | 'denied' | 'off' | 'on';

export default function NotificationSettingsPage() {
  const [pushState, setPushState] = useState<PushState>('loading');
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') { setPushState('unsupported'); return; }
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
      setPushState(isIOS && !isStandalone ? 'not-pwa' : 'unsupported');
      return;
    }
    if ('Notification' in window && Notification.permission === 'denied') {
      setPushState('denied');
      return;
    }

    // serviceWorker.ready는 SW가 없으면 영원히 resolve 안 됨 → 3초 타임아웃
    const timeout = setTimeout(() => setPushState('off'), 3000);
    navigator.serviceWorker?.ready?.then(reg =>
      reg.pushManager.getSubscription().then(sub => {
        clearTimeout(timeout);
        setPushState(sub ? 'on' : 'off');
      })
    ).catch(() => { clearTimeout(timeout); setPushState('off'); });
    return () => clearTimeout(timeout);
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      // 1. 권한 요청
      if ('Notification' in window && Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') { setPushState('denied'); setLoading(false); return; }
      }

      // 2. 서비스 워커 구독
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      // 3. 서버 저장
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });

      // 4. 알림 설정 전부 ON
      await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          push_comments: true, push_likes: true, push_follows: true,
          push_apt_deadline: true, push_hot_posts: true, push_stock_alert: true,
          push_attendance: true, push_marketing: true,
        }),
      });

      setPushState('on');
      success('알림이 활성화되었습니다!');
    } catch {
      error('알림 설정에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();

      await fetch('/api/push/subscribe', { method: 'DELETE' });

      await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          push_comments: false, push_likes: false, push_follows: false,
          push_apt_deadline: false, push_hot_posts: false, push_stock_alert: false,
          push_attendance: false, push_marketing: false,
        }),
      });

      setPushState('off');
      success('알림이 해제되었습니다');
    } catch {
      error('알림 해제에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const boxStyle = {
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 14, padding: '24px 20px', textAlign: 'center' as const,
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--sp-2xl)' }}>
        <Link href="/notifications" style={{ color: 'var(--text-tertiary)', textDecoration: 'none', fontSize: 'var(--fs-base)' }}>← 알림</Link>
        <h1 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>알림 설정</h1>
      </div>

      {pushState === 'loading' && (
        <div style={boxStyle}>
          <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>확인 중...</div>
        </div>
      )}

      {pushState === 'on' && (
        <div style={boxStyle}>
          <div style={{ fontSize: 48, marginBottom: 'var(--sp-md)' }}>🔔</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--accent-green)', marginBottom: 6 }}>알림 활성화됨</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: 'var(--sp-xl)' }}>
            댓글 · 좋아요 · 팔로우 · 청약 마감 · HOT 게시글<br />
            주식 급등/급락 · 출석 리마인더 · 이벤트 소식<br />
            모든 알림을 받고 있습니다.
          </div>
          <button
            onClick={handleDisable}
            disabled={loading}
            style={{
              padding: '12px 24px', borderRadius: 10, border: '1px solid var(--border)',
              background: 'var(--bg-hover)', color: 'var(--text-secondary)',
              fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '처리 중...' : '알림 끄기'}
          </button>
          <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-hover)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 'var(--sp-sm)' }}>활성화된 알림</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                { label: '💬 댓글', group: '커뮤니티' },
                { label: '❤️ 좋아요', group: '커뮤니티' },
                { label: '👥 팔로우', group: '커뮤니티' },
                { label: '🏢 청약마감', group: '부동산' },
                { label: '🔥 인기글', group: '시스템' },
                { label: '📈 주식알림', group: '주식' },
                { label: '📅 출석', group: '시스템' },
              ].map(n => (
                <span key={n.label} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(52,211,153,0.1)', color: 'var(--accent-green)', fontWeight: 600 }}>
                  {n.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {pushState === 'off' && (
        <div style={boxStyle}>
          <div style={{ fontSize: 48, marginBottom: 'var(--sp-md)' }}>🔕</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>알림이 꺼져 있어요</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: 'var(--sp-xl)' }}>
            청약 마감, 종목 알림, 댓글 알림 등을<br />
            실시간으로 받아보세요.
          </div>
          <button
            onClick={handleEnable}
            disabled={loading}
            style={{
              padding: '14px 32px', borderRadius: 12, border: 'none',
              background: 'var(--brand)', color: 'white',
              fontSize: 'var(--fs-base)', fontWeight: 700, cursor: 'pointer',
              width: '100%', opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '설정 중...' : '🔔 알림 받기'}
          </button>
        </div>
      )}

      {pushState === 'denied' && (
        <div style={boxStyle}>
          <div style={{ fontSize: 48, marginBottom: 'var(--sp-md)' }}>🚫</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--accent-red)', marginBottom: 6 }}>알림이 차단됨</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
            기기 설정에서 카더라 알림을 허용해주세요.<br /><br />
            <strong>iPhone:</strong> 설정 → 카더라 → 알림 → 허용<br />
            <strong>Android:</strong> 설정 → 앱 → 카더라 → 알림 → 허용
          </div>
        </div>
      )}

      {pushState === 'not-pwa' && (
        <div style={boxStyle}>
          <div style={{ fontSize: 48, marginBottom: 'var(--sp-md)' }}>📱</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>앱 설치가 필요해요</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
            푸시 알림은 홈 화면에 추가한 앱에서만 사용 가능합니다.<br /><br />
            Safari 하단 <strong>공유 버튼(↑)</strong> → <strong>&quot;홈 화면에 추가&quot;</strong>를 눌러주세요.
          </div>
        </div>
      )}

      {pushState === 'unsupported' && (
        <div style={boxStyle}>
          <div style={{ fontSize: 48, marginBottom: 'var(--sp-md)' }}>⚠️</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>지원하지 않는 브라우저</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
            이 브라우저에서는 푸시 알림을 지원하지 않습니다.<br />
            Chrome, Edge 또는 iPhone 홈 화면 앱을 이용해주세요.
          </div>
        </div>
      )}
    </div>
  );
}
