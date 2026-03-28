import { createSupabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { fmtCap, stockColor, fmtPrice } from '@/lib/format';
import Disclaimer from '@/components/Disclaimer';

export const revalidate = 3600;

interface Props { params: Promise<{ name: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const sector = decodeURIComponent(name);
  return {
    title: `${sector} 섹터 종목 | 카더라`,
    description: `${sector} 섹터에 속한 주식 종목 목록. 시가총액, 등락률, 거래량 비교. 카더라에서 실시간 시세를 확인하세요.`,
    alternates: { canonical: `${SITE_URL}/stock/sector/${encodeURIComponent(sector)}` },
    openGraph: {
      title: `${sector} 섹터 종목`,
      description: `${sector} 관련 주식 시세, 시총 순위, 등락률 비교`,
      url: `${SITE_URL}/stock/sector/${encodeURIComponent(sector)}`,
      siteName: '카더라',
      locale: 'ko_KR',
      type: 'article',
      images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent(sector + ' 섹터 종목')}&category=stock`, width: 1200, height: 630, alt: `${sector} 섹터 종목` }],
    },
    twitter: { card: 'summary_large_image' as const, title: `${sector} 섹터 종목`, description: `${sector} 관련 주식 시세, 시총 순위, 등락률 비교` },
    other: {
      'geo.region': 'KR-11',
      'geo.placename': '서울',
      'geo.position': '37.5665;126.9780',
      'ICBM': '37.5665, 126.9780',
      'naver:written_time': '2026-01-15T00:00:00Z',
      'naver:updated_time': '2026-03-01T00:00:00Z',
      'dg:plink': `${SITE_URL}/stock/sector/${encodeURIComponent(sector)}`,
      'article:section': '주식',
      'article:tag': `${sector},섹터,주식,시세,등락률,시가총액`,
    },
  };
}

export default async function SectorPage({ params }: Props) {
  const { name } = await params;
  const sector = decodeURIComponent(name);
  const sb = await createSupabaseServer();

  const { data: stocks } = await sb.from('stock_quotes')
    .select('symbol, name, market, price, change_pct, change_amt, volume, market_cap, currency, sector, updated_at')
    .eq('sector', sector)
    .gt('price', 0)
    .order('market_cap', { ascending: false });

  if (!stocks?.length) notFound();

  const isKR = stocks[0]?.market === 'KOSPI' || stocks[0]?.market === 'KOSDAQ';
  const totalCap = stocks.reduce((s, st) => s + (st.market_cap || 0), 0);
  const avgPct = stocks.reduce((s, st) => s + (st.change_pct || 0), 0) / stocks.length;
  const upCount = stocks.filter(s => (s.change_pct || 0) > 0).length;
  const downCount = stocks.filter(s => (s.change_pct || 0) < 0).length;

  const top10 = stocks.slice(0, 10);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      {/* JSON-LD: BreadcrumbList */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: '주식', item: `${SITE_URL}/stock` },
          { '@type': 'ListItem', position: 3, name: `${sector} 섹터` },
        ],
      })}} />
      {/* JSON-LD: ItemList (상위 10종목) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'ItemList',
        name: `${sector} 섹터 시총 상위 종목`,
        numberOfItems: top10.length,
        itemListElement: top10.map((s, i) => ({
          '@type': 'ListItem', position: i + 1,
          url: `${SITE_URL}/stock/${encodeURIComponent(s.symbol)}`,
          name: `${s.name} (${s.symbol})`,
        })),
      })}} />
      {/* JSON-LD: FAQPage */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: `${sector} 섹터에는 어떤 종목이 있나요?`, acceptedAnswer: { '@type': 'Answer', text: `${sector} 섹터에는 ${stocks.length}개 종목이 있으며, 시총 상위 종목으로 ${top10.slice(0, 3).map(s => s.name).join(', ')} 등이 있습니다.` } },
          { '@type': 'Question', name: `${sector} 섹터 전체 시가총액은?`, acceptedAnswer: { '@type': 'Answer', text: `${sector} 섹터 전체 합산 시가총액은 ${fmtCap(totalCap, stocks[0]?.currency ?? undefined)}이며, ${stocks.length}개 종목 중 ${upCount}개 상승, ${downCount}개 하락입니다.` } },
          { '@type': 'Question', name: `${sector} 섹터 시세를 어디서 확인하나요?`, acceptedAnswer: { '@type': 'Answer', text: `카더라(kadeora.app)에서 ${sector} 섹터 전체 종목의 실시간 시세, 시총 순위, 등락률을 무료로 비교할 수 있습니다.` } },
        ],
      })}} />
      <div style={{ marginBottom: 16 }}>
        <Link href="/stock" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 주식</Link>
        <h1 style={{ margin: '8px 0 4px', fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>{sector} 섹터</h1>
        <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
          {stocks.length}종목 · 합산 시총 {fmtCap(totalCap, stocks[0]?.currency ?? undefined)} · 평균 등락 {avgPct >= 0 ? '+' : ''}{avgPct.toFixed(2)}%
        </p>
      </div>

      {/* 섹터 요약 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <div style={{ flex: 1, padding: '12px 14px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: isKR ? 'var(--accent-red)' : 'var(--accent-green)' }}>{upCount}</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>상승</div>
        </div>
        <div style={{ flex: 1, padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-tertiary)' }}>{stocks.length - upCount - downCount}</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>보합</div>
        </div>
        <div style={{ flex: 1, padding: '12px 14px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: isKR ? 'var(--accent-blue)' : 'var(--accent-red)' }}>{downCount}</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>하락</div>
        </div>
      </div>

      {/* 종목 리스트 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0 16px' }}>
        {stocks.map((s, i) => {
          const pct = s.change_pct ?? 0;
          return (
            <Link key={s.symbol} href={`/stock/${encodeURIComponent(s.symbol)}`} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 4px',
              borderBottom: i < stocks.length - 1 ? '1px solid var(--border)' : 'none',
              textDecoration: 'none', color: 'inherit',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', minWidth: 18, textAlign: 'center' }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{s.symbol} · {fmtCap(s.market_cap, s.currency ?? undefined)}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {fmtPrice(s.price ?? 0, s.currency ?? undefined)}
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: stockColor(pct, isKR) }}>
                  {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* 다른 섹터 링크 */}
      <div style={{ marginTop: 20, padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>📊 다른 섹터</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['반도체', '금융', '자동차', '바이오', '화학', '철강', '건설', '유통', 'IT', '에너지', '통신', '엔터', '방산', '조선'].map(s => (
            <Link key={s} href={`/stock/sector/${encodeURIComponent(s)}`} style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 'var(--fs-xs)', fontWeight: 500,
              background: s === sector ? 'var(--brand)' : 'var(--bg-hover)',
              color: s === sector ? 'var(--text-inverse)' : 'var(--text-secondary)',
              textDecoration: 'none', border: '1px solid var(--border)',
            }}>{s}</Link>
          ))}
        </div>
      </div>

      <Disclaimer type="stock" compact />
    </div>
  );
}
