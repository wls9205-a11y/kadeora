import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
export const metadata: Metadata = {
  title: '종목 비교',
  description: '두 종목의 시가총액·등락률·거래량을 한눈에 비교해보세요. KOSPI, KOSDAQ 전 종목 지원.',
  alternates: { canonical: SITE_URL + '/stock/compare' },
  openGraph: {
    title: '종목 비교',
    description: '시가총액·등락률·거래량 한눈에 비교',
    url: SITE_URL + '/stock/compare',
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent('종목 비교')}&category=stock`, width: 1200, height: 630, alt: '카더라 종목 비교' }],
  },
  twitter: { card: 'summary_large_image' },
  other: { 'article:section': '주식', 'dg:plink': SITE_URL + '/stock/compare' },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '주식', item: SITE_URL + '/stock' }, { '@type': 'ListItem', position: 3, name: '종목 비교' }] }) }} />{children}</>;
}
