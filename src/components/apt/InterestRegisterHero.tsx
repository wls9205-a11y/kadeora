'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { KAKAO_CHANNEL_CHAT_URL } from '@/lib/constants';

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
      // s187 fix: source 의 suffix 는 반드시 slug — auth/callback 이 slug 로 apt_sites 조회.
      // aptId 는 UUID 일 수 있어 slug 매칭 실패로 silent fail (apt_site_interests 0 행의 직접 원인).
      const key = aptSlug || aptId;
      const source = `apt_interest_${key}`;
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
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-md)',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
          관심 단지로 저장
          {statusLabel && (
            <span
              style={{
                marginLeft: 8,
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--brand-bg)',
                color: 'var(--brand)',
                fontSize: 'var(--fs-xs)',
                fontWeight: 500,
              }}
            >
              {statusLabel}
            </span>
          )}
        </div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', wordBreak: 'keep-all' }}>
          카더라 계정에 저장하고 청약 일정을 앱으로 받아보세요
        </div>
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || done}
        style={{
          padding: '10px 18px',
          borderRadius: 'var(--radius-pill)',
          background: done ? 'var(--brand-bg)' : 'var(--kakao-bg)',
          color: done ? 'var(--brand)' : 'var(--kakao-text)',
          fontWeight: 500,
          fontSize: 'var(--fs-sm)',
          border: 'none',
          cursor: loading || done ? 'default' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {done ? '저장 완료' : loading ? '저장 중…' : isLoggedIn ? '관심 단지 저장' : '로그인하고 저장'}
      </button>
      {/* s2-잔여: 보조 CTA 는 카카오톡 1:1 문의 하나뿐이다. 주 CTA(관심 등록)와 경쟁시키지 않도록
           버튼이 아닌 텍스트 링크로 둔다. 채널 ID 는 constants 단일 출처. */}
      <a
        href={KAKAO_CHANNEL_CHAT_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: 'var(--fs-xs)',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        카카오톡 문의
      </a>
      {err && (
        <div style={{ width: '100%', fontSize: 'var(--fs-xs)', color: 'var(--accent-red)', marginTop: 4 }}>{err}</div>
      )}
      {/* Phase 5 B2: 등록 완료 후 가점 매칭 follow-up CTA */}
      {done && isLoggedIn && (
        <div style={{ width: '100%', marginTop: 4, padding: '8px 10px', background: 'rgba(250,199,117,0.08)', border: '1px solid rgba(250,199,117,0.3)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-sm)', flexWrap: 'wrap' }}>
          {/* ⚠️ #FAC775 는 제 8% 틴트 배경 위에서 대비 1.50 이었다(★·링크 둘 다).
               같은 배경에서 기존 토큰 --kd-accent(#7A4F0A)는 6.87. 새 토큰은 만들지 않았다. */}
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 600 }}>
            <span style={{ color: 'var(--kd-accent)', marginRight: 4 }}>★</span>
            가점 입력하면 매칭 단지 자동 알림
          </span>
          <Link href="/profile/cheongak" style={{ fontSize: 'var(--fs-xs)', fontWeight: 500, color: 'var(--kd-accent)', textDecoration: 'none' }}>입력하기 →</Link>
        </div>
      )}
    </div>
  );
}
