// r4-P3 — 수치 레코드 카드 v3 (실거래·시세·공급 등).
//
// 이미지가 없는 카드다. 읽는 사람이 보는 건 숫자 두세 개와 그 기준일이다.
// 값이 빈 행은 자동으로 빠진다 — "-" 로 채운 줄은 정보가 아니다.

import React from 'react';
import Link from 'next/link';

export type RecordTone = 'up' | 'down' | 'flat';

export interface RecordRow {
  label: string;
  value: React.ReactNode;
  /** 등락 표시. 국내/해외 색 규칙은 상위에서 정한 값을 쓴다. */
  tone?: RecordTone;
}

export interface RecordCardProps {
  /** 없으면 링크가 아닌 정적 카드로 렌더한다. */
  href?: string;
  title: string;
  /** 지역·시장 등 부제. */
  meta?: string;
  /** 최대 3행. */
  rows: RecordRow[];
  /** 기준일·출처 등 이미 포맷된 짧은 문자열. */
  caption?: string;
}

const TONE_COLOR: Record<RecordTone, string> = {
  up: 'var(--stock-up)',
  down: 'var(--stock-down)',
  flat: 'var(--stock-flat)',
};

function hasValue(v: React.ReactNode): boolean {
  if (v === null || v === undefined || v === false) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'number') return Number.isFinite(v);
  return true;
}

export default function RecordCard({ href, title, meta, rows, caption }: RecordCardProps) {
  const visible = rows.filter((r) => hasValue(r.value)).slice(0, 3);

  const inner = (
    <>
      <div style={{ minWidth: 0 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--fs-sm)',
            fontWeight: 600,
            lineHeight: 1.4,
            color: 'var(--text-primary)',
            wordBreak: 'keep-all',
          }}
        >
          {title}
        </h3>
        {meta ? (
          <p style={{ margin: '2px 0 0', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
            {meta}
          </p>
        ) : null}
      </div>

      {visible.length > 0 ? (
        <dl
          style={{
            margin: 'var(--sp-sm) 0 0',
            display: 'grid',
            gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))`,
            gap: 'var(--sp-xs)',
          }}
        >
          {visible.map((r) => (
            <div key={r.label} style={{ minWidth: 0 }}>
              <dt style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{r.label}</dt>
              <dd
                style={{
                  margin: '2px 0 0',
                  fontSize: 'var(--fs-md)',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: r.tone ? TONE_COLOR[r.tone] : 'var(--text-primary)',
                }}
              >
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {caption ? (
        <p style={{ margin: 'var(--sp-sm) 0 0', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
          {caption}
        </p>
      ) : null}
    </>
  );

  const boxStyle: React.CSSProperties = {
    display: 'block',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-card)',
    background: 'var(--bg-surface)',
    padding: 'var(--card-p)',
    textDecoration: 'none',
    color: 'inherit',
  };

  if (!href) return <div style={boxStyle}>{inner}</div>;
  return (
    <Link href={href} style={boxStyle}>
      {inner}
    </Link>
  );
}
