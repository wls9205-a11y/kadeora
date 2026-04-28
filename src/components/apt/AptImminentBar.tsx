// 서버 — D-7 임박 단지 최대 3개. 카운트다운 chip 색상은 D 일에 따라.
import Link from 'next/link';
import type { ImminentRow } from '@/lib/apt-fetcher';

interface Props {
  sites: ImminentRow[];
}

function ddayColor(d: number): { fg: string; bg: string } {
  if (d <= 3) return { fg: '#fff', bg: 'var(--accent-red, #DC2626)' };
  if (d <= 5) return { fg: '#fff', bg: 'var(--accent-orange, #EA580C)' };
  return { fg: '#fff', bg: 'var(--accent-green, #059669)' };
}

function fmtKstDate(s: string | null): string {
  if (!s) return '';
  return s.length >= 8 ? `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}` : s.slice(0, 10);
}

export default function AptImminentBar({ sites }: Props) {
  if (!sites || sites.length === 0) return null;
  return (
    <section
      aria-label="청약 임박 D-7"
      style={{ maxWidth: 720, margin: '12px auto', padding: '0 var(--sp-lg)' }}
    >
      <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
        ⏰ 청약 임박 D-7 <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>· {sites.length}곳</span>
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 8,
        }}
      >
        {sites.map((s) => {
          const c = ddayColor(s.days_until_apply);
          return (
            <Link
              key={s.slug}
              href={`/apt/${encodeURIComponent(s.slug)}`}
              style={{
                display: 'flex', flexDirection: 'column', gap: 6,
                padding: '12px 14px',
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 12,
                textDecoration: 'none', color: 'inherit',
                transition: 'transform 100ms ease, box-shadow 100ms ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: '4px 10px', borderRadius: 999,
                  fontSize: 12, fontWeight: 800,
                  background: c.bg, color: c.fg,
                }}>
                  D-{s.days_until_apply}
                </span>
                {s.popularity_score && s.popularity_score !== 100 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand)' }}>★ {s.popularity_score}</span>
                )}
              </div>
              <div style={{
                fontSize: 14, fontWeight: 800, color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                lineHeight: 1.3,
              }}>
                {s.site_name || s.slug}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[s.region, s.sigungu].filter(Boolean).join(' ')}
                </span>
                {s.rcept_endde && <span style={{ flexShrink: 0 }}>마감 {fmtKstDate(s.rcept_endde)}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
