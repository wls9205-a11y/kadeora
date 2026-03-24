'use client';

interface DataPoint { label: string; value: number; }

interface Props {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  secondaryData?: DataPoint[];
  secondaryColor?: string;
  showDots?: boolean;
  showLabels?: boolean;
  showValues?: boolean;
  title?: string;
}

export default function MiniLineChart({
  data, width = 300, height = 120, color = 'var(--accent-blue)',
  secondaryData, secondaryColor = 'var(--accent-red)',
  showDots = true, showLabels = true, showValues = false, title,
}: Props) {
  if (!data || data.length < 2) return null;

  const allValues = [...data.map(d => d.value), ...(secondaryData || []).map(d => d.value)];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const P = 8;
  const W = width;
  const H = height;
  const chartH = H - (showLabels ? 20 : 0);

  const toPoints = (arr: DataPoint[]) =>
    arr.map((d, i) => ({
      x: P + (i / (arr.length - 1)) * (W - P * 2),
      y: chartH - P - ((d.value - min) / range) * (chartH - P * 2),
    }));

  const points = toPoints(data);
  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
  const areaPath = `M${points[0].x},${chartH - P} L${polyline} L${points[points.length - 1].x},${chartH - P} Z`;

  let secondaryPolyline = '';
  let secondaryPoints: { x: number; y: number }[] = [];
  if (secondaryData && secondaryData.length >= 2) {
    secondaryPoints = toPoints(secondaryData);
    secondaryPolyline = secondaryPoints.map(p => `${p.x},${p.y}`).join(' ');
  }

  return (
    <div>
      {title && <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>{title}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(pct => (
          <line key={pct} x1={P} x2={W - P} y1={chartH - P - pct * (chartH - P * 2)} y2={chartH - P - pct * (chartH - P * 2)}
            stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="4,4" />
        ))}
        {/* Primary area fill */}
        <path d={areaPath} fill={color} fillOpacity="0.08" />
        {/* Primary line */}
        <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Secondary line */}
        {secondaryPolyline && (
          <polyline points={secondaryPolyline} fill="none" stroke={secondaryColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4,4" />
        )}
        {/* Dots */}
        {showDots && points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
        ))}
        {showDots && secondaryPoints.map((p, i) => (
          <circle key={`s${i}`} cx={p.x} cy={p.y} r="3" fill={secondaryColor} />
        ))}
        {/* Values */}
        {showValues && points.map((p, i) => (
          <text key={i} x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill="#7D8DA3">
            {data[i].value.toLocaleString()}
          </text>
        ))}
        {/* X Labels */}
        {showLabels && data.map((d, i) => {
          if (data.length > 8 && i % 2 !== 0 && i !== data.length - 1) return null;
          return (
            <text key={i} x={points[i].x} y={H - 2} textAnchor="middle" fontSize="9" fill="#94A8C4">
              {d.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
