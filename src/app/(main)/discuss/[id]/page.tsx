import { createSupabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import { timeAgo } from '@/lib/format';
import { SITE_URL as SITE } from '@/lib/constants';
import DiscussDetailClient from './DiscussDetailClient';
import Link from 'next/link';
import ShareButtons from '@/components/ShareButtons';

export const revalidate = 60; // ISR 1분

const CAT_LABEL: Record<string, string> = { stock: '📊 주식', apt: '🏢 부동산', economy: '💹 경제', free: '✏️ 자유' };
const CAT_SEO: Record<string, string> = { stock: '주식', apt: '부동산', economy: '경제', free: '자유' };

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const sb = await createSupabaseServer();
  const { data: topic } = await sb.from('discussion_topics')
    .select('title, description, category, option_a, option_b, vote_a, vote_b, comment_count, view_count, created_at')
    .eq('id', parseInt(id, 10)).maybeSingle();

  if (!topic) return { title: '토론을 찾을 수 없습니다' };

  const total = (topic.vote_a || 0) + (topic.vote_b || 0);
  const catLabel = CAT_SEO[topic.category] || '토론';
  const desc = topic.description
    || `${topic.option_a} vs ${topic.option_b} — ${total}명 참여, ${topic.comment_count || 0}개 의견`;

  return {
    title: `${topic.title} — ${catLabel} 토론`,
    description: desc,
    alternates: { canonical: `${SITE}/discuss/${id}` },
    openGraph: {
      title: topic.title,
      description: desc,
      type: 'article',
      siteName: '카더라',
      locale: 'ko_KR',
      url: `${SITE}/discuss/${id}`,
      images: [
        { url: `${SITE}/api/og?title=${encodeURIComponent(topic.title)}&design=2&category=${topic.category}`, width: 1200, height: 630 },
        { url: `${SITE}/api/og-square?title=${encodeURIComponent(topic.title)}&category=${topic.category}`, width: 630, height: 630 },
      ],
    },
    twitter: { card: 'summary_large_image' as const, title: topic.title, description: desc, images: [`${SITE}/api/og?title=${encodeURIComponent(topic.title)}&design=2&category=${topic.category}`] },
    other: {
      'naver:written_time': topic.created_at || new Date().toISOString(),
      'naver:updated_time': topic.created_at || new Date().toISOString(),
      'dg:plink': `${SITE}/discuss/${id}`,
      'article:section': catLabel,
      'article:tag': catLabel,
      'naver:author': '카더라',
      'og:updated_time': topic.created_at || new Date().toISOString(),
    },
    robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const },
  };
}

export default async function DiscussDetailPage({ params }: Props) {
  const { id } = await params;
  const topicId = parseInt(id, 10);
  if (isNaN(topicId)) notFound();

  const sb = await createSupabaseServer();

  const [topicR, commentsR] = await Promise.all([
    sb.from('discussion_topics')
      .select('id, title, description, category, topic_type, option_a, option_b, vote_a, vote_b, comment_count, view_count, is_hot, created_at')
      .eq('id', topicId).maybeSingle(),
    sb.from('discussion_comments')
      .select('id, content, created_at, likes, profiles!discussion_comments_author_id_fkey(nickname, grade)')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: true })
      .limit(100),
  ]);

  if (!topicR.data) notFound();

  const topic = topicR.data;
  const comments = (commentsR.data || []) as Record<string, any>[];
  const total = (topic.vote_a || 0) + (topic.vote_b || 0);

  // 관련 블로그 (카테고리 기반)
  let relatedBlogs: any[] = [];
  try {
    const catMap: Record<string, string> = { stock: 'stock', apt: 'apt', economy: 'finance' };
    const blogCat = catMap[topic.category];
    if (blogCat) {
      const { data } = await sb.from('blog_posts').select('slug, title, category, view_count')
        .eq('is_published', true).eq('category', blogCat)
        .order('view_count', { ascending: false }).limit(3);
      relatedBlogs = data || [];
    }
  } catch {}
  const catLabel = CAT_SEO[topic.category] || '토론';

  // JSON-LD: DiscussionForumPosting
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    headline: topic.title,
    text: topic.description || `${topic.option_a} vs ${topic.option_b}`,
    url: `${SITE}/discuss/${id}`,
    datePublished: topic.created_at,
    dateModified: topic.created_at,
    interactionStatistic: [
      { '@type': 'InteractionCounter', interactionType: 'https://schema.org/VoteAction', userInteractionCount: total },
      { '@type': 'InteractionCounter', interactionType: 'https://schema.org/CommentAction', userInteractionCount: topic.comment_count || 0 },
      { '@type': 'InteractionCounter', interactionType: 'https://schema.org/ViewAction', userInteractionCount: topic.view_count || 0 },
    ],
    author: { '@type': 'Organization', name: '카더라', url: SITE },
    publisher: { '@type': 'Organization', name: '카더라', url: SITE },
    isPartOf: { '@type': 'DiscussionForum', name: `카더라 ${catLabel} 토론`, url: `${SITE}/discuss` },
    speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '[itemprop="description"]'] },
    ...(comments.length > 0 ? {
      comment: comments.slice(0, 5).map((c: any) => ({
        '@type': 'Comment',
        text: c.content,
        dateCreated: c.created_at,
        author: { '@type': 'Person', name: c.profiles?.nickname || '사용자' },
      })),
    } : {}),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '카더라', item: SITE },
      { '@type': 'ListItem', position: 2, name: '토론', item: `${SITE}/discuss` },
      { '@type': 'ListItem', position: 3, name: topic.title, item: `${SITE}/discuss/${id}` },
    ],
  };

  return (
    <article itemScope itemType="https://schema.org/DiscussionForumPosting" style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {/* FAQ JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: `${topic.title}에서 어떤 의견이 많나요?`, acceptedAnswer: { '@type': 'Answer', text: `${topic.option_a} ${total > 0 ? Math.round(((topic.vote_a || 0) / total) * 100) : 50}% vs ${topic.option_b} ${total > 0 ? Math.round(((topic.vote_b || 0) / total) * 100) : 50}% (${total}명 참여)` } },
          { '@type': 'Question', name: `카더라 토론방은 어떤 곳인가요?`, acceptedAnswer: { '@type': 'Answer', text: `카더라 토론방은 주식, 부동산, 경제 이슈를 실시간으로 투표하고 토론하는 공간입니다. 누구나 무료로 참여 가능합니다.` } },
        ],
      }) }} />

      {/* Back */}
      <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-sm)' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>
        <span>›</span>
        <Link href="/discuss" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>토론</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{CAT_LABEL[topic.category] || '토론'}</span>
      </nav>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/og?title=${encodeURIComponent(topic.title)}&design=2&category=${topic.category}&subtitle=${encodeURIComponent(topic.option_a + ' vs ' + topic.option_b)}`} alt={`${topic.title} — 카더라 토론`} width={1200} height={630} style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block', borderRadius: 'var(--radius-md)', marginBottom: 'var(--sp-md)', border: '1px solid var(--border)' }} loading="lazy" />

      {/* Topic Header — SSR rendered for crawlers */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 16 }}>
        <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
          <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, fontWeight: 700, background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
            {CAT_LABEL[topic.category] || topic.category}
          </span>
          {topic.is_hot && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700, background: 'var(--error)', color: '#fff' }}>HOT</span>}
        </div>

        <h1 itemProp="headline" style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px', lineHeight: 1.35 }}>
          {topic.title}
        </h1>
        {topic.description && (
          <p itemProp="text" style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.5 }}>
            {topic.description}
          </p>
        )}
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          <time itemProp="datePublished" dateTime={topic.created_at ?? undefined}>{timeAgo(topic.created_at)}</time>
          {' · '}{topic.view_count || 0}뷰
        </div>
        {/* 공유 */}
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', padding: '10px', background: 'rgba(59,123,246,0.03)', borderRadius: '0 0 10px 10px' }}>
          <ShareButtons title={`${topic.title} — 투표 참여하기`} postId={id} />
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>투표 {total}명 · 의견 {topic.comment_count || 0}개</span>
        </div>
      </div>

      {/* A vs B 시각적 비교 */}
      {topic.option_a && topic.option_b && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', gap: 0, marginBottom: 'var(--sp-md)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '14px 12px', alignItems: 'center' }}>
          {/* A */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: 'var(--accent-blue)' }}>
              {total > 0 ? Math.round(((topic.vote_a || 0) / total) * 100) : 50}%
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, marginTop: 'var(--sp-xs)' }}>{topic.option_a}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{topic.vote_a || 0}표</div>
          </div>
          {/* VS 도넛 */}
          <div style={{ padding: '0 8px' }}>
            <svg viewBox="0 0 60 60" style={{ width: 56, height: 56 }}>
              {(() => {
                const pctA = total > 0 ? ((topic.vote_a || 0) / total) : 0.5;
                const dashA = pctA * (2 * Math.PI * 22);
                const dashB = (1 - pctA) * (2 * Math.PI * 22);
                const gap = (2 * Math.PI * 22);
                return (<>
                  <circle cx="30" cy="30" r="22" fill="none" stroke="#60A5FA" strokeWidth="7" strokeDasharray={`${dashA} ${gap - dashA}`} transform="rotate(-90 30 30)" />
                  <circle cx="30" cy="30" r="22" fill="none" stroke="#F87171" strokeWidth="7" strokeDasharray={`${dashB} ${gap - dashB}`} strokeDashoffset={`-${dashA}`} transform="rotate(-90 30 30)" />
                  <text x="30" y="29" textAnchor="middle" style={{ fontSize: 10, fontWeight: 800, fill: 'var(--text-primary)' }}>VS</text>
                  <text x="30" y="40" textAnchor="middle" style={{ fontSize: 7, fill: 'var(--text-tertiary)' }}>{total}명</text>
                </>);
              })()}
            </svg>
          </div>
          {/* B */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: 'var(--accent-red)' }}>
              {total > 0 ? Math.round(((topic.vote_b || 0) / total) * 100) : 50}%
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, marginTop: 'var(--sp-xs)' }}>{topic.option_b}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{topic.vote_b || 0}표</div>
          </div>
        </div>
      )}

      {/* Client interactive part (투표 + 댓글) */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '12px 0 8px' }}>💬 실시간 투표 & 댓글</h2>
      <DiscussDetailClient initialTopic={topic as React.ComponentProps<typeof DiscussDetailClient>['initialTopic']} initialComments={comments as React.ComponentProps<typeof DiscussDetailClient>['initialComments']} />

      {/* 관련 블로그 (내부 링크 SEO) */}
      {relatedBlogs.length > 0 && (
        <div style={{ marginTop: 'var(--sp-xl)', marginBottom: 'var(--sp-lg)' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>📰 관련 분석 글</h3>
          {relatedBlogs.map((b: any) => (
            <Link key={b.slug} href={`/blog/${b.slug}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit', fontSize: 'var(--fs-sm)' }}>
              <span style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
              <span style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 8, fontSize: 'var(--fs-xs)' }}>👀 {(b.view_count || 0).toLocaleString()}</span>
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}
