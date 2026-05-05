import Link from 'next/link';
import { SITE_URL } from '@/lib/constants';

export interface LandmarkRow {
  id: number;
  name: string;
  region: string | null;
  district: string | null;
  address?: string | null;
  image_url: string | null;
  description: string | null;
  tags: string[] | null;
  built_year: number | null;
  total_units: number | null;
  blog_slug: string | null;
  avg_price_100m: string | null;
}

function ogFallback(name: string): string {
  return `${SITE_URL.replace(/\/$/, '')}/api/og-square?title=${encodeURIComponent(name)}&category=apt`;
}

export default function LandmarkCard({ row }: { row: LandmarkRow }) {
  const href = row.blog_slug
    ? `/blog/${encodeURIComponent(row.blog_slug)}`
    : `/apt/search?q=${encodeURIComponent(row.name)}`;
  const thumb = row.image_url && row.image_url.length > 10 ? row.image_url : ogFallback(row.name);
  const tags = (row.tags ?? []).slice(0, 3);
  const subtitle = [row.region, row.district].filter(Boolean).join(' ');

  return (
    <Link
      href={href}
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
      <div
        style={{
          aspectRatio: '4 / 3',
          background: `center/cover no-repeat url('${thumb}'), var(--bg-base, #0d0e14)`,
          position: 'relative',
        }}
      >
        <span
          style={{
            position: 'absolute', top: 5, left: 5, fontSize: 9, padding: '2px 6px',
            borderRadius: 4, fontWeight: 700,
            background: 'rgba(250,199,117,0.18)', color: '#FAC775',
          }}
        >
          🏆 랜드마크
        </span>
        {row.avg_price_100m && (
          <span
            style={{
              position: 'absolute', bottom: 5, right: 5, fontSize: 10, padding: '2px 6px',
              borderRadius: 4, fontWeight: 700,
              background: 'rgba(0,0,0,0.55)', color: '#fff',
            }}
          >
            {row.avg_price_100m}
          </span>
        )}
      </div>
      <div style={{ padding: '7px 9px 9px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary, #888)', marginTop: 2 }}>
          {subtitle}{row.built_year ? ` · ${row.built_year}년` : ''}
          {row.total_units ? ` · ${row.total_units.toLocaleString()}세대` : ''}
        </div>
        {row.description && (
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-tertiary, #666)',
              marginTop: 4,
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {row.description}
          </div>
        )}
        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 5 }}>
            {tags.map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 9,
                  padding: '1px 6px',
                  borderRadius: 999,
                  background: 'rgba(250,199,117,0.10)',
                  color: '#FAC775',
                  fontWeight: 600,
                }}
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
