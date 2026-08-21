// s273c — /apt/region 지역 선택 전체 목록.
//
// 이전 문제:
//  1) 시·도마다 이모지를 달았는데 식별에 도움이 안 됐다. 🌳충북 vs 🌲전남, 🍎경북,
//     🌅경남 — 이모지로 지역을 구분할 수 있는 사람은 없다. 장식이 정보 자리를 먹고 있었다.
//  2) 건수가 없어서 빈 지역을 고르고 나서야 허탕인 걸 알았다. 2026-08-06 기준
//     17개 시·도 중 접수중 물량이 있는 곳은 3곳뿐이다.
//  3) 지금 보고 있는 지역이 어디인지 표시가 없었다.
//  4) 글쓰기 FAB 이 마지막 줄 카드를 가렸다.
//
// 지금: 이모지를 빼고 그 자리에 건수를 넣는다. '접수중' / '그 외' 두 그룹으로 갈라
// 볼 게 있는 지역을 먼저 보여준다. /apt 의 RegionChips 와 같은 데이터·같은 정렬이라
// 두 화면이 어긋나지 않는다.

import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/constants';
import { getAptHub } from '@/lib/apt/hub';
import { KR_REGIONS_17 } from '@/lib/region-storage';

// /apt 와 동일한 캐시 키('전국')를 공유한다 — 대부분 캐시 히트라 추가 DB 비용이 없다.
export const revalidate = 900;
export const maxDuration = 15;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '지역별 아파트 청약 — 17개 시·도 접수중 단지',
    description:
      '서울·경기·부산 등 17개 시·도별 아파트 청약 접수중 단지 수를 한눈에. 지금 청약이 열려 있는 지역만 골라 보세요.',
    // ?region= 은 표시 상태일 뿐이라 canonical 은 항상 고정
    alternates: { canonical: `${SITE_URL}/apt/region` },
    openGraph: {
      title: '지역별 아파트 청약 — 카더라',
      description: '17개 시·도별 접수중 청약 단지 수',
      url: `${SITE_URL}/apt/region`,
      siteName: '카더라',
      locale: 'ko_KR',
      type: 'website',
    },
  };
}

type Row = { region: string; live: number; recent: number };

function RegionCard({
  name,
  live,
  recent,
  current,
  href,
}: {
  name: string;
  live: number;
  recent: number;
  current: boolean;
  href: string;
}) {
  const hasLive = live > 0;
  return (
    <Link
      href={href}
      aria-current={current ? 'true' : undefined}
      aria-label={
        hasLive ? `${name} 접수중 ${live}건` : recent > 0 ? `${name} 최근 ${recent}건` : `${name} 청약 없음`
      }
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        minHeight: 66,
        padding: '12px 8px',
        borderRadius: 12,
        textDecoration: 'none',
        border: current ? '2px solid var(--text-primary)' : '1px solid var(--border)',
        background: current ? 'var(--text-primary)' : 'var(--bg-surface)',
        color: current ? 'var(--bg-base)' : 'var(--text-primary)',
      }}
    >
      <span style={{ fontSize: 13.5, fontWeight: 700 }}>{name}</span>
      {hasLive ? (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: current ? 'var(--bg-base)' : 'var(--accent-red)',
            opacity: current ? 0.8 : 1,
          }}
        >
          접수중 {live}
        </span>
      ) : recent > 0 ? (
        <span
          style={{
            fontSize: 10.5,
            color: current ? 'var(--bg-base)' : 'var(--text-tertiary)',
            opacity: current ? 0.7 : 1,
          }}
        >
          최근 {recent}
        </span>
      ) : (
        <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>—</span>
      )}
    </Link>
  );
}

export default async function RegionListPage({
  searchParams,
}: {
  searchParams?: Promise<{ region?: string }>;
}) {
  const sp = (await searchParams) || {};
  const current = sp.region?.trim() || '전국';

  const hub = await getAptHub('전국');

  const byName = new Map(hub.regions.map((r) => [r.region, r]));
  const rows: Row[] = KR_REGIONS_17.map(
    (name) => byName.get(name) ?? { region: name, live: 0, recent: 0 },
  );

  const sortFn = (a: Row, b: Row) =>
    b.live - a.live || b.recent - a.recent || a.region.localeCompare(b.region, 'ko');

  const openRegions = rows.filter((r) => r.live > 0).sort(sortFn);
  const restRegions = rows.filter((r) => r.live === 0).sort(sortFn);
  const liveTotal = rows.reduce((s, r) => s + r.live, 0);

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
  };

  return (
    // paddingBottom: 글쓰기 FAB 이 마지막 줄을 가리던 문제 — 레이아웃의 72px 위에 더 얹는다
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px var(--sp-lg) 88px' }}>
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-primary)' }}>
        지역 선택
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
        {liveTotal > 0
          ? `전국 17개 시·도 중 ${openRegions.length}곳에서 청약 ${liveTotal}건 접수중`
          : '지금 접수중인 청약이 없습니다. 곧 열리는 지역을 확인해 보세요.'}
      </p>

      <div style={{ ...gridStyle, marginBottom: openRegions.length > 0 ? 22 : 16 }}>
        <RegionCard
          name="전국"
          live={liveTotal}
          recent={0}
          current={current === '전국'}
          href="/apt"
        />
      </div>

      {openRegions.length > 0 ? (
        <section style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>
            접수중인 지역
          </h2>
          <div style={gridStyle}>
            {openRegions.map((r) => (
              <RegionCard
                key={r.region}
                name={r.region}
                live={r.live}
                recent={r.recent}
                current={current === r.region}
                href={`/apt?region=${encodeURIComponent(r.region)}`}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
          그 외 지역
        </h2>
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 8px' }}>
          접수중인 청약은 없지만 최근 60일 내 공고가 있던 지역이 앞에 옵니다
        </p>
        <div style={gridStyle}>
          {restRegions.map((r) => (
            <RegionCard
              key={r.region}
              name={r.region}
              live={0}
              recent={r.recent}
              current={current === r.region}
              href={`/apt?region=${encodeURIComponent(r.region)}`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
