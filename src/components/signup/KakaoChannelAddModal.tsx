'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

const CHANNEL_ID = '_NFxdxhX';
const STORAGE_KEY = 'kd_channel_modal_dismissed';

type Props = {
  triggerOnMount?: boolean;
};

export default function KakaoChannelAddModal({ triggerOnMount = true }: Props) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!triggerOnMount) return;

    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(STORAGE_KEY)) return;
    } catch {}

    let cancelled = false;
    (async () => {
      try {
        const sb = createSupabaseBrowser();
        const { data: { user } } = await sb.auth.getUser();
        if (!user || cancelled) return;

        const { data: profile } = await (sb as any)
          .from('profiles')
          .select('kakao_channel_added')
          .eq('id', user.id)
          .maybeSingle();

        if (cancelled) return;
        if (profile?.kakao_channel_added) return;

        setTimeout(() => {
          if (!cancelled) setVisible(true);
        }, 1500);
      } catch {}
    })();

    return () => { cancelled = true; };
  }, [triggerOnMount]);

  const fireBeacon = (event: 'view' | 'click' | 'dismiss') => {
    try {
      const body = JSON.stringify({
        event_type: event === 'view' ? 'cta_view' : event === 'click' ? 'cta_click' : 'cta_dismiss',
        cta_name: 'kakao_channel_add',
        category: 'engagement',
        page_path: typeof window !== 'undefined' ? window.location.pathname : '',
      });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/events/cta', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/events/cta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {}
  };

  useEffect(() => {
    if (visible) fireBeacon('view');
  }, [visible]);

  const handleDismiss = (fireDismissEvent = true) => {
    if (fireDismissEvent) fireBeacon('dismiss');
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch {}
    setClosing(true);
    setTimeout(() => setVisible(false), 200);
  };

  const handleAddChannel = () => {
    fireBeacon('click');

    const k = typeof window !== 'undefined' ? (window as any).Kakao : null;
    if (!k || !k.Channel) {
      alert('카카오 SDK 로드 실패. 새로고침 후 다시 시도해주세요.');
      return;
    }

    k.Channel.addChannel({ channelPublicId: CHANNEL_ID });

    setTimeout(async () => {
      try {
        const sb = createSupabaseBrowser();
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
          await (sb as any).from('profiles')
            .update({
              kakao_channel_added: true,
              kakao_channel_added_at: new Date().toISOString(),
            })
            .eq('id', user.id);
        }
      } catch {}
      handleDismiss(false);
    }, 5000);
  };

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes kd-channel-overlay-in { from {opacity:0} to {opacity:1} }
        @keyframes kd-channel-card-in {
          0% { opacity: 0; transform: translateY(40px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div
        onClick={() => handleDismiss()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kd-channel-title"
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
          animation: closing ? 'none' : 'kd-channel-overlay-in 200ms ease forwards',
          opacity: closing ? 0 : 1,
          transition: 'opacity 200ms',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--gate-card-bg)', borderRadius: 20, padding: '28px 22px 22px',
            width: '100%', maxWidth: 340, position: 'relative',
            border: '0.5px solid var(--gate-card-border)',
            boxShadow: 'var(--shadow-xl)',
            animation: 'kd-channel-card-in 280ms cubic-bezier(0.16,1,0.3,1) forwards',
          }}
        >
          <button
            onClick={() => handleDismiss()}
            aria-label="닫기"
            style={{
              position: 'absolute', top: 10, right: 12,
              width: 28, height: 28, color: 'var(--gate-card-muted)',
              background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer',
              padding: 0,
            }}
          >×</button>

          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>💬</div>
            <div style={{
              fontSize: 11, color: 'var(--gate-accent)', fontWeight: 500, marginBottom: 6,
              background: 'rgba(254,229,0,0.1)', padding: '4px 12px',
              borderRadius: 999, display: 'inline-block',
            }}>
              💬 카카오 채널 추가
            </div>
          </div>

          <div
            id="kd-channel-title"
            style={{
              textAlign: 'center', color: 'var(--gate-card-text)', fontSize: 18, fontWeight: 500,
              lineHeight: 1.3, marginBottom: 12, wordBreak: 'keep-all',
            }}
          >
            청약·실거래 알림을<br />
            <span style={{ color: 'var(--gate-accent)' }}>카톡으로</span> 받아보세요
          </div>

          <div style={{
            textAlign: 'center', color: 'var(--gate-card-muted)',
            fontSize: 12, lineHeight: 1.5, marginBottom: 18,
          }}>
            우리 동네 부동산 핫이슈 + 청약 임박 알림<br />
            카카오톡으로 즉시 받기 (앱 알림 X)
          </div>

          <button
            onClick={handleAddChannel}
            style={{
              width: '100%', background: '#FEE500', color: '#191919',
              padding: '14px', borderRadius: 12, fontSize: 15, fontWeight: 500,
              border: 'none', cursor: 'pointer', marginBottom: 10,
              boxShadow: '0 4px 16px rgba(254,229,0,0.18)',
            }}
          >
            💬 카카오 채널 추가
          </button>

          <button
            onClick={() => handleDismiss()}
            style={{
              width: '100%', background: 'transparent',
              color: 'var(--gate-card-muted)', fontSize: 12,
              padding: 8, border: 'none', cursor: 'pointer',
            }}
          >
            나중에 할게요
          </button>
        </div>
      </div>
    </>
  );
}
