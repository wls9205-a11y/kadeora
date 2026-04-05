import Link from 'next/link';
import { CALC_REGISTRY, CATEGORIES, findCalc, getCategoryLabel } from '@/lib/calc/registry';
import CalcEngine from '@/components/calc/CalcEngine';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { notFound } from 'next/navigation';

export async function generateStaticParams() {
  return CALC_REGISTRY.map(c => ({ category: c.category, slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string; slug: string }> }): Promise<Metadata> {
  const { slug, category } = await params;
  const calc = findCalc(slug);
  if (!calc || calc.category !== category) return {};
  const url = `${SITE_URL}/calc/${category}/${slug}`;
  return {
    title: `${calc.title} — 카더라`,
    description: calc.description,
    keywords: calc.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: `${calc.title} — 카더라`,
      description: calc.description,
      url, siteName: '카더라', locale: 'ko_KR', type: 'website',
      images: [
        { url: `${SITE_URL}/api/og?title=${encodeURIComponent(calc.titleShort)}&design=2&subtitle=${encodeURIComponent(calc.legalBasis || calc.categoryLabel)}`, width: 1200, height: 630, alt: calc.titleShort },
        { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent(calc.titleShort)}&category=calc`, width: 630, height: 630, alt: calc.titleShort },
      ],
    },
    twitter: { card: 'summary_large_image', title: calc.title, description: calc.description },
    other: {
      'naver:author': '카더라', 'naver:site_name': '카더라',
      'naver:written_time': '2026-01-15T00:00:00Z',
      'naver:updated_time': calc.lastUpdated + 'T00:00:00Z',
      'og:updated_time': calc.lastUpdated + 'T00:00:00Z',
      'article:section': calc.categoryLabel,
      'article:tag': calc.keywords.join(','),
      'article:published_time': '2026-01-15T00:00:00Z',
      'article:modified_time': calc.lastUpdated + 'T00:00:00Z',
    },
  };
}

export default async function CalcPage({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { slug, category } = await params;
  const calc = findCalc(slug);
  if (!calc || calc.category !== category) notFound();
  const catMeta = CATEGORIES.find(c => c.id === category);
  const relatedCalcs = calc.relatedCalcs.map(s => CALC_REGISTRY.find(c => c.slug === s)).filter(Boolean);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'WebApplication',
        name: `카더라 ${calc.titleShort}`, url: `${SITE_URL}/calc/${category}/${slug}`,
        applicationCategory: 'FinanceApplication', operatingSystem: 'Web',
        description: calc.description, datePublished: '2026-01-15', dateModified: calc.lastUpdated,
        provider: { '@type': 'Organization', name: '카더라', url: SITE_URL },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
      })}} />
      {calc.faqs.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org', '@type': 'FAQPage',
          mainEntity: calc.faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        })}} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: '계산기', item: `${SITE_URL}/calc` },
          { '@type': 'ListItem', position: 3, name: catMeta?.label || category, item: `${SITE_URL}/calc/${category}` },
          { '@type': 'ListItem', position: 4, name: calc.titleShort },
        ],
      })}} />

      {/* 헤더 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>
          <Link href="/calc" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>계산기</Link>
          <span>›</span>
          <Link href={`/calc/${category}`} style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>{catMeta?.label}</Link>
        </div>
        <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, margin: 0, letterSpacing: '-0.5px' }}>{calc.title}</h1>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
          {calc.legalBasis ? `${calc.legalBasis} 기준` : calc.categoryLabel} · v{calc.version}
        </p>
      </div>

      {/* 계산기 엔진 */}
      {calc.inputs.length > 0 && <CalcEngine calc={calc} />}

      {/* SEO 콘텐츠: 본문 (seoContent) */}
      {calc.seoContent && (
        <div className="blog-content" style={{ marginTop: 28 }} dangerouslySetInnerHTML={{ __html: calc.seoContent }} />
      )}

      {/* SEO 콘텐츠: FAQ */}
      {calc.faqs.length > 0 && (
        <div className="blog-content" style={{ marginTop: 28 }}>
          <h2>자주 묻는 질문</h2>
          {calc.faqs.map((f, i) => (
            <div key={i}>
              <h3>Q. {f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </div>
      )}

      {/* 관련 계산기 */}
      {relatedCalcs.length > 0 && (
        <div style={{ marginTop: 24, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>관련 계산기</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {relatedCalcs.map(rc => rc && (
              <Link key={rc.slug} href={`/calc/${rc.category}/${rc.slug}`} style={{
                padding: '6px 12px', borderRadius: 8, textDecoration: 'none', fontSize: 12, fontWeight: 600,
                background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)',
              }}>
                {rc.titleShort}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 면책 + 출처 */}
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.6, marginTop: 16, paddingBottom: 40 }}>
        본 계산기는 참고용이며 법적 효력이 없습니다. 실제 세금 신고·납부 시 전문가 상담을 권장합니다.
        {calc.legalBasis && <><br />법적 근거: {calc.legalBasis}</>}
        <br />버전 {calc.version} · 최종 업데이트 {calc.lastUpdated}
      </div>
    </div>
  );
}
