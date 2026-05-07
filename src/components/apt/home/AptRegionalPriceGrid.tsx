import Link from 'next/link';

interface Props {
  region: string;
  sigunguTrends: any[];
}

interface AggRow {
  sigungu: string;
  avg_price: number | null;
  change_pct: number | null;
  total_deals: number;
}

function aggregate(trends: any[]): AggRow[] {
  if (!Array.isArray(trends) || trends.length === 0) return [];
  // 시군구별로 그룹화 — 가장 최근 deal_month 가 last, 그 직전이 prev.
  const byKey = new Map<string, any[]>();
  for (const r of trends) {
    const key = r.sigungu || '';
    if (!key) continue;
    const arr = byKey.get(key) || [];
    arr.push(r);
    byKey.set(key, arr);
  }
  const out: AggRow[] = [];
  for (const [sigungu, rows] of byKey.entries()) {
    const sorted = rows.slice().sort((a, b) => String(a.deal_month).localeCompare(String(b.deal_month)));
    const last = sorted[sorted.length - 1];
    const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
    const lastP = last?.avg_price ? Number(last.avg_price) : null;
    const prevP = prev?.avg_price ? Number(prev.avg_price) : null;
    let change_pct: number | null = null;
    if (lastP && prevP && prevP > 0) {
      change_pct = ((lastP - prevP) / prevP) * 100;
    }
    const total_deals = sorted.reduce(
      (acc, r) => acc + (typeof r.total_deals === 'number' ? r.total_deals : 0),
      0,
    );
    out.push({ sigungu, avg_price: lastP, change_pct, total_deals });
  }
  return out.sort((a, b) => b.total_deals - a.total_deals).slice(0, 4);
}

function fmtPrice(p: number | null): string {
  if (!p || !isFinite(p)) return '-';
  // p 는 만원 단위.
  if (p >= 10000) return `${(p / 10000).toFixed(1)}억`;
  return `${Math.round(p).toLocaleString()}만`;
}

function fmtChange(v: number | null): { label: string; color: string } | null {
  if (v == null || !isFinite(v) || Math.abs(v) < 0.05) return null;
  if (v > 0) return { label: `▲ ${v.toFixed(1)}%`, color: 'var(--accent-red, #DC2626)' };
  return { label: `▼ ${Math.abs(v).toFixed(1)}%`, color: 'var(--accent-blue, #3B82F6)' };
}

export default function AptRegionalPriceGrid({ region, sigunguTrends }: Props) {
  const rows = aggregate(sigunguTrends);
  if (rows.length === 0) return null;

  return (
    <section
      aria-label={`${region} 시군구 시세`}
      style={{ maxWidth: 720, margin: '16px auto', padding: '0 var(--sp-lg)' }}
    >
      <h2
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: 'var(--text-primary)',
          margin: '0 0 8px',
          padding: '0 4px',
        }}
      >
        💹 {region} 시군구 시세
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 8,
        }}
      >
        {rows.map((r) => {
          const ch = fmtChange(r.change_pct);
          const href = `/apt?region=${encodeURIComponent(region)}&sigungu=${encodeURIComponent(r.sigungu)}`;
          return (
            <Link
              key={r.sigungu}
              href={href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: '12px 14px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text-tertiary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.sigungu}
              </span>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  color: 'var(--text-primary)',
                  letterSpacing: -0.5,
                }}
              >
                {fmtPrice(r.avg_price)}
              </span>
              {ch && (
                <span style={{ fontSize: 11, fontWeight: 800, color: ch.color }}>
                  {ch.label}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
