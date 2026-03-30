import { SITE_URL } from './constants';
import type { Metadata } from 'next';

/**
 * 카더라 공통 SEO 메타데이터 생성 헬퍼
 * - 모든 페이지에서 import { buildMeta } from '@/lib/seo' 로 사용
 * - naver:author, og:updated_time, canonical, article:section 자동 포함
 * - 미래 신규 페이지에서도 일관된 SEO 보장
 */

interface BuildMetaOptions {
  title: string;
  description: string;
  path: string;               // e.g. '/stock/005930'
  section?: string;           // e.g. '주식', '부동산', '블로그'
  author?: string;            // e.g. '카더라 주식팀'
  ogDesign?: number;          // OG 디자인 번호 (1~6), default 2
  ogCategory?: string;        // OG 카테고리
  ogSubtitle?: string;
  keywords?: string;
  noindex?: boolean;
  publishedAt?: string;
  type?: 'website' | 'article';
}

export function buildMeta(opts: BuildMetaOptions): Metadata {
  const {
    title, description, path, section, author = '카더라',
    ogDesign = 2, ogCategory, ogSubtitle, keywords,
    noindex = false, publishedAt, type = 'website',
  } = opts;

  const url = `${SITE_URL}${path}`;
  const now = new Date().toISOString();
  const ogParams = new URLSearchParams({ title, design: String(ogDesign) });
  if (ogCategory) ogParams.set('category', ogCategory);
  if (ogSubtitle) ogParams.set('subtitle', ogSubtitle);
  if (author !== '카더라') ogParams.set('author', author);
  const ogUrl = `${SITE_URL}/api/og?${ogParams.toString()}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: `${title} | 카더라`,
      description,
      url,
      siteName: '카더라',
      locale: 'ko_KR',
      type,
      images: [{ url: ogUrl, width: 1200, height: 630, alt: title }],
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
      'og:updated_time': now,
      ...(publishedAt ? { 'article:published_time': publishedAt } : {}),
      ...(section ? { 'article:section': section } : {}),
      'dg:plink': url,
    },
  };
}

/** 공통 other 필드 (페이지가 자체 other를 정의할 때 spread용) */
export function seoOther(section: string, author = '카더라', path?: string) {
  return {
    'naver:author': author,
    'naver:site_name': '카더라',
    'og:updated_time': new Date().toISOString(),
    'article:section': section,
    ...(path ? { 'dg:plink': `${SITE_URL}${path}` } : {}),
  };
}
