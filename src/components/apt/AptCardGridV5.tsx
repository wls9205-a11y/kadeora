import Link from 'next/link';
import { fetchSiteList, type AptFilters, type AptSiteRow } from '@/lib/apt-fetcher';
import { aptSiteThumb } from '@/lib/thumbnail-fallback';

interface Props { filters: AptFilters; moreHref?: string; perPage?: number }

function badgeFor(row: AptSiteRow): { label: string; bg: string; fg: string } | null {
  if (row.site_type === 'unsold') return { label: '미분양', bg: 'rgba(239,68,68,0.15)', fg: '#ef4444' };
  if (row.site_type === 'redevelopment') return { label: '재개발', bg: 'rgba(255,255,255,0.08)', fg: '#888' };
  if (row.site_type === 'trade') return { label: '실거래', bg: 'rgba(34,197,94,0.15)', fg: '#22c55e' };
  if (row.site_type === 'subscription') return { label: '분양중', bg: 'rgba(59,130,246,0.15)', fg: '#3b82f6' };
  return null;
}

function priceLabel(row: AptSiteRow): string {
  if (row.price_min && row.price_max) {
    const min = Math.round(row.price_min / 10000 * 10) / 10;
    const max = Math.round(row.price_max / 10000 * 10) / 10;
    return min === max ? `${min}억` : `${min}~${max}억`;
  }
  if (row.total_units) return `${row.total_units.toLocaleString()}세대`;
  if (row.move_in_date) return `입주 ${row.move_in_date.slice(0, 7)}`;
  return '-';
}

function thumbUrl(row: AptSiteRow): string {
  return aptSiteThumb(row);
}

export default async function AptCardGridV5({ filters, moreHref, perPage = 12 }: Props) {
  const rows = await fetchSiteList(filters, perPage);
  const labelMap: Record<string, string> = { all: '추천 단지', ongoing: '분양중', imminent_d7: '청약 임박', unsold: '미분양', redev: '재개발', trade: '실거래' };
  const label = labelMap[filters.category ?? 'all'] ?? '단지 목록';
  const expectedTotal = perPage * Math.max(1, filters.page ?? 1);
  const saturated = rows.length >= expectedTotal;

  if (rows.length === 0) {
    return (
      <section aria-label="단지 목록" style={{ marginTop: 8, padding: 24, textAlign: 'center', color: 'var(--text-secondary, #888)', fontSize: 12, background: 'var(--bg-elevated, #1f2028)', border: '0.5px solid var(--border, #2a2b35)', borderRadius: 12 }}>
        해당 지역·카테고리에 단지가 없습니다.
      </section>
    );
  }

  return (
    <section aria-label="단지 목록" style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary, #888)', fontWeight: 700 }}>{label} · {rows.length}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
        {rows.map((r) => {
          const badge = badgeFor(r);
          const thumb = thumbUrl(r);
          return (
            <Link key={r.slug} href={`/apt/${encodeURIComponent(r.slug)}`} style={{ background: 'var(--bg-elevated, #1f2028)', border: '0.5px solid var(--border, #2a2b35)', borderRadius: 10, overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}>
              <div style={{ aspectRatio: '4 / 3', background: `center/cover no-repeat url('${thumb}'), var(--bg-base, #0d0e14)`, position: 'relative' }}>
                {badge && <span style={{ position: 'absolute', top: 5, left: 5, fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 700, background: badge.bg, color: badge.fg }}>{badge.label}</span>}
              </div>
              <div style={{ padding: '7px 9px 9px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary, #888)', marginTop: 2 }}>{[r.region, r.sigungu].filter(Boolean).join(' ')}</div>
                <div style={{ fontSize: 11, fontWeight: 700, marginTop: 3 }}>{priceLabel(r)}</div>
              </div>
            </Link>
          );
        })}
      </div>
      {moreHref && saturated && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
          <Link
            href={moreHref}
            style={{
              padding: '9px 18px',
              borderRadius: 999,
              border: '0.5px solid var(--border-strong, #3a3b45)',
              background: 'var(--bg-elevated, #1f2028)',
              color: 'var(--text-primary, #fff)',
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            더보기 →
          </Link>
        </div>
      )}
    </section>
  );
}
