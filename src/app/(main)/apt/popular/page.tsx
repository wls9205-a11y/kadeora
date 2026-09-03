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
  // G-3: layout 의 `%s | 카더라` 템플릿이 붙는다 — 여기서 브랜드를 또 붙이지 않는다.
  const title = region ? `${region} 인기 단지` : '지금 인기 단지';
  // 공유 카드(og)는 템플릿이 안 붙는 자리라 브랜드를 그대로 둔다 — 문안 불변.
  const shareTitle = `${title} | 카더라`;
  const desc = region
    ? `${region}에서 가장 많이 검색·관심받는 아파트 단지 목록.`
    : '카더라 사용자들이 지금 가장 많이 보는 아파트 단지 — 청약·재개발·실거래 통합 인기순.';
  const canonical = region
    ? `${SITE_URL}/apt/popular?region=${encodeURIComponent(region)}`
    : `${SITE_URL}/apt/popular`;
  return {
    title, description: desc,
    alternates: { canonical },
    // s8: PV 미달 죽은 라우트. robots.txt 로 막으면 이 noindex 를 못 읽어 URL 만 색인된다.
    robots: { index: false, follow: true },
    openGraph: { title: shareTitle, description: desc, url: canonical, siteName: '카더라', locale: 'ko_KR', type: 'website' },
  };
}

interface Row extends HomeSiteRow { total_count?: number | string }

export default async function AptPopularPage({ searchParams }: { searchParams?: Promise<SP> }) {
  const sp = (await searchParams) || {};
  const page = Math.max(1, Number(sp.page) || 1);
  const region = sp.region?.trim() || null;
  const offset = (page - 1) * PER_PAGE;

  const sb = getSupabaseAdmin();
  const { data } = await (sb as any).rpc('get_apt_popular_paginated', {
    p_limit: PER_PAGE, p_offset: offset, p_region: region,
  });
  const rows = ((data ?? []) as Row[]);
  const total = rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0;
  const totalPages = total > 0 ? Math.max(1, Math.ceil(total / PER_PAGE)) : 1;

  return (
    <>
      <header style={{ padding: '12px 4px 4px' }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>🔥 지금 인기 단지</h1>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          {region ? `${region} · ` : ''}{total.toLocaleString()}개 단지 · {page}/{totalPages} 페이지
        </p>
      </header>

      {rows.length === 0 ? (
        <section style={{ marginTop: 16, padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12 }}>
          표시할 단지가 없습니다.
        </section>
      ) : (
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          {rows.map((r) => <HomeSiteCard key={r.id} row={r} variant="popular" />)}
        </div>
      )}

      <Pagination basePath="/apt/popular" page={page} totalPages={totalPages} query={{ region: region || undefined }} />

      <Disclaimer type="apt" />
    </>
  );
}
