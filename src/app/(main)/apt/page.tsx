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
// Legacy: src/_legacy/s269/apt_page_v0.tsx

import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/constants';
import { getAptHub } from '@/lib/apt/hub';
import { getRelatedBlogs } from '@/lib/apt/related-blogs';
import { buildSubscriptionEvents, buildSubscriptionItemList } from '@/lib/apt/subscription-schema';
import RegionAutoSelect from '@/components/apt/RegionAutoSelect';
import RegionChips from '@/components/apt/RegionChips';
import SubscriptionTimeline from '@/components/apt/SubscriptionTimeline';
import SubscriptionCard from '@/components/apt/SubscriptionCard';
import SubscriptionResults from '@/components/apt/SubscriptionResults';
import AptToolChips from '@/components/apt/AptToolChips';
import AptRelatedBlogs from '@/components/apt/AptRelatedBlogs';
import SectionHeader from '@/components/apt/SectionHeader';
import CurationCarousel from '@/components/ui/CurationCarousel';
import AptCurationCard from '@/components/apt/AptCurationCard';
import EmptyState from '@/components/ui/EmptyState';

// Next 는 segment config 를 정적 분석하므로 리터럴이어야 한다 (import 식별자 불가).
// lib/apt/hub.ts 의 APT_HUB_REVALIDATE_SECONDS 와 같은 값으로 유지할 것.
export const revalidate = 900;
export const maxDuration = 15;

const BASE_TITLE = '전국 아파트 청약 일정·경쟁률 — 오늘의 접수중 단지';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const regionLabel = sp.region?.trim() || '전국';
  const title = sp.region
    ? `${regionLabel} 아파트 청약 일정·경쟁률 — 오늘의 접수중 단지`
    : BASE_TITLE;
  const description =
    `${regionLabel} 아파트 청약 접수 일정과 경쟁률을 한 화면에. ` +
    '접수중·접수임박 단지를 D-day 순으로 정리하고, 마감된 단지는 1순위 경쟁률과 가점컷까지 확인하세요.';

  return {
    title,
    description,
    alternates: {
      canonical: sp.region
        ? `${SITE_URL}/apt?region=${encodeURIComponent(sp.region)}`
        : `${SITE_URL}/apt`,
    },
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
  searchParams?: Promise<{ region?: string }>;
}) {
  const sp = (await searchParams) || {};
  const region = sp.region?.trim() || '전국';
  const isAutoRegion = !sp.region;

  const hub = await getAptHub(region);

  // 관련 블로그는 지금 노출 중인 단지 기준으로 뽑는다 (metadata.apt_id 매핑, s273 규약)
  const visibleIds = [...hub.cards, ...hub.results].map((it) => it.id);
  const relatedBlogs = await getRelatedBlogs(visibleIds);

  const events = buildSubscriptionEvents(hub.cards);
  const itemList = hub.cards.length > 0 ? buildSubscriptionItemList(hub.cards, hub.region) : null;

  // 큐레이션 3건 — 목록 상단. RPC 에 큐레이션 플래그가 없어(hub.ts:20) 정렬 상위 3건을 쓴다.
  // ⚠️ 이 3건을 아래 목록에서 빼지 않는다. AptHubItem 에 apt_sites 조인 키가 없어
  //    프론트만으로는 판별이 불가능하고, 이름 문자열 매칭 우회는 금지다.
  //    get_apt_subscription_hub 에 플래그가 붙은 뒤에 처리한다 (DB 는 채팅 담당).
  const curated = hub.cards.slice(0, 3);

  return (
    <div className="kd-list">
      <div className="kd-list-main">
      <h1 className="sr-only">{hub.region} 아파트 청약 일정 · 경쟁률</h1>

      {isAutoRegion && <RegionAutoSelect />}

      {/* 지역 선택 — 인라인 칩. 페이지 이동 없이 목록만 갱신된다. */}
      <RegionChips regions={hub.regions} current={hub.region} />

      {hub.region_fallback ? (
        <p
          style={{
            margin: '0 6px 12px',
            padding: '7px 10px',
            borderRadius: 6,
            background: 'var(--bg-elevated, #f9fafb)',
            border: '1px solid var(--border, #1e3258)',
            fontSize: 11.5,
            color: 'var(--text-secondary, #6b7280)',
          }}
        >
          {hub.requested_region}에 진행 예정인 청약이 없어 전국 일정을 보여드립니다.
        </p>
      ) : null}

      {/* ① 청약 타임라인 히어로 */}
      <SubscriptionTimeline items={hub.timeline} region={hub.region} />

      {/* ② 도구 칩 — 데이터가 0건인 날에도 항상 노출. 재개발 칩은 현재 지역을 따라간다. */}
      <AptToolChips region={hub.region} />

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

      {/* ③ 청약 카드 리스트 */}
      <section style={{ padding: '0 6px' }} aria-labelledby="apt-cards-heading">
        <SectionHeader
          id="apt-cards-heading"
          eyebrow="FEATURED — 분양중"
          title="청약"
          meta="상태 → 마감 임박 순"
        />

        {hub.cards.length > 0 ? (
          <div>
            <div className="kd-lhead" aria-hidden="true">
              <span>상태</span>
              <span>단지</span>
              <span>규모</span>
            </div>
            {hub.cards.map((it) => (
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

      {/* ④ 이번 주 청약 결과 */}
      <SubscriptionResults items={hub.results} />

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

      {/* v3 커밋5 · 데스크탑 우측 레일 (≥1024px). '관련 분석' 패널은 모바일에서
           하단 탭·본문 블록과 중복이라 레일 안에만 둔다. */}
      <aside className="kd-list-rail" aria-label="청약 요약">
        {relatedBlogs.length > 0 && (
          <div className="kd-rail-panel">
            <h2>관련 분석</h2>
            {relatedBlogs.slice(0, 6).map((b: { slug: string; title: string }) => (
              <Link key={b.slug} href={`/blog/${b.slug}`}>{b.title}</Link>
            ))}
          </div>
        )}
        <div className="kd-rail-panel">
          <h2>바로가기</h2>
          <Link href="/apt/diagnose">청약 가점 계산기</Link>
          <Link href="/apt/ranking">청약 경쟁률 랭킹</Link>
          <Link href="/apt/unsold">미분양 현황</Link>
          <Link href="/apt/map">분양 지도</Link>
          <Link href="/apt/complex">단지 백과</Link>
        </div>
      </aside>
    </div>
  );
}
