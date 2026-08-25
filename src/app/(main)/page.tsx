// s262 Phase C — Issue Engine v1 home (legacy: src/_legacy/s262/home_page_v0.tsx)
// s274 — (main) 라우트 그룹으로 이동. 이전에는 src/app/page.tsx 로 그룹 밖에 있어서
//        ClientShell 이 안 붙었고, 그 결과 홈에만 Navigation(헤더·하단탭) 이 없고
//        PageViewTracker 도 안 돌아 page_views 에 path='/' 가 30일간 0건이었다.
//
// 4 섹션: hero stat bar + 이슈종목(국내 5 / 해외 3) + 이슈단지 5 + 인기 블로그 3
// 데이터: stock_issue_scores / apt_issue_scores 직접 query + get_home_data hero/blog
import type { Metadata } from 'next';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL as SITE } from '@/lib/constants';
import StockListRow from '@/components/stock/StockListRow';
import { HomeAptRow, HomeBlogRow } from '@/components/home/HomeListRows';
import SectionHeader from '@/components/apt/SectionHeader';
import UniversalSearchBar from '@/components/search/UniversalSearchBar';
import RecentMoves, { type RecentMove } from '@/components/home/RecentMoves';
import LeadForm from '@/components/apt/LeadForm';
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

/** 홈이 다루는 지역. 부울경이 카더라의 실제 커버리지다. */
const HOME_REGIONS = ['부산', '울산', '경남'];

/**
 * H1-2 — 최근 움직인 현장.
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
      p_limit: 6,
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
 * H1-4 — 지역 칩 건수.
 *
 * ⚠️ 건수를 하드코딩하지 않는다. 숫자가 굳으면 화면이 조용히 거짓말을 한다.
 * ⚠️ `/apt/[id]` 의 8개짜리 `Promise.allSettled` 뭉치에 합치지 말 것 — 504 전례가 있다.
 *    여기서도 홈 본체 fetch 와 **분리해서** 돌린다. 실패해도 칩만 빠진다.
 */
async function fetchRegionCounts(): Promise<{ region: string; n: number }[]> {
  try {
    const sb = getSupabaseAdmin();
    const rows = await Promise.all(
      HOME_REGIONS.map(async (region) => {
        const { count } = await (sb as any)
          .from('apt_sites')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq('region', region);
        return { region, n: count ?? 0 };
      }),
    );
    return rows.filter((r) => r.n > 0);
  } catch (e) {
    console.error('[home] region counts failed:', e);
    return [];
  }
}

/**
 * v7-D1 — 라운지(피드) 최신 3줄. 텍스트만 — 홈에서 커뮤니티는 '살아 있다' 만 보이면 된다.
 * posts_safe 는 is_deleted·신고 처리를 이미 걸러 둔 읽기 뷰다.
 * 실패하면 블록만 빠지고 나머지는 그대로 렌더된다.
 */
async function fetchLounge(): Promise<{ id: string; title: string; comments_count: number | null }[]> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await (sb as any)
      .from('posts_safe')
      .select('id, title, comments_count')
      .order('created_at', { ascending: false })
      .limit(3);
    return (data ?? []) as { id: string; title: string; comments_count: number | null }[];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [{ hero, domestic, overseas, apts, blogs }, lounge, moves, regionCounts] = await Promise.all([
    fetchHome(),
    fetchLounge(),
    fetchRecentMoves(),
    fetchRegionCounts(),
  ]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '8px 6px 24px' }}>
      {/* H1-1 검색 히어로.
       * ⚠️ hotkey={false} 필수 — 헤더의 bar 인스턴스가 이미 ⌘K 를 소유한다.
       *    둘 다 true 면 keydown 이 두 번 잡혀 모달이 두 개 열린다.
       *    (Navigation.tsx 의 icon 인스턴스도 같은 이유로 false 다.) */}
      <div style={{ margin: '2px 3px 12px' }}>
        <UniversalSearchBar
          variant="hero"
          hotkey={false}
          placeholder="단지명·지역·재개발 구역"
        />
      </div>

      {/* Hero stat bar */}
      <section
        style={{
          margin: '6px 3px 12px',
          padding: '12px 14px',
          borderRadius: 'var(--radius-md, 10px)',
          background: 'var(--bg-elevated, #132040)',
          border: '1px solid var(--border, #1E3258)',
          color: 'var(--text-primary)',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-orange)', letterSpacing: 0.4, marginBottom: 4 }}>
          오늘의 이슈
        </div>
        {/* h1 은 sr-only 가 아니라 실제로 보이는 제목이어야 한다 — 히어로 타이틀이 곧 h1. */}
        {hero ? (
          hero.href ? (
            <Link href={hero.href} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
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

      {/* H1-4 지역 칩 — 건수는 count 쿼리에서 온다. 하드코딩 금지. */}
      {regionCounts.length > 0 && (
        <nav aria-label="지역별 현장" style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '0 3px', marginBottom: 16 }}>
          {regionCounts.map((r) => (
            <Link
              key={r.region}
              href={`/apt?region=${encodeURIComponent(r.region)}`}
              style={{
                padding: '5px 10px',
                borderRadius: 'var(--radius-pill, 999px)',
                fontSize: 12,
                fontWeight: 600,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                textDecoration: 'none',
              }}
            >
              {r.region} <span style={{ color: 'var(--text-tertiary)' }}>{r.n.toLocaleString('ko-KR')}</span>
            </Link>
          ))}
        </nav>
      )}

      {/* H1-2 최근 움직인 현장.
       * ⚠️ 「신규 등록」과 「단계 변경」을 라벨로 가른다 — 섞어서 「N곳이 움직였다」로
       *    쓰면 거짓말이 된다(실측: 단계 변경 84 · 신규 등록 345). */}
      {moves.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <SectionHeader
            eyebrow="APT — 부산·울산·경남"
            title="최근 움직인 현장"
            id="home-moves"
            meta={<Link href="/apt/redev" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>전체 →</Link>}
          />
          <RecentMoves items={moves} />
        </section>
      )}

      {/* 이슈 단지 TOP 5 */}
      <section style={{ marginBottom: 18 }}>
        <SectionHeader eyebrow="APT — 오늘의 단지" title="이슈 단지" id="home-apt" meta={<Link href="/apt" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>전체 →</Link>} />
        {apts.length === 0 ? (
          <Empty label="이슈 단지 데이터 준비 중" />
        ) : (
          apts.map((a) => <HomeAptRow key={a.id} data={a} />)
        )}
      </section>

      {/* H1-3 홈 리드폼.
       * 현장 블록(최근 움직인 현장 · 이슈 단지) 바로 뒤에 둔다 — 방금 현장을 본 사람에게 묻는 자리다.
       * ⚠️ siteSlug 없이 보낸다. `leads.site_slug` 는 nullable 이라 그대로 들어간다.
       * ⚠️ 전송 경로는 상세와 완전히 같다 — LeadForm → NEXT_PUBLIC_LEAD_ENDPOINT →
       *    Apps Script → 시트 + Supabase. `register-interest` 라우트가 아니다. */}
      <section style={{ marginBottom: 18 }}>
        <LeadForm variant="home" />
      </section>

      {/* 인기 블로그 3 */}
      <section style={{ marginBottom: 18 }}>
        <SectionHeader eyebrow="BLOG — 많이 읽은 글" title="인기 블로그" id="home-blog" meta={<Link href="/blog" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>전체 →</Link>} />
        {blogs.length === 0 ? (
          <Empty label="블로그 준비 중" />
        ) : (
          <div>
            {blogs.map((b) => (
              <HomeBlogRow
                key={b.slug}
                post={{ slug: b.slug, title: b.title, cover_image: b.cover_image, category: b.category, readers: b.readers }}
              />
            ))}
          </div>
        )}
      </section>

      {/* v7-D1 · 라운지 — 피드 최신 3줄. 텍스트만.
           홈에서 커뮤니티는 '살아 있다' 만 보이면 된다. 카드로 키우면
           우선순위(부동산 > 주식 > 블로그 > 피드)와 어긋난다.
           ⚠️ /discuss 빈 채팅창은 여기 되살리지 않는다 — 30일 방문 데스크탑 2·모바일 2 다.
              대화 0건인 채팅창 상시 노출은 '여기 아무도 없다' 를 보여주는 것과 같다. */}
      {lounge.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <SectionHeader
            eyebrow="LOUNGE — 커뮤니티"
            title="라운지"
            id="home-lounge"
            meta={<Link href="/feed" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>전체 →</Link>}
          />
          <div style={{ margin: '0 3px' }}>
            {lounge.map((p) => (
              <Link
                key={p.id}
                href={`/feed/${p.id}`}
                className="kd-lrow"
                style={{ textDecoration: 'none', color: 'inherit', gridTemplateColumns: 'minmax(0, 1fr) auto' }}
              >
                <span className="kd-lrow-t">{p.title}</span>
                <span className="kd-lrow-r" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                  {(p.comments_count ?? 0) > 0 ? `댓글 ${p.comments_count}` : ''}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {/* H1-4: 국내·해외 이슈 종목 — 삭제하지 않고 최하단으로.
        * 홈의 1차 목적은 현장 페이지로 링크를 흘려보내는 것이다(현장 상세 CTR 2.4% vs 블로그 0.09%).
        * 종목은 유지하되 아파트·블로그 뒤에 둔다. */}
      {/* 이슈 종목 — 국내 TOP 5 */}
      <section style={{ marginBottom: 18 }}>
        <SectionHeader eyebrow="DOMESTIC — 코스피·코스닥" title="국내 이슈 종목" id="home-domestic" meta={<Link href="/stock?tab=issue" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>전체 →</Link>} />
        {domestic.length === 0 ? (
          <Empty label="이슈 점수 데이터 준비 중" />
        ) : (
          domestic.map((s) => (
            <StockListRow
              key={s.symbol}
              symbol={s.symbol}
              name={s.name}
              price={s.price}
              changePct={s.change_pct}
              score={s.score}
              reasons={s.reasons}
              warning={s.warning}
              meta={s.sector}
              spark={s.sparkline_5d}
            />
          ))
        )}
      </section>

      {/* 이슈 종목 — 해외 TOP 3 */}
      {overseas.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <SectionHeader eyebrow="OVERSEAS — 뉴욕증시" title="해외 이슈 종목" id="home-overseas" meta={<Link href="/stock?tab=issue" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>전체 →</Link>} />
          {overseas.map((s) => (
            <StockListRow
              key={s.symbol}
              symbol={s.symbol}
              name={s.name}
              price={s.price}
              changePct={s.change_pct}
              score={s.score}
              reasons={s.reasons}
              warning={s.warning}
              meta={s.sector}
              spark={s.sparkline_5d}
            />
          ))}
        </section>
      )}

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
