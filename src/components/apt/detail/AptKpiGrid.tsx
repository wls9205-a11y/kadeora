interface Props {
  priceMin?: number | null;
  priceMax?: number | null;
  totalUnits?: number | null;
  moveInDate?: string | null;
  builderRating?: number | null;
}

function fmtPrice(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}억`;
  return `${n.toLocaleString()}만`;
}

function fmtMoveIn(d: string): string {
  const s = String(d);
  if (s.length >= 6 && /^\d+$/.test(s.slice(0, 6))) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}`;
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  }
  return s;
}

export default function AptKpiGrid({ priceMin, priceMax, totalUnits, moveInDate, builderRating }: Props) {
  const priceValue = (() => {
    if (priceMin && priceMax && priceMin !== priceMax) return `${fmtPrice(priceMin)}~${fmtPrice(priceMax)}`;
    if (priceMin || priceMax) return fmtPrice((priceMin || priceMax) as number);
    return null;
  })();

  const unitsValue = totalUnits ? `${totalUnits.toLocaleString()}` : null;
  const moveInValue = moveInDate ? fmtMoveIn(moveInDate) : null;
  const ratingValue = builderRating != null ? `★ ${Number(builderRating).toFixed(1)}` : null;

  const cells: { label: string; value: string | null }[] = [
    { label: '분양가', value: priceValue },
    { label: '세대수', value: unitsValue },
    { label: '입주', value: moveInValue },
    { label: '시공사 평점', value: ratingValue },
  ];

  const hasAny = cells.some(c => c.value);
  if (!hasAny) return null;

  return (
    <div className="apt-kpi-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '12px 0' }}>
      {cells.map((c, i) => (
        c.value ? (
          <div key={i} className="apt-kpi-card" style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 4 }}>{c.label}</div>
            <div className="apt-kpi-number" style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{c.value}</div>
          </div>
        ) : null
      ))}
    </div>
  );
}
