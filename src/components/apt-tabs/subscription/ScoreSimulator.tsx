'use client';

/**
 * ScoreSimulator
 *
 * 청약 가점 시뮬레이터. 사용자가 자기 가점 입력 → 당첨 가능 단지 자동 계산.
 * 청약 탭의 시그니처 위젯.
 */

import { useState } from 'react';

type TargetSite = {
  name: string;
  minScore: number;
};

type Props = {
  initialScore?: number;
  targets: TargetSite[];
};

export function ScoreSimulator({ initialScore = 60, targets }: Props) {
  const [score, setScore] = useState(initialScore);

  // 가점 기준 가장 가까운 타겟
  const closest = [...targets]
    .map((t) => ({ ...t, gap: t.minScore - score }))
    .sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap))[0];

  const message = closest
    ? closest.gap > 0
      ? `${closest.name} 당첨권까지 -${closest.gap}점`
      : closest.gap === 0
      ? `${closest.name} 당첨권 진입`
      : `${closest.name} 안정권 +${Math.abs(closest.gap)}점`
    : '진행 중인 청약 없음';

  const tone = closest && closest.gap > 0 ? 'negative' : 'positive';

  return (
    <div
      style={{
        background: 'var(--aptr-bg-card)',
        border: '0.5px solid var(--aptr-border-subtle)',
        borderRadius: 'var(--aptr-radius-md)',
        padding: '14px',
        boxShadow: 'var(--aptr-shadow-card)',
      }}
    >
      <div
        style={{
          fontSize: '10px',
          color: 'var(--aptr-text-tertiary)',
          letterSpacing: '0.3px',
          marginBottom: '6px',
        }}
      >
        내 가점 시뮬레이터
      </div>

      <div
        className="aptr-num"
        style={{
          fontSize: '32px',
          fontWeight: 500,
          color: 'var(--aptr-text-primary)',
          lineHeight: 1,
        }}
      >
        {score}
        <span
          style={{
            fontSize: '14px',
            color: 'var(--aptr-text-tertiary)',
            marginLeft: '2px',
          }}
        >
          점
        </span>
      </div>

      <div
        style={{
          fontSize: '11px',
          marginTop: '6px',
          color: tone === 'negative' ? 'var(--aptr-negative)' : 'var(--aptr-positive)',
        }}
      >
        ▲ {message}
      </div>

      <div
        style={{
          height: '0.5px',
          background: 'var(--aptr-border-subtle)',
          margin: '12px 0',
        }}
      />

      <label
        style={{
          fontSize: '10px',
          color: 'var(--aptr-text-tertiary)',
          marginBottom: '6px',
          display: 'block',
        }}
      >
        가점 조정
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type="range"
          min={0}
          max={84}
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          aria-label="청약 가점"
          style={{
            flex: 1,
            height: '4px',
            accentColor: 'var(--aptr-brand)',
          }}
        />
        <span
          className="aptr-num"
          style={{
            fontSize: '11px',
            fontWeight: 500,
            color: 'var(--aptr-text-primary)',
            minWidth: '32px',
            textAlign: 'right',
          }}
        >
          {score}/84
        </span>
      </div>

      <button
        type="button"
        className="aptr-btn-reset aptr-focus"
        style={{
          marginTop: '12px',
          width: '100%',
          padding: '9px',
          background: 'var(--aptr-brand)',
          color: '#FFFFFF',
          borderRadius: 'var(--aptr-radius-sm)',
          fontSize: '12px',
          fontWeight: 500,
          letterSpacing: '0.2px',
        }}
        onClick={() => alert('알림 신청 (실제 구현 연결)')}
      >
        당첨권 진입 시 알림 받기 →
      </button>
    </div>
  );
}
