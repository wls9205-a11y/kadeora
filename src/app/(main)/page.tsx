// 홈 — H4-1 검색 퍼스트.
//
// 블록 순서
//   1 헤더            (main)/layout 의 Navigation
//   2 히어로           H1 2줄 + 검색바(hero) + «칩 줄» + 현장 수   ← 여기까지가 첫 화면
//   3 이번 주 실거래     WeeklyTrades — 홈에서 매일 바뀌는 유일한 블록 (H4-2)
//   4 최근 본 현장      localStorage 칩 3 — 없으면 미렌더
//   5 지금 계약 가능     미분양·선착순 (실사 1건 승격)
//   6 최근 움직인 현장   단계 변경·신규 등록 4건
//   7 재개발·재건축      정비사업 3줄
//   8 지역별 보기        시도 + 주요 구군, 건수 배지
//   9 빠른 이동
//
// ⚠️ **「많이 보는 현장」 섹션을 걷어냈다 (H4-1 e).** 정렬 근거가 `apt_sites.page_views` 인데
//    그 컬럼은 실제 조회수가 아니다 — 컬럼 총합 200,655 대 `page_views` 테이블의
//    3개월 apt 경로 1,941 (100배 괴리). 부울경 PV 상위 12곳의 실조회가 전부 0이고
//    PV 9위가 `2020.2.7. LH 국민임대 예비입주자 모집공고` 였다.
//    `lib/home/sections.ts` 의 popular 계산과 `SiteRows` 는 «지우지 않았다» — 홈에서 쓰지만 않는다.
//    되살리려면 정렬 근거부터 만들어야 한다 (H4-3 계측 → 4주 뒤 승격 판정).
//
// ⚠️ **순위를 주장하는 라벨을 이 화면에 쓰지 않는다** (popular / hot / 많이 찾는 …).
//    부울경에서 30일간 사람이 3회 이상 본 현장이 «0곳» 이다(235곳에 858건 흩어짐).
//    순위를 만들 신호 자체가 없다. 없는 순위를 있는 척하면 H3-3 에서 trending_keywords 를
//    끊어낸 이유가 그대로 재발한다. 계측부터 붙이고(H4-3) 데이터가 쌓인 뒤 라벨만 승격한다.
//    ⚠️ 이 주석에 그 낱말을 «적지 않는 것도 의도»다 — 검증이 `grep` 한 줄이라
//       주석에 걸리면 검증이 무의미해진다.
//
// ⚠️ 홈 리드폼은 걷어냈다. LeadForm 의 variant='home' 코드와 관심 지역 셀렉트는
//    그대로 남아 있다 — 되살릴 때 <LeadForm variant="home" regionChoices={HOME_REGIONS} /> 한 줄이면 된다.
//    /apt/[id] 상세의 리드폼은 그대로다.
//
// ⚠️ 이슈 종목(국내·해외) · 이슈 단지 · 블로그 · 라운지(피드) 섹션을 걷어냈다.
//    **컴포넌트 파일은 지우지 않았다** — StockListRow · HomeAptRow · HomeBlogRow 는
//    /stock · /apt · /blog 에서 계속 쓴다. 여기서는 import 만 뺀다.
//
// ⚠️ 홈의 모든 현장 쿼리에 지역 필터가 걸려 있어야 한다 (C-5).
//    필터가 없어 경기 현장(오남역 서희스타힐스 여의재)이 홈 상단에 뜬 전례가 있다.
//    카더라 커버리지는 부울경이고 리드도 부울경에서만 받는다 — 경기 현장을 걸어 두면
//    클릭은 나가는데 응대할 수 없다.
import type { Metadata } from 'next';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL as SITE } from '@/lib/constants';
import SectionHeader from '@/components/apt/SectionHeader';
import UniversalSearchBar from '@/components/search/UniversalSearchBar';
import RecentlyViewed from '@/components/home/RecentlyViewed';
import SiteRows, { MoreLink } from '@/components/home/SiteRows';
import { fetchHomeSections, MIN_ROWS } from '@/lib/home/sections';
import { fetchAll } from '@/lib/db/fetchBatched';
import { buildHomeChips, CHIP_LIMIT } from '@/lib/home/chips';
import DealHeroCard, { pickDealHero } from '@/components/home/DealHeroCard';
import WeeklyTrades from '@/components/home/WeeklyTrades';
import { fetchWeeklyTrades } from '@/lib/home/weekly-trades';
import RecentMoves, { type RecentMove } from '@/components/home/RecentMoves';
import HeroSearch, { type HeroStat } from '@/components/home/HeroSearch';
import { cookies } from 'next/headers';
import { REGION_COOKIE, normalizeSido, REGION_FALLBACK } from '@/lib/region/cookie';
import { BUGYEONG_REGIONS } from '@/lib/apt/pipeline';

export const revalidate = 60;

export const metadata: Metadata = {
  // absolute — (main)/layout 의 `%s | 카더라` 템플릿이 붙어 브랜드가 중복되는 걸 막는다.
  // ⚠️ 예전 제목은 '오늘의 이슈 종목·청약·블로그' 였다. 그 세 섹션이 홈에서 빠졌으므로
  //    제목만 남겨 두면 검색 결과가 화면과 어긋난다.
  // ⛔ H5-1(2026-08-27) — 제목·설명에서 지역명을 뺐다. 전국 플랫폼이고, 「부울경」은
  //    데이터 필터·크론·어드민 라벨에만 남는다(최종 지시서 §0-2).
  //    metadata 는 검색 결과와 공유 카드에 그대로 나가는 «사용자 화면 카피» 다 —
  //    화면만 고치고 여기를 두면 검색 결과가 화면과 어긋난다.
  title: { absolute: '카더라 — 분양·재개발 현장' },
  description:
    '모집공고 전부터 보는 분양 소식. 단지명 하나로 분양가·모델하우스·잔여세대·재개발 구역 진행 단계를 바로 찾습니다.',
  alternates: { canonical: SITE },
  openGraph: {
    title: '카더라 — 분양·재개발',
    description: '모집공고 전부터 보는 분양 소식. 단지명 하나로 바로 찾으세요.',
    url: SITE,
    siteName: '카더라',
    images: [{ url: `${SITE}/images/brand/kadeora-wide.png`, width: 1200, height: 630, alt: '카더라' }],
    locale: 'ko_KR',
    type: 'website',
  },
};

/**
 * 홈이 다루는 지역. 부울경이 카더라의 실제 커버리지다.
 * ⚠️ 여기서 배열을 새로 쓰지 않는다 — lib/apt/pipeline.ts 의 BUGYEONG_REGIONS 가 원본이다.
 *    같은 목록이 두 곳에 있으면 한쪽만 고치게 된다.
 */
const HOME_REGIONS = [...BUGYEONG_REGIONS];

/** 홈에서 「계약 가능」으로 묶는 상태값. */
const DEAL_STATUSES = ['선착순', '잔여세대', '분양중'];

// 홈은 사이트에서 authority 가 가장 높은 페이지다. 네이버 유입 상위 착지 페이지
// (계산기·재개발 허브)로도 경로를 낸다. 최하단이라 첫 화면을 밀어내지 않는다.
/* M4-4 — QUICK_LINKS 는 하단 링크 그리드와 함께 걷었다(푸터 네비 중복). */

/**
 * C-3 — 최근 움직인 현장.
 *
 * ⚠️ `stage_updated_at` 으로 정렬하지 않는다. 대량 시드가 상단을 통째로 덮는다.
 *    RPC 가 `apt_site_events` 를 본다.
 * ⚠️ 정렬을 여기서 다시 하지 않는다 — RPC 가 ① stage 우선 ② line_rank 0(청약 라인)
 *    ③ occurred_at DESC 로 이미 정렬해 준다. 받은 순서를 그대로 넘긴다.
 */
async function fetchRecentMoves(): Promise<RecentMove[]> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any).rpc('get_apt_recent_moves', {
      p_region: HOME_REGIONS,
      p_limit: 7, // M4-4: 4 → 7행 (지표 통합으로 확보한 세로를 현장에 준다)
      p_days: 30,
    });
    if (error) throw error;
    return (Array.isArray(data) ? data : []) as RecentMove[];
  } catch (e) {
    console.error('[home] recent moves failed:', e);
    return [];
  }
}

/**
 * H4-1 (c) — 칩 «큐레이션 층». 실제로 계약이 가능한 현장만 낸다.
 *
 * ⚠️ `content_score` 정렬을 버렸다. 그건 중복 생존자를 고르는 값이지(RULES#118)
 *    사람이 본 흔적이 아니다. 이제 «담당이 손으로 올린 것» 만 본다 —
 *    is_curated=true AND curated_status IN (선착순·잔여세대·분양중), curated_at DESC.
 *    실측 부울경 4건(부산 4 · 울산 0 · 경남 0).
 * ⚠️ `page_views` 로 정렬하지 않는다. 합성값이다 (파일 상단 주석).
 * ⚠️ 길이 필터는 lib/home/chips.ts 가 한다 — 판정을 두 곳에 두지 않는다.
 *
 * 큐레이션이 0건이면 빈 배열을 낸다. 채우는 판단은 buildHomeChips 가 한다.
 */
/**
 * ⚠️ 여기서 «칩 이름만» 뽑는다. 한때 행 전체를 받아 홈에 「담당이 고른 현장」 섹션을
 *    만들었다가 되돌렸다 — 「지금 계약 가능」과 소스가 거의 같은 큐레이션 현장이라
 *    같은 현장이 두 섹션에 겹쳐 보이고, H4 의 「홈은 승격 1섹션 + 나머지 최소」가
 *    흔들린다. 큐레이션을 «앞에 세우는» 일은 /apt 2단이 할 일이다(H5-2 pipeline 정렬).
 */
async function fetchCuratedNames(limit = CHIP_LIMIT): Promise<string[]> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any)
      .from('apt_sites')
      .select('name')
      .eq('is_active', true)
      .eq('is_curated', true)
      .in('curated_status', DEAL_STATUSES)
      .in('region', HOME_REGIONS)
      .order('curated_at', { ascending: false, nullsFirst: false })
      .limit(Math.max(limit * 4, 20));
    if (error) throw error;
    return ((data ?? []) as { name: string | null }[]).map((r) => r.name ?? '');
  } catch (e) {
    console.error('[home] curated names failed:', e);
    return [];   // 실패해도 검색창은 기본 안내문으로 그대로 뜬다
  }
}

interface HomeCounts {
  total: number;
  byRegion: { region: string; n: number }[];
  bySigungu: { region: string; sigungu: string; n: number }[];
}

/**
 * C-1 부제의 「현장 N곳」과 C-5 지역 칩 건수를 **한 쿼리로** 낸다.
 *
 * ⚠️ 숫자를 하드코딩하지 않는다. 굳으면 화면이 조용히 거짓말을 한다.
 * ⚠️ 히어로 숫자와 칩 숫자를 각각 세지 않는다 — 두 번 세면 반드시 갈라진다.
 * ⚠️ `/apt/[id]` 의 8개짜리 `Promise.allSettled` 뭉치에 합치지 말 것 (504 전례).
 *    여기서도 홈 본체 fetch 와 분리해 돌린다. 실패하면 히어로 부제와 칩만 빠진다.
 * ⚠️ **`.limit()` 을 키우는 걸로는 안 된다.** 예전 주석이 「.limit() 을 반드시 준다」였는데
 *    그건 틀렸다 — 상한은 클라이언트가 아니라 «서버» 에 있다. PostgREST `db-max-rows` 가
 *    1,000 이라 `.limit(5000)` 을 줘도 1,000행만 온다.
 *    실측: 부울경 활성 1,464곳인데 화면에 「현장 1,000곳」이 나갔다. 464곳이 조용히 사라졌고
 *    시군구 칩 건수도 잘린 표본에서 세고 있었다.
 *    → `fetchAll`(`.range()` 반복)로 받는다. `/blog` 의 `.limit(4000)` 도 같은 원인이었다.
 */
async function fetchCounts(): Promise<HomeCounts> {
  const empty: HomeCounts = { total: 0, byRegion: [], bySigungu: [] };
  try {
    const sb = getSupabaseAdmin();
    const rows = (await fetchAll(
      sb,
      'apt_sites',
      'region,sigungu',
      (q: any) => q.eq('is_active', true).in('region', HOME_REGIONS),
    )) as { region: string | null; sigungu: string | null }[];
    const regionTally = new Map<string, number>();
    const sigunguTally = new Map<string, { region: string; sigungu: string; n: number }>();

    for (const r of rows) {
      const region = (r.region ?? '').trim();
      if (!region) continue;
      regionTally.set(region, (regionTally.get(region) ?? 0) + 1);
      const sigungu = (r.sigungu ?? '').trim();
      if (!sigungu) continue; // 시군구 미상 40곳은 칩을 만들 수 없다
      const key = `${region}|${sigungu}`;
      const cur = sigunguTally.get(key);
      if (cur) cur.n += 1;
      else sigunguTally.set(key, { region, sigungu, n: 1 });
    }

    return {
      total: rows.length,
      // 칩 순서를 HOME_REGIONS 순으로 고정한다 — 건수로 정렬하면 데이터가 흔들릴 때
      // 칩 자리가 바뀌어 같은 화면이 매번 달라 보인다.
      byRegion: HOME_REGIONS.map((region) => ({ region, n: regionTally.get(region) ?? 0 }))
        .filter((r) => r.n > 0),
      // 주요 구군은 건수 상위 4개. 목록을 손으로 적지 않는다 — 데이터가 바뀌면 따라간다.
      bySigungu: [...sigunguTally.values()].sort((a, b) => b.n - a.n).slice(0, 4),
    };
  } catch (e) {
    console.error('[home] counts failed:', e);
    return empty;
  }
}

export default async function HomePage() {
  /* H4-2 — 실거래 조회를 홈 본체 뭉치에 «합치지 않는다» (Rule #49).
   * /apt/[id] 의 Promise.allSettled 8개 뭉치가 504 를 낸 전례가 있다.
   * 먼저 띄워 두고 뒤에서 받는다 — 뭉치와 분리돼 있으면서 직렬화되지도 않는다.
   * fetchWeeklyTrades 는 자체 try/catch 로 절대 reject 하지 않으므로
   * 이 promise 가 홈의 다른 블록을 무너뜨릴 수 없다. */
  const weeklyPromise = fetchWeeklyTrades();

  const [moves, counts, curatedNames, sections] = await Promise.all([
    fetchRecentMoves(),
    fetchCounts(),
    fetchCuratedNames(),
    fetchHomeSections(HOME_REGIONS),
  ]);

  const weekly = await weeklyPromise;

  /* M4-4 신설 ② 「분석 최신 · 부동산」 3행.
   * ⚠️ 홈↔블로그 회유로가 0 이었다(Q3 가 판정). 조회 하나를 «새로» 붙인다 — 보고 대상이다.
   * ⛔ 실패해도 홈을 무너뜨리지 않는다. 빈 배열이면 섹션을 통째로 렌더하지 않는다. */
  const latestBlogs = await (async () => {
    try {
      const { data, error } = await (getSupabaseAdmin() as any)
        .from('blog_posts')
        .select('id, slug, title, published_at')
        /* ⚠️ 실측 정정 — blog_posts.category 에 'realestate' 라는 값은 «없다»(탭 키다).
           부동산은 apt·unsold·redev 셋이다(2026-09-03 DB 확인). eq 로 걸면 항상 0건이고,
           그 0건은 「글이 없다」로 보여서 조용히 섹션이 사라진다. */
        .eq('is_published', true).in('category', ['apt', 'unsold', 'redev'])
        .order('published_at', { ascending: false })
        .limit(3);
      if (error) { console.error(`[home] latest blogs: ${error.message?.slice(0, 160)}`); return []; }
      return (data ?? []) as { id: string; slug: string; title: string; published_at: string | null }[];
    } catch (e: any) {
      console.error(`[home] latest blogs caught: ${e?.message ?? String(e)}`);
      return [];
    }
  })();



  /* ══ H6-4 히어로 데이터 띠 ═══════════════════════════════════════════════

   *

   * ⚠️ 히어로 하단이 «빈 네이비» 였다(데스크탑 1080 에서 콘텐츠 260px).

   *    이미지·일러스트로 채우지 않는다 — 실사 정책과 대비 규칙 둘 다에 걸린다.

   *    사이트가 «무엇을 아는지» 를 숫자로 보여 준다.

   * ⚠️ 지역은 부동산 탭과 «같은 쿠키» 다. 없으면 부산.

   * ⛔ 개인 데이터(최근 본 현장)를 여기 올리지 않는다.

   * ⚠️ 숫자가 «없는 칸은 만들지 않는다». 「0건」은 정보가 아니다.

   */

  const heroRegion = normalizeSido((await cookies()).get(REGION_COOKIE)?.value ?? null) ?? REGION_FALLBACK;

  const sbHero = getSupabaseAdmin();

  const [nextSubR, pipelineCountR] = await Promise.all([

    (sbHero as any).from('apt_subscriptions')

      .select('house_nm, rcept_bgnde, region_nm')

      .gte('rcept_bgnde', new Date().toISOString().slice(0, 10))

      .eq('region_nm', heroRegion)

      .order('rcept_bgnde', { ascending: true }).limit(1).maybeSingle(),

    (sbHero as any).from('apt_sites')

      .select('id, slug, name, display_name, region, sigungu, lifecycle_stage, total_units', { count: 'exact' })

      .eq('is_active', true).eq('region', heroRegion)

      .in('lifecycle_stage', ['pre_announcement', 'site_planning', 'union_established', 'plan_approved', 'mgmt_approved', 'construction'])
      .order('stage_updated_at', { ascending: false, nullsFirst: false })
      .limit(5),

  ]);

  if (nextSubR?.error) console.error(`[home] next subscription: ${nextSubR.error.message?.slice(0, 160)}`);

  if (pipelineCountR?.error) console.error(`[home] pipeline count: ${pipelineCountR.error.message?.slice(0, 160)}`);



  const heroStats: HeroStat[] = [];

  if (weekly && weekly.deals > 0) {

    heroStats.push({

      value: `${weekly.deals.toLocaleString('ko-KR')}건`,

      label: `이번 주 실거래 · ${heroRegion}`,

      href: `/apt?region=${encodeURIComponent(heroRegion)}`,

    });

  }

  const ns = nextSubR?.data;

  if (ns?.rcept_bgnde && ns?.house_nm) {

    const d = Math.ceil((new Date(ns.rcept_bgnde + 'T00:00:00+09:00').getTime() - Date.now()) / 86400000);

    if (d >= 0) {

      heroStats.push({

        value: d === 0 ? '오늘 접수' : `D-${d}`,

        label: `청약 접수 · ${ns.house_nm}`,

        href: `/apt?region=${encodeURIComponent(heroRegion)}&st=soon`,

      });

    }

  }

  const pipelineCount = pipelineCountR?.count ?? 0;
  /* M4-4 신설 ① 「공고 전 · 카더라 단독」 — 위 조회가 이제 목록까지 준다(조회 수 그대로).
     ⚠️ HomeRow 로 «맞춰» 넘긴다. 홈 목록 컴포넌트를 두 벌 만들지 않는다. */
  const pipelineRows = ((pipelineCountR?.data ?? []) as any[]).map((r) => ({
    slug: r.slug, name: r.display_name || r.name, region: r.region, sigungu: r.sigungu,
    lifecycle_stage: r.lifecycle_stage, total_units: r.total_units, price: null,
    hero_image_url: null, hero_license_tier: null,
  }));

  if (pipelineCount > 0) {

    heroStats.push({

      value: `${pipelineCount.toLocaleString('ko-KR')}곳`,

      label: `공고 전 현장 · ${heroRegion}`,

      href: `/apt?region=${encodeURIComponent(heroRegion)}`,

    });

  }

  // H4-1 (c)(d) — 칩과 라벨을 «한 함수»에서 같이 받는다. 갈라지면 라벨이 거짓이 된다.
  // 두 번째 소스는 위에서 이미 받은 moves 를 재사용한다 — 조회가 늘지 않는다.
  const chips = buildHomeChips({
    curated: curatedNames,
    moves: moves.map((m) => m.name),
  });

  // H4-1 (f) — 실사를 가진 한 건만 승격한다. 없으면 null 이고 목록이 그대로 나간다.
  // ⚠️ 승격한 건은 아래 목록에서 «뺀다». 같은 현장이 카드와 줄로 두 번 나오면
  //    3줄짜리 섹션에서 자리 하나를 버리는 셈이다.
  const dealHero = pickDealHero(sections.deals);
  const dealRows = dealHero ? sections.deals.filter((r) => r.slug !== dealHero.slug) : sections.deals;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--sp-sm) var(--sp-sm) var(--sp-2xl)' }}>
      {/* ── 2 히어로 (H5-1) ──
       * 첫 화면의 55~60%를 네이비 색면이 차지하고 흰 검색창 하나만 뜬다.
       * ⛔ 카피에 지역명을 넣지 않는다. 전국 플랫폼이고, 「부울경」은 데이터 필터·크론·
       *    어드민 라벨에만 남는다(최종 지시서 §0-2).
       * ⚠️ 골드 줄은 히어로 «상단 1/3» 안에 있어야 한다. 아래로 내려가면 배경이 밝아져
       *    3.27:1 로 떨어진다. 실측은 HeroSearch 주석에 있다. */}
      <HeroSearch chipNames={chips.names} siteCount={counts.total} stats={heroStats} />

      {/* ── 2 이번 주 실거래 (H4-2) ──
       * 접힌 선 «아래» 첫 블록이다. 첫 화면(H1 + 검색창 + 칩)을 침범하지 않는다 —
       * H4-1 실측으로 칩 줄 하단이 359px / 뷰포트 844px 다.
       * ⚠️ 홈에서 «매일 바뀌는 유일한 블록» 이다. 큐레이션 4건과 재개발 목록은
       *    주 단위로도 잘 안 움직인다. 재방문 이유가 여기서 나온다.
       * ⚠️ RPC 가 실패하거나 0건이면 fetchWeeklyTrades 가 null 을 내고 여기서 미렌더된다. */}
      {/* ── 3 최근 본 현장 — 없으면 컴포넌트가 null 을 낸다 ──
       * H7-3: 실거래 «앞» 으로 올렸다. 이미 본 현장이 먼저 나와야 「돌아온 사람」의
       *       첫 화면이 자기 맥락으로 시작한다. */}
      <RecentlyViewed limit={3} />

      {/* M4-4 — 실거래 위젯을 걷었다. 같은 숫자(이번 주 실거래)를 히어로 스탯 띠가 이미 말한다.
           한 화면에서 같은 값을 두 번 그리지 않는다(D7). 데이터·조회는 그대로 스탯이 쓴다. */}
      <div className="kd-band" aria-hidden="true" />


      {/* ⛔ H7-3 — 「지금 계약 가능」 섹션을 «걷어냈다». 되살리지 말 것.
       *    그 섹션의 정렬은 content_score 였는데 「부산 기장군 미분양」 같은
       *    «구군 집계 한 줄» 이 점수 100 으로 1위를 먹고 «현장처럼» 떠 있었다.
       *    집계 행은 이제 is_aggregate 로 걸러지지만(H7-3), 섹션 자체도 뺀다 —
       *    미분양 목록은 /apt/unsold 가 이미 맡고 있어 홈에 또 둘 이유가 없다.
       *    lib/home/sections.ts 의 deals 계산과 DealHeroCard 는 «지우지 않았다».
       *
       * ── 4 최근 움직인 현장 ──
       * ⚠️ 「신규 등록」과 「단계 변경」을 라벨로 가른다 — 섞어서 「N곳이 움직였다」로
       *    쓰면 거짓말이 된다(실측: 단계 변경 84 · 신규 등록 345).
       * ⚠️ 더보기는 /apt 로 보낸다. 거기에 같은 섹션(getAptRecentMoves)이 이미 있어
       *    맥락이 이어진다. 「전체」가 아니라 「더 보기」로 적는 이유는 /apt 도 섹션이지
       *    전체 목록이 아니기 때문이다 — 없는 걸 있다고 쓰지 않는다.
       * ⚠️ /apt/pipeline 을 쓰지 않는다. 그건 「공고 전 현장 전체 보기」라 성격이 다르다. */}
      {moves.length > 0 && (
        <section style={{ marginBottom: 'var(--sp-xl)' }}>
          {/* ⛔ eyebrow 에서 지역명을 뺐다. 데이터 필터(HOME_REGIONS)는 «그대로» 다 —
                지우면 응대 못 하는 지역 현장이 홈에 뜬다(C-5). 카피만 뺀다. */}
          <SectionHeader eyebrow="APT — 최근 갱신" title="최근 움직인 현장" id="home-moves" rule />
          <RecentMoves items={moves} />
          <MoreLink href="/apt" label="부동산 홈 — 청약·공고 전 전체" />  {/* M4-3 에서 /apt 의 같은 섹션을 걷었다. 「거기 더 있다」고 말하지 않는다. */}
        </section>
      )}

      {/* ── M4-4 신설 ① 공고 전 · 카더라 단독 ──
           차별점을 홈 인덱스의 «첫 섹션» 자리에 세운다. 데이터는 위 조회가 이미 준 것이다. */}
      {pipelineRows.length > 0 && (
        <section style={{ marginBottom: 'var(--sp-xl)' }}>
          <SectionHeader
            eyebrow="PIPELINE — 공고 전"
            title="공고 전 현장"
            id="home-pipeline"
            meta="카더라 단독 · 단계 갱신 최신순"
            rule
          />
          <SiteRows items={pipelineRows} />
          <MoreLink href="/apt" label={`공고 전 ${pipelineCount.toLocaleString('ko-KR')}곳 전체`} />
        </section>
      )}

      {/* ── 6 재개발·재건축 ── */}
      {sections.redev.length >= MIN_ROWS && (
        <section style={{ marginBottom: 'var(--sp-xl)' }}>
          <SectionHeader eyebrow="APT — 정비사업" title="재개발·재건축" id="home-redev" rule />
          <SiteRows items={sections.redev} />
          <MoreLink href="/apt/redev/부산" label="구역별 진행 단계 전체" />
        </section>
      )}

      {/* ── 7 지역별 보기 ──
       * ⚠️ 건수 하드코딩 금지. 히어로 부제와 같은 쿼리(fetchCounts)에서 온다.
       * ⚠️ 링크는 실재가 확인된 라우트만 쓴다 —
       *    /apt/region/[region] · /apt/region/[region]/[sigungu]. */}
      {counts.byRegion.length > 0 && (
        <section style={{ marginBottom: 'var(--sp-xl)' }}>
          <SectionHeader eyebrow="REGION — 지역별" title="지역별 보기" id="home-region" rule />
          <nav aria-label="시도별 현장" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-xs)', padding: '0 3px' }}>
            {counts.byRegion.map((r) => (
              <Link
                key={r.region}
                href={`/apt/region/${encodeURIComponent(r.region)}`}
                // ⚠️ DS-3-4 — Rule #77 `.touch-target`. 시각 크기는 그대로 두고
                //    ::after 로 «히트 영역만» 44px 로 넓힌다. 칩 높이를 키우면
                //    지역 칩이 줄바꿈되며 홈 첫 화면이 밀린다.
                className="touch-target"
                style={chipStyle}
              >
                {r.region} <span style={{ color: 'var(--text-tertiary)' }}>{r.n.toLocaleString('ko-KR')}</span>
              </Link>
            ))}
          </nav>
          {counts.bySigungu.length > 0 && (
            <nav
              aria-label="주요 구군 현장"
              style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-xs)', padding: '0 3px', marginTop: 'var(--sp-sm)' }}
            >
              {counts.bySigungu.map((s) => (
                <Link
                  key={`${s.region}-${s.sigungu}`}
                  /* ⚠️ /apt/region 은 «1단(시도)» 라우트뿐이다. 2단을 만들면 404 다 —
                     구군 허브의 실재 경로는 /apt/area/{시도}/{구군} 이다(2026-08-28 스모크가 잡음). */
                  href={`/apt/area/${encodeURIComponent(s.region)}/${encodeURIComponent(s.sigungu)}`}
                  className="touch-target"
                  style={chipStyle}
                >
                  {s.sigungu} <span style={{ color: 'var(--text-tertiary)' }}>{s.n.toLocaleString('ko-KR')}</span>
                </Link>
              ))}
            </nav>
          )}
        </section>
      )}

      {/* M4-4 신설 ② 분석 최신 · 부동산 — 홈↔블로그 회유로가 0 이었다. */}
      {latestBlogs.length > 0 && (
        <section style={{ marginBottom: 'var(--sp-xl)' }}>
          <SectionHeader eyebrow="BLOG — 부동산" title="분석 최신" id="home-blog" rule />
          <div>
            {latestBlogs.map((b) => (
              <Link
                key={b.id}
                href={`/blog/${b.slug}`}
                className="kd-lrow"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <span style={{ minWidth: 0 }}>
                  <span className="kd-lrow-t">{b.title}</span>
                </span>
                <span className="kd-lrow-r">
                  {b.published_at ? new Date(b.published_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) : ''}
                </span>
              </Link>
            ))}
          </div>
          <MoreLink href="/blog?category=realestate" label="부동산 분석 전체" />  {/* ?category= 는 «탭 키» 라 realestate 가 맞다 — DB 값과 다른 축이다. */}
        </section>
      )}

      {/* M4-4(Q5ⓐ) — 하단 「빠른 이동」 링크 그리드를 걷었다. 푸터 네비가 같은 링크를 이미 진다.
           한 화면이 같은 진입점을 두 번 말하지 않는다. */}
    </div>
  );
}

/** 칩 한 벌. 지역·구군·빠른 이동이 같은 모양을 쓴다. */
const chipStyle: React.CSSProperties = {
  padding: '5px var(--sp-md)',
  borderRadius: 'var(--radius-pill)',
  fontSize: 'var(--fs-2xs)',
  fontWeight: 500,
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  color: 'var(--text-secondary)',
  textDecoration: 'none',
};
