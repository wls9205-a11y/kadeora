import React from 'react';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

interface Props {
  slug: string;
  currentSite: {
    name: string;
    total_units?: number | null;
    price_min?: number | null;
    price_max?: number | null;
    lifecycle_stage?: string | null;
    popularity_score?: number | null;
  };
}

interface NearbyRow {
  source_slug: string;
  nearby_slug: string;
  nearby_name: string;
  nearby_type?: string | null;
  nearby_lifecycle?: string | null;
  nearby_popularity?: number | null;
  nearby_dong?: string | null;
  rn?: number | null;
}

interface FullSite {
  slug: string;
  name: string;
  total_units?: number | null;
  price_min?: number | null;
  price_max?: number | null;
  lifecycle_stage?: string | null;
  popularity_score?: number | null;
}

const LIFECYCLE_GRADE: Record<string, string> = {
  pre_announcement: 'A-',
  model_house_open: 'A',
  subscription_open: 'A+',
  special_supply: 'A+',
  contract: 'A',
  construction: 'B+',
  pre_move_in: 'B',
  move_in: 'A-',
  resale: 'B+',
  site_planning: 'C',
};

function fmtAmount(n?: number | null): string {
  if (!n) return '—';
  return n >= 10000 ? `${(n / 10000).toFixed(1)}억` : `${n.toLocaleString()}만`;
}

function fmtPriceRange(min?: number | null, max?: number | null): string {
  if (!min && !max) return '—';
  if (min && max && min !== max) return `${fmtAmount(min)}~${fmtAmount(max)}`;
  return fmtAmount(max ?? min);
}

export default async function AptCompareTable({ slug, currentSite }: Props) {
  const sb = getSupabaseAdmin();
  // s227: v_apt_nearby_sites view 750ms → get_apt_nearby_sites RPC 3ms.
  const { data: nearbyData } = await (sb as any).rpc('get_apt_nearby_sites', {
    p_source_slug: slug, p_limit: 4,
  });

  const nearbyRows = ((nearbyData ?? []) as NearbyRow[]).filter(r => r.nearby_slug);
  if (nearbyRows.length === 0) return null;

  const nearbySlugs = nearbyRows.map(r => r.nearby_slug);
  let nearbyDetails: FullSite[] = [];
  if (nearbySlugs.length > 0) {
    const { data: detailData } = await (sb as any).from('apt_sites')
      .select('slug,name,total_units,price_min,price_max,lifecycle_stage,popularity_score')
      .in('slug', nearbySlugs);
    nearbyDetails = ((detailData ?? []) as FullSite[]);
  }
  const detailBySlug = new Map<string, FullSite>(nearbyDetails.map(d => [d.slug, d]));

  const rows = [
    { ...currentSite, slug, isCurrent: true },
    ...nearbyRows.map(n => {
      const d = detailBySlug.get(n.nearby_slug);
      return {
        slug: n.nearby_slug,
        name: n.nearby_name || d?.name || n.nearby_slug,
        total_units: d?.total_units ?? null,
        price_min: d?.price_min ?? null,
        price_max: d?.price_max ?? null,
        lifecycle_stage: d?.lifecycle_stage ?? n.nearby_lifecycle ?? null,
        popularity_score: d?.popularity_score ?? n.nearby_popularity ?? null,
        isCurrent: false,
      };
    }),
  ];

  return (
    <section
      aria-label="인근 단지 비교"
      className="apt-compare-table"
      style={{ margin: '0 0 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}
    >
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: 0.5 }}>인근 단지 비교</span>
        <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 600 }}>총 {rows.length}곳</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--bg-hover)' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 800, color: 'var(--text-tertiary)', fontSize: 10 }}>단지</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 800, color: 'var(--text-tertiary)', fontSize: 10 }}>분양가</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 800, color: 'var(--text-tertiary)', fontSize: 10 }}>세대</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 800, color: 'var(--text-tertiary)', fontSize: 10 }}>등급</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const grade = r.lifecycle_stage ? LIFECYCLE_GRADE[r.lifecycle_stage] || 'B' : 'B';
            const bg = r.isCurrent ? 'var(--kd-accent-soft)' : 'transparent';
            const cell: React.CSSProperties = { padding: '10px 12px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' };
            return (
              <tr key={r.slug + i} style={{ background: bg }}>
                <td style={{ ...cell, fontWeight: r.isCurrent ? 800 : 600, color: 'var(--text-primary)' }}>
                  {r.isCurrent ? (
                    <span>{r.name} <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--kd-accent)', marginLeft: 4 }}>★ 현재</span></span>
                  ) : (
                    <Link href={`/apt/${encodeURIComponent(r.slug)}`} style={{ textDecoration: 'none', color: 'var(--text-primary)' }}>
                      {r.name}
                    </Link>
                  )}
                </td>
                <td style={{ ...cell, textAlign: 'right', color: 'var(--text-secondary)' }}>{fmtPriceRange(r.price_min, r.price_max)}</td>
                <td style={{ ...cell, textAlign: 'right', color: 'var(--text-secondary)' }}>{r.total_units ? `${r.total_units.toLocaleString()}` : '—'}</td>
                <td style={{ ...cell, textAlign: 'right', color: 'var(--text-primary)', fontWeight: 800 }}>{grade}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <style>{`
        @media (max-width: 768px) {
          .apt-compare-table { display: none !important; }
        }
      `}</style>
    </section>
  );
}
