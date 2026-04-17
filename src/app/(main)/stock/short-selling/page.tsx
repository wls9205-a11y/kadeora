import { SITE_URL } from '@/lib/constants';
import { createSupabaseServer } from '@/lib/supabase-server';
import type { Metadata } from 'next';
import Disclaimer from '@/components/Disclaimer';

export const revalidate = 300;

export const metadata: Metadata = {
  title: '공매도·대차잔고 대시보드 — 과열종목·숏스퀴즈 후보 | 카더라',
  description: 'KRX 공매도 거래현황, 과열종목 지정, 대차잔고 급증·급감 종목, 숏스퀴즈 후보를 매일 자동 업데이트합니다.',
  alternates: { canonical: SITE_URL + '/stock/short-selling' },
  openGraph: {
    title: '공매도·대차잔고 대시보드',
    description: '공매도 과열종목, 대차잔고 변화, 숏스퀴즈 후보 종목을 한눈에.',
    url: SITE_URL + '/stock/short-selling',
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [{
      url: `${SITE_URL}/api/og?title=${encodeURIComponent('공매도·대차잔고 대시보드')}&subtitle=${encodeURIComponent('과열종목 · 숏스퀴즈 후보')}&category=stock&design=2`,
      width: 1200, height: 630,
    }],
  },
  other: {
    'naver:written_time': new Date().toISOString(),
    'naver:author': '카더라',
  },
};

async function fetchShortSellingData() {
  const sb = await createSupabaseServer();
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const recent = new Date(Date.now() + 9 * 3600000 - 3 * 86400000).toISOString().slice(0, 10);

  // 공매도 비율 TOP 30
  const { data: shortTop } = await (sb as any).from('short_selling_krx')
    .select('symbol, short_ratio, short_volume, is_overheat, trade_date')
    .gte('trade_date', recent)
    .order('short_ratio', { ascending: false })
    .limit(30);

  // 과열 종목
  const { data: overheat } = await (sb as any).from('short_selling_krx')
    .select('symbol, overheat_until, trade_date')
    .eq('is_overheat', true)
    .gte('overheat_until', today);

  // 대차잔고 급증 TOP 20
  const { data: lendingUp } = await (sb as any).from('lending_balance_krx')
    .select('symbol, balance_shares, change_1d, trade_date')
    .gte('trade_date', recent)
    .order('change_1d', { ascending: false })
    .limit(20);

  // 대차잔고 급감 TOP 20 (숏커버링 후보)
  const { data: lendingDown } = await (sb as any).from('lending_balance_krx')
    .select('symbol, balance_shares, change_1d, trade_date')
    .gte('trade_date', recent)
    .not('change_1d', 'is', null)
    .order('change_1d', { ascending: true })
    .limit(20);

  return { shortTop: shortTop || [], overheat: overheat || [], lendingUp: lendingUp || [], lendingDown: lendingDown || [] };
}

async function fetchStockNames(symbols: string[]) {
  if (!symbols.length) return {};
  const sb = await createSupabaseServer();
  const { data } = await sb.from('stock_quotes')
    .select('symbol, name, price, change_pct')
    .in('symbol', [...new Set(symbols)]);
  const map: Record<string, any> = {};
  for (const s of data || []) map[s.symbol] = s;
  return map;
}

function StockRow({ symbol, stockMap, extra }: { symbol: string; stockMap: Record<string, any>; extra: React.ReactNode }) {
  const stock = stockMap[symbol];
  return (
    <a
      href={`/stock/${symbol}`}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 14px',
        textDecoration: 'none',
        color: 'inherit',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div>
        <span style={{ fontWeight: 600, fontSize: '14px' }}>{stock?.name || symbol}</span>
        {stock && (
          <span style={{
            marginLeft: '8px',
            fontSize: '13px',
            color: Number(stock.change_pct) >= 0 ? '#ef4444' : '#3b82f6',
          }}>
            {Number(stock.change_pct) >= 0 ? '+' : ''}{Number(stock.change_pct).toFixed(1)}%
          </span>
        )}
      </div>
      <div style={{ fontSize: '13px', textAlign: 'right' }}>{extra}</div>
    </a>
  );
}

export default async function ShortSellingPage() {
  const { shortTop, overheat, lendingUp, lendingDown } = await fetchShortSellingData();
  const allSymbols = [
    ...shortTop.map((s: any) => s.symbol),
    ...overheat.map((s: any) => s.symbol),
    ...lendingUp.map((s: any) => s.symbol),
    ...lendingDown.map((s: any) => s.symbol),
  ];
  const stockMap = await fetchStockNames(allSymbols);

  // JSON-LD
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: '공매도 과열종목이란?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '공매도 과열종목은 공매도 거래비중이 일정 기준을 초과한 종목으로, 한국거래소가 5영업일간 공매도를 금지하는 조치를 취합니다.',
        },
      },
      {
        '@type': 'Question',
        name: '숏스퀴즈란?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '숏스퀴즈는 공매도 포지션이 많은 종목의 주가가 상승하면서 공매도 투자자들이 손절매(숏커버링)를 하게 되어 주가가 급등하는 현상입니다.',
        },
      },
    ],
  };

  const hasData = shortTop.length > 0 || overheat.length > 0;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
        📉 공매도·대차잔고 대시보드
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>
        KRX 데이터 기반 공매도 거래현황, 과열종목, 대차잔고 변화를 매일 자동 업데이트합니다.
      </p>

      {!hasData ? (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-tertiary)' }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>📊</p>
          <p>데이터 수집 중입니다. 장 마감 후(18시 이후) 업데이트됩니다.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
          {/* 공매도 과열 종목 */}
          {overheat.length > 0 && (
            <section>
              <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#ef4444' }}>
                🔥 공매도 과열 종목 ({overheat.length}건)
              </h2>
              <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                {overheat.map((item: any, i: number) => (
                  <StockRow
                    key={i}
                    symbol={item.symbol}
                    stockMap={stockMap}
                    extra={
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>
                        ~{item.overheat_until}까지
                      </span>
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {/* 공매도 비율 TOP */}
          <section>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
              📊 공매도 비율 TOP 20
            </h2>
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
              {shortTop.slice(0, 20).map((item: any, i: number) => (
                <StockRow
                  key={i}
                  symbol={item.symbol}
                  stockMap={stockMap}
                  extra={
                    <span style={{ fontWeight: 600 }}>
                      {Number(item.short_ratio).toFixed(1)}%
                    </span>
                  }
                />
              ))}
            </div>
          </section>

          {/* 대차잔고 급증 */}
          <section>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
              📈 대차잔고 급증 TOP 20
            </h2>
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
              {lendingUp.map((item: any, i: number) => (
                <StockRow
                  key={i}
                  symbol={item.symbol}
                  stockMap={stockMap}
                  extra={
                    <span style={{ color: '#ef4444', fontWeight: 600 }}>
                      +{Number(item.change_1d).toFixed(1)}%
                    </span>
                  }
                />
              ))}
            </div>
          </section>

          {/* 대차잔고 급감 (숏커버링 후보) */}
          <section>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
              ⚡ 대차잔고 급감 (숏커버링 후보)
            </h2>
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
              {lendingDown.map((item: any, i: number) => (
                <StockRow
                  key={i}
                  symbol={item.symbol}
                  stockMap={stockMap}
                  extra={
                    <span style={{ color: '#3b82f6', fontWeight: 600 }}>
                      {Number(item.change_1d).toFixed(1)}%
                    </span>
                  }
                />
              ))}
            </div>
          </section>
        </div>
      )}

      <Disclaimer type="stock" />
    </div>
  );
}
