// r4-P5-3 — /stock/domestic : KOSPI + KOSDAQ
// /stock 의 기본은 국내다. 신선도 우선 정렬.

import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { DOMESTIC_MARKETS, MarketGroupPage, fetchQuotes } from '../marketGroup';

export const revalidate = 300;
export const maxDuration = 30;

const TITLE = '국내 주식 — 코스피·코스닥 시세';
const DESC =
  '코스피·코스닥 종목 시세와 등락률을 한 화면에서 봅니다. 갱신이 오래된 종목은 목록에서 제외해 최신 시세만 보여줍니다.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${SITE_URL}/stock/domestic` },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: `${SITE_URL}/stock/domestic`,
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
};

export default async function StockDomesticPage() {
  const quotes = await fetchQuotes(DOMESTIC_MARKETS);
  return (
    <MarketGroupPage
      scope="domestic"
      title="국내 주식"
      eyebrow="DOMESTIC — 코스피·코스닥"
      description={DESC}
      markets={DOMESTIC_MARKETS}
      sort="fresh"
      quotes={quotes}
    />
  );
}
