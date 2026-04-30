'use client';

/**
 * PriceChart
 *
 * 평당가 시계열 area chart. 3M/6M/12M/3Y 토글.
 * 실거래 탭의 시그니처 위젯.
 */

import { useMemo, useState } from 'react';
import { formatKrwShort, formatPercent } from '../utils';
import type { PriceChartPoint, PriceChartRange } from '../types';

type Props = {
  data: PriceChartPoint[];
  defaultRange?: PriceChartRange;
};

const RANGES: { id: PriceChartRange; label: string; days: number }[] = [
  { id: '3M', label: '3M', days: 90 },
  { id: '6M', label: '6M', days: 180 },
  { id: '12M', label: '12M', days: 365 },
  { id: '3Y', label: '3Y', days: 1095 },
];

export function PriceChart({ data, defaultRange = '12M' }: Props) {
  const [range, setRange] = useState<PriceChartRange>(defaultRange);

  const filtered = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)?.days ?? 365;
    const cutoff = Date.now() - days * 86400000;
    return data
      .filter((d) => new Date(d.date).getTime() >= cutoff)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data, range]);

  const stats = useMemo(() => {
    if (filtered.length < 2) return { latest: 0, change: 0, changePct: 0 };
    const first = filtered[0].pricePerPyeong;
    const last = filtered[filtered.length - 1].pricePerPyeong;
    const change = last - first;
    const changePct = first === 0 ? 0 : (change / first) * 100;
    return { latest: last, change, changePct };
  }, [filtered]);

  const path = useMemo(() => {
    if (filtered.length < 2) return { line: '', area: '' };

    const W = 600;
    const H = 140;
    const padding = 20;
    const innerW = W - padding * 2;
    const innerH = H - padding * 2;

    const min = Math.min(...filtered.map((d) => d.pricePerPyeong));
    const max = Math.max(...filtered.map((d) => d.pricePerPyeong));
    const range = max - min || 1;

    const points = filtered.map((d, i) => {
      const x = padding + (i / (filtered.length - 1)) * innerW;
      const y = padding + innerH - ((d.pricePerPyeong - min) / range) * innerH;
      return { x, y };
    });

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const area = `${line} L${points[points.length - 1].x},${H - padding} L${padding},${H - padding} Z`;

    return { line, area, points };
  }, [filtered]);

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
      {/* 토글 + 현재값 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '12px',
          gap: '12px',
          flexWrap: 'wrap',
          rowGap: '8px',
        }}
      >
        <div style={{ display: 'flex', gap: '5px' }}>
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className="aptr-btn-reset aptr-focus"
              style={{
                fontSize: '10px',
                padding: '5px 10px',
                background: range === r.id ? 'var(--aptr-brand)' : 'var(--aptr-bg-elevated)',
                color: range === r.id ? '#FFFFFF' : 'var(--aptr-text-secondary)',
                border:
                  range === r.id ? 'none' : '0.5px solid var(--aptr-border-subtle)',
                borderRadius: 'var(--aptr-radius-xs)',
                fontWeight: 500,
                letterSpacing: '0.3px',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div style={{ textAlign: 'right' }}>
          <div
            className="aptr-num"
            style={{
              fontSize: '18px',
              fontWeight: 500,
              color: 'var(--aptr-text-primary)',
              lineHeight: 1,
            }}
          >
            {formatKrwShort(stats.latest)}
            <span
              style={{ fontSize: '11px', color: 'var(--aptr-text-tertiary)', marginLeft: '3px' }}
            >
              /평
            </span>
          </div>
          <div
            className="aptr-num"
            style={{
              fontSize: '10px',
              marginTop: '2px',
              color: stats.change >= 0 ? 'var(--aptr-positive)' : 'var(--aptr-negative)',
            }}
          >
            {stats.change >= 0 ? '▲' : '▼'} {formatKrwShort(Math.abs(stats.change))}{' '}
            {formatPercent(stats.changePct)}
          </div>
        </div>
      </div>

      {/* 차트 */}
      {filtered.length < 2 ? (
        <div
          style={{
            height: '140px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--aptr-text-tertiary)',
            fontSize: '12px',
          }}
        >
          데이터 부족
        </div>
      ) : (
        <svg
          viewBox="0 0 600 140"
          style={{ width: '100%', height: 'auto', display: 'block' }}
          preserveAspectRatio="none"
          aria-label="평당가 시계열 차트"
        >
          {/* 가로선 */}
          <line
            x1="20"
            y1="120"
            x2="580"
            y2="120"
            stroke="var(--aptr-border-subtle)"
            strokeWidth="0.5"
          />
          <line
            x1="20"
            y1="80"
            x2="580"
            y2="80"
            stroke="var(--aptr-border-subtle)"
            strokeWidth="0.5"
            strokeDasharray="2,3"
          />
          <line
            x1="20"
            y1="40"
            x2="580"
            y2="40"
            stroke="var(--aptr-border-subtle)"
            strokeWidth="0.5"
            strokeDasharray="2,3"
          />

          {/* area + line */}
          <path d={path.area} fill="var(--aptr-brand)" opacity="0.12" />
          <path d={path.line} stroke="var(--aptr-brand)" strokeWidth="2" fill="none" />

          {/* 마지막 포인트 */}
          {path.points && path.points.length > 0 ? (
            <>
              <circle
                cx={path.points[path.points.length - 1].x}
                cy={path.points[path.points.length - 1].y}
                r="6"
                fill="var(--aptr-brand)"
                opacity="0.25"
              />
              <circle
                cx={path.points[path.points.length - 1].x}
                cy={path.points[path.points.length - 1].y}
                r="3"
                fill="var(--aptr-brand)"
              />
            </>
          ) : null}
        </svg>
      )}
    </div>
  );
}
