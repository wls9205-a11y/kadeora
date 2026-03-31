import { createSupabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { fmtCap, stockColor, fmtPrice } from '@/lib/format';
import Disclaimer from '@/components/Disclaimer';
import ShareButtons from '@/components/ShareButtons';

export const revalidate = 3600;

interface Props { params: Promise<{ name: string }> }

export async function generateStaticParams() {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
    const sb = getSupabaseAdmin();
    const { data } = await sb.from('stock_quotes')
      .select('sector')
      .not('sector', 'is', null)
      .neq('sector', '')
      .gt('price', 0);
    const sectors = [...new Set((data || []).map((s: any) => s.sector))];
    return sectors.map(s => ({ name: encodeURIComponent(s) }));
  } catch { return []; }
}

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
      images: [
        { url: `${SITE_URL}/api/og?title=${encodeURIComponent(sector + ' 섹터 종목')}&design=2&category=stock`, width: 1200, height: 630, alt: `${sector} 섹터 종목` },
        { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent(sector + ' 섹터')}&category=stock`, width: 630, height: 630, alt: `${sector} 섹터` },
      ],
    },
    twitter: { card: 'summary_large_image' as const, title: `${sector} 섹터 종목`, description: `${sector} 관련 주식 시세, 시총 순위, 등락률 비교` },
    other: {
      'geo.region': 'KR-11',
      'geo.placename': '서울',
      'geo.position': '37.5665;126.9780',
      'ICBM': '37.5665, 126.9780',
      'naver:written_time': '2026-01-15T00:00:00Z',
      'naver:updated_time': new Date().toISOString(),
      'dg:plink': `${SITE_URL}/stock/sector/${encodeURIComponent(sector)}`,
      'article:section': '주식',
      'article:tag': `${sector},섹터,주식,시세,등락률,시가총액`,
      'article:published_time': '2026-01-15T00:00:00Z',
      'article:modified_time': new Date().toISOString(),
      'naver:author': '카더라',
      'og:updated_time': new Date().toISOString(),
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
    <article style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
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
      {/* JSON-LD: speakable */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: `${sector} 섹터 종목`, url: `${SITE_URL}/stock/sector/${encodeURIComponent(sector)}`, mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/stock/sector/${encodeURIComponent(sector)}` }, thumbnailUrl: `${SITE_URL}/api/og-square?title=${encodeURIComponent(sector + ' 섹터')}&category=stock`, speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.sector-summary'] } }) }} />
      {/* JSON-LD: FAQPage */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: `${sector} 섹터에는 어떤 종목이 있나요?`, acceptedAnswer: { '@type': 'Answer', text: `${sector} 섹터에는 ${stocks.length}개 종목이 있으며, 시총 상위 종목으로 ${top10.slice(0, 3).map(s => s.name).join(', ')} 등이 있습니다.` } },
          { '@type': 'Question', name: `${sector} 섹터 전체 시가총액은?`, acceptedAnswer: { '@type': 'Answer', text: `${sector} 섹터 전체 합산 시가총액은 ${fmtCap(totalCap, stocks[0]?.currency ?? undefined)}이며, ${stocks.length}개 종목 중 ${upCount}개 상승, ${downCount}개 하락입니다.` } },
          { '@type': 'Question', name: `${sector} 섹터 시세를 어디서 확인하나요?`, acceptedAnswer: { '@type': 'Answer', text: `카더라(kadeora.app)에서 ${sector} 섹터 전체 종목의 실시간 시세, 시총 순위, 등락률을 무료로 비교할 수 있습니다.` } },
        ],
      })}} />
      {/* 가시적 브레드크럼 */}
      <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-md)' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>
        <span>›</span>
        <Link href="/stock" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>주식</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{sector} 섹터</span>
      </nav>

      {/* 히어로 이미지 */}
      <div style={{ marginBottom: 'var(--sp-md)', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/og?title=${encodeURIComponent(sector + ' 섹터 종목')}&design=2&category=stock&subtitle=${encodeURIComponent(stocks.length + '종목 · 시총 ' + fmtCap(totalCap, stocks[0]?.currency ?? undefined))}`}
          alt={`${sector} 섹터 주식 종목 — ${stocks.length}종목 시총 순위 비교`}
          width={1200} height={630}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          loading="eager"
        />
      </div>

      <div style={{ marginBottom: 'var(--sp-lg)' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>{sector} 섹터</h1>
        <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
          {stocks.length}종목 · 합산 시총 {fmtCap(totalCap, stocks[0]?.currency ?? undefined)} · 평균 등락 {avgPct >= 0 ? '+' : ''}{avgPct.toFixed(2)}%
        </p>
        <time dateTime={new Date().toISOString()} style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {new Date().toLocaleDateString('ko-KR')} 기준
        </time>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <ShareButtons title={`${sector} 섹터 ${stocks.length}종목 — 시세·등락률 비교`} postId={`sector-${sector}`} />
        </div>
      </div>

      {/* SEO 가시적 텍스트 */}
      <p className="site-description" style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7, margin: '0 0 12px', wordBreak: 'keep-all' }}>
        {sector} 섹터에 속한 {stocks.length}개 종목의 시가총액, 등락률, 거래량을 비교 분석합니다.
        {(() => { const up = stocks.filter(s => Number(s.change_pct) > 0).length; const down = stocks.filter(s => Number(s.change_pct) < 0).length; return ` 현재 상승 ${up}종목, 하락 ${down}종목이며, 섹터 평균 등락률은 ${avgPct >= 0 ? '+' : ''}${avgPct.toFixed(2)}%입니다.`; })()}
        {stocks[0] && ` 시총 1위는 ${stocks[0].name}입니다.`}
      </p>

      {/* 섹터 요약 — 시각 대시보드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-lg)' }}>
        {/* 상승/하락 도넛 차트 */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <svg viewBox="0 0 80 80" style={{ width: 70, height: 70 }}>
            {(() => {
              const flat = stocks.length - upCount - downCount;
              const total = stocks.length || 1;
              const upDeg = (upCount / total) * 360;
              const flatDeg = (flat / total) * 360;
              const downDeg = (downCount / total) * 360;
              const r = 30, cx = 40, cy = 40;
              const arc = (start: number, sweep: number) => {
                const s = (start - 90) * Math.PI / 180;
                const e = (start + sweep - 90) * Math.PI / 180;
                const large = sweep > 180 ? 1 : 0;
                return `M${cx + r * Math.cos(s)},${cy + r * Math.sin(s)} A${r},${r} 0 ${large} 1 ${cx + r * Math.cos(e)},${cy + r * Math.sin(e)}`;
              };
              return (<>
                {upCount > 0 && <path d={arc(0, upDeg)} fill="none" stroke={isKR ? 'var(--accent-red)' : 'var(--accent-green)'} strokeWidth="10" strokeLinecap="round" />}
                {flat > 0 && <path d={arc(upDeg, flatDeg)} fill="none" stroke="var(--border)" strokeWidth="10" strokeLinecap="round" />}
                {downCount > 0 && <path d={arc(upDeg + flatDeg, downDeg)} fill="none" stroke={isKR ? 'var(--accent-blue)' : 'var(--accent-red)'} strokeWidth="10" strokeLinecap="round" />}
                <text x="40" y="37" textAnchor="middle" style={{ fontSize: 14, fontWeight: 800, fill: 'var(--text-primary)' }}>{stocks.length}</text>
                <text x="40" y="50" textAnchor="middle" style={{ fontSize: 8, fill: 'var(--text-tertiary)' }}>종목</text>
              </>);
            })()}
          </svg>
          <div style={{ display: 'flex', gap: 'var(--sp-sm)', marginTop: 6, fontSize: 10 }}>
            <span style={{ color: isKR ? 'var(--accent-red)' : 'var(--accent-green)' }}>▲{upCount}</span>
            <span style={{ color: 'var(--text-tertiary)' }}>━{stocks.length - upCount - downCount}</span>
            <span style={{ color: isKR ? 'var(--accent-blue)' : 'var(--accent-red)' }}>▼{downCount}</span>
          </div>
        </div>
        {/* KPI 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 6 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>합산 시총</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{fmtCap(totalCap, stocks[0]?.currency ?? undefined)}</div>
          </div>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>평균 등락률</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: avgPct >= 0 ? (isKR ? 'var(--accent-red)' : 'var(--accent-green)') : (isKR ? 'var(--accent-blue)' : 'var(--accent-red)') }}>
              {avgPct >= 0 ? '+' : ''}{avgPct.toFixed(2)}%
            </div>
          </div>
          {/* Top Gainer */}
          {stocks.length > 0 && (() => {
            const gainer = stocks.reduce((a, b) => (a.change_pct || 0) > (b.change_pct || 0) ? a : b);
            const loser = stocks.reduce((a, b) => (a.change_pct || 0) < (b.change_pct || 0) ? a : b);
            return (<>
              <div style={{ background: isKR ? 'rgba(248,113,113,0.06)' : 'rgba(52,211,153,0.06)', border: `1px solid ${isKR ? 'rgba(248,113,113,0.2)' : 'rgba(52,211,153,0.2)'}`, borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>🔥 최고 상승</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gainer.name}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: isKR ? 'var(--accent-red)' : 'var(--accent-green)' }}>+{(gainer.change_pct || 0).toFixed(2)}%</div>
              </div>
              <div style={{ background: isKR ? 'rgba(96,165,250,0.06)' : 'rgba(248,113,113,0.06)', border: `1px solid ${isKR ? 'rgba(96,165,250,0.2)' : 'rgba(248,113,113,0.2)'}`, borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>❄️ 최고 하락</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loser.name}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: isKR ? 'var(--accent-blue)' : 'var(--accent-red)' }}>{(loser.change_pct || 0).toFixed(2)}%</div>
              </div>
            </>);
          })()}
        </div>
      </div>

      {/* 시총 분포 바 (Top 5) */}
      {stocks.length >= 3 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)', marginBottom: 'var(--sp-md)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-sm)' }}>시총 비중 TOP5</div>
          {stocks.slice(0, 5).map((s, i) => {
            const pct = totalCap > 0 ? ((s.market_cap || 0) / totalCap) * 100 : 0;
            return (
              <div key={s.symbol} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--sp-xs)' }}>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', minWidth: 50, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, borderRadius: 3, background: `hsl(${220 - i * 20}, 70%, ${50 + i * 5}%)` }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 32, textAlign: 'right' }}>{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 종목 리스트 */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)' }}>📊 {sector} 섹터 시총 순위</h2>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '0 var(--sp-lg)' }}>
        {stocks.map((s, i) => {
          const pct = s.change_pct ?? 0;
          return (
            <Link key={s.symbol} href={`/stock/${encodeURIComponent(s.symbol)}`} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', padding: '10px 4px',
              borderBottom: i < stocks.length - 1 ? '1px solid var(--border)' : 'none',
              textDecoration: 'none', color: 'inherit',
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', minWidth: 18, textAlign: 'center' }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{s.symbol} · {fmtCap(s.market_cap, s.currency ?? undefined)}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {fmtPrice(s.price ?? 0, s.currency ?? undefined)}
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: stockColor(pct, isKR) }}>
                  {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
                </div>
                <div style={{ width: 30, height: 4, borderRadius: 2, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(Math.abs(pct) * 10, 100)}%`, borderRadius: 2, background: stockColor(pct, isKR) }} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* 다른 섹터 링크 */}
      <div style={{ marginTop: 'var(--sp-xl)', padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>📊 다른 섹터</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['반도체', '금융', '자동차', '바이오', '화학', '철강', '건설', '유통', 'IT', '에너지', '통신', '엔터', '방산', '조선'].map(s => (
            <Link key={s} href={`/stock/sector/${encodeURIComponent(s)}`} style={{
              padding: '4px 10px', borderRadius: 'var(--radius-xs)', fontSize: 'var(--fs-xs)', fontWeight: 500,
              background: s === sector ? 'var(--brand)' : 'var(--bg-hover)',
              color: s === sector ? 'var(--text-inverse)' : 'var(--text-secondary)',
              textDecoration: 'none', border: '1px solid var(--border)',
            }}>{s}</Link>
          ))}
        </div>
      </div>

      <Disclaimer type="stock" compact />
    </article>
  );
}