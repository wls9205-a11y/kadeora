import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import ShareButtons from '@/components/ShareButtons';
import Disclaimer from '@/components/Disclaimer';

export const revalidate = 3600;

const TITLE = '테마주 분석 2026 — 섹터별 테마 종목 총정리';
const DESC = '2차전지, 반도체, AI, 방산, 바이오 등 주요 테마별 관련주를 분석합니다. 테마별 등락률과 시가총액 순위.';

export const metadata: Metadata = {
  title: TITLE, description: DESC,
  keywords: ['테마주', '2차전지 관련주', 'AI 관련주', '반도체 관련주', '방산 관련주'],
  alternates: { canonical: `${SITE_URL}/stock/themes` },
  openGraph: { title: TITLE, description: DESC, url: `${SITE_URL}/stock/themes`, siteName: '카더라', locale: 'ko_KR', type: 'website', images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent('테마주 분석')}&category=stock&design=2`, width: 1200, height: 630 }] },
  other: { 'naver:author': '카더라', 'naver:written_time': new Date().toISOString(), 'article:section': '주식' },
};

export default async function ThemesPage() {
  const sb = await createSupabaseServer();

  const { data: themes } = await (sb as any).from('stock_themes')
    .select('id, name, description, symbols')
    .order('name');

  // Get all stock quotes for mapping
  const { data: quotes } = await (sb as any).from('stock_quotes')
    .select('symbol, name, price, change_pct, market_cap, currency')
    .in('market', ['KOSPI','KOSDAQ']).gt('price', 0);

  const quoteMap = new Map((quotes ?? []).map((q: any) => [q.symbol, q]));

  return (
    <article style={{ maxWidth: 780, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '주식', item: `${SITE_URL}/stock` }, { '@type': 'ListItem', position: 3, name: '테마주' }] }) }} />
      <nav style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', gap: 4, marginBottom: 8 }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>›
        <Link href="/stock" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>주식</Link>›<span>테마주</span>
      </nav>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 style={{ fontSize: 'clamp(22px, 5vw, 28px)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>🎯 테마주 분석</h1>
        <ShareButtons title={TITLE} />
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>주요 투자 테마별 관련주 목록과 시세를 정리합니다. 총 {(themes ?? []).length}개 테마.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {(themes ?? []).map((theme: any) => {
          const syms: string[] = Array.isArray(theme.symbols) ? theme.symbols : [];
          const stocks = syms.map((sym: string) => quoteMap.get(sym)).filter(Boolean);
          const avgPct = stocks.length > 0 ? stocks.reduce((s: number, q: any) => s + (Number(q.change_pct) || 0), 0) / stocks.length : 0;
          return (
            <div key={theme.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{theme.name}</h2>
                  {theme.description && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{theme.description}</p>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: avgPct > 0 ? 'var(--accent-red)' : avgPct < 0 ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}>
                    {avgPct > 0 ? '+' : ''}{avgPct.toFixed(2)}%
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{stocks.length}종목</div>
                </div>
              </div>
              <div style={{ padding: '6px 14px 10px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {stocks.slice(0, 8).map((q: any) => {
                    const pct = Number(q.change_pct);
                    return (
                      <Link key={q.symbol} href={`/stock/${q.symbol}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', textDecoration: 'none', fontSize: 11 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{q.name}</span>
                        <span style={{ color: pct > 0 ? 'var(--accent-red)' : pct < 0 ? 'var(--accent-blue)' : 'var(--text-tertiary)', fontWeight: 600 }}>
                          {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                        </span>
                      </Link>
                    );
                  })}
                  {stocks.length > 8 && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '4px 8px' }}>+{stocks.length - 8}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 32, display: 'flex', gap: 8 }}>
        <Link href="/stock" style={{ flex: 1, textAlign: 'center', padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>전 종목 시세</Link>
        <Link href="/stock/movers" style={{ flex: 1, textAlign: 'center', padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>급등락 종목</Link>
      </div>
      <Disclaimer />
    </article>
  );
}
