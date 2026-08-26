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
import ShareButtons from '@/components/ShareButtons';
// s184: KakaoShareButton 제거 — ShareButtons (8 플랫폼) 안에 카카오 포함됨.
import FAQBlock from '@/components/detail/FAQBlock';
import BlogTocList from '@/components/blog/BlogTocList';
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
import { isSafeImage, blogHeroImage } from '@/lib/blog/safe-image';
import { enhanceBlogVisuals } from '@/lib/blog-visual-enhancer';
import ReadingProgress from '@/components/ReadingProgress';
// BlogSidebar removed — TOC inline + tools/metrics below article
import BlogMetricCards from '@/components/BlogMetricCards';
// s184: BlogHeroImage 제거 (대표 이미지 1장 inline 으로 대체). ImageLightbox 도 미사용.
import NextArticleFloat from '@/components/NextArticleFloat';
import RelatedContentCard from '@/components/RelatedContentCard';
import BlogMentionCard from '@/components/blog/BlogMentionCard';
import BlogHeroExtras from '@/components/blog/BlogHeroExtras';
import BlogEndCTA from '@/components/blog/BlogEndCTA';
// s183: SignupPopupModal import 제거. (s7-1 에서 게이트가 전면 제거돼 StickySignupBar 만 남음)
import RelatedBlogsSection from '@/components/blog/RelatedBlogsSection';
import LeadForm from '@/components/apt/LeadForm';
import { isLeadEligible } from '@/lib/apt/lead-eligibility';
// s184: BlogSocialBar 제거 — 본문 직후 ShareButtons 1세트로 통합.
import BlogFooterMeta from '@/components/blog/BlogFooterMeta';
import CardCarousel from '@/components/og/CardCarousel';
// s189: AI Overview / 음성검색 인용 + YouTube 영상 schema
import SpeakableSchema from '@/components/schema/SpeakableSchema';
import VideoObjectSchema, { extractVideosFromContent } from '@/components/schema/VideoObjectSchema';
// s184: BlogImageCarousel 제거 — 캐러셀 자체 폐지.
// s185: BlogMidGate 제거. (s7-1 에서 나머지 게이트도 전면 제거)
// s7-1: 게이트 전면 제거 — 봇/사람 분기 없이 전문을 렌더한다 (클로킹 해소).
import BlogAptAlertCTA from '@/components/BlogAptAlertCTA';
import YMYLBanner from '@/components/YMYLBanner';
import BigEventCharts from '@/components/blog/BigEventCharts';
import InlineTalkBanner from '@/components/banner/InlineTalkBanner';
import { AdSlot } from '@/components/ads/AdSlot';
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
    .select('id,title,slug,content,excerpt,category,sub_category,cover_image,image_alt,tags,meta_description,meta_keywords,author_name,author_role,reading_time_min,view_count,comment_count,helpful_count,published_at,created_at,updated_at,series_id,series_order,source_type,source_ref,data_date,rewritten_at,tldr,key_points,gated_sections,has_gated_content,reading_minutes,og_cards,hub_cta_target,hub_apt_slug,keyword_targets')
    .eq('slug', slug).eq('is_published', true).maybeSingle();
  return data;
});

export async function generateMetadata({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const post = await getPostBySlug(slug);
  if (!post) notFound();

    // s9: 판정을 @/lib/blog/safe-image 로 옮겼다. S8 은 이 로직을 여기 지역 상수로 두는
    // 바람에 openGraph·twitter 에만 적용되고 JSON-LD 세 곳이 외부 이미지를 그대로 내보냈다.
    const heroOg = blogHeroImage(post);
    // 네이버/구글 통일 설명문 (meta_description > excerpt > title)
    const desc = (post.meta_description && post.meta_description.length >= 30)
      ? post.meta_description
      : (post.excerpt && post.excerpt.length >= 30)
        ? post.excerpt
        : post.title;
    const descClean = desc.replace(/[\n\r#*_|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);

    // s8: 발행 8,775편 전부가 og_cards 6장을 가져 cards.length === 6 분기가 항상 먼저 return 했고,
    // 그 결과 630x630 정사각만 나가면서 twitter:card='summary_large_image' 와 모순됐다.
    // (카카오톡·트위터에서 좌우가 잘리거나 작은 썸네일로 강등된다. /apt/[id] 와 같은 구조 결함)
    // 대형 카드를 0번에 두고 기존 6장을 뒤에 붙인다. og:image 와 twitter:images 가 같은 배열을 쓴다.
    const ogImages = (() => {
      const cards = Array.isArray(post.og_cards) ? post.og_cards : [];
      const abs = (u: any) => (typeof u === 'string' && u.startsWith('http') ? u : `${SITE}${u || ''}`);
      const cardImgs = cards.length === 6
        ? cards.map((c: any) => ({ url: abs(c?.url), width: 630, height: 630, alt: c?.alt || post.image_alt || post.title }))
        : (post.category === 'apt' || post.category === 'unsold') && post.slug
          // s261: apt 는 og_cards 가 비어도 og-apt 6장 폴백 (CardCarousel 과 동일 로직)
          ? ['cover', 'metric', 'units', 'timing', 'place', 'spec'].map((type, i) => ({
              url: `${SITE}/api/og-apt?slug=${encodeURIComponent(post.slug)}&card=${i + 1}&v=1`,
              width: 630, height: 630, alt: `${post.title} ${type}`,
            }))
          : [];
      return [
        { url: heroOg, width: 1200, height: 630, alt: post.image_alt || descClean || post.title },
        ...cardImgs,
      ];
    })();
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
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image' as const,
      // s8: og:image 와 같은 배열. 두 곳에 복제돼 있던 로직을 하나로 합쳤다.
      images: ogImages.map((i) => i.url),
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


  // CTA 소셜프루프 데이터
  let userCount = 66;
  let todaySignups = 0;
  if (!isLoggedIn) {
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
      // s9: 자체 호스팅분만 남긴다. BlogPosting.image[] 는 "이게 이 글의 이미지다"라고
      // 검색엔진에 명시 선언하는 자리라 OG 보다 강한 신호다 — 남의 언론사 사진을
      // 우리 콘텐츠 대표 이미지로 적극 제출하고 있었다. 캐러셀 노출 감소는 의도된 결과.
      ...contentImages
        .filter((img: { url: string }) => isSafeImage(img.url))
        .map((img: { url: string; alt: string }) => ({
          '@type': 'ImageObject' as const,
          url: img.url,
          caption: img.alt || post.title,
        })),
      {
        '@type': 'ImageObject',
        url: blogHeroImage(post),
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
    // ── 본문 색상 보호: 인라인 color/background-color 제거 ──
    // AI 생성 콘텐츠에 style="color:#333" 같은 하드코딩 색상이 섞이면
    // 페이지 토큰과 충돌해 대비가 깨진다
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
    if (isLoggedIn) return '';
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
      `<div style="position:absolute;top:14px;right:14px;font-size:10px;padding:2px 8px;border-radius:4px;background:rgba(34,197,94,0.12);color:var(--accent-green);font-weight:600">무료</div>` +
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">` +
        `<div style="width:32px;height:32px;border-radius:8px;background:rgba(59,123,246,0.12);display:flex;align-items:center;justify-content:center;font-size:15px">${icon}</div>` +
        `<div style="font-size:15px;font-weight:600;color:#e8e6e3">${title}</div>` +
      `</div>` +
      `<div style="font-size:13px;color:#8b95a5;line-height:1.5;margin-bottom:12px">${desc}</div>` +
      `<div style="display:flex;gap:5px;margin-bottom:14px;flex-wrap:wrap">` +
        tags.map(t => `<span style="font-size:11px;padding:3px 7px;border-radius:4px;background:rgba(59,123,246,0.08);color:#6da0f0;border:1px solid rgba(59,123,246,0.15)">${t}</span>`).join('') +
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
    image: blogHeroImage(post), // s9: 외부 커버 차단
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

  // r4-P6: FAQPage JSON-LD 는 FAQBlock 이 같은 배열에서 함께 낸다.
  // 여기서 별도로 만들지 않는다 — 두 벌이 되면 화면과 구조화 데이터가 갈라진다.
  const showFaq = faqItems.length >= 1;

  // S4-4 P1: 글이 가리키는 현장이 대상 단계면 하단에 알림 신청 폼을 붙인다.
  //
  // 블로그 상세는 트래픽이 가장 많은 라우트라 조회를 얹는 데 조심한다.
  // - hub_apt_slug 가 null 이면 조회 자체를 하지 않는다 (발행 글의 80%가 여기 해당)
  // - 기존 Promise.allSettled 뭉치에 합치지 않는다 (Rule #49 — /apt/[id] 504 의 원인이었다)
  // - slug 단건 조회라 인덱스를 탄다
  // ONESHOT §C-1: 단계별 문구를 쓰려면 lifecycle_stage 도 들고 와야 한다.
  let leadSite: { slug: string; name: string; region: string | null; sigungu: string | null; lifecycle_stage: string | null } | null = null;
  // v3 커밋6: '이 글이 다루는 현장' 행은 lead 대상 단계가 아니어도 낸다 —
  //   지금까지 블로그에서 현장 페이지로 가는 동선이 아예 없었다.
  let hubSite: { slug: string; name: string; region: string | null } | null = null;
  if (post.hub_apt_slug) {
    try {
      const { data: ls } = await (sb as any)
        .from('apt_sites')
        .select('slug, name, region, sigungu, lifecycle_stage')
        .eq('slug', post.hub_apt_slug)
        .maybeSingle();
      if (ls) hubSite = { slug: ls.slug, name: ls.name, region: ls.region ?? null };
      if (ls && isLeadEligible(ls.lifecycle_stage)) leadSite = { slug: ls.slug, name: ls.name, region: ls.region ?? null, sigungu: ls.sigungu ?? null, lifecycle_stage: ls.lifecycle_stage ?? null };
    } catch {
      /* 조회 실패는 본문 렌더를 막지 않는다 — 폼만 생략한다 */
    }
  }

  // s261: Event schema (청약 일정) — apt 카테고리 + 단지명 매칭 시 청약 이벤트 카드 노출
  let eventSchema: any = null;
  if (post.category === 'apt' || post.category === 'unsold') {
    try {
      // related_entities 또는 tags 첫 항목에서 단지명 추출
      const entities = (post.tags ?? []) as string[];
      const candidates = [post.title.split(' ').slice(0, 3).join(' '), ...entities].filter(Boolean);
      for (const cand of candidates.slice(0, 3)) {
        const { data: sub } = await sb
          .from('apt_subscriptions')
          .select('house_nm, hssply_adres, supply_addr, rcept_bgnde, rcept_endde, przwner_presnatn_de, mvn_prearnge_ym, total_households, constructor_nm')
          .ilike('house_nm', `%${cand}%`)
          .limit(1)
          .maybeSingle();
        if (sub && sub.rcept_bgnde) {
          const startDate = sub.rcept_bgnde;
          const endDate = sub.rcept_endde || sub.rcept_bgnde;
          const venue = sub.hssply_adres || sub.supply_addr || '';
          eventSchema = {
            '@context': 'https://schema.org',
            '@type': 'Event',
            name: `${sub.house_nm} 청약 접수`,
            description: `${sub.house_nm} ${sub.total_households ? `${sub.total_households}세대 ` : ''}청약 접수 일정. ${descClean}`,
            startDate,
            endDate,
            eventStatus: 'https://schema.org/EventScheduled',
            eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
            location: {
              '@type': 'Place',
              name: sub.house_nm,
              address: { '@type': 'PostalAddress', streetAddress: venue, addressCountry: 'KR' },
            },
            organizer: {
              '@type': 'Organization',
              name: sub.constructor_nm || '청약홈',
              url: 'https://www.applyhome.co.kr',
            },
            offers: {
              '@type': 'Offer',
              url: `${SITE}/blog/${slug}`,
              availability: 'https://schema.org/InStock',
              priceCurrency: 'KRW',
              price: '0',
            },
            url: `${SITE}/blog/${slug}`,
            image: blogHeroImage(post), // s9: 외부 커버 차단
          };
          break;
        }
      }
    } catch {
      // 매칭 실패 시 Event schema 출력 안 함
    }
  }

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
      {howtoSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howtoSchema) }} />}
      {datasetSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetSchema) }} />}
      {eventSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }} />}

      <CardCarousel
        slug={post.slug}
        name={post.title}
        cards={(post as any).og_cards ?? null}
      />
      <SpeakableSchema url={`${SITE}/blog/${post.slug}`} title={post.title} />
      <VideoObjectSchema videos={extractVideosFromContent(post.content || '', post.title)} />

      <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 20, flexWrap: 'wrap', letterSpacing: '0.3px' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>
        <span style={{ opacity: 0.3 }}>/</span>
        <Link href="/blog" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>블로그</Link>
        {post.category && <><span style={{ opacity: 0.3 }}>/</span><Link href={`/blog?category=${post.category}`} style={{ textDecoration: 'none', color: catStyle.color, fontWeight: 600 }}>{({ stock: '주식', apt: '청약', unsold: '미분양', finance: '재테크', general: '생활' } as Record<string, string>)[post.category] || post.category}</Link></>}
      </nav>

      {/* 세션70: 상단 회원가입 유도 배너 */}

      <article itemScope itemType={`https://schema.org/${isNewsArticle ? 'NewsArticle' : 'BlogPosting'}`} style={{ paddingBottom: 40 }}>
        <BlogViewTracker blogId={String(post.id)} />
        {/* ImageGallery JSON-LD (s261: 3장 → 최대 9장으로 확장 — 포털 이미지 캐러셀 자격 강화) */}
        {post.cover_image && (() => {
          const ogSquareUrl = `${SITE}/api/og-square?title=${encodeURIComponent(post.title)}&category=${post.category}&author=${encodeURIComponent(post.author_name || '카더라')}`;
          const ogMainUrl = `${SITE}/api/og?title=${encodeURIComponent((post.title || '').slice(0, 40))}&category=${post.category}&design=2`;
          // s9: 외부 스크랩 커버는 갤러리 대표로 내보내지 않는다. blogHeroImage 가
          // 안전하면 커버를, 아니면 생성 카드를 준다 (BlogPosting.image[] 와 같은 판정).
          const safeCover = blogHeroImage(post);
          const coverUrl = safeCover.startsWith('/') ? `${SITE}${safeCover}` : safeCover;
          const cards = Array.isArray((post as any).og_cards) ? (post as any).og_cards : [];

          // s261: og_cards 6장 우선, 없으면 apt 카테고리는 og-apt 6장 fallback
          let cardImages: any[] = [];
          if (cards.length === 6) {
            cardImages = cards.map((c: any, i: number) => ({
              '@type': 'ImageObject',
              url: typeof c?.url === 'string' && c.url.startsWith('http') ? c.url : `${SITE}${c?.url || ''}`,
              name: c?.alt || `${post.title} card${i + 1}`,
              width: 630,
              height: 630,
              position: i + 2, // 1번은 cover
            }));
          } else if ((post.category === 'apt' || post.category === 'unsold') && post.slug) {
            const fallbackTypes = ['cover', 'metric', 'units', 'timing', 'place', 'spec'];
            cardImages = fallbackTypes.map((type, i) => ({
              '@type': 'ImageObject',
              url: `${SITE}/api/og-apt?slug=${encodeURIComponent(post.slug)}&card=${i + 1}&v=1`,
              name: `${post.title} ${type}`,
              width: 630,
              height: 630,
              position: i + 2,
            }));
          }

          const allImages = [
            { '@type': 'ImageObject', url: coverUrl, name: post.image_alt || post.title, width: 1200, height: 630, position: 1 },
            ...cardImages,
            { '@type': 'ImageObject', url: ogSquareUrl, name: `${post.title} — 카더라 블로그`, width: 630, height: 630, position: cardImages.length + 2 },
            { '@type': 'ImageObject', url: ogMainUrl, name: `${post.title} 분석`, width: 1200, height: 630, position: cardImages.length + 3 },
          ];

          return (
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
              '@context': 'https://schema.org', '@type': 'ImageGallery', name: `${post.title} 이미지`,
              image: allImages,
            })}} />
          );
        })()}

        {/* 히어로 — 프리미엄 */}
        <div style={{ marginBottom: 20 }}>
          {/* 카테고리 배지 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 500, padding: '4px 12px', borderRadius: 'var(--radius-xl)', background: catStyle.bg, color: catStyle.color, letterSpacing: '0.3px' }}>
              {({ stock: '주식 분석', apt: '청약 분석', unsold: '미분양 분석', finance: '재테크', general: '생활' } as Record<string, string>)[post.category] || post.category}
            </span>
            {(post.view_count ?? 0) >= 100 && <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 8px', borderRadius: 'var(--radius-xl)', background: 'var(--error-bg)', color: 'var(--error)' }}>인기</span>}
            {post.rewritten_at && <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 8px', borderRadius: 'var(--radius-xl)', background: 'var(--success-bg)', color: 'var(--success)' }}>UP</span>}
          </div>
          {/* 제목 */}
          <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5, margin: '0 0 10px', wordBreak: 'keep-all', letterSpacing: '-0.5px' }}>{post.title}</h1>
          {/* s213: H1 직후 컴팩트 메타 한 줄 — 큰 저자 카드 / TLDR / key_points / 태그 pills 모두 본문 종료 후 "이 글 정보" 섹션으로 이동.
              독자가 페이지 열자마자 본문 첫 문단까지 스크롤이 짧아짐. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 16 }}>
            <time dateTime={post.published_at || post.created_at || new Date().toISOString()}>
              {new Date(post.published_at || post.created_at || Date.now()).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </time>
            <span aria-hidden>·</span>
            <span>{readingTimeMin}분 읽기</span>
            <span aria-hidden>·</span>
            <span>👀 {(post.view_count ?? 0).toLocaleString()}</span>
          </div>
        </div>

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
                <Link href={`/blog/series/${seriesInfo.series.slug}`} style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--brand)', textDecoration: 'none' }}>
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

        {/* s184: 대표 이미지 1장 (캐러셀 제거 — BlogHeroImage / BlogImageCarousel / ImageLightbox 모두 콘텐츠 가치 0 으로 판정).
            cover_image 없으면 OG 폴백, 그것도 없으면 이미지 자체 생략. */}
        {(() => {
          const heroSrc = post.cover_image || `${SITE}/api/og?title=${encodeURIComponent((post.title || '').slice(0, 60))}&category=${post.category || 'blog'}&design=2`;
          const heroAlt = post.image_alt || `${post.title} — 카더라 ${catSection[post.category] || ''} 분석`;
          if (!heroSrc) return null;
          return (
            <figure style={{ margin: '0 0 20px', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <img
                src={heroSrc.startsWith('/') ? `${SITE}${heroSrc}` : heroSrc}
                alt={heroAlt}
                width={1200}
                height={630}
                loading="eager"
                decoding="async"
                style={{ width: '100%', height: 'auto', aspectRatio: '1200 / 630', objectFit: 'cover', display: 'block' }}
              />
            </figure>
          );
        })()}

        {/* s213: BlogMentionCard placement="top" 제거 — 본문 위에 외부 link 카드 누적이 본문 도달 지연. 본문 직후 placement="bottom" 1회로 충분. */}

        {/* s184: "관련 이미지 N장" 섹션 제거 — AI 생성 + 무관 스톡사진 혼재로 콘텐츠 가치 0. */}
        {/* s184: BlogSocialBar 제거 — 본문 직후 ShareButtons 1세트로 통합. */}
        {/* s184: BlogImageCarousel 제거 — 캐러셀 자체 폐지. */}
        {/* s184: 본문 위 KakaoShareButton + ShareButtons + BlogBookmarkButton 행 제거 — 본문 직후로 이동. */}

        {/* v3 커밋6 · 목차 — 모바일은 접이식, 데스크탑은 우측 레일(아래 aside).
             기존 sticky 칩 바는 본문 폭을 먹어 세로 목록으로 바꿨다. */}
        {toc.length >= 3 && (
          <details className="blog-toc-details">
            <summary>목차</summary>
            <BlogTocList toc={toc} />
          </details>
        )}

        {/* s184: YMYLBanner 본문 위 → 하단 <details> 로 이동. 본문 직전에 면책 노출은 신뢰 저하. */}

        {/* [BIG-EVENT-CHARTS] 연결된 big_event가 있으면 본문 위에 3종 차트 자동 렌더 */}
        {bigEventId ? <BigEventCharts eventId={bigEventId} /> : null}

        {/* 부정공 TALK 인라인 배너 — 본문 진입부(TOC/차트 직후).
            DB 본문 미수정 · 렌더 시점 삽입. 하단 AdSlot 과 250px+ 이격. */}
        <InlineTalkBanner />

        {/* 본문 — s7-1: 게이트 제거. 방문자·크롤러 구분 없이 전문을 그대로 렌더한다. */}
        <div className="blog-content" itemProp="articleBody" dangerouslySetInnerHTML={{ __html: sanitizeHtml(htmlFull) }} />

        {/* AdSense 본문 하단 광고 (Rule #45) */}
        <AdSlot />

        {/* s184: 본문 직후 — 단일 공유 버튼 세트 (8개 플랫폼) + 북마크. 페이지 내 공유 UI 는 이 한 곳뿐. */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 0 12px', marginTop: 16,
          borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap', gap: 8,
        }}>
          <ShareButtons title={post.title} content={post.excerpt || post.meta_description || undefined} category={post.category} contentType="blog" contentRef={slug} />
          <BlogBookmarkButton blogPostId={post.id} />
        </div>

        {/* 관심단지 알림 CTA — apt/unsold 카테고리 + 단지명 있을 때 (봇 제외) */}
        {(post.category === 'apt' || post.category === 'unsold') && post.tags?.[0] && (
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

        {/* s184: RelatedContentCard 댓글 아래로 이동. */}

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
                <div style={{ fontSize: 13, fontWeight: 600 }}>청약 일정 보기</div>
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
                <div style={{ fontSize: 13, fontWeight: 600 }}>청약 가점 계산</div>
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
                <div style={{ fontSize: 13, fontWeight: 600 }}>중개수수료 계산</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>매매·전세 복비</div>
              </div>
            </a>
          </div>
        )}

        {/* FAQ — 화면 문구와 FAQPage JSON-LD 를 같은 배열에서 낸다 */}
        {showFaq && (
          <section aria-labelledby="blog-sec-faq" style={{ marginTop: 'var(--sp-xl)' }}>
            <h2
              id="blog-sec-faq"
              style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 var(--sp-sm)' }}
            >
              자주 묻는 질문
            </h2>
            <FAQBlock items={faqItems.map((f) => ({ q: f.question, a: f.answer }))} />
          </section>
        )}

        {/* 세션70: 본문 중간 회원가입 유도 */}

        {/* 읽기 완료 메시지 — 로그인 사용자만 */}
        {isLoggedIn && (
        <div style={{
          textAlign: 'center', padding: '14px 12px', margin: '16px 0',
          background: 'linear-gradient(135deg, rgba(52,211,153,0.05), rgba(96,165,250,0.05))',
          borderRadius: 'var(--radius-md)', border: '1px dashed rgba(52,211,153,0.15)',
        }}>
          <span style={{ fontSize: 16, marginRight: 6 }}>🎉</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>약 {readingTimeMin}분 읽기 완료</span>
          {related.length > 0 && (
            <Link href={`/blog/${related[0].slug}`} style={{
              display: 'inline-block', marginLeft: 8, padding: '4px 12px', borderRadius: 4,
              background: 'var(--brand)', color: '#fff', fontSize: 11,
              fontWeight: 500, textDecoration: 'none',
            }}>
              다음 → {related[0].title?.slice(0, 25)}...
            </Link>
          )}
        </div>
        )}

        {/* s213: 요약 보충 자료 — TLDR + 핵심 요약. 본문 위에서 끝으로 이동, default 접힘. */}
        {((post as any).tldr || (Array.isArray((post as any).key_points) && (post as any).key_points.length > 0)) && (
          <details style={{ marginTop: 'var(--sp-md)', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', listStyle: 'none' }}>
              📝 요약 보충 자료 (TLDR · 핵심 요약)
            </summary>
            <div style={{ marginTop: 12 }}>
              <BlogHeroExtras
                tldr={(post as any).tldr}
                keyPoints={(post as any).key_points}
                readingMinutes={(post as any).reading_minutes}
                readingTimeMinFallback={post.reading_time_min}
              />
            </div>
          </details>
        )}

        {/* s213: 이 글 정보 — 작성자 / 카테고리 / 출처. 태그는 BlogFooterMeta(article 외부)에서 노출. */}
        <section
          aria-labelledby="blog-sec-meta"
          style={{
            marginTop: 'var(--sp-md)', padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7,
          }}
        >
          <h2 id="blog-sec-meta" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', margin: 0 }}>이 글 정보</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            {/* 작성자 */}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span aria-hidden style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'var(--brand-bg)', color: 'var(--brand)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 500, flexShrink: 0,
              }}>{(post.author_name || '카더라').charAt(0)}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{post.author_name || '카더라 부동산팀'}</span>
              {post.author_role && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>· {post.author_role}</span>}
            </span>
            {/* 카테고리 / 서브카테고리 */}
            <span aria-hidden style={{ color: 'var(--text-tertiary)' }}>|</span>
            <span>
              {(({ stock: '주식 분석', apt: '청약 분석', unsold: '미분양 분석', finance: '재테크', general: '생활' } as Record<string, string>)[post.category] || post.category)}
              {(post as any).sub_category && <span style={{ color: 'var(--text-tertiary)' }}> · {(post as any).sub_category}</span>}
            </span>
            {/* 출처 type */}
            {post.source_type && (
              <>
                <span aria-hidden style={{ color: 'var(--text-tertiary)' }}>|</span>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-xl)', background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}>
                  {post.source_type}
                </span>
              </>
            )}
          </div>
        </section>

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
            <section aria-labelledby="blog-sec-refs" style={{ marginTop: 'var(--sp-xl)', padding: 'var(--sp-md) var(--card-p)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <h2 id="blog-sec-refs" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 var(--sp-sm)' }}>참고자료</h2>
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

        {/* s185: BlogMidGate 제거. s7-1 에서 게이트 전면 제거 */}

        {/* s184: RelatedBlogsSection 도 댓글 아래로 이동 — 본문 흐름 보호. */}

        {/* Session D: 본문 끝 CTA (비로그인만) */}
        {!isLoggedIn && <BlogEndCTA slug={slug} isLoggedIn={false} />}
        {/* s183: SignupPopupModal 제거. s7-1 에서 게이트 전면 제거 */}

        {/* s172: BlogFooterMeta 댓글 직후로 이동 (article 외부) */}
      </article>


      {/* 댓글 섹션 — D안 컴팩트 리스트 */}
      <BlogCommentCTA commentCount={comments.length} />
      <div id="blog-comments" style={{ marginBottom: 'var(--sp-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>댓글</span>
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
            <Link href={`/login?redirect=/blog/${slug}&source=blog_comment`} style={{ color: 'var(--brand)', fontWeight: 500, textDecoration: 'none' }}>로그인</Link>하면 의견을 남길 수 있어요
          </div>
        )}

        {/* 댓글 목록 */}
        <div>
          {comments.map((c: Record<string, any>) => {
            const nick = c.author_name || c.profiles?.nickname || '사용자';
            return (
              <div key={c.id} style={{ display: 'flex', gap: 10, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: getAvatarColor(nick), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 500 }}>
                  {nick[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{nick}</span>
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

      {/* v3 커밋6: 이 글이 다루는 현장 — 블로그에서 현장 페이지로 가는 동선이 없었다.
          hub_apt_slug 가 있는 글에만 낸다 (발행 8,833편 중 1,790편). */}
      {hubSite && (
        <Link
          href={`/apt/${hubSite.slug}`}
          className="kd-lrow"
          style={{ textDecoration: 'none', color: 'inherit', marginTop: 20, borderTop: '1px solid var(--border)' }}
        >
          <span className="kd-lrow-k is-soon">현장</span>
          <span style={{ minWidth: 0 }}>
            <span className="kd-lrow-t">{hubSite.name}</span>
            <span className="kd-lrow-m">
              <span>{[hubSite.region, '분양 정보 · 공급 · 일정'].filter(Boolean).join(' · ')}</span>
            </span>
          </span>
          <span className="kd-lrow-r" style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}>보기 ›</span>
        </Link>
      )}

      {/* S4-4 P1: 본문 하단 / 관련 글 위. 블로그에는 상단 앵커를 넣지 않는다 —
          읽는 흐름을 끊지 않고, 상세 페이지처럼 스크롤이 길지도 않다. */}
      {leadSite && (
        <LeadForm
          siteSlug={leadSite.slug}
          siteName={leadSite.name}
          region={leadSite.region}
          sigungu={leadSite.sigungu}
          lifecycleStage={leadSite.lifecycle_stage}
          variant="blog"
        />
      )}

      {/* s184: 추천 글 + RelatedContentCard — 댓글 아래로 이동 */}
      {(
        <div style={{ marginTop: 24 }}>
          <RelatedBlogsSection blogId={post.id} />
          <RelatedContentCard type="blog" showSignup={false} />
        </div>
      )}

      {/* s184: 면책 공지 통합 — 최하단 + 접힌 상태 (details/summary). YMYL + 자동생성 면책을 한 블록으로. */}
      {(() => {
        const isYmyl = post.category === 'stock' || post.category === 'finance' || post.category === 'apt' || post.category === 'unsold';
        const isAuto = post.source_type === 'auto';
        if (!isYmyl && !isAuto) return null;
        return (
          <details style={{
            marginTop: 24,
            marginBottom: 16,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '12px 16px',
          }}>
            <summary style={{
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-tertiary)',
              listStyle: 'none',
            }}>
              ⚠️ 투자 관련 안내 (펼쳐서 확인)
            </summary>
            <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.75 }}>
              {isYmyl && (
                <YMYLBanner
                  category={post.category}
                  dataDate={post.data_date}
                  sourceRef={post.source_ref}
                  authorName={post.author_name}
                  authorRole={post.author_role}
                />
              )}
              {isAuto && (
                <p style={{ margin: '8px 0 0' }}>
                  본 콘텐츠는 공공 데이터(국토교통부, 한국거래소, 금융위원회 등) 기반의 정보 제공 목적이며 투자 권유가 아닙니다.
                  {post.data_date && <> 데이터 기준일: {post.data_date}.</>}
                  {post.source_ref && <> 출처: {post.source_ref}.</>}
                </p>
              )}
            </div>
          </details>
        );
      })()}

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
        <section aria-labelledby="blog-sec-popular" style={{ marginBottom: 'var(--sp-xl)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--brand)', fontWeight: 600, marginBottom: 3 }}>POPULAR — 이번주</div>
          <h2 id="blog-sec-popular" style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 var(--sp-sm)' }}>이번주 인기글</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {related.slice(0, 3).map((r: any, i: number) => (
              <Link key={r.slug} href={`/blog/${r.slug}`} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', textDecoration: 'none', color: 'inherit',
              }}>
                <span style={{ fontSize: 18, fontWeight: 600, color: i === 0 ? 'var(--accent-red)' : i === 1 ? 'var(--warning)' : 'var(--text-tertiary)', minWidth: 24 }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title?.slice(0, 40)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 관련 글 */}
      {(related ?? []).length > 0 && (
        <section aria-labelledby="blog-sec-related" style={{ marginBottom: 'var(--sp-xl)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--brand)', fontWeight: 600, marginBottom: 3 }}>RELATED — 함께 보기</div>
          <h2 id="blog-sec-related" style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 var(--sp-sm)' }}>관련 글</h2>
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
        </section>
      )}

      {/* 관련 부동산 현장 (내부 링크 SEO) */}
      {relatedSites.length > 0 && (
        <div style={{ marginBottom: 'var(--sp-xl)' }}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>🏢 관련 현장 정보</div>
          <div style={{ display: 'flex', gap: 'var(--sp-sm)', flexWrap: 'wrap' }}>
            {relatedSites.map((s: Record<string, any>) => (
              <Link key={s.slug} href={`/apt/${s.slug}`} style={{ flex: '1 1 calc(33.3% - 6px)', minWidth: 140, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', textDecoration: 'none', transition: 'border-color var(--transition-fast)' }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{s.region} {s.sigungu || ''}</div>
              </Link>
            ))}
          </div>
        </div>
      )}


      {/* 세션74: 유용한 도구 + 뉴스레터 */}
      <div style={{ marginBottom: 'var(--sp-xl)' }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>🛠️ 유용한 도구</div>
        <div style={{ display: 'flex', gap: 'var(--sp-sm)', flexWrap: 'wrap' }}>
          {(post.category === 'apt' || post.category === 'unsold') && (
            <Link href="/apt/diagnose" style={{ flex: '1 1 calc(50% - 4px)', minWidth: 140, padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--brand-border)', background: 'var(--bg-surface)', textDecoration: 'none' }}>
              <div style={{ fontSize: 14, marginBottom: 4 }}>🎯</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>청약 가점 계산기</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>무주택·부양가족·청약통장 가점 자동 계산</div>
            </Link>
          )}
          {post.category === 'stock' && (
            <Link href="/stock/compare" style={{ flex: '1 1 calc(50% - 4px)', minWidth: 140, padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--brand-border)', background: 'var(--bg-surface)', textDecoration: 'none' }}>
              <div style={{ fontSize: 14, marginBottom: 4 }}>⚖️</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>종목 비교</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>국내외 종목 핵심 지표 비교</div>
            </Link>
          )}
          <Link href="/apt/complex" style={{ flex: '1 1 calc(50% - 4px)', minWidth: 140, padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', textDecoration: 'none' }}>
            <div style={{ fontSize: 14, marginBottom: 4 }}>🏘️</div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>단지백과</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>전국 34,500+ 아파트 시세 검색</div>
          </Link>
        </div>
      </div>


      {/* 관련 종목 (내부 링크 SEO) */}
      {relatedStocks.length > 0 && (
        <div style={{ marginBottom: 'var(--sp-xl)' }}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>📈 관련 종목</div>
          <div style={{ display: 'flex', gap: 'var(--sp-sm)', flexWrap: 'wrap' }}>
            {relatedStocks.map((s: Record<string, any>) => {
              const pct = Number(s.change_pct);
              const isUp = pct > 0;
              return (
                <Link key={s.symbol} href={`/stock/${s.symbol}`} style={{ flex: '1 1 calc(33.3% - 6px)', minWidth: 140, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', textDecoration: 'none' }}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
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
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>📊 핵심 지표</div>
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

      {/* v3 커밋6 · 데스크탑 우측 레일 (≥1024px). 목차를 여기로 빼 본문 폭을 확보한다.
           ⚠️ 리드폼은 여기 두지 않았다. 페이지에 form 이 두 벌이 되면 id("lead-form" /
              "kd-lead-name")도 두 벌이 되고, 리드 도달이 이 작업의 최대 리스크다.
              레일에 실제 폼을 넣으려면 LeadForm 에 id 접두사 prop 이 먼저 필요하다.
           ⚠️ 블로그에는 폼으로 가는 앵커를 넣지 않는다 (기존 규약). */}
      <aside className="blog-detail-rail" aria-label="이 글 살펴보기">
        {toc.length >= 3 && (
          <div className="kd-rail-panel">
            <h2>목차</h2>
            <BlogTocList toc={toc} />
          </div>
        )}
        {hubSite && (
          <div className="kd-rail-panel">
            <h2>이 글이 다루는 현장</h2>
            <Link href={`/apt/${hubSite.slug}`}>{hubSite.name}</Link>
            {hubSite.region && <Link href={`/apt/region/${encodeURIComponent(hubSite.region)}`}>{hubSite.region} 분양 현장</Link>}
          </div>
        )}
        {sidebarRelatedLinks.length > 0 && (
          <div className="kd-rail-panel">
            <h2>함께 보기</h2>
            {sidebarRelatedLinks.slice(0, 6).map((link, i) => (
              <Link key={i} href={link.href}>{link.title}</Link>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
