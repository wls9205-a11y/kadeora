import type { Metadata } from 'next';
import { buildMeta } from '@/lib/seo';
import { SITE_URL } from '@/lib/constants';

export const metadata: Metadata = buildMeta({
  title: '주식 종목 비교 — 국내외 핵심 지표 한눈에',
  description: '코스피, 코스닥, NYSE, NASDAQ 종목의 시가총액, PER, PBR, 배당수익률 등 핵심 지표를 한눈에 비교하세요.',
  path: '/stock/compare',
  section: '주식',
  ogCategory: 'stock',
  keywords: '주식 비교, 종목 비교, PER 비교, 시가총액 비교, 코스피, 코스닥, 카더라',
  tags: ['주식비교', '종목비교', 'PER', 'PBR', '배당수익률', '시가총액'],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '주식', item: `${SITE_URL}/stock` }, { '@type': 'ListItem', position: 3, name: '종목 비교' }] }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: '주식 종목 비교', description: '코스피, 코스닥, NYSE, NASDAQ 종목의 핵심 지표를 한눈에 비교', url: `${SITE_URL}/stock/compare`, isPartOf: { '@type': 'WebSite', name: '카더라', url: SITE_URL } }) }} />
      {children}
    </>
  );
}
