import { createSupabaseServer } from '@/lib/supabase-server';
import { DEMO_POSTS, CATEGORY_MAP, GRADE_EMOJI, SITE_URL } from '@/lib/constants';

// Cache: 120s — 게시글 상세
export const revalidate = 120;
import type { PostWithProfile, CommentWithProfile } from '@/types/database';
import { LikeButton } from '@/components/LikeButton';
import { CommentSection } from '@/components/CommentSection';
import Link from 'next/link';
import Image from 'next/image';
import { notFound, permanentRedirect } from 'next/navigation';
import ShareButtons from '@/components/ShareButtons'
import { getAvatarColor } from '@/lib/avatar';
import { BookmarkButton } from '@/components/BookmarkButton';
import ReportButton from '@/components/ReportButton';
import PostActions from '@/components/PostActions';
import FontSizeControl from '@/components/FontSizeControl';
import { timeAgo } from '@/lib/format';
import Disclaimer from '@/components/Disclaimer';
import ReadingProgress from '@/components/ReadingProgress';


function parsePostId(param: string): { numId: number; isSlug: boolean } {
  const match = param.match(/-(\d+)$/);
  if (match) return { numId: parseInt(match[1]), isSlug: false };
  const num = parseInt(param);
  if (!isNaN(num)) return { numId: num, isSlug: false };
  return { numId: 0, isSlug: true };
}

async function findPostBySlugOrId(sb: any, param: string) {
  const { numId, isSlug } = parsePostId(param);
  if (isSlug) {
    const { data } = await sb.from('posts').select('id').eq('slug', param).eq('is_deleted', false).maybeSingle();
    return data?.id ?? 0;
  }
  return numId;
}


interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  
  try {
    const sb = await createSupabaseServer();
    const numId = await findPostBySlugOrId(sb, id);
    const { data: post } = await sb
      .from('posts')
      .select('title, content, created_at, slug, category, likes_count, comments_count, profiles!posts_author_id_fkey(nickname)')
      .eq('id', numId)
      .eq('is_deleted', false)
      .maybeSingle();
    if (!post) return {};
    const author = (post.profiles as { nickname?: string } | null)?.nickname ?? '익명';
    const description = post.content.slice(0, 160);
    const ogImageUrl = `${SITE_URL}/api/og?title=${encodeURIComponent(post.title)}&author=${encodeURIComponent(author)}&category=${encodeURIComponent(post.category || '')}&likes=${post.likes_count ?? 0}&comments=${post.comments_count ?? 0}`;
    return {
      title: post.title,
      description,
      alternates: {
        canonical: `${SITE_URL}/feed/${post.slug || numId}`,
      },
      openGraph: {
        title: post.title,
        description,
        type: 'article',
        publishedTime: post.created_at,
        authors: [author],
        url: `${SITE_URL}/feed/${post.slug || numId}`,
        images: [{ url: ogImageUrl, width: 1200, height: 630, alt: post.title }],
      },
      twitter: {
        card: 'summary_large_image',
        title: post.title,
        description,
        images: [ogImageUrl],
      },
      other: {
        'naver:written_time': post.created_at,
        'naver:updated_time': post.created_at,
        'dg:plink': `${SITE_URL}/feed/${post.slug || numId}`,
        'article:section': CATEGORY_MAP[post.category]?.label ?? '자유',
        'article:tag': `${CATEGORY_MAP[post.category]?.label ?? '커뮤니티'},카더라`,
        'article:published_time': post.created_at,
        'article:author': author,
      },
    };
  } catch {
    return {
      openGraph: {
        images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 628, alt: '카더라' }],
      },
    };
  }
}

export default async function FeedDetailPage({ params }: Props) {
  const { id } = await params;

  let post: PostWithProfile | null = null;
  let comments: CommentWithProfile[] = [];
  let related: any[] = [];
  let currentUserId: string | null = null;
  let numId = 0;

  try {
    const sb = await createSupabaseServer();
    try {
      const { data: { user: authUser } } = await sb.auth.getUser();
      currentUserId = authUser?.id ?? null;
    } catch { /* 비로그인/만료 세션 — 무시 */ }

    numId = await findPostBySlugOrId(sb, id);

    const { data: postData } = await sb
      .from('posts')
      .select('*, slug, profiles!posts_author_id_fkey(id,nickname,avatar_url,grade)')
      .eq('id', numId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (postData) {
      post = postData as PostWithProfile;
      sb.from('posts').update({ view_count: (post.view_count ?? 0) + 1 }).eq('id', numId).then(() => {});

      const [{ data: commentsData }, { data: relatedData }] = await Promise.all([
        sb.from('comments')
          .select('*, profiles!comments_author_id_fkey(id,nickname,avatar_url,grade)')
          .eq('post_id', numId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(100),
        sb.from('posts')
          .select('id,title,likes_count,comments_count,slug')
          .eq('category', postData.category)
          .eq('is_deleted', false)
          .neq('id', numId)
          .order('created_at', { ascending: false })
          .limit(3),
      ]);
      if (commentsData) comments = commentsData as CommentWithProfile[];
      if (relatedData) related = relatedData;

      // 관련 부동산 현장 (apt 카테고리)
      if (postData.category === 'apt') {
        try {
          const keywords = (postData.title || '').split(/\s+/).filter((w: string) => w.length >= 2).slice(0, 2);
          if (keywords.length > 0) {
            const orQuery = keywords.map((k: string) => `name.ilike.%${k}%`).join(',');
            const { data: sitesData } = await sb.from('apt_sites').select('slug, name, site_type, region, sigungu')
              .eq('is_active', true).or(orQuery).gte('content_score', 25)
              .order('interest_count', { ascending: false }).limit(3);
            if (sitesData?.length) related = [...related, ...sitesData.map((s: any) => ({ ...s, _type: 'site' }))];
          }
        } catch {}
      }

      // 관련 종목 (stock 카테고리)
      if (postData.category === 'stock') {
        try {
          const keywords = (postData.title || '').split(/\s+/).filter((w: string) => w.length >= 2).slice(0, 2);
          if (keywords.length > 0) {
            const orQuery = keywords.map((k: string) => `name.ilike.%${k}%`).join(',');
            const { data: stocksData } = await sb.from('stock_quotes').select('symbol, name, market, price, change_pct, currency')
              .eq('is_active', true).or(orQuery).gt('price', 0).limit(3);
            if (stocksData?.length) related = [...related, ...stocksData.map((s: any) => ({ ...s, _type: 'stock' }))];
          }
        } catch {}
      }
    }
  } catch {
    // fallback to demo
  }

  if (!post) {
    const demoPost = DEMO_POSTS.find(p => p.id === numId);
    if (!demoPost) return notFound();
    post = demoPost;
    comments = [
      {
        id: 1, post_id: numId, author_id: 'demo-a', content: '좋은 정보 감사합니다! 많이 배워갑니다.',
        is_deleted: false, created_at: new Date(Date.now() - 30 * 60000).toISOString(),
        profiles: { id: 'demo-a', nickname: '정보킹', avatar_url: null, grade: 1 },
      },
      {
        id: 2, post_id: numId, author_id: 'demo-b', content: '저도 비슷한 생각이에요. 특히 두 번째 포인트가 핵심이라 봅니다.',
        is_deleted: false, created_at: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
        profiles: { id: 'demo-b', nickname: '투자마니아', avatar_url: null, grade: 1 },
      },
    ] as any[];
  }

  if (!post) return notFound();

  if (post.slug && !isNaN(Number(id)) && post.slug !== id) {
    permanentRedirect(`/feed/${post.slug}`);
  }


  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    headline: post.title,
    description: post.content.slice(0, 160),
    datePublished: post.created_at,
    dateModified: post.updated_at ?? post.created_at,
    author: {
      '@type': 'Person',
      name: post.profiles?.nickname ?? '익명',
    },
    publisher: {
      '@type': 'Organization',
      name: '카더라',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.svg` },
    },
    url: `${SITE_URL}/feed/${post.id}`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/feed/${post.id}`,
    },
    interactionStatistic: [
      { '@type': 'InteractionCounter', interactionType: 'https://schema.org/LikeAction', userInteractionCount: post.likes_count ?? 0 },
      { '@type': 'InteractionCounter', interactionType: 'https://schema.org/CommentAction', userInteractionCount: post.comments_count ?? 0 },
    ],
    inLanguage: 'ko-KR',
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['h1', 'article p:first-of-type'],
    },
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <ReadingProgress />
      {/* JSON-LD SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: '피드', item: `${SITE_URL}/feed` },
          { '@type': 'ListItem', position: 3, name: post.title },
        ],
      }) }} />

      {/* Back link */}
      <div style={{ marginBottom: 20 }}>
        <Link href="/feed" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 피드</Link>
      </div>

      {/* Post article */}
      <article style={{ marginBottom: 0 }}>
        {/* Title */}
        <h1 style={{ margin: '0 0 16px', fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.35, wordBreak: 'keep-all' }}>
          {post.title}
        </h1>

        {/* Author row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: getAvatarColor(post.profiles?.nickname ?? '익명'),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-inverse)',
          }}>
            {(post.profiles?.nickname ?? '익')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {post.profiles?.nickname ?? '익명'}
            </span>
            <span style={{ marginLeft: 4 }}>{GRADE_EMOJI[post.profiles?.grade as number] || '🌱'}</span>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginTop: 2 }}>
              {timeAgo(post.created_at)} · 조회 {(post.view_count ?? 0).toLocaleString()}
            </div>
          </div>
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
            <PostActions postId={post.id} isOwner={currentUserId === post.author_id} />
            <ReportButton postId={post.id} style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer' }} />
          </div>
        </div>

        {/* 글자 크기 조절 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <FontSizeControl />
        </div>

        {/* Content body */}
        {currentUserId ? (
          <div className="feed-detail-content" style={{ fontSize: 'var(--content-font-size, 16px)' as any, color: 'var(--text-primary)', lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '0 0 24px' }}>
            {post.content}
          </div>
        ) : (
          <div style={{ position: 'relative', margin: '0 0 24px' }}>
            <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)', lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 'clamp(200px, 35vh, 400px)', overflow: 'hidden' }}>
              {post.content}
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, background: 'linear-gradient(transparent, var(--bg-base))' }} />
          </div>
        )}

        {/* Image gallery — 로그인 여부 상관없이 표시 */}
        {post.images && post.images.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: post.images.length === 1 ? '1fr' : post.images.length === 2 ? '1fr 1fr' : 'repeat(3, 1fr)',
            gap: 8,
            marginBottom: 24,
          }}>
            {post.images.map((url: string, i: number) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', position: 'relative', borderRadius: 8, overflow: 'hidden',
                  aspectRatio: post.images!.length === 1 ? '16/9' : '1',
                  cursor: 'pointer',
                }}>
                <Image
                  src={url}
                  alt={`이미지 ${i + 1}`}
                  fill
                  sizes={post.images!.length === 1 ? '(max-width: 780px) 100vw, 780px' : '(max-width: 780px) 33vw, 260px'}
                  style={{ objectFit: 'cover', borderRadius: 8 }}
                  priority={i === 0}
                />
              </a>
            ))}
          </div>
        )}

        {/* 비로그인 가입 유도 — 이미지 아래에 배치 */}
        {!currentUserId && (
          <div style={{ textAlign: 'center', padding: '24px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 24 }}>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>전체 글을 보려면 로그인하세요</div>
            <Link href={`/login?redirect=/feed/${id}`} style={{ display: 'inline-block', padding: '10px 28px', borderRadius: 12, background: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)', fontWeight: 700, fontSize: 'var(--fs-base)', textDecoration: 'none' }}>
              카카오로 로그인
            </Link>
          </div>
        )}

        {(post.category === 'apt' || post.category === 'stock') && (
          <Disclaimer type="feed" compact />
        )}

      </article>

      {/* 액션 바 — 본문과 댓글 사이 (인라인) */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '12px 0', borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)', margin: '16px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <LikeButton postId={post.id} initialCount={post.likes_count ?? 0} />
          <Link href="#comments" style={{ display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', color: 'var(--text-tertiary)', fontSize: 'var(--fs-base)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
            <span style={{ fontWeight: 500 }}>{comments.length}</span>
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
          <ShareButtons title={post.title} postId={post.id} content={post.content} />
          <BookmarkButton postId={post.id} />
        </div>
      </div>

      {/* Comments — 로그인 여부 상관없이 댓글 목록 표시, 입력만 분기 */}
      <div style={{ marginBottom: 16 }}>
        <CommentSection postId={post.id} initialComments={comments} />
      </div>

      {/* Related posts */}
      {related.filter((r: any) => !r._type).length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>더 읽어보기</h3>
          {related.filter((r: any) => !r._type).map((r: any) => (
            <Link key={r.id} href={`/feed/${r.slug || r.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 12 }}>{r.title}</span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>🤍 {r.likes_count ?? 0} · 💬 {r.comments_count ?? 0}</span>
            </Link>
          ))}
        </div>
      )}

      {/* 관련 부동산 현장 (내부 링크 SEO) */}
      {related.filter((r: any) => r._type === 'site').length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>🏢 관련 현장</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {related.filter((r: any) => r._type === 'site').map((s: any) => (
              <Link key={s.slug} href={`/apt/${s.slug}`} style={{ flex: '1 1 calc(33.3% - 6px)', minWidth: 130, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', textDecoration: 'none' }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{s.region} {s.sigungu || ''}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 관련 종목 (내부 링크 SEO) */}
      {related.filter((r: any) => r._type === 'stock').length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>📈 관련 종목</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {related.filter((r: any) => r._type === 'stock').map((s: any) => (
              <Link key={s.symbol} href={`/stock/${s.symbol}`} style={{ flex: '1 1 calc(33.3% - 6px)', minWidth: 130, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', textDecoration: 'none' }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: Number(s.change_pct) >= 0 ? 'var(--accent-red)' : 'var(--accent-blue)', marginTop: 2 }}>
                  {s.currency === 'USD' ? '$' : '₩'}{Number(s.price).toLocaleString()} {Number(s.change_pct) >= 0 ? '▲' : '▼'}{Math.abs(Number(s.change_pct)).toFixed(2)}%
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}