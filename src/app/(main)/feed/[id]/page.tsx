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
import PollWidget from '@/components/PollWidget';
import { renderContent, type EntityMap } from '@/lib/content-renderer';


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
    const ogImageUrl = `${SITE_URL}/api/og?title=${encodeURIComponent(post.title)}&design=2&author=${encodeURIComponent(author)}&category=${encodeURIComponent(post.category || '')}&likes=${post.likes_count ?? 0}&comments=${post.comments_count ?? 0}`;
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
        images: [
          { url: ogImageUrl, width: 1200, height: 630, alt: post.title },
          { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent(post.title)}&category=${post.category || 'talk'}`, width: 630, height: 630, alt: post.title },
        ],
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
        'naver:author': author,
        'og:updated_time': post.created_at,
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
  let relatedQuote: any = null;
  let relatedAptCount = 0;
  let relatedBlogs: { slug: string; title: string; category: string; view_count: number | null }[] = [];
  let entityMap: EntityMap = {};

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
            if (sitesData?.length) related = [...related, ...sitesData.map((s: Record<string, any>) => ({ ...s, _type: 'site' }))];
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
            if (stocksData?.length) related = [...related, ...stocksData.map((s: Record<string, any>) => ({ ...s, _type: 'stock' }))];
          }
        } catch {}
      }

      // Related stock/apt data for category-specific display
      if (postData?.category === 'stock') {
        try {
          const stockKeywords = (postData.title || '').match(/[가-힣]{2,}/g)?.slice(0, 3) || [];
          for (const kw of stockKeywords) {
            const { data } = await sb.from('stock_quotes').select('symbol,name,price,change_pct,currency').ilike('name', `%${kw}%`).gt('price', 0).limit(1).maybeSingle();
            if (data) { relatedQuote = data; break; }
          }
        } catch {}
      }
      if (postData?.category === 'apt') {
        try {
          const regionKeywords = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주'];
          const foundRegion = regionKeywords.find(r => (postData.title || '').includes(r));
          if (foundRegion) {
            const { count } = await sb.from('apt_subscriptions').select('id', { count: 'exact', head: true }).ilike('region_nm', `${foundRegion}%`).gte('rcept_endde', new Date().toISOString().slice(0, 10));
            relatedAptCount = count || 0;
          }
        } catch {}
      }

      // 관련 블로그 (카테고리 기반 크로스셀)
      try {
        const blogCat = postData.category === 'apt' ? 'apt' : postData.category === 'stock' ? 'stock' : postData.category === 'local' ? 'general' : 'finance';
        const { data: blogData } = await sb.from('blog_posts')
          .select('slug,title,category,view_count')
          .eq('is_published', true).eq('category', blogCat)
          .order('view_count', { ascending: false }).limit(3);
        if (blogData?.length) relatedBlogs = blogData;
      } catch {}

      // 자동 링킹용 엔티티 사전 (인기 종목 + 현장)
      try {
        const [{ data: topStocks }, { data: topApts }] = await Promise.all([
          sb.from('stock_quotes').select('symbol, name').eq('is_active', true).gt('price', 0).order('volume', { ascending: false, nullsFirst: false }).limit(150),
          sb.from('apt_sites').select('slug, name').eq('is_active', true).gte('content_score', 25).order('page_views', { ascending: false, nullsFirst: false }).limit(150),
        ]);
        entityMap = {
          stocks: (topStocks || []).map((s: any) => ({ name: s.name, symbol: s.symbol })),
          apts: (topApts || []).map((a: any) => ({ name: a.name, slug: a.slug })),
        };
      } catch {}
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
    ] as CommentWithProfile[];
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
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
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
      {/* FAQ JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: `이 글은 어떤 내용인가요?`, acceptedAnswer: { '@type': 'Answer', text: post.content?.slice(0, 150) || post.title } },
          { '@type': 'Question', name: `카더라 커뮤니티는 어떤 곳인가요?`, acceptedAnswer: { '@type': 'Answer', text: `카더라는 주식, 부동산, 재테크 정보를 공유하는 투자 커뮤니티입니다. 누구나 무료로 글을 작성하고 토론에 참여할 수 있습니다.` } },
        ],
      }) }} />

      {/* Back link */}
      <div style={{ marginBottom: 12 }}>
        <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1 }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>
          <span style={{ fontSize: 10 }}>›</span>
          <Link href="/feed" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>피드</Link>
          {post.category && <><span style={{ fontSize: 10 }}>›</span><span>{CATEGORY_MAP[post.category]?.label || post.category}</span></>}
        </nav>
      </div>

      {/* Post article */}
      <article style={{ marginBottom: 0 }}>
        {/* Title */}
        <h1 style={{ margin: '0 0 16px', fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.35, wordBreak: 'keep-all' }}>
          {post.title}
        </h1>

        {/* Author row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--sp-2xl)' }}>
          {post.profiles?.avatar_url ? (
            <Image src={post.profiles.avatar_url} alt={post.profiles?.nickname ?? '익명'} width={40} height={40} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} unoptimized={!post.profiles.avatar_url.includes('supabase.co')} />
          ) : (
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: getAvatarColor(post.profiles?.nickname ?? '익명'),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-inverse)',
            }}>
              {(post.profiles?.nickname ?? '익')[0].toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {post.profiles?.nickname ?? '익명'}
            </span>
            <span style={{ marginLeft: 4 }}>{GRADE_EMOJI[post.profiles?.grade as number] || '🌱'}</span>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginTop: 2 }}>
              <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time> · 조회 {(post.view_count ?? 0).toLocaleString()}
            </div>
            {post.content && post.content.length > 500 && (
              <div style={{ display: 'flex', gap: 'var(--sp-sm)', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 'var(--sp-xs)' }}>
                <span>📝 {post.content.length.toLocaleString()}자</span>
                <span>⏱ ~{Math.max(1, Math.round(post.content.length / 500))}분</span>
              </div>
            )}
          </div>
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)' }}>
            <PostActions postId={post.id} isOwner={currentUserId === post.author_id} />
            <ReportButton postId={post.id} style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer' }} />
          </div>
        </div>

        {/* 글자 크기 조절 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--sp-sm)' }}>
          <FontSizeControl />
        </div>

        {/* Content body */}
        {currentUserId ? (
          <div className="feed-detail-content" style={{ fontSize: 'var(--content-font-size, 16px)' as React.CSSProperties['fontSize'], color: 'var(--text-primary)', lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '0 0 24px' }}>
            {renderContent(post.content, entityMap)}
          </div>
        ) : (
          <div style={{ position: 'relative', margin: '0 0 24px' }}>
            <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)', lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 'clamp(200px, 35vh, 400px)', overflow: 'hidden' }}>
              {renderContent(post.content, entityMap)}
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, background: 'linear-gradient(transparent, var(--bg-base))' }} />
          </div>
        )}

        {/* Image gallery — 로그인 여부 상관없이 표시 */}
        {post.images && post.images.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: post.images.length === 1 ? '1fr' : post.images.length === 2 ? '1fr 1fr' : 'repeat(3, 1fr)',
            gap: 'var(--sp-sm)',
            marginBottom: 'var(--sp-2xl)',
          }}>
            {post.images.map((url: string, i: number) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', position: 'relative', borderRadius: 'var(--radius-sm)', overflow: 'hidden',
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
          <div style={{ textAlign: 'center', padding: '24px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', marginBottom: 'var(--sp-2xl)' }}>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)' }}>전체 글을 보려면 로그인하세요</div>
            <Link href={`/login?redirect=/feed/${id}`} style={{ display: 'inline-block', padding: '10px 28px', borderRadius: 'var(--radius-card)', background: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)', fontWeight: 700, fontSize: 'var(--fs-base)', textDecoration: 'none' }}>
              카카오로 로그인
            </Link>
          </div>
        )}

        {(post.category === 'apt' || post.category === 'stock') && (
          <Disclaimer type="feed" compact />
        )}

      </article>

      {/* 관련 실시간 데이터 */}
      {relatedQuote && (
        <Link href={`/stock/${relatedQuote.symbol}`} style={{
          display: 'flex', alignItems: 'center', gap: 'var(--sp-md)', padding: 12, marginBottom: 'var(--sp-md)',
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          textDecoration: 'none', color: 'inherit',
        }}>
          <span style={{ fontSize: 'var(--fs-lg)' }}>📈</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{relatedQuote.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{relatedQuote.currency === 'USD' ? `$${Number(relatedQuote.price).toFixed(2)}` : `₩${Number(relatedQuote.price).toLocaleString()}`}</div>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: Number(relatedQuote.change_pct) > 0 ? 'var(--accent-red)' : Number(relatedQuote.change_pct) < 0 ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}>
            {Number(relatedQuote.change_pct) > 0 ? '+' : ''}{Number(relatedQuote.change_pct).toFixed(2)}%
          </span>
        </Link>
      )}
      {relatedAptCount > 0 && (
        <Link href="/apt" style={{
          display: 'flex', alignItems: 'center', gap: 'var(--sp-md)', padding: 12, marginBottom: 'var(--sp-md)',
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          textDecoration: 'none', color: 'inherit',
        }}>
          <span style={{ fontSize: 'var(--fs-lg)' }}>🏢</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>관련 청약 정보</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>현재 {relatedAptCount}건 접수중</div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 600 }}>보기 →</span>
        </Link>
      )}

      {/* 인게이지먼트 미니 대시보드 — 컴팩트 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--sp-md)' }}>
        {[
          { icon: '👁', label: '조회', value: post.view_count ?? 0, max: 1000, color: 'var(--accent-blue)' },
          { icon: '🤍', label: '좋아요', value: post.likes_count ?? 0, max: 100, color: 'var(--accent-red)' },
          { icon: '💬', label: '댓글', value: comments.length, max: 50, color: 'var(--accent-green)' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11 }}>{s.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: s.value > 0 ? s.color : 'var(--text-tertiary)' }}>{s.value.toLocaleString()}</span>
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{s.label}</span>
              </div>
              <div style={{ height: 2, borderRadius: 1, background: 'var(--bg-hover)', marginTop: 1, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min((s.value / s.max) * 100, 100)}%`, borderRadius: 1, background: s.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '12px 0', borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)', margin: '16px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-lg)' }}>
          <LikeButton postId={post.id} initialCount={post.likes_count ?? 0} />
          <Link href="#comments" style={{ display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', color: 'var(--text-tertiary)', fontSize: 'var(--fs-base)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
            <span style={{ fontWeight: 500 }}>{comments.length}</span>
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)', marginLeft: 'auto' }}>
          <ShareButtons title={post.title} postId={post.id} content={post.content} />
          <BookmarkButton postId={post.id} />
        </div>
      </div>

      {/* 투표 위젯 */}
      <PollWidget postId={post.id} />

      {/* Comments — 로그인 여부 상관없이 댓글 목록 표시, 입력만 분기 */}
      <div style={{ marginBottom: 'var(--sp-lg)' }}>
        <CommentSection postId={post.id} initialComments={comments} />
      </div>

      {/* Related posts */}
      {related.filter((r: Record<string, any>) => !r._type).length > 0 && (
        <div style={{ marginBottom: 'var(--sp-xl)' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>더 읽어보기</h3>
          {related.filter((r: Record<string, any>) => !r._type).map((r: Record<string, any>) => (
            <Link key={r.id} href={`/feed/${r.slug || r.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 12 }}>{r.title}</span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>🤍 {r.likes_count ?? 0} · 💬 {r.comments_count ?? 0}</span>
            </Link>
          ))}
        </div>
      )}

      {/* 관련 부동산 현장 (내부 링크 SEO) */}
      {related.filter((r: Record<string, any>) => r._type === 'site').length > 0 && (
        <div style={{ marginBottom: 'var(--sp-xl)' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>🏢 관련 현장</h3>
          <div style={{ display: 'flex', gap: 'var(--sp-sm)', flexWrap: 'wrap' }}>
            {related.filter((r: Record<string, any>) => r._type === 'site').map((s: Record<string, any>) => (
              <Link key={s.slug} href={`/apt/${s.slug}`} style={{ flex: '1 1 calc(33.3% - 6px)', minWidth: 130, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', textDecoration: 'none' }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{s.region} {s.sigungu || ''}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 관련 종목 (내부 링크 SEO) */}
      {related.filter((r: Record<string, any>) => r._type === 'stock').length > 0 && (
        <div style={{ marginBottom: 'var(--sp-xl)' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>📈 관련 종목</h3>
          <div style={{ display: 'flex', gap: 'var(--sp-sm)', flexWrap: 'wrap' }}>
            {related.filter((r: Record<string, any>) => r._type === 'stock').map((s: Record<string, any>) => (
              <Link key={s.symbol} href={`/stock/${s.symbol}`} style={{ flex: '1 1 calc(33.3% - 6px)', minWidth: 130, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', textDecoration: 'none' }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: Number(s.change_pct) >= 0 ? 'var(--accent-red)' : 'var(--accent-blue)', marginTop: 2 }}>
                  {s.currency === 'USD' ? '$' : '₩'}{Number(s.price).toLocaleString()} {Number(s.change_pct) >= 0 ? '▲' : '▼'}{Math.abs(Number(s.change_pct)).toFixed(2)}%
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 📝 관련 블로그 크로스셀 */}
      {relatedBlogs.length > 0 && (
        <div style={{ marginBottom: 'var(--sp-xl)', padding: 16, background: 'linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(167,139,250,0.04) 100%)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(37,99,235,0.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>📰 관련 분석 글</h2>
            <Link href="/blog" style={{ fontSize: 11, color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>더보기 →</Link>
          </div>
          {relatedBlogs.map(b => (
            <Link key={b.slug} href={`/blog/${b.slug}`} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none',
            }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 10 }}>{b.title}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>👀 {(b.view_count || 0).toLocaleString()}</span>
            </Link>
          ))}
        </div>
      )}

      {/* 바이럴 CTA — 하단 공유 유도 */}
      <div style={{ padding: '16px', borderRadius: 'var(--radius-card)', background: 'linear-gradient(135deg, rgba(59,123,246,0.05), rgba(46,232,165,0.03))', border: '1px solid rgba(59,123,246,0.08)', textAlign: 'center', marginBottom: 'var(--sp-xl)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>이 글 어떠셨나요?</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>공유하면 +5P · 친구 초대하면 +50P!</div>
        <ShareButtons title={post.title} postId={post.id} content={post.content} />
      </div>
    </div>
  );
}