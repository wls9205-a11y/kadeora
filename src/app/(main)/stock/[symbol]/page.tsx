import type { AIComment, StockPriceHistory, StockNews, InvestorFlow, Disclosure } from '@/types/stock';
export const maxDuration = 30;
export const revalidate = 300;
import { SITE_URL } from '@/lib/constants';

import { createSupabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import ShareButtons from '@/components/ShareButtons';
import StockWatchlistButton from './WatchlistButton';
import StockDetailTabs from './StockDetailTabs';
import StockAlertButton from '@/components/StockAlertButton';
import { fmtPrice, fmtCap } from '@/lib/format';
import Disclaimer from '@/components/Disclaimer';

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
  if (!s) return { title: '카더라' };
  const p = fmtPrice(Number(s.price), s.currency ?? undefined);
  const ch = `${Number(s.change_pct) >= 0 ? '▲' : '▼'}${Math.abs(Number(s.change_pct)).toFixed(2)}%`;
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
      images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent(`${s.name} (${symbol}) ${p} ${ch}`)}&design=2&category=stock`, width: 1200, height: 630, alt: `${s.name} 주가 시세` }],
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
        'naver:written_time': s.updated_at || new Date().toISOString(),
        'naver:updated_time': s.updated_at || new Date().toISOString(),
        'article:published_time': s.updated_at || new Date().toISOString(),
        'article:modified_time': s.updated_at || new Date().toISOString(),
        'article:section': '주식',
        'article:tag': `${s.name},${symbol},${s.market},주식,시세,차트`,
        'dg:plink': `${SITE_URL}/stock/${symbol}`,
        'naver:author': '카더라',
        'og:updated_time': s.updated_at || new Date().toISOString(),
      };
    })(),
  };
}

export default async function StockDetailPage({ params }: Props) {
  const { symbol } = await params;
  const sb = await createSupabaseServer();
  const { data: s } = await sb.from('stock_quotes').select('symbol,name,market,price,change_amt,change_pct,volume,market_cap,sector,currency,description,website,ticker,updated_at').eq('symbol', symbol).single();
  if (!s) notFound();

  const changePct = Number(s.change_pct);
  const isUp = changePct > 0;
  const isDown = changePct < 0;
  const isStale = !s.updated_at || s.updated_at.startsWith('2000-01-01');

  // Parallel fetch all data (필요 컬럼만 select)
  const [histR, aiR, newsR, flowR, discR, similarR, relatedBlogsR] = await Promise.all([
    sb.from('stock_price_history').select('date, close_price, open_price, high_price, low_price, volume, change_pct').eq('symbol', symbol).order('date', { ascending: true }).limit(60),
    sb.from('stock_ai_comments').select('id, symbol, comment, signal, created_at').eq('symbol', symbol).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('stock_news').select('id, title, url, source, published_at, sentiment, sentiment_label, sentiment_score, ai_summary').eq('symbol', symbol).order('published_at', { ascending: false }).limit(10),
    sb.from('stock_investor_flow').select('id, date, foreign_buy, foreign_sell, inst_buy, inst_sell').eq('symbol', symbol).order('date', { ascending: false }).limit(5),
    sb.from('stock_disclosures').select('id, title, disclosure_type, source, published_at, created_at').eq('symbol', symbol).order('published_at', { ascending: false }).limit(10),
    s.sector ? sb.from('stock_quotes').select('symbol, name, price, change_pct, market_cap, currency').eq('sector', s.sector).neq('symbol', symbol).gt('price', 0).order('market_cap', { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    // 관련 블로그 (종목명으로 검색)
    sb.from('blog_posts').select('slug, title, category, view_count, published_at').eq('is_published', true).or(`title.ilike.%${s.name}%,title.ilike.%${symbol}%`).order('published_at', { ascending: false }).limit(5),
  ]);

  // 52주 최고/최저 (price_history에서 계산)
  const priceHist = (histR.data || []).map((d: any) => Number(d.close_price)).filter((p: number) => p > 0);
  const high52 = priceHist.length ? Math.max(...priceHist) : null;
  const low52 = priceHist.length ? Math.min(...priceHist) : null;

  const items = [
    { label: '시가총액', value: fmtCap(s.market_cap ? Number(s.market_cap) : null, s.currency ?? undefined) },
    { label: '거래량', value: s.volume ? Number(s.volume).toLocaleString() : '-' },
    { label: '섹터', value: s.sector || '-' },
    { label: '전일대비', value: s.change_amt ? `${Number(s.change_amt) > 0 ? '+' : ''}${Number(s.change_amt).toLocaleString()}` : '-' },
  ];

  return (
    <article style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
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
        dateModified: s.updated_at || new Date().toISOString(),
        author: { '@type': 'Organization', name: '카더라', url: SITE_URL },
        publisher: { '@type': 'Organization', name: '카더라', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icons/icon-192.png` } },
        image: `${SITE_URL}/api/og?title=${encodeURIComponent(`${s.name} (${symbol})`)}&design=2&category=stock`,
        speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.stock-price-header'] },
      })}} />
      {/* JSON-LD 4: FAQ (검색결과 아코디언) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: `${s.name} 현재 주가는?`, acceptedAnswer: { '@type': 'Answer', text: `${s.name}(${symbol})의 현재가는 ${fmtPrice(Number(s.price), s.currency ?? undefined)}이며, 전일 대비 ${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}% 변동했습니다. ${s.market} 상장 종목입니다.` } },
          { '@type': 'Question', name: `${s.name} 어떤 섹터인가요?`, acceptedAnswer: { '@type': 'Answer', text: `${s.name}은(는) ${s.sector || s.market} 섹터에 속하며, ${s.description || `${s.market}에 상장된 종목입니다.`}` } },
          { '@type': 'Question', name: `${s.name} 시세를 어디서 확인하나요?`, acceptedAnswer: { '@type': 'Answer', text: `카더라(kadeora.app)에서 ${s.name}의 실시간 시세, 차트, 수급 분석, AI 한줄평, 관련 뉴스를 무료로 확인할 수 있습니다. 카카오 로그인으로 관심종목 등록, 가격 알림도 설정 가능합니다.` } },
        ],
      })}} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
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

      {/* 히어로 이미지 (검색엔진 썸네일 소스) */}
      <div style={{ marginBottom: 12, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/og?title=${encodeURIComponent(`${s.name} (${symbol}) ${fmtPrice(Number(s.price), s.currency ?? undefined)} ${changePct >= 0 ? '▲' : '▼'}${Math.abs(changePct).toFixed(2)}%`)}&design=2&category=stock`}
          alt={`${s.name} (${symbol}) 주가 시세 — ${s.market} 상장 ${s.sector || ''} 종목`}
          width={1200} height={630}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          loading="eager"
        />
      </div>

      {/* 가격 헤더 */}
      <div style={{
        background: isUp ? 'linear-gradient(135deg, rgba(248,113,113,0.06), var(--bg-surface))' : isDown ? 'linear-gradient(135deg, rgba(96,165,250,0.06), var(--bg-surface))' : 'var(--bg-surface)',
        border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{s.name}</h1>
          <span style={{ fontSize: 11, background: 'var(--bg-hover)', color: 'var(--text-tertiary)', padding: '2px 8px', borderRadius: 4 }}>{symbol}</span>
          <span style={{ fontSize: 11, background: 'var(--bg-hover)', color: 'var(--text-tertiary)', padding: '2px 8px', borderRadius: 4 }}>{s.market}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'clamp(22px, 6vw, 32px)', fontWeight: 900, color: 'var(--text-primary)' }}>{fmtPrice(Number(s.price), s.currency ?? undefined)}</span>
          {!isStale && (
            <span style={{ fontSize: 18, fontWeight: 700, color: isUp ? 'var(--accent-red)' : isDown ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}>
              {isUp ? '▲' : isDown ? '▼' : '━'} {isUp ? '+' : ''}{Number(s.change_amt).toLocaleString()} ({Math.abs(changePct).toFixed(2)}%)
            </span>
          )}
        </div>
        {isStale && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>시세 정보 준비 중</div>}
        {s.updated_at && !s.updated_at.startsWith('2000-01-01') && (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
            {new Date(s.updated_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준
          </div>
        )}
      </div>

      {/* 기본 정보 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6, marginBottom: 12 }}>
        {items.map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* 52주 가격 범위 바 */}
      {high52 && low52 && high52 > 0 && low52 > 0 && high52 !== low52 && (
        <div style={{ marginBottom: 12, padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>가격 범위 (기간)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

      {/* 투자 요약 (네이버 크롤러 가시적 텍스트) */}
      <section className="stock-investment-summary" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
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
        <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>📰 {s.name} 최신 뉴스</h2>
          {(newsR.data ?? []).slice(0, 5).map((n: any) => (
            <div key={n.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>{n.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, display: 'flex', gap: 8 }}>
                <span>{n.source || '뉴스'}</span>
                <span>{n.published_at?.slice(0, 10)}</span>
                {n.sentiment_label && <span style={{ color: n.sentiment_label === 'positive' ? 'var(--accent-green)' : n.sentiment_label === 'negative' ? 'var(--accent-red)' : 'var(--text-tertiary)' }}>{n.sentiment_label === 'positive' ? '긍정' : n.sentiment_label === 'negative' ? '부정' : '중립'}</span>}
              </div>
              {n.ai_summary && <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '4px 0 0', wordBreak: 'keep-all' }}>{n.ai_summary.slice(0, 100)}</p>}
            </div>
          ))}
        </section>
      )}

      {/* 수급 요약 (서버 렌더링) */}
      {(flowR.data ?? []).length > 0 && (
        <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>📊 {s.name} 투자자별 매매동향</h2>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0, wordBreak: 'keep-all' }}>
            {(() => {
              const latest = (flowR.data ?? [])[0] as any;
              if (!latest) return '';
              const foreignNet = (Number(latest.foreign_buy) || 0) - (Number(latest.foreign_sell) || 0);
              const instNet = (Number(latest.inst_buy) || 0) - (Number(latest.inst_sell) || 0);
              return `최근 ${latest.date} 기준, 외국인은 ${foreignNet >= 0 ? '순매수' : '순매도'} ${Math.abs(foreignNet).toLocaleString()}주, 기관은 ${instNet >= 0 ? '순매수' : '순매도'} ${Math.abs(instNet).toLocaleString()}주입니다.`;
            })()}
          </p>
        </section>
      )}

      {/* 공시 요약 (서버 렌더링) */}
      {(discR.data ?? []).length > 0 && (
        <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(similarR.data ?? []).map((sim: any) => {
              const simPct = Number(sim.change_pct) || 0;
              const isKR = sim.currency !== 'USD';
              return (
                <Link key={sim.symbol} href={`/stock/${encodeURIComponent(sim.symbol)}`} className="kd-feed-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', color: 'inherit', padding: '6px 4px', borderBottom: '1px solid var(--border)', borderRadius: 6, transition: 'background var(--transition-fast)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{sim.name}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{sim.symbol}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{fmtCap(Number(sim.market_cap), sim.currency)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{sim.currency === 'USD' ? `$${Number(sim.price).toFixed(2)}` : `₩${Number(sim.price).toLocaleString()}`}</span>
                    <div style={{ width: 24, height: 4, background: 'var(--bg-hover)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(Math.abs(simPct) * 10, 100)}%`, height: '100%', background: isKR ? (simPct > 0 ? 'var(--accent-red)' : 'var(--accent-blue)') : (simPct > 0 ? 'var(--accent-green)' : 'var(--accent-red)'), borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: isKR ? (simPct > 0 ? 'var(--accent-red)' : simPct < 0 ? 'var(--accent-blue)' : 'var(--text-tertiary)') : (simPct > 0 ? 'var(--accent-green)' : simPct < 0 ? 'var(--accent-red)' : 'var(--text-tertiary)') }}>
                      {simPct > 0 ? '+' : ''}{simPct.toFixed(2)}%
                    </span>
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
            <Link key={blog.slug} href={`/blog/${blog.slug}`} className="kd-feed-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit', padding: '8px 4px', borderRadius: 6, transition: 'background var(--transition-fast)', borderBottom: '1px solid var(--border)' }}>
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
      <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
        <time dateTime={s.updated_at || new Date().toISOString()}>
          최종 업데이트: {new Date(s.updated_at || Date.now()).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
        </time>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[s.market, s.sector, '시세'].filter(Boolean).map(tag => (
            <Link key={tag} href={`/search?q=${encodeURIComponent(tag!)}`} style={{ padding: '2px 8px', borderRadius: 12, background: 'var(--bg-hover)', color: 'var(--text-tertiary)', fontSize: 10, textDecoration: 'none' }}>#{tag}</Link>
          ))}
        </div>
      </div>

      {/* 면책고지 */}
      <Disclaimer type="stock" compact />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <ShareButtons title={`${s.name} (${symbol}) 주가`} postId={symbol} />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <Link href={`/stock/compare?a=${encodeURIComponent(symbol)}`} style={{ flex: 1, textAlign: 'center', padding: 12, background: 'linear-gradient(135deg, var(--bg-surface), var(--bg-hover))', border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          ⚔️ 다른 종목과 비교
        </Link>
        <Link href={`/discussion/stock/${symbol}`} style={{ flex: 1, textAlign: 'center', padding: 12, background: 'var(--brand)', borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 700, color: '#fff' }}>
          💬 {s.name} 토론방
        </Link>
      </div>
    </article>
  );
}
