import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import StockSearchClient from './SearchClient';

const TITLE = '주식 종목 검색 — 시장·섹터·시총 필터';
const DESC = 'KOSPI, KOSDAQ, NYSE, NASDAQ 전 종목을 검색하고 시장, 섹터, 시가총액으로 필터링하세요.';

export const metadata: Metadata = {
  title: TITLE, description: DESC,
  keywords: ['종목 검색', '주식 검색', '코스피 종목', '코스닥 종목', '종목 필터'],
  alternates: { canonical: `${SITE_URL}/stock/search` },
  openGraph: { title: TITLE, description: DESC, url: `${SITE_URL}/stock/search`, siteName: '카더라', locale: 'ko_KR', type: 'website', images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent('종목 검색')}&category=stock&design=2`, width: 1200, height: 630 }] },
  other: { 'naver:author': '카더라', 'naver:written_time': new Date().toISOString(), 'article:section': '주식' },
};

export default function StockSearchPage() {
  return <StockSearchClient />;
}
