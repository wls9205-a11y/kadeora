export const revalidate = 300;

import { createSupabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import ShareButtons from '@/components/ShareButtons';
import StockWatchlistButton from './WatchlistButton';
import StockDetailTabs from './StockDetailTabs';
import StockAlertButton from '@/components/StockAlertButton';

function fmtPrice(p: number, c: string) { return c === 'KRW' ? `₩${p.toLocaleString()}` : `$${p.toFixed(2)}`; }
function fmtCap(v: number | null, c: string) {
  if (!v) return '-';
  if (c === 'USD') { if (v >= 1e12) return `$${(v/1e12).toFixed(2)}T`; if (v >= 1e9) return `$${(v/1e9).toFixed(1)}B`; return `$${(v/1e6).toFixed(0)}M`; }
  if (v >= 1e12) return `${(v/1e12).toFixed(1)}조`; if (v >= 1e8) return `${Math.round(v/1e8)}억`; return v.toLocaleString();
}

interface Props { params: Promise<{ symbol: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;
  const sb = await createSupabaseServer();
  const { data: s } = await sb.from('stock_quotes').select('name,market,price,currency,change_pct').eq('symbol', symbol).single();
  if (!s) return { title: '카더라' };
  const p = fmtPrice(Number(s.price), s.currency);
  const ch = `${Number(s.change_pct) >= 0 ? '▲' : '▼'}${Math.abs(Number(s.change_pct)).toFixed(2)}%`;
  return {
    title: `${s.name} (${symbol}) 주가`,
    description: `${s.name} 현재가 ${p} ${ch}. ${s.market} 상장.`,
    alternates: { canonical: `https://kadeora.app/stock/${symbol}` },
    openGraph: { title: `${s.name} 주가`, description: `${s.market} · ${p} · ${ch}`, images: [{ url: `https://kadeora.app/api/og?title=${encodeURIComponent(`${s.name} (${symbol}) ${p} ${ch}`)}&category=stock` }] },
  };
}

export default async function StockDetailPage({ params }: Props) {
  const { symbol } = await params;
  const sb = await createSupabaseServer();
  const { data: s } = await sb.from('stock_quotes').select('*').eq('symbol', symbol).single();
  if (!s) notFound();

  const changePct = Number(s.change_pct);
  const isUp = changePct > 0;
  const isDown = changePct < 0;
  const isStale = !s.updated_at || s.updated_at.startsWith('2000-01-01');

  // Parallel fetch all data (필요 컬럼만 select)
  const [histR, aiR, newsR, flowR, discR, similarR, relatedBlogsR] = await Promise.all([
    sb.from('stock_price_history').select('date, close_price, open_price, high_price, low_price, volume, change_pct').eq('symbol', symbol).order('date', { ascending: true }).limit(60),
    sb.from('stock_ai_comments').select('id, symbol, comment, content, signal, created_at').eq('symbol', symbol).order('created_at', { ascending: false }).limit(1).maybeSingle(),
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
    { label: '시가총액', value: fmtCap(s.market_cap ? Number(s.market_cap) : null, s.currency) },
    { label: '거래량', value: s.volume ? Number(s.volume).toLocaleString() : '-' },
    { label: '섹터', value: s.sector || '-' },
    { label: '전일대비', value: s.change_amt ? `${Number(s.change_amt) > 0 ? '+' : ''}${Number(s.change_amt).toLocaleString()}` : '-' },
    ...(high52 ? [{ label: '기간 최고', value: s.currency === 'USD' ? `$${high52.toFixed(2)}` : `₩${high52.toLocaleString()}` }] : []),
    ...(low52 ? [{ label: '기간 최저', value: s.currency === 'USD' ? `$${low52.toFixed(2)}` : `₩${low52.toLocaleString()}` }] : []),
  ];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* JSON-LD 구조화 데이터 */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${s.name} (${symbol}) 주가 정보`,
        description: `${s.name} ${s.market} 상장. 현재가 ${fmtPrice(Number(s.price), s.currency)}.`,
        url: `https://kadeora.app/stock/${symbol}`,
        mainEntity: {
          '@type': 'FinancialProduct',
          name: s.name,
          identifier: symbol,
          category: s.sector || s.market,
          provider: { '@type': 'Organization', name: s.market || 'Exchange' },
        },
        isPartOf: { '@type': 'WebSite', name: '카더라', url: 'https://kadeora.app' },
      })}} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Link href="/stock" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 주식 시세</Link>
        <div style={{ display: 'flex', gap: 6 }}>
          <StockAlertButton symbol={symbol} stockName={s.name} currentPrice={Number(s.price)} currency={s.currency} />
          <StockWatchlistButton symbol={symbol} />
        </div>
      </div>

      {/* 가격 헤더 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{s.name}</h1>
          <span style={{ fontSize: 'var(--fs-sm)', background: 'var(--bg-hover)', color: 'var(--text-tertiary)', padding: '3px 10px', borderRadius: 6 }}>{symbol}</span>
          <span style={{ fontSize: 'var(--fs-sm)', background: 'var(--bg-hover)', color: 'var(--text-tertiary)', padding: '3px 10px', borderRadius: 6 }}>{s.market}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 36, fontWeight: 900, color: 'var(--text-primary)' }}>{fmtPrice(Number(s.price), s.currency)}</span>
          {!isStale && (
            <span style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: isUp ? 'var(--accent-red)' : isDown ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}>
              {isUp ? '▲' : isDown ? '▼' : '━'} {isUp ? '+' : ''}{Number(s.change_amt).toLocaleString()} ({Math.abs(changePct).toFixed(2)}%)
            </span>
          )}
        </div>
        {isStale && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginTop: 8 }}>⏳ 시세 정보 준비 중입니다</div>}
        {s.updated_at && !s.updated_at.startsWith('2000-01-01') && (
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>
            {new Date(s.updated_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준
          </div>
        )}
      </div>

      {/* 기본 정보 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginBottom: 16 }}>
        {items.map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <StockDetailTabs
        symbol={symbol}
        stockName={s.name}
        aiComment={aiR.data || null}
        priceHistory={histR.data || []}
        news={newsR.data || []}
        investorFlow={flowR.data || []}
        disclosures={discR.data || []}
        description={s.description || `${s.name}은(는) ${s.market} 상장 종목입니다. 자세한 기업 정보는 공식 홈페이지나 증권사 앱에서 확인해보세요.`}
        currency={s.currency}
      />

      {/* 비슷한 종목 */}
      {(similarR.data ?? []).length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>📊 같은 섹터 종목 ({s.sector})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(similarR.data ?? []).map((sim: any) => {
              const simPct = Number(sim.change_pct) || 0;
              const isKR = sim.currency !== 'USD';
              return (
                <Link key={sim.symbol} href={`/stock/${encodeURIComponent(sim.symbol)}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', color: 'inherit', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
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
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>📰 {s.name} 관련 분석</div>
          {(relatedBlogsR.data ?? []).map((blog: any) => (
            <Link key={blog.slug} href={`/blog/${blog.slug}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
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
      <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        ⚠️ 본 정보는 투자 권유가 아니며, 투자에 따른 손익은 투자자 본인에게 귀속됩니다. 금융투자상품은 원금 손실이 발생할 수 있습니다.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>공유</span>
        <ShareButtons title={`${s.name} (${symbol}) 주가`} postId={symbol} />
      </div>

      <Link href="/discuss" style={{ display: 'block', textAlign: 'center', padding: 14, background: 'var(--brand)', borderRadius: 12, textDecoration: 'none', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-inverse)' }}>
        💬 라운지 입장
      </Link>
    </div>
  );
}
