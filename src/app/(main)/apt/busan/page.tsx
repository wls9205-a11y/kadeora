// s3 — /apt/busan 부산 큐레이션 허브.
//
// /apt/region/[region] 과 다른 페이지다. 그쪽은 전 지역 자동 허브이고,
// 이 라우트는 사람이 고른 현장(apt_sites.is_curated)만 싣는 큐레이션 전용이다.
// generateStaticParams 를 쓰지 않는 단일 라우트라 Rule #64 대상이 아니다.
//
// 캐시: /apt 와 같은 구조. searchParams(status)를 읽어 Next 가 dynamic 으로 강등시키므로
// page-level revalidate 만으로는 캐시가 안 걸린다. 데이터 레이어에서 unstable_cache 로 건다.

import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { SITE_URL } from '@/lib/constants';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getAptHub } from '@/lib/apt/hub';
import SectionHeader from '@/components/apt/SectionHeader';
import SiteCard, { SiteRow, type CuratedSite } from '@/components/apt/SiteCard';
import SubscriptionCard from '@/components/apt/SubscriptionCard';
import Disclaimer from '@/components/Disclaimer';

export const revalidate = 900;
export const maxDuration = 15;

const REGION = '부산';
const CACHE_SECONDS = 900;

/** 상태 필터 탭. 값은 apt_sites.curated_status 표기 그대로. */
const TABS = ['전체', '선착순', '분양중', '분양예정'] as const;
type Tab = (typeof TABS)[number];

const CURATED_COLS =
  'slug,name,region,sigungu,builder,curated_status,curated_copy,satellite_image_url,price_min,price_max,total_units,lifecycle_stage';

export interface BusanBlogPost {
  id: number;
  slug: string;
  title: string;
  published_at: string | null;
}

async function fetchCuratedUncached(): Promise<CuratedSite[]> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await (sb as any)
      .from('apt_sites')
      .select(CURATED_COLS)
      .eq('is_curated', true)
      .eq('region', REGION)
      .order('curated_at', { ascending: false, nullsFirst: false });
    return (data ?? []) as CuratedSite[];
  } catch (err) {
    console.error('[apt/busan curated]', err);
    return [];
  }
}

async function fetchBlogsUncached(): Promise<BusanBlogPost[]> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await (sb as any)
      .from('blog_posts')
      .select('id,slug,title,published_at')
      .not('published_at', 'is', null)
      .contains('tags', [REGION])
      .or('title.ilike.%분양%,title.ilike.%청약%')
      .order('published_at', { ascending: false })
      .limit(6);
    return (data ?? []) as BusanBlogPost[];
  } catch (err) {
    console.error('[apt/busan blogs]', err);
    return [];
  }
}

// Rule #66: 빈 응답이 캐시에 영구화되지 않도록, 결과가 비면 캐시를 건너뛰고 매 요청 재시도한다.
const fetchCuratedCached = unstable_cache(fetchCuratedUncached, ['apt-busan-curated'], {
  revalidate: CACHE_SECONDS,
  tags: ['apt-busan'],
});
const fetchBlogsCached = unstable_cache(fetchBlogsUncached, ['apt-busan-blogs'], {
  revalidate: CACHE_SECONDS,
  tags: ['apt-busan'],
});

async function getCurated(): Promise<CuratedSite[]> {
  const cached = await fetchCuratedCached();
  return cached.length > 0 ? cached : fetchCuratedUncached();
}

async function getBlogs(): Promise<BusanBlogPost[]> {
  const cached = await fetchBlogsCached();
  return cached.length > 0 ? cached : fetchBlogsUncached();
}

const TITLE = '부산 분양 현장 — 선착순·분양중·분양예정';

export const metadata: Metadata = {
  title: `${TITLE} | 카더라`,
  description:
    '부산 주요 분양 현장을 선착순·분양중·분양예정으로 나눠 정리했습니다. ' +
    '분양가와 세대수, 청약 일정, 관련 분석을 한 화면에서 확인하세요.',
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}/apt/busan` },
  openGraph: {
    title: `${TITLE} | 카더라`,
    description: '부산 주요 분양 현장 · 청약 일정 · 분양 분석',
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    url: `${SITE_URL}/apt/busan`,
  },
};

function normalizeTab(raw: string | undefined): Tab {
  return (TABS as readonly string[]).includes(raw ?? '') ? (raw as Tab) : '전체';
}

function fmtDate(d: string | null): string {
  if (!d) return '';
  const [, m, day] = d.slice(0, 10).split('-');
  return m && day ? `${Number(m)}월 ${Number(day)}일` : '';
}

export default async function BusanAptPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const sp = (await searchParams) || {};
  const tab = normalizeTab(sp.status?.trim());

  const [curated, hub, blogs] = await Promise.all([getCurated(), getAptHub(REGION), getBlogs()]);

  const filtered = tab === '전체' ? curated : curated.filter((s) => s.curated_status === tab);
  // 위성이 있으면 카드, 없으면 표 행. 빈 이미지 슬롯은 만들지 않는다.
  const cards = filtered.filter((s) => s.satellite_image_url);
  const rows = filtered.filter((s) => !s.satellite_image_url);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '8px 6px 28px' }}>
      <h1 className="sr-only">부산 분양 현장 — 선착순 · 분양중 · 분양예정</h1>

      {/* ① 큐레이션 — 0건이면 섹션 자체를 렌더하지 않는다 */}
      {curated.length > 0 && (
        <section style={{ padding: '0 6px' }} aria-labelledby="busan-curated-heading">
          <SectionHeader
            id="busan-curated-heading"
            eyebrow="CURATED — 부산"
            title="부산 주요 현장"
            meta={`총 ${curated.length}개 현장`}
          />

          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {TABS.map((t) => {
              const active = t === tab;
              return (
                <Link
                  key={t}
                  href={t === '전체' ? '/apt/busan' : `/apt/busan?status=${encodeURIComponent(t)}`}
                  scroll={false}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: active ? 700 : 500,
                    textDecoration: 'none',
                    border: '1px solid var(--border)',
                    background: active ? 'var(--brand)' : 'var(--bg-surface)',
                    color: active ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  }}
                >
                  {t}
                </Link>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 12px' }}>
              {tab} 현장이 아직 없습니다.
            </p>
          ) : (
            <>
              {cards.length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: 10,
                  }}
                >
                  {cards.map((s) => (
                    <SiteCard key={s.slug} site={s} />
                  ))}
                </div>
              )}
              {rows.length > 0 && (
                <div style={{ display: 'grid', gap: 7, marginTop: cards.length > 0 ? 10 : 0 }}>
                  {rows.map((s) => (
                    <SiteRow key={s.slug} site={s} />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ② 청약홈 파생 자동 목록 */}
      {hub.cards.length > 0 && (
        <section style={{ padding: '0 6px', marginTop: 24 }} aria-labelledby="busan-sub-heading">
          <SectionHeader
            id="busan-sub-heading"
            eyebrow="SUBSCRIPTION — 청약 일정"
            title="부산 청약 일정"
            meta={`${hub.cards.length}개 단지`}
          />
          <div style={{ display: 'grid', gap: 9 }}>
            {hub.cards.map((it) => (
              <SubscriptionCard key={it.id} item={it} />
            ))}
          </div>
        </section>
      )}

      {/* ③ 부산 분양 분석 */}
      {blogs.length > 0 && (
        <section style={{ padding: '0 6px', marginTop: 24 }} aria-labelledby="busan-blog-heading">
          <SectionHeader id="busan-blog-heading" eyebrow="ANALYSIS — 부산" title="부산 분양 분석" />
          <div style={{ display: 'grid', gap: 7 }}>
            {blogs.map((b) => (
              <Link
                key={b.id}
                href={`/blog/${encodeURIComponent(b.slug)}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '10px 11px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  textDecoration: 'none',
                  fontSize: 'var(--fs-sm)',
                }}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {b.title}
                </span>
                <span
                  style={{
                    fontSize: 'var(--fs-xs)',
                    color: 'var(--text-tertiary)',
                    flexShrink: 0,
                    fontFamily: 'var(--font-mono)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmtDate(b.published_at)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Disclaimer type="apt" compact />
    </div>
  );
}
