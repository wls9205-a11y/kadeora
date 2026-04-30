/**
 * TrendChart
 *
 * 12개월 미분양 추이 bar chart. 감소 추세 시각화.
 * 미분양 탭의 시그니처 위젯.
 */

import { useMemo } from 'react';
import type { UnsoldTrendPoint } from '../types';

type Props = {
  data: UnsoldTrendPoint[];
};

const H_LABEL_Y = 100;

export function TrendChart({ data }: Props) {
  const stats = useMemo(() => {
    if (data.length < 2) return { latest: 0, first: 0, changePct: 0 };
    const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month));
    const first = sorted[0].count;
    const latest = sorted[sorted.length - 1].count;
    const changePct = first === 0 ? 0 : ((latest - first) / first) * 100;
    return { latest, first, changePct };
  }, [data]);

  const bars = useMemo(() => {
    if (data.length === 0) return [];
    const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month));
    const max = Math.max(...sorted.map((d) => d.count), 1);
    const W = 600;
    const H = 90;
    const padding = 20;
    const innerW = W - padding * 2;
    const innerH = H - padding * 2;
    const barW = innerW / sorted.length - 4;

    return sorted.map((d, i) => {
      const x = padding + i * (innerW / sorted.length) + 2;
      const h = (d.count / max) * innerH;
      const y = padding + innerH - h;
      return { x, y, w: barW, h, count: d.count, month: d.month };
    });
  }, [data]);

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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: '10px',
          gap: '12px',
        }}
      >
        <div
          style={{
            fontSize: '10px',
            color: 'var(--aptr-text-tertiary)',
            letterSpacing: '0.3px',
          }}
        >
          12개월 미분양 추이
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            className="aptr-num"
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--aptr-text-primary)',
            }}
          >
            {stats.latest}건
          </div>
          {stats.changePct !== 0 ? (
            <div
              className="aptr-num"
              style={{
                fontSize: '9px',
                color: stats.changePct < 0 ? 'var(--aptr-positive)' : 'var(--aptr-negative)',
              }}
            >
              {stats.changePct < 0 ? '▼' : '▲'} {Math.abs(stats.latest - stats.first)} (
              {stats.changePct > 0 ? '+' : ''}
              {stats.changePct.toFixed(0)}%)
            </div>
          ) : null}
        </div>
      </div>

      {data.length === 0 ? (
        <div
          style={{
            height: '90px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--aptr-text-tertiary)',
            fontSize: '12px',
          }}
        >
          데이터 없음
        </div>
      ) : (
        <svg
          viewBox="0 0 600 110"
          style={{ width: '100%', height: 'auto', display: 'block' }}
          preserveAspectRatio="none"
          aria-label="미분양 추이 차트"
        >
          <line
            x1="20"
            y1="70"
            x2="580"
            y2="70"
            stroke="var(--aptr-border-subtle)"
            strokeWidth="0.5"
          />
          {bars.map((b, i) => (
            <rect
              key={i}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              fill="var(--aptr-negative)"
              opacity={0.5 + (i / bars.length) * 0.4}
              rx="1"
            />
          ))}
          {bars.length > 0 ? (
            <>
              <text
                x={bars[0].x}
                y={H_LABEL_Y}
                fontSize="9"
                fill="var(--aptr-text-tertiary)"
              >
                {bars[0].month.slice(2)}
              </text>
              <text
                x={bars[bars.length - 1].x}
                y={H_LABEL_Y}
                fontSize="9"
                fill="var(--aptr-text-tertiary)"
                textAnchor="end"
              >
                {bars[bars.length - 1].month.slice(2)}
              </text>
            </>
          ) : null}
        </svg>
      )}
    </div>
  );
}
