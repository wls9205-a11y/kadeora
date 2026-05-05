'use client';
import { useEffect, useState } from 'react';
import type { InAppBrowserType } from '@/hooks/useInAppBrowser';

interface Props {
  type: InAppBrowserType;
  /** 강제로 안 보일 수 있게 — null/inline 호출 시 자동 dismiss 가능. */
  onClose?: () => void;
  /** 외부 브라우저 진입 후 돌아갈 URL (기본 현재 URL). */
  href?: string;
}

const TYPE_LABEL: Record<NonNullable<InAppBrowserType>, string> = {
  daum: '다음 앱',
  karrot: '당근 앱',
  naver: '네이버 앱',
  kakao: '카카오톡',
  social: '페이스북·인스타·라인',
  webview: '인앱 브라우저',
};

function fireView(type: InAppBrowserType) {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  try {
    const body = JSON.stringify({
      event_type: 'cta_view',
      cta_name: 'inapp_browser_modal',
      category: 'signup',
      page_path: window.location.pathname,
      meta: { browser_type: type, source: 'inapp_blocked' },
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
}

function fireClick(action: 'copy' | 'open_external', type: InAppBrowserType) {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  try {
    const body = JSON.stringify({
      event_type: 'cta_click',
      cta_name: 'inapp_browser_modal',
      category: 'signup',
      page_path: window.location.pathname,
      meta: { browser_type: type, action, source: 'inapp_blocked' },
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
}

export default function InAppBrowserModal({ type, onClose, href }: Props) {
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  const url = href ?? (typeof window !== 'undefined' ? window.location.href : 'https://kadeora.app/login');
  const label = type ? TYPE_LABEL[type] : '인앱 브라우저';

  useEffect(() => {
    fireView(type);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [type]);

  const handleCopy = async () => {
    fireClick('copy', type);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // fallback: textarea select
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2400);
      } catch {}
    }
  };

  const handleExternal = () => {
    fireClick('open_external', type);
    setOpening(true);
    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    if (isAndroid) {
      // Android intent — Chrome 강제 진입. fallback 으로 주소 복사 안내.
      const noProto = url.replace(/^https?:\/\//i, '');
      const intentUrl = `intent://${noProto}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
      window.location.href = intentUrl;
    } else {
      // iOS — 인앱 자체에서 외부 진입 가능한 표준 경로 없음. 복사 + 안내만.
      handleCopy();
    }
    setTimeout(() => setOpening(false), 1500);
  };

  return (
    <div
      role="dialog"
      aria-label="외부 브라우저 안내"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 420, padding: '22px 22px 18px',
          background: 'var(--bg-elevated, #1f2028)', borderRadius: 18,
          border: '1px solid rgba(254,229,0,0.25)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          color: 'var(--text-primary, #fff)',
        }}
      >
        <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 6 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 800, textAlign: 'center', marginBottom: 8, lineHeight: 1.45 }}>
          {label} 에서는 카카오·구글 로그인이<br />차단되어 있어요
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary, #888)', textAlign: 'center', lineHeight: 1.6, margin: '0 0 18px' }}>
          외부 브라우저(크롬/사파리)에서 열어주시면<br />3초 안에 가입을 완료할 수 있어요.
        </p>

        <button
          type="button"
          onClick={handleExternal}
          disabled={opening}
          style={{
            width: '100%', padding: '13px 18px', borderRadius: 10, border: 'none',
            background: '#FEE500', color: '#191919', fontWeight: 800, fontSize: 14,
            cursor: opening ? 'wait' : 'pointer', marginBottom: 8,
          }}
        >
          {opening ? '여는 중…' : '🌐 외부 브라우저로 열기'}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            width: '100%', padding: '11px 18px', borderRadius: 10,
            border: '1px solid var(--border, #2a2b35)',
            background: 'transparent', color: 'var(--text-primary, #fff)',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}
        >
          {copied ? '✅ 주소 복사 완료' : '📋 현재 주소 복사하기'}
        </button>

        <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-base, #0d0e14)', border: '1px solid var(--border, #2a2b35)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary, #666)', marginBottom: 4, fontWeight: 600 }}>대안</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary, #888)', lineHeight: 1.6 }}>
            우상단 "…" 메뉴 → "외부 브라우저로 열기" 또는 "Chrome/Safari 에서 열기" 선택
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{
              marginTop: 12, width: '100%', padding: '8px 0', border: 'none', background: 'transparent',
              color: 'var(--text-tertiary, #666)', fontSize: 11, cursor: 'pointer',
              textDecoration: 'underline', textUnderlineOffset: 2,
            }}
          >
            닫기
          </button>
        )}
      </div>
    </div>
  );
}
