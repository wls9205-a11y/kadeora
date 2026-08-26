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
import { BUGYEONG_REGIONS } from '@/lib/apt/pipeline';

export const revalidate = 60;

export const metadata: Metadata = {
  // absolute — (main)/layout 의 `%s | 카더라` 템플릿이 붙어 브랜드가 중복되는 걸 막는다.
  // ⚠️ 예전 제목은 '오늘의 이슈 종목·청약·블로그' 였다. 그 세 섹션이 홈에서 빠졌으므로
  //    제목만 남겨 두면 검색 결과가 화면과 어긋난다.
  title: { absolute: '카더라 — 부산·울산·경남 분양·재개발 현장' },
  description:
    '모집공고 전부터 보는 부울경 분양. 단지명 하나로 분양가·모델하우스·잔여세대·재개발 구역 진행 단계를 바로 찾습니다.',
  alternates: { canonical: SITE },
  openGraph: {
    title: '카더라 — 부울경 분양·재개발',
    description: '모집공고 전부터 보는 부울경 분양. 단지명 하나로 바로 찾으세요.',
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
const QUICK_LINKS: { href: string; label: string }[] = [
  { href: '/apt',          label: '청약 일정' },
  { href: '/apt/redev',    label: '재개발·재건축' },
  { href: '/apt/complex',  label: '단지백과' },
  { href: '/calc',         label: '계산기' },
  { href: '/stock/themes', label: '테마주' },
  { href: '/daily',        label: '데일리 리포트' },
  { href: '/feed',         label: '커뮤니티' },
];

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
      p_limit: 4,
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
 * ⚠️ `content_score` 정렬을 버렸다. 그건 중복 생존자를 고르는 값이지(Rule #43)
 *    사람이 본 흔적이 아니다. 이제 «담당이 손으로 올린 것» 만 본다 —
 *    is_curated=true AND curated_status IN (선착순·잔여세대·분양중), curated_at DESC.
 *    실측 부울경 4건(부산 4 · 울산 0 · 경남 0).
 * ⚠️ `page_views` 로 정렬하지 않는다. 합성값이다 (파일 상단 주석).
 * ⚠️ 길이 필터는 lib/home/chips.ts 가 한다 — 판정을 두 곳에 두지 않는다.
 *
 * 큐레이션이 0건이면 빈 배열을 낸다. 채우는 판단은 buildHomeChips 가 한다.
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
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '8px 6px 24px' }}>
      {/* ── 2 히어로 ──
       * H4-1 (a): 첫 화면은 H1 + 검색창 + 칩 줄까지다. 아래 섹션과의 여백을 벌려
       * 「여기서 검색한다」가 먼저 읽히게 한다. */}
      <section style={{ margin: '6px 3px 34px' }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: -0.4,
            lineHeight: 1.35,
            margin: '0 0 12px',
            color: 'var(--text-primary)',
          }}
        >
          모집공고 전부터 보는
          <br />
          부울경 분양
        </h1>

        {/* ⚠️ hotkey={false} 필수 — 헤더의 bar 인스턴스가 이미 ⌘K 를 소유한다.
         *    둘 다 true 면 keydown 이 두 번 잡혀 모달이 두 개 열린다.
         *    (Navigation.tsx 의 icon 인스턴스도 같은 이유로 false 다.) */}
        {/* H3-2: 회전 문구는 실제 현장명이다. 데이터가 없으면 placeholder 로 조용히 되돌아간다.
            H3-3: 모달 추천 칩도 같은 목록을 쓴다 — trending_keywords 를 홈에서만 끊는다.
                  다른 페이지의 검색 모달은 지금처럼 trending 을 쓴다. */}
        <UniversalSearchBar
          variant="hero"
          hotkey={false}
          placeholder="단지명·지역·재개발 구역"
          rotatingPlaceholders={chips.names}
          suggestions={chips.names}
          suggestionLabel={chips.label}
        />

        {/* 숫자는 fetchCounts 에서 온다. 0이면 문장에서 통째로 뺀다 —
            「현장 0곳」은 안 쓰느니만 못하다. */}
        <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: '8px 2px 0' }}>
          {counts.total > 0 ? `현장 ${counts.total.toLocaleString('ko-KR')}곳 · ` : ''}
          단지명 하나로 바로 찾으세요
        </p>
      </section>

      {/* ── 2 이번 주 실거래 (H4-2) ──
       * 접힌 선 «아래» 첫 블록이다. 첫 화면(H1 + 검색창 + 칩)을 침범하지 않는다 —
       * H4-1 실측으로 칩 줄 하단이 359px / 뷰포트 844px 다.
       * ⚠️ 홈에서 «매일 바뀌는 유일한 블록» 이다. 큐레이션 4건과 재개발 목록은
       *    주 단위로도 잘 안 움직인다. 재방문 이유가 여기서 나온다.
       * ⚠️ RPC 가 실패하거나 0건이면 fetchWeeklyTrades 가 null 을 내고 여기서 미렌더된다. */}
      {weekly && <WeeklyTrades data={weekly} />}

      {/* ── 3 최근 본 현장 — 없으면 컴포넌트가 null 을 낸다 ── */}
      <RecentlyViewed limit={3} />

      {/* ── 4 지금 계약 가능한 현장 ──
       * 카드 4장에서 텍스트 3줄로 바꿨다. 카드는 104px, 줄은 42px —
       * 같은 자리에 세 배가 들어간다. DealCards 는 지우지 않았다(다른 자리에서 쓸 수 있다).
       *
       * H4-1 (f) — 실사(조감도)를 가진 건이 «있을 때만» 최상단 1건을 이미지 카드로 올린다.
       * 없으면 승격하지 않는다. 브랜드 카드로 자리를 채우지 않는다 (DealHeroCard 주석 참조). */}
      {sections.deals.length >= MIN_ROWS && (
        <section style={{ marginBottom: 18 }}>
          <SectionHeader eyebrow="APT — 미분양·선착순" title="지금 계약 가능" id="home-deals" />
          {dealHero && <DealHeroCard item={dealHero} />}
          <SiteRows items={dealRows} />
          <MoreLink href="/apt/unsold" label="미분양·선착순·잔여세대 전체" />
        </section>
      )}

      {/* ── 5 최근 움직인 현장 ──
       * ⚠️ 「신규 등록」과 「단계 변경」을 라벨로 가른다 — 섞어서 「N곳이 움직였다」로
       *    쓰면 거짓말이 된다(실측: 단계 변경 84 · 신규 등록 345).
       * ⚠️ 더보기는 /apt 로 보낸다. 거기에 같은 섹션(getAptRecentMoves)이 이미 있어
       *    맥락이 이어진다. 「전체」가 아니라 「더 보기」로 적는 이유는 /apt 도 섹션이지
       *    전체 목록이 아니기 때문이다 — 없는 걸 있다고 쓰지 않는다.
       * ⚠️ /apt/pipeline 을 쓰지 않는다. 그건 「공고 전 현장 전체 보기」라 성격이 다르다. */}
      {moves.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <SectionHeader eyebrow="APT — 부산·울산·경남" title="최근 움직인 현장" id="home-moves" />
          <RecentMoves items={moves} />
          <MoreLink href="/apt" label="부동산 홈에서 더 보기" />
        </section>
      )}

      {/* ── 6 재개발·재건축 ── */}
      {sections.redev.length >= MIN_ROWS && (
        <section style={{ marginBottom: 18 }}>
          <SectionHeader eyebrow="APT — 정비사업" title="재개발·재건축" id="home-redev" />
          <SiteRows items={sections.redev} />
          <MoreLink href="/apt/redev/부산" label="구역별 진행 단계 전체" />
        </section>
      )}

      {/* ── 7 지역별 보기 ──
       * ⚠️ 건수 하드코딩 금지. 히어로 부제와 같은 쿼리(fetchCounts)에서 온다.
       * ⚠️ 링크는 실재가 확인된 라우트만 쓴다 —
       *    /apt/region/[region] · /apt/region/[region]/[sigungu]. */}
      {counts.byRegion.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <SectionHeader eyebrow="REGION — 지역별" title="지역별 보기" id="home-region" />
          <nav aria-label="시도별 현장" style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '0 3px' }}>
            {counts.byRegion.map((r) => (
              <Link
                key={r.region}
                href={`/apt/region/${encodeURIComponent(r.region)}`}
                style={chipStyle}
              >
                {r.region} <span style={{ color: 'var(--text-tertiary)' }}>{r.n.toLocaleString('ko-KR')}</span>
              </Link>
            ))}
          </nav>
          {counts.bySigungu.length > 0 && (
            <nav
              aria-label="주요 구군 현장"
              style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '0 3px', marginTop: 6 }}
            >
              {counts.bySigungu.map((s) => (
                <Link
                  key={`${s.region}-${s.sigungu}`}
                  href={`/apt/region/${encodeURIComponent(s.region)}/${encodeURIComponent(s.sigungu)}`}
                  style={chipStyle}
                >
                  {s.sigungu} <span style={{ color: 'var(--text-tertiary)' }}>{s.n.toLocaleString('ko-KR')}</span>
                </Link>
              ))}
            </nav>
          )}
        </section>
      )}

      {/* 빠른 이동 — 내부 링크용. 첫 화면을 밀어내지 않게 최하단에 둔다. */}
      <nav aria-label="주요 메뉴" style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '0 3px' }}>
        {QUICK_LINKS.map((l) => (
          <Link key={l.href} href={l.href} style={chipStyle}>
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** 칩 한 벌. 지역·구군·빠른 이동이 같은 모양을 쓴다. */
const chipStyle: React.CSSProperties = {
  padding: '5px 10px',
  borderRadius: 'var(--radius-pill)',
  fontSize: 12,
  fontWeight: 500,
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  color: 'var(--text-secondary)',
  textDecoration: 'none',
};
