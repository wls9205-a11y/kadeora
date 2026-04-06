import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import { SITE_URL } from '@/lib/constants';

type Props = { params: Promise<{ symbol: string; target: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol, target } = await params;
  if (symbol.toUpperCase() === target.toUpperCase()) notFound();
  const sb = getSupabaseAdmin();
  const [{ data: a }, { data: b }] = await Promise.all([
    (sb as any).from('stock_quotes').select('name').eq('symbol', symbol.toUpperCase()).maybeSingle(),
    (sb as any).from('stock_quotes').select('name').eq('symbol', target.toUpperCase()).maybeSingle(),
  ]);
  const t = `${a?.name || symbol} vs ${b?.name || target} 비교 분석`;
  return {
    title: `${t} | 카더라`, description: `${a?.name || symbol}과 ${b?.name || target}의 가격, PER, PBR, 배당, 시총 비교.`,
    alternates: { canonical: `${SITE_URL}/stock/${symbol}/vs/${target}` },
    openGraph: { title: `${t} | 카더라`, url: `${SITE_URL}/stock/${symbol}/vs/${target}`, images: [`${SITE_URL}/api/og?title=${encodeURIComponent(t)}&design=2&category=stock`] },
    other: { 'naver:written_time': new Date().toISOString() },
  };
}

export default async function StockComparePage({ params }: Props) {
  const { symbol, target } = await params;
  if (symbol.toUpperCase() === target.toUpperCase()) notFound();
  const sb = getSupabaseAdmin();
  const [{ data: a }, { data: b }] = await Promise.all([
    (sb as any).from('stock_quotes').select('*').eq('symbol', symbol.toUpperCase()).eq('is_active', true).maybeSingle(),
    (sb as any).from('stock_quotes').select('*').eq('symbol', target.toUpperCase()).eq('is_active', true).maybeSingle(),
  ]);
  if (!a || !b) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>종목을 찾을 수 없습니다. <Link href="/stock" style={{ color: 'var(--brand)' }}>종목 목록</Link></div>;

  const fmt = (v: any, suffix = '') => v != null ? `${Number(v).toLocaleString()}${suffix}` : '-';
  const rows: [string, string, string][] = [
    ['현재가', a.market === 'KOSPI' || a.market === 'KOSDAQ' ? `${fmt(a.price)}원` : `$${Number(a.price).toFixed(2)}`, b.market === 'KOSPI' || b.market === 'KOSDAQ' ? `${fmt(b.price)}원` : `$${Number(b.price).toFixed(2)}`],
    ['변동률', `${Number(a.change_pct) >= 0 ? '+' : ''}${Number(a.change_pct).toFixed(2)}%`, `${Number(b.change_pct) >= 0 ? '+' : ''}${Number(b.change_pct).toFixed(2)}%`],
    ['시가총액', Number(a.market_cap) > 0 ? (a.market === 'KOSPI' || a.market === 'KOSDAQ' ? `${(Number(a.market_cap)/1e12).toFixed(1)}조` : `$${(Number(a.market_cap)/1e9).toFixed(0)}B`) : '-', Number(b.market_cap) > 0 ? (b.market === 'KOSPI' || b.market === 'KOSDAQ' ? `${(Number(b.market_cap)/1e12).toFixed(1)}조` : `$${(Number(b.market_cap)/1e9).toFixed(0)}B`) : '-'],
    ['PER', a.per ? `${Number(a.per).toFixed(1)}배` : '-', b.per ? `${Number(b.per).toFixed(1)}배` : '-'],
    ['PBR', a.pbr ? `${Number(a.pbr).toFixed(2)}배` : '-', b.pbr ? `${Number(b.pbr).toFixed(2)}배` : '-'],
    ['배당률', a.dividend_yield ? `${Number(a.dividend_yield).toFixed(1)}%` : '-', b.dividend_yield ? `${Number(b.dividend_yield).toFixed(1)}%` : '-'],
    ['EPS', a.eps ? fmt(a.eps) : '-', b.eps ? fmt(b.eps) : '-'],
    ['ROE', a.roe ? `${Number(a.roe).toFixed(1)}%` : '-', b.roe ? `${Number(b.roe).toFixed(1)}%` : '-'],
    ['섹터', a.sector || '-', b.sector || '-'],
    ['거래량', fmt(a.volume), fmt(b.volume)],
  ];

  const cs = { padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-sm)' } as const;

  return (
    <article style={{ maxWidth: 720, margin: '0 auto', padding: '16px var(--sp-lg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '주식', item: `${SITE_URL}/stock` }, { '@type': 'ListItem', position: 3, name: `${a.name} vs ${b.name}` }] }) }} />
      <h1 style={{ fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>{a.name} vs {b.name}</h1>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 16 }}>두 종목의 핵심 투자 지표를 한눈에 비교합니다.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        <figure style={{ margin: 0, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <img src={`${SITE_URL}/api/og-chart?symbol=${a.symbol}`} alt={`${a.name} ${a.symbol} 주가 PER PBR 배당 시총 투자 지표 인포그래픽`} width={600} height={315} style={{ width: '100%', height: 'auto', display: 'block' }} loading="lazy" />
        </figure>
        <figure style={{ margin: 0, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <img src={`${SITE_URL}/api/og-chart?symbol=${b.symbol}`} alt={`${b.name} ${b.symbol} 주가 PER PBR 배당 시총 투자 지표 인포그래픽`} width={600} height={315} style={{ width: '100%', height: 'auto', display: 'block' }} loading="lazy" />
        </figure>
      </div>
      <div style={{ borderRadius: 'var(--radius-card)', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: 'var(--bg-surface)', fontWeight: 700, fontSize: 'var(--fs-sm)' }}>
          <div style={{ ...cs, color: 'var(--text-secondary)' }}>항목</div>
          <div style={{ ...cs, textAlign: 'center' }}><Link href={`/stock/${a.symbol}`} style={{ color: 'var(--brand)', textDecoration: 'none' }}>{a.name}</Link></div>
          <div style={{ ...cs, textAlign: 'center' }}><Link href={`/stock/${b.symbol}`} style={{ color: 'var(--brand)', textDecoration: 'none' }}>{b.name}</Link></div>
        </div>
        {rows.map(([label, va, vb], i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: i % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-surface)' }}>
            <div style={{ ...cs, color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</div>
            <div style={{ ...cs, textAlign: 'center', color: 'var(--text-primary)' }}>{va}</div>
            <div style={{ ...cs, textAlign: 'center', color: 'var(--text-primary)' }}>{vb}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <Link href={`/stock/${a.symbol}`} style={{ flex: 1, textAlign: 'center', padding: '12px 0', borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{a.name} 상세</Link>
        <Link href={`/stock/${b.symbol}`} style={{ flex: 1, textAlign: 'center', padding: '12px 0', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{b.name} 상세</Link>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 24, textAlign: 'center' }}>본 비교는 참고용이며 투자 권유가 아닙니다. 투자 결정은 본인 판단에 따라 주세요.</p>
    </article>
  );
}
