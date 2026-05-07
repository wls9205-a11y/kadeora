import Link from 'next/link';
import { aptSiteThumb } from '@/lib/thumbnail-fallback';

interface Props {
  sites: any[];
}

function fmtChange(v: any): { label: string; color: string } | null {
  if (v == null) return null;
  const n = Number(v);
  if (!isFinite(n) || n === 0) return null;
  if (n > 0) return { label: `▲ ${n.toFixed(0)}%`, color: 'var(--accent-red, #DC2626)' };
  return { label: `▼ ${Math.abs(n).toFixed(0)}%`, color: 'var(--accent-blue, #3B82F6)' };
}

export default function AptRealtimeRanking({ sites }: Props) {
  if (!sites || sites.length === 0) return null;
  const top = sites.slice(0, 5);

  return (
    <section
      aria-label="실시간 인기 TOP 5"
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
        🔥 실시간 인기 TOP 5
      </h2>

      <ol
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {top.map((s, i) => {
          const slug = s.slug || s.id || String(i);
          const name = s.name || s.site_name || slug;
          const thumb = aptSiteThumb({
            cover_image_url: s.cover_image_url,
            satellite_image_url: s.satellite_image_url,
            og_image_url: s.og_image_url,
            images: s.images,
            name,
          });
          const pop =
            typeof s.popularity_score === 'number'
              ? s.popularity_score
              : s.popularity_score
              ? Number(s.popularity_score)
              : null;
          const change = fmtChange(s.page_views_change ?? s.page_views_change_pct ?? s.change_pct);
          const dday = typeof s.days_until_apply === 'number' ? s.days_until_apply : null;
          const sub = [s.region, s.sigungu].filter(Boolean).join(' ');

          return (
            <li key={slug}>
              <Link
                href={`/apt/${encodeURIComponent(slug)}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    width: 22,
                    fontSize: 16,
                    fontWeight: 900,
                    color: i < 3 ? 'var(--brand, #FAC775)' : 'var(--text-tertiary)',
                    textAlign: 'center',
                    letterSpacing: -0.5,
                  }}
                >
                  {i + 1}
                </span>
                <img
                  src={thumb}
                  alt=""
                  width={44}
                  height={44}
                  loading="lazy"
                  decoding="async"
                  style={{
                    width: 44,
                    height: 44,
                    objectFit: 'cover',
                    borderRadius: 8,
                    flexShrink: 0,
                    background: 'var(--bg-hover)',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {name}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {sub}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {dday !== null && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: 999,
                        background: 'rgba(220,38,38,0.15)',
                        color: 'var(--accent-red, #DC2626)',
                      }}
                    >
                      D-{dday}
                    </span>
                  )}
                  {change && (
                    <span style={{ fontSize: 10, fontWeight: 800, color: change.color }}>
                      {change.label}
                    </span>
                  )}
                  {pop != null && pop > 0 && pop !== 100 && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: 'var(--brand, #FAC775)',
                      }}
                    >
                      ★ {pop}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
