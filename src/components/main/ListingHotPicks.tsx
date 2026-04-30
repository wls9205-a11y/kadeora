/**
 * ListingHotPicks — 분양중 핫픽 2-col grid (server).
 * MainListing[] props. status/price/region 표시 + 카드 Link.
 */
import Link from 'next/link';
import type { MainListing } from './types';

interface Props {
  items: MainListing[];
}

function fmtAmount(n: number | null): string {
  if (!n || n <= 0) return '-';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}억`;
  return `${n.toLocaleString()}만`;
}

function statusLabel(s: MainListing['status']): { label: string; bg: string; color: string } {
  if (s === 'unsold') return { label: '미분양', bg: 'rgba(249,115,22,0.18)', color: 'var(--accent-orange, #f97316)' };
  if (s === 'closed') return { label: '마감', bg: 'rgba(148,163,184,0.18)', color: 'var(--text-tertiary)' };
  return { label: '분양중', bg: 'rgba(34,197,94,0.18)', color: 'var(--accent-green, #22c55e)' };
}

export default function ListingHotPicks({ items }: Props) {
  return (
    <section style={{ padding: 16, background: 'var(--bg-base)' }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>분양중 핫픽</h2>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: 12, textAlign: 'center', border: '0.5px solid var(--border)', borderRadius: 8 }}>
          분양중 단지 없음
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {items.map((item) => {
            const st = statusLabel(item.status);
            return (
              <Link
                key={item.id}
                href={`/apt/${item.slug}`}
                style={{
                  display: 'block', textDecoration: 'none', color: 'inherit',
                  border: '0.5px solid var(--border)', borderRadius: 10, overflow: 'hidden',
                  background: 'var(--bg-surface)',
                }}
              >
                <div style={{ width: '100%', height: 100, background: 'var(--bg-hover, #1a1a1a)', overflow: 'hidden' }}>
                  {item.og_image_url && (
                    <img src={item.og_image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                  )}
                </div>
                <div style={{ padding: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>
                    {item.region || ''} {item.sigungu || ''}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                    <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600 }}>
                      {st.label}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {fmtAmount(item.price_min)}~{fmtAmount(item.price_max)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
