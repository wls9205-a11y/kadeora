/* /apt/unsold/[id]
 *
 * 두 얼굴을 한 라우트가 쓴다.
 *
 *   ① 시도명(`/apt/unsold/부산`)  — NV-2 지역 미분양 허브. 사람이 검색창에 치는 말이다.
 *   ② 숫자 id(`/apt/unsold/1234`) — 옛 상세 주소. 예전처럼 308 로 현장 상세에 넘긴다.
 *
 * ⚠️ 왜 `[region]` 을 새로 파지 않았나. 이 자리에는 이미 `[id]` 가 있다 — Next 는 같은 깊이에
 *    슬러그 이름을 둘 두지 못한다(빌드가 죽는다). 지시서가 요구한 «주소» 는 /apt/unsold/{시도}
 *    이고 그 주소는 이 파일로 그대로 낼 수 있다. 갈림은 REGIONS 정확일치 하나뿐이고,
 *    시도명은 Number() 로 NaN 이라 옛 경로와 겹치지 않는다.
 * ⚠️ 가드는 REGIONS «상수 자체» 를 본다(지역 목록을 여기에 다시 적지 않는다 — Rule #67).
 */
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { generateAptSlug } from '@/lib/apt-slug';
import { applySort } from '@/lib/apt/card-sort';
import { AptCardGrid } from '@/components/apt/AptCardCompact';
import { REGIONS } from '@/lib/regions';
import { SITE_URL } from '@/lib/constants';

interface Props { params: Promise<{ id: string }> }

/* ⛔ 이 라우트를 «정적으로 굽지 않는다» — generateStaticParams·revalidate 를 두지 않는다.
 *
 *    2026-09-03 실측: 정적 렌더로 돌리자 옛 숫자 id 의 permanentRedirect 가 서버 308 이 아니라
 *    «meta refresh + 200» 으로 나갔다(/apt/unsold/20 → content="0;url=/apt/경산-상방공원…").
 *    소프트 리다이렉트는 색인 이전 신호가 아니다 — 옛 주소가 들고 있던 것을 잃는다.
 *    지역 허브의 조회 비용은 아래 unstable_cache(1시간) 가 맡는다. 캐시는 페이지가 아니라
 *    «조회» 에 건다. */

const isRegion = (v: string): boolean => (REGIONS as readonly string[]).includes(v);

/**
 * 지역 미분양 목록.
 *
 * ⚠️ 시도 축은 `region_nm` 이다. 뷰의 `region` 은 «시군구·동»(‘해운대구’·‘장전동’) 이라
 *    거기에 시도를 물리면 17개 화면이 전부 0건이 된다 — 실측 2026-09-03 으로 확인했다.
 * ⛔ 못 읽은 것과 없는 것을 같은 값으로 돌려주지 않는다. 실패는 null 이다.
 */
async function fetchUnsoldUncached(region: string): Promise<any[] | null> {
  try {
    const sb = getSupabaseAdmin();
    let q = (sb as any).from('v_apt_card_unsold').select('*').eq('region_nm', region).limit(60);
    q = applySort(q, 'newest');
    const { data, error } = await q;
    if (error) {
      console.error(`[apt/unsold/${region}] ${String(error.message ?? error).slice(0, 200)}`);
      return null;
    }
    return (data ?? []) as any[];
  } catch (e: any) {
    console.error(`[apt/unsold/${region}] caught: ${e?.message ?? String(e)}`);
    return null;
  }
}

const fetchUnsoldCached = unstable_cache(fetchUnsoldUncached, ['apt-unsold-region'], {
  revalidate: 3600,
  tags: ['apt-hub'],
});

/**
 * ⚠️ 실패(null)를 «한 시간 굳히지» 않는다. 캐시가 null 을 돌려주면 한 번 더 직접 친다 —
 *    getAptHub 이 s269c 회귀(빈 페이지 영구화, Rule #66) 뒤에 쓰는 것과 같은 형태다.
 * ⚠️ 바깥의 cache() 는 «한 요청 안» 중복 호출(generateMetadata + 본문)을 접는다.
 */
const fetchRegionUnsold = cache(async (region: string): Promise<any[] | null> => {
  const hit = await fetchUnsoldCached(region);
  if (hit !== null) return hit;
  return fetchUnsoldUncached(region);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  // 숫자 id 는 308 로 나간다 — 메타데이터는 읽히지 않는다.
  if (!isRegion(decoded)) return {};

  const rows = await fetchRegionUnsold(decoded);
  /* 색인 분기. 목록이 있으면 색인, 없거나 «못 셌으면» noindex(follow 는 남긴다).
     ⛔ 빈 화면을 색인에 올리지 않는다. 못 읽은 화면은 더더욱. */
  const listed = (rows?.length ?? 0) > 0;
  const year = new Date().getFullYear();
  const url = `${SITE_URL}/apt/unsold/${encodeURIComponent(decoded)}`;
  return {
    title: `${decoded} 미분양 아파트·줍줍(무순위) — 분양가·잔여세대 (${year})`,
    description: `${decoded} 미분양·선착순 분양 아파트를 분양가·잔여세대와 함께 확인하세요. 무순위(줍줍) 물량과 지역별 현황을 카더라가 매일 갱신합니다.`,
    alternates: { canonical: url },
    robots: listed
      ? { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const }
      : { index: false, follow: true },
    openGraph: {
      title: `${decoded} 미분양 아파트·줍줍 (${year})`,
      description: `${decoded} 미분양·선착순 물량을 분양가·잔여세대와 함께`,
      url,
      siteName: '카더라',
      locale: 'ko_KR',
      type: 'website',
      images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent(decoded + ' 미분양 아파트')}&category=apt&design=2`, width: 1200, height: 630, alt: `${decoded} 미분양 아파트` }],
    },
  };
}

/** 다른 시도로 건너가는 줄 — 경로형 주소만 쓴다(쿼리형과 섞지 않는다). */
function RegionSwitch({ current }: { current: string }) {
  return (
    <nav aria-label="시도별 미분양" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 18 }}>
      {REGIONS.filter((r) => r !== current).map((r) => (
        <Link
          key={r}
          href={`/apt/unsold/${encodeURIComponent(r)}`}
          style={{
            padding: '6px 11px', fontSize: 12, fontWeight: 600, textDecoration: 'none',
            color: 'var(--text-secondary)', background: 'var(--bg-surface)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-pill, 999px)',
          }}
        >
          {r}
        </Link>
      ))}
    </nav>
  );
}

async function RegionUnsold({ region }: { region: string }) {
  const rows = await fetchRegionUnsold(region);
  const cards = rows ?? [];

  return (
    <div className="space-y-4">
      <div>
        <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>
          <Link href="/apt" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>부동산</Link>
          <span>›</span>
          <Link href="/apt/unsold" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>미분양</Link>
          <span>›</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{region}</span>
        </nav>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 600, color: 'var(--text-primary)' }}>
          {region} 미분양 아파트·줍줍
        </h1>
        {/* 조건부는 조건부 — 못 읽은 화면에 「0건」을 적지 않는다. */}
        {rows !== null && (
          <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
            {region} 미분양·선착순 {cards.length}건 · 분양가·잔여세대 기준 최신순
          </p>
        )}
      </div>

      {rows === null ? (
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
          지금 목록을 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.
        </p>
      ) : cards.length === 0 ? (
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          지금 {region}에 등록된 미분양·선착순 현장이 없습니다.{' '}
          <Link href={`/apt/region/${encodeURIComponent(region)}`} style={{ color: 'var(--brand)', fontWeight: 600 }}>
            {region} 아파트 분양·청약 일정
          </Link>
          에서 진행 중인 현장을 확인해 보세요.
        </p>
      ) : (
        <AptCardGrid cards={cards as any} category="unsold" />
      )}

      <RegionSwitch current={region} />
    </div>
  );
}

export default async function UnsoldIdPage({ params }: Props) {
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  if (isRegion(decoded)) return <RegionUnsold region={decoded} />;

  // ── 옛 상세 주소 — 예전 동작 그대로 308 ──
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('unsold_apts').select('house_nm').eq('id', Number(id)).maybeSingle();
  if (!data?.house_nm) notFound();
  const slug = generateAptSlug(data.house_nm);
  if (slug) permanentRedirect(`/apt/${encodeURIComponent(slug)}`);
  notFound();
}
