// s262 Phase E — 50×20px SVG mini sparkline.
// up=true → red, down → blue, 평탄(<0.5%) → gray. NumericArray prop, 5 points 권장.

type Props = {
  data: number[] | null | undefined;
  width?: number;
  height?: number;
};

const FLAT_PCT = 0.5;

export default function SparklineMini({ data, width = 50, height = 20 }: Props) {
  if (!Array.isArray(data) || data.length < 2) {
    return <span style={{ display: 'inline-block', width, height }} aria-hidden />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const first = data[0];
  const last = data[data.length - 1];
  const pct = first === 0 ? 0 : ((last - first) / first) * 100;

  let color = '#6B7280';
  if (Math.abs(pct) >= FLAT_PCT) color = pct > 0 ? '#DC2626' : '#2563EB';

  // Y inverted (SVG origin is top-left)
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
