import { SITE_URL } from './constants';
import type { Metadata } from 'next';

/**
 * 카더라 공통 SEO 메타데이터 생성 헬퍼 v2
 * - og-square 630×630 자동 포함 (네이버 모바일 1:1 크롭 대응)
 * - max-image-preview:large, max-snippet:-1 자동 적용
 * - naver:written_time 안정화 (publishedAt 없으면 고정값)
 * - article:tag 지원
 */

/**
 * s224 T1A: hreflang self-reference 헬퍼.
 * 한국어 단독 사이트 — ko / x-default 모두 현재 페이지 URL 로 자기참조.
 * 글로벌 layout.tsx 의 hardcoded alternates.languages 는 제거됨 (모든 페이지가 root URL 로 가리키던 회귀).
 *
 * 사용: generateMetadata 내부에서 alternates: buildAlternates(`/calc/${category}/${slug}`)
 * 또는 alternates: buildAlternates(path, overrideCanonical) — canonical 다른 URL 로 가리킬 때.
 */
export function buildAlternates(pathname: string, canonicalOverride?: string): Metadata['alternates'] {
  const url = `${SITE_URL}${pathname}`;
  const canonical = canonicalOverride || url;
  return {
    canonical,
    languages: {
      'ko': url,
      'x-default': url,
    },
  };
}

interface BuildMetaOptions {
  title: string;
  description: string;
  path: string;
  section?: string;
  author?: string;
  ogDesign?: number;
  ogCategory?: string;
  ogSubtitle?: string;
  keywords?: string;
  tags?: string[];
  noindex?: boolean;
  publishedAt?: string;
  type?: 'website' | 'article';
}

const BUILD_DATE = new Date().toISOString();

export function buildMeta(opts: BuildMetaOptions): Metadata {
  const {
    title, description, path, section, author = '카더라',
    ogDesign = 2, ogCategory, ogSubtitle, keywords, tags,
    noindex = false, publishedAt, type = 'website',
  } = opts;

  const url = `${SITE_URL}${path}`;
  const stableDate = publishedAt || BUILD_DATE;
  const ogParams = new URLSearchParams({ title, design: String(ogDesign) });
  if (ogCategory) ogParams.set('category', ogCategory);
  if (ogSubtitle) ogParams.set('subtitle', ogSubtitle);
  if (author !== '카더라') ogParams.set('author', author);
  const ogUrl = `${SITE_URL}/api/og?${ogParams.toString()}`;
  const ogSquareUrl = `${SITE_URL}/api/og-square?title=${encodeURIComponent(title)}&category=${ogCategory || 'blog'}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    ...(noindex
      ? { robots: { index: false, follow: false } }
      : { robots: { index: true, follow: true, 'max-image-preview': 'large' as const, 'max-snippet': -1 as const, 'max-video-preview': -1 as const } }
    ),
    openGraph: {
      title: `${title} | 카더라`,
      description,
      url,
      siteName: '카더라',
      locale: 'ko_KR',
      type,
      images: [
        { url: ogUrl, width: 1200, height: 630, alt: title },
        { url: ogSquareUrl, width: 630, height: 630, alt: title },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogUrl],
    },
    ...(keywords ? { keywords } : {}),
    other: {
      'naver:author': author,
      'naver:site_name': '카더라',
      'naver:description': description.slice(0, 160),
      'naver:written_time': stableDate,
      'naver:updated_time': stableDate,
      'og:updated_time': stableDate,
      ...(publishedAt ? { 'article:published_time': publishedAt } : {}),
      ...(section ? { 'article:section': section } : {}),
      ...(tags?.length ? { 'article:tag': tags.join(',') } : {}),
      'dg:plink': url,
    },
  };
}

export function seoOther(section: string, author = '카더라', path?: string) {
  return {
    'naver:author': author,
    'naver:site_name': '카더라',
    'naver:written_time': BUILD_DATE,
    'naver:updated_time': BUILD_DATE,
    'og:updated_time': BUILD_DATE,
    'article:section': section,
    ...(path ? { 'dg:plink': `${SITE_URL}${path}` } : {}),
  };
}
