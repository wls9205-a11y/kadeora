// r4-P3 — 스펙 표. 상세 페이지에 흩어져 있던 표를 이 하나로 통합한다.
//
// 기본값은 여전히 "빈 값 행은 자동 제외" 다. 이 표는 여러 곳에서 쓰인다.
//
// s-v2: `keepEmpty` 를 켜면 규칙이 반전된다 — 행을 빼지 않고 값 칸을 `미공개` 로 채운다.
//   현장마다 채워진 필드가 달라서 행이 들쭉날쭉하면 첫 화면이 현장마다 다르게 보인다.
//   행 수를 고정하면 어느 현장을 열어도 같은 표가 나오고, 빈 칸 자체가 질문 훅이 된다.
//   ⚠️ 있는 값을 숨겨서 `미공개` 를 만들지 말 것 — 게이트 회귀다.

import React from 'react';

export interface SpecTableRow {
  label: string;
  value: React.ReactNode;
}

export interface SpecTableProps {
  rows: SpecTableRow[];
  /** 표 자체의 캡션(출처·기준일 등). */
  caption?: React.ReactNode;
  /** true 면 빈 값 행도 남기고 `emptyValue` 를 대신 넣는다. 행 수가 고정된다. */
  keepEmpty?: boolean;
  /** 빈 칸에 넣을 내용. 문자열이면 그대로, 함수면 라벨을 받아 노드를 만든다. */
  emptyValue?: React.ReactNode | ((label: string) => React.ReactNode);
}

/** null · undefined · 빈 문자열 · 공백만 있는 값은 행으로 만들지 않는다. */
function hasValue(v: React.ReactNode): boolean {
  if (v === null || v === undefined || v === false) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'number') return Number.isFinite(v);
  return true;
}

export default function SpecTable({
  rows,
  caption,
  keepEmpty = false,
  emptyValue = '미공개',
}: SpecTableProps) {
  const visible = keepEmpty
    ? rows.map((r) =>
        hasValue(r.value)
          ? r
          : {
              ...r,
              value: typeof emptyValue === 'function' ? emptyValue(r.label) : emptyValue,
            },
      )
    : rows.filter((r) => hasValue(r.value));
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
