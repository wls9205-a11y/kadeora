// r4-P3 — 스펙 표. 상세 페이지에 흩어져 있던 표를 이 하나로 통합한다.
//
// 빈 값 행은 자동으로 빠진다. "정보 없음" 을 줄줄이 늘어놓는 표는 얇은 페이지 신호다.

import React from 'react';

export interface SpecTableRow {
  label: string;
  value: React.ReactNode;
}

export interface SpecTableProps {
  rows: SpecTableRow[];
  /** 표 자체의 캡션(출처·기준일 등). */
  caption?: React.ReactNode;
}

/** null · undefined · 빈 문자열 · 공백만 있는 값은 행으로 만들지 않는다. */
function hasValue(v: React.ReactNode): boolean {
  if (v === null || v === undefined || v === false) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'number') return Number.isFinite(v);
  return true;
}

export default function SpecTable({ rows, caption }: SpecTableProps) {
  const visible = rows.filter((r) => hasValue(r.value));
  if (visible.length === 0) return null;

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        background: 'var(--bg-surface)',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
        {caption ? (
          <caption
            style={{
              captionSide: 'bottom',
              textAlign: 'left',
              padding: 'var(--sp-sm) var(--sp-md)',
              fontSize: 'var(--fs-xs)',
              color: 'var(--text-tertiary)',
            }}
          >
            {caption}
          </caption>
        ) : null}
        <tbody>
          {visible.map((r, i) => (
            <tr
              key={r.label}
              style={{ borderTop: i === 0 ? undefined : '1px solid var(--border)' }}
            >
              <th
                scope="row"
                style={{
                  width: '34%',
                  textAlign: 'left',
                  verticalAlign: 'top',
                  padding: 'var(--sp-sm) var(--sp-md)',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-sunken)',
                  wordBreak: 'keep-all',
                }}
              >
                {r.label}
              </th>
              <td
                style={{
                  padding: 'var(--sp-sm) var(--sp-md)',
                  color: 'var(--text-primary)',
                  lineHeight: 1.6,
                  wordBreak: 'break-word',
                }}
              >
                {r.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
