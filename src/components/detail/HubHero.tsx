// r4-P3 — 허브(목록) 페이지 최상단.
//
// 상세와 달리 이미지가 없다. 허브의 일은 "여기 무엇이 몇 건 있는지" 를 먼저 말하는 것이다.
// 지표가 없으면 지표 줄을 렌더하지 않는다 — 0 만 늘어선 줄은 신뢰를 깎는다.

import React from 'react';

export interface HubStat {
  label: string;
  value: React.ReactNode;
}

export interface HubHeroProps {
  /** 라틴 대문자 eyebrow. 이모지 대체. */
  eyebrow: string;
  title: string;
  /** h1 의 id. */
  titleId?: string;
  description?: string;
  /** 최대 4개. 빈 값은 자동 제외. */
  stats?: HubStat[];
  /** 도구 칩·필터 등. */
  action?: React.ReactNode;
}

function hasValue(v: React.ReactNode): boolean {
  if (v === null || v === undefined || v === false) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'number') return Number.isFinite(v);
  return true;
}

export default function HubHero({
  eyebrow,
  title,
  titleId,
  description,
  stats,
  action,
}: HubHeroProps) {
  const shown = (stats ?? []).filter((s) => hasValue(s.value)).slice(0, 4);

  return (
    <header style={{ marginBottom: 'var(--sp-lg)' }}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--fs-xs)',
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: 'var(--brand)',
          fontWeight: 600,
          marginBottom: 3,
        }}
      >
        {eyebrow}
      </div>

      <h1
        id={titleId}
        style={{
          fontSize: 'var(--fs-xl)',
          fontWeight: 600,
          letterSpacing: '-.025em',
          lineHeight: 1.25,
          margin: 0,
          color: 'var(--text-primary)',
          wordBreak: 'keep-all',
        }}
      >
        {title}
      </h1>

      {description ? (
        <p
          style={{
            margin: 'var(--sp-xs) 0 0',
            fontSize: 'var(--fs-sm)',
            lineHeight: 1.7,
            color: 'var(--text-secondary)',
            wordBreak: 'keep-all',
          }}
        >
          {description}
        </p>
      ) : null}

      {shown.length > 0 ? (
        <dl
          style={{
            margin: 'var(--sp-md) 0 0',
            display: 'grid',
            gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))`,
            gap: 'var(--sp-sm)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface)',
            padding: 'var(--sp-md)',
          }}
        >
          {shown.map((s) => (
            <div key={s.label} style={{ minWidth: 0 }}>
              <dt style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{s.label}</dt>
              <dd
                style={{
                  margin: '2px 0 0',
                  fontSize: 'var(--fs-md)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {action ? <div style={{ marginTop: 'var(--sp-md)' }}>{action}</div> : null}
    </header>
  );
}
