'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Props = {
  slug?: string;
  redirectPath?: string;
  isLoggedIn: boolean;
  finishRatePct?: number;
  totalUsers?: number;
};

const STORAGE_KEY = 'kd_popup_signup_dismissed';
const SCROLL_TRIGGER_PCT = 50;
const TIMER_TRIGGER_MS = 60000;

export default function SignupPopupModal({
  slug: _slug,
  redirectPath,
  isLoggedIn,
  finishRatePct = 16,
  totalUsers = 626,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const viewFired = useRef(false);
  const redirect = redirectPath || (typeof window !== 'undefined' ? window.location.pathname : '/');

  const missRate = Math.max(60, Math.min(95, 100 - finishRatePct));
  const missPeople = Math.round(missRate / 10);

  useEffect(() => {
    if (isLoggedIn) return;

    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(STORAGE_KEY)) return;
    } catch {}

    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      setVisible(true);
    };

    const onScroll = () => {
      const scrolled = window.scrollY;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total > 0 && (scrolled / total) * 100 >= SCROLL_TRIGGER_PCT) fire();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    const timer = setTimeout(fire, TIMER_TRIGGER_MS);

    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!visible || viewFired.current) return;
    viewFired.current = true;

    try {
      const body = JSON.stringify({
        event_type: 'cta_view',
        cta_name: 'popup_signup_modal',
        category: 'signup',
        page_path: window.location.pathname,
      });
      if (navigator.sendBeacon) {
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

    document.body.style.overflow = 'hidden';

    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss();
    };
    window.addEventListener('keydown', onEsc);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onEsc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleDismiss = () => {
    try {
      const body = JSON.stringify({
        event_type: 'cta_dismiss',
        cta_name: 'popup_signup_modal',
        category: 'signup',
        page_path: window.location.pathname,
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/events/cta', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/events/cta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {});
      }
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {}
    setClosing(true);
    setTimeout(() => setVisible(false), 200);
  };

  const handleClickCta = () => {
    try {
      const body = JSON.stringify({
        event_type: 'cta_click',
        cta_name: 'popup_signup_modal',
        category: 'signup',
        page_path: window.location.pathname,
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/events/cta', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/events/cta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {});
      }
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {}
  };

  if (!visible) return null;

  const loginUrl = `/login?redirect=${encodeURIComponent(redirect)}&source=popup_signup_modal`;

  return (
    <>
      <style>{`
        @keyframes kd-popup-overlay-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes kd-popup-overlay-out {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        @keyframes kd-popup-card-in {
          0%   { opacity: 0; transform: translateY(40px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes kd-popup-card-out {
          0%   { opacity: 1; transform: translateY(0)    scale(1); }
          100% { opacity: 0; transform: translateY(20px) scale(0.97); }
        }
      `}</style>

      <div
        onClick={handleDismiss}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kd-popup-title"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          animation: closing
            ? 'kd-popup-overlay-out 200ms ease forwards'
            : 'kd-popup-overlay-in 200ms ease forwards',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'linear-gradient(180deg, #1a1030 0%, #0F1729 100%)',
            borderRadius: 20,
            padding: '28px 22px 22px',
            width: '100%',
            maxWidth: 340,
            position: 'relative',
            border: '0.5px solid rgba(254,229,0,0.25)',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
            animation: closing
              ? 'kd-popup-card-out 200ms cubic-bezier(0.16,1,0.3,1) forwards'
              : 'kd-popup-card-in 280ms cubic-bezier(0.16,1,0.3,1) forwards',
          }}
        >
          <button
            onClick={handleDismiss}
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

          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div
              style={{
                display: 'inline-block',
                background: 'rgba(254,229,0,0.1)',
                border: '0.5px solid rgba(254,229,0,0.3)',
                color: '#FEE500',
                fontSize: 11,
                padding: '4px 12px',
                borderRadius: 999,
                fontWeight: 500,
                letterSpacing: '0.02em',
              }}
            >
              실측 데이터
            </div>
          </div>

          <div
            id="kd-popup-title"
            style={{
              textAlign: 'center',
              color: '#fff',
              fontSize: 22,
              fontWeight: 500,
              lineHeight: 1.25,
              marginBottom: 12,
              wordBreak: 'keep-all',
            }}
          >
            10명 중 <span style={{ color: '#FEE500' }}>{missPeople}명</span>은<br />
            이 글 끝까지 못 봐요
          </div>

          <div
            style={{
              textAlign: 'center',
              color: 'rgba(255,255,255,0.65)',
              fontSize: 13,
              lineHeight: 1.5,
              marginBottom: 18,
              wordBreak: 'keep-all',
            }}
          >
            핵심은 보통 아래쪽에 있어요.
            <br />
            3초 가입으로 전체 열람하세요.
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <div
              style={{
                flex: 1,
                background: 'rgba(59,123,246,0.1)',
                border: '0.5px solid rgba(59,123,246,0.25)',
                borderRadius: 10,
                padding: '10px 6px',
                textAlign: 'center',
              }}
            >
              <div style={{ color: '#60A5FA', fontSize: 14, fontWeight: 500 }}>전체</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 }}>
                AI 분석
              </div>
            </div>
            <div
              style={{
                flex: 1,
                background: 'rgba(34,197,94,0.1)',
                border: '0.5px solid rgba(34,197,94,0.25)',
                borderRadius: 10,
                padding: '10px 6px',
                textAlign: 'center',
              }}
            >
              <div style={{ color: '#4ADE80', fontSize: 14, fontWeight: 500 }}>실시간</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 }}>
                알림
              </div>
            </div>
            <div
              style={{
                flex: 1,
                background: 'rgba(254,229,0,0.1)',
                border: '0.5px solid rgba(254,229,0,0.3)',
                borderRadius: 10,
                padding: '10px 6px',
                textAlign: 'center',
              }}
            >
              <div style={{ color: '#FEE500', fontSize: 14, fontWeight: 500 }}>100P</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 }}>
                즉시 지급
              </div>
            </div>
          </div>

          <Link
            href={loginUrl}
            onClick={handleClickCta}
            style={{
              display: 'block',
              background: '#FEE500',
              color: '#191919',
              textAlign: 'center',
              padding: '14px',
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
            이미 {totalUsers.toLocaleString()}명이 가입했어요 · 언제든 해지 가능
          </div>
        </div>
      </div>
    </>
  );
}
