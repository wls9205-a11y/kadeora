import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getCalcResult, getPopularResults } from '@/lib/calc/result-share';
import { findCalc, CATEGORIES } from '@/lib/calc/registry';
import { SITE_URL } from '@/lib/constants';
import { jsonLdSafe } from '@/lib/jsonld';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const revalidate = 1800;

interface PageProps {
  params: Promise<{ category: string; slug: string; shortId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category, slug, shortId } = await params;
  const rec = await getCalcResult(shortId);
  if (!rec) return { robots: { index: false, follow: false } };

  const calc = findCalc(slug);
  if (!calc || calc.category !== category) return {};

  const mainResult = rec.result?.main?.value || '';
  const url = `${SITE_URL}/calc/${category}/${slug}/r/${shortId}`;
  const ogImg = `${SITE_URL}/api/og-calc?slug=${encodeURIComponent(slug)}&result=${encodeURIComponent(String(mainResult))}&label=${encodeURIComponent(rec.result?.main?.label || calc.titleShort)}`;

  return {
    title: `${calc.title} 결과: ${mainResult} | 카더라`,
    description: `${calc.titleShort} 계산 결과: ${mainResult}. ${calc.description.slice(0, 100)} 같은 조건의 다른 사례도 비교하세요.`,
    keywords: [...calc.keywords, '카더라', `${calc.titleShort} 결과`, `${calc.titleShort} 사례`],
    alternates: { canonical: url },
    openGraph: {
      title: `${calc.emoji} ${calc.titleShort} — ${mainResult}`,
      description: `${calc.titleShort} 결과 공유`,
      url, siteName: '카더라', locale: 'ko_KR', type: 'article',
      images: [{ url: ogImg, width: 1200, height: 630, alt: `${calc.titleShort} 결과 ${mainResult}` }],
    },
    twitter: { card: 'summary_large_image', images: [ogImg] },
    other: {
      'naver:site_name': '카더라',
      'naver:description': `${calc.titleShort} 결과: ${mainResult}`,
      'naver:author': '카더라',
      'naver:written_time': rec.created_at,
      'article:section': calc.categoryLabel,
      'article:tag': [...calc.keywords].join(','),
    },
  };
}

export default async function CalcResultPage({ params }: PageProps) {
  const { category, slug, shortId } = await params;
  const rec = await getCalcResult(shortId);
  if (!rec) notFound();

  const calc = findCalc(slug);
  if (!calc || calc.category !== category) notFound();

  const catMeta = CATEGORIES.find(c => c.id === category);
  const popular = await getPopularResults({ calcSlug: slug, excludeShortId: shortId, limit: 5 });

  // 관련 블로그 (calc keyword 매칭)
  const sb = getSupabaseAdmin();
  const blogQuery = (calc.keywords || []).slice(0, 5).map(k => `title.ilike.%${k}%`).join(',');
  const { data: relatedBlogs } = blogQuery
    ? await sb.from('blog_posts')
        .select('id, slug, title, excerpt, published_at')
        .or(blogQuery).eq('is_published', true)
        .order('view_count', { ascending: false }).limit(3)
    : { data: [] };

  const url = `${SITE_URL}/calc/${category}/${slug}/r/${shortId}`;
  const mainResult = rec.result?.main?.value || '';

  // JSON-LD: WebPage + BreadcrumbList + 결과
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage', '@id': url,
        name: `${calc.title} 결과: ${mainResult}`,
        description: `${calc.titleShort} 계산 결과 공유 페이지`,
        datePublished: rec.created_at,
        isPartOf: { '@type': 'WebSite', name: '카더라', url: SITE_URL },
        breadcrumb: { '@id': `${url}#breadcrumb` },
      },
      {
        '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: '계산기', item: `${SITE_URL}/calc` },
          { '@type': 'ListItem', position: 3, name: catMeta?.label || category, item: `${SITE_URL}/calc/${category}` },
          { '@type': 'ListItem', position: 4, name: calc.titleShort, item: `${SITE_URL}/calc/${category}/${slug}` },
          { '@type': 'ListItem', position: 5, name: `결과: ${mainResult}` },
        ],
      },
    ],
  };

  // ──── 결과 표시 (수치 강조) ────
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px var(--sp-lg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSafe(jsonLd) }} />

      <nav style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
        <Link href="/calc">계산기</Link> › <Link href={`/calc/${category}`}>{catMeta?.label}</Link> › <Link href={`/calc/${category}/${slug}`}>{calc.titleShort}</Link>
      </nav>

      <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
        {calc.emoji} {calc.title} 결과
      </h1>

      <div style={{ marginTop: 20, padding: 24, background: 'linear-gradient(135deg, rgba(59,123,246,0.15), rgba(124,58,237,0.15))',
        borderRadius: 12, border: '1px solid rgba(59,123,246,0.3)', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
          {rec.result?.main?.label || '결과'}
        </div>
        <div style={{ fontSize: 40, fontWeight: 900, color: 'var(--brand)', letterSpacing: '-1px' }}>
          {mainResult}
        </div>
      </div>

      {/* 상세 내역 */}
      {Array.isArray(rec.result?.details) && rec.result.details.length > 0 && (
        <div style={{ marginTop: 20, background: 'var(--bg-surface)', borderRadius: 8, padding: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>📋 상세 내역</h2>
          {rec.result.details.map((d: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{d.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{d.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* 입력값 (자세히) */}
      <details style={{ marginTop: 16, background: 'var(--bg-hover)', borderRadius: 8, padding: 12 }}>
        <summary style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          🔍 입력 조건 보기
        </summary>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
          {Object.entries(rec.inputs || {}).map(([k, v]) => (
            <div key={k} style={{ padding: '3px 0' }}>{k}: <strong style={{ color: 'var(--text-primary)' }}>{String(v)}</strong></div>
          ))}
        </div>
      </details>

      {/* 나도 계산하기 CTA */}
      <Link href={`/calc/${category}/${slug}`} style={{
        display: 'block', marginTop: 24, padding: 14, textAlign: 'center',
        background: 'var(--brand)', color: 'white', borderRadius: 10,
        fontSize: 15, fontWeight: 700, textDecoration: 'none',
      }}>
        나도 계산해보기 →
      </Link>

      {/* 인기 결과 */}
      {popular.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px' }}>
            🔥 같은 계산기 인기 결과
          </h2>
          {popular.map((p: any) => (
            <Link key={p.short_id} href={`/calc/${category}/${slug}/r/${p.short_id}`}
              style={{ display: 'flex', justifyContent: 'space-between', padding: 10, borderRadius: 6,
                background: 'var(--bg-surface)', textDecoration: 'none', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{p.result?.main?.value}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>👁 {p.view_count}</span>
            </Link>
          ))}
        </section>
      )}

      {/* 관련 블로그 */}
      {Array.isArray(relatedBlogs) && relatedBlogs.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px' }}>
            📖 더 자세한 가이드
          </h2>
          {relatedBlogs.map((b: any) => (
            <Link key={b.id} href={`/blog/${b.slug}`} style={{
              display: 'block', padding: 12, borderRadius: 8, background: 'var(--bg-surface)',
              marginBottom: 8, textDecoration: 'none',
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{b.title}</div>
              {b.excerpt && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{b.excerpt.slice(0, 80)}…</div>}
            </Link>
          ))}
        </section>
      )}

      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 32 }}>
        조회 {rec.view_count + 1}회 · {new Date(rec.created_at).toLocaleString('ko-KR')} 계산
      </p>
    </div>
  );
}
