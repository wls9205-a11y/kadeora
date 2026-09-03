import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
// s240 W1: createSupabaseServer (cookies 의존) → getSupabaseAdmin (cookie-free) 전환.
// 메인 페이지 anonymous SSR — RLS 우회 OK. cache-control public 회복.
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { fetchAll } from '@/lib/db/fetchBatched';
import EmptyState from '@/components/EmptyState';
import { sanitizeSearchQuery } from '@/lib/sanitize';
import SectionShareButton from '@/components/SectionShareButton';
import CurationCarousel from '@/components/ui/CurationCarousel';
import ListThumb from '@/components/ui/ListThumb';
import { isSafeImage, blogHeroImage } from '@/lib/blog/safe-image';
import { facetRobots } from '@/lib/seo/facet';
import BlogCurationCard from '@/components/blog/BlogCurationCard';
import { cookies } from 'next/headers';
import { REGION_COOKIE, normalizeSido, SIDO_LIST } from '@/lib/region/cookie';
import SigunguChips from '@/components/apt/SigunguChips';
import BlogRegionCookieSync from '@/components/blog/BlogRegionCookieSync';
// s205-W2: HeroCard "오늘의 블로그" 제거 — 14d /blog 1,176 PV, 카드 클릭 1건. fetchBlogHero / getSupabaseAdmin 도 함께 제거.

function highlightTitle(title: string, query: string): React.ReactNode {
  if (!query) return title;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = title.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? // ⚠️ 하이라이트 틴트는 0.15 로 «남긴다». --brand-bg 는 0.08 이라 검색어 강조가
        //    본문에 묻힌다 — 표면 틴트와 강조 틴트는 «용도가 다른 값» 이다.
        <mark key={i} style={{ background: 'rgba(37,99,235,0.15)', color: 'var(--brand)', borderRadius: 'var(--radius-xs)', padding: '0 2px' }}>{part}</mark>
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

interface PageProps { searchParams: Promise<{ category?: string; sort?: string; q?: string; page?: string; sub?: string; region?: string; sgg?: string }> }

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
  // H5-3 — 현장 노트. ⚠️ 목록에서는 «일반 글과 같이» 낸다. 따로 띄우거나 위로 올리지 않는다 —
  //   담당이 쓴 글이라고 순위를 주면 그건 순위 신호가 아니라 우리 편의다.
  //   상세에서만 저자를 「분양 담당」으로 밝힌다.
  field_note: '현장 노트',
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

interface Props { searchParams: Promise<{ category?: string; sort?: string; q?: string; page?: string; sub?: string; region?: string; sgg?: string }> }

export default async function BlogPage({ searchParams }: Props) {
  const { category = 'all', sort = 'latest', q = '', page = '1', sub = '', region: regionRaw = '', sgg: sggRaw = '' } = await searchParams;

  /* ══ H5-3 지역 — «태그» 에서 «엔티티» 로 ═══════════════════════════════════
   *
   * 예전엔 `tags` 배열에 지역명이 들어 있는지로 걸렀다. blog_posts 에 지역 컬럼이
   * 없었기 때문이고, 그래서 3개 지역(부산 379 · 울산 84 · 경남 189)만 걸 수 있었다.
   *
   * A5 가 apt_site_id 를 붙이면서 달라졌다. 엔티티 기준이면 «17개 시도 전부» 에 글이 있다:
   *   서울 592 · 경기 491 · 부산 301 · 경남 244 · 전남 219 · 경북 216 · 충남 184
   *   울산 119 · 충북 113 · 대전 111 · 인천 108 · 대구 71 · 광주 42 · 강원 42
   *   전북 37 · 제주 37 · 세종 11        (발행 8,705 중 링크 2,938)
   *
   * ⚠️ `apt_region` 은 apt_site_id 에서 «파생» 된 컬럼이다. 트리거가 동기화한다 —
   *    손으로 채우지 말 것. 정본은 apt_site_id 다.
   * ⚠️ 값은 여전히 화이트리스트로 가둔다(normalizeSido). 임의 문자열이 쿼리로 들어가면
   *    파셋 URL 이 무한히 늘고 크롤 예산이 샌다.
   *
   * ⚠️ 부동산 탭과 «같은 쿠키» 를 본다. 두 탭이 다른 지역을 말하면 그건 고장으로 읽힌다.
   *    우선순위는 /apt 와 같다 — ?region= > 쿠키 > (없으면 전체).
   *    ⛔ 다만 여기서는 「없으면 부산」으로 «떨어뜨리지 않는다». 블로그의 기본은 전체 글이고,
   *       지역을 고른 적 없는 사람에게 한 지역만 보여줄 이유가 없다.
   */
  /* ⛔⛔ BF-0 (2026-08-31) — 지역은 «부동산의 축» 이다. 단일 소스로 게이트한다.
   *
   * 무엇이 났나: 부동산 탭에서 고른 「부산」이 REGION_COOKIE 에 남고, ?category=stock·life
   * 에서도 «복원» 돼 목록 쿼리에 걸렸다. 그런데 실측상 stock 2,882 · finance 269 ·
   * general 67 은 apt_region 이 «전건 NULL» 이다 — 부산 매칭 0 → 「아직 블로그 글이
   * 없어요」. 주식·재테크 목록이 통째로 비어 있었다.
   *
   * ⚠️ 탭의 「주식 2882」는 region 을 «안 거는» 다른 자(카테고리 카운트)라 크게 보였다 —
   *    건수와 목록이 다른 조건을 쓰고 있었다. 「같은 사실을 두 곳이 다르게」 그 자체다.
   * ⚠️ UI 에는 stock 예외가 «있었는데»(칩 활성 표시) 쿼리에는 없었다. 예외를 표시에만
   *    두면 화면은 맞고 결과는 틀린다. 그래서 조건을 하나로 모은다.
   *
   * ⛔ category='all' 에서도 지역을 걸지 않는다. 전체 탭은 «필터 없는 전체» 다 —
   *    부산을 걸면 apt_region NULL 인 주식·재테크가 전부 빠져 전체가 부동산화된다.
   * ⚠️ 비부동산 문맥에 region·sgg 파라미터가 붙어 들어오면 «에러 없이 무시» 한다.
   *    빈 목록보다 전체가 낫다(기존 낙하 원칙 그대로).
   * ⚠️ 쿠키 스키마는 건드리지 않았다 — «복원 조건» 만 게이트한다.
   */
  const REGION_CATEGORIES = new Set(['realestate', 'apt', 'unsold', 'redev']);
  const regionAllowed = REGION_CATEGORIES.has(category);

  const cookieRegion = normalizeSido((await cookies()).get(REGION_COOKIE)?.value ?? null);
  const region = regionAllowed ? (normalizeSido(regionRaw) ?? cookieRegion ?? '') : '';
  const sgg = region ? (sggRaw || '').trim() : '';
  const pageNum = Math.max(1, parseInt(page) || 1);
  const perPage = 30;
  const sb = getSupabaseAdmin();
  // s205-W2: blogHero (HeroCard) 제거 — 효용 0 (클릭 1건/14d).

  /* 카테고리 건수 + 인기태그 — 병렬 조회
   *
   * ⛔ 「인기 글」 조회를 걷어냈다(2026-08-27).
   *    근거가 `blog_posts.view_count` 인데 그 값이 합성으로 보인다 — 실측:
   *    발행 8,705편 중 7,702편이 >0, 평균 56.5 → 합계 약 49만.
   *    그런데 `page_views` 테이블의 최근 30일 `/blog/` 실조회는 «2,617건» 이다.
   *    `apt_sites.page_views` 를 「많이 보는 현장」에서 걷어낸 것과 같은 100배 괴리다.
   *    ⚠️ 컬럼과 `blog_popular_tags` RPC 는 «남긴다». 화면에서만 뺀다 —
   *       계측이 붙어 값이 실측이 되면 그때 되살린다(라벨만 승격).
   */
  const [catCountsR, tagsR, subcatR] = await Promise.allSettled([
    sb.rpc('blog_category_counts'),
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
  // H5-3 — 파생 컬럼 한 줄. 조인도 태그도 아니다(위 주석).
  if (region) q2 = q2.eq('apt_region', region);
  if (sgg) q2 = q2.eq('apt_sigungu', sgg);
  if (q) { const sq = sanitizeSearchQuery(q, 100); if (sq) q2 = q2.or(`title.ilike.%${sq}%,excerpt.ilike.%${sq}%`); }
  // ⛔ sort=popular 를 없앴다(위 주석 — view_count 가 합성값이다). 최신순만 남는다.
  //    ⚠️ 옛 `?sort=popular` 링크가 들어와도 «에러 없이» 최신순으로 떨어진다.
  q2 = q2.order('created_at', { ascending: false });
  q2 = q2.range((pageNum - 1) * perPage, pageNum * perPage - 1);
  const { data: posts, count: filteredCount } = await q2;

  /* H5-3 — 첫 카드 승격. 1페이지·검색 아닐 때만. 목록의 머리를 그대로 쓴다. */
  const canPromote = pageNum === 1 && !q && (posts ?? []).length > 0;
  /* M4-2(Q4ⓐ) — 승격은 «부동산 최신 1건» 이 먼저다.
   * ⚠️ 주식 자동발행이 최신순 머리를 늘 차지해 부동산 80% 방침과 역행하는 자리였다.
   *    이미 받은 목록(지역·카테고리 반영)에서 부동산 첫 글을 고르고, 없으면 머리로 폴백한다.
   * ⛔ 별도 조회를 만들지 않는다. */
  const promotedIdx = canPromote
    ? (() => {
        const arr = (posts ?? []) as any[];
        const k = arr.findIndex((x) => x?.category === 'realestate');
        return k >= 0 ? k : 0;
      })()
    : -1;
  const promoted: any = promotedIdx >= 0 ? (posts as any[])[promotedIdx] : null;
  const listPosts: any[] = promotedIdx >= 0
    ? (posts as any[]).filter((_, k) => k !== promotedIdx)
    : ((posts ?? []) as any[]);

  /* H5-3 — 구군 칩 건수. ⚠️ 배지는 «현장 수» 다(글 수 아님).
   *   글 수로 세면 한 현장에 16편이 붙은 구가 실제 현장은 1곳인데 가장 커 보인다
   *   (실측: 알티에로 광안 16편). 지역을 안 골랐으면 조회하지 않는다. */
  let sggChips: { name: string; count: number }[] = [];
  if (region) {
    try {
      const { data: sc, error: scErr } = await (sb as any).rpc('get_blog_sigungu_counts', { p_region: region });
      // ⛔ 조용히 넘기지 않는다 — 빈 칩 줄과 조회 실패가 로그에서 구분돼야 한다.
      if (scErr) console.error(`[blog] sigungu counts ${region}: ${scErr.message?.slice(0, 160)}`);
      else sggChips = ((sc ?? []) as any[]).map((r) => ({ name: r.sigungu as string, count: Number(r.site_count) || 0 }));
    } catch (e: any) {
      console.error('[blog] sigungu counts caught:', e?.message ?? String(e));
    }
  }

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
    // 목록과 «같은» 모집단이어야 한다 — 조건이 갈리면 다음 페이지가 어긋난다.
    if (region) nq = nq.eq('apt_region', region);
    if (sgg) nq = nq.eq('apt_sigungu', sgg);
    nq = nq.order('created_at', { ascending: false });   // 목록과 «같은» 정렬
    nq = nq.range(pageNum * perPage, pageNum * perPage + 4);
    const { data: np } = await nq;
    nextPagePosts = np || [];
  } catch {}

  /* H4-5 · 현장별 묶음 — `v_apt_related_blogs`(4,597행)가 있는데 블로그 목록이 안 썼다.
   * 부동산 글이 «어느 현장 이야기인지» 를 목록에서 알 수 없었다.
   *
   * ⚠️ 본체 조회 뭉치에 «합치지 않는다» (Rule #49). 실패하면 이 줄만 사라진다.
   * ⚠️ `…미분양`·`…재개발` 같은 «집계 유사현장» 은 뺀다. 그건 단지가 아니라 시군구 묶음이라
   *    「현장별」이라는 말이 거짓이 된다 (홈 §1-1 에서 같은 이유로 걸러냈다).
   * ⚠️ 2편 미만은 «묶음» 이 아니다. 1편짜리를 줄줄이 내면 목록을 두 번 보여주는 꼴이다.
   * 실측(2026-08-26): 부울경 339곳이 이 뷰에 있고, 2편 이상은 소수다 —
   *    상위가 `알티에로 광안` 16편이고 나머지는 2~4편이다. 그래서 6개만 낸다. */
  type AptGroup = { slug: string; name: string; region: string | null; sigungu: string | null; n: number };
  let aptGroups: AptGroup[] = [];
  try {
    /* ⚠️ `.limit(4000)` 으로는 4,597행을 다 못 받는다 — PostgREST `db-max-rows` 가 1,000 이라
     *    클라이언트 limit 이 그걸 못 넘는다. 1,000행만 세면 집계가 통째로 틀린다
     *    (실측: 잘린 상태에서 최다 그룹이 2편으로 보였는데 실제 1위는 16편이다). */
    const rel = await fetchAll(sb, 'v_apt_related_blogs', 'apt_slug', (qq: any) => qq);
    const tally = new Map<string, number>();
    for (const r of (rel ?? []) as { apt_slug: string | null }[]) {
      const k = (r.apt_slug ?? '').trim();
      if (k) tally.set(k, (tally.get(k) ?? 0) + 1);
    }
    /* ⚠️ 전국 상위 N 을 먼저 자른 뒤 지역으로 거르면 «거의 안 남는다».
     *    실측: 전국 상위 40 중 부산·울산·경남은 «1곳» 뿐이고, 실제 자격자는 36곳이다.
     *    그래서 자르지 말고 «해당 지역 슬러그 집합» 과 교집합을 낸다.
     * ⚠️ `.in()` 에 844개를 넣지 않는다 — URL 이 터진다. 지역 목록을 페이지로 받아
     *    (fetchAll = PostgREST 1,000행 상한 우회) JS 에서 교집합한다.
     * ⚠️ H5-3 — 지역을 «고른 경우 그 지역» 으로 본다. 세그먼트는 서울을 가리키는데
     *    이 묶음만 부산 현장을 내면 한 화면이 두 지역을 말한다. 안 골랐으면 기존대로. */
    const ge2 = [...tally.entries()].filter(([, n]) => n >= 2);
    if (ge2.length > 0) {
      const sites = await fetchAll(
        sb,
        'apt_sites',
        'slug, name, region, sigungu',
        (qq: any) => region
          ? qq.eq('is_active', true).eq('region', region)
          : qq.eq('is_active', true).in('region', ['부산', '울산', '경남']),
      );
      const NOT_A_SITE = /(미분양|재개발|재건축|정비)\s*$/;
      const bySlug = new Map<string, any>(
        (sites ?? [])
          .filter((x: any) => x?.slug && x?.name && !NOT_A_SITE.test(String(x.name)))
          .map((x: any) => [String(x.slug), x]),
      );
      aptGroups = ge2
        .map(([slug, n]) => { const x = bySlug.get(slug); return x ? { slug, name: x.name, region: x.region, sigungu: x.sigungu, n } : null; })
        .filter((x): x is AptGroup => !!x)
        .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'ko'))
        .slice(0, 6);
    }
  } catch (e) {
    console.error('[blog] apt groups failed:', e);   // 삼키지 않는다 — 조용히 비면 원인을 못 찾는다
  }

  const hasMore = (posts ?? []).length === perPage;

  // 글이 많은 시리즈 (1페이지, 카테고리 전체일 때만)
  // ⚠️ DS-3-2 (구 H7-5 인수) — 예전 라벨은 「인기 시리즈」였다. 그런데 정렬 키가
  //    post_count 다 — «읽힌 횟수가 아니라 글 개수» 다. 「인기」는 데이터가
  //    뒷받침하지 않는 주장이었다(「인기순」·「많이 보는 현장」과 «같은 종류» 의 결함).
  // ⛔ 라벨을 데이터에 맞춘다. 정렬을 조회수로 바꾸지 «않는다» — 그 컬럼이 합성값이다.
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

  // ⛔ 「인기글 우선」 이던 큐레이션 선정을 걷어냈다 — 근거 컬럼이 합성값이다(위 주석).
  //    H5-3 이후 승격은 «목록의 첫 글» 하나뿐이라(promoted) 이 배열은 더 쓰지 않는다.

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
      {/* V4-3 — 서브마스트. 단색 --brand-navy + 하단 골드 2px.
          ⚠️ h1 을 «지우지 않고» sr-only 로 내렸다. 문자열은 「블로그」 그대로다 —
             색인이 받는 것을 바꾸지 않는다(판정회신 증분3 ④). 서브마스트 제목은
             heading 이 아니라 «시각 라벨» 이라 문서의 제목은 여전히 하나뿐이다.
          ⚠️ `.blog-summary` 는 speakable JSON-LD 의 cssSelector(['h1','.blog-summary'])가
             «이름으로» 잡는 자리다. 클래스를 서브마스트 보조 줄로 «옮겼다» — 지우면
             네이버 음성검색이 짚을 것이 사라진다. 그래서 텍스트를 두 벌로 만들지 않고
             보이는 쪽 한 벌에 클래스를 붙였다. */}
      <h1 className="sr-only">블로그</h1>
      <div className="kd-submast kd-submast--bleed">
        <div className="kd-submast__row">
          <div className="kd-submast__title">부정공 칼럼</div>
        </div>
        <div className="kd-submast__sub blog-summary">
          매일 업데이트되는 투자 인사이트 · {totalCount.toLocaleString()}편
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--sp-xs)', margin: 'var(--sp-sm) 0 var(--sp-md)' }}>
        <SectionShareButton section="blog" label="투자 정보 블로그 7,600편+" pagePath="/blog" />
      </div>

      {/* 검색 */}
      <form action="/blog" method="GET" style={{ marginBottom: 'var(--sp-md)', position: 'relative' }}>
        {category !== 'all' && <input type="hidden" name="category" value={category} />}
        {sort !== 'latest' && <input type="hidden" name="sort" value={sort} />}
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-tertiary)' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input name="q" defaultValue={q} placeholder="블로그 검색" style={{
          width: '100%', minHeight: 'var(--touch-min)', padding: '0 var(--sp-md) 0 38px', fontSize: 'var(--fs-xs)', fontWeight: 500,
          borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)',
          color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none',
        }} />
      </form>

      {/* 부동산 탭과 같은 쿠키에 남긴다. 두 탭이 다른 지역을 말하면 고장으로 읽힌다.
           ⛔ BF-0 — 부동산 문맥에서만 쓴다. 비부동산 탭에서 빈 값을 써 넣으면
              부동산 탭의 선택을 «지워» 버린다(반대 방향 누수). */}
      {regionAllowed && <BlogRegionCookieSync region={region} />}

      {/* ── H5-3 · 지역 세그먼트 ──
           ⛔ 「부울경」이라 쓰지 않는다. 엔티티 기준으로 17개 시도 전부에 글이 있다.
           ⚠️ 「주식」은 지역이 아니라 «카테고리» 다. 한 줄에 두긴 하되 aria-label 을
              「지역」이라 쓰지 않는다 — 스크린리더에 거짓말을 하게 된다.
           ⚠️ 「인기」 라벨을 쓰지 않는다 — 순위를 만들 신호가 없다.
           ⚠️ 시도 «타일 그리드» 는 넣지 않는다. 글 수 편중이 그대로 드러난다
              (서울 592 대 세종 11). 부동산 탭의 타일과 역할이 다르다. */}
      <nav aria-label="빠른 분류" className="apt-pill-scroll" style={{ display: 'flex', gap: 'var(--sp-xs)', marginBottom: 'var(--sp-sm)', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {[
          /* ⛔ BF-0 — 시도 칩은 부동산 문맥에서만. 걸리지도 않는 필터를 보여 주지 않는다.
             ⚠️ 「주식」 칩은 «남긴다» — 이 줄이 지금 첫 화면의 유일한 주식 진입점이고,
                탭은 아직 네 층 아래다. BF-1(탭 최상단 이동) 뒤 BF-2 에서 제거한다.
                지금 같이 빼면 주식으로 갈 길이 첫 화면에서 사라진다. */
          ...(regionAllowed
            ? [{ k: '', label: '전체', cat: '' }, ...SIDO_LIST.map((r) => ({ k: r, label: r, cat: '' }))]
            : []),
          { k: '', label: '주식', cat: 'stock' },
        ].map(({ k, label, cat }) => {
          const on = cat ? category === cat : region === k && category !== 'stock';
          const qs = new URLSearchParams();
          if (cat) qs.set('category', cat);
          else if (category !== 'all' && category !== 'stock') qs.set('category', category);
          if (q) qs.set('q', q);
          if (k) qs.set('region', k);
          const href = qs.toString() ? `/blog?${qs}` : '/blog';
          return (
            <Link
              key={label}
              href={href}
              scroll={false}
              aria-current={on ? 'true' : undefined}
              style={{
                flexShrink: 0,
                // ⚠️ DS-3-2 — 누를 수 있는 칩은 44px 이상(DS ② Chip 표준).
                //    시각 높이는 padding 이 정하고, «터치 높이» 는 minHeight 가 보장한다.
                // V4-3 — 값은 --touch-min 이 진다(판정회신 증분2 B). 44 를 손으로 적지 않는다:
                //    :root 46 · font-small 44 · font-large 52 로 전 모드가 하한 위이고
                //    글꼴 모드를 자동으로 따라온다.
                minHeight: 'var(--touch-min)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: '5px var(--sp-md)',
                borderRadius: 'var(--radius-pill)',
                fontSize: 'var(--fs-xs)', fontWeight: 500, letterSpacing: 0,
                // ⚠️ 선택색을 인라인으로 주지 않는다 — 인라인은 모든 @layer 를 이겨
                //    screens.css 의 네이비 규칙이 안 먹는다. 클래스에 맡긴다.
                background: on ? undefined : 'var(--bg-surface)',
                border: '1px solid var(--border)',
                color: on ? undefined : 'var(--text-secondary)',
                textDecoration: 'none',
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* ── H5-3 · 구군 칩 ──
           ⚠️ 배지는 «현장 수» 다. 글 수가 아니다 — 한 현장에 16편이 붙은 구가
              실제 현장은 1곳인데 가장 커 보인다(실측: 알티에로 광안 16편).
           ⚠️ /apt 와 «같은» SigunguChips 를 쓴다. 두 벌이 되면 선택 표시가 갈린다. */}
      {region && (
        <SigunguChips
          region={region}
          items={sggChips}
          current={sgg}
          hrefFor={(s) => {
            const p2 = new URLSearchParams();
            p2.set('region', region);
            if (s) p2.set('sgg', s);
            if (q) p2.set('q', q);
            if (category !== 'all') p2.set('category', category);
            return `/blog?${p2}`;
          }}
        />
      )}

      {/* M4-2(Node 9/3) — 「현장별로 모아 보기」 칩 줄을 걷었다.
           목록 위에서 폭을 먹으면서 «글» 이 아니라 «현장» 으로 나가는 줄이었다.
           ⚠️ 데이터·라우트는 그대로다 — 현장별 글 묶음 진입은 현장 상세의 관련 분석 링크가 진다. */}

      {/* 카테고리 탭 — V4 언더라인 문법(.kd-utabs / .kd-utab).
          ⚠️ 이건 «필터가 아니라 뷰 전환» 이다(증분6 의미론). 아래 주석이 말하듯
             「색인된 URL 을 지고 있는 주 내비게이션」이라 접지도 않는다 — 탭이 맞다.
          ⚠️ V4-3 이 여기를 «놓쳤다». 여백만 회수하고 활성색은 --brand(파랑) 언더라인으로
             남겨 둬서, 같은 화면에 파랑 언더라인(탭)과 네이비(서브칩)가 같이 서 있었다.
             활성색 인벤토리(증분10 ①)를 돌리다 잡혔다.
          활성 = 네이비 텍스트 + 600 + 골드 언더라인 2px «3중 신호» 를 .kd-utab 이 진다. */}
      <div className="kd-utabs" style={{ marginBottom: 'var(--sp-md)' }}>
        {CATS.map(c => (
          <Link key={c.key} href={`/blog${c.key !== 'all' ? `?category=${c.key}` : ''}${sort !== 'latest' ? `${c.key !== 'all' ? '&' : '?'}sort=${sort}` : ''}${q ? `${c.key !== 'all' || sort !== 'latest' ? '&' : '?'}q=${q}` : ''}`}
            className="kd-utab"
            aria-current={activeTab === c.key ? 'true' : undefined}
            style={{ fontSize: 'var(--fs-sm)', gap: 'var(--sp-xs)' }}>
            {c.label}
            <span style={{ fontSize: 'var(--fs-xs)', opacity: 0.6 }}>{tabCount(c.key)}</span>
          </Link>
        ))}
        {/* 시리즈는 «탭이 아니라 다른 화면으로 나가는 링크» 다 — 활성 상태를 갖지 않는다.
            그래서 aria-current 를 주지 않는다(줄 수도 없다). 같은 줄에 서지만 성격이 다르다. */}
        <Link href="/blog/series" className="kd-utab" style={{ fontSize: 'var(--fs-sm)', gap: 'var(--sp-xs)' }}>
          시리즈
        </Link>
      </div>

      <div className="kd-band" aria-hidden="true" />

      {/* 검색 결과 안내 */}
      {q && (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-md)' }}>
          &quot;{q}&quot; 검색 결과 {(posts ?? []).length}건
        </div>
      )}

      {/* ── H5-3 · 첫 카드 «1편» 승격 ──
           3편 캐러셀을 1편으로 줄였다. 캐러셀은 두 번째·세 번째 카드가 화면 밖이라
           사실상 1편만 보였고, 그러면서 세로를 카드 높이만큼 먹었다.
           ⚠️ 선정은 «지금 보고 있는 목록의 첫 글» 이다. 별도 조회를 만들지 않는다 —
              지역·카테고리·검색을 다 반영한 그 목록의 머리여야 「이 지역 최신」이 맞다.
           ⚠️ 승격한 글은 아래 목록에서 «뺀다». 같은 글이 카드와 줄로 두 번 나오면
              한 화면에서 자리 하나를 버리는 셈이다.
           ⚠️ tone="navy" — 한 화면의 네이비 덩어리는 이 카드 «하나» 다. */}
      {promoted && (
        <div style={{ marginBottom: 'var(--sp-md)' }}>
          <BlogCurationCard
            post={promoted}
            img={postImageMap[promoted.id]}
            cover={listThumb(promoted, postImageMap) ?? blogHeroImage(promoted)}
            catLabel={POST_CAT_LABEL[promoted.category] || promoted.category || '분석'}
            catColor={CAT_COLORS[promoted.category] || 'var(--text-tertiary)'}
            tone="navy"
          />
        </div>
      )}

      {/* 글 목록 — .kd-lrow */}
      {(posts ?? []).length === 0 ? (
        <EmptyState
          icon=""
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
          {listPosts.map((p: any, i: number) => {
            const catColor = CAT_COLORS[p.category] || 'var(--text-tertiary)';
            const catLabel = POST_CAT_LABEL[p.category] || p.category;
            const readMin = p.reading_time_min || 3;
            const d = new Date(p.created_at || Date.now());
            const now = Date.now();
            const diff = now - d.getTime();
            const dateStr = diff < 86400000 ? '오늘' : diff < 172800000 ? '어제' : diff < 604800000 ? `${Math.floor(diff / 86400000)}일 전` : d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
            // V4-3 — 썸네일은 «상위 2건만». 이미지 승격이 목록 전체에 걸리면 밀도가
            // 카드로 돌아간다(§1-1 「목록을 카드로 만들지 않는다」). 나머지는 텍스트 행이다.
            const withThumb = i < 2;
            return (
              // v3 커밋5: 요약(excerpt)을 뺐다 — 모바일에서 16건 전부 한 줄 말줄임으로 잘려
              // 정보 구실을 못 했다. 그 폭을 제목 2줄에 몰아준다.
              // 좌측 칩 = 분류, 우측 = 발행일 + 읽는 시간.
              <Link key={p.id} href={`/blog/${p.slug}`} className={withThumb ? 'kd-lrow kd-lrow--thumb' : 'kd-lrow'} style={{ textDecoration: 'none', color: 'inherit' }}>
                {/* v4-C7-2: 판정은 safe-image.ts 한 곳에서만 한다 — 새 함수를 만들면
                    OG 판정과 목록 판정이 갈린다. 외부 스크랩(발행분 24.7%)은 통과시키지 않는다.
                    ⚠️ 폴백을 생성 OG 카드로 두지 않았다 (C7-1 과 같은 이유):
                       텍스트 카드라 64px 에서 글씨가 안 보인다. 같은 크기 이니셜 블록이 낫다.
                    ⚠️ 썸네일이 없는 행도 «칸을 비우지 않는다» — .kd-lrow 는 3열 그리드라
                       첫 칸이 사라지면 제목이 좌측으로 밀려 상·하위 행의 축이 어긋난다.
                       그래서 빈 span 하나로 칸을 지킨다(폭 0 이라 밀도는 그대로다). */}
                {withThumb ? <ListThumb src={listThumb(p, postImageMap)} name={p.title || ''} /> : <span />}

                <span style={{ minWidth: 0 }}>
                  <h2 className="kd-lrow-t is-two" style={{ margin: 0 }}>
                    <span className="kd-lrow-badge" style={{ background: `${catColor}1A`, color: catColor }}>
                      {catLabel}
                    </span>
                    {q ? highlightTitle(p.title, q) : p.title}
                  </h2>
                  {/* ⛔ V4-3 — 「👀 조회수」와 「HOT」을 걷어냈다. 둘 다 근거가
                      `blog_posts.view_count` 인데 그 값이 «합성» 이다 — 실측(위 주석):
                      발행분 합계 약 49만 vs page_views 30일 실조회 2,617건, 100배 괴리.
                      저장소는 이미 인기순·인기글·큐레이션 선정을 같은 이유로 걷어냈고
                      「컬럼과 RPC 는 남기고 화면에서만 뺀다」가 그때의 판정이다.
                      이 두 곳이 «남아 있었다» — HOT 은 같은 값이 라벨만 갈아입은 것이라
                      조회수만 지우면 근거 없는 최상급이 그대로 산다(§2-2 · 「인기」 금칙의 연장).
                      ⚠️ 계측이 붙어 값이 실측이 되면 그때 되살린다. 컬럼은 그대로 둔다. */}
                  {((p.comment_count || 0) > 0 || (p.helpful_count || 0) > 0) && (
                    <span className="kd-lrow-m">
                      {(p.comment_count || 0) > 0 && <span className="kd-lrow-m-fix">{p.comment_count}</span>}
                      {(p.helpful_count || 0) > 0 && <span className="kd-lrow-m-fix" style={{ color: 'var(--accent-green)' }}>👍 {p.helpful_count}</span>}
                    </span>
                  )}
                </span>

                <span className="kd-lrow-r">
                  {dateStr}
                  <span style={{ display: 'block', marginTop: 1, fontSize: 'var(--fs-3xs)', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                    {readMin}분
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── H4-5 · 접기 ──
           8,718편인데 첫 화면에 글이 안 보였다. 서브칩 · 정렬 · 인기태그 · 인기글이
           목록보다 «위» 에 있었기 때문이다. 세 블록을 목록 아래로 내리고 접었다.
           ⚠️ 지운 게 아니다. 링크·파라미터·쿼리 전부 그대로다 — 열면 예전 그대로 나온다.
           ⚠️ 카테고리 탭은 «접지 않는다». 색인된 URL 을 지고 있는 주 내비게이션이다. */}
      <details style={{ margin: 'var(--sp-md) 0 var(--sp-lg)' }}>
        <summary
          style={{
            cursor: 'pointer', listStyle: 'revert',
            padding: 'var(--sp-sm) 2px',
            fontSize: 'var(--fs-xs)', fontWeight: 500, letterSpacing: 0,
            color: 'var(--text-secondary)',
          }}
        >
          세부 분류
        </summary>
      {/* 서브카테고리 칩
          V4-3 — 서브칩을 «기존 네이비 표준» 에 얹었다(판정회신 증분6 단서).
          .apt-pill-scroll a[aria-current='true'] 가 screens.css 에 이미 있고
          「H5 에서 선택은 전 화면 공통으로 네이비」가 그때의 판정이다.
          여기만 인라인 --brand(파랑)로 갈라져 있었다 — 새 표준을 만들지 않고 붙였다.
          ⚠️ 선택색을 인라인으로 주지 «않는다». 인라인은 모든 @layer 를 이겨
             screens.css 의 네이비 규칙이 안 먹는다(같은 파일 위쪽에 같은 주의가 있다). */}
      {subChips && (
        <div className="apt-pill-scroll" style={{ display: 'flex', gap: 'var(--sp-xs)', marginBottom: 'var(--sp-sm)', overflowX: 'auto', scrollbarWidth: 'none' }}>
          <Link href={`/blog?category=${category}${sort !== 'latest' ? `&sort=${sort}` : ''}${q ? `&q=${q}` : ''}`}
            aria-current={!sub ? 'true' : undefined}
            style={{
              padding: 'var(--sp-xs) var(--sp-md)', minHeight: 'var(--touch-min)', display: 'inline-flex', alignItems: 'center', borderRadius: 'var(--radius-pill)', fontSize: 'var(--fs-xs)', fontWeight: !sub ? 600 : 500,
              background: !sub ? undefined : 'var(--bg-hover)',
              color: !sub ? undefined : 'var(--text-tertiary)',
              textDecoration: 'none', flexShrink: 0, border: '1px solid var(--border)',
            }}>
            전체
          </Link>
          {subChips.map(sc => (
            <Link key={sc.key} href={`/blog?category=${category}&sub=${sc.key}${sort !== 'latest' ? `&sort=${sort}` : ''}${q ? `&q=${q}` : ''}`}
              aria-current={sub === sc.key ? 'true' : undefined}
              style={{
                padding: 'var(--sp-xs) var(--sp-md)', minHeight: 'var(--touch-min)', display: 'inline-flex', alignItems: 'center', borderRadius: 'var(--radius-pill)', fontSize: 'var(--fs-xs)', fontWeight: sub === sc.key ? 600 : 500,
                background: sub === sc.key ? undefined : 'var(--bg-hover)',
                color: sub === sc.key ? undefined : 'var(--text-tertiary)',
                textDecoration: 'none', flexShrink: 0, border: '1px solid var(--border)',
              }}>
              {sc.label}
              <span style={{ marginLeft: 4, fontSize: 'var(--fs-3xs)', opacity: 0.65 }}>{sc.cnt}</span>
            </Link>
          ))}
        </div>
      )}

      {/* 정렬 + 인기태그 인라인 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-lg)' }}>
        <div style={{ display: 'flex', gap: 'var(--sp-xs)' }}>
          {/* ⛔ 「인기순」을 뺐다 — 근거 컬럼이 합성값이다(위 주석). 최신순만 남는다. */}
          {[
            { key: 'latest', label: '최신순' },
          ].map(s => (
            <Link key={s.key} href={`/blog?${category !== 'all' ? `category=${category}&` : ''}sort=${s.key}${q ? `&q=${q}` : ''}`}
              style={{
                minHeight: 44, display: 'inline-flex', alignItems: 'center',
                padding: 'var(--sp-xs) var(--sp-md)', borderRadius: 'var(--radius-xs)', fontSize: 'var(--fs-2xs)', fontWeight: 600,
                background: sort === s.key ? 'var(--brand)' : 'transparent',
                color: sort === s.key ? 'var(--text-inverse)' : 'var(--text-tertiary)',
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
                style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center',
                  fontSize: 'var(--fs-3xs)', color: 'var(--text-tertiary)', padding: '3px var(--sp-sm)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border)', whiteSpace: 'nowrap', textDecoration: 'none' }}>
                #{t.tag}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ⛔ 「인기 글」 블록을 걷어냈다 — 근거 컬럼이 합성값이다(위 주석).
           계측이 붙어 실측이 되면 그때 되살린다. */}

      </details>

      <div className="kd-band" aria-hidden="true" />

      {/* 인기 시리즈 (SEO 내부링크) */}
      {/* 세션70: 블로그 목록 회원가입 유도 */}
      {pageNum === 1 && !q && (
        <div style={{
          margin: 'var(--sp-md) 0', padding: 'var(--sp-md) var(--sp-lg)', borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, var(--brand-bg), var(--accent-green-bg))',
          border: '1px solid var(--brand-border)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>매일 투자 분석 받아보기</div>
            <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-secondary)' }}>가입하면 전체 글 무제한 · 알림까지 무료</div>
          </div>
          <Link href="/login?redirect=/blog" style={{
            padding: 'var(--sp-sm) var(--sp-lg)', borderRadius: 'var(--radius-pill)',
            background: 'var(--kakao-bg)', color: 'var(--kakao-text)',
            fontWeight: 500, fontSize: 'var(--fs-2xs)', textDecoration: 'none', flexShrink: 0,
          }}>가입</Link>
        </div>
      )}
      {topSeries.length > 0 && (
        <div style={{ marginTop: 'var(--sp-2xl)', padding: 'var(--sp-lg)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>글이 많은 시리즈</span>
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

      {/* M4-2 — 「다음 페이지 미리보기」를 지웠다. 페이지네이션과 기능이 겹치는데
           목록처럼 생겨서 «어디까지가 이 페이지인지» 를 흐렸다. */}

      {/* 관련 서비스 (내부 링크 — SEO 교차 참조) */}
      <div style={{ padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', marginTop: 'var(--sp-md)' }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--sp-sm)' }}>카더라 서비스</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[
            { href: '/apt', label: '부동산 청약' },
            { href: '/stock', label: '주식 시세' },
            { href: '/apt/complex', label: '단지백과' },
            { href: '/stock/compare', label: '⚖️ 종목 비교' },
            { href: '/daily/서울', label: '📰 데일리 리포트' },
            { href: '/apt/diagnose', label: '🎯 가점 계산기' },
          ].map(l => (
            <Link key={l.href} href={l.href} style={{ padding: '5px var(--sp-md)', borderRadius: 'var(--radius-xs)', fontSize: 'var(--fs-xs)', fontWeight: 500, background: 'var(--bg-hover)', color: 'var(--text-secondary)', textDecoration: 'none', border: '1px solid var(--border)' }}>
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
      {/* v7-D2 · 데스크탑 우측 레일 (≥1024px). ①시리즈 ②태그 ③서비스.
           ⛔ 「인기 글」 패널을 걷어냈다 — 근거 컬럼이 합성값이다(위 주석).
           전부 이미 받은 데이터라 새 조회 0건. */}
      <aside className="kd-list-rail" aria-label="블로그 요약">
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
