import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';
import { SITE_URL as SITE } from '@/lib/constants';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '주식 통계 자료실 — 종목별·섹터별 시세 데이터',
  description: '국내외 주식 종목별 시세, 시가총액, 거래량, 섹터 통계 데이터를 무료로 다운로드하세요. 카더라 독점 분석.',
  keywords: ['주식 통계', '종목 데이터', '시가총액 순위', '코스피 데이터', '코스닥 데이터', 'NYSE 데이터', '주식 다운로드'],
  openGraph: {
    title: '주식 통계 자료실 — 카더라',
    description: '국내외 주식 종목별·섹터별 시세 데이터 무료 다운로드',
    url: `${SITE}/stock/data`,
    images: [{ url: `${SITE}/api/og?title=${encodeURIComponent('주식 통계 자료실')}&category=stock&design=2`, width: 1200, height: 630 }],
  },
  alternates: { canonical: `${SITE}/stock/data` },
};

export const revalidate = 3600;

export default async function StockDataPage() {
  const sb = await createSupabaseServer();

  // 통계 집계
  const { count: totalSymbols } = await (sb as any).from('stock_symbols').select('id', { count: 'exact', head: true });
  const { count: totalPrices } = await (sb as any).from('stock_price_history').select('id', { count: 'exact', head: true });

  // 마켓별 종목수
  const { data: marketStats } = await (sb as any).from('stock_symbols').select('market');
  const marketCounts: Record<string, number> = {};
  (marketStats ?? []).forEach((r: any) => {
    const m = r.market || '기타';
    marketCounts[m] = (marketCounts[m] || 0) + 1;
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DataCatalog',
    name: '카더라 주식 통계 자료실',
    description: '국내외 주식 종목별·섹터별 시세 데이터',
    url: `${SITE}/stock/data`,
    provider: { '@type': 'Organization', name: '카더라', url: SITE },
    inLanguage: 'ko-KR',
    dateModified: new Date().toISOString(),
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px 80px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div style={{ padding: '24px 0 16px' }}>
        <nav style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12, display: 'flex', gap: 4 }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>
          <span>›</span>
          <Link href="/stock" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>주식</Link>
          <span>›</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>통계 자료실</span>
        </nav>
        <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.5px' }}>
          📈 주식 통계 자료실
        </h1>
        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
          국내외 주식 종목별 시세, 시가총액, 거래량, 섹터 통계를 무료로 다운로드하세요.<br />
          투자 전문가, 퀀트 분석가를 위한 카더라 독점 데이터입니다.
        </p>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 28 }}>
        {[
          { label: '종목 수', value: totalSymbols?.toLocaleString() ?? '-', emoji: '📊' },
          { label: '가격 데이터', value: totalPrices?.toLocaleString() ?? '-', emoji: '💹' },
          { label: 'KOSPI', value: `${marketCounts['KOSPI'] || 0}종목`, emoji: '🇰🇷' },
          { label: 'KOSDAQ', value: `${marketCounts['KOSDAQ'] || 0}종목`, emoji: '🇰🇷' },
          { label: 'NYSE', value: `${marketCounts['NYSE'] || 0}종목`, emoji: '🇺🇸' },
          { label: 'NASDAQ', value: `${marketCounts['NASDAQ'] || 0}종목`, emoji: '🇺🇸' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{k.emoji}</div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)' }}>{k.value}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* 다운로드 카테고리 */}
      <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 14 }}>📥 데이터 카테고리</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 32 }}>
        {[
          { title: '전 종목 시세 현황', desc: 'KOSPI·KOSDAQ·NYSE·NASDAQ 전 종목의 현재가·시총·등락률', href: '/api/data/stock-prices', icon: '💹', format: 'CSV' },
          { title: '섹터별 종목 분류', desc: '업종·테마별 종목 분류 및 섹터 시가총액 통계', href: '/api/data/stock-sectors', icon: '🏭', format: 'CSV' },
          { title: '가격 히스토리', desc: '최근 30일간 일별 시가·종가·고가·저가·거래량', href: '/api/data/stock-history', icon: '📉', format: 'CSV' },
        ].map(item => (
          <a key={item.title} href={item.href} download style={{
            display: 'block', padding: 18, borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            textDecoration: 'none', transition: 'border-color 0.15s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 28 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</div>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' }}>{item.format}</span>
              </div>
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</div>
          </a>
        ))}
      </div>

      {/* 마켓별 종목 */}
      <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 14 }}>🔎 마켓별 종목</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 32 }}>
        {[
          { market: 'KOSPI', label: '코스피', emoji: '🇰🇷' },
          { market: 'KOSDAQ', label: '코스닥', emoji: '🇰🇷' },
          { market: 'NYSE', label: '뉴욕증권거래소', emoji: '🇺🇸' },
          { market: 'NASDAQ', label: '나스닥', emoji: '🇺🇸' },
        ].map(m => (
          <Link key={m.market} href={`/stock?market=${m.market}`} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 16px', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            textDecoration: 'none', color: 'var(--text-primary)',
          }}>
            <span style={{ fontSize: 20 }}>{m.emoji}</span>
            <div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>{m.label}</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{marketCounts[m.market] || 0}종목</div>
            </div>
          </Link>
        ))}
      </div>

      {/* 가입 유도 */}
      <div style={{
        padding: 24, borderRadius: 'var(--radius-lg)', textAlign: 'center',
        background: 'linear-gradient(135deg, var(--brand-bg), var(--accent-purple-bg))',
        border: '1px solid var(--brand-border)',
      }}>
        <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
          AI 종목 분석도 받아보세요
        </div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
          카더라에 가입하면 AI 종목 분석, 실시간 급등주 알림, 섹터 리포트까지 무료!
        </div>
        <Link href="/login?redirect=/stock/data" style={{
          display: 'inline-block', padding: '12px 32px', borderRadius: 'var(--radius-pill)',
          background: 'var(--kakao-bg)', color: 'var(--kakao-text)',
          fontWeight: 700, fontSize: 'var(--fs-base)', textDecoration: 'none',
        }}>
          카카오로 3초 가입
        </Link>
      </div>
    </div>
  );
}
