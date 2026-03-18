'use client';

export function AdminLineChart({ data, label, color = 'var(--brand)' }: {
  data: { date: string; count: number }[];
  label: string;
  color?: string;
}) {
  if (!data.length) return <div style={{ color: 'var(--text-tertiary)', fontSize: 12, padding: 20 }}>데이터 없음</div>;
  const max = Math.max(...data.map(d => d.count), 1);
  const W = 560, H = 140, PL = 36, PR = 12, PT = 12, PB = 32;
  const iW = W - PL - PR, iH = H - PT - PB;
  const pts = data.map((d, i) => ({
    x: PL + (i / (data.length - 1 || 1)) * iW,
    y: PT + iH - (d.count / max) * iH,
    ...d,
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L${pts[pts.length - 1].x},${PT + iH} L${pts[0].x},${PT + iH} Z`;
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {[0, Math.round(max / 2), max].map(v => {
          const y = PT + iH - (v / max) * iH;
          return <g key={v}><line x1={PL} y1={y} x2={W - PR} y2={y} stroke="var(--border)" strokeWidth={0.5} strokeDasharray="4 4" /><text x={PL - 4} y={y + 4} textAnchor="end" fontSize={9} fill="var(--text-tertiary)">{v}</text></g>;
        })}
        <path d={areaD} fill={color} opacity={0.08} />
        <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />)}
        {pts.filter((_, i) => i % Math.ceil(pts.length / 7) === 0 || i === pts.length - 1).map((p, i) => (
          <text key={i} x={p.x} y={H - 4} textAnchor="middle" fontSize={9} fill="var(--text-tertiary)">{p.date.slice(5)}</text>
        ))}
      </svg>
    </div>
  );
}

export function AdminDonutChart({ data, label }: {
  data: { key: string; label: string; count: number; color: string }[];
  label: string;
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (!total) return null;
  const cx = 70, cy = 70, r = 50, innerR = 30;
  let startAngle = -Math.PI / 2;
  const slices = data.map(d => {
    const angle = (d.count / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(startAngle), iy1 = cy + innerR * Math.sin(startAngle);
    const ix2 = cx + innerR * Math.cos(endAngle), iy2 = cy + innerR * Math.sin(endAngle);
    const large = angle > Math.PI ? 1 : 0;
    const pathD = `M${ix1.toFixed(1)},${iy1.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${large} 1 ${x2.toFixed(1)},${y2.toFixed(1)} L${ix2.toFixed(1)},${iy2.toFixed(1)} A${innerR},${innerR} 0 ${large} 0 ${ix1.toFixed(1)},${iy1.toFixed(1)} Z`;
    startAngle = endAngle;
    return { ...d, pathD };
  });
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg width={140} height={140} viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
          {slices.map(s => <path key={s.key} d={s.pathD} fill={s.color} />)}
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize={10} fill="var(--text-tertiary)">전체</text>
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize={16} fontWeight={700} fill="var(--text-primary)">{total.toLocaleString()}</text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {slices.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, marginLeft: 'auto' }}>{s.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
