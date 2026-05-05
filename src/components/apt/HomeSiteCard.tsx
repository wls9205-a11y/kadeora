import Link from 'next/link';
import { aptSiteThumb } from '@/lib/thumbnail-fallback';

export interface HomeSiteRow {
  id: string;
  slug: string;
  name: string;
  region: string | null;
  sigungu: string | null;
  dong?: string | null;
  cover_image_url: string | null;
  satellite_image_url: string | null;
  og_image_url: string | null;
  site_type: string | null;
  total_units: number | null;
  price_min?: number | null;
  price_max?: number | null;
  builder?: string | null;
  popularity_score?: number | string | null;
  page_views?: number | null;
  interest_count?: number | null;
}

interface Props {
  row: HomeSiteRow;
  variant?: 'popular' | 'unsold';
}

function priceLabel(row: HomeSiteRow): string | null {
  if (row.price_min && row.price_max) {
    const min = Math.round(row.price_min / 10000 * 10) / 10;
    const max = Math.round(row.price_max / 10000 * 10) / 10;
    return min === max ? `${min}억` : `${min}~${max}억`;
  }
  if (row.total_units) return `${row.total_units.toLocaleString()}세대`;
  return null;
}

function badgeFor(row: HomeSiteRow, variant: 'popular' | 'unsold'): { label: string; bg: string; fg: string } {
  if (variant === 'unsold') return { label: '💸 미분양', bg: 'rgba(239,68,68,0.18)', fg: '#ef4444' };
  if (row.site_type === 'redevelopment') return { label: '🔥 재개발', bg: 'rgba(250,199,117,0.18)', fg: '#FAC775' };
  if (row.site_type === 'subscription') return { label: '🔥 분양중', bg: 'rgba(59,130,246,0.18)', fg: '#3b82f6' };
  if (row.site_type === 'trade') return { label: '🔥 실거래', bg: 'rgba(34,197,94,0.18)', fg: '#22c55e' };
  return { label: '🔥 인기', bg: 'rgba(250,199,117,0.18)', fg: '#FAC775' };
}

export default function HomeSiteCard({ row, variant = 'popular' }: Props) {
  const thumb = aptSiteThumb({
    cover_image_url: row.cover_image_url,
    satellite_image_url: row.satellite_image_url,
    og_image_url: row.og_image_url,
    name: row.name,
  });
  const badge = badgeFor(row, variant);
  const price = priceLabel(row);

  return (
    <Link
      href={`/apt/${encodeURIComponent(row.slug)}`}
      style={{
        background: 'var(--bg-elevated, #1f2028)',
        border: '0.5px solid var(--border, #2a2b35)',
        borderRadius: 10,
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ aspectRatio: '4 / 3', background: `center/cover no-repeat url('${thumb}'), var(--bg-base, #0d0e14)`, position: 'relative' }}>
        <span
          style={{
            position: 'absolute', top: 5, left: 5, fontSize: 9, padding: '2px 6px',
            borderRadius: 4, fontWeight: 700, background: badge.bg, color: badge.fg,
          }}
        >
          {badge.label}
        </span>
        {variant === 'unsold' && price && (
          <span
            style={{
              position: 'absolute', bottom: 5, right: 5, fontSize: 11, padding: '2px 7px',
              borderRadius: 4, fontWeight: 800,
              background: 'rgba(239,68,68,0.92)', color: '#fff',
            }}
          >
            {price}
          </span>
        )}
      </div>
      <div style={{ padding: '7px 9px 9px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary, #888)', marginTop: 2 }}>
          {[row.region, row.sigungu].filter(Boolean).join(' ')}
        </div>
        {variant === 'popular' && (
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 3 }}>
            {price ?? (row.page_views ? `조회 ${row.page_views.toLocaleString()}` : '-')}
          </div>
        )}
        {variant === 'unsold' && row.builder && (
          <div style={{ fontSize: 10, color: 'var(--text-tertiary, #666)', marginTop: 3 }}>
            {row.builder}
          </div>
        )}
      </div>
    </Link>
  );
}
