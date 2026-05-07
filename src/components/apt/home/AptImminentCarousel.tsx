import Link from 'next/link';
import { aptSiteThumb } from '@/lib/thumbnail-fallback';

interface Props {
  sites: any[];
}

function ddayBg(d: number): string {
  if (d <= 3) return 'var(--accent-red, #DC2626)';
  if (d <= 5) return 'var(--accent-orange, #EA580C)';
  return 'var(--accent-green, #059669)';
}

export default function AptImminentCarousel({ sites }: Props) {
  if (!sites || sites.length === 0) return null;

  return (
    <section
      className="apt-home-imminent"
      aria-label="청약 임박 D-7"
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
        ⏰ 청약 임박 D-7
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginLeft: 6 }}>
          · {sites.length}곳
        </span>
      </h2>

      <div
        className="apt-imminent-carousel"
        style={{
          display: 'flex',
          gap: 10,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 4,
        }}
      >
        {sites.map((s, i) => {
          const slug = s.slug || s.id || String(i);
          const name = s.site_name || s.name || slug;
          const dday = typeof s.days_until_apply === 'number' ? s.days_until_apply : null;
          const thumb = aptSiteThumb({
            cover_image_url: s.cover_image_url,
            satellite_image_url: s.satellite_image_url,
            og_image_url: s.og_image_url,
            images: s.images,
            name,
          });
          const sub = [s.region, s.sigungu].filter(Boolean).join(' ');

          return (
            <Link
              key={slug}
              href={`/apt/${encodeURIComponent(slug)}`}
              className="apt-imminent-card"
              style={{
                flex: '0 0 140px',
                scrollSnapAlign: 'start',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                overflow: 'hidden',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  aspectRatio: '1 / 1',
                  background: `center/cover no-repeat url('${thumb}'), var(--bg-hover)`,
                }}
              >
                {dday !== null && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 6,
                      left: 6,
                      padding: '3px 8px',
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 800,
                      background: ddayBg(dday),
                      color: '#fff',
                    }}
                  >
                    D-{dday}
                  </span>
                )}
              </div>
              <div style={{ padding: '8px 9px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {name}
                </span>
                {sub && (
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
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
