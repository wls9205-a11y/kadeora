'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';

const CHANNEL_PUBLIC_ID = '_NFxdxhX';

type Props = {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
};

export default function MarketingConsentModal({ userId, isOpen, onClose }: Props) {
  const { error: toastError } = useToast();
  const [marketing, setMarketing] = useState(true);
  const [channel, setChannel] = useState(true);
  const [night, setNight] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const close = () => {
    setClosing(true);
    setTimeout(() => { setClosing(false); onClose(); }, 200);
  };

  const handleSkip = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fetch('/api/profile/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarded: true }),
      });
    } catch {}
    setSubmitting(false);
    close();
  };

  const callKakaoAddChannel = (): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        const k = (window as any).Kakao;
        if (!k || !k.Channel || typeof k.Channel.addChannel !== 'function') {
          resolve(false);
          return;
        }
        try {
          k.Channel.addChannel({
            channelPublicId: CHANNEL_PUBLIC_ID,
            success: () => resolve(true),
            fail: () => resolve(false),
          });
        } catch {
          resolve(false);
        }
        setTimeout(() => resolve(true), 5000);
      } catch {
        resolve(false);
      }
    });
  };

  const handleAgree = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/profile/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketing,
          night,
          channel_action: channel ? 'add' : null,
          onboarded: true,
        }),
      });
      if (!res.ok) toastError('동의 저장에 실패했어요. 잠시 후 다시 시도해주세요.');
    } catch {
      toastError('네트워크 오류가 발생했어요.');
    }

    if (channel) {
      const added = await callKakaoAddChannel();
      if (added) {
        try {
          await fetch('/api/profile/kakao-channel-added', { method: 'POST' });
        } catch {}
        try {
          const sb = createSupabaseBrowser();
          await (sb as any).rpc('award_points', {
            p_user_id: userId,
            p_amount: 50,
            p_reason: '카카오채널추가',
            p_meta: null,
          });
        } catch {}
      }
    }

    setSubmitting(false);
    close();
  };

  if (!isOpen && !closing) return null;

  return (
    <>
      <style>{`
        @keyframes kd-mc-overlay-in { from {opacity:0} to {opacity:1} }
        @keyframes kd-mc-overlay-out { from {opacity:1} to {opacity:0} }
        @keyframes kd-mc-card-in {
          0% { opacity: 0; transform: translateY(40px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes kd-mc-card-out {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(20px) scale(0.97); }
        }
      `}</style>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kd-mc-title"
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
          animation: closing ? 'kd-mc-overlay-out 200ms ease forwards' : 'kd-mc-overlay-in 200ms ease forwards',
        }}
        onClick={() => { if (!submitting) handleSkip(); }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'linear-gradient(180deg, #1a1030 0%, #0F1729 100%)',
            borderRadius: 20, padding: '28px 22px 22px',
            width: '100%', maxWidth: 360, position: 'relative',
            border: '0.5px solid rgba(254,229,0,0.25)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
            animation: closing
              ? 'kd-mc-card-out 200ms cubic-bezier(0.16,1,0.3,1) forwards'
              : 'kd-mc-card-in 280ms cubic-bezier(0.16,1,0.3,1) forwards',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 40, marginBottom: 4 }}>🎁</div>
            <div
              id="kd-mc-title"
              style={{ color: '#fff', fontSize: 18, fontWeight: 600, lineHeight: 1.3, marginBottom: 6, wordBreak: 'keep-all' }}
            >
              놓치면 아쉬운 알림,<br />
              <span style={{ color: '#FEE500' }}>한번에 받기</span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.5 }}>
              청약·실거래 핵심 알림 + 마케팅 혜택<br />
              해지는 마이페이지에서 언제든 가능
            </div>
          </div>

          <label
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '12px 12px',
              background: 'rgba(255,255,255,0.04)',
              border: '0.5px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              marginBottom: 8,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
              style={{ marginTop: 2, accentColor: '#FEE500' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 500, marginBottom: 2 }}>
                마케팅 정보 수신 동의 <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>(광고)</span>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, lineHeight: 1.5 }}>
                할인·이벤트·맞춤 추천 알림 받기
              </div>
            </div>
          </label>

          <label
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '12px 12px',
              background: 'rgba(254,229,0,0.06)',
              border: '0.5px solid rgba(254,229,0,0.2)',
              borderRadius: 12,
              marginBottom: 10,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={channel}
              onChange={(e) => setChannel(e.target.checked)}
              style={{ marginTop: 2, accentColor: '#FEE500' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 500, marginBottom: 2 }}>
                💬 카카오 채널 친구 추가
              </div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, lineHeight: 1.5 }}>
                동의 시 카카오톡으로 즉시 알림 받기
              </div>
            </div>
          </label>

          <label
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px',
              borderRadius: 10,
              marginBottom: 16,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={night}
              onChange={(e) => setNight(e.target.checked)}
              style={{ accentColor: '#FEE500' }}
            />
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
              야간(21~08시) 알림도 받기
            </span>
          </label>

          <button
            onClick={handleAgree}
            disabled={submitting}
            style={{
              width: '100%', background: '#FEE500', color: '#191919',
              padding: '14px', borderRadius: 12, fontSize: 15, fontWeight: 600,
              border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
              marginBottom: 8,
              boxShadow: '0 4px 16px rgba(254,229,0,0.18)',
            }}
          >
            모두 동의 + 받기
          </button>

          <button
            onClick={handleSkip}
            disabled={submitting}
            style={{
              width: '100%', background: 'transparent',
              color: 'rgba(255,255,255,0.5)', fontSize: 12,
              padding: 8, border: 'none',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            나중에 할게요
          </button>
        </div>
      </div>
    </>
  );
}
