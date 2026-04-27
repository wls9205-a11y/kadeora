import React from 'react';
import Link from 'next/link';

const BANDS: Array<{ slug: string; label: string; count: number }> = [
  { slug: 'under_3', label: '3억 미만',  count: 2014 },
  { slug: '3_6',     label: '3~6억',     count: 2133 },
  { slug: '6_10',    label: '6~10억',    count: 910 },
  { slug: '10_20',   label: '10~20억',   count: 589 },
  { slug: 'over_20', label: '20억+',     count: 128 },
];

interface Props {
  active?: string | null;
}

export default function PriceBandFilter({ active }: Props) {
  return (
    <section
      aria-label="가격대 필터"
      style={{ margin: '0 auto var(--kd-gap-lg)', maxWidth: 720, padding: '0 var(--sp-lg)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--kd-gap-sm)' }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: 0.5 }}>💰 가격대</span>
        {active && (
          <Link href="/apt" style={{ fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'none', fontWeight: 700 }}>전체 보기 ✕</Link>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }} className="price-band-pills">
        {BANDS.map(b => {
          const on = active === b.slug;
          return (
            <Link
              key={b.slug}
              href={on ? '/apt' : `/apt?price=${b.slug}`}
              style={{
                flex: '0 0 auto',
                padding: '8px 16px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
                background: on ? 'var(--kd-accent)' : 'var(--bg-surface)',
                color: on ? '#1A1A18' : 'var(--text-secondary)',
                border: `1px solid ${on ? 'var(--kd-accent)' : 'var(--border)'}`,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              {b.label} <span style={{ marginLeft: 4, fontSize: 10, opacity: on ? 0.85 : 1, color: on ? '#1A1A18' : 'var(--kd-accent)', fontWeight: 800 }}>{b.count.toLocaleString()}</span>
            </Link>
          );
        })}
      </div>
      <style>{`.price-band-pills::-webkit-scrollbar { display: none; }`}</style>
    </section>
  );
}
