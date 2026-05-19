// s269d V2: /apt 통합 피드. Hero (마감임박 청약 top 1) + 2-col grid.
// Architecture Rule #66: force-dynamic — SSG empty cache 영구화 회피.
// Legacy: src/_legacy/s269/apt_page_v0.tsx

import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/constants';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import RegionAutoSelect from '@/components/apt/RegionAutoSelect';
import AptHeroCard, { type HeroData } from '@/components/apt/AptHeroCard';
import AptRecentFeed, { type FeedStats } from '@/components/apt/AptRecentFeed';
import type { FeedItem } from '@/components/apt/AptFeedCard';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const regionLabel = sp.region ?? '전국';
  const baseTitle = sp.region
    ? `${regionLabel} 부동산 — 청약·미분양·재개발`
    : '아파트 청약·미분양·재개발';
  return {
    title: baseTitle,
    description: `${regionLabel} 청약·미분양·재개발 최근 등록 단지를 한 흐름으로. 마감임박 단지 우선 노출.`,
    alternates: {
      canonical: sp.region
        ? `${SITE_URL}/apt?region=${encodeURIComponent(sp.region)}`
        : `${SITE_URL}/apt`,
    },
    openGraph: {
      title: baseTitle, siteName: '카더라', locale: 'ko_KR', type: 'website',
      url: `${SITE_URL}/apt`,
    },
  };
}

async function fetchPageData(region: string): Promise<{
  hero: HeroData | null;
  items: FeedItem[];
  stats: FeedStats | null;
}> {
  const sb = getSupabaseAdmin();
  try {
    const [heroRes, feedRes, statsRes] = await Promise.all([
      (sb as any).rpc('get_apt_hero_pick', { p_region: region }),
      (sb as any).rpc('get_apt_recent_feed_v2', {
        p_region: region,
        p_category: 'all',
        p_limit: 20,
        p_cursor: null,
        p_cursor_id: null,
      }),
      (sb as any).rpc('get_apt_feed_stats', { p_region: region }),
    ]);
    if (heroRes?.error) console.error('[apt/hero] error:', JSON.stringify(heroRes.error));
    if (feedRes?.error) console.error('[apt/feed] error:', JSON.stringify(feedRes.error));
    if (statsRes?.error) console.error('[apt/stats] error:', JSON.stringify(statsRes.error));
    const hero = (heroRes?.data && typeof heroRes.data === 'object') ? (heroRes.data as HeroData) : null;
    const items = Array.isArray(feedRes?.data) ? (feedRes.data as FeedItem[]) : [];
    const stats = (statsRes?.data && typeof statsRes.data === 'object') ? (statsRes.data as FeedStats) : null;
    console.log('[apt/page] region=' + region + ' hero=' + (hero ? 'yes' : 'no') + ' items=' + items.length + ' stats=' + (stats ? 'yes' : 'no'));
    return { hero, items, stats };
  } catch (e: any) {
    console.error('[apt/page] caught:', e?.message ?? String(e));
    return { hero: null, items: [], stats: null };
  }
}

export default async function AptPage({
  searchParams,
}: {
  searchParams?: Promise<{ region?: string }>;
}) {
  const sp = (await searchParams) || {};
  const region = sp.region?.trim() || '전국';
  const isAutoRegion = !sp.region;
  const { hero, items, stats } = await fetchPageData(region);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '8px 6px 24px' }}>
      <h1 className="sr-only">{region} 아파트 — 청약 / 미분양 / 재개발</h1>

      {isAutoRegion && <RegionAutoSelect />}

      <div style={{
        position: 'sticky', top: 44, zIndex: 10,
        padding: '8px 6px', margin: '0 -6px 4px',
        background: 'var(--bg-surface-translucent, rgba(255,255,255,0.92))',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--border-base, #E5E7EB)',
        fontSize: 13,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 500 }}>📍 {region}</span>
        <Link href="/apt/region" style={{
          fontSize: 11.5, color: 'var(--text-secondary, #6B7280)', textDecoration: 'none',
        }}>지역 변경 →</Link>
      </div>

      {hero && (
        <div style={{ padding: '0 6px' }}>
          <AptHeroCard data={hero} />
        </div>
      )}

      <AptRecentFeed
        initialItems={items}
        region={region}
        stats={stats ?? undefined}
      />

      <section style={{ marginTop: 24, padding: '0 6px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 10px' }}>도구</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {[
            { href: '/apt/map',      label: '지도',      icon: '🗺️' },
            { href: '/apt/diagnose', label: '청약 진단', icon: '🏥' },
            { href: '/apt/compare',  label: '단지 비교', icon: '⚖️' },
            { href: '/apt/search',   label: '통합 검색', icon: '🔍' },
          ].map(t => (
            <Link key={t.href} href={t.href} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 14px',
              border: '0.5px solid var(--border-base, #E5E7EB)',
              borderRadius: 8,
              background: 'var(--bg-surface, #FFFFFF)',
              color: 'var(--text-primary, #111827)',
              textDecoration: 'none',
              fontSize: 13, fontWeight: 500,
            }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              {t.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
