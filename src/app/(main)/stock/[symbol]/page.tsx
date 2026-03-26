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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;
  const sb = await createSupabaseServer();
  const { data: s } = await sb.from('stock_quotes').select('name,market,price,currency,change_pct').eq('symbol', symbol).single();
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
      images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent(`${s.name} (${symbol}) ${p} ${ch}`)}&category=stock`, width: 1200, height: 630, alt: `${s.name} 주가 시세` }],
    },
    twitter: { card: 'summary_large_image', title: `${s.name} ${p} ${ch}`, description: `${s.market} · 실시간 시세 · 차트 · 수급 분석` },
    other: {
      'naver:written_time': new Date().toISOString(),
      'naver:updated_time': new Date().toISOString(),
      'article:section': '주식',
      'article:tag': `${s.name},${symbol},${s.market},주식,시세,차트`,
      'dg:plink': `${SITE_URL}/stock/${symbol}`,
    },
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
    ...(high52 ? [{ label: '기간 최고', value: s.currency === 'USD' ? `$${high52.toFixed(2)}` : `₩${high52.toLocaleString()}` }] : []),
    ...(low52 ? [{ label: '기간 최저', value: s.currency === 'USD' ? `$${low52.toFixed(2)}` : `₩${low52.toLocaleString()}` }] : []),
  ];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
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
        image: `${SITE_URL}/api/og?title=${encodeURIComponent(`${s.name} (${symbol})`)}&category=stock`,
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
        <Link href="/stock" style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 주식</Link>
        <div style={{ display: 'flex', gap: 6 }}>
          <StockAlertButton symbol={symbol} stockName={s.name} currentPrice={Number(s.price)} currency={s.currency ?? 'KRW'} />
          <StockWatchlistButton symbol={symbol} />
        </div>
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

      {/* 면책고지 */}
      <Disclaimer type="stock" compact />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>공유</span>
        <ShareButtons title={`${s.name} (${symbol}) 주가`} postId={symbol} />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <Link href={`/stock/compare?a=${encodeURIComponent(symbol)}`} style={{ flex: 1, textAlign: 'center', padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          종목 비교
        </Link>
        <Link href="/discuss" style={{ flex: 1, textAlign: 'center', padding: 12, background: 'var(--brand)', borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 700, color: '#fff' }}>
          라운지 입장
        </Link>
      </div>
    </div>
  );
}
