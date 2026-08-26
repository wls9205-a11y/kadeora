import React from 'react';
import Link from 'next/link';

const ESTIMATED_MIN_SCORE = 60;

interface Props {
  isLoggedIn: boolean;
  myScore?: number | null;
  aptName: string;
}

export default function CheongakMatchCard({ isLoggedIn, myScore, aptName }: Props) {
  if (!isLoggedIn) {
    return (
      <section
        aria-label="가점 매칭"
        style={{
          background: 'var(--kd-accent-soft)',
          border: '1px solid var(--kd-accent-border)',
          borderRadius: 12,
          padding: '14px 16px',
          margin: '0 0 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 500, color: 'var(--kd-accent)', letterSpacing: 0.5 }}>PHASE 5</div>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
            내 가점으로 {aptName} 당첨 가능?
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
            로그인 후 가점 입력 → 매칭 단지 자동 알림
          </div>
        </div>
        <Link
          href="/profile/cheongak"
          style={{
            padding: '8px 14px',
            borderRadius: 999,
            background: 'var(--kd-accent)',
            // ⚠️ 하드코딩 #1A1A18 은 --kd-accent(#7A4F0A) 위에서 대비 2.45 였다. TY1-3 에서 이 버튼을
            //    800→500 으로 낮추니 더 불리해진다. 기존 토큰 --text-inverse 로 바꿔 7.12. 새 토큰은 만들지 않았다.
            color: 'var(--text-inverse)',
            fontWeight: 500,
            fontSize: 'var(--fs-xs)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          가점 입력 →
        </Link>
      </section>
    );
  }

  if (myScore == null) {
    return (
      <section
        aria-label="가점 매칭"
        style={{
          background: 'var(--kd-accent-soft)',
          border: '1px solid var(--kd-accent-border)',
          borderRadius: 12,
          padding: '14px 16px',
          margin: '0 0 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 500, color: 'var(--kd-accent)', letterSpacing: 0.5 }}>PHASE 5</div>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
            내 가점 입력하면 당첨 확률이 보입니다
          </div>
        </div>
        <Link
          href="/profile/cheongak"
          style={{ padding: '8px 14px', borderRadius: 999, background: 'var(--kd-accent)', color: 'var(--text-inverse)', fontWeight: 500, fontSize: 'var(--fs-xs)', textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          가점 입력 →
        </Link>
      </section>
    );
  }

  const diff = myScore - ESTIMATED_MIN_SCORE;
  // 단순 추정: 점수 차이로 확률 매핑 — +20점=99%, +0=50%, -20=10%
  const winPct = Math.round(Math.max(5, Math.min(99, 50 + diff * 2.5)));
  // ⚠️ 세 번째 갈래는 '#FF6B6B' 였고 --kd-accent-soft 위에서 대비 2.59 — 대형 텍스트 3:1 도 미달이었다.
  //    형제 두 값(--success #065F46 · --kd-accent #7A4F0A)은 어두운데 이것만 밝았다(TY1-2 와 같은 패턴).
  //    기존 토큰 --kd-danger(#6B1F1F)로 10.63. 새 토큰은 만들지 않았다.
  const successColor = winPct >= 70 ? 'var(--success)' : winPct >= 40 ? 'var(--kd-accent)' : 'var(--kd-danger)';

  return (
    <section
      aria-label="가점 매칭"
      style={{
        background: 'var(--kd-accent-soft)',
        border: '1px solid var(--kd-accent-border)',
        borderRadius: 12,
        padding: '14px 16px',
        margin: '0 0 12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 500, color: 'var(--kd-accent)', letterSpacing: 0.5 }}>PHASE 5</span>
        <Link href="/profile/cheongak" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textDecoration: 'none', fontWeight: 500 }}>가점 수정 →</Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: 0.5 }}>내 가점</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: -0.5, lineHeight: 1.1 }}>
            {myScore}<span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}> / 84</span>
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>예상 최저 {ESTIMATED_MIN_SCORE}점</div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: 0.5 }}>당첨 가능</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, color: successColor, letterSpacing: -0.5, lineHeight: 1.1 }}>
            {winPct}<span style={{ fontSize: 'var(--fs-sm)' }}>%</span>
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
            {diff >= 0 ? `+${diff}점 우위` : `${Math.abs(diff)}점 부족`}
          </div>
        </div>
      </div>
    </section>
  );
}
