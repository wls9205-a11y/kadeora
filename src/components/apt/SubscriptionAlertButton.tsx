'use client';
// s273 — 청약 카드 인라인 '🔔 알림받기'.
//
// 로그인   → 기존 관심단지 알림 시스템(POST /api/apt/interest)에 그대로 연결.
// 비로그인 → 카카오 가입 모달. source=apt_sub_card.
//
// Architecture Rule #96: sendBeacon 단독 + 즉시 window.location.href 금지.
//   모달 안의 가입 버튼은 Next <Link> 를 쓰므로 client-side route — beacon flush 안전.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { trackCtaClick, trackCtaView } from '@/lib/cta-track';

const CTA_NAME = 'apt_sub_card';

type Props = {
  aptName: string;
  /** 로그인 후 되돌아올 경로. 기본값은 현재 경로. */
  redirect?: string;
  compact?: boolean;
};

export default function SubscriptionAlertButton({ aptName, redirect, compact = false }: Props) {
  const { userId } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function handleClick() {
    trackCtaClick({ cta_name: CTA_NAME, category: 'signup' });

    if (!userId) {
      setModalOpen(true);
      return;
    }

    setState('loading');
    setErrMsg(null);
    try {
      const r = await fetch('/api/apt/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apt_name: aptName, source: CTA_NAME }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setState('error');
        setErrMsg(j?.error || '알림 등록에 실패했어요');
        return;
      }
      setState('done');
    } catch {
      setState('error');
      setErrMsg('네트워크 오류');
    }
  }

  const label =
    state === 'done' ? '✅ 알림 신청됨'
    : state === 'loading' ? '등록 중…'
    : '🔔 알림받기';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={state === 'loading' || state === 'done'}
        aria-label={`${aptName} 청약 알림받기`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          padding: compact ? '5px 9px' : '7px 12px',
          borderRadius: 6,
          fontSize: compact ? 11.5 : 12.5,
          fontWeight: 700,
          cursor: state === 'done' ? 'default' : 'pointer',
          whiteSpace: 'nowrap',
          border: '1px solid',
          borderColor: state === 'done' ? '#a7f3d0' : '#fcd34d',
          background: state === 'done' ? '#ecfdf5' : '#fffbeb',
          color: state === 'done' ? '#047857' : '#92400e',
          opacity: state === 'loading' ? 0.65 : 1,
        }}
      >
        {label}
      </button>

      {errMsg ? (
        <span role="status" style={{ fontSize: 11, color: '#b91c1c', marginLeft: 6 }}>
          {errMsg}
        </span>
      ) : null}

      {modalOpen ? (
        <KakaoSignupModal
          aptName={aptName}
          redirect={redirect}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </>
  );
}

function KakaoSignupModal({
  aptName,
  redirect,
  onClose,
}: {
  aptName: string;
  redirect?: string;
  onClose: () => void;
}) {
  const target =
    redirect || (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/apt');
  const loginUrl = `/login?source=${CTA_NAME}&action=register_interest&redirect=${encodeURIComponent(target)}`;

  useEffect(() => {
    trackCtaView({ cta_name: CTA_NAME, category: 'signup' });

    document.body.style.overflow = 'hidden';
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="kd-apt-alert-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, #1a1030 0%, #0f1729 100%)',
          borderRadius: 20,
          padding: '26px 22px 20px',
          width: '100%',
          maxWidth: 340,
          position: 'relative',
          border: '1px solid rgba(254,229,0,0.25)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}
      >
        <button
          onClick={onClose}
          aria-label="닫기"
          style={{
            position: 'absolute',
            top: 10,
            right: 12,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.5)',
            background: 'transparent',
            border: 'none',
            fontSize: 18,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          ×
        </button>

        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <span
            style={{
              display: 'inline-block',
              background: 'rgba(254,229,0,0.1)',
              border: '1px solid rgba(254,229,0,0.3)',
              color: '#fee500',
              fontSize: 11,
              padding: '4px 12px',
              borderRadius: 999,
              fontWeight: 500,
            }}
          >
            청약 알림
          </span>
        </div>

        <div
          id="kd-apt-alert-title"
          style={{
            textAlign: 'center',
            color: '#fff',
            fontSize: 19,
            fontWeight: 500,
            lineHeight: 1.35,
            marginBottom: 10,
            wordBreak: 'keep-all',
          }}
        >
          <span style={{ color: '#fee500' }}>{aptName}</span>
          <br />
          접수 시작·마감을 알려드려요
        </div>

        <div
          style={{
            textAlign: 'center',
            color: 'rgba(255,255,255,0.65)',
            fontSize: 13,
            lineHeight: 1.55,
            marginBottom: 18,
            wordBreak: 'keep-all',
          }}
        >
          1순위 접수일과 마감 3일 전,
          <br />
          카카오로 딱 두 번만 보냅니다.
        </div>

        <Link
          href={loginUrl}
          onClick={() => trackCtaClick({ cta_name: `${CTA_NAME}_modal`, category: 'signup' })}
          style={{
            display: 'block',
            background: '#fee500',
            color: '#191919',
            textAlign: 'center',
            padding: 14,
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 500,
            textDecoration: 'none',
            marginBottom: 10,
            boxShadow: '0 4px 16px rgba(254,229,0,0.18)',
          }}
        >
          💬 카카오로 3초 가입
        </Link>

        <div
          style={{
            textAlign: 'center',
            color: 'rgba(255,255,255,0.4)',
            fontSize: 10,
            lineHeight: 1.6,
          }}
        >
          가입 즉시 100P 지급 · 언제든 해지 가능
        </div>
      </div>
    </div>
  );
}
