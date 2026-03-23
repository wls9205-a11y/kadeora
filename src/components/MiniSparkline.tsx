'use client';

export default function MiniSparkline({ data, color, width = 48, height = 20 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const isUp = data[data.length - 1] >= data[0];
  const strokeColor = color || (isUp ? 'var(--accent-green)' : 'var(--accent-red)');

  const points = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - 2 - ((v - min) / range) * (height - 4)}`
  ).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height, display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 마지막 점 강조 */}
      <circle
        cx={(data.length - 1) / (data.length - 1) * width}
        cy={height - 2 - ((data[data.length - 1] - min) / range) * (height - 4)}
        r="2"
        fill={strokeColor}
      />
    </svg>
  );
}
