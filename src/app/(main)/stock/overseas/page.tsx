// r4-P5-3 — /stock/overseas : NYSE + NASDAQ
// 등락률 정렬 + 통화(USD)·한국시간 병기.

import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { OVERSEAS_MARKETS, MarketGroupPage, fetchQuotes } from '../marketGroup';

export const revalidate = 300;
export const maxDuration = 30;

const TITLE = '해외 주식 — 뉴욕증시·나스닥 시세';
const DESC =
  'NYSE·나스닥 종목 시세와 등락률을 한 화면에서 봅니다. 가격은 달러, 기준 시각은 한국시간으로 함께 표기합니다.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${SITE_URL}/stock/overseas` },
  openGraph: {
    title: `${TITLE} | 카더라`,
    description: DESC,
    url: `${SITE_URL}/stock/overseas`,
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
};

export default async function StockOverseasPage() {
  const quotes = await fetchQuotes(OVERSEAS_MARKETS);
  return (
    <MarketGroupPage
      scope="overseas"
      title="해외 주식"
      eyebrow="OVERSEAS — 뉴욕증시·나스닥"
      description={DESC}
      markets={OVERSEAS_MARKETS}
      sort="change"
      quotes={quotes}
    />
  );
}
