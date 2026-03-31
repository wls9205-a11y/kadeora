'use client';
import { useMemo } from 'react';

interface PriceHistory { date: string; close_price: number; volume: number; change_pct?: number; }
interface Props { data: PriceHistory[]; currency: string; isKR: boolean; }

export default function StockTrendLine({ data, currency, isKR }: Props) {
  const W = 320, H = 120, PADDING = { top: 10, right: 10, bottom: 24, left: 42 };

  const sorted = useMemo(() => [...data].sort((a, b) => a.date.localeCompare(b.date)), [data]);

  const { pts, trendPts, min, max, volMax, vols } = useMemo(() => {
    if (sorted.length < 2) return { pts: '', trendPts: '', min: 0, max: 0, volMax: 0, vols: [] };
    const prices = sorted.map(d => Number(d.close_price));
    const min = Math.min(...prices) * 0.998;
    const max = Math.max(...prices) * 1.002;
    const range = max - min || 1;
    const chartW = W - PADDING.left - PADDING.right;
    const chartH = H - PADDING.top - PADDING.bottom;

    const toX = (i: number) => PADDING.left + (i / (sorted.length - 1)) * chartW;
    const toY = (v: number) => PADDING.top + chartH - ((v - min) / range) * chartH;

    const pts = sorted.map((d, i) => `${toX(i)},${toY(Number(d.close_price))}`).join(' ');

    // 선형회귀 트렌드라인
    const n = sorted.length;
    const sumX = (n - 1) * n / 2;
    const sumY = prices.reduce((a, b) => a + b, 0);
    const sumXY = prices.reduce((s, p, i) => s + i * p, 0);
    const sumX2 = (n - 1) * n * (2 * n - 1) / 6;
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const trendPts = [0, n - 1].map(i => `${toX(i)},${toY(slope * i + intercept)}`).join(' ');

    const vols = sorted.map(d => Number(d.volume));
    const volMax = Math.max(...vols, 1);
    return { pts, trendPts, min, max, range, volMax, vols };
  }, [sorted]);

  if (sorted.length < 5) return null;

  const last = sorted[sorted.length - 1];
  const first = sorted[0];
  const totalChange = ((Number(last.close_price) - Number(first.close_price)) / Number(first.close_price)) * 100;
  const isUp = totalChange >= 0;
  const upC = isKR ? '#FF6B6B' : '#2EE8A5';
  const dnC = isKR ? '#6CB4FF' : '#FF6B6B';
  const lineColor = isUp ? upC : dnC;
  const chartW = W - PADDING.left - PADDING.right;
  const chartH = H - PADDING.top - PADDING.bottom;
  const range = max - min || 1;

  const toX = (i: number) => PADDING.left + (i / (sorted.length - 1)) * chartW;
  const toY = (v: number) => PADDING.top + chartH - ((v - min) / range) * chartH;
  const fillPath = `${pts} L${W - PADDING.right},${PADDING.top + chartH} L${PADDING.left},${PADDING.top + chartH}Z`;

  const fmtPrice = (v: number) => currency === 'USD' ? `$${v.toFixed(2)}` : `₩${Math.round(v).toLocaleString()}`;
  const fmtK = (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(v);

  // Y축 레이블 4개
  const yLabels = [0, 0.33, 0.67, 1].map(t => ({ val: min + t * range, y: toY(min + t * range) }));

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-xs)' }}>
        <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{sorted.length}일 차트 + 트렌드라인</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: lineColor, fontFamily: 'monospace' }}>
          {totalChange > 0 ? '+' : ''}{totalChange.toFixed(2)}% ({sorted.length}일)
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block' }}>
        {/* fill 영역 */}
        <path d={fillPath} fill={`${lineColor}12`} />
        {/* 거래량 바 */}
        {sorted.map((d, i) => {
          const bH = (Number(d.volume) / volMax) * 14;
          return <rect key={i} x={toX(i) - 1} y={PADDING.top + chartH - bH} width={2} height={bH} fill={lineColor} opacity="0.2" />;
        })}
        {/* 가격 선 */}
        <polyline points={pts} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* 트렌드라인 */}
        <polyline points={trendPts} fill="none" stroke={lineColor} strokeWidth="1" strokeDasharray="4,3" opacity="0.6" />
        {/* 마지막 점 */}
        <circle cx={toX(sorted.length - 1)} cy={toY(Number(last.close_price))} r="3" fill={lineColor} />
        {/* Y축 */}
        {yLabels.map((l, i) => (
          <g key={i}>
            <line x1={PADDING.left - 4} y1={l.y} x2={W - PADDING.right} y2={l.y} stroke="var(--border)" strokeWidth="0.5" />
            <text x={PADDING.left - 5} y={l.y} textAnchor="end" dominantBaseline="middle" fontSize="7" fill="var(--text-tertiary)" fontFamily="monospace">{currency === 'USD' ? `$${l.val.toFixed(0)}` : `${(l.val / 1000).toFixed(0)}K`}</text>
          </g>
        ))}
        {/* X축 날짜 */}
        {[0, Math.floor(sorted.length / 2), sorted.length - 1].map(i => (
          <text key={i} x={toX(i)} y={H - 4} textAnchor="middle" fontSize="7" fill="var(--text-tertiary)" fontFamily="monospace">{sorted[i].date.slice(5)}</text>
        ))}
        {/* 트렌드 방향 라벨 */}
        <text x={W - PADDING.right - 2} y={PADDING.top + 6} textAnchor="end" fontSize="7" fill={lineColor} opacity="0.8" fontFamily="monospace">추세↗</text>
      </svg>
    </div>
  );
}
