'use client';

interface CandleData {
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
}

export default function CandlestickChart({ data, width = 340, height = 200, showVolume = true }: Props) {
  if (!data || data.length < 2) return null;

  const chartH = showVolume ? height * 0.7 : height;
  const volH = showVolume ? height * 0.25 : 0;
  const gap = showVolume ? height * 0.05 : 0;
  const P = 8;

  const prices = data.flatMap(d => [d.high, d.low]);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const rangeP = maxP - minP || 1;

  const maxVol = showVolume ? Math.max(...data.map(d => d.volume || 0), 1) : 1;

  const candleW = Math.max(3, (width - P * 2) / data.length * 0.7);
  const gapW = (width - P * 2) / data.length;

  const toY = (price: number) => P + (1 - (price - minP) / rangeP) * (chartH - P * 2);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }}>
        {/* Grid */}
        {[0.25, 0.5, 0.75].map(pct => (
          <line key={pct} x1={P} x2={width - P}
            y1={P + pct * (chartH - P * 2)} y2={P + pct * (chartH - P * 2)}
            stroke="var(--border, #1E3050)" strokeWidth="0.5" strokeDasharray="4,4" />
        ))}

        {data.map((d, i) => {
          const x = P + i * gapW + gapW / 2;
          const isUp = d.close >= d.open;
          const color = isUp ? 'var(--stock-up, #f85149)' : 'var(--stock-down, #58a6ff)';
          const bodyTop = toY(Math.max(d.open, d.close));
          const bodyBottom = toY(Math.min(d.open, d.close));
          const bodyH = Math.max(bodyBottom - bodyTop, 1);

          return (
            <g key={i}>
              {/* Wick (high-low line) */}
              <line x1={x} x2={x} y1={toY(d.high)} y2={toY(d.low)}
                stroke={color} strokeWidth="1" />
              {/* Body */}
              <rect x={x - candleW / 2} y={bodyTop}
                width={candleW} height={bodyH}
                fill={isUp ? color : color} fillOpacity={isUp ? 1 : 0.6}
                stroke={color} strokeWidth="0.5" rx="1" />
            </g>
          );
        })}

        {/* Volume bars */}
        {showVolume && data.map((d, i) => {
          const x = P + i * gapW + gapW / 2;
          const isUp = d.close >= d.open;
          const color = isUp ? 'var(--stock-up, #f85149)' : 'var(--stock-down, #58a6ff)';
          const volPct = (d.volume || 0) / maxVol;
          const barH = volPct * volH;
          return (
            <rect key={`v${i}`}
              x={x - candleW / 2} y={chartH + gap + volH - barH}
              width={candleW} height={barH}
              fill={color} fillOpacity="0.3" rx="1" />
          );
        })}

        {/* Price labels */}
        <text x={width - P} y={P + 4} textAnchor="end" fontSize="9" fill="var(--text-tertiary, #7D8DA3)">
          {maxP.toLocaleString()}
        </text>
        <text x={width - P} y={chartH - P + 4} textAnchor="end" fontSize="9" fill="var(--text-tertiary, #7D8DA3)">
          {minP.toLocaleString()}
        </text>

        {/* Date labels */}
        {data.filter((_, i) => i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)).map((d, _, arr) => {
          const idx = data.indexOf(d);
          const x = P + idx * gapW + gapW / 2;
          return (
            <text key={d.date} x={x} y={height - 2} textAnchor="middle" fontSize="8" fill="var(--text-tertiary, #7D8DA3)">
              {d.date.slice(5)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
