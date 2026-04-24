import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { CALC_REGISTRY } from '@/lib/calc/registry';
import { SITE_URL } from '@/lib/constants';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { jsonLdSafe } from '@/lib/jsonld';
import { sanitizeHtml } from '@/lib/sanitize-html';

export const revalidate = 86400; // 1일
export const dynamicParams = true; // s168: 빌드타임 DB 호출 제거, 요청 시 ISR 생성

interface PageProps {
  params: Promise<{ keyword: string }>;
}

// s168: 빌드 단계에서 DB 호출하지 않도록 빈 배열 반환. ISR on-demand + revalidate=86400 로 최적화.
// 원래 로직: calc_topic_clusters WHERE is_published=true LIMIT 200
export async function generateStaticParams() {
  return [];
}

async function getTopicData(slug: string): Promise<{ topic: any; blog_posts: any[] } | null> {
  // safe_get_calc_topic RPC: SECURITY DEFINER + EXCEPTION 핸들러 내장 (절대 throw 안함)
  // 반환: { found: boolean, topic: object, blog_posts: array }
  const sb = getSupabaseAdmin();
  try {
    const { data, error } = await (sb as any).rpc('safe_get_calc_topic', { slug });
    if (error || !data || !data.found) return null;
    return {
      topic: data.topic || null,
      blog_posts: Array.isArray(data.blog_posts) ? data.blog_posts : [],
    };
  } catch (e) {
    console.error('[calc/topic/page] safe_get_calc_topic threw:', e);
    return null;
  }
}

// 호환성 wrapper (generateMetadata에서 topic만 필요할 때)
async function getTopic(slug: string) {
  const result = await getTopicData(slug);
  return result?.topic ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { keyword } = await params;
  const topic = await getTopic(keyword);
  if (!topic) return { robots: { index: false, follow: false } };

  const url = `${SITE_URL}/calc/topic/${keyword}`;
  const calcCount = Array.isArray(topic.calc_slugs) ? topic.calc_slugs.length : 0;
  const blogCount = Array.isArray(topic.blog_post_ids) ? topic.blog_post_ids.length : 0;
  const ogImg = `${SITE_URL}/api/og?title=${encodeURIComponent(topic.topic_label)}&design=2&category=blog&subtitle=${encodeURIComponent(`${calcCount}종 무료 계산기`)}`;

  return {
    title: `${topic.topic_label} — 2026 무료 온라인 계산기 | 카더라`,
    description: topic.meta_description ||
      `${topic.topic_label} 무료 사용. 2026년 최신 세법·법령 반영. ${(topic.related_keywords || []).slice(0, 3).join('·')} 등 종합 계산.`,
    keywords: [topic.topic_label, ...(topic.related_keywords || []), '카더라', '무료 계산기'],
    alternates: { canonical: url },
    openGraph: {
      title: `${topic.topic_label} 종합 가이드 — 카더라`,
      description: `${topic.topic_label} ${calcCount}종 + 관련 가이드 ${blogCount}편`,
      url, siteName: '카더라', locale: 'ko_KR', type: 'website',
      images: [{ url: ogImg, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image' },
    other: {
      'naver:site_name': '카더라',
      'naver:description': topic.meta_description || topic.topic_label,
      'naver:author': '카더라',
      'naver:written_time': topic.created_at,
      'naver:updated_time': topic.updated_at,
      'article:tag': (topic.related_keywords || []).join(','),
    },
  };
}

export default async function TopicHubPage({ params }: PageProps) {
  const { keyword } = await params;
  const result = await getTopicData(keyword);
  if (!result || !result.topic) notFound();
  const topic = result.topic;

  // view_count 증가 (fire-and-forget)
  const sb = getSupabaseAdmin();
  // 조회수 +1 (실패 무시 — Rule: try/await, never .catch)
  try { await (sb as any).rpc('increment_calc_topic_view', { p_topic_slug: keyword }); } catch {}

  // 매핑된 계산기들 (calc_slugs null 가드)
  const calcSlugs: string[] = Array.isArray(topic.calc_slugs) ? topic.calc_slugs : [];
  const calcs = calcSlugs.map((s: string) =>
    CALC_REGISTRY.find(c => c.slug === s)
  ).filter(Boolean);

  // 관련 블로그 — RPC가 미리 가져옴 (중복 쿼리 제거)
  const blogs = result.blog_posts;

  const url = `${SITE_URL}/calc/topic/${keyword}`;

  // JSON-LD: CollectionPage + ItemList + FAQPage + BreadcrumbList
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage', '@id': url,
        name: topic.topic_label,
        description: topic.meta_description,
        keywords: (topic.related_keywords || []).join(','),
        isPartOf: { '@type': 'WebSite', name: '카더라', url: SITE_URL },
      },
      {
        '@type': 'ItemList',
        itemListElement: calcs.map((c: any, i: number) => ({
          '@type': 'ListItem', position: i + 1, name: c.title,
          url: `${SITE_URL}/calc/${c.category}/${c.slug}`,
        })),
      },
      ...(Array.isArray(topic.faqs) && topic.faqs.length > 0 ? [{
        '@type': 'FAQPage',
        mainEntity: topic.faqs.map((f: any) => ({
          '@type': 'Question', name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }] : []),
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: '계산기', item: `${SITE_URL}/calc` },
          { '@type': 'ListItem', position: 3, name: topic.topic_label },
        ],
      },
    ],
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px var(--sp-lg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSafe(jsonLd) }} />

      <nav style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
        <Link href="/calc" style={{ color: 'var(--text-tertiary)' }}>계산기</Link>
        <span style={{ margin: '0 6px' }}>›</span>
        <span style={{ color: 'var(--text-secondary)' }}>토픽: {topic.topic_label}</span>
      </nav>

      <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>
        {topic.topic_label}
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '8px 0 0' }}>
        2026년 최신 기준 · 무료 · 회원가입 불필요 · {calcs.length}종 통합
      </p>

      {/* 도입부 (AI 생성) */}
      {topic.intro_html && (
        <div className="topic-intro blog-content" style={{ marginTop: 20 }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(topic.intro_html) }} />
      )}

      {/* 계산기 그리드 */}
      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px' }}>
          🧮 무료 계산기 ({calcs.length}종)
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {calcs.map((c: any) => (
            <Link key={c.slug} href={`/calc/${c.category}/${c.slug}`} style={{
              padding: 14, borderRadius: 10, background: 'var(--bg-surface)',
              border: '1px solid var(--border)', textDecoration: 'none',
              transition: 'transform 0.15s, border-color 0.15s',
            }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{c.emoji}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{c.titleShort}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
                {c.description.slice(0, 60)}…
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 관련 블로그 */}
      {Array.isArray(blogs) && blogs.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px' }}>
            📖 {topic.topic_label} 가이드 ({blogs.length}편)
          </h2>
          {blogs.map((b: any) => (
            <Link key={b.id} href={`/blog/${b.slug}`} style={{
              display: 'flex', gap: 12, padding: 12, borderRadius: 8,
              background: 'var(--bg-surface)', marginBottom: 8, textDecoration: 'none',
            }}>
              {b.cover_image && (
                <div style={{ width: 90, height: 60, flexShrink: 0, borderRadius: 6, overflow: 'hidden', background: 'var(--bg-hover)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.cover_image} alt={b.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.title}
                </div>
                {b.excerpt && (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, overflow: 'hidden',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                    {b.excerpt}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </section>
      )}

      {/* FAQ */}
      {Array.isArray(topic.faqs) && topic.faqs.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px' }}>
            ❓ 자주 묻는 질문
          </h2>
          {topic.faqs.map((f: any, i: number) => (
            <details key={i} style={{ marginBottom: 8, background: 'var(--bg-surface)', borderRadius: 8, padding: 12 }}>
              <summary style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}>
                Q. {f.q}
              </summary>
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {f.a}
              </div>
            </details>
          ))}
        </section>
      )}

      {/* 관련 키워드 (SEO) */}
      {Array.isArray(topic.related_keywords) && topic.related_keywords.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 8px' }}>관련 키워드</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {topic.related_keywords.map((k: string) => (
              <span key={k} style={{
                padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                background: 'var(--bg-hover)', color: 'var(--text-secondary)',
              }}>{k}</span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
