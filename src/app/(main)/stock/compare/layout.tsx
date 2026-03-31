import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: '종목 비교',
  description: '국내외 주식 종목을 나란히 비교해보세요. 시가총액, 등락률, 거래량, PER, PBR 등 핵심 지표를 한눈에 비교 분석합니다.',
  alternates: { canonical: `${SITE_URL}/stock/compare` },
  openGraph: {
    title: '종목 비교 — 카더라',
    description: '국내외 주식 종목 핵심 지표 나란히 비교',
    url: `${SITE_URL}/stock/compare`,
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [
      { url: `${SITE_URL}/api/og?title=${encodeURIComponent('종목 비교')}&design=2&subtitle=${encodeURIComponent('시가총액·등락률·거래량 핵심 지표 비교')}&category=stock`, width: 1200, height: 630, alt: '카더라 종목 비교' },
      { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent('종목 비교')}&category=stock`, width: 630, height: 630, alt: '카더라 종목 비교' },
    ],
  },
  twitter: { card: 'summary_large_image' as const, title: '종목 비교', description: '시가총액·등락률·거래량 핵심 지표 비교' },
  other: {
    'naver:author': '카더라',
    'naver:written_time': '2026-01-15T00:00:00Z',
    'naver:updated_time': new Date().toISOString(),
    'dg:plink': `${SITE_URL}/stock/compare`,
    'article:section': '주식',
    'article:tag': '종목비교,주식,시가총액,등락률,거래량',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: '주식', item: `${SITE_URL}/stock` },
          { '@type': 'ListItem', position: 3, name: '종목 비교' },
        ],
      })}} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'WebPage', name: '종목 비교 — 카더라', url: `${SITE_URL}/stock/compare`,
        speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.compare-summary'] },
      })}} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
          { '@type': 'Question', name: '카더라 종목비교로 어떤 지표를 비교할 수 있나요?', acceptedAnswer: { '@type': 'Answer', text: '시가총액, 현재가, 등락률, 거래량, PER, PBR, 배당수익률 등 핵심 지표를 최대 4개 종목까지 나란히 비교할 수 있습니다.' } },
          { '@type': 'Question', name: '해외 종목도 비교할 수 있나요?', acceptedAnswer: { '@type': 'Answer', text: '네, KOSPI/KOSDAQ 국내 종목과 NYSE/NASDAQ 해외 종목을 함께 비교 가능합니다.' } },
        ],
      })}} />
      {children}
    </>
  );
}
