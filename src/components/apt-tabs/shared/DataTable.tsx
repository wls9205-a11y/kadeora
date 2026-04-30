/**
 * DataTable
 *
 * 실거래·청약 일정 같은 구조화 데이터 표시용 테이블.
 * 데스크톱에서는 정식 grid table, 모바일에서는 그냥 stack.
 */

import Link from 'next/link';
import { BADGE_VARS } from '../utils';
import type { BadgeKind, ToneKind } from '../types';

export type Column = {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  width?: string; // "60px", "1fr"
  mono?: boolean;
};

export type RowCell = {
  text: string;
  tone?: ToneKind;
  badge?: { kind: BadgeKind; label: string };
  bold?: boolean;
};

export type DataTableRow = {
  id: string;
  href?: string;
  cells: Record<string, RowCell>;
};

type Props = {
  columns: Column[];
  rows: DataTableRow[];
  emptyMessage?: string;
};

function toneToColor(tone: ToneKind | undefined): string {
  switch (tone) {
    case 'positive':
      return 'var(--aptr-positive)';
    case 'negative':
      return 'var(--aptr-negative)';
    default:
      return 'var(--aptr-text-primary)';
  }
}

export function DataTable({ columns, rows, emptyMessage = '데이터가 없습니다' }: Props) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: '32px 14px',
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--aptr-text-tertiary)',
          background: 'var(--aptr-bg-card)',
          border: '0.5px solid var(--aptr-border-subtle)',
          borderRadius: 'var(--aptr-radius-md)',
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  const gridTemplate = columns.map((c) => c.width ?? '1fr').join(' ');

  return (
    <div
      style={{
        background: 'var(--aptr-bg-card)',
        border: '0.5px solid var(--aptr-border-subtle)',
        borderRadius: 'var(--aptr-radius-md)',
        overflow: 'hidden',
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          gap: '10px',
          padding: '8px 14px',
          background: 'var(--aptr-bg-elevated)',
          fontSize: '10px',
          color: 'var(--aptr-text-tertiary)',
          letterSpacing: '0.3px',
          fontWeight: 500,
        }}
      >
        {columns.map((c) => (
          <span
            key={c.key}
            style={{
              textAlign: c.align ?? 'left',
              wordBreak: 'keep-all',
            }}
          >
            {c.label}
          </span>
        ))}
      </div>

      {/* 행 */}
      {rows.map((row, idx) => {
        const content = (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: gridTemplate,
              gap: '10px',
              padding: '10px 14px',
              alignItems: 'center',
              borderTop: idx === 0 ? 'none' : '0.5px solid var(--aptr-border-subtle)',
            }}
          >
            {columns.map((c) => {
              const cell = row.cells[c.key];
              if (!cell) {
                return <span key={c.key} />;
              }

              const cellStyle: React.CSSProperties = {
                fontSize: c.mono ? '11px' : '12px',
                fontFamily: c.mono
                  ? 'var(--font-mono, ui-monospace, "SF Mono", monospace)'
                  : 'inherit',
                fontVariantNumeric: c.mono ? 'tabular-nums' : 'normal',
                color: toneToColor(cell.tone),
                fontWeight: cell.bold ? 500 : 400,
                textAlign: c.align ?? 'left',
                wordBreak: 'keep-all',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                justifyContent:
                  c.align === 'right'
                    ? 'flex-end'
                    : c.align === 'center'
                    ? 'center'
                    : 'flex-start',
              };

              const badgeColors = cell.badge ? BADGE_VARS[cell.badge.kind] : null;

              return (
                <span key={c.key} style={cellStyle}>
                  {badgeColors ? (
                    <span
                      style={{
                        fontSize: '9px',
                        padding: '1px 5px',
                        background: badgeColors.bg,
                        color: badgeColors.fg,
                        borderRadius: 'var(--aptr-radius-xs)',
                        fontWeight: 500,
                        flexShrink: 0,
                      }}
                    >
                      {cell.badge!.label}
                    </span>
                  ) : null}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {cell.text}
                  </span>
                </span>
              );
            })}
          </div>
        );

        return row.href ? (
          <Link
            key={row.id}
            href={row.href}
            className="aptr-link-reset aptr-focus"
            style={{ display: 'block' }}
          >
            {content}
          </Link>
        ) : (
          <div key={row.id}>{content}</div>
        );
      })}
    </div>
  );
}
