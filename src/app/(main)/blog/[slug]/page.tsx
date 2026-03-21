import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { marked } from 'marked';
import BlogCommentInput from '@/components/BlogCommentInput';
import { getAvatarColor } from '@/lib/avatar';

export const revalidate = 300;
const SITE = 'https://kadeora.app';

marked.setOptions({ breaks: true, gfm: true });

interface Props { params: Promise<{ slug: string }> }

// 목차 추출: HTML에서 h2/h3 태그 파싱
function extractToc(html: string): { level: number; text: string; id: string }[] {
  const regex = /<h([23])[^>]*id="([^"]*)"[^>]*>(.*?)<\/h[23]>/gi;
  const items: { level: number; text: string; id: string }[] = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    items.push({ level: parseInt(match[1]), text: match[3].replace(/<[^>]+>/g, ''), id: match[2] });
  }
  return items;
}

// GEO 지역 코드 매핑
const GEO_CODES: Record<string, string> = {
  '서울': 'KR-11', '부산': 'KR-26', '대구': 'KR-27', '인천': 'KR-28',
  '광주': 'KR-29', '대전': 'KR-30', '울산': 'KR-31', '세종': 'KR-36',
  '경기': 'KR-41', '강원': 'KR-42', '충북': 'KR-43', '충남': 'KR-44',
  '전북': 'KR-45', '전남': 'KR-46', '경북': 'KR-47', '경남': 'KR-48', '제주': 'KR-50',
};

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return '방금 전'; if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

const CTA_BY_CAT: Record<string, string> = {
  apt: '이 단지에 대해 어떻게 생각하세요?',
  unsold: '이 단지에 대해 어떻게 생각하세요?',
  stock: '이 종목 전망은 어떻다고 보시나요?',
  general: '여러분의 의견을 남겨주세요',
  finance: '여러분의 의견을 남겨주세요',
};

export async function generateMetadata({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const sb = await createSupabaseServer();
  const { data: post } = await sb.from('blog_posts').select('title, excerpt, category, tags, created_at, cover_image').eq('slug', slug).eq('is_published', true).maybeSingle();
  if (!post) return {};
  return {
    title: `${post.title} | 카더라 블로그`,
    description: post.excerpt || post.title,
    keywords: (post.tags ?? []).join(', '),
    alternates: { canonical: `${SITE}/blog/${slug}` },
    openGraph: {
      title: post.title, description: post.excerpt || post.title, type: 'article',
      publishedTime: post.created_at, url: `${SITE}/blog/${slug}`,
      ...(post.cover_image ? { images: [{ url: post.cover_image, width: 1200, height: 630 }] } : {}),
    },
    other: (() => {
      // GEO 태그: 제목/태그에서 지역명 추출
      const allText = `${post.title} ${(post.tags ?? []).join(' ')}`;
      const geo = Object.entries(GEO_CODES).find(([k]) => allText.includes(k));
      return geo ? { 'geo.region': geo[1], 'geo.placename': geo[0] } : {};
    })(),
  };
}

export default async function BlogDetailPage({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const sb = await createSupabaseServer();

  const { data: post } = await sb.from('blog_posts').select('*').eq('slug', slug).eq('is_published', true).maybeSingle();
  if (!post) return notFound();

  sb.from('blog_posts').update({ view_count: (post.view_count ?? 0) + 1 }).eq('id', post.id).then(() => {});

  const { data: { user } } = await sb.auth.getUser();
  const isLoggedIn = !!user;

  const { data: related } = await sb.from('blog_posts').select('slug, title').eq('category', post.category).eq('is_published', true).neq('id', post.id).order('created_at', { ascending: false }).limit(3);

  // 댓글 조회 (blog_comments 테이블이 없으면 빈 배열)
  let comments: any[] = [];
  try {
    const { data } = await sb.from('blog_comments')
      .select('id, content, created_at, author_id, profiles!blog_comments_author_id_fkey(nickname)')
      .eq('blog_post_id', post.id).order('created_at', { ascending: true });
    comments = data ?? [];
  } catch {}

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: post.title, description: post.excerpt || '',
    datePublished: post.created_at, dateModified: post.updated_at,
    author: { '@type': 'Organization', name: '카더라', url: SITE },
    publisher: { '@type': 'Organization', name: '카더라', url: SITE },
    url: `${SITE}/blog/${slug}`, keywords: (post.tags ?? []).join(', '), inLanguage: 'ko-KR',
  };

  // 마크다운 → HTML
  const htmlFull = marked(post.content) as string;
  const cutoff = Math.floor(htmlFull.length * 0.4);
  const htmlTruncated = htmlFull.slice(0, cutoff);

  // 목차 추출
  const toc = extractToc(htmlFull);

  // FAQ schema (tags에 'FAQ' 포함 시)
  const isFaq = (post.tags ?? []).some((t: string) => t.toLowerCase().includes('faq') || t === '자주묻는질문');
  const faqSchema = isFaq ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: toc.filter(t => t.text.startsWith('Q.')).map(t => ({
      '@type': 'Question', name: t.text.replace(/^Q\.\s*/, ''),
      acceptedAnswer: { '@type': 'Answer', text: `자세한 답변은 ${SITE}/blog/${slug}#${t.id} 에서 확인하세요.` },
    })),
  } : null;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 16px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />}

      <div style={{ marginBottom: 16 }}>
        <Link href="/blog" style={{ fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 블로그</Link>
      </div>

      <article style={{ paddingBottom: 40 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.35, margin: '0 0 12px' }}>{post.title}</h1>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 20, display: 'flex', gap: 8 }}>
          <span>{new Date(post.created_at).toLocaleDateString('ko-KR')}</span>
          <span>조회 {post.view_count ?? 0}</span>
        </div>

        {(post.tags ?? []).length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {post.tags.map((t: string) => <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>#{t}</span>)}
          </div>
        )}

        {/* 목차 */}
        {toc.length >= 3 && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>목차</div>
            {toc.map((item, i) => (
              <a key={i} href={`#${item.id}`} style={{ display: 'block', padding: '3px 0', paddingLeft: item.level === 3 ? 16 : 0, fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', lineHeight: 1.5 }}>
                {item.text}
              </a>
            ))}
          </div>
        )}

        {/* 본문 — 마크다운 렌더링 */}
        {isLoggedIn ? (
          <div className="blog-content" dangerouslySetInnerHTML={{ __html: htmlFull }} />
        ) : (
          <div style={{ position: 'relative' }}>
            <div className="blog-content" style={{ maxHeight: 500, overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: htmlTruncated }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(transparent, var(--bg-base))' }} />
            <div style={{ textAlign: 'center', padding: '24px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, marginTop: -20, position: 'relative' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>전체 글을 보려면 로그인하세요</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>청약 마감 알림도 받을 수 있어요</div>
              <Link href="/login" style={{ display: 'inline-block', padding: '10px 28px', borderRadius: 12, background: '#FEE500', color: '#191919', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                카카오로 가입
              </Link>
            </div>
          </div>
        )}

        {/* 면책고지는 콘텐츠(DB) 안에 이미 포함 — 중복 제거 */}
      </article>

      {/* 댓글 섹션 */}
      <div id="blog-comments" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>의견 {comments.length}개</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
          {CTA_BY_CAT[post.category] ?? CTA_BY_CAT.general}
        </p>

        {/* 댓글 입력 */}
        {isLoggedIn ? (
          <BlogCommentInput blogPostId={post.id} />
        ) : (
          <div style={{ padding: '14px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, textAlign: 'center', marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
            <Link href="/login" style={{ color: 'var(--brand)', fontWeight: 700, textDecoration: 'none' }}>로그인</Link>하면 의견을 남길 수 있어요
          </div>
        )}

        {/* 댓글 목록 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {comments.map((c: any) => {
            const nick = (c.profiles as any)?.nickname ?? '사용자';
            return (
              <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: getAvatarColor(nick), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                  {nick[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{nick}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{timeAgo(c.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>{c.content}</div>
                </div>
              </div>
            );
          })}
          {comments.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
              아직 의견이 없어요. 첫 의견을 남겨보세요!
            </div>
          )}
        </div>
      </div>

      {/* CTA 배너 */}
      <div style={{ padding: '20px 16px', margin: '20px 0', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>매일 업데이트되는 투자 정보를 받아보세요</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>청약 마감 알림 · 급등주 알림 · 미분양 업데이트</div>
        <Link href="/login" style={{ display: 'inline-block', padding: '10px 32px', borderRadius: 12, background: '#FEE500', color: '#191919', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
          카카오로 3초 가입
        </Link>
      </div>

      {/* 관련 글 */}
      {(related ?? []).length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>관련 글</div>
          {related!.map((r: any) => (
            <Link key={r.slug} href={`/blog/${r.slug}`} style={{ display: 'block', padding: '10px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', fontSize: 13, color: 'var(--text-primary)' }}>
              {r.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
