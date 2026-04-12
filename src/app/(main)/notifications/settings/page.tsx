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
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) { console.error('[push] VAPID key missing'); error('푸시 설정 오류 — 관리자에게 문의하세요'); setLoading(false); return; }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });

      // 3. 서버 저장
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), visitor_id: localStorage.getItem('kd_visitor_id') }),
      });

      // 4. 알림 설정 전부 ON
      await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          push_comments: true, push_likes: true, push_follows: true,
          push_apt_deadline: true, push_hot_post: true, push_stock_alert: true,
          push_attendance: true, push_news: true,
        }),
      });

      setPushState('on');
      success('알림이 활성화되었습니다!');
    } catch (e) {
      console.error('[push-subscribe]', e);
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
          push_apt_deadline: false, push_hot_post: false, push_stock_alert: false,
          push_attendance: false, push_news: false,
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
    borderRadius: 'var(--radius-lg)', padding: '24px 20px', textAlign: 'center' as const,
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-2xl)' }}>
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
              padding: '12px 24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
              background: 'var(--bg-hover)', color: 'var(--text-secondary)',
              fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '처리 중...' : '알림 끄기'}
          </button>
          <div style={{ marginTop: 'var(--sp-lg)', padding: 12, background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 'var(--sp-sm)' }}>활성화된 알림</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                { label: '💬 댓글' },
                { label: '❤️ 좋아요' },
                { label: '👥 팔로우' },
                { label: '🏢 청약마감' },
                { label: '🔥 인기글' },
                { label: '📈 주식알림' },
                { label: '📅 출석' },
                { label: '📧 이메일' },
              ].map(n => (
                <span key={n.label} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-xs)', background: 'rgba(52,211,153,0.1)', color: 'var(--accent-green)', fontWeight: 600 }}>
                  {n.label}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>수신 채널</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                웹 푸시 (3건/일, 무료) · 이메일 (주간 리포트) · 카카오 알림톡 (긴급만)
              </div>
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
              padding: '14px 32px', borderRadius: 'var(--radius-card)', border: 'none',
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
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: 'var(--sp-md)' }}>
            푸시 알림은 홈 화면에 추가한 앱에서만 사용 가능합니다.<br /><br />
            Safari 하단 <strong>공유 버튼(↑)</strong> → <strong>&quot;홈 화면에 추가&quot;</strong>를 눌러주세요.
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', padding: 12, lineHeight: 1.6 }}>
            💡 앱 설치가 어려우시면 <strong>이메일 알림</strong>으로 청약 마감·종목 변동을 받아보세요. 가입 이메일로 자동 발송됩니다.
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
