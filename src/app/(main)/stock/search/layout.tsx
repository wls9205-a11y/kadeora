import type { Metadata } from 'next';
import { buildMeta } from '@/lib/seo';
import { SITE_URL } from '@/lib/constants';

export const metadata: Metadata = buildMeta({
  title: '주식 종목 검색 — 국내외 1,800+종목',
  description: '코스피, 코스닥, NYSE, NASDAQ 1,800+종목을 이름, 코드, 섹터로 검색하세요.',
  path: '/stock/search',
  section: '주식',
  ogCategory: 'stock',
  keywords: '주식 검색, 종목 검색, 코스피, 코스닥, NYSE, NASDAQ, 카더라',
  tags: ['종목검색', '주식검색', '코스피', '코스닥'],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '주식', item: `${SITE_URL}/stock` }, { '@type': 'ListItem', position: 3, name: '종목 검색' }] }) }} />
      {children}
    </>
  );
}
