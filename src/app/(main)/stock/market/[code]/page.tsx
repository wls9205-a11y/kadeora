import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { fmtPrice, fmtCap } from '@/lib/format';
import ShareButtons from '@/components/ShareButtons';
import Disclaimer from '@/components/Disclaimer';

export const revalidate = 3600;

const MARKETS: Record<string, { name: string; flag: string; desc: string }> = {
  kospi: { name: 'KOSPI', flag: '🇰🇷', desc: '한국거래소 유가증권시장 상장 종목 시세와 시가총액 순위' },
  kosdaq: { name: 'KOSDAQ', flag: '🇰🇷', desc: '한국거래소 코스닥시장 상장 종목 시세와 시가총액 순위' },
  nyse: { name: 'NYSE', flag: '🇺🇸', desc: '뉴욕증권거래소 상장 종목 시세와 시가총액 순위' },
  nasdaq: { name: 'NASDAQ', flag: '🇺🇸', desc: '나스닥 상장 종목 시세와 시가총액 순위' },
};

export function generateStaticParams() {
  return Object.keys(MARKETS).map(code => ({ code }));
}

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const m = MARKETS[code.toLowerCase()];
  if (!m) return {};
  const t = `${m.name} 종목 목록 2026 — ${m.desc}`;
  return {
    title: t, description: m.desc,
    keywords: [`${m.name} 종목`, `${m.name} 시가총액`, `${m.name} 시세`, `${m.name} 상장 종목`],
    alternates: { canonical: `${SITE_URL}/stock/market/${code}` },
    openGraph: { title: t, description: m.desc, url: `${SITE_URL}/stock/market/${code}`, siteName: '카더라', locale: 'ko_KR', type: 'website', images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent(`${m.flag} ${m.name} 종목`)}&category=stock&design=2`, width: 1200, height: 630 }] },
    other: { 'naver:author': '카더라', 'naver:written_time': new Date().toISOString(), 'article:section': '주식' },
  };
}

export default async function MarketPage({ params }: Props) {
  const { code } = await params;
  const m = MARKETS[code.toLowerCase()];
  if (!m) notFound();

  const sb = await createSupabaseServer();
  const { data: stocks } = await (sb as any).from('stock_quotes')
    .select('symbol, name, price, change_pct, volume, market_cap, currency, sector, per, pbr, dividend_yield')
    .eq('market', m.name).gt('price', 0)
    .order('market_cap', { ascending: false }).limit(100);

  const { count: totalCount } = await (sb as any).from('stock_quotes')
    .select('id', { count: 'exact', head: true }).eq('market', m.name).gt('price', 0);

  const sectors = [...new Set((stocks ?? []).map((s: any) => s.sector).filter(Boolean))];
  const upCount = (stocks ?? []).filter((s: any) => Number(s.change_pct) > 0).length;
  const downCount = (stocks ?? []).filter((s: any) => Number(s.change_pct) < 0).length;

  return (
    <article style={{ maxWidth: 780, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '주식', item: `${SITE_URL}/stock` }, { '@type': 'ListItem', position: 3, name: m.name }] }) }} />
      <nav style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', gap: 4, marginBottom: 8 }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>›
        <Link href="/stock" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>주식</Link>›<span>{m.name}</span>
      </nav>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 style={{ fontSize: 'clamp(22px, 5vw, 28px)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{m.flag} {m.name} 종목 목록</h1>
        <ShareButtons title={`${m.name} 종목 목록`} />
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        총 {totalCount?.toLocaleString()}종목 | 상승 {upCount} · 하락 {downCount} · {sectors.length}개 섹터
      </p>

      {/* 시장 내비 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto' }}>
        {Object.entries(MARKETS).map(([k, v]) => (
          <Link key={k} href={`/stock/market/${k}`} style={{ padding: '6px 14px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: k === code.toLowerCase() ? 700 : 500, background: k === code.toLowerCase() ? 'var(--brand)' : 'var(--bg-hover)', color: k === code.toLowerCase() ? '#fff' : 'var(--text-secondary)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            {v.flag} {v.name}
          </Link>
        ))}
      </div>

      {/* 종목 테이블 */}
      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead><tr style={{ background: 'var(--bg-surface)' }}>
            {['#','종목','현재가','등락률','시총','PER','배당','섹터'].map(h => (
              <th key={h} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', borderBottom: '2px solid var(--border)', textAlign: 'left' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {(stocks ?? []).map((s: any, i: number) => {
              const pct = Number(s.change_pct);
              const isKR = s.currency !== 'USD';
              return (
                <tr key={s.symbol} style={{ background: i % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-surface)' }}>
                  <td style={{ padding: '7px 10px', fontSize: 12, borderBottom: '1px solid var(--border)', color: 'var(--text-tertiary)' }}>{i + 1}</td>
                  <td style={{ padding: '7px 10px', fontSize: 12, borderBottom: '1px solid var(--border)' }}><Link href={`/stock/${s.symbol}`} style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>{s.name}</Link></td>
                  <td style={{ padding: '7px 10px', fontSize: 12, borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{fmtPrice(s.price, s.currency)}</td>
                  <td style={{ padding: '7px 10px', fontSize: 12, borderBottom: '1px solid var(--border)', fontWeight: 700, color: isKR ? (pct > 0 ? 'var(--accent-red)' : pct < 0 ? 'var(--accent-blue)' : 'var(--text-tertiary)') : (pct > 0 ? 'var(--accent-green)' : pct < 0 ? 'var(--accent-red)' : 'var(--text-tertiary)') }}>{pct > 0 ? '+' : ''}{pct.toFixed(2)}%</td>
                  <td style={{ padding: '7px 10px', fontSize: 12, borderBottom: '1px solid var(--border)' }}>{fmtCap(Number(s.market_cap), s.currency)}</td>
                  <td style={{ padding: '7px 10px', fontSize: 12, borderBottom: '1px solid var(--border)' }}>{s.per ? Number(s.per).toFixed(1) : '-'}</td>
                  <td style={{ padding: '7px 10px', fontSize: 12, borderBottom: '1px solid var(--border)' }}>{s.dividend_yield ? `${Number(s.dividend_yield).toFixed(1)}%` : '-'}</td>
                  <td style={{ padding: '7px 10px', fontSize: 11, borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{s.sector || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 32, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href="/stock" style={{ flex: 1, textAlign: 'center', padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>전 종목 시세</Link>
        <Link href="/stock/dividend" style={{ flex: 1, textAlign: 'center', padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>배당주</Link>
        <Link href="/stock/movers" style={{ flex: 1, textAlign: 'center', padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>급등락</Link>
      </div>
      <Disclaimer />
    </article>
  );
}
