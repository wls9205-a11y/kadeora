'use client';

/**
 * ProfileCompletionBanner — 비강제 프로필 완성 유도 배너 (dismissible, 7일 기억)
 *
 * 가입 직후 frictionless flow 로 완료된 유저에게 "프로필 완성하면 보상" 형태로 노출.
 * onboarding 은 이제 optional. dismiss 쿠키 7일 보관.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

const COOKIE_KEY = 'kd_pcb_dismissed';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

function readDismissed(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((c) => c.startsWith(`${COOKIE_KEY}=1`));
}

function setDismissed() {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_KEY}=1; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}

interface Props {
  /** true 면 이미 완료된 유저로 배너 숨김 */
  alreadyCompleted?: boolean;
}

export default function ProfileCompletionBanner({ alreadyCompleted }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (alreadyCompleted) return;
    if (readDismissed()) return;
    setVisible(true);
  }, [alreadyCompleted]);

  if (!visible) return null;

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 14px',
        background: 'linear-gradient(90deg, rgba(139,92,246,0.15) 0%, rgba(251,191,36,0.12) 100%)',
        borderBottom: '1px solid rgba(139,92,246,0.25)',
        fontSize: 13,
        color: 'var(--text-primary, #e5e7eb)',
      }}
    >
      <span aria-hidden>🎁</span>
      <span style={{ flex: 1 }}>
        관심 분야 설정하고 <b>맞춤 알림</b> + 포인트 받기 (1분 이내)
      </span>
      <Link
        href="/onboarding?from=banner"
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#fff',
          background: 'var(--brand, #8b5cf6)',
          padding: '5px 12px',
          borderRadius: 6,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        지금 완성
      </Link>
      <button
        onClick={() => { setDismissed(); setVisible(false); }}
        aria-label="배너 닫기"
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--text-secondary, #94a3b8)',
          cursor: 'pointer',
          fontSize: 18,
          lineHeight: 1,
          padding: 2,
        }}
      >
        ×
      </button>
    </div>
  );
}
