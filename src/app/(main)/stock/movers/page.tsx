import { stockColor, isKRMarket } from '@/lib/stockColor';
import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { fmtPrice, fmtCap } from '@/lib/format';
import ShareButtons from '@/components/ShareButtons';
import Disclaimer from '@/components/Disclaimer';

export const revalidate = 300;

const TITLE = '오늘의 급등락 종목 — 등락률·거래량·52주 신고가';
const DESC = '코스피·코스닥 급등 TOP 20, 급락 TOP 20, 거래량 폭발 종목, 52주 신고가·신저가 목록을 실시간 업데이트합니다.';

export const metadata: Metadata = {
  title: TITLE, description: DESC,
  keywords: ['급등주', '급락주', '오늘 상한가', '52주 신고가', '거래량 폭발'],
  alternates: { canonical: `${SITE_URL}/stock/movers` },
  robots: { index: true, follow: true, 'max-image-preview': 'large' as const, 'max-snippet': -1 as const },
  openGraph: { title: TITLE, description: DESC, url: `${SITE_URL}/stock/movers`, siteName: '카더라', locale: 'ko_KR', type: 'website', images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent('급등락 종목')}&category=stock&design=2`, width: 1200, height: 630 }] },
  other: { 'naver:author': '카더라', 'naver:description': DESC.slice(0, 160), 'naver:written_time': '2026-04-12T00:00:00Z', 'article:section': '주식' },
};

export default async function MoversPage() {
  const sb = await createSupabaseServer();
  const base = (sb as any).from('stock_quotes').select('symbol, name, market, price, change_pct, volume, market_cap, currency, sector, high_52w, low_52w');

  const [{ data: gainers }, { data: losers }, { data: volume }] = await Promise.all([
    base.in('market', ['KOSPI','KOSDAQ']).gt('price', 0).order('change_pct', { ascending: false }).limit(20),
    base.in('market', ['KOSPI','KOSDAQ']).gt('price', 0).order('change_pct', { ascending: true }).limit(20),
    base.in('market', ['KOSPI','KOSDAQ']).gt('price', 0).order('volume', { ascending: false }).limit(20),
  ]);

  // 52w high/low
  const { data: allKR } = await (sb as any).from('stock_quotes')
    .select('symbol, name, price, high_52w, low_52w, change_pct, currency, market')
    .in('market', ['KOSPI','KOSDAQ']).gt('price', 0).gt('high_52w', 0);

  const near52High = (allKR ?? [])
    .filter((s: any) => s.high_52w && Number(s.price) >= Number(s.high_52w) * 0.95)
    .sort((a: any, b: any) => Number(b.price) / Number(b.high_52w) - Number(a.price) / Number(a.high_52w))
    .slice(0, 15);
  const near52Low = (allKR ?? [])
    .filter((s: any) => s.low_52w && Number(s.price) <= Number(s.low_52w) * 1.05)
    .sort((a: any, b: any) => Number(a.price) / Number(a.low_52w) - Number(b.price) / Number(b.low_52w))
    .slice(0, 15);

  const ct = { fontSize: 14, fontWeight: 700 as const, color: 'var(--text-primary)', margin: '24px 0 12px' };
  const renderList = (stocks: any[], showPct = true, showVol = false) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {(stocks ?? []).map((s: any, i: number) => {
        const pct = Number(s.change_pct);
        const isUp = pct > 0;
        return (
          <Link key={s.symbol} href={`/stock/${s.symbol}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', textDecoration: 'none', color: 'inherit', borderRadius: 'var(--radius-xs)', background: i % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-surface)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', minWidth: 24 }}>{i + 1}</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 70, textAlign: 'right' }}>{fmtPrice(s.price, s.currency)}</span>
            {showPct && <span style={{ fontSize: 12, fontWeight: 700, minWidth: 60, textAlign: 'right', color: stockColor(pct, isKRMarket(s.market, s.currency)) }}>{isUp ? '+' : ''}{pct.toFixed(2)}%</span>}
            {showVol && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 70, textAlign: 'right' }}>{Number(s.volume).toLocaleString()}</span>}
          </Link>
        );
      })}
    </div>
  );

  return (
    <article style={{ maxWidth: 780, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '주식', item: `${SITE_URL}/stock` }, { '@type': 'ListItem', position: 3, name: '급등락' }] }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'ItemList', name: TITLE, numberOfItems: (gainers ?? []).length, itemListElement: (gainers ?? []).slice(0, 20).map((s: any, i: number) => ({ '@type': 'ListItem', position: i + 1, name: `${s.name} (${s.symbol})`, url: `${SITE_URL}/stock/${s.symbol}` })) }) }} />
      <nav style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', gap: 4, marginBottom: 8 }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>›
        <Link href="/stock" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>주식</Link>›<span>급등락</span>
      </nav>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 style={{ fontSize: 'clamp(22px, 5vw, 28px)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>🔥 급등락 종목</h1>
        <ShareButtons title={TITLE} />
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>KOSPI·KOSDAQ 등락률·거래량·52주 신고가/신저가 실시간 업데이트</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div><h2 style={ct}>📈 급등 TOP 20</h2>{renderList(gainers)}</div>
        <div><h2 style={ct}>📉 급락 TOP 20</h2>{renderList(losers)}</div>
      </div>

      <h2 style={ct}>🔊 거래량 TOP 20</h2>
      {renderList(volume, false, true)}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div><h2 style={ct}>🏔️ 52주 신고가 근접 ({near52High.length})</h2>{renderList(near52High)}</div>
        <div><h2 style={ct}>🏚️ 52주 신저가 근접 ({near52Low.length})</h2>{renderList(near52Low)}</div>
      </div>

      <div style={{ marginTop: 32, display: 'flex', gap: 8 }}>
        <Link href="/stock" style={{ flex: 1, textAlign: 'center', padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>전 종목 시세</Link>
        <Link href="/stock/dividend" style={{ flex: 1, textAlign: 'center', padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>배당주 순위</Link>
      </div>
      <Disclaimer type="stock" />
    </article>
  );
}
