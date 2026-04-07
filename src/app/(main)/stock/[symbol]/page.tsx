import type { AIComment, StockPriceHistory, StockNews, InvestorFlow, Disclosure } from '@/types/stock';
export const maxDuration = 30;
export const revalidate = 300;
import { SITE_URL } from '@/lib/constants';

import { createSupabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import InlineCTA from '@/components/InlineCTA';
import Link from 'next/link';
import type { Metadata } from 'next';
import ShareButtons from '@/components/ShareButtons';
import StockWatchlistButton from './WatchlistButton';
import StockDetailTabs from './StockDetailTabs';
import StockAlertButton from '@/components/StockAlertButton';
import { fmtPrice, fmtCap } from '@/lib/format';
import Disclaimer from '@/components/Disclaimer';
import StockMAOverlay from '@/components/StockMAOverlay';

interface Props { params: Promise<{ symbol: string }> }

/**
 * 빌드 타임 정적 생성 — 전 종목 페이지를 미리 생성
 * 728종목이라 빌드 부담 적음 + 크롤러 TTFB 극소화
 */
export async function generateStaticParams() {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from('stock_quotes')
      .select('symbol')
      .eq('is_active', true);
    return (data || []).map(s => ({ symbol: s.symbol }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;
  const sb = await createSupabaseServer();
  const { data: s } = await sb.from('stock_quotes').select('name,market,price,currency,change_pct,updated_at').eq('symbol', symbol).single();
  if (!s) return { title: '종목을 찾을 수 없습니다', robots: { index: false } };
  const p = fmtPrice(Number(s.price), s.currency ?? undefined);
  const ch = Number(s.change_pct) === 0 ? '' : `${Number(s.change_pct) > 0 ? '▲' : '▼'}${Math.abs(Number(s.change_pct)).toFixed(2)}%`;
  return {
    title: `${s.name} (${symbol}) 주가`,
    description: `${s.name} 현재가 ${p} ${ch}. ${s.market} 상장. 실시간 시세, 차트, 수급, 뉴스, AI 한줄평을 카더라에서 확인하세요.`,
    alternates: { canonical: `${SITE_URL}/stock/${symbol}` },
    openGraph: {
      title: `${s.name} (${symbol}) ${p} ${ch}`,
      description: `${s.market} 상장 · 실시간 시세 · 차트 · 수급 분석 · 종목 토론`,
      url: `${SITE_URL}/stock/${symbol}`,
      siteName: '카더라',
      locale: 'ko_KR',
      type: 'article',
      images: [
        { url: `${SITE_URL}/api/og?title=${encodeURIComponent(`${s.name} (${symbol}) ${p} ${ch}`)}&design=2&category=stock`, width: 1200, height: 630, alt: `${s.name} 주가 시세` },
        { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent(`${s.name} (${symbol})`)}&category=stock`, width: 630, height: 630, alt: `${s.name} 시세` },
      ],
    },
    twitter: { card: 'summary_large_image', title: `${s.name} ${p} ${ch}`, description: `${s.market} · 실시간 시세 · 차트 · 수급 분석` },
    other: (() => {
      const isUS = s.market === 'NYSE' || s.market === 'NASDAQ';
      const lat = isUS ? '40.7128' : '37.5665';
      const lng = isUS ? '-74.0060' : '126.9780';
      const region = isUS ? 'US-NY' : 'KR-11';
      const placename = isUS ? 'New York' : '서울';
      return {
        'geo.region': region,
        'geo.placename': placename,
        'geo.position': `${lat};${lng}`,
        'ICBM': `${lat}, ${lng}`,
        'naver:written_time': (s as any).analysis_generated_at || s.updated_at || new Date().toISOString(),
        'naver:updated_time': s.updated_at || new Date().toISOString(),
        'article:published_time': s.updated_at || new Date().toISOString(),
        'article:modified_time': s.updated_at || new Date().toISOString(),
        'article:section': '주식',
        'article:tag': `${s.name},${symbol},${s.market},주식,시세,차트,종목분석,투자,주가`,
        'dg:plink': `${SITE_URL}/stock/${symbol}`,
        'naver:author': '카더라',
        'og:updated_time': s.updated_at || new Date().toISOString(),
        'og:price:amount': String(s.price),
        'og:price:currency': isUS ? 'USD' : 'KRW',
      };
    })(),
  };
}

export default async function StockDetailPage({ params }: Props) {
  const { symbol } = await params;
  const sb = await createSupabaseServer();
  const { data: s } = await (sb as any).from('stock_quotes').select('symbol,name,market,price,change_amt,change_pct,volume,market_cap,sector,currency,description,website,ticker,updated_at,per,pbr,dividend_yield,high_52w,low_52w,eps,roe').eq('symbol', symbol).single();
  if (!s) notFound();

  // SEO 분석 텍스트 (database.ts에 없는 컬럼)
  const { data: _at } = await (sb as any).from('stock_quotes').select('analysis_text').eq('symbol', symbol).maybeSingle();
  const stockAnalysisText: string | null = _at?.analysis_text || null;

  const changePct = Number(s.change_pct);
  const isUp = changePct > 0;
  const isDown = changePct < 0;
  const isStale = !s.updated_at || s.updated_at.startsWith('2000-01-01');
  const isKR = s.market === 'KOSPI' || s.market === 'KOSDAQ' || (s.currency !== 'USD');

  // Parallel fetch all data (필요 컬럼만 select)
  const [histR, aiR, newsR, flowR, discR, similarR, relatedBlogsR, sectorCountR] = await Promise.all([
    sb.from('stock_price_history').select('date, close_price, open_price, high_price, low_price, volume, change_pct').eq('symbol', symbol).order('date', { ascending: true }).limit(60),
    sb.from('stock_ai_comments').select('id, symbol, comment, signal, created_at').eq('symbol', symbol).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('stock_news').select('id, title, url, source, published_at, sentiment, sentiment_label, sentiment_score, ai_summary').eq('symbol', symbol).order('published_at', { ascending: false }).limit(10),
    sb.from('stock_investor_flow').select('id, date, foreign_buy, foreign_sell, inst_buy, inst_sell').eq('symbol', symbol).order('date', { ascending: false }).limit(5),
    sb.from('stock_disclosures').select('id, title, disclosure_type, source, published_at, created_at').eq('symbol', symbol).order('published_at', { ascending: false }).limit(10),
    s.sector ? sb.from('stock_quotes').select('symbol, name, price, change_pct, market_cap, currency').eq('sector', s.sector).neq('symbol', symbol).gt('price', 0).order('market_cap', { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    // 관련 블로그 (종목명으로 검색)
    sb.from('blog_posts').select('slug, title, category, view_count, published_at').eq('is_published', true).or(`title.ilike.%${s.name}%,title.ilike.%${symbol}%`).order('published_at', { ascending: false }).limit(5),
    // 섹터 내 순위 계산
    s.sector ? sb.from('stock_quotes').select('symbol', { count: 'exact', head: true }).eq('sector', s.sector).gt('price', 0) : Promise.resolve({ count: 0 }),
  ]);

  // 섹터 내 순위 (시총 기준)
  const sectorTotal = (sectorCountR as any)?.count ?? 0;
  const sectorRank = s.sector && s.market_cap ? ((similarR.data ?? []).filter((sim: any) => Number(sim.market_cap) > Number(s.market_cap)).length + 1) : 0;

  // 52주 최고/최저 (price_history에서 계산)
  const priceHist = (histR.data || []).map((d: any) => Number(d.close_price)).filter((p: number) => p > 0);
  const high52 = priceHist.length ? Math.max(...priceHist) : null;
  const low52 = priceHist.length ? Math.min(...priceHist) : null;

  const items = [
    { label: '시가총액', value: fmtCap(s.market_cap ? Number(s.market_cap) : null, s.currency ?? undefined) },
    { label: '섹터', value: s.sector || '-' },
    { label: '전일대비', value: s.change_amt != null ? `${Number(s.change_amt) > 0 ? '+' : ''}${Number(s.change_amt).toLocaleString()}` : '-' },
    { label: '거래량', value: s.volume ? Number(s.volume) >= 1000000 ? `${(Number(s.volume) / 10000).toFixed(0)}만` : Number(s.volume).toLocaleString() : '-' },
    ...((s as any).per > 0 ? [{ label: 'PER', value: `${Number((s as any).per).toFixed(1)}배` }] : []),
    ...((s as any).pbr > 0 ? [{ label: 'PBR', value: `${Number((s as any).pbr).toFixed(2)}배` }] : []),
    ...((s as any).dividend_yield > 0 ? [{ label: '배당률', value: `${Number((s as any).dividend_yield).toFixed(2)}%` }] : []),
    ...((s as any).roe > 0 ? [{ label: 'ROE', value: `${Number((s as any).roe).toFixed(1)}%` }] : []),
  ];

  return (
    <article style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      {/* JSON-LD 1: FinancialProduct + ExchangeRateSpecification */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${s.name} (${symbol}) 주가 정보`,
        description: s.description || `${s.name} ${s.market} 상장. 현재가 ${fmtPrice(Number(s.price), s.currency ?? undefined)}.`,
        url: `${SITE_URL}/stock/${symbol}`,
        dateModified: s.updated_at || new Date().toISOString(),
        mainEntity: {
          '@type': 'FinancialProduct',
          name: s.name,
          identifier: symbol,
          category: s.sector || s.market,
          provider: { '@type': 'Organization', name: s.market || 'Exchange' },
          ...(s.price ? { offers: { '@type': 'Offer', price: Number(s.price), priceCurrency: s.currency || 'KRW', availability: 'https://schema.org/InStock' } } : {}),
        },
        isPartOf: { '@type': 'WebSite', name: '카더라', url: SITE_URL },
      })}} />
      {/* JSON-LD 2: BreadcrumbList */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: '주식', item: `${SITE_URL}/stock` },
          { '@type': 'ListItem', position: 3, name: s.name },
        ],
      })}} />
      {/* JSON-LD 3: Article + Speakable (Google Discover + 음성 검색) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Article',
        headline: `${s.name} (${symbol}) 주가 시세 분석`,
        description: s.description || `${s.name} ${s.market} 상장 종목 실시간 시세`,
        url: `${SITE_URL}/stock/${symbol}`,
        datePublished: s.updated_at || new Date().toISOString(),
        dateModified: s.updated_at || new Date().toISOString(),
        author: { '@type': 'Organization', name: '카더라', url: SITE_URL },
        publisher: { '@type': 'Organization', name: '카더라', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icons/icon-192.png`, width: 192, height: 192 } },
        image: [
          { '@type': 'ImageObject', url: `${SITE_URL}/api/og?title=${encodeURIComponent(`${s.name} (${symbol})`)}&design=2&category=stock`, width: 1200, height: 630 },
          { '@type': 'ImageObject', url: `${SITE_URL}/api/og-square?title=${encodeURIComponent(`${s.name}`)}&category=stock`, width: 630, height: 630 },
        ],
        thumbnailUrl: `${SITE_URL}/api/og-square?title=${encodeURIComponent(`${s.name}`)}&category=stock`,
        mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/stock/${symbol}` },
        speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.stock-price-header'] },
      })}} />
      {/* JSON-LD 4: FAQ (검색결과 아코디언) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: `${s.name} 현재 주가는?`, acceptedAnswer: { '@type': 'Answer', text: `${s.name}(${symbol})의 현재가는 ${fmtPrice(Number(s.price), s.currency ?? undefined)}이며, 전일 대비 ${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}% 변동했습니다. ${s.market} 상장 종목입니다.` } },
          { '@type': 'Question', name: `${s.name} 어떤 섹터인가요?`, acceptedAnswer: { '@type': 'Answer', text: `${s.name}은(는) ${s.sector || s.market} 섹터에 속하며, ${s.description || `${s.market}에 상장된 종목입니다.`}` } },
          { '@type': 'Question', name: `${s.name} 시세를 어디서 확인하나요?`, acceptedAnswer: { '@type': 'Answer', text: `카더라(kadeora.app)에서 ${s.name}의 실시간 시세, 차트, 수급 분석, AI 한줄평, 관련 뉴스를 무료로 확인할 수 있습니다. 카카오 로그인으로 관심종목 등록, 가격 알림도 설정 가능합니다.` } },
          { '@type': 'Question', name: `${s.name} 시가총액은 얼마인가요?`, acceptedAnswer: { '@type': 'Answer', text: `${s.name}(${symbol})의 시가총액은 ${Number(s.market_cap) > 0 ? `약 ${Number(s.market_cap) >= 1e12 ? `${(Number(s.market_cap) / 1e12).toFixed(1)}조원` : Number(s.market_cap) >= 1e8 ? `${Math.round(Number(s.market_cap) / 1e8).toLocaleString()}억원` : `${Number(s.market_cap).toLocaleString()}원`}` : '비공개'}입니다. ${s.market} 상장 종목이며, 카더라에서 섹터 내 시총 순위를 확인할 수 있습니다.` } },
        ],
      })}} />
      {/* JSON-LD: Dataset (가격 히스토리 — Google Dataset Search) */}
      {/* Dataset schema removed for optimization */}
      {false && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Dataset', name: `${s.name} (${symbol}) 주가 데이터`, description: `${s.name} ${s.market} 상장 종목의 실시간 시세, 시가총액, 등락률, 거래량 데이터`, url: `${SITE_URL}/stock/${encodeURIComponent(symbol)}`, creator: { '@type': 'Organization', name: '카더라', url: SITE_URL }, temporalCoverage: '2024/..', variableMeasured: [{ '@type': 'PropertyValue', name: 'price', value: s.price }, { '@type': 'PropertyValue', name: 'change_pct', value: changePct }, { '@type': 'PropertyValue', name: 'market_cap', value: s.market_cap }] }) }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-lg)' }}>
        <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', fontSize: 12, color: 'var(--text-tertiary)' }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>
          <span>›</span>
          <Link href="/stock" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>주식</Link>
          {s.sector && <><span>›</span><Link href={`/stock/sector/${encodeURIComponent(s.sector)}`} style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>{s.sector}</Link></>}
          <span>›</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{s.name}</span>
        </nav>
        <div style={{ display: 'flex', gap: 6 }}>
          <StockAlertButton symbol={symbol} stockName={s.name} currentPrice={Number(s.price)} currency={s.currency ?? 'KRW'} />
          <StockWatchlistButton symbol={symbol} />
        </div>
      </div>

      {/* SEO: ImageGallery JSON-LD (시각적 캐러셀 제거, 메타데이터만 유지) */}
      {/* ImageGallery schema removed for optimization */}
      {false && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'ImageGallery', name: `${s.name} (${symbol}) 주식 이미지`,
        about: { '@type': 'FinancialProduct', name: s.name, identifier: symbol },
        image: [{ '@type': 'ImageObject', url: `${SITE_URL}/api/og?title=${encodeURIComponent(`${s.name} (${symbol})`)}&design=2&category=stock`, name: `${s.name} 주가 시세`, width: 1200, height: 630 }, { '@type': 'ImageObject', url: `${SITE_URL}/api/og-chart?symbol=${symbol}`, name: `${s.name} 투자 지표 인포그래픽`, width: 1200, height: 630 }],
      })}} />

      {/* 히어로 시세 카드 */}
      <div className="stock-price-header" style={{
        background: isUp ? 'linear-gradient(135deg, rgba(248,113,113,0.06), var(--bg-surface))' : isDown ? 'linear-gradient(135deg, rgba(96,165,250,0.06), var(--bg-surface))' : 'var(--bg-surface)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 16px', marginBottom: 'var(--sp-md)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{s.name}</h1>
          <span style={{ fontSize: 11, background: 'var(--bg-hover)', color: 'var(--text-tertiary)', padding: '2px 8px', borderRadius: 4 }}>{symbol}</span>
          <span style={{ fontSize: 11, background: 'var(--bg-hover)', color: 'var(--text-tertiary)', padding: '2px 8px', borderRadius: 4 }}>{s.market}</span>
          {sectorRank > 0 && sectorTotal > 0 && s.sector && (
            <span style={{ fontSize: 10, background: 'rgba(99,102,241,0.1)', color: 'var(--accent-purple)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
              {s.sector} #{sectorRank}/{sectorTotal}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 'var(--sp-xs)' }}>
          <span style={{ fontSize: 'clamp(28px, 8vw, 36px)', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{fmtPrice(Number(s.price), s.currency ?? undefined)}</span>
          {!isStale && (
            <span style={{ fontSize: 16, fontWeight: 700, color: isUp ? 'var(--accent-red)' : isDown ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}>
              {isUp ? '▲' : isDown ? '▼' : '━'} {isUp ? '+' : ''}{Number(s.change_amt).toLocaleString()} ({Math.abs(changePct).toFixed(2)}%)
            </span>
          )}
        </div>
        {s.updated_at && !s.updated_at.startsWith('2000-01-01') && (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-md)' }}>
            {new Date(s.updated_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준 · 시총 {fmtCap(Number(s.market_cap) > 0 ? Number(s.market_cap) : null, s.currency ?? undefined)}
          </div>
        )}
        {/* 통합 스파크라인 차트 (90px) */}
        {priceHist.length >= 5 && (
          <div style={{ height: 90, position: 'relative' }}>
            <svg viewBox={`0 0 ${priceHist.length} 72`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
              {(() => {
                const min = Math.min(...priceHist);
                const max = Math.max(...priceHist);
                const range = max - min || 1;
                const points = priceHist.map((p, i) => `${i},${68 - ((p - min) / range) * 64}`).join(' ');
                const fillPoints = `0,72 ${points} ${priceHist.length - 1},72`;
                const lineColor = priceHist[priceHist.length - 1] >= priceHist[0] ? (isKR ? 'var(--accent-red)' : 'var(--accent-green)') : (isKR ? 'var(--accent-blue)' : 'var(--accent-red)');
                const fillColor = priceHist[priceHist.length - 1] >= priceHist[0] ? (isKR ? 'rgba(248,113,113,0.08)' : 'rgba(52,211,153,0.08)') : (isKR ? 'rgba(96,165,250,0.08)' : 'rgba(248,113,113,0.08)');
                return (<>
                  <polygon points={fillPoints} fill={fillColor} />
                  <polyline points={points} fill="none" stroke={lineColor} strokeWidth="1.8" strokeLinejoin="round" />
                </>);
              })()}
            </svg>
            <div style={{ position: 'absolute', bottom: 4, left: 0, fontSize: 10, color: 'var(--text-tertiary)' }}>30일 전</div>
            <div style={{ position: 'absolute', bottom: 4, right: 0, fontSize: 10, color: 'var(--text-tertiary)' }}>오늘</div>
          </div>
        )}
        {isStale && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>시세 정보 준비 중</div>}
      </div>

      {/* 기본 정보 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, marginBottom: 'var(--sp-md)' }}>
        {items.map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 6px', textAlign: 'center', minWidth: 0 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* 투자 지표 대시보드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 6, marginBottom: 'var(--sp-md)' }}>
        {/* 등락률 게이지 */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6 }}>일간 등락</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid ${isUp ? 'var(--accent-red)' : isDown ? 'var(--accent-blue)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: isUp ? 'var(--accent-red)' : isDown ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}>
              {isUp ? '▲' : isDown ? '▼' : '━'}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: isUp ? 'var(--accent-red)' : isDown ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}>
                {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{s.change_amt != null ? `${Number(s.change_amt) > 0 ? '+' : ''}${Number(s.change_amt).toLocaleString()}` : ''}</div>
            </div>
          </div>
        </div>
        {/* 시총 위치 */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6 }}>시가총액</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{fmtCap(s.market_cap ? Number(s.market_cap) : null, s.currency ?? undefined)}</div>
          <div style={{ marginTop: 'var(--sp-xs)', height: 4, borderRadius: 2, background: 'var(--bg-hover)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 2, background: 'var(--brand)', width: `${s.market_cap ? Math.min(Math.log10(Number(s.market_cap) / 1e8) * 15, 100) : 10}%` }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {(() => { const mc = Number(s.market_cap); if (!mc) return ''; if (s.currency === 'USD') return mc >= 1e12 ? '초대형주' : mc >= 1e11 ? '대형주' : mc >= 1e10 ? '중형주' : '소형주'; return mc >= 1e13 ? '초대형주' : mc >= 1e12 ? '대형주' : mc >= 1e11 ? '중형주' : '소형주'; })()}
          </div>
        </div>
      </div>

      {/* 52주 가격 범위 바 */}
      {high52 && low52 && high52 > 0 && low52 > 0 && high52 !== low52 && (
        <div style={{ marginBottom: 'var(--sp-md)', padding: 'var(--sp-md) var(--card-p)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>가격 범위 (기간)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
            <span style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600 }}>
              {s.currency === 'USD' ? '$' : '₩'}{low52.toLocaleString()}
            </span>
            <div style={{ flex: 1, height: 8, background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-green), var(--accent-red))', borderRadius: 4, position: 'relative' }}>
              <div style={{
                position: 'absolute', top: -3,
                left: `${Math.min(Math.max(((Number(s.price) - low52) / (high52 - low52)) * 100, 2), 98)}%`,
                width: 14, height: 14, borderRadius: '50%',
                background: 'var(--text-primary)', border: '3px solid var(--bg-surface)',
                transform: 'translateX(-50%)',
              }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--accent-red)', fontWeight: 600 }}>
              {s.currency === 'USD' ? '$' : '₩'}{high52.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* 이동평균선 차트 */}
      <StockMAOverlay symbol={symbol} currency={s.currency ?? undefined} />

      {/* 투자 요약 (네이버 크롤러 가시적 텍스트) */}
      <section className="stock-investment-summary" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--card-p) var(--sp-lg)', marginBottom: 'var(--sp-md)' }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>📋 {s.name} ({symbol}) 종목 요약</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 8px', wordBreak: 'keep-all' }}>
          {s.name}({symbol})은 {s.market} 시장에 상장된 {s.sector || '종목'}입니다.
          {!isStale && <> 현재가는 {fmtPrice(Number(s.price), s.currency ?? undefined)}이며, 전일 대비 {isUp ? '상승' : isDown ? '하락' : '보합'}({isUp ? '+' : ''}{changePct.toFixed(2)}%)했습니다.</>}
          {s.market_cap && Number(s.market_cap) > 0 && <> 시가총액은 {fmtCap(Number(s.market_cap), s.currency ?? undefined)}입니다.</>}
          {high52 && low52 && high52 > low52 && <> 최근 가격 범위는 {s.currency === 'USD' ? '$' : '₩'}{low52.toLocaleString()} ~ {s.currency === 'USD' ? '$' : '₩'}{high52.toLocaleString()}입니다.</>}
        </p>
        {s.description && s.description.length > 20 && (
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.65, margin: 0, wordBreak: 'keep-all' }}>
            {s.description.length > 200 ? s.description.slice(0, 200) + '...' : s.description}
          </p>
        )}
      </section>

      {/* AI 한줄평 — 서버 렌더링 (탭 로드 전 즉시 표시) */}
      {aiR.data && (aiR.data as any).comment && (() => {
        const ai = aiR.data as any;
        const signalColor = ai.signal === 'bullish' ? 'var(--accent-green)' : ai.signal === 'bearish' ? 'var(--accent-red)' : 'var(--brand)';
        const signalLabel = ai.signal === 'bullish' ? '📈 긍정' : ai.signal === 'bearish' ? '📉 부정' : '🤖 중립';
        return (
          <div style={{ background: 'linear-gradient(135deg, rgba(59,123,246,0.04), rgba(139,92,246,0.04))', border: '1px solid rgba(59,123,246,0.12)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: 'var(--sp-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>🤖 AI 한줄평</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: signalColor, background: `${signalColor}15`, padding: '2px 8px', borderRadius: 4 }}>{signalLabel}</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0, wordBreak: 'keep-all' }}>
              {ai.comment.length > 200 ? ai.comment.slice(0, 200) + '...' : ai.comment}
            </p>
            {ai.created_at && (
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>
                {new Date(ai.created_at).toLocaleDateString('ko-KR')} 기준
              </div>
            )}
          </div>
        );
      })()}

      {/* 수급 요약 — 최근 외국인/기관 매매 동향 */}
      {(flowR.data ?? []).length > 0 && (() => {
        const flows = (flowR.data ?? []).slice(0, 5) as any[];
        const totalForeignNet = flows.reduce((s: number, f: any) => s + (Number(f.foreign_buy || 0) - Number(f.foreign_sell || 0)), 0);
        const totalInstNet = flows.reduce((s: number, f: any) => s + (Number(f.inst_buy || 0) - Number(f.inst_sell || 0)), 0);
        const fColor = totalForeignNet > 0 ? 'var(--accent-red)' : totalForeignNet < 0 ? 'var(--accent-blue)' : 'var(--text-tertiary)';
        const iColor = totalInstNet > 0 ? 'var(--accent-red)' : totalInstNet < 0 ? 'var(--accent-blue)' : 'var(--text-tertiary)';
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 'var(--sp-md)' }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>🌍 외국인 5일 순매매</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: fColor }}>{totalForeignNet > 0 ? '+' : ''}{(totalForeignNet / 100000000).toFixed(1)}억</div>
              <div style={{ fontSize: 10, color: fColor }}>{totalForeignNet > 0 ? '순매수' : totalForeignNet < 0 ? '순매도' : '보합'}</div>
            </div>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>🏦 기관 5일 순매매</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: iColor }}>{totalInstNet > 0 ? '+' : ''}{(totalInstNet / 100000000).toFixed(1)}억</div>
              <div style={{ fontSize: 10, color: iColor }}>{totalInstNet > 0 ? '순매수' : totalInstNet < 0 ? '순매도' : '보합'}</div>
            </div>
          </div>
        );
      })()}

      <InlineCTA type="stock" entityName={s.name} entityId={symbol} price={fmtPrice(Number(s.price), s.currency ?? undefined)} />

      {/* 📊 인포그래픽 이미지 — 네이버/구글 이미지 검색 크롤링용 */}
      <figure style={{ margin: '0 0 var(--sp-md)', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <img
          src={`${SITE_URL}/api/og-chart?symbol=${symbol}`}
          alt={`${s.name} ${symbol} 주가 시세 차트 PER PBR 배당수익률 시가총액 ${s.market} ${s.sector || ''} 투자 지표 인포그래픽 2026`}
          width={1200} height={630}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          loading="lazy"
        />
        <figcaption style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '6px 12px', background: 'var(--bg-surface)', textAlign: 'center' }}>
          {s.name}({symbol}) 핵심 투자 지표 · 카더라
        </figcaption>
      </figure>

      {/* AI 종합 분석 — SSR */}
      {stockAnalysisText && (
        <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--card-p) var(--sp-lg)', marginBottom: 'var(--sp-md)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>📊 {s.name} 종합 분석</h2>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.85 }}
            dangerouslySetInnerHTML={{ __html: (stockAnalysisText as string)
              .replace(/^## (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;color:var(--text-primary);margin:16px 0 6px">$1</h3>')
              .replace(/^### (.+)$/gm, '<h4 style="font-size:13px;font-weight:600;color:var(--text-primary);margin:12px 0 4px">$1</h4>')
              .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>')
              .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:var(--brand);text-decoration:underline">$1</a>')
              .replace(/\n\n/g, '</p><p style="margin:0 0 8px">')
              .replace(/\n/g, '<br/>')
            }}
          />
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 10, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
            ※ 본 분석은 데이터 기반 자동 생성된 참고 자료이며, 투자 판단은 본인 책임입니다
          </div>
        </section>
      )}

      {/* 탭 콘텐츠 */}
      <StockDetailTabs
        symbol={symbol}
        stockName={s.name}
        aiComment={(aiR.data as AIComment) || null}
        priceHistory={(histR.data || []) as StockPriceHistory[]}
        news={(newsR.data || []) as StockNews[]}
        investorFlow={(flowR.data || []) as InvestorFlow[]}
        disclosures={(discR.data || []) as Disclosure[]}
        description={s.description ?? `${s.name}은(는) ${s.market} 상장 종목입니다. 자세한 기업 정보는 공식 홈페이지나 증권사 앱에서 확인해보세요.`}
        currency={s.currency ?? 'KRW'}
      />

      {/* ── 크롤러용 서버 렌더링 섹션 (탭 내용은 클라이언트 전용이므로 핵심 데이터를 텍스트로 제공) ── */}

      {/* 최신 뉴스 요약 (서버 렌더링) */}
      {(newsR.data ?? []).length > 0 && (
        <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--card-p) var(--sp-lg)', marginBottom: 'var(--sp-md)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>📰 {s.name} 최신 뉴스</h2>
          {/* 감성 분석 요약 바 */}
          {(() => {
            const all = (newsR.data ?? []) as any[];
            const pos = all.filter(n => n.sentiment_label === 'positive').length;
            const neg = all.filter(n => n.sentiment_label === 'negative').length;
            const neu = all.length - pos - neg;
            const total = all.length || 1;
            return total > 1 ? (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', gap: 1 }}>
                  {pos > 0 && <div style={{ flex: pos, background: 'var(--accent-green)', borderRadius: 3 }} />}
                  {neu > 0 && <div style={{ flex: neu, background: 'var(--border)', borderRadius: 3 }} />}
                  {neg > 0 && <div style={{ flex: neg, background: 'var(--accent-red)', borderRadius: 3 }} />}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3 }}>
                  <span style={{ color: 'var(--accent-green)' }}>긍정 {pos}</span>
                  <span>중립 {neu}</span>
                  <span style={{ color: 'var(--accent-red)' }}>부정 {neg}</span>
                </div>
              </div>
            ) : null;
          })()}
          {(newsR.data ?? []).slice(0, 5).map((n: any) => (
            <div key={n.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>{n.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, display: 'flex', gap: 'var(--sp-sm)' }}>
                <span>{n.source || '뉴스'}</span>
                <span>{n.published_at?.slice(0, 10)}</span>
                {n.sentiment_label && <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: n.sentiment_label === 'positive' ? 'rgba(52,211,153,0.15)' : n.sentiment_label === 'negative' ? 'rgba(248,113,113,0.15)' : 'rgba(148,163,184,0.1)', color: n.sentiment_label === 'positive' ? 'var(--accent-green)' : n.sentiment_label === 'negative' ? 'var(--accent-red)' : 'var(--text-tertiary)' }}>{n.sentiment_label === 'positive' ? '긍정' : n.sentiment_label === 'negative' ? '부정' : '중립'}</span>}
              </div>
              {n.ai_summary && <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '4px 0 0', wordBreak: 'keep-all' }}>{n.ai_summary.slice(0, 100)}</p>}
            </div>
          ))}
        </section>
      )}

      {/* 수급 요약 (서버 렌더링) — 시각적 바 차트 */}
      {(flowR.data ?? []).length > 0 && (() => {
        const flows = (flowR.data ?? []).slice(0, 5) as any[];
        const isKRStock = !s.currency || s.currency === 'KRW';
        const upC = isKRStock ? 'var(--accent-red)' : 'var(--accent-green)';
        const downC = isKRStock ? 'var(--accent-blue)' : 'var(--accent-red)';
        return (
        <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--card-p) var(--sp-lg)', marginBottom: 'var(--sp-md)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>📊 {s.name} 투자자별 수급 ({flows.length}일)</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {flows.map((f: any) => {
              const fNet = (Number(f.foreign_buy) || 0) - (Number(f.foreign_sell) || 0);
              const iNet = (Number(f.inst_buy) || 0) - (Number(f.inst_sell) || 0);
              const maxVal = Math.max(Math.abs(fNet), Math.abs(iNet), 1);
              const fmtN = (n: number) => n === 0 ? '-' : `${n > 0 ? '+' : ''}${Math.abs(n) >= 10000 ? `${(n / 10000).toFixed(0)}만` : n.toLocaleString()}`;
              return (
                <div key={f.date} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <span style={{ width: 42, color: 'var(--text-tertiary)', fontFamily: 'monospace', flexShrink: 0, fontSize: 10 }}>{f.date?.slice(5)}</span>
                  <span style={{ width: 48, textAlign: 'right', flexShrink: 0, fontWeight: 700, color: fNet >= 0 ? upC : downC, fontSize: 10 }}>외 {fmtN(fNet)}</span>
                  <div style={{ flex: 1, height: 16, display: 'flex', alignItems: 'center', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '50%', width: 1, height: '100%', background: 'var(--border)' }} />
                    {fNet !== 0 && <div style={{ position: 'absolute', [fNet > 0 ? 'left' : 'right']: '50%', width: `${Math.min(Math.abs(fNet) / maxVal * 48, 48)}%`, height: 6, borderRadius: 3, background: fNet > 0 ? upC : downC, opacity: 0.6 }} />}
                    {iNet !== 0 && <div style={{ position: 'absolute', [iNet > 0 ? 'left' : 'right']: '50%', width: `${Math.min(Math.abs(iNet) / maxVal * 48, 48)}%`, height: 6, borderRadius: 3, background: iNet > 0 ? upC : downC, opacity: 0.3, top: 8 }} />}
                  </div>
                  <span style={{ width: 48, textAlign: 'left', flexShrink: 0, fontWeight: 700, color: iNet >= 0 ? upC : downC, fontSize: 10 }}>기 {fmtN(iNet)}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 8, fontSize: 9, color: 'var(--text-tertiary)' }}>
            <span>■ 외국인 (진하게)</span><span>□ 기관 (연하게)</span><span style={{ color: upC }}>← 매수</span><span style={{ color: downC }}>매도 →</span>
          </div>
        </section>
        );
      })()}

      {/* 공시 요약 (서버 렌더링) */}
      {(discR.data ?? []).length > 0 && (
        <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--card-p) var(--sp-lg)', marginBottom: 'var(--sp-md)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>📄 {s.name} 최근 공시</h2>
          {(discR.data ?? []).slice(0, 3).map((d: any) => (
            <div key={d.id} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.title}</span>
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>{d.published_at?.slice(0, 10)}</span>
            </div>
          ))}
        </section>
      )}

      {/* 비슷한 종목 */}
      {(similarR.data ?? []).length > 0 && (
        <div className="kd-card">
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>📊 같은 섹터 종목 ({s.sector})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
            {(similarR.data ?? []).map((sim: any) => {
              const simPct = Number(sim.change_pct) || 0;
              const isKR = sim.currency !== 'USD';
              return (
                <Link key={sim.symbol} href={`/stock/${encodeURIComponent(sim.symbol)}`} className="kd-feed-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', color: 'inherit', padding: '6px 4px', borderBottom: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', transition: 'background var(--transition-fast)', gap: 'var(--sp-sm)' }}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)' }}>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sim.name}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>{fmtCap(Number(sim.market_cap), sim.currency)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{sim.currency === 'USD' ? `$${Number(sim.price).toFixed(2)}` : `₩${Number(sim.price).toLocaleString()}`}</span>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, minWidth: 52, textAlign: 'right', color: isKR ? (simPct > 0 ? 'var(--accent-red)' : simPct < 0 ? 'var(--accent-blue)' : 'var(--text-tertiary)') : (simPct > 0 ? 'var(--accent-green)' : simPct < 0 ? 'var(--accent-red)' : 'var(--text-tertiary)') }}>
                      {simPct > 0 ? '+' : ''}{simPct.toFixed(2)}%
                    </span>
                    <div style={{ width: 24, height: 4, borderRadius: 2, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(Math.abs(simPct) * 10, 100)}%`, borderRadius: 2, background: isKR ? (simPct > 0 ? 'var(--accent-red)' : simPct < 0 ? 'var(--accent-blue)' : 'var(--border)') : (simPct > 0 ? 'var(--accent-green)' : simPct < 0 ? 'var(--accent-red)' : 'var(--border)') }} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* 관련 블로그 */}
      {(relatedBlogsR.data ?? []).length > 0 && (
        <div className="kd-card">
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>📰 {s.name} 관련 분석</div>
          {(relatedBlogsR.data ?? []).map((blog: any) => (
            <Link key={blog.slug} href={`/blog/${blog.slug}`} className="kd-feed-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit', padding: '8px 4px', borderRadius: 'var(--radius-xs)', transition: 'background var(--transition-fast)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{blog.title}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {blog.published_at?.slice(0, 10)} · 조회 {blog.view_count || 0}
                </div>
              </div>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 8 }}>→</span>
            </Link>
          ))}
        </div>
      )}

      {/* 자주 묻는 질문 (본문 렌더링 — 네이버 FAQ 리치스니펫) */}
      <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--card-p) var(--sp-lg)', marginBottom: 'var(--sp-md)' }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>❓ {s.name} 자주 묻는 질문</h2>
        {[
          { q: `${s.name} 현재 주가는?`, a: `${s.name}(${symbol})의 현재가는 ${fmtPrice(Number(s.price), s.currency ?? undefined)}이며, 전일 대비 ${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}% 변동했습니다. ${s.market} 상장 종목입니다.` },
          { q: `${s.name} 어떤 섹터인가요?`, a: `${s.name}은(는) ${s.sector || s.market} 섹터에 속하며, ${s.description?.slice(0, 80) || `${s.market}에 상장된 종목입니다.`}` },
          { q: `${s.name} 시세를 어디서 확인하나요?`, a: `카더라(kadeora.app)에서 ${s.name}의 실시간 시세, 차트, 수급 분석, AI 한줄평, 관련 뉴스를 무료로 확인할 수 있습니다.` },
        ].map((faq, i) => (
          <details key={i} style={{ borderBottom: i < 2 ? '1px solid var(--border)' : 'none', padding: '8px 0' }}>
            <summary style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between' }}>
              <span>{faq.q}</span><span style={{ color: 'var(--text-tertiary)' }}>+</span>
            </summary>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '6px 0 0', wordBreak: 'keep-all' }}>{faq.a}</p>
          </details>
        ))}
      </section>

      {/* 업데이트 시간 + 태그 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-md)', fontSize: 11, color: 'var(--text-tertiary)' }}>
        <time dateTime={s.updated_at || new Date().toISOString()}>
          최종 업데이트: {new Date(s.updated_at || Date.now()).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
        </time>
        <div style={{ display: 'flex', gap: 'var(--sp-xs)', flexWrap: 'wrap' }}>
          {[s.market, s.sector, '시세'].filter(Boolean).map(tag => (
            <Link key={tag} href={`/search?q=${encodeURIComponent(tag!)}`} style={{ padding: '2px 8px', borderRadius: 'var(--radius-card)', background: 'var(--bg-hover)', color: 'var(--text-tertiary)', fontSize: 10, textDecoration: 'none' }}>#{tag}</Link>
          ))}
        </div>
      </div>

      {/* 면책고지 */}
      <Disclaimer type="stock" compact />

      {/* 프로 업셀 — 결제 시스템 출시 전까지 비공개 */}
      {false && <div className="kd-card-glow" style={{ padding: '16px 14px', margin: '12px 0', background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 'var(--fs-xl)' }}>🤖</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>AI가 분석한 {s?.name} 리포트</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>프로 멤버십 · 급등락 알림 + AI 분석</div>
          </div>
          <Link href="/shop" style={{ padding: '7px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', fontSize: 11, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>
            자세히
          </Link>
        </div>
      </div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', marginBottom: 6, padding: '6px 10px', borderRadius: 'var(--radius-sm)', background: 'rgba(59,123,246,0.03)', border: '1px solid rgba(59,123,246,0.08)' }}>
        <ShareButtons title={`${s.name} (${symbol}) 주가 — 실시간 시세·차트·섹터 분석`} postId={symbol} />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>이 종목 친구에게 공유하면 +5P</span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--sp-md)' }}>
        <Link href={`/stock/compare?a=${encodeURIComponent(symbol)}`} style={{ flex: 1, textAlign: 'center', padding: 12, background: 'linear-gradient(135deg, var(--bg-surface), var(--bg-hover))', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textDecoration: 'none', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          ⚔️ 다른 종목과 비교
        </Link>
        <Link href="/discuss?tab=stock" style={{ flex: 1, textAlign: 'center', padding: 12, background: 'var(--brand)', borderRadius: 'var(--radius-md)', textDecoration: 'none', fontSize: 13, fontWeight: 700, color: '#fff' }}>
          💬 주식방 토론 참여
        </Link>
      </div>
    </article>
  );
}
