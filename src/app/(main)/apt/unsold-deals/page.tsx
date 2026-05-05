import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import HomeSiteCard, { type HomeSiteRow } from '@/components/apt/HomeSiteCard';
import Pagination from '@/components/apt/Pagination';
import Disclaimer from '@/components/Disclaimer';

export const dynamic = 'force-dynamic';
export const revalidate = 60;
export const maxDuration = 30;

const PER_PAGE = 24;

interface SP { page?: string; region?: string }

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const region = sp.region?.trim();
  const title = region ? `${region} 미분양 기회 — 카더라` : '미분양 기회 — 카더라';
  const desc = region
    ? `${region}의 미분양 단지 모음 — 분양가·할인·잔여세대 한눈에.`
    : '전국 미분양 아파트 — 가격대·잔여세대·시공사별 기회 분석. 카더라.';
  const canonical = region
    ? `${SITE_URL}/apt/unsold-deals?region=${encodeURIComponent(region)}`
    : `${SITE_URL}/apt/unsold-deals`;
  return {
    title, description: desc,
    alternates: { canonical },
    robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const },
    openGraph: { title, description: desc, url: canonical, siteName: '카더라', locale: 'ko_KR', type: 'website' },
  };
}

interface Row extends HomeSiteRow { total_count?: number | string }

export default async function AptUnsoldDealsPage({ searchParams }: { searchParams?: Promise<SP> }) {
  const sp = (await searchParams) || {};
  const page = Math.max(1, Number(sp.page) || 1);
  const region = sp.region?.trim() || null;
  const offset = (page - 1) * PER_PAGE;

  const sb = getSupabaseAdmin();
  const { data } = await (sb as any).rpc('get_apt_unsold_paginated', {
    p_limit: PER_PAGE, p_offset: offset, p_region: region,
  });
  const rows = ((data ?? []) as Row[]);
  const total = rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0;
  const totalPages = total > 0 ? Math.max(1, Math.ceil(total / PER_PAGE)) : 1;

  return (
    <>
      <header style={{ padding: '12px 4px 4px' }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>💸 미분양 기회</h1>
        <p style={{ fontSize: 12, color: 'var(--text-secondary, #888)', margin: '4px 0 0' }}>
          {region ? `${region} · ` : ''}{total.toLocaleString()}개 단지 · {page}/{totalPages} 페이지
        </p>
      </header>

      {rows.length === 0 ? (
        <section style={{ marginTop: 16, padding: 24, textAlign: 'center', color: 'var(--text-secondary, #888)', fontSize: 12, background: 'var(--bg-elevated, #1f2028)', border: '0.5px solid var(--border, #2a2b35)', borderRadius: 12 }}>
          표시할 단지가 없습니다.
        </section>
      ) : (
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          {rows.map((r) => <HomeSiteCard key={r.id} row={r} variant="unsold" />)}
        </div>
      )}

      <Pagination basePath="/apt/unsold-deals" page={page} totalPages={totalPages} query={{ region: region || undefined }} />

      <Disclaimer type="apt" />
    </>
  );
}
