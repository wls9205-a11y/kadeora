import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { fmtPrice, fmtCap } from '@/lib/format';
import ShareButtons from '@/components/ShareButtons';
import Disclaimer from '@/components/Disclaimer';

export const revalidate = 3600;

const TITLE = '고배당주 순위 2026 — 배당수익률 TOP 종목';
const DESC = '국내외 고배당주 TOP 30을 배당수익률순으로 정리합니다. KOSPI·KOSDAQ·NYSE·NASDAQ 배당주 투자 참고 자료.';

export const metadata: Metadata = {
  title: TITLE, description: DESC,
  keywords: ['고배당주', '배당주 추천', '배당수익률', '배당주 순위', '2026 배당주'],
  alternates: { canonical: `${SITE_URL}/stock/dividend` },
  robots: { index: true, follow: true, 'max-image-preview': 'large' as const, 'max-snippet': -1 as const },
  openGraph: { title: TITLE, description: DESC, url: `${SITE_URL}/stock/dividend`, siteName: '카더라', locale: 'ko_KR', type: 'website', images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent(TITLE)}&category=stock&design=2`, width: 1200, height: 630 }, { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent(TITLE)}&category=stock`, width: 630, height: 630 }] },
  other: { 'naver:author': '카더라', 'naver:description': DESC.slice(0, 160), 'naver:written_time': new Date().toISOString(), 'article:section': '주식', 'article:tag': '고배당주,배당주순위,배당수익률' },
};

export default async function DividendPage() {
  const sb = await createSupabaseServer();

  const { data: krStocks } = await (sb as any).from('stock_quotes')
    .select('symbol, name, market, price, change_pct, market_cap, currency, dividend_yield, per, pbr, sector')
    .in('market', ['KOSPI', 'KOSDAQ'])
    .gt('dividend_yield', 0).gt('price', 0)
    .order('dividend_yield', { ascending: false }).limit(30);

  const { data: usStocks } = await (sb as any).from('stock_quotes')
    .select('symbol, name, market, price, change_pct, market_cap, currency, dividend_yield, per, pbr, sector')
    .in('market', ['NYSE', 'NASDAQ'])
    .gt('dividend_yield', 0).gt('price', 0)
    .order('dividend_yield', { ascending: false }).limit(30);

  const ct = { fontSize: 14, fontWeight: 700 as const, color: 'var(--text-primary)', margin: '24px 0 12px' };
  const th = { padding: '8px 10px', fontSize: 11, fontWeight: 600 as const, color: 'var(--text-tertiary)', borderBottom: '2px solid var(--border)', textAlign: 'left' as const };
  const td = { padding: '8px 10px', fontSize: 12, borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' };

  const renderTable = (stocks: any[], isKR: boolean) => (
    <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
        <thead><tr style={{ background: 'var(--bg-surface)' }}>
          <th style={th}>#</th><th style={th}>종목</th><th style={th}>배당률</th>
          <th style={th}>현재가</th><th style={th}>PER</th><th style={th}>시총</th><th style={th}>섹터</th>
        </tr></thead>
        <tbody>
          {(stocks ?? []).map((s: any, i: number) => (
            <tr key={s.symbol} style={{ background: i % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-surface)' }}>
              <td style={td}>{i + 1}</td>
              <td style={td}><Link href={`/stock/${s.symbol}`} style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>{s.name}</Link></td>
              <td style={{ ...td, fontWeight: 700, color: 'var(--stock-positive)' }}>{Number(s.dividend_yield).toFixed(1)}%</td>
              <td style={td}>{fmtPrice(s.price, s.currency)}</td>
              <td style={td}>{s.per ? `${Number(s.per).toFixed(1)}` : '-'}</td>
              <td style={td}>{fmtCap(Number(s.market_cap), s.currency)}</td>
              <td style={{ ...td, fontSize: 11, color: 'var(--text-secondary)' }}>{s.sector || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <article style={{ maxWidth: 780, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '주식', item: `${SITE_URL}/stock` }, { '@type': 'ListItem', position: 3, name: '배당주 순위' }] }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: '고배당주란?', acceptedAnswer: { '@type': 'Answer', text: '배당수익률이 시장 평균보다 높은 종목을 말합니다. 일반적으로 3% 이상이면 고배당주로 분류합니다.' } }, { '@type': 'Question', name: '배당주 투자 시 주의사항은?', acceptedAnswer: { '@type': 'Answer', text: '배당성향, 배당 지속성, 기업의 재무 건전성을 반드시 확인해야 합니다. 높은 배당률만으로 투자하면 위험할 수 있습니다.' } },
      { '@type': 'Question', name: '2026년 배당주 추천은?', acceptedAnswer: { '@type': 'Answer', text: '카더라에서 KOSPI·KOSDAQ·NYSE·NASDAQ 배당수익률 TOP 종목을 실시간으로 확인할 수 있습니다.' } },
      { '@type': 'Question', name: '배당금 지급일은 언제인가요?', acceptedAnswer: { '@type': 'Answer', text: '국내 12월 결산법인은 다음 해 3~4월에 배당금이 입금됩니다. 배당기준일 이전에 주식을 보유해야 배당권리가 발생합니다.' } },
      { '@type': 'Question', name: '배당수익률 계산 방법은?', acceptedAnswer: { '@type': 'Answer', text: '배당수익률 = 주당배당금 ÷ 현재주가 × 100%. 예: 주당 2000원 배당에 주가 40000원이면 배당수익률 5%.' } }] }) }} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: TITLE, url: `${SITE_URL}/stock/dividend`, speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', 'section'] } }) }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <nav style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', gap: 4 }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>›
          <Link href="/stock" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>주식</Link>›
          <span>배당주</span>
        </nav>
        <ShareButtons title={TITLE} contentType="stock-page" contentRef="dividend" />
      </div>

      <h1 style={{ fontSize: 'clamp(22px, 5vw, 30px)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>📊 고배당주 순위 2026</h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.7 }}>
        배당수익률이 높은 종목을 국내·해외로 나누어 정리합니다. 배당수익률은 최근 연간 배당금 기준이며, 투자 판단은 배당 지속성과 재무 건전성을 함께 고려해야 합니다.
      </p>

      <h2 style={ct}>🇰🇷 국내 고배당주 TOP {(krStocks ?? []).length}</h2>
      {renderTable(krStocks, true)}

      <h2 style={ct}>🇺🇸 해외 고배당주 TOP {(usStocks ?? []).length}</h2>
      {renderTable(usStocks, false)}


      {/* SSR 서술형 분석 — Thin Content 해소 */}
      {(krStocks ?? []).length > 0 && (() => {
        const top3 = (krStocks ?? []).slice(0, 3);
        const avgYield = ((krStocks ?? []).reduce((s: number, x: any) => s + (x.dividend_yield || 0), 0) / (krStocks ?? []).length).toFixed(2);
        const sectors = [...new Set((krStocks ?? []).map((s: any) => s.sector).filter(Boolean))].slice(0, 5);
        return (
          <section style={{ marginTop: 24, padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', lineHeight: 1.8, fontSize: 14, color: 'var(--text-secondary)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>배당주 시장 분석</h2>
            <p>현재 국내 고배당주 1위는 <strong style={{ color: 'var(--text-primary)' }}>{top3[0]?.name}</strong>으로 배당수익률 {top3[0]?.dividend_yield?.toFixed(2)}%를 기록하고 있습니다.
            2위 {top3[1]?.name}({top3[1]?.dividend_yield?.toFixed(2)}%), 3위 {top3[2]?.name}({top3[2]?.dividend_yield?.toFixed(2)}%)가 뒤를 잇고 있습니다.</p>
            <p style={{ marginTop: 8 }}>상위 {(krStocks ?? []).length}개 종목의 평균 배당수익률은 <strong style={{ color: 'var(--text-primary)' }}>{avgYield}%</strong>이며, 주요 업종은 {sectors.join(', ')} 등으로 분포되어 있습니다.
            고배당주 투자 시에는 배당수익률뿐 아니라 배당 지속성, 재무 건전성, PER·PBR 등 밸류에이션 지표를 종합적으로 검토해야 합니다.</p>
          </section>
        );
      })()}

      <div style={{ marginTop: 24, display: 'flex', gap: 8 }}>
        <Link href="/stock" style={{ flex: 1, textAlign: 'center', padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>전 종목 시세</Link>
        <Link href="/stock/compare" style={{ flex: 1, textAlign: 'center', padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>종목 비교</Link>
      </div>

      <Disclaimer type="stock" />
    </article>
  );
}
