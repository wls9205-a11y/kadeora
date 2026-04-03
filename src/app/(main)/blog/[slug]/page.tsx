import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { marked } from 'marked';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { injectInternalLinks } from '@/lib/blog-auto-link';
import BlogCommentInput from '@/components/BlogCommentInput';
import BlogCommentCTA from '@/components/BlogCommentCTA';
import ShareButtons from '@/components/ShareButtons';
import BlogFaqAccordion from '@/components/BlogFaqAccordion';
import BlogToc from '@/components/BlogToc';
import BlogActions from '@/components/BlogActions';
import { getAvatarColor } from '@/lib/avatar';
import { parseFaqFromContent } from '@/lib/blog-faq-parser';
import { timeAgo } from '@/lib/format';

export const maxDuration = 30;
export const revalidate = 300;
import { SITE_URL as SITE } from '@/lib/constants';
import { enhanceBlogVisuals } from '@/lib/blog-visual-enhancer';
import ReadingProgress from '@/components/ReadingProgress';
import NextArticleFloat from '@/components/NextArticleFloat';
import BlogTossGate from '@/components/BlogTossGate';
import { BlogTopBanner, BlogMidCTA, BlogFloatingCTA } from '@/components/BlogSignupCTA';
import BlogReadGate from '@/components/BlogReadGate';

// marked heading에 id 자동 부여 (TOC 앵커용)
const slugify = (text: string) => text.replace(/<[^>]+>/g, '').replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();

const renderer = new marked.Renderer();
renderer.heading = function ({ text, depth }: { text: string; depth: number }) {
  const id = slugify(text);
  return `<h${depth} id="${id}">${text}</h${depth}>\n`;
};
renderer.image = function ({ href, title, text }: { href: string; title: string | null; text: string }) {
  return `<img src="${href}" alt="${text || ''}" ${title ? `title="${title}"` : ''} loading="lazy" decoding="async" style="max-width:100%;height:auto;border-radius:8px" />`;
};
marked.setOptions({ breaks: true, gfm: true, renderer });

interface Props { params: Promise<{ slug: string }> }

// 목차 추출: HTML에서 h2/h3 태그 파싱
function extractToc(html: string): { level: number; text: string; id: string }[] {
  const regex = /<h([23])[^>]*id="([^"]*)"[^>]*>(.*?)<\/h[23]>/gi;
  const items: { level: number; text: string; id: string }[] = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    const cleanText = match[3]
      .replace(/<[^>]+>/g, '')  // HTML 태그 제거
      .replace(/\*\*/g, '')     // 남은 ** 제거
      .trim();
    if (cleanText) items.push({ level: parseInt(match[1]), text: cleanText, id: match[2] });
  }
  return items;
}

// 마크다운 전처리: **볼드만 있는 줄** → ## h2 변환 (AI 생성 콘텐츠 시맨틱 강화)
function normalizeMarkdownHeadings(md: string): string {
  return md.replace(
    /^(\*\*|__)([^*_\n]{2,60})\1\s*$/gm,
    (_match, _marker, text) => {
      const t = text.trim();
      // Q&A 패턴은 H3으로 (H2 과다 방지)
      if (/^[QA][.:]\s/.test(t)) return `### ${t}`;
      return `## ${t}`;
    }
  );
}

// 블로그 본문 전처리: 이스케이프된 문자열 정리
function sanitizeBlogContent(raw: string): string {
  return raw
    .replace(/\\n/g, '\n')     // 리터럴 \\n → 실제 줄바꿈
    .replace(/\\t/g, '\t')     // 리터럴 \\t → 실제 탭
    .replace(/\\r/g, '')       // 리터럴 \\r 제거
    .replace(/\r\n/g, '\n')   // Windows 줄바꿈 통일
    .replace(/\n{4,}/g, '\n\n\n') // 과도한 빈줄(4+) → 3줄로 축소
    // ── 구조 개선 ──
    // "## 목차" 제거 (SEO 가치 없음, 이미 TOC 컴포넌트가 있음)
    .replace(/^## 목차\s*$/gm, '')
    // "1. 섹터 개요 2. 주요 종목..." 같은 번호 목차 줄 제거
    .replace(/^\d+\.\s+\S+\s+\d+\.\s+\S+\s+\d+\.\s+\S+.*$/gm, '')
    // ── 코드 노출 방지 ──
    // H2/H3 안의 **볼드** 마크다운 제거 (이미 CSS로 볼드)
    .replace(/^(#{1,6}\s+.*?)\*\*([^*\n]+)\*\*(.*?)$/gm, '$1$2$3')
    // 숫자~숫자 패턴 — ~가 취소선으로 변환되는 것 방지
    .replace(/(\d)~(\d)/g, '$1～$2')
    // Q. / Q: 로 시작하는 ## → ### 로 다운그레이드 (H2 과다 방지)
    .replace(/^## (Q[.:])/gm, '### $1')
    .replace(/^## (A[.:])/gm, '### $1')
    // **Q. / **Q: 패턴도 처리
    .replace(/^\*\*(Q[.:]\s)/gm, '**$1');
}


const GEO_CODES: Record<string, { code: string; lat: string; lng: string }> = {
  // 광역시·도
  '서울': { code: 'KR-11', lat: '37.5665', lng: '126.9780' },
  '부산': { code: 'KR-26', lat: '35.1796', lng: '129.0756' },
  '대구': { code: 'KR-27', lat: '35.8714', lng: '128.6014' },
  '인천': { code: 'KR-28', lat: '37.4563', lng: '126.7052' },
  '광주': { code: 'KR-29', lat: '35.1595', lng: '126.8526' },
  '대전': { code: 'KR-30', lat: '36.3504', lng: '127.3845' },
  '울산': { code: 'KR-31', lat: '35.5384', lng: '129.3114' },
  '세종': { code: 'KR-36', lat: '36.4800', lng: '127.2600' },
  '경기': { code: 'KR-41', lat: '37.4138', lng: '127.5183' },
  '강원': { code: 'KR-42', lat: '37.8228', lng: '128.1555' },
  '충북': { code: 'KR-43', lat: '36.6357', lng: '127.4917' },
  '충남': { code: 'KR-44', lat: '36.5184', lng: '126.8000' },
  '전북': { code: 'KR-45', lat: '35.8203', lng: '127.1088' },
  '전남': { code: 'KR-46', lat: '34.8161', lng: '126.4629' },
  '경북': { code: 'KR-47', lat: '36.4919', lng: '128.8889' },
  '경남': { code: 'KR-48', lat: '35.4606', lng: '128.2132' },
  '제주': { code: 'KR-50', lat: '33.4996', lng: '126.5312' },
  // 서울 주요 구
  '강남구': { code: 'KR-11', lat: '37.5172', lng: '127.0473' },
  '서초구': { code: 'KR-11', lat: '37.4837', lng: '127.0324' },
  '송파구': { code: 'KR-11', lat: '37.5145', lng: '127.1059' },
  '마포구': { code: 'KR-11', lat: '37.5663', lng: '126.9014' },
  '용산구': { code: 'KR-11', lat: '37.5326', lng: '126.9905' },
  '영등포구': { code: 'KR-11', lat: '37.5264', lng: '126.8962' },
  '노원구': { code: 'KR-11', lat: '37.6542', lng: '127.0568' },
  '강동구': { code: 'KR-11', lat: '37.5301', lng: '127.1238' },
  '은평구': { code: 'KR-11', lat: '37.6026', lng: '126.9290' },
  // 경기 주요 시
  '성남시': { code: 'KR-41', lat: '37.4449', lng: '127.1388' },
  '수원시': { code: 'KR-41', lat: '37.2636', lng: '127.0286' },
  '고양시': { code: 'KR-41', lat: '37.6564', lng: '126.8350' },
  '화성시': { code: 'KR-41', lat: '37.1996', lng: '126.8312' },
  '용인시': { code: 'KR-41', lat: '37.2411', lng: '127.1776' },
  '하남시': { code: 'KR-41', lat: '37.5397', lng: '127.2145' },
  '과천시': { code: 'KR-41', lat: '37.4292', lng: '126.9876' },
  '의정부시': { code: 'KR-41', lat: '37.7381', lng: '127.0337' },
  // 부산 주요 구
  '해운대구': { code: 'KR-26', lat: '35.1631', lng: '129.1635' },
  '부산진구': { code: 'KR-26', lat: '35.1596', lng: '129.0532' },
  '동래구': { code: 'KR-26', lat: '35.2063', lng: '129.0845' },
  '남구': { code: 'KR-26', lat: '35.1357', lng: '129.0847' },
};


const CTA_BY_CAT: Record<string, string> = {
  apt: '이 단지에 대해 어떻게 생각하세요?',
  unsold: '이 단지에 대해 어떻게 생각하세요?',
  stock: '이 종목 전망은 어떻다고 보시나요?',
  general: '여러분의 의견을 남겨주세요',
  finance: '여러분의 의견을 남겨주세요',
};

/**
 * 빌드 타임 정적 생성 — 인기/최신 블로그 200편을 미리 HTML로 생성
 * Google 크롤러가 즉시 접근 가능하도록 TTFB 0ms 수준으로 제공
 */
export async function generateStaticParams() {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from('blog_posts')
      .select('slug')
      .eq('is_published', true)
      .not('published_at', 'is', null)
      .order('view_count', { ascending: false })
      .limit(200);
    return (data || []).map(p => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const sb = await createSupabaseServer();
  const { data: post } = await sb.from('blog_posts').select('id,title,slug,content,excerpt,category,sub_category,cover_image,image_alt,tags,meta_description,meta_keywords,author_name,author_role,reading_time_min,view_count,comment_count,helpful_count,published_at,created_at,updated_at,series_id,series_order,source_type,source_ref,data_date,rewritten_at').eq('slug', slug).eq('is_published', true).maybeSingle();
  if (!post) return {};
    const ogImage = post.cover_image || `${SITE}/api/og?title=${encodeURIComponent(post.title)}&category=${post.category}&author=${encodeURIComponent(post.author_name || '카더라 데이터팀')}&design=2`;
    const ogSquare = `${SITE}/api/og-square?title=${encodeURIComponent(post.title)}&category=${post.category}&author=${encodeURIComponent(post.author_name || '카더라 데이터팀')}`;
  return {
    title: `${post.title} | 블로그`,
    description: post.meta_description || post.excerpt || post.title,
    keywords: post.meta_keywords || (post.tags ?? []).join(', '),
    alternates: { canonical: `${SITE}/blog/${slug}` },
    openGraph: {
      title: post.title, description: post.excerpt || post.title, type: 'article',
      siteName: '카더라', locale: 'ko_KR',
      publishedTime: post.published_at || post.created_at,
      modifiedTime: post.updated_at || post.rewritten_at || post.published_at || post.created_at,
      authors: [post.author_name || '카더라 데이터팀'],
      tags: post.tags ?? [],
      section: post.category === 'stock' ? '주식' : post.category === 'apt' ? '부동산' : post.category === 'unsold' ? '미분양' : '재테크',
      url: `${SITE}/blog/${slug}`,
      images: [
        { url: ogImage, width: 1200, height: 630, alt: post.image_alt || `카더라 — ${post.title}` },
        { url: ogSquare, width: 630, height: 630, alt: post.image_alt || `카더라 — ${post.title}` },
      ],
    },
    twitter: {
      card: 'summary_large_image' as const,
      images: [ogImage, ogSquare],
    },
    other: (() => {
      const allText = `${post.title} ${(post.tags ?? []).join(' ')}`;
      const geoEntry = Object.entries(GEO_CODES).find(([k]) => allText.includes(k));
      const section = post.category === 'stock' ? '주식' : post.category === 'apt' ? '부동산' : post.category === 'unsold' ? '미분양' : '재테크';
      return {
        ...(geoEntry ? {
          'geo.region': geoEntry[1].code,
          'geo.placename': geoEntry[0],
          'geo.position': `${geoEntry[1].lat};${geoEntry[1].lng}`,
          'ICBM': `${geoEntry[1].lat}, ${geoEntry[1].lng}`,
        } : {}),
        'og:updated_time': post.updated_at || post.published_at || post.created_at,
        'naver:written_time': post.published_at || post.created_at,
        'naver:updated_time': post.updated_at || post.published_at || post.created_at,
        'naver:author': post.author_name || '카더라',
        'dg:plink': `${SITE}/blog/${slug}`,
        'article:section': section,
        'article:tag': (post.tags ?? []).slice(0, 5).join(',') || section,
        'article:published_time': post.published_at || post.created_at,
        'article:modified_time': post.updated_at || post.published_at || post.created_at,
        'article:author': post.author_name || '카더라 데이터팀',
      };
    })(),
  };
}

export default async function BlogDetailPage({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const sb = await createSupabaseServer();

  const { data: post } = await sb.from('blog_posts').select('id,title,slug,content,excerpt,category,sub_category,cover_image,image_alt,tags,meta_description,meta_keywords,author_name,author_role,reading_time_min,view_count,comment_count,helpful_count,published_at,created_at,updated_at,series_id,series_order,source_type,source_ref,data_date,rewritten_at').eq('slug', slug).eq('is_published', true).maybeSingle();
  if (!post) return notFound();

  // 뷰카운트 atomic 증가 — RPC로 race condition 방지
  sb.rpc('increment_blog_view', { p_blog_id: post.id }).then(() => {});

  let isLoggedIn = false;
  let isPremiumUser = false;
  try {
    const { data: { user } } = await sb.auth.getUser();
    isLoggedIn = !!user;
    if (user) {
      const { data: prof } = await sb.from('profiles').select('is_premium, premium_expires_at').eq('id', user.id).single();
      isPremiumUser = !!(prof?.is_premium && prof?.premium_expires_at && new Date(prof.premium_expires_at) > new Date());
    }
  } catch { /* 비로그인/만료 세션 */ }

  // 봇 감지 — SEO 크롤러에게는 전체 본문 제공
  const headersList = await headers();
  const ua = headersList.get('user-agent') || '';
  const isBot = /googlebot|bingbot|yandex|baiduspider|naverbot|daumoa|slurp|msnbot|ahrefsbot|semrushbot|dotbot|petalbot|facebot|twitterbot|linkedinbot|kakaotalk-scrap/i.test(ua);

  // 관련 글 추천 (pre-computed related_slugs 우선 → 태그 유사도 → 카테고리 폴백)
  let related: Record<string, any>[] = [];
  try {
    // 1순위: 크론으로 미리 계산된 related_slugs (별도 쿼리 — 타입 안전)
    let precomputed: string[] = [];
    try {
      const { data: relData } = await (sb as any).from('blog_posts').select('related_slugs').eq('id', post.id).single();
      precomputed = (relData as any)?.related_slugs || [];
    } catch { /* 컬럼 없을 수 있음 */ }
    if (precomputed.length > 0) {
      const { data: preRelated } = await sb.from('blog_posts')
        .select('slug, title, view_count').in('slug', precomputed).eq('is_published', true).limit(5);
      related = preRelated || [];
    }

    // 2순위: 태그 기반 추천
    if (related.length < 3) {
      const postTags = post.tags || [];
      if (postTags.length > 0) {
        const existingSlugs = new Set(related.map((r: any) => r.slug));
        const tagQueries = postTags.slice(0, 2).map((t: string) => `tags.cs.{${t}}`).join(',');
        const { data: tagRelated } = await sb.from('blog_posts')
          .select('slug, title, view_count').eq('category', post.category).eq('is_published', true)
          .neq('id', post.id).or(tagQueries)
          .order('view_count', { ascending: false }).limit(5);
        const extra = (tagRelated || []).filter((r: any) => !existingSlugs.has(r.slug));
        related = [...related, ...extra].slice(0, 5);
      }
    }

    // 3순위: 같은 카테고리 인기순 보충
    if (related.length < 3) {
      const existingSlugs = new Set(related.map((r: any) => r.slug));
      const { data: catRelated } = await sb.from('blog_posts')
        .select('slug, title, view_count').eq('category', post.category).eq('is_published', true)
        .neq('id', post.id).not('published_at', 'is', null)
        .order('view_count', { ascending: false }).limit(5 - related.length);
      const extra = (catRelated || []).filter((r: any) => !existingSlugs.has(r.slug));
      related = [...related, ...extra].slice(0, 5);
    }
  } catch { }

  // 시리즈 정보
  let seriesInfo: { series: any; posts: Record<string, any>[] } | null = null;
  if (post.series_id) {
    try {
      const { data: series } = await sb.from('blog_series').select('id,title,slug,description,cover_image,post_count').eq('id', post.series_id).single();
      if (series) {
        const { data: seriesPosts } = await sb.from('blog_posts')
          .select('id,title,slug,series_order')
          .eq('series_id', post.series_id).eq('is_published', true)
          .order('series_order', { ascending: true, nullsFirst: false })
          .order('published_at', { ascending: true });
        seriesInfo = { series, posts: seriesPosts || [] };
      }
    } catch { }
  }

  // 댓글 조회 (blog_comments 테이블이 없으면 빈 배열)
  let comments: Record<string, any>[] = [];
  try {
    const { data } = await sb.from('blog_comments')
      .select('id, content, created_at, author_id, author_name, is_seed, profiles!blog_comments_author_id_fkey(nickname)')
      .eq('blog_post_id', post.id).order('created_at', { ascending: true });
    comments = data ?? [];
  } catch {}

  // 관련 부동산 현장 (apt/unsold 카테고리일 때)
  let relatedSites: Record<string, any>[] = [];
  if (post.category === 'apt' || post.category === 'unsold') {
    try {
      const keywords = (post.tags || []).slice(0, 3).filter((t: string) => t.length >= 2);
      if (keywords.length > 0) {
        const orQuery = keywords.map((k: string) => `name.ilike.%${k}%`).join(',');
        const { data } = await sb.from('apt_sites').select('slug, name, site_type, region, sigungu')
          .eq('is_active', true).or(orQuery).gte('content_score', 25)
          .order('interest_count', { ascending: false }).limit(3);
        relatedSites = data || [];
      }
    } catch {}
  }

  // 관련 종목 (stock 카테고리일 때)
  let relatedStocks: Record<string, any>[] = [];
  if (post.category === 'stock') {
    try {
      const keywords = (post.tags || []).slice(0, 3).filter((t: string) => t.length >= 2);
      if (keywords.length > 0) {
        const orQuery = keywords.map((k: string) => `name.ilike.%${k}%`).join(',');
        const { data } = await sb.from('stock_quotes').select('symbol, name, market, price, change_pct, currency')
          .eq('is_active', true).or(orQuery).gt('price', 0).limit(3);
        relatedStocks = data || [];
      }
    } catch {}
  }

  // 이전/다음글 (같은 카테고리 내 시간순)
  let prevPost: { slug: string; title: string } | null = null;
  let nextPost: { slug: string; title: string } | null = null;
  if (!post.series_id) {
    try {
      const [prevR, nextR] = await Promise.all([
        sb.from('blog_posts').select('slug, title')
          .eq('category', post.category).eq('is_published', true)
          .lt('published_at', post.published_at || post.created_at)
          .order('published_at', { ascending: false }).limit(1).maybeSingle(),
        sb.from('blog_posts').select('slug, title')
          .eq('category', post.category).eq('is_published', true)
          .gt('published_at', post.published_at || post.created_at)
          .order('published_at', { ascending: true }).limit(1).maybeSingle(),
      ]);
      prevPost = prevR.data;
      nextPost = nextR.data;
    } catch {}
  }

  const wordCount = post.content.replace(/[#*|\-\n\r\[\]`>]/g, '').replace(/\s+/g, ' ').trim().length;
  const readingTimeMin = Math.max(1, Math.ceil(wordCount / 500));

  const catSection: Record<string, string> = { stock: '주식', apt: '부동산', unsold: '미분양', finance: '재테크', general: '생활' };

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'BlogPosting',
    headline: post.title,
    description: (post.meta_description || post.excerpt || '').slice(0, 160),
    datePublished: post.published_at || post.created_at,
    dateModified: post.updated_at || post.published_at || post.created_at,
    wordCount,
    timeRequired: `PT${readingTimeMin}M`,
    author: {
      '@type': 'Person',
      name: post.author_name || '카더라 데이터팀',
      jobTitle: post.author_role || '금융·부동산 데이터 분석',
      url: `${SITE}/about`,
      worksFor: { '@type': 'Organization', name: '카더라', url: SITE },
    },
    publisher: {
      '@type': 'Organization', name: '카더라', url: SITE,
      logo: { '@type': 'ImageObject', url: `${SITE}/icons/icon-192.png`, width: 192, height: 192 },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE}/blog/${slug}` },
    url: `${SITE}/blog/${slug}`,
    image: [
      {
        '@type': 'ImageObject',
        url: post.cover_image || `${SITE}/api/og?title=${encodeURIComponent(post.title)}&category=${post.category}&design=2`,
        width: 1200, height: 630,
        caption: post.image_alt || post.title,
      },
      {
        '@type': 'ImageObject',
        url: `${SITE}/api/og-square?title=${encodeURIComponent(post.title)}&category=${post.category}`,
        width: 630, height: 630,
      },
    ],
    thumbnailUrl: `${SITE}/api/og-square?title=${encodeURIComponent(post.title)}&category=${post.category}`,
    keywords: (post.tags ?? []).join(', '),
    inLanguage: 'ko-KR',
    isAccessibleForFree: true,
    articleSection: catSection[post.category] || '정보',
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['h1', '.blog-content p:first-of-type', '.blog-content h2:first-of-type'],
    },
    ...(comments.length > 0 ? {
      commentCount: comments.length,
      comment: comments.slice(0, 3).map((c: Record<string, any>) => ({
        '@type': 'Comment',
        text: c.content,
        dateCreated: c.created_at,
        author: { '@type': 'Person', name: c.author_name || c.profiles?.nickname || '사용자' },
      })),
    } : {}),
    interactionStatistic: {
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/ReadAction',
      userInteractionCount: post.view_count ?? 0,
    },
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE },
      { '@type': 'ListItem', position: 2, name: '블로그', item: `${SITE}/blog` },
      ...(post.category ? [{ '@type': 'ListItem', position: 3, name: catSection[post.category] || post.category, item: `${SITE}/blog?category=${post.category}` }] : []),
      { '@type': 'ListItem', position: post.category ? 4 : 3, name: post.title },
    ],
  };

  // 본문 전처리 (\\n 리터럴 등 정리) → 마크다운 → HTML → 후처리
  const cleanContent = sanitizeBlogContent(post.content);
  let htmlRaw = sanitizeHtml(marked(normalizeMarkdownHeadings(cleanContent)) as string);
  
  // ── HTML 후처리: 코드 노출 및 가독성 문제 수정 ──
  htmlRaw = htmlRaw
    // H태그 안에 남은 ** 제거
    .replace(/<(h[1-6])([^>]*)>\s*\*\*([^*]+)\*\*\s*<\/\1>/g, '<$1$2>$3</$1>')
    .replace(/(<h[1-6][^>]*>)(.*?)\*\*(.*?)\*\*(.*?)(<\/h[1-6]>)/g, '$1$2$3$4$5')
    // Q&A H2 → H3 다운그레이드 (HTML 레벨 — normalizeMarkdownHeadings 이후에도 처리)
    .replace(/<h2([^>]*)>(Q[.:]\s[^<]*)<\/h2>/g, '<h3$1>$2</h3>')
    .replace(/<h2([^>]*)>(A[.:]\s[^<]*)<\/h2>/g, '<h3$1>$2</h3>')
    // <del> 태그가 숫자 사이에 있으면 취소선 아닌 범위 표시로 복원
    .replace(/(\d+)<del>(\d+[^<]*)<\/del>/g, '$1~$2')
    // 빈 <p></p> 제거
    .replace(/<p>\s*<\/p>/g, '')
    // 연속 <br> 정리
    .replace(/(<br\s*\/?>){3,}/g, '<br><br>');
  
  htmlRaw = injectInternalLinks(htmlRaw);
  const htmlFull = enhanceBlogVisuals(htmlRaw, {
    excerpt: post.excerpt,
    coverImage: post.cover_image,
    imageAlt: post.image_alt,
    title: post.title,
    category: post.category,
    tags: post.tags,
  });
  const cutoff = Math.floor(htmlFull.length * 0.7);
  const htmlTruncated = htmlFull.slice(0, cutoff);
  const tossCutoff = Math.floor(htmlFull.length * 0.3);
  const htmlTossShort = htmlFull.slice(0, tossCutoff);

  // 목차 추출
  const toc = extractToc(htmlFull);

  // FAQ 파싱
  const faqItems = parseFaqFromContent(cleanContent);
  const isFaq = (post.tags ?? []).some((t: string) => t.toLowerCase().includes('faq') || t === '자주묻는질문');
  const showFaq = faqItems.length >= 1;  // 1개 이상이면 FAQ 스키마 출력 (JSON-LD 리치스니펫 극대화)
  const faqSchema = showFaq && faqItems.length > 0 ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqItems.map(f => ({
      '@type': 'Question', name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  } : null;

  const catColorMap: Record<string, string> = { stock: '#38BDF8', apt: '#2EE8A5', unsold: '#FF9F43', finance: '#B794FF', general: '#94A8C4' };
  const catColor = catColorMap[post.category] || '#94A8C4';

  return (
    <div className="blog-detail-layout">
      <div className="blog-detail-main">
      <ReadingProgress />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />}

      <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-lg)', flexWrap: 'wrap' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>
        <span>›</span>
        <Link href="/blog" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>블로그</Link>
        {post.category && <><span>›</span><Link href={`/blog?category=${post.category}`} style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>{{ stock: '주식', apt: '청약', unsold: '미분양', finance: '재테크', general: '생활' }[post.category] || post.category}</Link></>}
        <span>›</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{post.title.slice(0, 30)}</span>
      </nav>

      {/* 세션70: 상단 회원가입 유도 배너 */}
      <BlogTopBanner slug={slug} />

      <article style={{ paddingBottom: 40 }}>
        {/* ImageGallery JSON-LD (유지 — 포털 이미지 탭) */}
        {post.cover_image && (() => {
          const ogSquare = `${SITE}/api/og-square?title=${encodeURIComponent(post.title)}&category=${post.category}&author=${encodeURIComponent(post.author_name || '카더라')}`;
          return (
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
              '@context': 'https://schema.org', '@type': 'ImageGallery', name: `${post.title} 이미지`,
              image: [
                { '@type': 'ImageObject', url: post.cover_image.startsWith('/') ? `${SITE}${post.cover_image}` : post.cover_image, name: post.image_alt || post.title, width: 1200, height: 630, position: 1 },
                { '@type': 'ImageObject', url: ogSquare, name: `${post.title} — 카더라 블로그`, width: 630, height: 630, position: 2 },
              ],
            })}} />
          );
        })()}

        {/* 히어로 — 컴팩트 */}
        <div style={{ marginBottom: 14 }}>
          {/* 카테고리 + 메타 1줄 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: `${catColor}15`, color: catColor }}>
              {({ stock: '주식', apt: '청약', unsold: '미분양', finance: '재테크', general: '생활' } as Record<string, string>)[post.category] || post.category}
            </span>
            {(post.view_count ?? 0) >= 100 && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent-red)' }}>HOT</span>}
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {post.author_name || '카더라 데이터팀'} · <time dateTime={post.published_at || post.created_at || new Date().toISOString()}>{new Date(post.published_at || post.created_at || Date.now()).toLocaleDateString('ko-KR')}</time> · 📖 {readingTimeMin}분 · 👀 {post.view_count ?? 0}
              {post.rewritten_at && <span style={{ marginLeft: 4, padding: '0 4px', borderRadius: 3, background: 'var(--accent-green-bg)', color: 'var(--accent-green)', fontSize: 9, fontWeight: 700 }}>UP</span>}
            </span>
          </div>
          {/* 제목 */}
          <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.4, margin: 0, wordBreak: 'keep-all', letterSpacing: '-0.5px' }}>{post.title}</h1>
        </div>

        {/* 태그 — 컴팩트 인라인 */}
        {(post.tags ?? []).length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
            {(post.tags ?? []).map((t: string) => <Link key={t} href={`/blog?q=${encodeURIComponent(t)}`} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-hover)', color: 'var(--text-tertiary)', textDecoration: 'none', fontWeight: 500 }}>#{t}</Link>)}
          </div>
        )}

        {seriesInfo && (() => {
          const total = seriesInfo.posts.length;
          const currentIdx = seriesInfo.posts.findIndex((p: any) => p.id === post.id);
          const progress = total > 0 ? ((currentIdx + 1) / total) * 100 : 0;
          const isNearEnd = total > 1 && currentIdx >= Math.floor(total * 0.7);
          return (
            <div style={{
              marginBottom: 'var(--sp-md)', padding: 12, borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Link href={`/blog/series/${seriesInfo.series.slug}`} style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--brand)', textDecoration: 'none' }}>
                  📚 {seriesInfo.series.title}
                </Link>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                  {currentIdx + 1} / {total}편{isNearEnd && ' · 거의 다 읽었어요!'}
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--brand)', borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
            </div>
          );
        })()}

        {/* 목차 (모바일: 인라인, 데스크탑: 사이드바) */}
        <div className="blog-toc-inline">
          {toc.length >= 3 && <BlogToc toc={toc} />}
        </div>

        {/* 본문 — 봇: 전체, 로그인: TossGate, 비로그인: 3편 게이트 */}
        {isBot ? (
          <div className="blog-content" itemProp="articleBody" dangerouslySetInnerHTML={{ __html: htmlFull }} />
        ) : isLoggedIn ? (
          <BlogTossGate htmlFull={htmlFull} htmlShort={htmlTossShort} slug={slug} title={post.title} />
        ) : (
          <BlogReadGate htmlFull={htmlFull} htmlTruncated={htmlTruncated} slug={slug} category={post.category} />
        )}

        {/* FAQ 아코디언 */}
        {showFaq && <BlogFaqAccordion items={faqItems} />}

        {/* 세션70: 본문 중간 회원가입 유도 */}
        <BlogMidCTA slug={slug} category={post.category} />

        {/* 읽기 완료 메시지 — 로그인 사용자만 */}
        {isLoggedIn && (
        <div style={{
          textAlign: 'center', padding: '14px 12px', margin: '16px 0',
          background: 'linear-gradient(135deg, rgba(52,211,153,0.05), rgba(96,165,250,0.05))',
          borderRadius: 8, border: '1px dashed rgba(52,211,153,0.15)',
        }}>
          <span style={{ fontSize: 16, marginRight: 6 }}>🎉</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>약 {readingTimeMin}분 읽기 완료</span>
          {related.length > 0 && (
            <Link href={`/blog/${related[0].slug}`} style={{
              display: 'inline-block', marginLeft: 8, padding: '4px 12px', borderRadius: 4,
              background: 'var(--brand)', color: '#fff', fontSize: 11,
              fontWeight: 700, textDecoration: 'none',
            }}>
              다음 → {related[0].title?.slice(0, 25)}...
            </Link>
          )}
        </div>
        )}

        {/* 자동생성 콘텐츠 면책 & 출처 표기 (E-E-A-T) */}
        {post.source_type === 'auto' && (
          <div style={{ marginTop: 'var(--sp-2xl)', padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
            <span style={{ fontWeight: 600 }}>ℹ️ 자동 작성 콘텐츠</span> · 이 글은 카더라의 공공 데이터(국토교통부, 한국거래소 등)를 기반으로 자동 작성되었습니다. 
            {post.data_date && <> · 데이터 기준일: {post.data_date}</>}
            {post.source_ref && <> · 출처: {post.source_ref}</>}
            <br />정확한 투자·거래 판단은 공식 자료를 직접 확인해주세요.
          </div>
        )}

        {/* 동적 CTA */}
        {(() => {
          const ctaMap: Record<string, { href: string; icon: string; title: string; desc: string }> = {
            stock: { href: '/stock', icon: '📈', title: '실시간 주식 시세 보기', desc: '코스피·코스닥·해외 주식 시세를 확인하세요' },
            apt: { href: '/apt', icon: '🏢', title: '전국 청약 일정 확인', desc: '접수중·예정 청약 정보를 한눈에' },
            unsold: { href: '/apt?tab=unsold', icon: '🏚️', title: '미분양 현황 보기', desc: '전국 미분양 아파트를 확인하세요' },
            finance: { href: '/blog?category=finance', icon: '💰', title: '재테크 정보 더 보기', desc: '투자·재테크 블로그를 확인하세요' },
          };
          const cta = ctaMap[post.category];
          if (!cta) return null;
          return (
            <Link href={cta.href} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--sp-md)', padding: 16, marginBottom: 'var(--sp-lg)',
              background: 'linear-gradient(135deg, var(--bg-surface), var(--bg-hover))',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', textDecoration: 'none', color: 'inherit',
            }}>
              <span style={{ fontSize: 32, flexShrink: 0 }}>{cta.icon}</span>
              <div>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>{cta.title}</div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginTop: 2 }}>{cta.desc}</div>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 16, color: 'var(--text-tertiary)', flexShrink: 0 }}>→</span>
            </Link>
          );
        })()}

        {/* 관련 종목/현장은 하단 섹션에서만 렌더링 (중복 제거) */}

        {/* 공유 + 도움이됐어요 + 북마크 */}
        <div style={{
          borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 28,
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          background: 'linear-gradient(135deg, rgba(37,99,235,0.04) 0%, rgba(167,139,250,0.04) 100%)',
          margin: '28px -16px 0', padding: '16px 16px',
        }}>
          <ShareButtons title={post.title} postId={slug} content={post.excerpt || post.meta_description || undefined} />
          <div style={{ flex: 1 }} />
          <BlogActions blogPostId={post.id} initialHelpfulCount={post.helpful_count ?? 0} />
        </div>

        {/* 바이럴 CTA: 공유 유도 */}
        <div style={{
          margin: '0 -16px', padding: '20px 16px', borderRadius: '0 0 12px 12px',
          background: 'linear-gradient(135deg, rgba(59,123,246,0.06) 0%, rgba(46,232,165,0.04) 100%)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            이 글이 도움이 됐다면?
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
            주변에 공유하면 포인트 +5P 적립! 카카오톡·밴드로 바로 공유해보세요
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <ShareButtons title={`${post.title} — 카더라 블로그`} postId={slug} content={post.excerpt || post.meta_description || undefined} />
          </div>
        </div>
      </article>

      {/* 9. 다음글 플로팅 카드 (스크롤 60% 도달 시) */}
      {nextPost && <NextArticleFloat nextSlug={nextPost.slug} nextTitle={nextPost.title} category={post.category} />}

      {/* 세션70: 플로팅 가입 배너 */}
      <BlogFloatingCTA slug={slug} />

      {/* 프로 업셀 배너 — 결제 시스템 출시 전까지 비공개 */}
      {false && !isPremiumUser && (
      <div className="kd-card-glow" style={{ padding: '18px 16px', margin: '16px 0', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)' }}>
          <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-card)', background: 'linear-gradient(135deg, var(--brand), #2EE8A5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-md)', flexShrink: 0 }}>👑</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>AI가 분석한 종목 리포트 받아보세요</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>프로 멤버십 · 하루 830원</div>
          </div>
          <Link href="/shop" style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}>
            자세히
          </Link>
        </div>
      </div>
      )}

      {/* 댓글 섹션 */}
      <BlogCommentCTA commentCount={comments.length} />
      <div id="blog-comments" style={{ marginBottom: 'var(--sp-xl)' }}>
        <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>의견 {comments.length}개</h3>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
          {CTA_BY_CAT[post.category] ?? CTA_BY_CAT.general}
        </p>

        {/* 댓글 입력 */}
        {isLoggedIn ? (
          <BlogCommentInput blogPostId={post.id} />
        ) : (
          <div style={{ padding: 'var(--card-p) var(--sp-lg)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', textAlign: 'center', marginBottom: 'var(--sp-lg)', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
            <Link href={`/login?redirect=/blog/${slug}`} style={{ color: 'var(--brand)', fontWeight: 700, textDecoration: 'none' }}>로그인</Link>하면 의견을 남길 수 있어요
          </div>
        )}

        {/* 댓글 목록 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
          {comments.map((c: Record<string, any>) => {
            const nick = c.author_name || c.profiles?.nickname || '사용자';
            return (
              <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: getAvatarColor(nick), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-inverse)', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>
                  {nick[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{nick}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{timeAgo(c.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)', lineHeight: 1.5 }}>{c.content}</div>
                </div>
              </div>
            );
          })}
          {comments.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
              아직 의견이 없어요. 첫 의견을 남겨보세요!
            </div>
          )}
        </div>
      </div>

      {/* CTA 배너 — 비로그인만 */}
      {!isLoggedIn && (
      <div data-nudge="context-cta" style={{ padding: '20px 16px', margin: '20px 0', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)' }}>매일 업데이트되는 투자 정보를 받아보세요</div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-lg)' }}>청약 마감 알림 · 급등주 알림 · 미분양 업데이트</div>
        <Link href={`/login?redirect=/blog/${slug}`} style={{ display: 'inline-block', padding: '10px 32px', borderRadius: 'var(--radius-card)', background: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)', fontWeight: 700, fontSize: 'var(--fs-base)', textDecoration: 'none' }}>
          카카오로 3초 가입
        </Link>
      </div>
      )}

      {/* 시리즈 네비게이션 */}
      {seriesInfo && seriesInfo.posts.length > 1 && (() => {
        const idx = seriesInfo.posts.findIndex((p: Record<string, any>) => p.id === post.id);
        const prev = idx > 0 ? seriesInfo.posts[idx - 1] : null;
        const next = idx < seriesInfo.posts.length - 1 ? seriesInfo.posts[idx + 1] : null;
        return (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 16, marginBottom: 'var(--sp-xl)' }}>
            <Link href={`/blog/series/${seriesInfo.series.slug}`} style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', marginBottom: 10 }}>
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' }}>📚 시리즈</span>
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{seriesInfo.series.title}</span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{idx + 1}/{seriesInfo.posts.length}</span>
            </Link>
            <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
              {prev && (
                <Link href={`/blog/${prev.slug}`} style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', textDecoration: 'none', fontSize: 'var(--fs-xs)' }}>
                  <div style={{ color: 'var(--text-tertiary)', marginBottom: 2 }}>← 이전</div>
                  <div style={{ color: 'var(--text-secondary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prev.title}</div>
                </Link>
              )}
              {next && (
                <Link href={`/blog/${next.slug}`} style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', textDecoration: 'none', fontSize: 'var(--fs-xs)', textAlign: 'right' }}>
                  <div style={{ color: 'var(--text-tertiary)', marginBottom: 2 }}>다음 →</div>
                  <div style={{ color: 'var(--text-secondary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{next.title}</div>
                </Link>
              )}
            </div>
          </div>
        );
      })()}

      {/* 이전/다음글 네비게이션 (시리즈가 없는 글) */}
      {!post.series_id && (prevPost || nextPost) && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 16, marginBottom: 'var(--sp-xl)' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
            {prevPost && (
              <Link href={`/blog/${prevPost.slug}`} style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', textDecoration: 'none', fontSize: 'var(--fs-xs)' }}>
                <div style={{ color: 'var(--text-tertiary)', marginBottom: 2 }}>← 이전글</div>
                <div style={{ color: 'var(--text-secondary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prevPost.title}</div>
              </Link>
            )}
            {nextPost && (
              <Link href={`/blog/${nextPost.slug}`} style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', textDecoration: 'none', fontSize: 'var(--fs-xs)', textAlign: 'right' }}>
                <div style={{ color: 'var(--text-tertiary)', marginBottom: 2 }}>다음글 →</div>
                <div style={{ color: 'var(--text-secondary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nextPost.title}</div>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* 관련 글 */}
      {(related ?? []).length > 0 && (
        <div style={{ marginBottom: 'var(--sp-xl)' }}>
          <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, margin: '0 0 10px' }}>📚 관련 글</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--sp-sm)' }}>
            {related!.slice(0, 4).map((r: any) => (
              <Link key={r.slug} href={`/blog/${r.slug}`} className="kd-feed-card" style={{ display: 'block', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', textDecoration: 'none', transition: 'border-color var(--transition-fast)' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', lineHeight: 1.4 }}>{r.title}</span>
                <div style={{ display: 'flex', gap: 'var(--sp-sm)', marginTop: 6, fontSize: 10, color: 'var(--text-tertiary)' }}>
                  {r.view_count > 0 && <span>👀 {r.view_count.toLocaleString()}</span>}
                  <span>{r.category === 'stock' ? '📈' : r.category === 'apt' ? '🏠' : '📝'}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 관련 부동산 현장 (내부 링크 SEO) */}
      {relatedSites.length > 0 && (
        <div style={{ marginBottom: 'var(--sp-xl)' }}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>🏢 관련 현장 정보</div>
          <div style={{ display: 'flex', gap: 'var(--sp-sm)', flexWrap: 'wrap' }}>
            {relatedSites.map((s: Record<string, any>) => (
              <Link key={s.slug} href={`/apt/${s.slug}`} style={{ flex: '1 1 calc(33.3% - 6px)', minWidth: 140, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', textDecoration: 'none', transition: 'border-color var(--transition-fast)' }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{s.region} {s.sigungu || ''}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 관련 종목 (내부 링크 SEO) */}
      {relatedStocks.length > 0 && (
        <div style={{ marginBottom: 'var(--sp-xl)' }}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>📈 관련 종목</div>
          <div style={{ display: 'flex', gap: 'var(--sp-sm)', flexWrap: 'wrap' }}>
            {relatedStocks.map((s: Record<string, any>) => {
              const pct = Number(s.change_pct);
              const isUp = pct > 0;
              return (
                <Link key={s.symbol} href={`/stock/${s.symbol}`} style={{ flex: '1 1 calc(33.3% - 6px)', minWidth: 140, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', textDecoration: 'none' }}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: isUp ? 'var(--accent-red)' : 'var(--accent-blue)', marginTop: 2 }}>
                    {s.currency === 'USD' ? '$' : '₩'}{Number(s.price).toLocaleString()} {isUp ? '▲' : '▼'}{Math.abs(pct).toFixed(2)}%
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
