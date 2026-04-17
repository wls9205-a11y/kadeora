import { SITE_URL } from '@/lib/constants';
import { createSupabaseServer } from '@/lib/supabase-server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const revalidate = 86400; // 24시간

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const sb = await createSupabaseServer();
  const { data } = await (sb as any).from('stock_glossary')
    .select('term, definition_ko')
    .eq('slug', slug)
    .maybeSingle();

  if (!data) return { title: '용어를 찾을 수 없습니다' };

  const title = `${data.term}이란? — 주식 용어사전 | 카더라`;
  const desc = data.definition_ko.slice(0, 155);

  return {
    title,
    description: desc,
    alternates: { canonical: `${SITE_URL}/glossary/${slug}` },
    openGraph: {
      title: `${data.term} — 주식 용어 해설`,
      description: desc,
      url: `${SITE_URL}/glossary/${slug}`,
      siteName: '카더라',
      locale: 'ko_KR',
      type: 'article',
      images: [{
        url: `${SITE_URL}/api/og?title=${encodeURIComponent(data.term + '이란?')}&subtitle=${encodeURIComponent('주식 용어사전')}&category=stock&design=2`,
        width: 1200, height: 630,
      }],
    },
    other: {
      'naver:written_time': new Date().toISOString(),
      'naver:author': '카더라',
    },
  };
}

export default async function GlossaryTermPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = await createSupabaseServer();
  const { data: term } = await (sb as any).from('stock_glossary')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (!term) notFound();

  // 관련 용어 조회
  const relatedTerms = term.related_terms || [];
  let relatedData: any[] = [];
  if (relatedTerms.length) {
    const { data } = await (sb as any).from('stock_glossary')
      .select('term, slug, definition_ko')
      .in('term', relatedTerms)
      .limit(10);
    relatedData = data || [];
  }

  // 같은 카테고리 다른 용어
  const { data: sameCat } = await (sb as any).from('stock_glossary')
    .select('term, slug')
    .eq('category', term.category)
    .neq('slug', slug)
    .limit(8);

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '16px' }}>
      {/* JSON-LD DefinedTerm */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'DefinedTerm',
        name: term.term,
        description: term.definition_ko,
        url: `${SITE_URL}/glossary/${slug}`,
        inDefinedTermSet: {
          '@type': 'DefinedTermSet',
          name: '카더라 주식 용어사전',
          url: `${SITE_URL}/glossary`,
        },
      }) }} />

      {/* FAQPage JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [{
          '@type': 'Question',
          name: `${term.term}이란 무엇인가요?`,
          acceptedAnswer: {
            '@type': 'Answer',
            text: term.definition_ko + (term.definition_detail ? ' ' + term.definition_detail : ''),
          },
        }],
      }) }} />

      {/* BreadcrumbList */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '홈', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: '용어사전', item: `${SITE_URL}/glossary` },
          { '@type': 'ListItem', position: 3, name: term.term, item: `${SITE_URL}/glossary/${slug}` },
        ],
      }) }} />

      <nav style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
        <Link href="/glossary" style={{ color: 'var(--primary)', textDecoration: 'none' }}>용어사전</Link>
        <span style={{ margin: '0 6px' }}>›</span>
        <span>{term.term}</span>
      </nav>

      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '12px' }}>
        {term.term}
      </h1>

      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '24px',
        border: '1px solid var(--border)',
        fontSize: '16px',
        lineHeight: 1.8,
      }}>
        {term.definition_ko}
      </div>

      {term.definition_detail && (
        <div style={{ marginBottom: '24px', lineHeight: 1.8, fontSize: '15px', color: 'var(--text-secondary)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>상세 설명</h2>
          {term.definition_detail}
        </div>
      )}

      {term.example && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>예시</h2>
          <div style={{
            background: 'var(--bg-tertiary, #f0f0f0)',
            padding: '14px 18px',
            borderRadius: '8px',
            fontSize: '14px',
            lineHeight: 1.7,
            fontFamily: 'var(--monospace-font, monospace)',
          }}>
            {term.example}
          </div>
        </div>
      )}

      {/* 관련 용어 */}
      {relatedData.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '10px' }}>관련 용어</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {relatedData.map((r: any) => (
              <Link
                key={r.slug}
                href={`/glossary/${r.slug}`}
                style={{
                  padding: '6px 14px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '20px',
                  fontSize: '13px',
                  textDecoration: 'none',
                  color: 'var(--primary)',
                  border: '1px solid var(--border)',
                }}
              >
                {r.term}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 같은 카테고리 */}
      {(sameCat || []).length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '10px' }}>같은 분류의 용어</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {(sameCat || []).map((s: any) => (
              <Link
                key={s.slug}
                href={`/glossary/${s.slug}`}
                style={{
                  padding: '6px 14px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '20px',
                  fontSize: '13px',
                  textDecoration: 'none',
                  color: 'inherit',
                  border: '1px solid var(--border)',
                }}
              >
                {s.term}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 하단 CTA */}
      <div style={{
        textAlign: 'center',
        padding: '24px 16px',
        marginTop: '16px',
        borderTop: '1px solid var(--border)',
      }}>
        <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
          더 많은 주식 용어를 알아보세요
        </p>
        <Link
          href="/glossary"
          style={{
            padding: '10px 28px',
            background: 'var(--primary)',
            color: '#fff',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          용어사전 전체 보기
        </Link>
      </div>
    </div>
  );
}
