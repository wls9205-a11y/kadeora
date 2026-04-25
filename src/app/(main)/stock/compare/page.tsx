import { Suspense } from 'react';
import { SITE_URL } from '@/lib/constants';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import CompareClient from './CompareClient';
import Disclaimer from '@/components/Disclaimer';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '종목 비교 — 주식 재무·시세·배당 비교 분석',
  description: '두 종목의 시가총액, PER, PBR, 배당수익률, 주가 추이를 한눈에 비교. 코스피·코스닥·NYSE·나스닥 전 종목 지원.',
  alternates: { canonical: `${SITE_URL}/stock/compare` },
  openGraph: {
    title: '종목 비교 — 주식 재무·시세·배당 비교 분석',
    description: '두 종목의 시가총액, PER, PBR, 배당수익률, 주가 추이를 한눈에 비교.',
    url: `${SITE_URL}/stock/compare`, siteName: '카더라', locale: 'ko_KR', type: 'website',
    images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent('종목 비교 분석')}&category=stock&design=2`, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
};

export default async function StockComparePage() {
  // SSR: 인기 종목 목록 (크롤러가 볼 수 있는 콘텐츠)
  const sb = getSupabaseAdmin();
  const { data: topStocks } = await sb
    .from('stock_quotes')
    .select('symbol, name, market, price, change_pct, market_cap')
    .gt('price', 0)
    .order('market_cap', { ascending: false })
    .limit(20);

  return (
    <>
      {/* SSR H1 + 서술형 텍스트 — 네이버 Yeti가 볼 수 있는 콘텐츠 */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
        <h1 style={{ position:'absolute', width:1, height:1, overflow:'hidden', clip:'rect(0,0,0,0)' }}>
          주식 종목 비교
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.7 }}>
          KOSPI, KOSDAQ, NYSE, NASDAQ 종목의 시가총액, PER, PBR, 배당수익률 등 핵심 지표를 한눈에 비교하세요.
          두 종목을 선택하면 가격 추이 차트와 재무 지표를 나란히 비교할 수 있습니다.
        </p>

        {/* SSR 종목 목록 — 크롤러용 (JS 없이도 콘텐츠 노출) */}
        <noscript>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>시가총액 상위 20 종목</h2>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: 6 }}>종목</th>
                <th style={{ textAlign: 'right', padding: 6 }}>시세</th>
                <th style={{ textAlign: 'right', padding: 6 }}>등락률</th>
              </tr>
            </thead>
            <tbody>
              {(topStocks ?? []).map((s: any) => (
                <tr key={s.symbol} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 6 }}>{s.name} ({s.symbol})</td>
                  <td style={{ textAlign: 'right', padding: 6 }}>{Number(s.price).toLocaleString()}</td>
                  <td style={{ textAlign: 'right', padding: 6, color: s.change_pct >= 0 ? 'var(--accent-red)' : 'var(--accent-blue)' }}>
                    {s.change_pct >= 0 ? '+' : ''}{Number(s.change_pct).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </noscript>
      </div>

      {/* 클라이언트 인터랙티브 비교 도구 */}
      <Suspense fallback={<div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>비교 도구를 불러오는 중...</div>}>
        <CompareClient />
      </Suspense>
      <Disclaimer type="stock" />
    </>
  );
}
