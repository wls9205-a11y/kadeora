'use client';

import { useState, useRef, useCallback } from 'react';

export interface CandleData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface Props {
  data: CandleData[];
  width?: number;
  height?: number;
  showVolume?: boolean;
  currency?: string;
}

function fmtNum(v: number, currency?: string) {
  if (currency === 'USD') return `$${v.toFixed(2)}`;
  return `₩${v.toLocaleString()}`;
}

function fmtVol(v: number) {
  if (v >= 1e8) return `${(v / 1e8).toFixed(1)}억`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(0)}만`;
  return v.toLocaleString();
}

export default function CandlestickChart({ data, width = 340, height = 240, showVolume = true, currency }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleInteraction = useCallback((clientX: number) => {
    if (!svgRef.current || !data || data.length < 2) return;
    const P = 8;
    const gapW = (width - P * 2) / data.length;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * width;
    const idx = Math.floor((svgX - P) / gapW);
    if (idx >= 0 && idx < data.length) {
      setSelected(idx);
    }
  }, [data, width]);

  if (!data || data.length < 2) return null;

  const chartH = showVolume ? height * 0.65 : height - 20;
  const volH = showVolume ? height * 0.2 : 0;
  const volGap = showVolume ? height * 0.04 : 0;
  const P = 8;
  const BOTTOM = 16; // date label space

  const prices = data.flatMap(d => [d.high, d.low]);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const rangeP = maxP - minP || 1;

  const maxVol = showVolume ? Math.max(...data.map(d => d.volume || 0), 1) : 1;

  const candleW = Math.max(2, Math.min(10, (width - P * 2) / data.length * 0.65));
  const gapW = (width - P * 2) / data.length;

  const toY = (price: number) => P + (1 - (price - minP) / rangeP) * (chartH - P * 2);

  const d = selected !== null && selected >= 0 && selected < data.length ? data[selected] : null;
  const changePct = d ? ((d.close - d.open) / d.open * 100) : 0;
  const isSelectedUp = d ? d.close >= d.open : true;

  return (
    <div>
      {/* 툴팁 */}
      <div style={{
        minHeight: 44, marginBottom: 'var(--sp-sm)', padding: '6px 10px',
        background: d ? 'var(--bg-hover)' : 'transparent',
        borderRadius: 8, transition: 'background 0.15s',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        {d ? (
          <>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {d.date}
            </span>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
              시 {fmtNum(d.open, currency)}
            </span>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-red)' }}>
              고 {fmtNum(d.high, currency)}
            </span>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-blue)' }}>
              저 {fmtNum(d.low, currency)}
            </span>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: isSelectedUp ? 'var(--accent-red)' : 'var(--accent-blue)' }}>
              종 {fmtNum(d.close, currency)}
            </span>
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: isSelectedUp ? 'var(--accent-red)' : 'var(--accent-blue)' }}>
              {changePct > 0 ? '+' : ''}{changePct.toFixed(2)}%
            </span>
            {d.volume != null && (
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                거래 {fmtVol(d.volume)}
              </span>
            )}
          </>
        ) : (
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
            차트를 터치하면 상세 정보를 볼 수 있습니다
          </span>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height, touchAction: 'none', cursor: 'crosshair' }}
        onMouseMove={e => handleInteraction(e.clientX)}
        onMouseLeave={() => setSelected(null)}
        onTouchMove={e => { e.preventDefault(); handleInteraction(e.touches[0].clientX); }}
        onTouchEnd={() => setSelected(null)}
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const y = P + pct * (chartH - P * 2);
          const price = maxP - pct * rangeP;
          return (
            <g key={pct}>
              <line x1={P} x2={width - P} y1={y} y2={y}
                stroke="var(--border, #152240)" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.5" />
              {(pct === 0 || pct === 0.5 || pct === 1) && (
                <text x={width - P + 2} y={y + 3} textAnchor="start" fontSize="8" fill="var(--text-tertiary, #7D8DA3)">
                  {price >= 10000 ? `${(price / 10000).toFixed(0)}만` : price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </text>
              )}
            </g>
          );
        })}

        {/* Crosshair for selected candle */}
        {selected !== null && selected >= 0 && selected < data.length && (
          <>
            <line
              x1={P + selected * gapW + gapW / 2} x2={P + selected * gapW + gapW / 2}
              y1={P} y2={chartH}
              stroke="var(--text-tertiary)" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.6"
            />
            <line
              x1={P} x2={width - P}
              y1={toY(data[selected].close)} y2={toY(data[selected].close)}
              stroke="var(--text-tertiary)" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.6"
            />
          </>
        )}

        {/* Candles */}
        {data.map((d, i) => {
          const x = P + i * gapW + gapW / 2;
          const isUp = d.close >= d.open;
          const color = isUp ? 'var(--stock-up, #f85149)' : 'var(--stock-down, #58a6ff)';
          const bodyTop = toY(Math.max(d.open, d.close));
          const bodyBottom = toY(Math.min(d.open, d.close));
          const bodyH = Math.max(bodyBottom - bodyTop, 1);
          const isActive = selected === i;

          return (
            <g key={i} opacity={selected !== null && !isActive ? 0.45 : 1} style={{ transition: 'opacity 0.1s' }}>
              <line x1={x} x2={x} y1={toY(d.high)} y2={toY(d.low)}
                stroke={color} strokeWidth={isActive ? 1.5 : 1} />
              <rect x={x - candleW / 2} y={bodyTop}
                width={candleW} height={bodyH}
                fill={color} fillOpacity={isUp ? 1 : 0.65}
                stroke={color} strokeWidth={isActive ? 1 : 0.5} rx="1" />
            </g>
          );
        })}

        {/* Volume bars */}
        {showVolume && data.map((d, i) => {
          const x = P + i * gapW + gapW / 2;
          const isUp = d.close >= d.open;
          const color = isUp ? 'var(--stock-up, #f85149)' : 'var(--stock-down, #58a6ff)';
          const volPct = (d.volume || 0) / maxVol;
          const barH = Math.max(volPct * volH, 0.5);
          const isActive = selected === i;
          return (
            <rect key={`v${i}`}
              x={x - candleW / 2} y={chartH + volGap + volH - barH}
              width={candleW} height={barH}
              fill={color} fillOpacity={isActive ? 0.6 : 0.25} rx="1"
              style={{ transition: 'fill-opacity 0.1s' }}
            />
          );
        })}

        {/* Date labels */}
        {data.map((d, i) => {
          // Show first, middle, last labels only
          if (i !== 0 && i !== data.length - 1 && i !== Math.floor(data.length / 2)) return null;
          const x = P + i * gapW + gapW / 2;
          return (
            <text key={d.date} x={x} y={height - 2} textAnchor="middle" fontSize="8" fill="var(--text-tertiary, #7D8DA3)">
              {d.date.slice(5)}
            </text>
          );
        })}

        {/* Invisible touch targets for each candle */}
        {data.map((_, i) => (
          <rect
            key={`touch${i}`}
            x={P + i * gapW} y={0}
            width={gapW} height={height}
            fill="transparent"
            onMouseEnter={() => setSelected(i)}
            onClick={() => setSelected(i)}
          />
        ))}
      </svg>
    </div>
  );
}
