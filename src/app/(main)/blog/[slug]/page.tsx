import { BlogViewTracker } from '@/components/ViewTracker';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { cache } from 'react';
import { marked } from 'marked';
import { safeImg } from '@/lib/image-sanitize';
import { injectInternalLinks } from '@/lib/blog-auto-link';
import BlogCommentInput from '@/components/BlogCommentInput';
import BlogCommentCTA from '@/components/BlogCommentCTA';
import LoginGate from '@/components/LoginGate';
// C3: BlogFloatingBar 제거 (1,031v / 0c)
import ShareButtons from '@/components/ShareButtons';
import KakaoShareButton from '@/components/KakaoShareButton';
import BlogFaqAccordion from '@/components/BlogFaqAccordion';
import BlogToc from '@/components/BlogToc';
import BlogActions from '@/components/BlogActions';
import BlogBookmarkButton from '@/components/BlogBookmarkButton';
import BlogServiceWidget from '@/components/BlogServiceWidget';
import { getAvatarColor } from '@/lib/avatar';
import { parseFaqFromContent } from '@/lib/blog-faq-parser';
import { timeAgo } from '@/lib/format';

export const maxDuration = 30;
// s174: revalidate(ISR) + headers()/cookies() 동시 사용 시 Next.js 15 의 DYNAMIC_SERVER_USAGE
// 충돌 → 전체 페이지 500. force-dynamic 으로 전환 (ISR 손실 대신 안정성).
// 향후 headers/cookies 호출을 분리하면 ISR 복원 가능.
export const dynamic = 'force-dynamic';
import { SITE_URL as SITE } from '@/lib/constants';
import { enhanceBlogVisuals } from '@/lib/blog-visual-enhancer';
import ReadingProgress from '@/components/ReadingProgress';
// BlogSidebar removed — TOC inline + tools/metrics below article
import BlogMetricCards from '@/components/BlogMetricCards';
import BlogHeroImage from '@/components/BlogHeroImage';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import NextArticleFloat from '@/components/NextArticleFloat';
import BlogTossGate from '@/components/BlogTossGate';
import RelatedContentCard from '@/components/RelatedContentCard';
import BlogMentionCard from '@/components/blog/BlogMentionCard';
import BlogHeroExtras from '@/components/blog/BlogHeroExtras';
import BlogGatedRenderer from '@/components/blog/BlogGatedRenderer';
import BlogEndCTA from '@/components/blog/BlogEndCTA';
import BlogEarlyGateTeaser from '@/components/blog/BlogEarlyGateTeaser';
import SignupPopupModal from '@/components/signup/SignupPopupModal';
import RelatedBlogsSection from '@/components/blog/RelatedBlogsSection';
import BlogSocialBar from '@/components/blog/BlogSocialBar';
import BlogFooterMeta from '@/components/blog/BlogFooterMeta';
import BlogImageCarousel from '@/components/blog/BlogImageCarousel';
import BlogMidGate from '@/components/blog/BlogMidGate';
// SmartSectionGate 제거 → LoginGate 기능 게이팅으로 전환 (세션 108)
import BlogAptAlertCTA from '@/components/BlogAptAlertCTA';
import YMYLBanner from '@/components/YMYLBanner';
import BigEventCharts from '@/components/blog/BigEventCharts';
// NewsletterSubscribe 삭제 — 카카오 CTA로 통합

// marked heading에 id 자동 부여 (TOC 앵커용)
const slugify = (text: string) => text.replace(/<[^>]+>/g, '').replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();

const renderer = new marked.Renderer();
renderer.heading = function ({ text, depth }: { text: string; depth: number }) {
  const id = slugify(text);
  return `<h${depth} id="${id}">${text}</h${depth}>\n`;
};
renderer.image = function ({ href, title, text }: { href: string; title?: string | null; text: string }) {
  const httpsHref = href?.replace(/^http:\/\//, 'https://') || '';
  // 세션 140 P1: 본문 마크다운 이미지도 화이트리스트 sanitize — 오염 소스는 /api/og 로 치환
  const sanitized = safeImg(httpsHref, { title: text || '카더라', category: 'blog', design: 2 });
  // [L1-8] 네이버 CDN(pstatic/phinf) 이미지는 srcset 변환 시 네이버 이미지 탭 우대 손실 → unoptimized 유지
  const isNaverCdn = /(pstatic\.net|phinf\.pstatic\.net|phinf\.naver\.net|naver-cdn)/i.test(sanitized);
  const sizesAttr = isNaverCdn ? '' : ` sizes="(max-width: 640px) 100vw, 800px"`;
  // 세션 151: height:auto 제거 — aspect-ratio 고정으로 CLS 방지
  return `<img src="${sanitized}" alt="${text || ''}" ${title ? `title="${title}"` : ''} width="800" height="450" loading="lazy" decoding="async"${sizesAttr} style="width:100%;max-width:800px;aspect-ratio:800/450;object-fit:cover;border-radius:8px" onerror="this.style.display='none'" />`;
};
renderer.link = function ({ href, title, text }: { href: string; title?: string | null; text: string }) {
  // 세션 157 G: kadeora.app 내부 링크는 nofollow 제외 (PageRank 내부 흐름 유지)
  const isExternal = href
    && (href.startsWith('http://') || href.startsWith('https://'))
    && !href.startsWith('https://kadeora.app')
    && !href.startsWith('http://kadeora.app');
  const titleAttr = title ? ` title="${title}"` : '';
  if (isExternal) {
    return `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow"${titleAttr} style="color:var(--brand);text-decoration:underline;text-underline-offset:2px">${text}</a>`;
  }
  return `<a href="${href}"${titleAttr} style="color:var(--brand);text-decoration:none">${text}</a>`;
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
  let out = raw
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    // ── 중복 H1 제거 (페이지 타이틀이 이미 H1) ──
    .replace(/^# [^\n]+\n+/, '')
    // ── 구조 개선 ──
    .replace(/^## 목차\s*$/gm, '')
    .replace(/^\d+\.\s+\S+\s+\d+\.\s+\S+\s+\d+\.\s+\S+.*$/gm, '')
    // ── 코드 노출 방지 ──
    .replace(/^(#{1,6}\s+.*?)\*\*([^*\n]+)\*\*(.*?)$/gm, '$1$2$3')
    // 숫자~숫자 패턴 — ~가 취소선으로 변환되는 것 방지
    .replace(/(\d)~(\d)/g, '$1～$2')
    // Q. / Q: 로 시작하는 ## → ### 로 다운그레이드
    .replace(/^## (Q[.:])/gm, '### $1')
    .replace(/^## (A[.:])/gm, '### $1')
    .replace(/^\*\*(Q[.:]\s)/gm, '**$1');

  // ── H2 과다 제어: 8개 초과 시 이후 ## → ### 다운그레이드 ──
  let h2Count = 0;
  out = out.replace(/^## /gm, () => {
    h2Count++;
    return h2Count > 8 ? '### ' : '## ';
  });

  // ── Mixed Content 방지: markdown 이미지 http→https ──
  out = out.replace(/!\[([^\]]*)\]\(http:\/\//g, '![$1](https://');
  out = out.replace(/src="http:\/\//g, 'src="https://');
  out = out.replace(/src='http:\/\//g, "src='https://");

  return out;
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
 * [L1-5] 킬러 URL static pin
 *
 * 빌드 타임 3개 쿼리 병렬 → 합집합 60편 고정:
 * - view_count DESC top 30
 * - published_at DESC top 15 (최신 이슈 보장)
 * - PINNED_SLUGS 10개 (도메인 유입 78% 글 포함)
 *
 * 결과: 킬러 URL은 빌드 산출물로 생성 → Vercel 504 timeout 원천 차단.
 */
const PINNED_SLUGS = [
  '레이카운티-무순위-청약-재분양-총정리-2026',
  '두산위브-트리니뷰-구명역-분양-총정리-2026',
  'guide-tax-regulated-area-2026',
  'apt-trade-이펜하우스3단지-서울-2026',
];

export const dynamicParams = true; // s168: 빌드타임 DB 호출 제거, 요청 시 ISR 생성

// s168: 빌드 단계 DB 호출 제거. 원래 로직은 조회수 TOP 30 + 최신 15 + 핀 슬러그 합쳐 최대 60건 프리렌더.
// ISR on-demand 로 첫 요청 시 생성+캐시. PINNED_SLUGS 는 sitemap/내부 링크에서 참조 유지.
export async function generateStaticParams() {
  return [];
}

/**
 * [L1-1] blog_posts 단일 row fetch를 generateMetadata와 BlogDetailPage 간 공유.
 * React cache() — 같은 요청 라이프사이클 내에서 중복 쿼리 제거.
 */
const getPostBySlug = cache(async (slug: string) => {
  const sb = await createSupabaseServer();
  const { data } = await (sb as any).from('blog_posts')
    .select('id,title,slug,content,excerpt,category,sub_category,cover_image,image_alt,tags,meta_description,meta_keywords,author_name,author_role,reading_time_min,view_count,comment_count,helpful_count,published_at,created_at,updated_at,series_id,series_order,source_type,source_ref,data_date,rewritten_at,tldr,key_points,gated_sections,has_gated_content,reading_minutes')
    .eq('slug', slug).eq('is_published', true).maybeSingle();
  return data;
});

export async function generateMetadata({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const post = await getPostBySlug(slug);
  if (!post) return {};
    const ogImage = post.cover_image || `${SITE}/api/og?title=${encodeURIComponent(post.title)}&category=${post.category}&author=${encodeURIComponent(post.author_name || '카더라')}&design=2`;
    const ogSquare = `${SITE}/api/og-square?title=${encodeURIComponent(post.title)}&category=${post.category}&author=${encodeURIComponent(post.author_name || '카더라')}`;
    // 네이버/구글 통일 설명문 (meta_description > excerpt > title)
    const desc = (post.meta_description && post.meta_description.length >= 30)
      ? post.meta_description
      : (post.excerpt && post.excerpt.length >= 30)
        ? post.excerpt
        : post.title;
    const descClean = desc.replace(/[\n\r#*_|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    const brandSuffix = post.category === 'stock' ? '카더라 주식' : post.category === 'apt' ? '카더라 부동산' : post.category === 'unsold' ? '카더라 부동산' : '카더라';
  // 세션 146 C4: metadata.noindex=true 이면 robots meta 반영 (얇은 콘텐츠)
  const isNoindex = post.metadata && typeof post.metadata === 'object' && (post.metadata as any).noindex === true;
  // 세션 157 B: URL cannibalization 해소 — apt-trade-*, {code}-kos(pi|daq)- 블로그는 canonical 원본 페이지로
  // s174: 한글 slug 정규화 — encodeURIComponent 로 canonical URL 통일 (네이버/구글 크롤러 호환)
  let canonical = `${SITE}/blog/${encodeURIComponent(slug)}`;
  const stockSlugMatch = slug.match(/^(\d{6})-kos(pi|daq)-/);
  if (stockSlugMatch) {
    canonical = `${SITE}/stock/${stockSlugMatch[1]}`;
  } else if (slug.startsWith('apt-trade-') && post.tags && Array.isArray(post.tags) && post.tags[0]) {
    canonical = `${SITE}/apt/complex/${encodeURIComponent(post.tags[0])}`;
  }
  return {
    title: { absolute: `${post.title} | ${brandSuffix}` },
    description: descClean,
    keywords: post.meta_keywords || (post.tags ?? []).join(', '),
    alternates: { canonical },
    ...(isNoindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: post.title, description: descClean, type: 'article',
      siteName: '카더라', locale: 'ko_KR',
      publishedTime: post.published_at || post.created_at,
      modifiedTime: post.updated_at || post.rewritten_at || post.published_at || post.created_at,
      authors: [post.author_name || '카더라'],
      tags: post.tags ?? [],
      section: post.category === 'stock' ? '주식' : post.category === 'apt' ? '부동산' : post.category === 'unsold' ? '미분양' : '재테크',
      url: `${SITE}/blog/${slug}`,
      images: [
        { url: ogImage, width: 1200, height: 630, alt: post.image_alt || descClean || post.title },
        { url: ogSquare, width: 630, height: 630, alt: post.image_alt || descClean || post.title },
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
        'naver:written_time': post.rewritten_at || post.published_at || post.created_at,
        'naver:updated_time': post.rewritten_at || post.updated_at || post.published_at || post.created_at,
        'naver:author': post.author_name || '카더라',
        'naver:description': descClean,
        'dg:plink': `${SITE}/blog/${slug}`,
        'article:section': section,
        'robots': 'max-image-preview:large, max-snippet:-1, max-video-preview:-1',
        'article:tag': [section, ...(post.tags ?? []).slice(0, 8), post.category === 'stock' ? '주가,배당금,실적,전망' : post.category === 'apt' ? '실거래가,시세,청약,분양가' : '투자,재테크'].filter(Boolean).join(','),
        'article:published_time': post.published_at || post.created_at,
        'article:modified_time': post.updated_at || post.published_at || post.created_at,
        'article:author': post.author_name || '카더라',
      };
    })(),
  };
}

export default async function BlogDetailPage({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const sb = await createSupabaseServer();

  const post = await getPostBySlug(slug);
  if (!post) return notFound();

  // 뷰카운트 atomic 증가 — RPC로 race condition 방지
  // view count moved to client-side API call (ViewTracker component)

  let isLoggedIn = false;
  let isPremiumUser = false;
  try {
    const { data: { user } } = await sb.auth.getUser();
    isLoggedIn = !!user;
    if (user) {
      const { data: prof } = await sb.from('profiles').select('is_premium, premium_expires_at').eq('id', user.id).maybeSingle();
      isPremiumUser = !!(prof?.is_premium && prof?.premium_expires_at && new Date(prof.premium_expires_at) > new Date());
    }
  } catch { /* 비로그인/만료 세션 */ }

  // [BIG-EVENT-CHARTS] 이 글이 big_event_registry Pillar/Spoke에 연결되었는지 조회
  let bigEventId: number | null = null;
  try {
    const { data: be } = await (sb as any)
      .from('big_event_registry')
      .select('id')
      .or(`pillar_blog_post_id.eq.${post.id},spoke_blog_post_ids.cs.{${post.id}}`)
      .limit(1)
      .maybeSingle();
    if (be?.id) bigEventId = be.id;
  } catch {}

  // 봇 감지 — SEO 크롤러에게는 전체 본문 제공
  const headersList = await headers();
  const ua = headersList.get('user-agent') || '';
  const isBot = /googlebot|bingbot|yandex|baiduspider|yeti|naverbot|daumoa|daumcrawler|slurp|msnbot|ahrefsbot|semrushbot|dotbot|petalbot|facebot|twitterbot|linkedinbot|kakaotalk-scrap|applebot|seznambot/i.test(ua);

  // CTA 소셜프루프 데이터
  let userCount = 66;
  let todaySignups = 0;
  if (!isBot && !isLoggedIn) {
    try {
      const { count: uc } = await sb.from("profiles").select("id", { count: "exact", head: true }).eq("is_seed", false);
      userCount = uc ?? 66;
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const { count: ts } = await sb.from("profiles").select("id", { count: "exact", head: true }).eq("is_seed", false).gte("created_at", todayStart.toISOString());
      todaySignups = ts ?? 0;
    } catch {}
  }

  // [L1-1] 관련 글 추천 — 단일 RPC로 3단 폴백 통합 (precomputed → tag → category)
  let related: Record<string, any>[] = [];
  try {
    const { data: rpcRelated } = await (sb as any).rpc('get_related_posts', {
      p_post_id: post.id,
      p_category: post.category,
      p_tags: post.tags || [],
      p_limit: 5,
    });
    if (Array.isArray(rpcRelated)) {
      related = rpcRelated.map((r: any) => ({
        slug: r.r_slug,
        title: r.r_title,
        view_count: r.r_view_count,
        category: post.category,
      }));
    }
  } catch { }

  // 시리즈 정보
  let seriesInfo: { series: any; posts: Record<string, any>[] } | null = null;
  if (post.series_id) {
    try {
      const { data: series } = await sb.from('blog_series').select('id,title,slug,description,cover_image,post_count').eq('id', post.series_id).maybeSingle();
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
      .select('id, content, created_at, author_id, author_name, is_seed, image_url, profiles!blog_comments_author_id_fkey(nickname)')
      .eq('blog_post_id', post.id).order('created_at', { ascending: true });
    comments = data ?? [];
  } catch {}

  // [L1-1] 사이드바 bundle — 단일 RPC로 apt_complex_profiles + prev/next + related_sites/stocks 통합
  let relatedSites: Record<string, any>[] = [];
  let relatedStocks: Record<string, any>[] = [];
  let bundleComplex: any = null;
  let bundlePrev: { slug: string; title: string } | null = null;
  let bundleNext: { slug: string; title: string } | null = null;
  try {
    const { data: bundle } = await (sb as any).rpc('get_blog_sidebar_bundle', {
      p_post_id: post.id,
      p_category: post.category,
      p_tags: post.tags || [],
      p_published_at: post.published_at || post.created_at,
    });
    if (bundle && typeof bundle === 'object') {
      bundleComplex = (bundle as any).complex || null;
      bundlePrev = (bundle as any).prev || null;
      bundleNext = (bundle as any).next || null;
      relatedSites = Array.isArray((bundle as any).related_sites) ? (bundle as any).related_sites : [];
      relatedStocks = Array.isArray((bundle as any).related_stocks) ? (bundle as any).related_stocks : [];
    }
  } catch {}

  // 블로그 인라인 이미지 (blog_post_images 테이블)
  let postImages: { image_url: string; alt_text: string; caption: string | null; image_type: string; position: number }[] = [];
  try {
    const { data: imgs } = await (sb as any).from('blog_post_images').select('image_url, alt_text, caption, image_type, position').eq('post_id', post.id).order('position');
    postImages = imgs || [];
  } catch {}

  // 세션 135: dedup된 갤러리 이미지 (get_blog_images_dedup RPC — 중복 URL 자동 제거)
  let galleryImages: { image_url: string; caption: string | null; alt_text: string | null }[] = [];
  try {
    const { data: gallery } = await (sb as any).rpc('get_blog_images_dedup', { p_post_id: post.id });
    if (Array.isArray(gallery)) {
      galleryImages = gallery
        .filter((g: any) => g?.image_url)
        .map((g: any) => ({
          image_url: g.image_url,
          caption: g.caption ?? null,
          alt_text: g.alt_text ?? null,
        }));
    }
  } catch {}

  // 동적 apt_sites 이미지 폴백: pos0이 Unsplash면 apt_sites 현장사진으로 대체
  if (post.category === 'apt' && postImages.length > 0 && postImages[0]?.image_url?.includes('unsplash')) {
    try {
      // 제목에서 현장명 추출 시도 (첫 단어~공백/구분자 앞)
      const titlePart = post.title.split(/[—|\s]/)[0]?.trim();
      if (titlePart && titlePart.length >= 3) {
        const { data: sites } = await (sb as any)
          .from('apt_sites')
          .select('name, images')
          .not('images', 'is', null)
          .ilike('name', `%${titlePart.slice(0, 15)}%`)
          .limit(5);
        if (sites) {
          const match = (sites as any[])
            .filter((s: any) => s.images?.length > 0 && s.name?.length >= 3 && post.title.includes(s.name))
            .sort((a: any, b: any) => (b.name?.length || 0) - (a.name?.length || 0))[0];
          if (match?.images?.[0]?.url) {
            const siteUrl = (match.images[0].url as string).replace(/^http:\/\//, 'https://');
            postImages[0] = {
              ...postImages[0],
              image_url: siteUrl,
              alt_text: `${match.name} 현장 사진 — ${match.images[0].caption || post.title}`,
              image_type: 'site_photo',
              caption: '출처: 네이버 뉴스',
            };
          }
        }
      }
    } catch {}
  }

  // [L1-1] 이전/다음글은 get_blog_sidebar_bundle에 통합됨 (series_id 없을 때만)
  const prevPost: { slug: string; title: string } | null = post.series_id ? null : bundlePrev;
  const nextPost: { slug: string; title: string } | null = post.series_id ? null : bundleNext;

  const wordCount = post.content.replace(/[#*|\-\n\r\[\]`>]/g, '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
  const readingTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  // 사이드바용 데이터: 단지 프로필 메트릭 (apt 카테고리)
  let sidebarMetrics: { label: string; value: string }[] = [];
  let sidebarRelatedLinks: { title: string; href: string }[] = [];
  try {
    if ((post.category === 'apt' || post.category === 'unsold') && post.tags?.length) {
      const aptName = post.tags[0];
      const cp = bundleComplex; // [L1-1] bundle에서 이미 fetch됨
      if (cp) {
        if (cp.avg_sale_price_pyeong) sidebarMetrics.push({ label: '평당가', value: `${cp.avg_sale_price_pyeong.toLocaleString()}만원` });
        if (cp.jeonse_ratio) sidebarMetrics.push({ label: '전세가율', value: `${cp.jeonse_ratio}%` });
        if (cp.total_households) sidebarMetrics.push({ label: '세대수', value: `${cp.total_households.toLocaleString()}세대` });
        if (cp.built_year) sidebarMetrics.push({ label: '연식', value: `${new Date().getFullYear() - cp.built_year}년차` });
        if (cp.price_change_1y !== null && cp.price_change_1y !== undefined) sidebarMetrics.push({ label: '1년 변동', value: `${cp.price_change_1y > 0 ? '+' : ''}${cp.price_change_1y}%` });
        // 단지백과 + 시군구 허브 내부 링크 (SEO 크로스링크)
        sidebarRelatedLinks.push({ title: `${aptName} 단지백과`, href: `/apt/complex/${encodeURIComponent(aptName)}` });
        if (cp.region_nm && cp.sigungu) sidebarRelatedLinks.push({ title: `${cp.sigungu} 아파트 시세`, href: `/apt/area/${encodeURIComponent(cp.region_nm)}/${encodeURIComponent(cp.sigungu)}` });
      }
    }
    if (post.category === 'stock' && relatedStocks.length > 0) {
      relatedStocks.forEach((s: any) => {
        sidebarRelatedLinks.push({ title: `${s.name} (${s.symbol})`, href: `/stock/${s.symbol}` });
      });
    }
    if (relatedSites.length > 0) {
      relatedSites.forEach((s: any) => {
        sidebarRelatedLinks.push({ title: s.name, href: `/apt/${s.slug}` });
      });
    }
  } catch {}

  const catSection: Record<string, string> = { stock: '주식', apt: '부동산', unsold: '미분양', finance: '재테크', general: '생활' };

  const descClean = ((post.meta_description && post.meta_description.length >= 30)
    ? post.meta_description
    : (post.excerpt && post.excerpt.length >= 20 ? post.excerpt : post.title)
  ).replace(/[\n\r#*_|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);

  const isNewsArticle = post.source_type === 'auto_issue' || post.source_type === 'news_rss' || post.source_type === 'upcoming';
  
  // B-1: 본문 내 실제 이미지 URL 추출 (텍스트 없는 사진 → 네이버 이미지 캐러셀 우대)
  const contentImages = (post.content || '').match(/!\[([^\]]*)\]\(([^)]+)\)/g)
    ?.map((m: string) => { const match = m.match(/!\[([^\]]*)\]\(([^)]+)\)/); return match ? { alt: match[1], url: match[2] } : null; })
    .filter((img: any): img is { alt: string; url: string } => !!img && !img.url.includes('/api/og'))
    .slice(0, 3) || [];

  const jsonLd = {
    '@context': 'https://schema.org', '@type': isNewsArticle ? 'NewsArticle' : 'BlogPosting',
    headline: post.title,
    description: ((post.meta_description && post.meta_description.length >= 30) ? post.meta_description : (post.excerpt && post.excerpt.length >= 30) ? post.excerpt : post.title).replace(/[\n\r#*_|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160),
    datePublished: post.published_at || post.created_at,
    dateModified: post.updated_at || post.published_at || post.created_at,
    wordCount,
    timeRequired: `PT${readingTimeMin}M`,
    author: {
      '@type': 'Organization',
      name: post.author_name || '카더라',
      description: post.author_role || '부동산·주식 데이터 분석팀',
      url: `${SITE}/about/authors`,
      parentOrganization: { '@type': 'Organization', name: '카더라', url: SITE },
    },
    publisher: {
      '@type': 'Organization', name: '카더라', url: SITE,
      logo: { '@type': 'ImageObject', url: `${SITE}/icons/icon-192.png`, width: 192, height: 192 },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE}/blog/${slug}` },
    isPartOf: { '@type': 'WebSite', name: '카더라', url: SITE },
    url: `${SITE}/blog/${slug}`,
    image: [
      // 실제 본문 이미지 (텍스트 없는 사진 → 네이버 이미지 캐러셀 우대)
      ...contentImages.map((img: { url: string; alt: string }) => ({
        '@type': 'ImageObject' as const,
        url: img.url,
        caption: img.alt || post.title,
      })),
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
    articleSection: catSection[post.category] || '정보',
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['h1', '.blog-content p:first-of-type', '.blog-content h2:first-of-type', '.blog-content h2', '.faq-answer'],
    },
    ...((() => {
      const realComments = comments.filter((c: Record<string, any>) => !c.is_seed);
      if (realComments.length === 0) return {};
      return {
        commentCount: realComments.length,
        comment: realComments.slice(0, 3).map((c: Record<string, any>) => ({
          '@type': 'Comment',
          text: c.content,
          dateCreated: c.created_at,
          author: { '@type': 'Person', name: c.author_name || c.profiles?.nickname || '사용자' },
        })),
      };
    })()),
    interactionStatistic: {
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/ReadAction',
      userInteractionCount: post.view_count ?? 0,
    },
    // 비로그인 사용자에게 본문 55%만 표시 → Google 구조화데이터 가이드라인 준수
    isAccessibleForFree: isLoggedIn || isBot,
    ...(!isLoggedIn && !isBot ? {
      hasPart: {
        '@type': 'WebPageElement',
        isAccessibleForFree: false,
        cssSelector: '.kadeora-paywall',
      },
    } : {}),
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
    .replace(/(<br\s*\/?>){3,}/g, '<br><br>')
    // ── 다크모드 보호: 인라인 color/background-color 제거 ──
    // AI 생성 콘텐츠에 style="color:#333" 같은 하드코딩 색상이 포함되면
    // 다크모드(#050A18 배경)에서 텍스트가 보이지 않음
    .replace(/\bcolor\s*:\s*#[0-9a-fA-F]{3,8}\s*;?/gi, '')
    .replace(/\bcolor\s*:\s*(black|white|gray|grey|rgb\([^)]*\))\s*;?/gi, '')
    .replace(/\bbackground-color\s*:\s*#[0-9a-fA-F]{3,8}\s*;?/gi, '')
    .replace(/\bbackground-color\s*:\s*(white|black|gray|grey|rgb\([^)]*\))\s*;?/gi, '')
    // style="" 빈 속성 정리
    .replace(/\sstyle\s*=\s*"[\s;]*"/gi, '');
  
  // B-4: 빈/일반적인 alt 텍스트 개선 (네이버 이미지 검색 인덱싱 강화)
  const catLabel = post.category === 'stock' ? '주식' : post.category === 'apt' ? '부동산' : post.category === 'unsold' ? '미분양' : '재테크';
  htmlRaw = htmlRaw.replace(
    /<img([^>]*?)alt="(이미지|image|사진|그림|photo|picture|)"([^>]*?)>/gi,
    (_, before, _alt, after) => `<img${before}alt="${post.title} — ${catLabel} 관련 이미지"${after}>`
  );

  htmlRaw = injectInternalLinks(htmlRaw);
  let htmlFull = enhanceBlogVisuals(htmlRaw, {
    excerpt: post.excerpt,
    coverImage: post.cover_image,
    imageAlt: post.image_alt,
    title: post.title,
    category: post.category,
    tags: post.tags,
  });

  // 비로그인 유저: 본문 상단(첫 H2 뒤)에 청약/종목 알림 CTA 주입
  const alertCtaHtml = (() => {
    if (isBot || isLoggedIn) return '';
    const isApt = post.category === 'apt';
    const isStock = post.category === 'stock' || post.category === 'finance';
    if (!isApt && !isStock) return '';
    const icon = isApt ? '🔔' : '📊';
    const title = isApt ? '청약 공고 알림 받기' : '관심 종목 알림 받기';
    const desc = isApt
      ? '무순위·줍줍·재분양 공고가 나오면 바로 알림을 드려요. 관심 지역만 골라서 받을 수 있어요.'
      : '관심 종목의 급등·실적·공시 소식을 바로 받아보세요. 매일 아침 AI 브리핑도 무료.';
    const tags = isApt ? ['무순위', '줍줍', '재분양'] : ['급등', '공시', '실적'];
    const src = 'blog_inline_cta';
    const loginUrl = `/login?redirect=${encodeURIComponent(`/blog/${slug}`)}&source=${src}`;
    return `<div style="margin:20px 0;padding:20px;border-radius:12px;background:linear-gradient(135deg,rgba(20,32,56,0.98),rgba(10,18,34,0.99));border:1px solid rgba(59,123,246,0.2);position:relative;overflow:hidden">` +
      `<div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,${isApt ? '#3b7bf6,#22c55e' : '#3b7bf6,#a78bfa'})"></div>` +
      `<div style="position:absolute;top:14px;right:14px;font-size:10px;padding:2px 8px;border-radius:4px;background:rgba(34,197,94,0.12);color:#22c55e;font-weight:600">무료</div>` +
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">` +
        `<div style="width:32px;height:32px;border-radius:8px;background:rgba(59,123,246,0.12);display:flex;align-items:center;justify-content:center;font-size:15px">${icon}</div>` +
        `<div style="font-size:15px;font-weight:600;color:#e8e6e3">${title}</div>` +
      `</div>` +
      `<div style="font-size:13px;color:#8b95a5;line-height:1.5;margin-bottom:12px">${desc}</div>` +
      `<div style="display:flex;gap:5px;margin-bottom:14px;flex-wrap:wrap">` +
        tags.map(t => `<span style="font-size:11px;padding:3px 7px;border-radius:4px;background:rgba(59,123,246,0.08);color:#6da0f0;border:0.5px solid rgba(59,123,246,0.15)">${t}</span>`).join('') +
      `</div>` +
      `<a href="${loginUrl}" onclick="try{fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event_type:'cta_click',cta_name:'blog_inline_cta',page_path:location.pathname,visitor_id:localStorage.getItem('kd_visitor_id')}),keepalive:true})}catch(e){}" style="display:block;width:100%;padding:10px;border-radius:8px;background:#3b7bf6;color:#fff;font-size:13px;font-weight:500;text-decoration:none;text-align:center;box-sizing:border-box">카카오로 3초 만에 시작하기</a>` +
    `</div>`;
  })();

  // 첫 H2 "앞"에 CTA 삽입 (게이트 전에 보이도록)
  if (alertCtaHtml) {
    const h2Match = htmlFull.match(/<h2[^>]*>/i);
    if (h2Match && h2Match.index !== undefined) {
      htmlFull = htmlFull.slice(0, h2Match.index) + alertCtaHtml + htmlFull.slice(h2Match.index);
    }
  }
  const cutoff = Math.floor(htmlFull.length * 0.7);
  const htmlTruncated = htmlFull.slice(0, cutoff);
  const tossCutoff = Math.floor(htmlFull.length * 0.3);
  const htmlTossShort = htmlFull.slice(0, tossCutoff);

  // 목차 추출
  const toc = extractToc(htmlFull);

  // FAQ 파싱
  const faqItems = parseFaqFromContent(cleanContent);
  const isFaq = (post.tags ?? []).some((t: string) => t.toLowerCase().includes('faq') || t === '자주묻는질문');

  // HowTo JSON-LD (가이드 글 감지)
  const isGuide = (post.tags || []).some((t: string) => ['가이드', '방법', '절차', '신청', '계산', '하는법', '설정'].includes(t))
    || /방법|가이드|하는 법|신청|절차|단계/.test(post.title);
  const howtoSteps = isGuide ? (post.content || '').match(/^## \d+[.\s].*$/gm)?.map((h: string, i: number) => ({
    '@type': 'HowToStep' as const,
    name: h.replace(/^## \d+[.\s]*/, '').trim(),
    text: h.replace(/^## \d+[.\s]*/, '').trim(),
    position: i + 1,
  })) : null;
  const howtoSchema = howtoSteps && howtoSteps.length >= 2 ? {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: post.title,
    description: descClean,
    step: howtoSteps.slice(0, 8),
    image: post.cover_image || `${SITE}/api/og?title=${encodeURIComponent(post.title)}&category=${post.category}&design=2`,
  } : null;

  
  // Dataset JSON-LD (데이터 기반 글 감지)
  const isDataPost = (post.tags || []).some((t: string) => ['실거래가', '시세', '통계', '현황', '순위', '비교', 'TOP', '데이터'].includes(t))
    || /실거래|통계|현황|순위|TOP|데이터|트렌드|분석/.test(post.title);
  const datasetSchema = isDataPost ? {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: post.title,
    description: descClean,
    url: `${SITE}/blog/${slug}`,
    temporalCoverage: post.data_date || new Date().toISOString().slice(0, 7),
    creator: { '@type': 'Organization', name: '카더라', url: SITE },
    distribution: {
      '@type': 'DataDownload',
      contentUrl: `${SITE}/blog/${slug}`,
      encodingFormat: 'text/html',
    },
    license: 'https://creativecommons.org/licenses/by-nc/4.0/',
  } : null;

    const showFaq = faqItems.length >= 1;  // 1개 이상이면 FAQ 스키마 출력 (JSON-LD 리치스니펫 극대화)
  const faqSchema = showFaq && faqItems.length > 0 ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqItems.map(f => ({
      '@type': 'Question', name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  } : null;

  const catColorMap: Record<string, { color: string; bg: string }> = {
    stock:   { color: 'var(--accent-blue)',   bg: 'var(--accent-blue-bg)' },
    apt:     { color: 'var(--accent-green)',  bg: 'var(--accent-green-bg)' },
    unsold:  { color: 'var(--accent-orange)', bg: 'var(--accent-orange-bg)' },
    finance: { color: 'var(--accent-purple)', bg: 'var(--accent-purple-bg)' },
    general: { color: 'var(--text-tertiary)', bg: 'var(--bg-hover)' },
  };
  const catStyle = catColorMap[post.category] || catColorMap.general;

  return (
    <div className="blog-detail-layout">
      <div className="blog-detail-main">
      <ReadingProgress />
      {/* A-2: article:tag 개별 메타태그 — 네이버/구글 키워드 인식 강화 */}
      {(post.tags ?? []).slice(0, 8).map((tag: string) => (
        <meta key={`tag-${tag}`} property="article:tag" content={tag} />
      ))}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />}
      {howtoSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howtoSchema) }} />}
      {datasetSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetSchema) }} />}

      <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 20, flexWrap: 'wrap', letterSpacing: '0.3px' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)', opacity: 0.7 }}>홈</Link>
        <span style={{ opacity: 0.3 }}>/</span>
        <Link href="/blog" style={{ textDecoration: 'none', color: 'var(--text-tertiary)', opacity: 0.7 }}>블로그</Link>
        {post.category && <><span style={{ opacity: 0.3 }}>/</span><Link href={`/blog?category=${post.category}`} style={{ textDecoration: 'none', color: catStyle.color, fontWeight: 600 }}>{({ stock: '주식', apt: '청약', unsold: '미분양', finance: '재테크', general: '생활' } as Record<string, string>)[post.category] || post.category}</Link></>}
      </nav>

      {/* 세션70: 상단 회원가입 유도 배너 */}

      <article itemScope itemType={`https://schema.org/${isNewsArticle ? 'NewsArticle' : 'BlogPosting'}`} style={{ paddingBottom: 40 }}>
        <BlogViewTracker blogId={String(post.id)} />
        {/* ImageGallery JSON-LD (유지 — 포털 이미지 탭) */}
        {post.cover_image && (() => {
          const ogSquare = `${SITE}/api/og-square?title=${encodeURIComponent(post.title)}&category=${post.category}&author=${encodeURIComponent(post.author_name || '카더라')}`;
          return (
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
              '@context': 'https://schema.org', '@type': 'ImageGallery', name: `${post.title} 이미지`,
              image: [
                { '@type': 'ImageObject', url: post.cover_image.startsWith('/') ? `${SITE}${post.cover_image}` : post.cover_image, name: post.image_alt || post.title, width: 1200, height: 630, position: 1 },
                { '@type': 'ImageObject', url: ogSquare, name: `${post.title} — 카더라 블로그`, width: 630, height: 630, position: 2 },
                { '@type': 'ImageObject', url: `${SITE}/api/og?title=${encodeURIComponent((post.title || '').slice(0, 40))}&category=${post.category}&design=2`, name: `${post.title} 분석`, width: 1200, height: 630, position: 3 },

              ],
            })}} />
          );
        })()}

        {/* 히어로 — 프리미엄 */}
        <div style={{ marginBottom: 20 }}>
          {/* 카테고리 배지 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 'var(--radius-xl)', background: catStyle.bg, color: catStyle.color, letterSpacing: '0.3px' }}>
              {({ stock: '주식 분석', apt: '청약 분석', unsold: '미분양 분석', finance: '재테크', general: '생활' } as Record<string, string>)[post.category] || post.category}
            </span>
            {(post.view_count ?? 0) >= 100 && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 'var(--radius-xl)', background: 'var(--error-bg)', color: 'var(--error)' }}>인기</span>}
            {post.rewritten_at && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 'var(--radius-xl)', background: 'var(--success-bg)', color: 'var(--success)' }}>UP</span>}
          </div>
          {/* 제목 */}
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.5, margin: '0 0 18px', wordBreak: 'keep-all', letterSpacing: '-0.8px' }}>{post.title}</h1>
          {/* Session D: TLDR + key_points hero (7,040건 100% backfill 완료) */}
          <BlogHeroExtras
            tldr={(post as any).tldr}
            keyPoints={(post as any).key_points}
            readingMinutes={(post as any).reading_minutes}
            readingTimeMinFallback={post.reading_time_min}
          />
          {/* Early Gate Teaser — 무조건 마운트 (클라이언트에서 hasGated/isAuth 체크)
              서버 조건 분기가 SSR/ISR 캐시와 맞물려 mount probe 0 유발하므로 제거 */}
          <BlogEarlyGateTeaser
            slug={slug}
            hasGatedContent={!!(post as any).has_gated_content}
            isLoggedInHint={isLoggedIn}
          />
          {/* 저자 카드 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 'var(--radius-card)', background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--brand)', flexShrink: 0 }}>
              {(post.author_name || '카더라').charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{post.author_name || '카더라 부동산팀'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                <time dateTime={post.published_at || post.created_at || new Date().toISOString()}>{new Date(post.published_at || post.created_at || Date.now()).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</time> · {readingTimeMin}분 읽기
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand)' }}>{(post.view_count ?? 0).toLocaleString()}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>조회</div>
            </div>
          </div>
        </div>

        {/* 태그 — 필 스타일 */}
        {(post.tags ?? []).length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {(post.tags ?? []).map((t: string) => <Link key={t} href={`/blog?q=${encodeURIComponent(t)}`} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 'var(--radius-xl)', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-tertiary)', textDecoration: 'none', fontWeight: 400 }}>#{t}</Link>)}
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
              <div style={{ height: 4, borderRadius: 4, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--brand)', borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
            </div>
          );
        })()}

        {/* 히어로 이미지 캐러셀 (og_card + infographic 제외 — OG 텍스트 배너는 실사진이 아님) */}
        {postImages.filter((img: any) => img.image_type !== 'og_card' && img.image_type !== 'infographic').length > 0 && (
          <BlogHeroImage
            images={postImages.filter((img: any) => img.image_type !== 'og_card' && img.image_type !== 'infographic').map((img: any) => ({
              // 세션 140 P1: 오염 URL 은 /api/og 로 치환
              url: safeImg(img.image_url, { title: post.title, category: 'blog', design: 2 }),
              alt: img.alt_text || `${post.title} — 카더라 ${catSection[post.category] || ''} 분석`,
              caption: img.caption || undefined,
            }))}
            title={post.title}
          />
        )}

        {/* 블로그 내 언급된 종목/단지 → 하위 페이지 유도 카드 (상단, 풍부 버전) */}
        <BlogMentionCard tags={post.tags ?? []} category={post.category} sourceRef={post.source_ref} title={post.title} placement="top" />

        {/* 세션 135: dedup된 관련 이미지 갤러리 (lightbox + zoom) */}
        {galleryImages.length > 0 && (
          <section style={{ marginTop: 16, marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>
              관련 이미지 · {galleryImages.length}장
            </h3>
            <ImageLightbox
              images={galleryImages.map(g => ({
                // 세션 140 P1: 갤러리 이미지도 sanitize
                url: safeImg(g.image_url, { title: post.title, category: 'blog', design: 2 }),
                caption: g.caption,
                alt: g.alt_text,
              }))}
              columns={3}
            />
          </section>
        )}

        {/* 공유 바 */}
        {/* s169: 신규 소셜바 — 카카오/링크복사/댓글 이동 */}
        <BlogSocialBar
          title={post.title}
          description={post.meta_description || post.excerpt || ''}
          slug={slug}
          coverImage={post.cover_image || undefined}
          commentCount={post.comment_count ?? 0}
          helpfulCount={post.helpful_count ?? 0}
          commentAnchorId="blog-comments"
        />

        {/* s172: 본문 진입 직전 이미지 캐러셀 — 실이미지 ≥ 2 또는 이미지 없을 때 카테고리 이모지 fallback */}
        <BlogImageCarousel
          images={galleryImages.map((g) => ({
            url: safeImg(g.image_url, { title: post.title, category: 'blog', design: 2 }),
            alt: g.alt_text,
            caption: g.caption,
          }))}
          title={post.title}
          category={post.category}
        />

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 0', marginBottom: 24, fontSize: 'var(--fs-sm)',
          borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <KakaoShareButton title={post.title} description={post.meta_description || post.excerpt || ''} slug={slug} coverImage={post.cover_image || undefined} />
            <ShareButtons title={post.title} content={post.excerpt || post.meta_description || undefined} category={post.category} contentType="blog" contentRef={slug} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BlogBookmarkButton blogPostId={post.id} />
          </div>
        </div>

        {/* 목차 (모바일: 인라인, 데스크탑: 사이드바) */}
        <div className="blog-toc-inline">
          {toc.length >= 3 && <BlogToc toc={toc} />}
        </div>

        {/* [L0-6] YMYL 카테고리 면책 배너 — 본문 위 1회 삽입 */}
        {(post.category === 'stock' || post.category === 'finance' || post.category === 'apt' || post.category === 'unsold') && (
          <YMYLBanner
            category={post.category}
            dataDate={post.data_date}
            sourceRef={post.source_ref}
            authorName={post.author_name}
            authorRole={post.author_role}
          />
        )}

        {/* [BIG-EVENT-CHARTS] 연결된 big_event가 있으면 본문 위에 3종 차트 자동 렌더 */}
        {bigEventId ? <BigEventCharts eventId={bigEventId} /> : null}

        {/* 본문 — 봇: 전체, gated_sections 있으면 Gated 렌더, 로그인: TossGate, 비로그인: 전체 공개 */}
        {isBot ? (
          <div className="blog-content" itemProp="articleBody" dangerouslySetInnerHTML={{ __html: sanitizeHtml(htmlFull) }} />
        ) : (post as any).has_gated_content ? (
          <BlogGatedRenderer
            content={post.content}
            gatedSections={(post as any).gated_sections}
            isLoggedIn={isLoggedIn}
            isPremium={false}
            slug={slug}
          />
        ) : isLoggedIn ? (
          <BlogTossGate htmlFull={htmlFull} htmlShort={htmlTossShort} slug={slug} title={post.title} />
        ) : (
          <div className="blog-content" itemProp="articleBody" dangerouslySetInnerHTML={{ __html: sanitizeHtml(htmlFull) }} />
        )}

        {/* 관심단지 알림 CTA — apt/unsold 카테고리 + 단지명 있을 때 (봇 제외) */}
        {!isBot && (post.category === 'apt' || post.category === 'unsold') && post.tags?.[0] && (
          <BlogAptAlertCTA
            aptName={post.tags[0]}
            siteSlug={relatedSites?.[0]?.slug}
            category={post.category}
            loginUrl={`/login?redirect=${encodeURIComponent(`/blog/${slug}`)}&source=apt_alert_cta`}
          />
        )}

        {/* v2.0 Week1 C3: login_gate_blog_compare / login_gate_blog_stock_ai — 0% CTR 로 제거 (2026-04-22 실측). blog_early_teaser / blog_gated_login 이 역할 대체. */}

        {/* LoginGate 기능 게이팅이 비로그인 전환 전담 */}

        {/* 블로그 내 언급된 종목/단지 → 하위 페이지 유도 카드 (하단, 컴팩트) */}
        <BlogMentionCard tags={post.tags ?? []} category={post.category} sourceRef={post.source_ref} title={post.title} placement="bottom" />

        <RelatedContentCard type="blog" showSignup={false} />

        {/* 뉴스레터 — 본문 직후, 비로그인 유저 대상 (게이트 대안 경로) */}
        {/* NewsletterSubscribe 삭제 — LoginGate + ActionBar로 통합 */}

        {/* 관련 서비스 CTA (카테고리별) */}
        {post.category === 'apt' && (
          <div style={{
            display: 'flex', gap: 8, margin: 'var(--sp-md) 0', flexWrap: 'wrap',
          }}>
            <a href="/apt" style={{
              flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 16px', borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.03))',
              border: '1px solid rgba(34,197,94,0.15)', textDecoration: 'none', color: 'inherit',
            }}>
              <span style={{ fontSize: 20 }}>🏢</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>청약 일정 보기</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>접수중·예정 전체</div>
              </div>
            </a>
            <a href="/apt/diagnose" style={{
              flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 16px', borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, rgba(59,123,246,0.08), rgba(59,123,246,0.03))',
              border: '1px solid rgba(59,123,246,0.15)', textDecoration: 'none', color: 'inherit',
            }}>
              <span style={{ fontSize: 20 }}>🎯</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>청약 가점 계산</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>내 당첨 확률은?</div>
              </div>
            </a>
            <a href="/calc/real-estate/brokerage-fee" style={{
              flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 16px', borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(251,191,36,0.03))',
              border: '1px solid rgba(251,191,36,0.15)', textDecoration: 'none', color: 'inherit',
            }}>
              <span style={{ fontSize: 20 }}>🧮</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>중개수수료 계산</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>매매·전세 복비</div>
              </div>
            </a>
          </div>
        )}

        {/* FAQ 아코디언 */}
        {showFaq && <BlogFaqAccordion items={faqItems} />}

        {/* 세션70: 본문 중간 회원가입 유도 */}

        {/* 읽기 완료 메시지 — 로그인 사용자만 */}
        {isLoggedIn && (
        <div style={{
          textAlign: 'center', padding: '14px 12px', margin: '16px 0',
          background: 'linear-gradient(135deg, rgba(52,211,153,0.05), rgba(96,165,250,0.05))',
          borderRadius: 'var(--radius-md)', border: '1px dashed rgba(52,211,153,0.15)',
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

        {/* [L0-5] 참고자료 — source_ref 기반 외부 링크 블록 */}
        {(() => {
          const refRaw = (post.source_ref || '').trim();
          if (!refRaw) return null;
          const items = refRaw.split(';').map((r: string) => r.trim()).filter(Boolean).map((r: string) => {
            const [label, url] = r.split('|');
            return { label: label?.trim() || '', url: url?.trim() || '' };
          }).filter((i: { label: string; url: string }) => i.label && /^https?:\/\//i.test(i.url));
          if (items.length === 0) return null;
          return (
            <section style={{ marginTop: 'var(--sp-xl)', padding: '14px 16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>📚 참고자료</h2>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                {items.map((r: { label: string; url: string }, i: number) => (
                  <li key={i}>
                    <a href={r.url} target="_blank" rel="noopener nofollow" style={{ color: 'var(--brand)', textDecoration: 'underline' }}>
                      {r.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          );
        })()}

        {/* s172: 자동생성 면책 — 댓글 직후로 이동 (article 외부) */}

        {/* 관련 종목/현장은 하단 섹션에서만 렌더링 (중복 제거) */}

        {/* 도움이됐어요 + 북마크 */}
        <div style={{
          borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        }}>
          <BlogActions blogPostId={post.id} initialHelpfulCount={post.helpful_count ?? 0} />
        </div>

        {/* v2.0 Week1 C4: 본문 50% 스크롤 mid-gate (비로그인 + !has_gated_content 만) */}
        {!isBot && !isLoggedIn && (
          <BlogMidGate
            blogId={post.id}
            isGatedPost={!!(post as any).has_gated_content}
            isLoggedIn={isLoggedIn}
          />
        )}

        {/* v2.0 Week1 C2: 관련 글 3카드 (strategy badge 포함) — FAQ/BlogActions 뒤, EndCTA 앞 */}
        {!isBot && <RelatedBlogsSection blogId={post.id} />}

        {/* Session D: 본문 끝 CTA (비로그인만) */}
        {!isBot && !isLoggedIn && <BlogEndCTA slug={slug} isLoggedIn={false} />}
        {/* s157: FOMO 팝업 모달 (스크롤 50% or 60s, 세션 1회) — sticky_bar/floating_ask 대체 */}
        {!isBot && !isLoggedIn && <SignupPopupModal slug={slug} redirectPath={`/blog/${slug}`} isLoggedIn={isLoggedIn} />}

        {/* s172: BlogFooterMeta 댓글 직후로 이동 (article 외부) */}
      </article>

      {/* 플로팅 액션바 — 스크롤 30% 후 나타남, 봇 제외 */}
      {/* C3: BlogFloatingBar 제거됨 */}

      {/* 댓글 섹션 — D안 컴팩트 리스트 */}
      <BlogCommentCTA commentCount={comments.length} />
      <div id="blog-comments" style={{ marginBottom: 'var(--sp-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>댓글</span>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{comments.length}</span>
        </div>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
          {CTA_BY_CAT[post.category] ?? CTA_BY_CAT.general}
        </p>

        {/* 댓글 입력 — s169: BlogSocialBar 가 scrollIntoView target 사용 */}
        <div id="blog-comments" style={{ scrollMarginTop: 64 }} />
        {isLoggedIn ? (
          <BlogCommentInput blogPostId={post.id} />
        ) : (
          <div style={{ padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center', marginBottom: 'var(--sp-lg)', fontSize: 14, color: 'var(--text-secondary)' }}>
            <Link href={`/login?redirect=/blog/${slug}&source=blog_comment`} style={{ color: 'var(--brand)', fontWeight: 700, textDecoration: 'none' }}>로그인</Link>하면 의견을 남길 수 있어요
          </div>
        )}

        {/* 댓글 목록 */}
        <div>
          {comments.map((c: Record<string, any>) => {
            const nick = c.author_name || c.profiles?.nickname || '사용자';
            return (
              <div key={c.id} style={{ display: 'flex', gap: 10, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: getAvatarColor(nick), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                  {nick[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{nick}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 6 }}>{timeAgo(c.created_at)}</span>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, marginTop: 3 }}>{c.content}</div>
                  {(c as any).image_url && (
                    <a href={(c as any).image_url} target="_blank" rel="noopener noreferrer nofollow ugc" style={{ display: 'inline-block', marginTop: 4 }}>
                      <img src={(c as any).image_url} alt="댓글 이미지" style={{ maxWidth: 180, maxHeight: 120, borderRadius: 'var(--radius-md)', objectFit: 'cover', border: '1px solid var(--border)' }} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
          {comments.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 14 }}>
              아직 댓글이 없어요. 첫 의견을 남겨보세요!
            </div>
          )}
        </div>
      </div>

      {/* s172: 자동생성 콘텐츠 면책 — 댓글 하단, BlogFooterMeta 위 */}
      {post.source_type === 'auto' && (
        <div style={{
          background: 'var(--bg-elevated, var(--bg-surface))',
          borderRadius: 12,
          padding: '16px 18px',
          border: '1px solid var(--border)',
          borderLeft: '3px solid var(--blog-disclaimer-border, #F59E0B)',
          marginBottom: 16,
        }}>
          <div style={{
            fontSize: 13, fontWeight: 800,
            color: 'var(--blog-disclaimer-border, #F59E0B)',
            marginBottom: 6,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            ⚠️ 면책사항
          </div>
          <p style={{
            fontSize: 12.5,
            color: 'var(--text-tertiary)',
            lineHeight: 1.75,
            margin: 0,
          }}>
            본 콘텐츠는 공공 데이터(국토교통부, 한국거래소, 금융위원회 등) 기반의 정보 제공 목적이며 투자 권유가 아닙니다.
            {post.data_date && <> 데이터 기준일: {post.data_date}.</>}
            {post.source_ref && <> 출처: {post.source_ref}.</>}
          </p>
        </div>
      )}

      {/* s172: 하단 메타 — 태그 pill + 최초/수정일 (댓글 + 면책사항 다음) */}
      <BlogFooterMeta
        tags={post.tags}
        category={post.category}
        createdAt={post.created_at}
        updatedAt={post.updated_at}
        rewrittenAt={post.rewritten_at}
      />

      {/* 시리즈 네비게이션 */}
      {seriesInfo && seriesInfo.posts.length > 1 && (() => {
        const idx = seriesInfo.posts.findIndex((p: Record<string, any>) => p.id === post.id);
        const prev = idx > 0 ? seriesInfo.posts[idx - 1] : null;
        const next = idx < seriesInfo.posts.length - 1 ? seriesInfo.posts[idx + 1] : null;
        return (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 16, marginBottom: 'var(--sp-xl)' }}>
            <Link href={`/blog/series/${seriesInfo.series.slug}`} style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', marginBottom: 10 }}>
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' }}>📚 시리즈</span>
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

      {/* 이번주 인기글 */}
      {related.length > 0 && (
        <div style={{ marginBottom: 'var(--sp-xl)' }}>
          <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>🔥 이번주 인기글</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {related.slice(0, 3).map((r: any, i: number) => (
              <Link key={r.slug} href={`/blog/${r.slug}`} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', textDecoration: 'none', color: 'inherit',
              }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: i === 0 ? 'var(--accent-red, #ef4444)' : i === 1 ? 'var(--warning, #f59e0b)' : 'var(--text-tertiary, #6b7280)', minWidth: 24 }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title?.slice(0, 40)}</span>
              </Link>
            ))}
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


      {/* 세션74: 유용한 도구 + 뉴스레터 */}
      <div style={{ marginBottom: 'var(--sp-xl)' }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>🛠️ 유용한 도구</div>
        <div style={{ display: 'flex', gap: 'var(--sp-sm)', flexWrap: 'wrap' }}>
          {(post.category === 'apt' || post.category === 'unsold') && (
            <Link href="/apt/diagnose" style={{ flex: '1 1 calc(50% - 4px)', minWidth: 140, padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--brand-border)', background: 'var(--bg-surface)', textDecoration: 'none' }}>
              <div style={{ fontSize: 14, marginBottom: 4 }}>🎯</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>청약 가점 계산기</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>무주택·부양가족·청약통장 가점 자동 계산</div>
            </Link>
          )}
          {post.category === 'stock' && (
            <Link href="/stock/compare" style={{ flex: '1 1 calc(50% - 4px)', minWidth: 140, padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--brand-border)', background: 'var(--bg-surface)', textDecoration: 'none' }}>
              <div style={{ fontSize: 14, marginBottom: 4 }}>⚖️</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>종목 비교</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>국내외 종목 핵심 지표 비교</div>
            </Link>
          )}
          <Link href="/apt/complex" style={{ flex: '1 1 calc(50% - 4px)', minWidth: 140, padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', textDecoration: 'none' }}>
            <div style={{ fontSize: 14, marginBottom: 4 }}>🏘️</div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>단지백과</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>전국 34,500+ 아파트 시세 검색</div>
          </Link>
        </div>
      </div>


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
      {/* Disclaimer는 auto면책 + 본문 출처로 대체됨 — 중복 제거 */}

      {/* 핵심 지표 + 도구 — 본문 하단 인라인 (사이드바 대체) */}
      {sidebarMetrics.length > 0 && (
        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 'var(--radius-card)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>📊 핵심 지표</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(sidebarMetrics.length, 4)}, 1fr)`, gap: 8 }}>
            {sidebarMetrics.map((m, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sidebarRelatedLinks.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {sidebarRelatedLinks.map((link, i) => (
            <Link key={i} href={link.href} style={{
              padding: '5px 12px', borderRadius: 'var(--radius-card)', fontSize: 12, fontWeight: 600,
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', textDecoration: 'none',
            }}>
              {link.title} →
            </Link>
          ))}
        </div>
      )}

      </div>
    </div>
  );
}
