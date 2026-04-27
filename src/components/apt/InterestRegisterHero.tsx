'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  aptId: string | number;
  aptName: string;
  aptSlug?: string | null;
  status?: string | null;
  isLoggedIn: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  open: '접수중',
  upcoming: '접수예정',
  closed: '마감',
};

export function InterestRegisterHero({ aptId, aptName, aptSlug, status, isLoggedIn }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleClick() {
    setErr(null);
    if (!isLoggedIn) {
      const source = `apt_interest_${aptId}`;
      const redirect = encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/apt');
      router.push(`/login?source=${encodeURIComponent(source)}&action=register_interest&redirect=${redirect}`);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch('/api/apt/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_slug: aptSlug || undefined,
          apt_name: aptName,
          source: 'hero_cta',
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j?.error || '관심 등록에 실패했습니다');
      } else {
        setDone(true);
      }
    } catch {
      setErr('네트워크 오류');
    } finally {
      setLoading(false);
    }
  }

  const statusLabel = status ? STATUS_LABEL[status] || status : null;

  return (
    <div
      style={{
        margin: '12px 0 16px',
        padding: '14px 16px',
        background: 'linear-gradient(135deg, rgba(0,255,135,0.08), rgba(0,229,255,0.08))',
        border: '1px solid rgba(0,255,135,0.18)',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 2 }}>
          관심 단지로 저장
          {statusLabel && (
            <span
              style={{
                marginLeft: 8,
                padding: '2px 8px',
                borderRadius: 999,
                background: 'rgba(0,255,135,0.16)',
                color: '#00FF87',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {statusLabel}
            </span>
          )}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'keep-all' }}>
          {aptName} 청약·일정 알림 받기
        </div>
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || done}
        style={{
          padding: '10px 18px',
          borderRadius: 999,
          background: done ? 'rgba(0,255,135,0.2)' : '#00FF87',
          color: done ? '#00FF87' : '#000',
          fontWeight: 800,
          fontSize: 13,
          border: 'none',
          cursor: loading || done ? 'default' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {done ? '✓ 등록 완료' : loading ? '등록 중…' : isLoggedIn ? '관심 등록' : '로그인하고 등록'}
      </button>
      {err && (
        <div style={{ width: '100%', fontSize: 12, color: '#FF6B6B', marginTop: 4 }}>{err}</div>
      )}
    </div>
  );
}
