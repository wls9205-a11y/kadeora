// s220 메인 v5: 트래픽 우선순위 9섹션 + 3 OAuth 진입로 + 추적중 단지 (server component)
//
// 핵심 회귀 방지 룰 (s219 BAILOUT 회귀 재발 금지):
//   - server component (no 'use client', no useSearchParams)
//   - 단일 RPC await — 9섹션 데이터 한 번에 (N+1 금지)
//   - Suspense / dynamic({ssr:false}) 사용 금지 — 봇이 본문 SSR 직접 받아야 함
//   - loading.tsx 만들지 말 것 — (main) group 외부라 안전하지만 같은 함정 재발 방지
//   - revalidate=300 (5분 ISR) — 봇 cache hit 률 우선
//
// 구조:
//   /                              → busan 기본
//   /?region=seoul                 → 지역 chip 변경
//   /?region=busan&map_mode=trade  → 지도 모드
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { SITE_URL } from '@/lib/constants';

import MainLayout from '@/components/main/MainLayout';
import SubscriptionDdayRail from '@/components/main/SubscriptionDdayRail';
import TodayHeroCard from '@/components/main/TodayHeroCard';
import MarketSignalCard from '@/components/main/MarketSignalCard';
import MapView from '@/components/main/MapView';
import ListingHotPicks from '@/components/main/ListingHotPicks';
import TodayBriefList from '@/components/main/TodayBriefList';
import ActivityFeed from '@/components/main/ActivityFeed';
import ConstructionStockRail from '@/components/main/ConstructionStockRail';
import WatchlistSection from '@/components/main/WatchlistSection';

import {
  MAIN_REGION_LIST,
  MAIN_REGION_TO_KO,
  type MainRegion,
  type MainPageData,
  type WatchlistItem,
} from '@/components/main/types';

export const revalidate = 300;
// 주의: `force-static` 또는 `force-dynamic` 둘 다 X. cookies() 사용 + searchParams 둘 다 자동
// dynamic 마킹 — Next.js default 가 적절. revalidate=300 만으로 ISR 충분.

export const metadata: Metadata = {
  title: '카더라 — 아파트 청약·주식 시세·부동산 정보 플랫폼 | kadeora.app',
  description: '주식 시세, 아파트 청약, 미분양, 재개발, 실거래가 정보와 커뮤니티를 한 곳에서. 코스피 코스닥 실시간 시세, 전국 청약 일정, 부동산 분석을 매일 업데이트합니다.',
  alternates: { canonical: SITE_URL },
  // s218: og:image 1순위 og-square (api/og timeout 회피)
  openGraph: {
    title: '카더라 — 아는 사람만 아는 그 정보',
    description: '주식 시세, 아파트 청약, 미분양·재개발·실거래가, 커뮤니티 토론을 하나의 앱에서.',
    url: SITE_URL,
    siteName: '카더라',
    images: [
      { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent('카더라')}`, width: 630, height: 630, alt: '카더라' },
      { url: `${SITE_URL}/images/brand/kadeora-wide.png`, width: 1200, height: 630, alt: '카더라' },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: '카더라', description: '아는 사람만 아는 그 정보' },
  robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const, 'max-video-preview': -1 },
  other: {
    'naver:author': '카더라',
    'naver:written_time': new Date().toISOString(),
    'naver:updated_time': new Date().toISOString(),
    'og:updated_time': new Date().toISOString(),
  },
};

const EMPTY_DATA: MainPageData = {
  subscriptions: [],
  hot_listings: [],
  transactions: [],
  unsold: [],
  redev: [],
  big_event: null,
  market_signal: { avg_price_6m: [], weekly_volume: 0, weekly_volume_pct: 0, weekly_avg_price: 0, weekly_avg_price_pct: 0, nationwide_subs: 0, nationwide_subs_pct: 0 },
  construction_stocks: [],
  briefs: [],
};

function isMainRegion(s: string | undefined): s is MainRegion {
  return !!s && (MAIN_REGION_LIST as string[]).includes(s);
}

function isMapMode(s: string | undefined): s is 'subscription' | 'trade' | 'unsold' | 'redev' {
  return s === 'subscription' || s === 'trade' || s === 'unsold' || s === 'redev';
}

interface PageProps {
  searchParams: Promise<{ region?: string; map_mode?: string }>;
}

export default async function MainPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const activeRegion: MainRegion = isMainRegion(sp.region) ? sp.region : 'busan';
  const mapMode = isMapMode(sp.map_mode) ? sp.map_mode : 'subscription';
  const regionKo = MAIN_REGION_TO_KO[activeRegion]; // null = 전국

  // ───────── 단일 RPC 호출로 9섹션 + watchlist 동시 fetch ─────────
  // RPC 미배포 시 / env 누락 / DB 다운 시 빈 데이터로 graceful fallback — 페이지 안 깨짐.
  let data: MainPageData = EMPTY_DATA;
  let watchlist: WatchlistItem[] = [];
  let isLoggedIn = false;

  // env vars 누락도 try 안에서 잡음 — createServerClient 도 throw 가능.
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => { try { return cookieStore.getAll(); } catch { return []; } },
          setAll: () => { /* no-op for read-only */ },
        },
      }
    );

    const [mainRes, userRes] = await Promise.all([
      (supabase as any).rpc('get_main_page_data', { p_region: regionKo }),
      supabase.auth.getUser(),
    ]);

    if (!mainRes.error && mainRes.data) {
      data = { ...EMPTY_DATA, ...(mainRes.data as Partial<MainPageData>) };
    }

    if (userRes.data?.user) {
      isLoggedIn = true;
      const wRes = await (supabase as any).rpc('get_user_watchlist', { p_user_id: userRes.data.user.id });
      if (!wRes.error && Array.isArray(wRes.data)) {
        watchlist = wRes.data as WatchlistItem[];
      }
    }
  } catch (e) {
    // graceful: env 없음 / RPC 없음 / DB 다운 — EMPTY_DATA 로 페이지 렌더 진행 (skeleton 안 보임)
    console.error('[main v5] RPC fetch failed:', e);
  }

  // ───────── 지도뷰 mode 별 데이터 슬라이스 ─────────
  const mapItems =
    mapMode === 'subscription' ? data.hot_listings :
    mapMode === 'trade' ? data.transactions :
    mapMode === 'unsold' ? data.unsold :
    data.redev;

  return (
    <MainLayout activeRegion={activeRegion}>
      <SubscriptionDdayRail items={data.subscriptions} />
      <TodayHeroCard event={data.big_event} />
      <MarketSignalCard signal={data.market_signal} />
      <MapView items={mapItems as any} mode={mapMode} activeRegion={activeRegion} />
      <ListingHotPicks items={data.hot_listings} />
      <TodayBriefList items={data.briefs} />
      <ActivityFeed transactions={data.transactions} unsold={data.unsold} redev={data.redev} />
      <ConstructionStockRail items={data.construction_stocks} />
      <WatchlistSection items={watchlist} isLoggedIn={isLoggedIn} />

      {/* SEO 본문 fallback — RPC 비어도 봇이 핵심 키워드 받음 */}
      <section aria-label="카더라 소개" style={{ marginTop: 32, padding: 16, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
        <h1 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          카더라 — 부동산·주식 정보 플랫폼
        </h1>
        <p style={{ margin: 0 }}>
          전국 아파트 청약 일정, 분양중 단지, 미분양 현황, 재개발 진행, 실거래가, 코스피·코스닥 실시간 시세, AI 종목 분석을 한곳에서. {regionKo || '전국'} 지역 부동산 정보 무료 조회.
        </p>
      </section>
    </MainLayout>
  );
}
