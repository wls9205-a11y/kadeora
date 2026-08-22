// s262 Phase C — Issue Engine v1 home (legacy: src/_legacy/s262/home_page_v0.tsx)
// s274 — (main) 라우트 그룹으로 이동. 이전에는 src/app/page.tsx 로 그룹 밖에 있어서
//        ClientShell 이 안 붙었고, 그 결과 홈에만 Navigation(헤더·하단탭) 이 없고
//        PageViewTracker 도 안 돌아 page_views 에 path='/' 가 30일간 0건이었다.
//
// 4 섹션: hero stat bar + 이슈종목(국내 5 / 해외 3) + 이슈단지 5 + 인기 블로그 3
// 데이터: stock_issue_scores / apt_issue_scores 직접 query + get_home_data hero/blog
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL as SITE } from '@/lib/constants';
import StockIssueCard from '@/components/cards/StockIssueCard';
import AptIssueCard from '@/components/cards/AptIssueCard';
import SectionHeader from '@/components/apt/SectionHeader';
import type { StockIssueScore, AptIssueScore } from '@/lib/issue/types';
import type { HomeData } from '@/lib/home/contracts';

export const revalidate = 60; // s262 — issue scores 5분 cron 가정 + edge cache

export const metadata: Metadata = {
  // absolute — (main)/layout 의 `%s | 카더라` 템플릿이 붙어 브랜드가 중복되는 걸 막는다.
  title: { absolute: '카더라 — 오늘의 이슈 종목·청약·블로그' },
  description: '오늘 가장 변동성 큰 국내 종목, 마감 임박 청약, 인기 블로그를 한 화면에. 코스피·코스닥 이슈 종목과 전국 아파트 청약 일정을 매일 갱신합니다.',
  alternates: { canonical: SITE },
  openGraph: {
    title: '카더라 — 오늘의 이슈',
    description: '주식 시세, 아파트 청약, 미분양·재개발·실거래가, 커뮤니티 토론을 한 곳에서.',
    url: SITE,
    siteName: '카더라',
    images: [{ url: `${SITE}/images/brand/kadeora-wide.png`, width: 1200, height: 630, alt: '카더라' }],
    locale: 'ko_KR',
    type: 'website',
  },
};

const DOMESTIC_MARKETS = ['KOSPI', 'KOSDAQ'];

type HotBlogRow = HomeData['hot_blog'][number] & { readers?: number };

/**
 * 실제로 읽히는 블로그 글 3개.
 *
 * get_home_data 의 hot_blog 는 priority_score, view_count 순인데 view_count 가
 * 신뢰할 수 없다 — /api/blog/view 에 봇 필터가 없어서 크롤러가 그대로 누적됐다.
 * 실제로 view_count 상위 12개 중 11개가 30일 사람 조회 0이었다.
 *
 * 그래서 page_views(bot_type='human') 를 직접 집계한다. 블로그 사람 조회는
 * 30일에 200건 안팎이라 전량 가져와 JS 에서 세도 부담이 없고, 홈은 ISR 60초라
 * 이 쿼리는 분당 1회 이하로만 돈다.
 */
async function fetchHotBlogs(
  sb: ReturnType<typeof getSupabaseAdmin>,
  fallback: HomeData['hot_blog'],
): Promise<HotBlogRow[]> {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: views } = await (sb as any)
      .from('page_views')
      .select('path')
      .eq('bot_type', 'human')
      .like('path', '/blog/%')
      .gt('created_at', since)
      .limit(2000);

    const tally = new Map<string, number>();
    for (const r of (views ?? []) as { path: string }[]) {
      // 저장된 path 는 URL 인코딩 상태다 (한글 slug 다수). 디코딩해야 slug 와 맞는다.
      const raw = r.path.slice('/blog/'.length).split(/[?#]/)[0];
      if (!raw) continue;
      let slug = raw;
      try { slug = decodeURIComponent(raw); } catch { /* 잘못된 인코딩은 원문 유지 */ }
      tally.set(slug, (tally.get(slug) ?? 0) + 1);
    }
    if (tally.size === 0) return fallback;

    // 비공개/삭제된 글이 섞일 수 있어 넉넉히 뽑고 조회 후 잘라낸다.
    const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    const { data: posts } = await (sb as any)
      .from('blog_posts')
      .select('slug,title,excerpt,cover_image,view_count,category,published_at')
      .in('slug', ranked.map(([s]) => s))
      .eq('is_published', true);

    const bySlug = new Map((posts ?? []).map((p: any) => [p.slug, p]));
    const hot = ranked
      .map(([slug, readers]) => {
        const p = bySlug.get(slug);
        return p ? ({ ...p, readers } as HotBlogRow) : null;
      })
      .filter(Boolean) as HotBlogRow[];

    return hot.length > 0 ? hot.slice(0, 3) : fallback;
  } catch (e) {
    console.error('[home] hot blog tally failed:', e);
    return fallback;
  }
}

type HeroLink = { href: string; hero: NonNullable<HomeData['hero_issue']> };

/**
 * hero 링크 목적지.
 *
 * kind==='issue' 는 issue_alerts 행인데 `/issue/[id]` 라우트가 존재한 적이 없다 (404).
 * issue_alerts 는 발행되면 blog_posts 로 이어지므로 blog_post_id → slug 를 풀어 붙인다.
 * 아직 블로그가 안 붙은 이슈면 링크를 걸지 않는다 (404 로 보내는 것보다 낫다).
 */
async function resolveHeroLink(
  sb: ReturnType<typeof getSupabaseAdmin>,
  hero: HomeData['hero_issue'],
): Promise<HeroLink | { href: null; hero: NonNullable<HomeData['hero_issue']> } | null> {
  if (!hero) return null;
  if (hero.kind === 'stock') return { href: `/stock/${hero.id}`, hero };

  try {
    const { data: alert } = await (sb as any)
      .from('issue_alerts')
      .select('blog_post_id')
      .eq('id', hero.id)
      .maybeSingle();
    if (alert?.blog_post_id) {
      const { data: post } = await (sb as any)
        .from('blog_posts')
        .select('slug')
        .eq('id', alert.blog_post_id)
        .maybeSingle();
      if (post?.slug) return { href: `/blog/${post.slug}`, hero };
    }
  } catch (e) {
    console.error('[home] hero link resolve failed:', e);
  }
  return { href: null, hero };
}

async function fetchHome(): Promise<{
  hero: HeroLink | { href: null; hero: NonNullable<HomeData['hero_issue']> } | null;
  domestic: StockIssueScore[];
  overseas: StockIssueScore[];
  apts: AptIssueScore[];
  blogs: HotBlogRow[];
}> {
  const sb = getSupabaseAdmin();
  try {
    // 국내/해외를 나눠서 각각 뽑는다. 단일 score 정렬이면 변동성 큰 미장이 5칸을 전부
    // 차지해서, 네이버로 유입되는 국내 사용자 첫 화면이 미국 종목만 나오던 문제 (s274).
    const [home, domesticRes, overseasRes, aptRes] = await Promise.all([
      (sb as any).rpc('get_home_data'),
      (sb as any).from('stock_issue_scores').select('*').is('warning', null)
        .in('market', DOMESTIC_MARKETS)
        .order('score', { ascending: false, nullsFirst: false }).limit(5),
      (sb as any).from('stock_issue_scores').select('*').is('warning', null)
        .not('market', 'in', `(${DOMESTIC_MARKETS.join(',')})`)
        .order('score', { ascending: false, nullsFirst: false }).limit(3),
      (sb as any).from('apt_issue_scores').select('*').is('warning', null)
        .order('score', { ascending: false, nullsFirst: false }).limit(5),
    ]);
    const homeData: HomeData | null = home?.data ?? null;
    const [hero, blogs] = await Promise.all([
      resolveHeroLink(sb, homeData?.hero_issue ?? null),
      fetchHotBlogs(sb, homeData?.hot_blog ?? []),
    ]);
    return {
      hero,
      domestic: (domesticRes?.data ?? []) as StockIssueScore[],
      overseas: (overseasRes?.data ?? []) as StockIssueScore[],
      apts: (aptRes?.data ?? []) as AptIssueScore[],
      blogs,
    };
  } catch (e) {
    console.error('[home] fetch failed:', e);
    return { hero: null, domestic: [], overseas: [], apts: [], blogs: [] };
  }
}

// 홈은 사이트에서 authority 가 가장 높은 페이지인데 이전엔 /stock /apt /blog 3곳으로만
// 링크를 흘렸다. 네이버 유입 상위 착지 페이지(계산기·재개발 허브)로도 경로를 낸다.
const QUICK_LINKS: { href: string; label: string }[] = [
  { href: '/apt',          label: '청약 일정' },
  { href: '/apt/redev',    label: '재개발·재건축' },
  { href: '/apt/complex',  label: '단지백과' },
  { href: '/calc',         label: '계산기' },
  { href: '/stock/themes', label: '테마주' },
  { href: '/daily',        label: '데일리 리포트' },
  { href: '/feed',         label: '커뮤니티' },
];

export default async function HomePage() {
  const { hero, domestic, overseas, apts, blogs } = await fetchHome();

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '8px 6px 24px' }}>
      {/* Hero stat bar */}
      <section
        style={{
          margin: '6px 3px 12px',
          padding: '12px 14px',
          borderRadius: 'var(--radius-md, 10px)',
          background: 'var(--bg-elevated, #132040)',
          border: '1px solid var(--border, #1E3258)',
          color: 'var(--text-primary, #F2F5FA)',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-orange)', letterSpacing: 0.4, marginBottom: 4 }}>
          오늘의 이슈
        </div>
        {/* h1 은 sr-only 가 아니라 실제로 보이는 제목이어야 한다 — 히어로 타이틀이 곧 h1. */}
        {hero ? (
          hero.href ? (
            <Link href={hero.href} style={{ color: 'var(--text-primary, #F2F5FA)', textDecoration: 'none' }}>
              <HeroBody hero={hero.hero} />
            </Link>
          ) : (
            <HeroBody hero={hero.hero} />
          )
        ) : (
          <h1 style={{ fontSize: 15, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
            카더라 — 오늘의 이슈 종목·청약·블로그
          </h1>
        )}
        <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 11, color: 'var(--text-tertiary, #8BA3C0)' }}>
          <span>국내 이슈 종목 {domestic.length}</span>
          <span>이슈 단지 {apts.length}</span>
          <span>인기 블로그 {blogs.length}</span>
        </div>
      </section>

      {/* 빠른 이동 */}
      <nav aria-label="주요 메뉴" style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '0 3px', marginBottom: 16 }}>
        {QUICK_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            style={{
              padding: '5px 10px',
              borderRadius: 'var(--radius-pill, 999px)',
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--bg-surface, #0D1730)',
              border: '1px solid var(--border, #1E3258)',
              color: 'var(--text-secondary, #B8CCDF)',
              textDecoration: 'none',
            }}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      {/* 이슈 종목 — 국내 TOP 5 */}
      <section style={{ marginBottom: 18 }}>
        <SectionHeader eyebrow="DOMESTIC — 코스피·코스닥" title="국내 이슈 종목" id="home-domestic" meta={<Link href="/stock?tab=issue" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>전체 →</Link>} />
        {domestic.length === 0 ? (
          <Empty label="이슈 점수 데이터 준비 중" />
        ) : (
          domestic.map((s) => <StockIssueCard key={s.symbol} data={s} />)
        )}
      </section>

      {/* 이슈 종목 — 해외 TOP 3 */}
      {overseas.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <SectionHeader eyebrow="OVERSEAS — 뉴욕증시" title="해외 이슈 종목" id="home-overseas" meta={<Link href="/stock?tab=issue" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>전체 →</Link>} />
          {overseas.map((s) => <StockIssueCard key={s.symbol} data={s} />)}
        </section>
      )}

      {/* 이슈 단지 TOP 5 */}
      <section style={{ marginBottom: 18 }}>
        <SectionHeader eyebrow="APT — 오늘의 단지" title="이슈 단지" id="home-apt" meta={<Link href="/apt" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>전체 →</Link>} />
        {apts.length === 0 ? (
          <Empty label="이슈 단지 데이터 준비 중" />
        ) : (
          apts.map((a) => <AptIssueCard key={a.id} data={a} />)
        )}
      </section>

      {/* 인기 블로그 3 */}
      <section style={{ marginBottom: 18 }}>
        <SectionHeader eyebrow="BLOG — 많이 읽은 글" title="인기 블로그" id="home-blog" meta={<Link href="/blog" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>전체 →</Link>} />
        {blogs.length === 0 ? (
          <Empty label="블로그 준비 중" />
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {blogs.map((b) => (
              <Link
                key={b.slug}
                href={`/blog/${b.slug}`}
                style={{
                  display: 'flex', gap: 10, padding: 8, margin: 3,
                  borderRadius: 'var(--radius-sm, 6px)',
                  background: 'var(--bg-surface, #0D1730)',
                  border: '1px solid var(--border, #1E3258)',
                  textDecoration: 'none',
                  color: 'var(--text-primary, #F2F5FA)',
                }}
              >
                {b.cover_image ? (
                  <span style={{ position: 'relative', width: 64, height: 48, flexShrink: 0, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-sunken, #030710)' }}>
                    <Image src={b.cover_image} alt="" fill sizes="64px" style={{ objectFit: 'cover' }} />
                  </span>
                ) : null}
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                    {b.title}
                  </span>
                  {/* s274 — 누적 view_count 는 봇이 섞여 있어 표기하지 않는다.
                      집계가 된 경우에만 '최근 30일 실제 독자 수' 를 보여준다. */}
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary, #8BA3C0)', marginTop: 2 }}>
                    {b.category ?? ''}{b.readers ? ` · 최근 30일 ${b.readers.toLocaleString()}명` : ''}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function HeroBody({ hero }: { hero: NonNullable<HomeData['hero_issue']> }) {
  return (
    <>
      <h1 style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, margin: 0 }}>{hero.title}</h1>
      {hero.summary ? (
        <div style={{ fontSize: 12, color: 'var(--text-secondary, #B8CCDF)', marginTop: 4, lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
          {hero.summary}
        </div>
      ) : null}
    </>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div style={{ padding: 16, margin: 3, borderRadius: 'var(--radius-sm, 6px)', background: 'var(--bg-surface, #0D1730)', border: '1px solid var(--border, #1E3258)', fontSize: 12, color: 'var(--text-tertiary, #8BA3C0)', textAlign: 'center' }}>
      {label}
    </div>
  );
}
