// s273 — /apt 청약 퍼스트 재설계.
//
// 구성: ① SubscriptionTimeline 히어로 ② 도구칩 4종 ③ 청약 카드 리스트
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
import { getAptHub } from '@/lib/apt/hub';
import { getRelatedBlogs } from '@/lib/apt/related-blogs';
import { buildSubscriptionEvents, buildSubscriptionItemList } from '@/lib/apt/subscription-schema';
import RegionAutoSelect from '@/components/apt/RegionAutoSelect';
import SubscriptionTimeline from '@/components/apt/SubscriptionTimeline';
import SubscriptionCard from '@/components/apt/SubscriptionCard';
import SubscriptionResults from '@/components/apt/SubscriptionResults';
import AptToolChips from '@/components/apt/AptToolChips';
import AptRelatedBlogs from '@/components/apt/AptRelatedBlogs';
import SectionHeader from '@/components/apt/SectionHeader';
import CurationCarousel from '@/components/ui/CurationCarousel';
import SigunguChips from '@/components/apt/SigunguChips';
import AptFilterRow, { type AptStatusKey } from '@/components/apt/AptFilterRow';
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
import { fetchGichukActivity } from '@/lib/apt/gichuk-activity';
import RecentMovesStrip from '@/components/apt/RecentMovesStrip';
import { SectionLink } from '@/components/apt/SectionHeader';

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
  searchParams?: Promise<{ region?: string; sgg?: string; st?: string }>;
}) {
  const sp = (await searchParams) || {};
  const region = sp.region?.trim() || '전국';
  const sgg = sp.sgg?.trim() || '';
  const st = sp.st?.trim() || '';
  const isAutoRegion = !sp.region;

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
  const relatedBlogs = await getRelatedBlogs(visibleIds);

  // NEW 배지(단계 변경 30일 이내) 기준 시각. 행마다 Date.now() 를 부르면
  //   한 렌더 안에서 기준이 갈린다. 한 번 찍어 내려보낸다.
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

  const stLabel = activeSt === 'open' ? '접수중' : activeSt === 'soon' ? '임박 D-7' : activeSt === 'leftover' ? '무순위' : '';
  const scopeLabel = [activeSgg || hub.region, stLabel].filter(Boolean).join(' · ');
  const cardsMeta = windowLabel
    ? `${scopeLabel} · ${windowLabel} ${cards.length}곳`
    : `${scopeLabel} · 상태 → 마감 임박 순`;

  return (
    <div className="kd-list">
      <div className="kd-list-main">
      <h1 className="sr-only">{hub.region} 아파트 청약 일정 · 경쟁률</h1>

      {isAutoRegion && <RegionAutoSelect />}

      {/* §I-2 지역·상태를 한 줄로. 이전에는 헤더 줄 + 지역 줄 + 상태 줄로 세로를 셋이 먹었다. */}
      <AptFilterRow
        regions={hub.regions}
        currentRegion={hub.region}
        counts={statusCounts}
        total={sggCards.length}
        currentStatus={activeSt}
        baseQuery={baseQuery}
      />

      {/* v4-C8: 시·도 아래 2단. 정렬은 C3 과 같이 가나다 고정. */}
      {sggItems.length > 0 && (
        <SigunguChips region={hub.region} items={sggItems} current={activeSgg} />
      )}

      {/* v4-C6: 지역을 버리고 전국으로 갈아타던 폴백이 없어졌다.
           17개 시·도 중 11곳이 접수중 0건이라 그 폴백은 사실상 상시 발동 중이었고,
           사용자는 부산을 눌렀는데 전국 목록을 보고 있었다.
           이제 조회 창을 60 → 180 → 365 로 넓히고, 그래도 없으면 비었다고 말한다. */}
      {hub.region_empty ? (
        <p
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            margin: '0 6px 12px',
            padding: '9px 10px',
            borderRadius: 6,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            fontSize: 'var(--fs-xs)',
            color: 'var(--text-secondary)',
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            {hub.requested_region}에는 최근 1년 청약 공고가 없습니다
          </span>
          {/* 자동 전환이 아니라 링크다 — 고른 지역을 말없이 바꾸지 않는다 */}
          <Link
            href="/apt"
            scroll={false}
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 32,
              padding: '0 12px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--brand)',
              color: '#FFFFFF',
              fontSize: 'var(--fs-xs)',
              fontWeight: 500,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            전국 보기
          </Link>
        </p>
      ) : null}

      {/* ① 청약 타임라인 히어로 */}
      <SubscriptionTimeline items={hub.timeline} region={hub.region} />

      {/* ①-2 · V16 E-3 이번 주 움직인 현장.
           히어로 바로 다음 = 콘텐츠 스택의 맨 위다. 여기가 비면 아무것도 그리지 않는다 —
           "움직인 현장 없음" 을 내지 않는다. */}
      <RecentMovesStrip items={recentMoves} region={pipeline.region} now={pipelineNow} />

      {/* ②-2 큐레이션 3건 */}
      {curated.length > 0 && (
        <div style={{ padding: '0 6px' }}>
          <CurationCarousel
            title={`${hub.region} 지금 주목할 청약`}
            items={curated.map((it) => (
              <AptCurationCard key={it.id} item={it} today={hub.today} />
            ))}
          />
        </div>
      )}

      {/* §I-3 도구 칩. 7개가 첫 화면 절반을 먹어 청약 타임라인·현장 목록보다 위에 있었다.
           `지금 주목할 청약` 아래로 내린다 — **위치만**. 링크·라우트는 그대로다. */}
      <AptToolChips region={hub.region} />

      {/* ③ 청약 카드 리스트 */}
      <section style={{ padding: '0 6px' }} aria-labelledby="apt-cards-heading">
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
        <section style={{ padding: '0 6px' }} aria-labelledby="apt-pipeline-heading">
          <SectionHeader
            id="apt-pipeline-heading"
            eyebrow="PIPELINE — 공고 전"
            title="공고 전 현장"
            meta={`${pipeline.region} ${pipeline.total.toLocaleString('ko-KR')}곳 · 진행 단계순`}
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
        <section style={{ padding: '0 6px' }} aria-labelledby="apt-gichuk-heading">
          <SectionHeader
            id="apt-gichuk-heading"
            eyebrow="GICHUK — 기축 실거래"
            title="최근 거래된 기축 단지"
            meta={`${pipeline.region} · 최근 180일 · 거래 많은 순`}
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

      {/* ④ 이번 주 청약 결과 */}
      <SubscriptionResults items={hub.results} />

      {/* v5-V3: 지난 공고 진입점. 허브는 최근(60/180/365)만 보여주므로
           이 링크가 없으면 그 이전 2,842건을 아무도 찾지 못한다. */}
      <div style={{ padding: '0 6px', margin: '0 0 var(--sp-md)' }}>
        <Link
          href={region !== '전국' ? `/apt/archive?region=${encodeURIComponent(region)}` : '/apt/archive'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            minHeight: 48,
            padding: '0 14px',
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
        <AptHubRail
          region={hub.region}
          imminent={imminent}
          regions={railRegions}
          blogs={relatedBlogs}
        />
      </aside>
    </div>
  );
}
