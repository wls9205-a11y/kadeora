// s273 — /apt 청약 퍼스트 재설계.
//
// 구성 (H4-4 재배치):
//   1 AptFilterRow + SigunguChips     검색·필터 한 줄
//   2 [목록 | 지도] 토글               AptViewSwitch — 지도는 목록의 «대체가 아니라 뷰 전환»
//   3 청약·분양중  4 공고 전 현장  5 기축 실거래
//   ── 이하 하단 (내린 것이지 지운 것이 아니다) ──
//   SubscriptionTimeline · RecentMovesStrip · CurationCarousel · AptToolChips
//   · 청약 결과 · 아카이브 · AptRelatedBlogs
//       ④ 이번 주 청약 결과 ⑤ 관련 블로그 분석
//
// 데이터는 get_apt_subscription_hub 단일 RPC 하나로 끝낸다 (Architecture Rule #49).
// 기존 3-RPC Promise.all (hero/feed/stats) 을 대체.
//
// 캐시: ISR 900초. 다만 이 라우트는 searchParams(region) 를 읽어 Next 15 가
// dynamic 으로 강등시키므로 page-level revalidate 만으로는 실제 캐시가 안 걸린다.
// 그래서 데이터 레이어(lib/apt/hub.ts)에서 unstable_cache 로 900초를 직접 건다.
// 이 조합이 Rule #66 (빈 응답이 SSG 캐시에 영구화되는 회귀) 도 같이 막는다 —
// 결과가 비면 캐시 경로를 건너뛰고 매 요청 재시도한다.
//
// s269 이전 UI 스냅샷(_legacy/s269/apt_page_v0.tsx)은 V15 에서 삭제했다 —
// 그 뒤로 스키마가 바뀌어(supply_units/complex_units 분리 · lifecycle_stage 5단계 ·
// apt_site_merges) 되살려도 동작하지 않는다. 되돌릴 수 없는 롤백 참조는 함정이다.

import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/constants';
import { facetRobots, aptFacetCanonical } from '@/lib/seo/facet';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getAptHub } from '@/lib/apt/hub';
import { getRelatedBlogs } from '@/lib/apt/related-blogs';
import { buildSubscriptionEvents, buildSubscriptionItemList } from '@/lib/apt/subscription-schema';
import { cookies } from 'next/headers';
import RegionAutoSelect from '@/components/apt/RegionAutoSelect';
import RegionTileGrid from '@/components/apt/RegionTileGrid';
import RegionCookieSync from '@/components/apt/RegionCookieSync';
import StageSummaryStrip, { type StageItem } from '@/components/apt/StageSummaryStrip';
import RegionBlockList from '@/components/apt/RegionBlockList';
import SubscriptionCarousel from '@/components/apt/SubscriptionCarousel';
import { getRegionBlocks, getRegionTotals, getSigunguTotals, getRegionBlockTotals } from '@/lib/apt/region-blocks';
import { REGION_COOKIE, resolveRegion, normalizeSido } from '@/lib/region/cookie';
import SubscriptionTimeline from '@/components/apt/SubscriptionTimeline';
import SubscriptionCard from '@/components/apt/SubscriptionCard';
import SubscriptionResults from '@/components/apt/SubscriptionResults';
import AptToolChips from '@/components/apt/AptToolChips';
import AptRelatedBlogs from '@/components/apt/AptRelatedBlogs';
import SectionHeader from '@/components/apt/SectionHeader';
import CurationCarousel from '@/components/ui/CurationCarousel';
import SigunguChips from '@/components/apt/SigunguChips';
// ⚠️ H5-2 — AptFilterRow 는 StageSummaryStrip 이 대체한다. «파일은 지우지 않는다» —
//    되돌릴 판단이 남아 있고, 지우면 그 판단 근거가 같이 사라진다. 타입만 계속 쓴다.
import { type AptStatusKey } from '@/components/apt/AptFilterRow';
import AptHubRail from '@/components/apt/AptHubRail';
import { sigunguCounts, sigunguOf } from '@/lib/apt/sigungu';
import { pickCuration } from '@/lib/apt/hero-priority';
import AptCurationCard from '@/components/apt/AptCurationCard';
import EmptyState from '@/components/ui/EmptyState';
// V13 A-1 — 공고 전 현장. 허브 RPC 가 apt_subscriptions 전용이라 활성 현장의 절반이
//   이 목록에 닿지 못했다. get_apt_pipeline 은 공고 없는 현장만 내므로 위 목록과 겹치지 않는다.
import { getAptPipeline, normalizePipelineRegion, BUGYEONG, BUGYEONG_REGIONS, PIPELINE_SECTION_LIMIT } from '@/lib/apt/pipeline';
import PipelineCard from '@/components/apt/PipelineCard';
// V16 E-3 — 이번 주 움직인 현장. 카더라가 남보다 빠르다는 걸 보여주는 자리다.
import { getAptRecentMoves } from '@/lib/apt/recent-moves';
import GichukActivity from '@/components/apt/GichukActivity';
import AptViewSwitch from '@/components/apt/AptViewSwitch';
import { fetchGichukActivity } from '@/lib/apt/gichuk-activity';
import RecentMovesStrip from '@/components/apt/RecentMovesStrip';
import { SectionLink } from '@/components/apt/SectionHeader';
import { regionLabel, metaLine } from '@/lib/region/display';
import RegionSelectPanel from '@/components/region/RegionSelectPanel';
import SiteRow from '@/components/apt/SiteRow';
import { parseRegionSelection } from '@/lib/region/select-tree';
import { getRegionCounts, getSitesForSelection, selectionToPairs } from '@/lib/region/select-server';

// Next 는 segment config 를 정적 분석하므로 리터럴이어야 한다 (import 식별자 불가).
// lib/apt/hub.ts 의 APT_HUB_REVALIDATE_SECONDS 와 같은 값으로 유지할 것.
export const revalidate = 900;
export const maxDuration = 15;

const BASE_TITLE = '전국 아파트 청약 일정·경쟁률 — 오늘의 접수중 단지';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ region?: string; sgg?: string; st?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const regionLabel = sp.region?.trim() || '전국';
  const title = sp.region
    ? `${regionLabel} 아파트 청약 일정·경쟁률 — 오늘의 접수중 단지`
    : BASE_TITLE;
  const description =
    `${regionLabel} 아파트 청약 접수 일정과 경쟁률을 한 화면에. ` +
    '접수중·접수임박 단지를 D-day 순으로 정리하고, 마감된 단지는 1순위 경쟁률과 가점컷까지 확인하세요.';

  // [§6 / R11] 필터 조합 URL 은 전부 색인에서 뺀다.
  //   리뉴얼(부동산 β안)이 `?region=`·`?sgg=`·`?st=` 조합을 대량으로 만들어낸다.
  //   부울경만 해도 39시군구 × 상태 5 = 195조합이다. 선반영하지 않으면
  //   2026-08-25 실측에서 확인한 «파셋이 노출의 31.5% 잠식» 을 확대 재생산한다.
  //   색인 자산은 파라미터가 아니라 경로형 허브(`/apt/region/*`·`/apt/area/*`)이므로
  //   canonical 을 그쪽으로 보내 링크 가치만 넘긴다.
  const canonical = aptFacetCanonical(sp);

  return {
    title,
    description,
    alternates: { canonical },
    ...facetRobots(sp),
    openGraph: {
      title,
      description,
      siteName: '카더라',
      locale: 'ko_KR',
      type: 'website',
      url: sp.region ? `${SITE_URL}/apt?region=${encodeURIComponent(sp.region)}` : `${SITE_URL}/apt`,
      // s8: images 누락으로 공유 시 이미지 없는 링크로 나갔다. 기존 생성기 재사용.
      images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent(title)}&category=apt&design=2`, width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function AptPage({
  searchParams,
}: {
  searchParams?: Promise<{ region?: string; sgg?: string; st?: string; rg?: string }>;
}) {
  const sp = (await searchParams) || {};

  /* ══ H5-2 지역 결정 — 우선순위가 전부다 ══════════════════════════════════
   *
   *   ?region=  >  쿠키  >  위치 추정(RegionAutoSelect)  >  부산
   *
   * ⚠️ 쿠키를 «서버에서» 읽는다. 클라이언트 리다이렉트로 2단을 열면 첫 페인트에
   *    1단이 한 번 보였다 사라진다 — 깜빡임이 아니라 «잘못된 화면을 한 번 보여준 것» 이다.
   *    이 라우트는 이미 searchParams 를 읽어 동적이므로 cookies() 가 캐시를 더 깨지 않는다.
   *
   * ⚠️ 쿠키가 위치 추정을 «이긴다». 사용자가 직접 고른 지역이 다음 방문에 말없이
   *    바뀌면 그건 고장으로 읽힌다.
   */
  const cookieRegion = normalizeSido((await cookies()).get(REGION_COOKIE)?.value ?? null);
  const picked = resolveRegion({ query: sp.region ?? null, cookie: cookieRegion });
  // 1단(타일)을 보여줄 조건 — 쿼리도 쿠키도 없을 때뿐이다.
  const showTiles = !normalizeSido(sp.region ?? null) && !cookieRegion;
  const region = showTiles ? '전국' : picked.region;
  const sgg = sp.sgg?.trim() || '';
  const st = sp.st?.trim() || '';
  // 위치 추정은 «쿠키가 없을 때만» 돈다.
  const isAutoRegion = !sp.region && !cookieRegion;

  // V13 A-1: 공고 전 현장은 허브와 별개 RPC 다. 두 조회는 서로 기다릴 이유가 없다.
  //   지역 규칙 — 부산·울산·경남 중 하나를 고르면 벨트 전체(부울경)를 묶어서 본다.
  //   '전국'(자동 선택 포함)일 때도 부울경으로 좁힌다: 전국 209곳을 8칸에 담으면
  //   수도권 대형 현장이 전부 밀어내 부울경 집중이라는 목적 자체가 사라진다.
  const pipelineRegion = normalizePipelineRegion(
    region === '전국' || (BUGYEONG_REGIONS as readonly string[]).includes(region) ? BUGYEONG : region,
  );
  /* H4-4 §5 — 기축 실거래는 «따로» 돈다 (Rule #49).
   * /apt/[id] 의 allSettled 8개 뭉치가 504 를 낸 전례가 있어 여기 뭉치를 늘리지 않는다.
   * 먼저 띄우고 뒤에서 받는다 — 분리돼 있으면서 직렬화되지도 않는다.
   * fetchGichukActivity 는 자체 try/catch 로 절대 reject 하지 않는다. */
  const gichukPromise = fetchGichukActivity(pipelineRegion);

  const [hub, pipeline, recentMoves] = await Promise.all([
    getAptHub(region),
    // V17 F-1 게이트는 RPC 안에 있다(gated: true) — 받은 건 그대로 낸다.
    getAptPipeline(pipelineRegion, PIPELINE_SECTION_LIMIT),
    // 움직인 현장도 파이프라인과 같은 지역 규칙을 따른다 — 두 섹션이 다른 지역을 말하면 안 된다.
    getAptRecentMoves(pipelineRegion),
  ]);

  const gichuk = await gichukPromise;

  // H5-2 — 1단이면 타일 건수, 2단이면 목록 두 덩어리. 필요 없는 쪽은 조회하지 않는다.
  const regionTotals = showTiles ? await getRegionTotals() : [];
  // H7-3 ⚠️ 「N곳」은 «캡 전» 실제 건수여야 한다. blocks 는 limit 40 이라 그 길이를 적으면
  //    「부산 40곳」처럼 «상한이 실측인 척» 한다(실제 182곳 · 경기는 879곳인데도 40이었다).
  const [blocks, sggTotals, blockTotals] = showTiles
    ? [{ opened: [], pipeline: [] }, [] as { name: string; count: number }[], null]
    : await Promise.all([
        getRegionBlocks(region, sgg || null),
        getSigunguTotals(region),
        getRegionBlockTotals(region, sgg || null),
      ]);

  // v4-C8: 시군구 칩은 hub.cards 에서 뽑는다 — 조회가 늘지 않고, 목록에 실제로 있는
  //   시군구만 나온다 (부산 16개 구를 전부 내면 C3 에서 고친 문제가 반복된다).
  //   ⚠️ 시·도가 '전국' 이면 시군구를 내지 않는다 — 전국 단위로는 칩이 수백 개가 된다.
  const sggItems = region === '전국' ? [] : sigunguCounts(hub.cards);
  const activeSgg = sggItems.some((x) => x.name === sgg) ? sgg : '';
  const sggCards = activeSgg ? hub.cards.filter((it) => sigunguOf(it.supply_addr) === activeSgg) : hub.cards;

  // v5-V1: 좌측 Sidebar 의 부동산 분류를 여기 상태 필터로 흡수했다.
  //   이미 받은 카드에서 거르므로 조회가 늘지 않고, 건수 0인 칩은 렌더되지 않는다.
  const matchStatus = (it: (typeof sggCards)[number], key: string): boolean => {
    if (key === 'open') return it.status === 'open';
    if (key === 'soon') return it.dday !== null && it.dday >= 0 && it.dday <= 7;
    if (key === 'leftover') return it.status === 'leftover';
    return true;
  };
  const statusCounts: Record<AptStatusKey, number> = {
    open: sggCards.filter((it) => matchStatus(it, 'open')).length,
    soon: sggCards.filter((it) => matchStatus(it, 'soon')).length,
    leftover: sggCards.filter((it) => matchStatus(it, 'leftover')).length,
  };
  const activeSt = (['open', 'soon', 'leftover'] as const).includes(st as AptStatusKey) && statusCounts[st as AptStatusKey] > 0 ? st : '';
  const cards = activeSt ? sggCards.filter((it) => matchStatus(it, activeSt)) : sggCards;

  // 칩 링크가 지역·시군구 선택을 잃지 않도록 현재 쿼리를 물려준다.
  const baseQuery = [
    region !== '전국' ? `region=${encodeURIComponent(region)}` : '',
    activeSgg ? `sgg=${encodeURIComponent(activeSgg)}` : '',
  ].filter(Boolean).join('&');

  // 관련 블로그는 지금 노출 중인 단지 기준으로 뽑는다 (metadata.apt_id 매핑, s273 규약)
  const visibleIds = [...cards, ...hub.results].map((it) => it.id);
  /* H6-1 「관련 분석」 — 선택 시도의 글을 먼저 본다.
   *
   * ⚠️ 예전엔 지역을 «전혀 보지 않았다». 그래서 부산을 고른 화면의 레일에 서울 글이
   *    올라왔다. A5 가 blog_posts.apt_region 을 만들어 뒀으므로 한 줄로 걸린다.
   * ⚠️ 0건이면 전국으로 되돌아간다 — 빈 패널을 만들지 않는다(Rule #97).
   *    지역 글이 적은 시도(세종 11편)에서 레일이 통째로 비는 것이 더 나쁘다.
   */
  const sbClient = getSupabaseAdmin();
  let relatedBlogs = await getRelatedBlogs(visibleIds);
  if (!showTiles) {
    const { data: regionBlogs, error: rbErr } = await (sbClient as any)
      .from('blog_posts').select('id, slug, title, published_at')
      .eq('is_published', true).eq('apt_region', region)
      .order('published_at', { ascending: false }).limit(6);
    if (rbErr) console.error(`[apt] region blogs ${region}: ${rbErr.message?.slice(0, 160)}`);
    else if ((regionBlogs?.length ?? 0) > 0) {
      relatedBlogs = (regionBlogs as any[]).map((b) => ({
        id: b.id, slug: b.slug, title: b.title, published_at: b.published_at, apt_id: null,
      }));
    }
  }

  // NEW 배지(단계 변경 30일 이내) 기준 시각. 행마다 Date.now() 를 부르면
  //   한 렌더 안에서 기준이 갈린다. 한 번 찍어 내려보낸다.
  /* ══ U-1b 지역 셀렉 ══
     선택은 «코드 배열» 로 URL 에 실린다(?rg=11110,26350). 라벨로 실으면 창원처럼
     한 라벨이 5개 구 코드를 갖는 자리에서 무엇을 고른 건지 URL 이 말하지 못한다.
     ⚠️ 카운트는 집계 RPC 라 캐시(900초)에 얹혀 있다 — 목록 조회를 늘리지 않는다.
     ⚠️ 선택 현장 조회는 «선택이 있을 때만» 돈다. 없으면 Promise 하나로 접는다(Rule #49). */
  const selectedCodes = parseRegionSelection(sp.rg ?? null);
  const [regionCounts, selectedSites] = await Promise.all([
    getRegionCounts(),
    selectedCodes.length ? getSitesForSelection(selectedCodes) : Promise.resolve([]),
  ]);
  const selectedLabels = selectionToPairs(selectedCodes).map((x) => `${x.region} ${x.sigungu}`.trim());
  const selectSummary = selectedLabels.length
    ? `${selectedLabels.slice(0, 2).join(' · ')}${selectedLabels.length > 2 ? ` 외 ${selectedLabels.length - 2}곳` : ''}`
    : '전국 — 지역을 골라 보세요';

  const pipelineNow = Date.now();

  const events = buildSubscriptionEvents(cards);
  const itemList = cards.length > 0 ? buildSubscriptionItemList(cards, hub.region) : null;

  // 큐레이션 3건 — 목록 상단. RPC 에 큐레이션 플래그가 없어(hub.ts:20) 정렬 상위 3건을 쓴다.
  // ⚠️ 이 3건을 아래 목록에서 빼지 않는다. AptHubItem 에 apt_sites 조인 키가 없어
  //    프론트만으로는 판별이 불가능하고, 이름 문자열 매칭 우회는 금지다.
  //    get_apt_subscription_hub 에 플래그가 붙은 뒤에 처리한다 (DB 는 채팅 담당).
  // v5-V5: 큐레이션은 조감도(1순위) 보유분을 앞으로 당긴 뒤 위성으로 채운다.
  //   ⚠️ 우대는 weight 가 같은 동순위 구간 안에서만 준다 — 조감도가 있다고
  //      마감된 현장이 접수중보다 위로 오면 안 된다 (preferHero 참조).
  //   이미지가 아예 없는 현장은 넣지 않는다. 크게 나가므로 이니셜 블록으로 채우지 않는다
  //   ('있는 척' 이 되는 건 큰 이미지 자리다 — 목록 64px 칸과 판단 기준이 다르다).
  //   보유분이 3건에 못 미치면 있는 만큼만 낸다 (없는 자리를 만들지 않는다).
  const curated = pickCuration(cards, 3);
  // 선택 시도 밖은 뺀다. '전국' 이면 그대로 둔다.
  const curatedInRegion = region === '전국' ? curated : curated.filter((it) => it.region_nm === region);

  // v4-C6: 조회 창이 60일보다 넓으면 반드시 밝힌다.
  //   안 밝히면 6개월 전 공고가 오늘 것처럼 보인다.
  const windowLabel =
    hub.window_days >= 365 ? '최근 1년'
    : hub.window_days >= 180 ? '최근 6개월'
    : hub.window_days > 60 ? `최근 ${hub.window_days}일`
    : null;
  // v5-V2: 레일 데이터는 전부 이미 받은 payload 에서 만든다 — 새 조회 0건.
  //   마감 임박 = dday 가 남아 있는 것 중 가까운 순 5건.
  const imminent = [...hub.cards]
    .filter((it) => it.dday !== null && it.dday >= 0 && it.dday <= 14)
    .sort((a, b) => (a.dday ?? 99) - (b.dday ?? 99))
    .slice(0, 5);
  // 지역 칩은 접수중이 있는 곳만. 가나다 고정 (C3 과 같은 원칙).
  const railRegions = hub.regions
    .filter((r) => r.live > 0)
    .map((r) => ({ region: r.region, live: r.live }))
    .sort((a, b) => a.region.localeCompare(b.region, 'ko'));

  /* ── H5-2 단계 요약 줄 ──
     ⚠️ 키는 AptFilterRow 의 AptStatusKey «그대로» 다. 두 벌이 되면 링크의 ?st= 와
        목록 필터가 서로 다른 것을 가리킨다.
     ⚠️ 재개발 수는 pipeline 덩어리에서 «세는» 것이지 지어내지 않는다. */
  const redevCount = blocks.pipeline.filter((x) =>
    ['union_established', 'plan_approved', 'mgmt_approved'].includes(x.lifecycle_stage || ''),
  ).length;
  const stageItems: StageItem[] = [
    { key: 'soon', label: '분양예정', count: statusCounts.soon },
    { key: 'open', label: '분양중', count: statusCounts.open },
    { key: 'leftover', label: '선착순', count: statusCounts.leftover },
    { key: 'redev', label: '재개발', count: redevCount },
  ];
  /* 뒤로가기 행의 숫자.
   *
   * ⚠️ 예전엔 «목록 두 덩어리의 길이 합» 이었다(각 limit 40). 그래서 화면에 「부산 80」이
   *    떴는데 바로 아래 구군 칩 배지 합은 360을 넘었다 — 같은 화면이 두 숫자를 말했다.
   *    두 자리가 «한 조회 결과» 를 쓰게 한다: get_apt_region_counts 의 시도 소계.
   *    그 값이 곧 「전체」 칩 배지이기도 하다.
   */
  const regionSiteCount = sggTotals.reduce((s, x) => s + x.count, 0);

  const stLabel = activeSt === 'open' ? '접수중' : activeSt === 'soon' ? '임박 D-7' : activeSt === 'leftover' ? '무순위' : '';
  const scopeLabel = [activeSgg || hub.region, stLabel].filter(Boolean).join(' · ');
  const cardsMeta = windowLabel
    ? `${scopeLabel} · ${windowLabel} ${cards.length}곳`
    : `${scopeLabel} · 상태 → 마감 임박 순`;

  return (
    <div className="kd-list">
      <div className="kd-list-main">
      <h1 className="sr-only">{hub.region} 아파트 청약 일정 · 경쟁률</h1>

      {/* V4-4 — 서브마스트. 단색 --brand-navy + 하단 골드 2px.
          ⚠️ h1 은 이미 sr-only 였다 — 그대로 둔다. 서브마스트 제목은 heading 이 아니라
             «시각 라벨» 이라 문서의 제목은 여전히 하나뿐이다(증분3 ④).
          ⚠️ 우측 슬롯을 «비웠다». 지시서는 지역 셀렉 트리거를 여기 놓으라고 했지만,
             실물 RegionSelectPanel 의 트리거는 «전폭 버튼» 이다 — 「닫힌 채로도 무엇을
             고른 상태인지 말한다」는 계약을 지키려고 요약 문자열을 통째로 물고 있어서
             칩 슬롯에 들어가지 않는다. 폭을 뺏으면 그 계약이 깨진다.
             재구현·개조 금지(§6)라 손대지 않고 «바로 아래» 그대로 둔다.
          ⚠️ 보조 줄의 정렬 근거는 「모집공고 기준」이다 — 아래 섹션 meta 와 같은 말을 쓴다.
             두 자리가 다른 기준을 말하면 같은 화면이 두 소리를 낸다. */}
      <div className="kd-submast kd-submast--bleed">
        <div className="kd-submast__row">
          <div className="kd-submast__title">부동산</div>
        </div>
        <div className="kd-submast__sub">
          모집공고 기준 최신순 · {regionSiteCount.toLocaleString('ko-KR')}곳
        </div>
      </div>

      {/* 위치 추정은 쿠키가 없을 때만 돈다 — 쿠키가 있으면 쿠키가 이긴다. */}
      {isAutoRegion && <RegionAutoSelect />}

      {/* U-1b 지역 셀렉 — 닫힌 채로도 «무엇을 고른 상태인지» 버튼이 말한다.
          ⚠️ 카운트는 Map 이라 클라이언트로 그대로 못 넘긴다(직렬화 불가) — 객체로 편다. */}
      <RegionSelectPanel
        sidoCounts={Object.fromEntries(regionCounts.bySidoCode)}
        sigunguCounts={Object.fromEntries(regionCounts.bySigunguLabel)}
        nationwide={regionCounts.nationwide}
        initialCodes={selectedCodes}
        summary={selectSummary}
      />

      {/* 선택이 있으면 «그 선택의 결과» 를 먼저 낸다.
          ⛔ 아래 허브 섹션들은 시도 하나(p_region)로 도는 RPC 라 다중 선택을 담지 못한다.
             담는 척하지 않고, 이 섹션이 «선택분» 이라는 것을 제목으로 밝힌다. */}
      {selectedCodes.length > 0 && (
        <section style={{ margin: '0 0 var(--sp-lg)' }}>
          <h2 style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, margin: '0 0 var(--sp-sm)' }}>
            선택한 지역의 분양예정·분양중 현장
            <span style={{ marginLeft: 'var(--sp-sm)', fontSize: 'var(--fs-2xs)', fontWeight: 500, color: 'var(--text-tertiary)' }}>
              {selectedSites.length}곳
            </span>
          </h2>
          {selectedSites.length === 0 ? (
            /* ⚠️ 「없다」와 「못 불러왔다」를 같은 화면으로 만들지 않는다(DS_RULES §2-5). */
            <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
              고른 지역에 분양예정·분양중으로 잡힌 현장이 없습니다. 다른 지역을 골라 보세요.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {selectedSites.map((it) => (
                <li key={it.slug ?? it.name}>
                  <SiteRow
                    item={{
                      slug: it.slug,
                      name: it.display_name || it.name,
                      region: it.region,
                      sigungu: it.sigungu,
                      lifecycle_stage: it.lifecycle_stage,
                      total_units: it.total_units,
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {showTiles ? (
        /* ══ 1단 — 17 시도 타일 ══
           ⚠️ 첫 방문에는 «아무 타일도 강조하지 않는다». 강조는 사용자가 고른 뒤에만 붙는다.
              기본값을 강조하면 「이미 고른 상태」로 보여서 다른 지역을 안 찾는다. */
        <RegionTileGrid items={regionTotals} />
      ) : (
        <>
          {/* 2단이 열린 «모든» 경로에서 쿠키를 남긴다. 타일 클릭만으로는
              `?region=…` 링크로 바로 들어온 사용자가 빠진다. */}
          <RegionCookieSync region={region} />
          {/* ══ 2단 — 뒤로가기 · 구군 칩 · 단계 요약 ══ */}
          <Link href="/apt?region=" scroll={false} className="region-back">
            <span className="region-back__caret" aria-hidden="true">&lsaquo;</span>
            <span>{region}</span>
            <span className="region-back__count">{regionSiteCount.toLocaleString()}</span>
          </Link>

          {sggTotals.length > 1 && (
            <SigunguChips region={region} items={sggTotals} current={sgg} />
          )}

          <StageSummaryStrip items={stageItems} current={activeSt} baseQuery={baseQuery} />
        </>
      )}

      {/* ⛔ H6-2 — 「{지역}에는 최근 1년 청약 공고가 없습니다」 문구를 폐지했다.
           그 판정은 get_apt_subscription_hub 의 «다른 조회» (MIN_CARDS 6 · 접수 예정 기준)에서
           왔는데, 아래 목록 조회는 다른 기준이라 «8월 접수 현장 위에 「공고가 없습니다」»가
           떴다. 실측: 부산 365일 31건 · 60일 4건 → 4 < 6 이라 empty 판정.
           빈 상태는 «목록 조회 결과가 곧 판정» 이다. 두 조회가 서로 다른 말을 하게 두지 않는다.
           「전국 보기」 링크는 목록 바닥 더보기로 옮겼다. */}

      {/* ── H4-4 · [목록 | 지도] 뷰 전환 ──
           지도는 목록의 «대체» 가 아니다. 서버가 렌더한 목록이 그대로 HTML 에 실리고,
           크롤러는 토글을 누르지 않으므로 항상 목록을 본다 — `/apt` 색인이 안 깨진다.
           지도 데이터는 클라이언트가 따로 가져온다 (Rule #49 — 서버 뭉치를 안 늘린다).
           ⚠️ 재개발 레이어는 올리지 않는다 (fc860ea A안). AVAILABLE_LAYERS 주석 참조. */}
      {/* ══ H5-2 2단 목록 — 두 덩어리 ══
          B6(2026-08-28) — 위 덩어리의 「최신」 기준을 «모집공고일» 로 바꿨다.
          announcement_date 가 2,855/2,855 채워졌고 형식도 전부 YYYY-MM-DD 임을 확인한 뒤
          «키와 라벨을 같이» 바꿨다. 한쪽만 바꾸면 화면이 거짓말을 한다. */}
      {!showTiles && (
        <>
          {/* H6-2 2층 — 위 «20건» 은 캐러셀, 21번째부터 42px 텍스트 줄.
              B7-0 ⚠️ 8장이던 것을 20장으로 늘렸다. 부산만 182곳인데 8장에서 끊기니
                 「옆으로 더 볼 것」이 애초에 없었다. 조회는 늘지 않는다 —
                 blocks.opened 는 이미 40건을 들고 있고 렌더만 늘어난다(첫 3장 외 lazy). */}
          <SubscriptionCarousel
            title="최근 청약 공고"
            /* ⛔ 총계를 «못 세면» 개수를 적지 않는다. 캡 값(40)을 적느니 안 적는 편이 참이다. */
            meta={[sgg || region, blockTotals ? `${blockTotals.opened.toLocaleString('ko-KR')}곳` : '', '모집공고 기준'].filter(Boolean).join(' · ')}
            items={blocks.opened.slice(0, 20)}
            tailHref="#apt-more"
            tailLabel={blockTotals ? `전체 ${blockTotals.opened.toLocaleString('ko-KR')}곳 보기` : '전체 보기'}
          />
          <RegionBlockList
            anchorId="apt-more"
            items={blocks.opened.slice(20)}
            title="그 밖의 공고"
            /* ⚠️ 「20곳」이라 적고 있었는데 그 20은 «40(캡) − 20» 이다. 캡에서 나온 숫자를
                  또 실측인 척 적은 것이다(B7-0 에서 고친 것과 같은 종류).
                  여기가 목록의 «몇 번째부터 몇 번째인지» 를 말하는 것이 참이다. */
            meta={
              blocks.opened.length > 20 && blockTotals
                ? `21–${Math.min(blocks.opened.length, blockTotals.opened).toLocaleString('ko-KR')} / 전체 ${blockTotals.opened.toLocaleString('ko-KR')}곳`
                : ''
            }
            moreHref="/apt/archive"
            moreLabel="지난 공고 더 보기"
            emptyNote=""
          />
          <RegionBlockList
            items={blocks.pipeline}
            title="곧 나올 현장"
            meta={[blockTotals ? `${blockTotals.pipeline.toLocaleString('ko-KR')}곳` : '', '단계 갱신 최신순'].filter(Boolean).join(' · ')}
            emptyNote={`${sgg || region}에는 공고 전 단계의 현장이 없습니다.`}
          />
        </>
      )}

      <AptViewSwitch>
      {/* ③ 청약 카드 리스트 */}
      <section style={{ padding: '0 var(--sp-sm)' }} aria-labelledby="apt-cards-heading">
        <SectionHeader
          id="apt-cards-heading"
          eyebrow="FEATURED — 분양중"
          title="청약"
          meta={cardsMeta}
        />

        {cards.length > 0 ? (
          <div>
            <div className="kd-lhead" aria-hidden="true">
              <span>상태</span>
              <span>단지</span>
              <span>규모</span>
            </div>
            {cards.map((it) => (
              <SubscriptionCard key={it.id} item={it} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="🏗️"
            title="지금 접수중인 청약이 없습니다"
            description="새 공고가 뜨면 이 자리에 바로 올라옵니다. 위 도구로 미리 가점을 확인해 두세요."
            cta={{ label: '청약 가점 계산기 열기', href: '/apt/diagnose' }}
          />
        )}
      </section>

      {/* ③-2 · V13 A-1 공고 전 현장.
           청약 목록 바로 다음 자리다 — "지금 접수중" 을 다 본 사람이 다음으로 묻는 게
           "그럼 아직 공고 안 난 데는?" 이다.
           ⚠️ 데이터가 없으면 섹션을 통째로 렌더하지 않는다. 빈 껍데기를 만들지 않는다. */}
      {pipeline.items.length > 0 && (
        <section style={{ padding: '0 var(--sp-sm)' }} aria-labelledby="apt-pipeline-heading">
          <SectionHeader
            id="apt-pipeline-heading"
            eyebrow="PIPELINE — 공고 전"
            title="공고 전 현장"
            meta={metaLine(`${regionLabel(pipeline.region)} ${pipeline.total.toLocaleString('ko-KR')}곳`.trim(), '진행 단계순')}
          />

          <div>
            <div className="kd-lhead" aria-hidden="true">
              <span />
              <span>현장</span>
              <span>규모</span>
            </div>
            {pipeline.items.map((it) => (
              <PipelineCard key={it.id} item={it} now={pipelineNow} />
            ))}
          </div>

          <SectionLink href={`/apt/pipeline?region=${encodeURIComponent(pipeline.region)}`}>
            공고 전 현장 전체 보기
          </SectionLink>
        </section>
      )}

      {/* ③-3 · H4-4 §5 기축 실거래.
           「공고 전 현장」 다음 자리다 — 분양 라인을 다 본 사람이 다음으로 보는 게
           «이미 지어진 단지가 얼마에 거래되는가» 다. PV 의 61%가 기축인데 /apt 에 자리가 없었다.

           ⚠️ **「시세」 섹션이 아니다.** 단지 «전체» 평균가와 그 변동률을 쓰지 않는다 —
              평형 구성이 바뀌면 가격 변동으로 위장된다(실측 부호 반전 23.9%).
              가격은 «최다 거래 평형 하나로 고정했을 때만» 내고, 표본이 모자라면 비운다.
              실측상 가격이 붙는 건 연결된 기축의 54%뿐이고, 나머지는 그게 정상이다.
           ⚠️ 데이터가 없으면 섹션을 통째로 렌더하지 않는다. */}
      {gichuk.length > 0 && (
        <section style={{ padding: '0 var(--sp-sm)' }} aria-labelledby="apt-gichuk-heading">
          <SectionHeader
            id="apt-gichuk-heading"
            eyebrow="GICHUK — 기축 실거래"
            title="최근 거래된 기축 단지"
            meta={metaLine(regionLabel(pipeline.region), '최근 180일', '거래 많은 순')}
          />
          <GichukActivity items={gichuk} />
          <p
            style={{
              margin: 'var(--sp-xs) 2px 0',
              fontSize: 'var(--fs-xs)',
              fontWeight: 400,
              letterSpacing: 0,
              color: 'var(--text-tertiary)',
              lineHeight: 1.45,
            }}
          >
            국토부 실거래 신고 기준. 가격은 그 단지에서 «가장 많이 거래된 평형» 하나를 고정해 낸
            평균입니다. 단지 전체 평균가는 평형 구성이 바뀌면 같이 움직여 시세로 읽을 수 없어 쓰지 않습니다.
          </p>
        </section>
      )}

      </AptViewSwitch>

      {/* ④ 이번 주 청약 결과 */}
      <SubscriptionResults items={hub.results} />

      {/* v5-V3: 지난 공고 진입점. 허브는 최근(60/180/365)만 보여주므로
           이 링크가 없으면 그 이전 2,842건을 아무도 찾지 못한다. */}
      <div style={{ padding: '0 var(--sp-sm)', margin: '0 0 var(--sp-md)' }}>
        <Link
          href={region !== '전국' ? `/apt/archive?region=${encodeURIComponent(region)}` : '/apt/archive'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--sp-sm)',
            minHeight: 'var(--touch-min)',
            padding: '0 var(--sp-lg)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            textDecoration: 'none',
          }}
        >
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
              지난 공고 더보기
            </span>
            <span style={{ display: 'block', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 1 }}>
              마감된 청약의 경쟁률·가점컷을 연도별로
            </span>
          </span>
          <span aria-hidden style={{ flexShrink: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>→</span>
        </Link>
      </div>

      {/* ── H4-4 재배치 · 아래 네 블록은 «내린 것이지 지운 것이 아니다» ──
           첫 화면을 제어 UI 가 다 먹고 현장이 스크롤 3~4번 뒤에 있었다.
           청약·공고 전·기축을 위로 올리고 이 넷을 그 아래로 옮겼다. 링크·라우트·조회 전부 그대로다. */}
      {/* ① 청약 타임라인 히어로 */}
      <SubscriptionTimeline items={hub.timeline} region={hub.region} />

      {/* ①-2 · V16 E-3 이번 주 움직인 현장.
           히어로 바로 다음 = 콘텐츠 스택의 맨 위다. 여기가 비면 아무것도 그리지 않는다 —
           "움직인 현장 없음" 을 내지 않는다. */}
      <RecentMovesStrip items={recentMoves} region={pipeline.region} now={pipelineNow} />

      {/* ②-2 큐레이션 3건.
          ⚠️ H6-2 — 선택 시도 밖의 현장은 «내지 않는다». 부산을 고른 화면 최상단에
             「청약 D-4 · 인천」이 떠 있었다 — 지역을 고른 의미가 사라진다.
             0건이면 미렌더한다. 전국으로 «바꾸지 않는다». */}
      {curatedInRegion.length > 0 && (
        <div style={{ padding: '0 var(--sp-sm)' }}>
          <CurationCarousel
            title={`${hub.region} 지금 주목할 청약`}
            items={curatedInRegion.map((it) => (
              <AptCurationCard key={it.id} item={it} today={hub.today} />
            ))}
          />
        </div>
      )}

      {/* §I-3 도구 칩. 7개가 첫 화면 절반을 먹어 청약 타임라인·현장 목록보다 위에 있었다.
           `지금 주목할 청약` 아래로 내린다 — **위치만**. 링크·라우트는 그대로다. */}
      <AptToolChips region={hub.region} />

      {/* ⑤ 관련 블로그 분석 */}
      <AptRelatedBlogs posts={relatedBlogs} />

      {/* SEO: 접수중/예정 단지 Event + ItemList */}
      {events.map((ev, i) => (
        <script
          key={`apt-event-${i}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ev) }}
        />
      ))}
      {itemList ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
        />
      ) : null}
      </div>

      {/* v5-V2 · 데스크탑 우측 레일 (≥1024px). 전역 RightPanel 대체 —
           레일은 페이지가 소유한다 (/apt/[id] 의 SiteDetailRail 과 같은 패턴).
           ①마감 임박 ②지역 바로가기 ③관련 분석 ④바로가기. 새 조회 0건. */}
      <aside className="kd-list-rail" aria-label="청약 요약">
        <div className="kd-rail-sticky">
        <AptHubRail
          region={hub.region}
          imminent={imminent}
          regions={railRegions}
          blogs={relatedBlogs}
        />
        </div>
      </aside>
    </div>
  );
}
