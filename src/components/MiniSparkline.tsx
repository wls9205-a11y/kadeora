'use client';

export default function MiniSparkline({
  data, color, width = 48, height = 20, fill = true,
}: {
  data: number[]; color?: string; width?: number; height?: number; fill?: boolean;
}) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const isUp = data[data.length - 1] >= data[0];
  const strokeColor = color || (isUp ? 'var(--accent-green)' : 'var(--accent-red)');

  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    height - 2 - ((v - min) / range) * (height - 4),
  ]);
  const pointsStr = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const fillPath = fill
    ? `M${pts[0][0]},${height} ` + pts.map(([x, y]) => `L${x},${y}`).join(' ') + ` L${pts[pts.length-1][0]},${height} Z`
    : '';

  const lastX = pts[pts.length - 1][0];
  const lastY = pts[pts.length - 1][1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height, display: 'block', overflow: 'visible' }}>
      {fill && (
        <path d={fillPath} fill={strokeColor} opacity={0.12} />
      )}
      <polyline
        points={pointsStr}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="2" fill={strokeColor} />
    </svg>
  );
}
