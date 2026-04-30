import { SITE_URL } from '@/lib/constants';
import { createSupabaseServer } from '@/lib/supabase-server';
import type { Metadata } from 'next';
import Link from 'next/link';

export const revalidate = 3600;

export const metadata: Metadata = {
  // s212 P0-B: template 가 '| 카더라' 자동 추가
  title: '주식 용어사전 — 투자 초보를 위한 A to Z',
  description: 'PER, PBR, EPS, RSI, MACD, 공매도, 배당수익률 등 주식 투자에 필요한 핵심 용어를 쉽게 설명합니다.',
  alternates: { canonical: SITE_URL + '/glossary' },
  openGraph: {
    title: '주식 용어사전',
    description: '투자 초보도 쉽게 이해하는 주식 용어 해설',
    url: SITE_URL + '/glossary',
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  valuation: '밸류에이션',
  fundamental: '재무 지표',
  basic: '기초',
  dividend: '배당',
  trading: '매매·수급',
  flow: '수급',
  index: '지수',
  macro: '거시경제',
  tax: '세금',
  account: '계좌',
  product: '금융상품',
  event: '이벤트',
  technical: '기술적 분석',
  corporate: '기업 활동',
  analysis: '분석',
};

export default async function GlossaryPage() {
  const sb = await createSupabaseServer();
  const { data: terms } = await (sb as any).from('stock_glossary')
    .select('term, slug, definition_ko, category')
    .order('term', { ascending: true });

  const allTerms = terms || [];

  // 카테고리별 그룹핑
  const grouped: Record<string, any[]> = {};
  for (const t of allTerms) {
    const cat = t.category || 'general';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(t);
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'DefinedTermSet',
        name: '카더라 주식 용어사전',
        description: '주식 투자에 필요한 핵심 용어 해설',
        url: SITE_URL + '/glossary',
        hasDefinedTerm: allTerms.map((t: any) => ({
          '@type': 'DefinedTerm',
          name: t.term,
          description: t.definition_ko,
          url: `${SITE_URL}/glossary/${t.slug}`,
        })),
      }) }} />

      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
        📖 주식 용어사전
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
        투자 초보도 쉽게 이해하는 주식·경제 용어 {allTerms.length}개
      </p>

      {Object.entries(grouped).map(([cat, items]) => (
        <section key={cat} style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px', color: 'var(--primary)' }}>
            {CATEGORY_LABELS[cat] || cat}
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '8px',
          }}>
            {items.map((t: any) => (
              <Link
                key={t.slug}
                href={`/glossary/${t.slug}`}
                style={{
                  display: 'block',
                  padding: '12px 14px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  color: 'inherit',
                  border: '1px solid var(--border)',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '14px' }}>{t.term}</span>
                <p style={{
                  fontSize: '12px',
                  color: 'var(--text-tertiary)',
                  margin: '4px 0 0',
                  lineHeight: 1.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {t.definition_ko}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
