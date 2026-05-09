// s262 Phase C — Issue Engine v1 home (legacy: src/_legacy/s262/home_page_v0.tsx)
// 4 섹션: hero stat bar + 이슈종목 5 + 이슈단지 5 + 인기 블로그 3
// 데이터: stock_issue_scores / apt_issue_scores 직접 query (top 5) + get_home_data hero/blog
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL as SITE } from '@/lib/constants';
import StockIssueCard from '@/components/cards/StockIssueCard';
import AptIssueCard from '@/components/cards/AptIssueCard';
import type { StockIssueScore, AptIssueScore } from '@/lib/issue/types';
import type { HomeData } from '@/lib/home/contracts';

export const revalidate = 60; // s262 — issue scores 5분 cron 가정 + edge cache

export const metadata: Metadata = {
  title: '카더라 — 오늘의 이슈 종목·청약·블로그',
  description: '오늘 가장 변동성 큰 종목, 마감 임박 청약, 인기 블로그를 한 화면에. 카더라 이슈 엔진 v1.',
  alternates: { canonical: SITE },
  openGraph: {
    title: '카더라 — 오늘의 이슈',
    description: '주식 시세, 아파트 청약, 미분양·재개발·실거래가, 커뮤니티 토론을 한 곳에서.',
    url: SITE,
    siteName: '카더라',
    images: [{ url: `${SITE}/images/brand/kadeora-wide.png`, width: 1200, height: 630, alt: '카더라' }],
    locale: 'ko_KR',
    type: 'website',
  },
};

async function fetchHome(): Promise<{
  hero: HomeData['hero_issue'];
  stocks: StockIssueScore[];
  apts: AptIssueScore[];
  blogs: HomeData['hot_blog'];
}> {
  const sb = getSupabaseAdmin();
  try {
    const [home, stockRes, aptRes] = await Promise.all([
      (sb as any).rpc('get_home_data'),
      (sb as any).from('stock_issue_scores').select('*').is('warning', null).order('score', { ascending: false, nullsFirst: false }).limit(5),
      (sb as any).from('apt_issue_scores').select('*').is('warning', null).order('score', { ascending: false, nullsFirst: false }).limit(5),
    ]);
    const homeData: HomeData | null = home?.data ?? null;
    return {
      hero:   homeData?.hero_issue ?? null,
      stocks: (stockRes?.data ?? []) as StockIssueScore[],
      apts:   (aptRes?.data ?? []) as AptIssueScore[],
      blogs:  homeData?.hot_blog ?? [],
    };
  } catch (e) {
    console.error('[home] fetch failed:', e);
    return { hero: null, stocks: [], apts: [], blogs: [] };
  }
}

export default async function HomePage() {
  const { hero, stocks, apts, blogs } = await fetchHome();

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '8px 6px 24px' }}>
      <h1 className="sr-only">카더라 — 오늘의 이슈 종목·청약·블로그</h1>

      {/* Hero stat bar */}
      <section style={{ margin: '6px 3px 12px', padding: '12px 14px', borderRadius: 8, background: 'linear-gradient(180deg, #1F2937 0%, #111827 100%)', color: '#FFFFFF' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#FBBF24', letterSpacing: 0.4, marginBottom: 4 }}>
          오늘의 이슈
        </div>
        {hero ? (
          <Link
            href={hero.kind === 'stock' ? `/stock/${hero.id}` : `/issue/${hero.id}`}
            style={{ color: '#FFFFFF', textDecoration: 'none' }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>{hero.title}</div>
            {hero.summary ? (
              <div style={{ fontSize: 12, color: '#D1D5DB', marginTop: 4, lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                {hero.summary}
              </div>
            ) : null}
          </Link>
        ) : (
          <div style={{ fontSize: 13, color: '#D1D5DB' }}>오늘 이슈 데이터 준비 중</div>
        )}
        <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 11, color: '#9CA3AF' }}>
          <span>이슈 종목 {stocks.length}</span>
          <span>이슈 단지 {apts.length}</span>
          <span>인기 블로그 {blogs.length}</span>
        </div>
      </section>

      {/* 이슈 종목 TOP 5 */}
      <section style={{ marginBottom: 18 }}>
        <SectionHeader title="📈 이슈 종목" href="/stock?tab=issue" more="전체" />
        {stocks.length === 0 ? (
          <Empty label="이슈 점수 데이터 준비 중" />
        ) : (
          stocks.map((s) => <StockIssueCard key={s.symbol} data={s} />)
        )}
      </section>

      {/* 이슈 단지 TOP 5 */}
      <section style={{ marginBottom: 18 }}>
        <SectionHeader title="🏢 이슈 단지" href="/apt" more="전체" />
        {apts.length === 0 ? (
          <Empty label="이슈 단지 데이터 준비 중" />
        ) : (
          apts.map((a) => <AptIssueCard key={a.id} data={a} />)
        )}
      </section>

      {/* 인기 블로그 3 */}
      <section style={{ marginBottom: 18 }}>
        <SectionHeader title="📰 인기 블로그" href="/blog" more="전체" />
        {blogs.length === 0 ? (
          <Empty label="블로그 준비 중" />
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {blogs.map((b) => (
              <Link
                key={b.slug}
                href={`/blog/${b.slug}`}
                style={{ display: 'flex', gap: 10, padding: 8, margin: 3, borderRadius: 6, background: '#FFFFFF', border: '1px solid #E5E7EB', textDecoration: 'none', color: '#111827' }}
              >
                {b.cover_image ? (
                  <span style={{ position: 'relative', width: 64, height: 48, flexShrink: 0, borderRadius: 4, overflow: 'hidden', background: '#F3F4F6' }}>
                    <Image src={b.cover_image} alt="" fill sizes="64px" style={{ objectFit: 'cover' }} />
                  </span>
                ) : null}
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                    {b.title}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                    {b.category ?? ''}{b.view_count ? ` · 조회 ${b.view_count.toLocaleString()}` : ''}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionHeader({ title, href, more }: { title: string; href: string; more: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 6px 6px' }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{title}</h2>
      <Link href={href} style={{ fontSize: 11.5, color: '#6B7280', textDecoration: 'none' }}>
        {more} →
      </Link>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div style={{ padding: 16, margin: 3, borderRadius: 6, background: '#F9FAFB', border: '1px solid #E5E7EB', fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
      {label}
    </div>
  );
}
