/**
 * blog-seo-master — 발행 직전 SEO 위생 검사 + 자동 보강 orchestrator.
 *
 *  s189: 발행되는 모든 글이 SEO 100% 위생 (meta 80~165 / image≥3 / internal≥2 /
 *  EAT≥1) 을 갖도록 강제. 차단 (passes=false) + 경고 분리.
 *
 *  내부 호출:
 *    - blog-seo-utils.generateMetaDesc / generateImageAlt
 *    - internal-link-injector.injectInternalLinks
 *    - external-citations.injectExternalCitations
 */

import { generateMetaDesc, generateImageAlt } from '@/lib/blog-seo-utils';
import { injectInternalLinks } from '@/lib/internal-link-injector';
import { injectExternalCitations } from '@/lib/external-citations';

export const KOREAN_PROVINCES = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
  '수도권', '지방',
] as const;

const CATEGORY_DEFAULT_TAGS: Record<string, string[]> = {
  apt: ['청약', '부동산', '아파트'],
  unsold: ['미분양', '부동산', '아파트'],
  redev: ['재개발', '재건축', '부동산'],
  stock: ['주식', '투자', '시황'],
  finance: ['재테크', '투자', '경제'],
  general: ['뉴스', '경제', '커뮤니티'],
};

const CATS_REQUIRE_REGION = new Set(['apt', 'redev', 'unsold']);

export interface SeoMasterInput {
  title: string;
  content: string;
  category: string;
  slug?: string;
  meta_description?: string;
  image_alt?: string;
  tags?: string[];
  primary_keyword?: string;
  postId?: number | null;
}

export interface SeoMasterMetrics {
  meta_len: number;
  image_count: number;
  internal_link_count: number;
  external_link_count: number;
  h2_count: number;
  faq_count: number;
  title_len: number;
  content_len: number;
}

export interface SeoMasterResult {
  passes: boolean;
  score: number; // 0~100
  failed_checks: string[];
  warnings: string[];
  enriched: {
    title: string;
    content: string;
    meta_description: string;
    image_alt: string;
    tags: string[];
  };
  metrics: SeoMasterMetrics;
}

function countMatches(s: string, re: RegExp): number {
  const m = s.match(re);
  return m ? m.length : 0;
}

function computeMetrics(title: string, content: string, meta: string): SeoMasterMetrics {
  return {
    meta_len: meta.length,
    image_count: countMatches(content, /!\[[^\]]*\]\([^)]+\)/g),
    internal_link_count: countMatches(content, /\]\(\/(?!\/)/g),
    external_link_count: countMatches(content, /\]\(https?:\/\//g),
    h2_count: countMatches(content, /^## .+$/gm),
    faq_count: Math.max(
      countMatches(content, /^Q[.\s]/gm),
      countMatches(content, /^\*\*Q[.\s]/gm),
    ),
    title_len: title.length,
    content_len: content.length,
  };
}

/**
 * 발행 직전 SEO 위생 검사 + 자동 보강.
 */
export async function runBlogSeoMaster(
  sb: any,
  input: SeoMasterInput
): Promise<SeoMasterResult> {
  const failed: string[] = [];
  const warnings: string[] = [];

  // ── 1) 보강: meta_description / image_alt 자동 생성 (없거나 짧으면)
  let meta = (input.meta_description || '').trim();
  if (!meta || meta.length < 80) {
    meta = generateMetaDesc(input.content, input.title, input.category);
  }
  if (meta.length > 165) meta = meta.slice(0, 162) + '...';

  let imageAlt = (input.image_alt || '').trim();
  if (!imageAlt) imageAlt = generateImageAlt(input.category, input.title);

  // ── 2) 보강: 내부 링크 주입 (apt/redev/unsold entity 첫 등장)
  let content = input.content;
  try {
    content = await injectInternalLinks(sb, content, {
      title: input.title,
      category: input.category,
      maxLinks: 5,
      postId: input.postId ?? null,
    });
  } catch (e: any) {
    console.error('[seo-master] injectInternalLinks failed:', e?.message);
  }

  // ── 3) 보강: EAT 외부 인용 주입
  try {
    content = await injectExternalCitations(sb, content, input.category, 3);
  } catch (e: any) {
    console.error('[seo-master] injectExternalCitations failed:', e?.message);
  }

  // ── 4) 태그 보강
  let tags = Array.isArray(input.tags) ? input.tags.filter(Boolean) : [];
  if (tags.length < 3) {
    const defaults = CATEGORY_DEFAULT_TAGS[input.category] || CATEGORY_DEFAULT_TAGS.general;
    for (const d of defaults) if (!tags.includes(d)) tags.push(d);
  }
  if (tags.length > 10) tags = tags.slice(0, 10);

  // ── 5) 메트릭 산출 (보강 후)
  const metrics = computeMetrics(input.title, content, meta);

  // ── 6) 차단 (hard gates)
  if (metrics.image_count < 3) failed.push(`image_count<3 (${metrics.image_count})`);
  if (metrics.internal_link_count < 2) failed.push(`internal_link<2 (${metrics.internal_link_count})`);
  if (metrics.h2_count < 4) failed.push(`h2_count<4 (${metrics.h2_count})`);
  if (metrics.content_len < 1500) failed.push(`content_len<1500 (${metrics.content_len})`);
  if (metrics.title_len < 15 || metrics.title_len > 80) failed.push(`title_len_out_of_15_80 (${metrics.title_len})`);

  // ── 7) 경고 (soft warnings)
  if (metrics.image_count < 5) warnings.push(`image_count<5 (${metrics.image_count})`);
  if (metrics.internal_link_count < 4) warnings.push(`internal_link<4 (${metrics.internal_link_count})`);
  if (metrics.external_link_count < 1) warnings.push(`external_link<1`);
  if (metrics.faq_count < 3) warnings.push(`faq_count<3 (${metrics.faq_count})`);
  if (metrics.meta_len < 80 || metrics.meta_len > 165) warnings.push(`meta_len_out_of_80_165 (${metrics.meta_len})`);

  // ── 8) primary_keyword 첫 200자 등장 체크
  if (input.primary_keyword) {
    const head = content.slice(0, 200);
    if (!head.includes(input.primary_keyword)) {
      warnings.push(`primary_keyword_not_in_head_200 (${input.primary_keyword})`);
    }
  }

  // ── 9) 부동산 계열 카테고리는 지역명 1개 이상 권장
  if (CATS_REQUIRE_REGION.has(input.category)) {
    const head = content.slice(0, 600);
    const hasProvince = KOREAN_PROVINCES.some(p => head.includes(p));
    if (!hasProvince) warnings.push('region_name_not_in_head_600');
  }

  // ── 10) 점수 산출 (실패 = -10pt, 경고 = -3pt, base 100)
  const score = Math.max(0, 100 - failed.length * 10 - warnings.length * 3);
  const passes = failed.length === 0;

  return {
    passes,
    score,
    failed_checks: failed,
    warnings,
    enriched: {
      title: input.title,
      content,
      meta_description: meta,
      image_alt: imageAlt,
      tags,
    },
    metrics,
  };
}
