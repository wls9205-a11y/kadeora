// s259: 미분양 목록 페이지 — v_apt_card_unsold view + AptCardCompact
// path: src/app/(main)/apt/unsold/page.tsx (kadeora convention)
// 의존: getSupabaseAdmin (@/lib/supabase-admin) — kadeora 표준
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import AptListSorter from '@/components/apt/AptListSorter';
import { applySort } from '@/lib/apt/card-sort';
import { AptCardGrid } from '@/components/apt/AptCardCompact';
import type { AptSortKey } from '@/lib/apt/card-types';
import type { Metadata } from 'next';
import Link from 'next/link';
import { REGIONS } from '@/lib/regions';
import { SITE_URL } from '@/lib/constants';

// s8: 메타데이터가 없어 루트 layout 기본값을 그대로 쓰고 있었다 — 제목·설명이
// 다른 페이지와 동일하게 나갔다. canonical 은 정렬·지역 쿼리를 제외한 기본 경로로 고정한다.
export const metadata: Metadata = {
  title: '전국 미분양 아파트 — 분양가·잔여세대',
  description: '전국 미분양·선착순 분양 아파트 목록. 분양가, 잔여 세대, 지역별 현황을 한 번에 확인하세요.',
  alternates: { canonical: `${SITE_URL}/apt/unsold` },
  openGraph: {
    title: '전국 미분양 아파트 — 분양가·잔여세대',
    description: '전국 미분양·선착순 분양 아파트 목록. 분양가, 잔여 세대, 지역별 현황.',
    url: `${SITE_URL}/apt/unsold`,
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent('전국 미분양 아파트')}&category=apt&design=2`, width: 1200, height: 630, alt: '전국 미분양 아파트' }],
  },
};

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export default async function UnsoldPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; region?: string }>;
}) {
  const sp = await searchParams;
  const sort = (sp.sort as AptSortKey) ?? 'newest';
  const supabase = getSupabaseAdmin();
  let query = (supabase as any).from('v_apt_card_unsold').select('*').limit(60);
  query = applySort(query, sort);
  if (sp.region) query = query.eq('region', sp.region);
  const { data: cards } = await query;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">미분양 ({cards?.length ?? 0})</h2>
        <AptListSorter category="unsold" defaultSort="newest" />
      </div>
      <AptCardGrid cards={(cards ?? []) as any} category="unsold" />

      {/* NV-2 — 시도별 진입은 «경로형» 하나로 통일한다(?region= 쿼리형과 섞지 않는다).
          ⚠️ 쿼리형 ?region= 은 뷰의 `region`(시군구·동) 축이라 시도명을 물리면 0건이 된다 —
             사람이 치는 「부산 미분양」의 착지점은 경로형 쪽이다. */}
      <nav aria-label="시도별 미분양">
        <h2 className="text-sm font-bold" style={{ margin: '4px 0 8px' }}>시도별 미분양 아파트</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 6 }}>
          {REGIONS.map((r) => (
            <Link
              key={r}
              href={`/apt/unsold/${encodeURIComponent(r)}`}
              style={{
                padding: '9px 10px', fontSize: 12, fontWeight: 600, textAlign: 'center', textDecoration: 'none',
                color: 'var(--text-secondary)', background: 'var(--bg-surface)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              }}
            >
              {r} 미분양
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
