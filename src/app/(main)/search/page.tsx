import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { Suspense } from 'react';
import SearchClient from './SearchClient';

export const metadata: Metadata = {
  title: '검색',
  description: '카더라 통합 검색 — 게시글, 종목, 아파트, 토론방을 한 번에 검색하세요.',
  alternates: { canonical: SITE_URL + '/search' },
  openGraph: {
    title: '카더라 통합 검색',
    description: '게시글, 종목, 아파트, 토론방 통합 검색',
    url: SITE_URL + '/search',
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [
      { url: `${SITE_URL}/api/og?title=${encodeURIComponent('통합 검색')}&design=2&category=general`, width: 1200, height: 630, alt: '카더라 통합 검색' },
      { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent('통합 검색')}&category=general`, width: 630, height: 630 },
    ],
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const },
  other: { 'dg:plink': SITE_URL + '/search', 'naver:author': '카더라', 'og:updated_time': new Date().toISOString(), 'naver:written_time': new Date().toISOString(), 'naver:updated_time': new Date().toISOString(), 'article:section': '검색', 'article:tag': '검색,통합검색,주식,부동산,청약,블로그' },
};

export default function SearchPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '60px 0' }}>로딩 중...</div>}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '검색' }] }) }} />
      <SearchClient />
    </Suspense>
  );
}
