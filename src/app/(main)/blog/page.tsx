import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
// s240 W1: createSupabaseServer (cookies 의존) → getSupabaseAdmin (cookie-free) 전환.
// 메인 페이지 anonymous SSR — RLS 우회 OK. cache-control public 회복.
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import EmptyState from '@/components/EmptyState';
import { sanitizeSearchQuery } from '@/lib/sanitize';
import SectionShareButton from '@/components/SectionShareButton';
import CurationCarousel from '@/components/ui/CurationCarousel';
import ListThumb from '@/components/ui/ListThumb';
import { isSafeImage, blogHeroImage } from '@/lib/blog/safe-image';
import { facetRobots } from '@/lib/seo/facet';
import BlogCurationCard from '@/components/blog/BlogCurationCard';
// s205-W2: HeroCard "오늘의 블로그" 제거 — 14d /blog 1,176 PV, 카드 클릭 1건. fetchBlogHero / getSupabaseAdmin 도 함께 제거.

function highlightTitle(title: string, query: string): React.ReactNode {
  if (!query) return title;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = title.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={{ background: 'rgba(37,99,235,0.15)', color: 'var(--brand)', borderRadius: 4, padding: '0 2px' }}>{part}</mark>
      : part
  );
}

export const maxDuration = 60;
export const revalidate = 600; // s239 W5: 10분 ISR (cold start ↓ + 봇 캐시 hit ↑)

import { SITE_URL as SITE } from '@/lib/constants';

const CAT_META: Record<string, { title: string; desc: string }> = {
  all: { title: '블로그 — 주식·청약·부동산 정보', desc: '코스피 코스닥 시세, 아파트 청약 일정, 미분양 현황, 재테크 정보를 매일 업데이트합니다.' },
  stock: { title: '주식 블로그 — 코스피·코스닥 시황 분석', desc: '매일 업데이트되는 코스피 코스닥 시황, 급등락 종목 분석, 섹터별 동향 정보.' },
  apt: { title: '청약 블로그 — 아파트 청약 일정·분석', desc: '전국 아파트 청약 일정, 분양가 분석, 당첨 전략 등 청약 정보를 매일 제공합니다.' },
  unsold: { title: '미분양 블로그 — 전국 미분양 현황·분석', desc: '전국 미분양 아파트 현황, 투자 분석, 할인 분양 정보를 월간 업데이트합니다.' },
  finance: { title: '재테크 블로그 — 투자·절약·자산관리', desc: '재테크 기본 원칙부터 실전 투자 전략까지, 자산 관리 정보를 제공합니다.' },
  general: { title: '생활 정보 블로그 — 우리동네 소식', desc: '알아두면 유용한 생활 정보, 동네 소식, 정책 변경 사항을 안내합니다.' },
  // v4-C5: 대분류 3개. 레거시 6개 값은 위에 그대로 남는다.
  realestate: { title: '부동산 블로그 — 청약·미분양·재개발', desc: '전국 아파트 청약 일정, 미분양 현황, 재개발 진행 단계를 한 곳에서 확인하세요.' },
  redev: { title: '재개발 블로그 — 정비사업 진행 현황', desc: '전국 재개발·재건축 구역의 진행 단계와 일정을 정리합니다.' },
  life: { title: '재테크·생활 블로그 — 투자·절약·동네 소식', desc: '재테크 기본 원칙부터 실전 투자 전략, 알아두면 유용한 생활 정보까지.' },
};

/** v_blog_subcat_counts 한 행. group_key 는 이 파일의 탭 키(realestate/stock/life)와 같다. */
type SubcatRow = { group_key: string; category: string; sub_norm: string; cnt: number };

/** 서브칩 노출 하한. 이보다 적으면 칩만 늘고 고를 이유가 없다. */
const SUB_MIN_POSTS = 30;

/**
 * v4-C9(2차) — 서브칩을 v_blog_subcat_counts 뷰에서 뽑는다.
 *
 * 1차에서는 실측 스냅샷을 상수로 박았다. 뷰가 생겼으므로 상수를 지우고 여기서만 읽는다.
 * 뷰는 `fn_blog_subcat_norm(category, sub_category)` 로 정규화한 값을 준다 —
 * 영문 구형 키(cheongak·preempt_coverage·lotto_cheongak 등)가 '청약·분양' 으로 흡수돼
 * 891 → 1,131편이 된다.
 *
 * 목록 조회도 같은 정규화를 쓰는 v_blog_posts_listing 뷰를 본다.
 * 칩 건수와 목록 건수가 한 함수(fn_blog_subcat_norm)에서 나오므로 어긋날 수 없다.
 *
 * 그룹 탭은 멤버 category 의 같은 sub_norm 을 합산한다
 * (예: 재개발·재건축 = apt 26 + redev 274 = 300).
 */
function subCatsFromView(rows: SubcatRow[], category: string): { key: string; label: string; cnt: number }[] | null {
  const members = CAT_GROUPS[category] ?? (CAT_TO_TAB[category] ? [category] : null);
  if (!members) return null;

  const agg = new Map<string, number>();
  for (const r of rows) {
    if (!members.includes(r.category)) continue;
    if (!r.sub_norm) continue;
    agg.set(r.sub_norm, (agg.get(r.sub_norm) ?? 0) + Number(r.cnt || 0));
  }

  const out = [...agg.entries()]
    .filter(([, cnt]) => cnt >= SUB_MIN_POSTS)
    .map(([key, cnt]) => ({ key, label: key, cnt }))
    // 가나다 고정 — 발행량 순으로 두면 칩 순서가 발행할 때마다 바뀐다 (C3·C8 과 같은 원칙).
    .sort((a, b) => a.label.localeCompare(b.label, 'ko'));

  return out.length > 0 ? out : null;
}

interface PageProps { searchParams: Promise<{ category?: string; sort?: string; q?: string; page?: string; sub?: string }> }

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  // [§6] 파셋 판정은 «들어온 파라미터 전부» 를 봐야 한다. 아래 구조분해로 뽑는
  //      category/page/q 만 보면 `?tag=` 같은 미지의 파라미터를 놓친다 —
  //      실제로 `/blog?tag=이씨에스` 가 그렇게 네이버에 색인됐다.
  const sp = await searchParams;
  const { category = 'all', page = '1', q } = sp;
  const meta = CAT_META[category] || CAT_META.all;
  const pageNum = parseInt(page) || 1;
  const suffix = pageNum > 1 ? ` (${pageNum}페이지)` : '';
  const qSuffix = q ? ` — "${q}" 검색` : '';

  const canonical = category === 'all' && pageNum === 1 && !q
    ? `${SITE}/blog`
    : `${SITE}/blog?${category !== 'all' ? `category=${category}&` : ''}${pageNum > 1 ? `page=${pageNum}` : ''}`.replace(/&$/, '');

  const ogCat = category === 'all' ? 'blog' : category;
  const titleEnc = encodeURIComponent(meta.title);
  const ogImages = [
    { url: `${SITE}/api/og?card=hero&category=${ogCat}&title=${titleEnc}`, width: 1200, height: 630, alt: `카더라 ${meta.title}` },
    { url: `${SITE}/api/og?card=stats&category=${ogCat}&title=${titleEnc}`, width: 1200, height: 630, alt: `${meta.title} 통계` },
    { url: `${SITE}/api/og?card=imminent&category=${ogCat}&title=${titleEnc}`, width: 1200, height: 630, alt: `${meta.title} 임박/추천` },
    { url: `${SITE}/api/og?card=ranking&category=${ogCat}&title=${titleEnc}`, width: 1200, height: 630, alt: `${meta.title} 랭킹` },
    { url: `${SITE}/api/og?card=region&category=${ogCat}&title=${titleEnc}`, width: 1200, height: 630, alt: `${meta.title} 지역` },
    { url: `${SITE}/api/og-square?title=${titleEnc}&category=${ogCat}`, width: 630, height: 630, alt: `카더라 ${meta.title}` },
  ];

  return {
    title: `${meta.title}${suffix}${qSuffix}`,
    description: meta.desc,
    alternates: {
      canonical,
      ...(pageNum > 1 ? { prev: `${SITE}/blog?${category !== 'all' ? `category=${category}&` : ''}page=${pageNum - 1}`.replace(/[&?]page=1$/, '').replace(/&$/, '') } : {}),
      ...(pageNum < 100 ? { next: `${SITE}/blog?${category !== 'all' ? `category=${category}&` : ''}page=${pageNum + 1}` } : {}),
    },
    openGraph: { title: meta.title, description: meta.desc, url: canonical, siteName: '카더라', locale: 'ko_KR', type: 'website', images: ogImages },
    twitter: { card: 'summary_large_image' as const, title: meta.title, description: meta.desc, images: ogImages },
    // [§6] canonical 의존 금지 — Yeti 는 rel=canonical 을 무시하고 noindex 만 따른다.
    //      기본값이 아닌 쿼리 파라미터가 하나라도 붙으면 파셋으로 보고 색인에서 뺀다.
    ...facetRobots(sp),
    other: {
      'naver:written_time': new Date().toISOString(),
      'naver:updated_time': new Date().toISOString().slice(0, 10) + 'T00:00:00Z',
      'naver:author': '카더라',
      'og:updated_time': new Date().toISOString().slice(0, 10) + 'T00:00:00Z',
      'dg:plink': `${SITE}/blog`,
      'article:section': category === 'all' ? '블로그' : (CAT_META[category]?.title?.split('—')[0]?.trim() || '블로그'),
      'article:tag': '블로그,주식,청약,부동산,미분양,재테크',
    },
  };
}

// v4-C5-1: 탭을 대분류 4개로 접는다. 이모지는 제거 (C5-3).
//
// 실측 발행량 — apt 4,730 · stock 2,906 · unsold 507 · redev 287 · finance 263 · general 66.
// redev 287편은 탭이 없어 **어느 경로로도 도달할 수 없었다.** 부동산 그룹에 넣어 살린다.
//
// ⚠️ 기존 ?category= 6개 값(apt·stock·unsold·redev·finance·general)은 계속 받는다.
//    탭 UI 만 4개로 접고 내부 매핑을 유지한다 — 파라미터를 바꾸면 색인된 URL 이 전부 죽는다.
const CATS = [
  { key: 'all',        label: '전체' },
  { key: 'realestate', label: '부동산' },
  { key: 'stock',      label: '주식' },
  { key: 'life',       label: '재테크·생활' },
];

/**
 * 탭 키 → 실제 blog_posts.category 값들.
 *
 * ⚠️ 묶는 규칙의 원본은 DB 의 `fn_blog_group(category)` 이고 이 상수는 사본이다.
 *    목록 조회는 뷰의 group_key(=그 함수)를 쓰므로 사본을 타지 않는다.
 *    여기는 탭 건수 합산(tabCount)과 서브칩 합산(subCatsFromView)에만 쓴다 —
 *    둘 다 category 별 집계를 프론트에서 더하는 자리라 매핑이 필요하다.
 *    함수에 카테고리가 추가되면 이 상수도 같이 고칠 것 (증상: 탭 건수만 어긋난다).
 */
const CAT_GROUPS: Record<string, string[]> = {
  realestate: ['apt', 'unsold', 'redev'],
  stock: ['stock'],
  life: ['finance', 'general'],
};

/** 레거시 단일 category 값 → 어느 탭이 활성인지. */
const CAT_TO_TAB: Record<string, string> = {
  apt: 'realestate', unsold: 'realestate', redev: 'realestate',
  stock: 'stock',
  finance: 'life', general: 'life',
};

/**
 * ?category= 값을 실제 조회 대상으로 푼다.
 * null 이면 전체 (필터 없음). 알 수 없는 값도 전체로 떨어뜨린다 — 빈 목록보다 낫다.
 */
function resolveCategories(category: string): string[] | null {
  if (!category || category === 'all') return null;
  if (CAT_GROUPS[category]) return CAT_GROUPS[category];
  if (CAT_TO_TAB[category]) return [category];
  return null;
}

/** 행 배지용 — 글 하나의 실제 category 라벨. 탭 라벨과 다르다. */
const POST_CAT_LABEL: Record<string, string> = {
  stock: '주식', apt: '청약', unsold: '미분양', redev: '재개발', finance: '재테크', general: '생활',
};

/**
 * 목록 좌측 64px 썸네일 URL. 없으면 null → ListThumb 이 이니셜 블록을 그린다.
 * 판정은 safe-image.ts 의 isSafeImage 하나만 쓴다 (새 함수 금지 — 판정이 갈린다).
 * postImageMap 은 본문에서 뽑아 둔 이미지라 같은 화이트리스트를 통과해야 한다.
 */
function listThumb(p: { id: string | number; cover_image?: string | null }, map?: Record<string | number, string>): string | null {
  if (isSafeImage(p.cover_image)) return p.cover_image!;
  const fromBody = map?.[p.id];
  if (isSafeImage(fromBody)) return fromBody!;
  return null;
}

const CAT_COLORS: Record<string, string> = {
  stock: 'var(--accent-blue)', apt: 'var(--accent-green)', unsold: 'var(--accent-red)',
  redev: 'var(--accent-orange)', finance: 'var(--accent-purple)', general: 'var(--text-tertiary)',
};

interface Props { searchParams: Promise<{ category?: string; sort?: string; q?: string; page?: string; sub?: string }> }

export default async function BlogPage({ searchParams }: Props) {
  const { category = 'all', sort = 'latest', q = '', page = '1', sub = '' } = await searchParams;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const perPage = 30;
  const sb = getSupabaseAdmin();
  // s205-W2: blogHero (HeroCard) 제거 — 효용 0 (클릭 1건/14d).

  // 카테고리 건수 + 인기글 + 인기태그 — 병렬 조회
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const [catCountsR, popularR, tagsR, subcatR] = await Promise.allSettled([
    sb.rpc('blog_category_counts'),
    sb.from('blog_posts')
      .select('id, slug, title, category, view_count, cover_image')
      .eq('is_published', true)
      .gte('created_at', thirtyDaysAgo)
      .order('view_count', { ascending: false })
      .limit(5),
    pageNum === 1 && !q ? sb.rpc('blog_popular_tags', { limit_count: 20 }) : Promise.resolve({ data: [] }),
    // v4-C9(2차): 서브칩 원본. 6행짜리 집계 뷰라 가볍다.
    // types/database.ts 는 손대지 않는다(보호 대상) — 새 뷰라 생성 타입에 없어 as any 로 받는다.
    // 리포 다른 곳(apt_sites 조회 등)도 같은 패턴이다.
    (sb as any).from('v_blog_subcat_counts').select('group_key, category, sub_norm, cnt'),
  ]);

  const subcatRows: SubcatRow[] =
    subcatR.status === 'fulfilled' ? ((subcatR.value as any)?.data ?? []) : [];
  // 뷰 조회가 실패하면 서브칩만 사라지고 목록은 그대로 렌더된다.
  const subChips = category !== 'all' ? subCatsFromView(subcatRows, category) : null;

  const catCountsRaw = catCountsR.status === 'fulfilled' ? catCountsR.value?.data : [];
  const countMap: Record<string, number> = { all: 0 };
  (catCountsRaw || []).forEach((c: any) => { countMap[c.category] = Number(c.cnt); countMap.all += Number(c.cnt); });
  const totalCount = countMap.all;

  const popularPosts = popularR.status === 'fulfilled' ? popularR.value?.data : [];

  // 오늘의 추천 (카테고리별 최신 1편씩)
  let todayPicks: any[] = [];
  if (pageNum === 1 && !q && category === 'all') {
    try {
      const picks = await Promise.all(
        ['stock', 'apt', 'unsold', 'finance'].map(async (cat) => {
          const { data } = await sb.from('blog_posts')
            .select('id, slug, title, category, view_count, created_at')
            .eq('is_published', true).eq('category', cat)
            .order('created_at', { ascending: false }).limit(1).maybeSingle();
          return data;
        })
      );
      todayPicks = picks.filter(Boolean);
    } catch {}
  }

  // 인기 태그 (위에서 병렬 조회됨)
  const popularTags: { tag: string; cnt: number }[] = tagsR.status === 'fulfilled' ? ((tagsR.value as any)?.data || []) : [];

  // 메인 쿼리
  const now = new Date().toISOString();
  // v4-C9(3차): 목록을 v_blog_posts_listing 뷰에서 읽는다.
  //   blog_posts.* + sub_norm + group_key 라 컬럼은 그대로 쓰면서 sub_norm 으로 바로 거른다.
  //   이전 차수의 SUB_NORM_ALIASES 거울(=fn_blog_subcat_norm 사본)은 이걸로 없앴다.
  //   표현식 인덱스 idx_blog_posts_sub_norm 이 붙어 있어 인덱스 스캔으로 탄다.
  //   생성 컬럼을 쓰지 않은 것은 의도다 — 함수를 고쳐도 저장값이 재계산되지 않아
  //   드리프트가 오히려 더 조용해진다.
  let q2 = (sb as any).from('v_blog_posts_listing')
    .select('id, slug, title, excerpt, category, sub_category, tags, created_at, view_count, cover_image, image_alt, published_at, reading_time_min, comment_count, helpful_count, rewritten_at')
    .eq('is_published', true)
    .or(`published_at.is.null,published_at.lte.${now}`);
  // v4-C9(3차): 그룹 탭은 뷰의 group_key 로 건다 — 묶는 규칙의 원본은 DB 의
  //   fn_blog_group 이고 프론트의 CAT_GROUPS 는 탭 건수 합산용 사본이다.
  //   .in('category', CAT_GROUPS[...]) 로 걸면 그 함수에 카테고리가 하나 추가됐을 때
  //   프론트만 모르고 그 글들이 다시 도달 불가가 된다 (C5 의 redev 287편이 그랬다).
  //   fn_blog_group 의 ELSE 는 'life' 라 새 카테고리는 자동으로 재테크·생활에 들어온다.
  //   레거시 단일값(?category=apt 등)은 그대로 category 로 건다.
  const activeCats = resolveCategories(category);
  if (CAT_GROUPS[category]) {
    q2 = q2.eq('group_key', category);
  } else if (activeCats) {
    q2 = activeCats.length === 1 ? q2.eq('category', activeCats[0]) : q2.in('category', activeCats);
  }
  // sub 는 정규화 이름이다. 뷰가 sub_norm 을 직접 주므로 한 줄로 끝난다.
  if (sub) q2 = q2.eq('sub_norm', sub);
  if (q) { const sq = sanitizeSearchQuery(q, 100); if (sq) q2 = q2.or(`title.ilike.%${sq}%,excerpt.ilike.%${sq}%`); }
  if (sort === 'popular') {
    q2 = q2.order('view_count', { ascending: false });
  } else {
    q2 = q2.order('created_at', { ascending: false });
  }
  q2 = q2.range((pageNum - 1) * perPage, pageNum * perPage - 1);
  const { data: posts, count: filteredCount } = await q2;

  // 세션 142 P0: cover_image 없는 글은 blog_post_images 첫 이미지로 fallback
  // 세션 143: cover_image 가 /api/og 제네릭 URL 인 경우도 fallback 대상 (53K posts 제네릭 카드 비율 ↓ 즉시 효과)
  const postImageMap: Record<string | number, string> = {};
  const isGenericCover = (url: string | null | undefined): boolean =>
    !url || url.includes('/api/og') || url.includes('/api/og-square');
  const missingCoverIds = (posts || [])
    .filter((p: any) => isGenericCover(p.cover_image))
    .map((p: any) => p.id);
  if (missingCoverIds.length > 0) {
    const { data: imgs } = await (sb as any)
      .from('blog_post_images')
      .select('post_id, image_url, position')
      .in('post_id', missingCoverIds)
      .order('position', { ascending: true });
    for (const row of ((imgs || []) as any[])) {
      if (row.image_url && !postImageMap[row.post_id]) {
        postImageMap[row.post_id] = row.image_url;
      }
    }
  }

  // 다음 페이지 미리보기
  let nextPagePosts: any[] = [];
  try {
    let nq = (sb as any).from('v_blog_posts_listing')
      .select('id, slug, title, category')
      .eq('is_published', true)
      .or(`published_at.is.null,published_at.lte.${now}`);
    if (CAT_GROUPS[category]) {
      nq = nq.eq('group_key', category);
    } else if (activeCats) {
      nq = activeCats.length === 1 ? nq.eq('category', activeCats[0]) : nq.in('category', activeCats);
    }
    if (sub) nq = nq.eq('sub_norm', sub);
    if (sort === 'popular') nq = nq.order('view_count', { ascending: false });
    else nq = nq.order('created_at', { ascending: false });
    nq = nq.range(pageNum * perPage, pageNum * perPage + 4);
    const { data: np } = await nq;
    nextPagePosts = np || [];
  } catch {}

  const hasMore = (posts ?? []).length === perPage;

  // 인기 시리즈 (1페이지, 카테고리 전체일 때만)
  let topSeries: any[] = [];
  if (pageNum === 1 && category === 'all') {
    try {
      const { data } = await sb.from('blog_series')
        .select('slug, title, post_count, cover_image')
        .eq('is_active', true)
        .gt('post_count', 10)
        .order('post_count', { ascending: false })
        .limit(5);
      topSeries = data || [];
    } catch {}
  }

  // 탭에 붙는 건수 — 그룹은 멤버 합산. countMap 은 실제 category 별 집계다.
  const tabCount = (key: string): number => {
    if (key === 'all') return countMap.all || 0;
    return (CAT_GROUPS[key] ?? [key]).reduce((sum, c) => sum + (countMap[c] || 0), 0);
  };
  const activeTab = category === 'all' ? 'all' : (CAT_TO_TAB[category] ?? (CAT_GROUPS[category] ? category : 'all'));
  const catLabel = CATS.find(c => c.key === activeTab)?.label || '전체';
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE },
      { '@type': 'ListItem', position: 2, name: '블로그', item: SITE + '/blog' },
      ...(category !== 'all' ? [{ '@type': 'ListItem', position: 3, name: catLabel }] : []),
    ],
  };

  const itemListLd = (posts ?? []).length > 0 ? {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: `카더라 블로그 — ${catLabel}`,
    numberOfItems: (posts ?? []).length,
    itemListElement: (posts ?? []).slice(0, 10).map((p: any, i: number) => ({
      '@type': 'ListItem',
      position: i + 1 + (pageNum - 1) * perPage,
      url: `${SITE}/blog/${p.slug}`,
      name: p.title,
      image: p.cover_image || `${SITE}/api/og?title=${encodeURIComponent((p.title || "").slice(0, 50))}&design=${(i % 6) + 1}&category=${p.category || "blog"}`,
    })),
  } : null;

  // v3 커밋5 · 큐레이션 3건 — 인기글 우선, 없으면 최신 3편.
  // ⚠️ 여기 올린 3편을 아래 목록에서 빼지 않는다 (중복 허용, 이름 매칭 우회 금지).
  const curated: any[] = ((popularPosts ?? []).length >= 3 ? (popularPosts ?? []) : (posts ?? [])).slice(0, 3);

  return (
    <div className="kd-list" style={{ padding: '0 var(--sp-lg) 28px' }}>
      <div className="kd-list-main">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {itemListLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />}
      {/* JSON-LD: FAQPage */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: '카더라 블로그란?', acceptedAnswer: { '@type': 'Answer', text: '카더라 블로그는 주식 시황, 아파트 청약, 미분양, 재테크 등 금융·부동산 정보를 매일 업데이트하는 데이터 기반 블로그입니다.' } },
          { '@type': 'Question', name: '카더라 블로그는 무료인가요?', acceptedAnswer: { '@type': 'Answer', text: '네, 카더라 블로그의 모든 분석 글은 무료로 읽을 수 있습니다. 카카오 로그인 시 댓글, 도움돼요, 관심글 저장 기능도 이용 가능합니다.' } },
          { '@type': 'Question', name: '카더라 블로그 글은 얼마나 자주 올라오나요?', acceptedAnswer: { '@type': 'Answer', text: '주식 시황과 청약 분석은 매일, 미분양 현황은 월간, 재테크 정보는 주 1~2회 업데이트됩니다. RSS 구독으로 새 글 알림을 받을 수 있습니다.' } },
        ],
      })}} />
      {/* speakable — 네이버 음성검색 */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: '카더라 블로그', speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.blog-summary'] } }) }} />
      {/* s205-W2: HeroCard "오늘의 블로그" 제거. */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, paddingTop: 4 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>블로그</h1>
          <p className="blog-summary" style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0', letterSpacing: '0.3px' }}>매일 업데이트되는 투자 인사이트 · {totalCount.toLocaleString()}편</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <SectionShareButton section="blog" label="투자 정보 블로그 7,600편+" pagePath="/blog" />
          <Link href="/blog?sort=popular" className="touch-target" style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 14 }}>🔥</Link>
        </div>
      </div>

      {/* 검색 */}
      <form action="/blog" method="GET" style={{ marginBottom: 'var(--sp-md)', position: 'relative' }}>
        {category !== 'all' && <input type="hidden" name="category" value={category} />}
        {sort !== 'latest' && <input type="hidden" name="sort" value={sort} />}
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-tertiary)' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input name="q" defaultValue={q} placeholder="블로그 검색" style={{
          width: '100%', height: 40, padding: '0 12px 0 38px', fontSize: 13, fontWeight: 500,
          borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)',
          color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none',
        }} />
      </form>

      {/* 카테고리 탭 — 밑줄 스타일 */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 'var(--sp-md)', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {CATS.map(c => (
          <Link key={c.key} href={`/blog${c.key !== 'all' ? `?category=${c.key}` : ''}${sort !== 'latest' ? `${c.key !== 'all' ? '&' : '?'}sort=${sort}` : ''}${q ? `${c.key !== 'all' || sort !== 'latest' ? '&' : '?'}q=${q}` : ''}`}
            style={{
              padding: '8px 14px', minHeight: 44, fontSize: 'var(--fs-sm)', fontWeight: activeTab === c.key ? 600 : 500,
              color: activeTab === c.key ? 'var(--brand)' : 'var(--text-tertiary)',
              textDecoration: 'none', flexShrink: 0,
              borderBottom: activeTab === c.key ? '2px solid var(--brand)' : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', transition: 'all var(--transition-fast)',
            }}>
            {c.label}
            <span style={{ fontSize: 'var(--fs-xs)', opacity: 0.6 }}>{tabCount(c.key)}</span>
          </Link>
        ))}
        <Link href="/blog/series" style={{
          padding: '8px 14px', fontSize: 'var(--fs-sm)', fontWeight: 500,
          color: 'var(--brand)', textDecoration: 'none', flexShrink: 0,
          borderBottom: '2px solid transparent',
          display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)',
        }}>
          📚 시리즈
        </Link>
      </div>

      {/* 서브카테고리 칩 */}
      {subChips && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
          <Link href={`/blog?category=${category}${sort !== 'latest' ? `&sort=${sort}` : ''}${q ? `&q=${q}` : ''}`}
            style={{
              padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--fs-xs)', fontWeight: !sub ? 600 : 500,
              background: !sub ? 'var(--brand)' : 'var(--bg-hover)',
              color: !sub ? 'var(--text-inverse)' : 'var(--text-tertiary)',
              textDecoration: 'none', flexShrink: 0, border: 'none',
            }}>
            전체
          </Link>
          {subChips.map(sc => (
            <Link key={sc.key} href={`/blog?category=${category}&sub=${sc.key}${sort !== 'latest' ? `&sort=${sort}` : ''}${q ? `&q=${q}` : ''}`}
              style={{
                padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--fs-xs)', fontWeight: sub === sc.key ? 600 : 500,
                background: sub === sc.key ? 'var(--brand)' : 'var(--bg-hover)',
                color: sub === sc.key ? 'var(--text-inverse)' : 'var(--text-tertiary)',
                textDecoration: 'none', flexShrink: 0, border: 'none',
              }}>
              {sc.label}
              <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.65 }}>{sc.cnt}</span>
            </Link>
          ))}
        </div>
      )}

      {/* 정렬 + 인기태그 인라인 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 'var(--sp-xs)' }}>
          {[
            { key: 'latest', label: '최신순' },
            { key: 'popular', label: '인기순' },
          ].map(s => (
            <Link key={s.key} href={`/blog?${category !== 'all' ? `category=${category}&` : ''}sort=${s.key}${q ? `&q=${q}` : ''}`}
              style={{
                padding: '4px 10px', borderRadius: 'var(--radius-xs)', fontSize: 11, fontWeight: 600,
                background: sort === s.key ? 'var(--brand)' : 'transparent',
                color: sort === s.key ? '#fff' : 'var(--text-tertiary)',
                textDecoration: 'none', border: sort === s.key ? 'none' : '1px solid var(--border)',
              }}>
              {s.label}
            </Link>
          ))}
        </div>
        {/* v7-D2: 데스크탑에서는 레일의 '태그' 패널이 대신한다 (같은 목록 두 벌 방지). */}
        {popularTags.length > 0 && (
          <div className="kd-lg-hide" style={{ display: 'flex', gap: 'var(--sp-xs)', overflow: 'hidden' }}>
            {popularTags.slice(0, 4).map((t: any) => (
              <Link key={t.tag} href={`/blog?q=${encodeURIComponent(t.tag)}`}
                style={{ fontSize: 10, color: 'var(--text-tertiary)', padding: '3px 8px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border)', whiteSpace: 'nowrap', textDecoration: 'none' }}>
                #{t.tag}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 인기글 — 컴팩트 한 줄 */}
      {pageNum === 1 && !q && category === 'all' && (popularPosts ?? []).length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 'var(--sp-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>🔥 인기 글</span>
            <Link href="/blog?sort=popular" style={{ fontSize: 10, color: 'var(--text-tertiary)', textDecoration: 'none', fontWeight: 600 }}>전체보기 →</Link>
          </div>
          {(popularPosts ?? []).slice(0, 3).map((p: any, i: number) => (
            <Link key={p.id} href={`/blog/${p.slug}`} className="kd-feed-card" style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', color: 'inherit', padding: '4px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: i === 0 ? 'var(--brand)' : 'var(--text-tertiary)', width: 16, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
              <span style={{ fontSize: 10, color: CAT_COLORS[p.category] || 'var(--text-tertiary)', fontWeight: 500, flexShrink: 0 }}>
                {POST_CAT_LABEL[p.category] || p.category}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>👀{p.view_count}</span>
            </Link>
          ))}
        </div>
      )}

      {/* 검색 결과 안내 */}
      {q && (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-md)' }}>
          &quot;{q}&quot; 검색 결과 {(posts ?? []).length}건
        </div>
      )}

      {/* v3 커밋5 · 큐레이션 3건 */}
      {pageNum === 1 && !q && curated.length === 3 && (
        <CurationCarousel
          title="이번 주 읽을 글"
          items={curated.map((p: any) => (
            <BlogCurationCard
              key={p.id}
              post={p}
              img={postImageMap[p.id]}
              // 큐레이션은 16:9 큰 슬롯이라 생성 카드가 읽힌다 (목록 64px 과 판단이 다르다).
              cover={listThumb(p, postImageMap) ?? blogHeroImage(p)}
              catLabel={POST_CAT_LABEL[p.category] || p.category || '분석'}
              catColor={CAT_COLORS[p.category] || 'var(--text-tertiary)'}
            />
          ))}
        />
      )}

      {/* 글 목록 — .kd-lrow */}
      {(posts ?? []).length === 0 ? (
        <EmptyState
          icon={q ? '🔍' : '📝'}
          title={q ? `"${q}"에 대한 검색 결과가 없습니다` : '아직 블로그 글이 없어요'}
          description={q ? '다른 검색어로 시도해보세요' : '곧 새로운 분석이 올라옵니다'}
        />
      ) : (
        <div>
          <div className="kd-lhead" aria-hidden="true">
            <span />
            <span>제목</span>
            <span>발행</span>
          </div>
          {(posts ?? []).map((p: any) => {
            const catColor = CAT_COLORS[p.category] || 'var(--text-tertiary)';
            const catLabel = POST_CAT_LABEL[p.category] || p.category;
            const readMin = p.reading_time_min || 3;
            const d = new Date(p.created_at || Date.now());
            const now = Date.now();
            const diff = now - d.getTime();
            const dateStr = diff < 86400000 ? '오늘' : diff < 172800000 ? '어제' : diff < 604800000 ? `${Math.floor(diff / 86400000)}일 전` : d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
            const isHot = (p.view_count ?? 0) >= 100;
            return (
              // v3 커밋5: 요약(excerpt)을 뺐다 — 모바일에서 16건 전부 한 줄 말줄임으로 잘려
              // 정보 구실을 못 했다. 그 폭을 제목 2줄에 몰아준다.
              // 좌측 칩 = 분류, 우측 = 발행일 + 읽는 시간.
              <Link key={p.id} href={`/blog/${p.slug}`} className="kd-lrow kd-lrow--thumb" style={{ textDecoration: 'none', color: 'inherit' }}>
                {/* v4-C7-2: 판정은 safe-image.ts 한 곳에서만 한다 — 새 함수를 만들면
                    OG 판정과 목록 판정이 갈린다. 외부 스크랩(발행분 24.7%)은 통과시키지 않는다.
                    ⚠️ 폴백을 생성 OG 카드로 두지 않았다 (C7-1 과 같은 이유):
                       텍스트 카드라 64px 에서 글씨가 안 보인다. 같은 크기 이니셜 블록이 낫다. */}
                <ListThumb src={listThumb(p, postImageMap)} name={p.title || ''} />

                <span style={{ minWidth: 0 }}>
                  <h2 className="kd-lrow-t is-two" style={{ margin: 0 }}>
                    <span className="kd-lrow-badge" style={{ background: `${catColor}1A`, color: catColor }}>
                      {catLabel}
                    </span>
                    {q ? highlightTitle(p.title, q) : p.title}
                  </h2>
                  {(isHot || (p.comment_count || 0) > 0 || (p.helpful_count || 0) > 0) && (
                    <span className="kd-lrow-m">
                      {isHot && <span className="kd-lrow-m-fix" style={{ color: 'var(--accent-red)', fontWeight: 500 }}>HOT</span>}
                      <span className="kd-lrow-m-fix">👀 {p.view_count > 0 ? p.view_count.toLocaleString() : 0}</span>
                      {(p.comment_count || 0) > 0 && <span className="kd-lrow-m-fix">💬 {p.comment_count}</span>}
                      {(p.helpful_count || 0) > 0 && <span className="kd-lrow-m-fix" style={{ color: 'var(--accent-green)' }}>👍 {p.helpful_count}</span>}
                    </span>
                  )}
                </span>

                <span className="kd-lrow-r">
                  {dateStr}
                  <span style={{ display: 'block', marginTop: 1, fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                    {readMin}분
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* 인기 시리즈 (SEO 내부링크) */}
      {/* 세션70: 블로그 목록 회원가입 유도 */}
      {pageNum === 1 && !q && (
        <div style={{
          margin: '12px 0', padding: '10px 14px', borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, var(--brand-bg), var(--accent-green-bg))',
          border: '1px solid var(--brand-border)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>📬</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>매일 투자 분석 받아보기</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>가입하면 전체 글 무제한 · 알림까지 무료</div>
          </div>
          <Link href="/login?redirect=/blog" style={{
            padding: '6px 14px', borderRadius: 'var(--radius-pill)',
            background: 'var(--kakao-bg)', color: 'var(--kakao-text)',
            fontWeight: 500, fontSize: 12, textDecoration: 'none', flexShrink: 0,
          }}>가입</Link>
        </div>
      )}
      {topSeries.length > 0 && (
        <div style={{ marginTop: 'var(--sp-2xl)', padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>📚 인기 시리즈</span>
            <Link href="/blog/series" style={{ fontSize: 'var(--fs-xs)', color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>전체 보기 →</Link>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-sm)', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
            {topSeries.map(s => (
              <Link key={s.slug} href={`/blog/series/${s.slug}`} style={{
                flexShrink: 0, width: 140, padding: '10px 12px',
                background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', textDecoration: 'none',
                border: '1px solid var(--border)', transition: 'border-color var(--transition-fast)',
              }}>
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--sp-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{s.post_count}편</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 다음 페이지 미리보기 */}
      {nextPagePosts.length > 0 && (
        <div style={{ marginTop: 'var(--sp-lg)', padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-sm)' }}>다음 페이지 미리보기</div>
          {nextPagePosts.map((p: any) => (
            <Link key={p.id} href={`/blog/${p.slug}`} style={{
              display: 'block', padding: '4px 0', fontSize: 13, color: 'var(--text-secondary)',
              textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              <span style={{ color: CAT_COLORS[p.category] || 'var(--text-tertiary)', marginRight: 4, fontSize: 11 }}>●</span>
              {p.title}
            </Link>
          ))}
        </div>
      )}

      {/* 관련 서비스 (내부 링크 — SEO 교차 참조) */}
      <div style={{ padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', marginTop: 'var(--sp-md)' }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--sp-sm)' }}>🔗 카더라 서비스</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[
            { href: '/apt', label: '🏠 부동산 청약' },
            { href: '/stock', label: '📈 주식 시세' },
            { href: '/apt/complex', label: '📖 단지백과' },
            { href: '/stock/compare', label: '⚖️ 종목 비교' },
            { href: '/daily/서울', label: '📰 데일리 리포트' },
            { href: '/apt/diagnose', label: '🎯 가점 계산기' },
          ].map(l => (
            <Link key={l.href} href={l.href} style={{ padding: '5px 10px', borderRadius: 'var(--radius-xs)', fontSize: 'var(--fs-xs)', fontWeight: 500, background: 'var(--bg-hover)', color: 'var(--text-secondary)', textDecoration: 'none', border: '1px solid var(--border)' }}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      {/* 페이지네이션 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--sp-sm)', marginTop: 'var(--sp-xl)', marginBottom: 'var(--sp-xl)' }}>
        {pageNum > 1 && (
          <Link href={`/blog?${category !== 'all' ? `category=${category}&` : ''}${sort !== 'latest' ? `sort=${sort}&` : ''}${q ? `q=${q}&` : ''}page=${pageNum - 1}`}
            style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
            ← 이전
          </Link>
        )}
        <span style={{ padding: '8px 14px', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{pageNum} 페이지</span>
        {hasMore && (
          <Link href={`/blog?${category !== 'all' ? `category=${category}&` : ''}${sort !== 'latest' ? `sort=${sort}&` : ''}${q ? `q=${q}&` : ''}page=${pageNum + 1}`}
            style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--brand)', color: 'var(--text-inverse)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
            다음 →
          </Link>
        )}
      </div>
      </div>

      {/* v3 커밋5 · 데스크탑 우측 레일 (≥1024px). '시리즈' 패널은 모바일에서
           카테고리 탭의 시리즈 링크와 중복이라 레일 안에만 둔다. */}
      {/* v7-D2 · 데스크탑 우측 레일 (≥1024px). ①인기 글 ②시리즈 ③태그 ④서비스.
           순서를 지시대로 인기 글 먼저로 바꿨다 — 시리즈보다 먼저 눌린다.
           전부 이미 받은 데이터라 새 조회 0건. */}
      <aside className="kd-list-rail" aria-label="블로그 요약">
        {(popularPosts ?? []).length > 0 && (
          <div className="kd-rail-panel">
            <h2>인기 글</h2>
            {(popularPosts ?? []).slice(0, 6).map((p: any) => (
              <Link key={p.id} href={`/blog/${p.slug}`}>{p.title}</Link>
            ))}
          </div>
        )}
        {topSeries.length > 0 && (
          <div className="kd-rail-panel">
            <h2>시리즈</h2>
            {topSeries.slice(0, 6).map((sr: any) => (
              <Link key={sr.slug} href={`/blog/series/${sr.slug}`}>{sr.title} · {sr.post_count}편</Link>
            ))}
          </div>
        )}
        {popularTags.length > 0 && (
          <div className="kd-rail-panel">
            <h2>태그</h2>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {popularTags.slice(0, 12).map((t) => (
                <Link
                  key={t.tag}
                  href={`/blog?q=${encodeURIComponent(t.tag)}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    minHeight: 30,
                    padding: '0 10px',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-sunken)',
                    color: 'var(--text-secondary)',
                    fontSize: 11,
                    fontWeight: 600,
                    textDecoration: 'none',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  #{t.tag}
                  <span style={{ fontSize: 9.5, opacity: 0.6 }}>{t.cnt}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
        <div className="kd-rail-panel">
          <h2>카더라 서비스</h2>
          <Link href="/apt">부동산 청약</Link>
          <Link href="/stock">주식 시세</Link>
          <Link href="/apt/complex">단지백과</Link>
          <Link href="/apt/diagnose">가점 계산기</Link>
        </div>
      </aside>
    </div>
  );
}
