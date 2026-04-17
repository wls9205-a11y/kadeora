import { AptViewTracker } from '@/components/ViewTracker';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';
import { generateAptSlug, isNumericId } from '@/lib/apt-slug';
import { notFound, permanentRedirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import AptCommentInline from '@/components/AptCommentInline';
import ShareButtons from '@/components/ShareButtons';
import SectionShareButton from '@/components/SectionShareButton';
import KakaoDirectShare from '@/components/KakaoDirectShare';
import Disclaimer from '@/components/Disclaimer';
import AptImageGallery from '@/components/AptImageGallery';
import { sanitizeSearchQuery } from '@/lib/sanitize';
import { getDisplayInterestCount, formatInterestText, formatInterestOrViews } from '@/lib/interest-utils';

const AptPriceTrendChart = dynamic(() => import('@/components/charts/AptPriceTrendChart'));
const InterestRegistration = dynamic(() => import('@/components/InterestRegistration'));
import RelatedContentCard from '@/components/RelatedContentCard';
import LoginGate from '@/components/LoginGate';
import AptBookmarkButton from '@/components/AptBookmarkButton';
const RegulationBadges = dynamic(() => import('@/components/RegulationBadges'));
const CostSimulator = dynamic(() => import('@/components/CostSimulator'));
const ContentLock = dynamic(() => import("@/components/ContentLock"));
const KpiCards = dynamic(() => import('@/components/apt/KpiCards'));
const ComplexScale = dynamic(() => import('@/components/apt/ComplexScale'));
const AptCommentSection = dynamic(() => import('@/components/apt/AptCommentSection'));

export const revalidate = 3600;
export const maxDuration = 60;
interface Props { params: Promise<{ id: string }> }

async function resolveParam(rawId: string) {
  const decoded = decodeURIComponent(rawId);
  // 특수문자(|, ;, ', " 등) 제거 — PostgREST 쿼리 인젝션/에러 방지
  const sanitized = decoded.replace(/[|;'"\\<>]/g, '');
  const sb = getSupabaseAdmin();
  if (isNumericId(sanitized)) {
    const isHmno = sanitized.length >= 7;
    const { data: apt } = isHmno
      ? await sb.from('apt_subscriptions').select('id, house_nm, house_manage_no').eq('house_manage_no', sanitized).maybeSingle()
      : await sb.from('apt_subscriptions').select('id, house_nm, house_manage_no').eq('id', Number(sanitized)).maybeSingle();
    if (apt?.house_nm) {
      const slug = generateAptSlug(apt.house_nm);
      if (slug) return { type: 'redirect' as const, slug };
    }
    return { type: 'not_found' as const };
  }
  return { type: 'slug' as const, slug: sanitized };
}

async function fetchUnifiedData(slug: string) {
  const sb = getSupabaseAdmin();
  const APT_COLS = 'id,slug,name,site_type,region,sigungu,dong,address,description,seo_title,seo_description,builder,developer,total_units,built_year,move_in_date,status,is_active,content_score,interest_count,page_views,comment_count,images,key_features,faq_items,nearby_facilities,nearby_station,school_district,price_min,price_max,price_comparison,search_trend,latitude,longitude,source_ids,created_at,updated_at';

  // Phase 1: apt_sites — exact slug → multi-stage fuzzy fallback
  let { data: site } = await (sb as any).from('apt_sites').select(APT_COLS).eq('slug', slug).maybeSingle();

  if (!site && slug.length > 2) {
    // Helper: extract Korean-only portion (remove all latin letters & standalone digits)
    const koreanOnly = slug.replace(/-/g, ' ').replace(/[a-z0-9]+/gi, '').replace(/\s+/g, ' ').trim();
    const slugNoAlpha = slug.replace(/[a-z]+/g, ''); // strip all english letters from slug

    // Stage 2: slug with letters stripped (a3bl→3, 중흥s-클래스→중흥-클래스)
    if (slugNoAlpha !== slug && slugNoAlpha.length > 3) {
      const { data } = await (sb as any).from('apt_sites').select(APT_COLS).eq('slug', slugNoAlpha).maybeSingle();
      if (data) site = data;
    }

    // Stage 3: slug with all alphanumeric suffix stripped (메트로시티a3bl→메트로시티)
    if (!site) {
      const noSuffix = slug.replace(/[a-z0-9]+$/i, '').replace(/-+$/, '');
      if (noSuffix !== slug && noSuffix.length > 3) {
        const { data } = await (sb as any).from('apt_sites').select(APT_COLS).eq('slug', noSuffix).maybeSingle();
        if (data) site = data;
      }
    }

    // Stage 4: Korean-only ilike search on apt_sites.name (min 2 chars)
    if (!site && koreanOnly.length >= 2) {
      const searchTerm = koreanOnly.slice(0, 20);
      const { data } = await (sb as any).from('apt_sites').select(APT_COLS)
        .ilike('name', `%${searchTerm}%`).eq('is_active', true)
        .order('content_score', { ascending: false }).limit(1).maybeSingle();
      if (data) site = data;
    }

    // Stage 5: slug word-parts ilike on apt_sites.slug (동성로-sk-leaders-view → %동성로%sk%leaders%view%)
    if (!site) {
      const slugWords = slug.split('-').filter(w => w.length > 0).join('%');
      if (slugWords.length > 3) {
        const { data } = await (sb as any).from('apt_sites').select(APT_COLS)
          .ilike('slug', `%${slugWords}%`).eq('is_active', true)
          .order('content_score', { ascending: false }).limit(1).maybeSingle();
        if (data) site = data;
      }
    }
  }
  const sourceIds = (site?.source_ids || {}) as Record<string, string>;

  // SEO 분석 텍스트 (database.ts에 없는 컬럼 — as any 패턴)
  let analysisText: string | null = null;
  if (site?.id) {
    const { data: at } = await (sb as any).from('apt_sites').select('analysis_text').eq('id', site.id).maybeSingle();
    analysisText = at?.analysis_text || null;
  }

  // Phase 2: 소스 데이터 병렬 조회 (sub + unsold + redev 동시)
  const [subResult, unsoldResult, redevResult] = await Promise.allSettled([
    sourceIds.subscription_id
      ? sb.from('apt_subscriptions').select('*').eq('id', Number(sourceIds.subscription_id)).maybeSingle()
      : Promise.resolve({ data: null }),
    sourceIds.unsold_id
      ? sb.from('unsold_apts').select('*').eq('id', Number(sourceIds.unsold_id)).maybeSingle()
      : Promise.resolve({ data: null }),
    sourceIds.redev_id
      ? sb.from('redevelopment_projects').select('*').eq('id', Number(sourceIds.redev_id)).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let sub = subResult.status === 'fulfilled' ? (subResult.value as { data: any })?.data : null;
  let unsold = unsoldResult.status === 'fulfilled' ? (unsoldResult.value as { data: any })?.data : null;
  let redev = redevResult.status === 'fulfilled' ? (redevResult.value as { data: any })?.data : null;

  // sub 폴백: 이름 기반 검색 (Korean-only로 검색 범위 확대)
  const nameGuess = site?.name || slug.replace(/-/g, ' ');
  const koreanNameGuess = nameGuess.replace(/[a-z0-9]+/gi, '').replace(/\s+/g, ' ').trim();
  if (!sub) {
    // 1차: 전체 이름 정확 매칭
    let { data } = await sb.from('apt_subscriptions').select('*').ilike('house_nm', nameGuess).order('id', { ascending: false }).limit(1).maybeSingle();
    // 2차: 한글만으로 부분 매칭
    if (!data && koreanNameGuess.length >= 2) {
      ({ data } = await sb.from('apt_subscriptions').select('*').ilike('house_nm', `%${koreanNameGuess}%`).order('id', { ascending: false }).limit(1).maybeSingle());
    }
    sub = data;
  }

  // unsold 폴백: 이름 기반 검색
  if (!unsold) {
    let { data } = await sb.from('unsold_apts').select('*').ilike('house_nm', nameGuess).eq('is_active', true).order('id', { ascending: false }).limit(1).maybeSingle();
    if (!data && koreanNameGuess.length >= 2) {
      ({ data } = await sb.from('unsold_apts').select('*').ilike('house_nm', `%${koreanNameGuess}%`).eq('is_active', true).order('id', { ascending: false }).limit(1).maybeSingle());
    }
    unsold = data;
  }

  // redev 폴백: 이름 기반 검색 (district_name 또는 address)
  if (!redev) {
    const searchName = koreanNameGuess.length >= 2 ? koreanNameGuess : nameGuess;
    const { data } = await sb.from('redevelopment_projects').select('*').eq('is_active', true)
      .or(`district_name.ilike.%${searchName}%,address.ilike.%${searchName}%`)
      .order('id', { ascending: false }).limit(1).maybeSingle();
    redev = data;
  }

  if (!site && !sub && !unsold && !redev) return null;

  const name = sub?.house_nm || site?.name || unsold?.house_nm || redev?.district_name || slug.replace(/-/g, ' ');
  const region = sub?.region_nm || site?.region || unsold?.region_nm || redev?.region || '';

  // Phase 3: 관련 데이터 전부 병렬 (trades + blogs + posts + nearby + view increment)
  const termBlog = sanitizeSearchQuery(name.length > 4 ? name.slice(0, 4) : name, 20);
  const termPost = sanitizeSearchQuery(name.length > 3 ? name.slice(0, 3) : name, 20);
  const rShort = sanitizeSearchQuery(region.slice(0, 2), 10);

  const sigungu = site?.sigungu || sub?.hssply_adres?.split(' ').slice(1, 2).join('') || '';

  const [tradesR, blogsR, postsR, nearbyR, sameBuilderR, regionPriceR, regionTradesR, complexR] = await Promise.allSettled([
    sb.from('apt_transactions').select('id, apt_name, deal_date, deal_amount, exclusive_area, floor, built_year').eq('apt_name', name).order('deal_date', { ascending: false }).limit(30),
    termBlog ? sb.from('blog_posts').select('slug, title, view_count, published_at').eq('is_published', true).or(`title.ilike.%${termBlog}%,title.ilike.%${rShort} 청약%,title.ilike.%${rShort} 부동산%`).order('view_count', { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    termPost ? sb.from('posts').select('id, title, created_at, comments_count').eq('is_deleted', false).ilike('title', `%${termPost}%`).order('created_at', { ascending: false }).limit(3) : Promise.resolve({ data: [] }),
    region ? sb.from('apt_sites').select('slug, name, site_type, region, sigungu, total_units, status').eq('is_active', true).eq('region', region).neq('slug', slug).gte('content_score', 25).order('interest_count', { ascending: false }).limit(4) : Promise.resolve({ data: [] }),
    // 같은 시공사 다른 현장 (분양가 포함)
    (sub?.constructor_nm || site?.builder) ? sb.from('apt_subscriptions').select('id, house_nm, region_nm, tot_supply_hshld_co, rcept_bgnde, house_type_info').ilike('constructor_nm', `%${(sub?.constructor_nm || site?.builder || '').split('(')[0].split('주식')[0].trim()}%`).neq('house_nm', name).order('rcept_bgnde', { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    region ? sb.from('apt_sites').select('price_min, price_max').eq('region', region).eq('is_active', true).gt('price_min', 0).gt('price_max', 0).limit(100) : Promise.resolve({ data: [] }),
    sigungu ? sb.from('apt_transactions').select('apt_name, deal_date, deal_amount, exclusive_area, floor').ilike('sigungu', `%${sigungu}%`).neq('apt_name', name).order('deal_date', { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
    // 단지백과 — 같은 시군구 기존 아파트 시세 (시세비교/전세가율/평당가)
    sigungu ? (sb as any).from('apt_complex_profiles').select('apt_name, built_year, latest_sale_price, avg_sale_price_pyeong, latest_jeonse_price, jeonse_ratio, total_households, price_change_1y, sale_count_1y').ilike('sigungu', `%${sigungu}%`).gt('latest_sale_price', 0).order('latest_sale_price', { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
  ]);

  const trades = tradesR.status === 'fulfilled' ? (tradesR.value as { data: any })?.data || [] : [];
  const relatedBlogs = blogsR.status === 'fulfilled' ? (blogsR.value as { data: any })?.data || [] : [];
  const relatedPosts = postsR.status === 'fulfilled' ? (postsR.value as { data: any })?.data || [] : [];
  const nearbySites = nearbyR.status === 'fulfilled' ? (nearbyR.value as { data: any })?.data || [] : [];
  const sameBuilderSites = sameBuilderR.status === 'fulfilled' ? (sameBuilderR.value as { data: any })?.data || [] : [];
  const regionTrades = regionTradesR.status === 'fulfilled' ? (regionTradesR.value as { data: any })?.data || [] : [];
  const complexProfiles = complexR.status === 'fulfilled' ? (complexR.value as { data: any })?.data || [] : [];
  
  // 지역 시세 벤치마크 계산
  const regionSites = regionPriceR.status === 'fulfilled' ? (regionPriceR.value as { data: any })?.data || [] : [];
  const regionBenchmark = (() => {
    if (regionSites.length < 3) return null;
    const mins = regionSites.map((s: any) => s.price_min).filter((v: number) => v > 0);
    const maxs = regionSites.map((s: any) => s.price_max).filter((v: number) => v > 0);
    if (mins.length < 3) return null;
    return {
      avgMin: Math.round(mins.reduce((a: number, b: number) => a + b, 0) / mins.length),
      avgMax: Math.round(maxs.reduce((a: number, b: number) => a + b, 0) / maxs.length),
      lowest: Math.min(...mins),
      highest: Math.max(...maxs),
      count: regionSites.length,
    };
  })();

  // Fire-and-forget: 조회수 증가
  // view count moved to client-side API call (ViewTracker component)

  return { site, sub, unsold, redev, trades, relatedBlogs, relatedPosts, nearbySites, sameBuilderSites, regionBenchmark, regionTrades, complexProfiles, name, region, sigungu, slug, analysisText };
}

// generateStaticParams 제거 — 전량 ISR on-demand (revalidate=3600)
// 빌드 시 Supabase 연결 불필요, 첫 요청 시 생성+캐시

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params;
    const resolved = await resolveParam(id);
    if (resolved.type !== 'slug') return {};
    const d = await fetchUnifiedData(resolved.slug);
    if (!d) return {};

    const tl: Record<string, string> = { subscription: '분양정보 · 청약일정', redevelopment: '재개발 · 진행현황', unsold: '미분양 현황', trade: '실거래가 · 시세', landmark: '시세 · 분석' };
    const st = d.site?.site_type || (d.sub ? 'subscription' : d.unsold ? 'unsold' : d.trades?.length ? 'trade' : 'redevelopment');
    const title = d.site?.seo_title || `${d.name} ${tl[st] || '부동산 정보'}`;
    const units = d.site?.total_units || d.sub?.tot_supply_hshld_co;
    const uStr = units ? `${Number(units).toLocaleString()}세대` : '';
    const builder = d.site?.builder || d.sub?.constructor_nm || '';
    const desc = d.site?.seo_description || `${d.region} ${d.site?.sigungu || ''} ${d.name} ${uStr} ${builder}. 모집공고 요약, 분양가격, 청약일정, 견본주택, 실거래가까지 한눈에.`.trim();
    const siteFirstImg = Array.isArray(d.site?.images) && (d.site.images[0] as any)?.url ? ((d.site.images[0] as any).thumbnail || (d.site.images[0] as any).url).replace(/^http:\/\//, 'https://') : null;
    const ogImg = siteFirstImg || `${SITE_URL}/api/og?title=${encodeURIComponent(d.name)}&design=2&subtitle=${encodeURIComponent(`${d.region} ${d.site?.sigungu || ''} · ${uStr} ${builder}`.trim())}`;

    const priceStr = d.site?.price_min && d.site?.price_max
      ? ` ${d.site.price_min >= 10000 ? `${(d.site.price_min/10000).toFixed(1)}억` : `${d.site.price_min.toLocaleString()}만`}~${d.site.price_max >= 10000 ? `${(d.site.price_max/10000).toFixed(1)}억` : `${d.site.price_max.toLocaleString()}만`}`
      : '';
    return {
      title: `${title}${priceStr} — ${d.region} | 카더라`, description: desc,
      alternates: { canonical: `${SITE_URL}/apt/${resolved.slug}` },
      robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const, 'max-video-preview': -1, googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const } },
      openGraph: { title, description: desc, url: `${SITE_URL}/apt/${resolved.slug}`, siteName: '카더라', locale: 'ko_KR', type: 'article', images: [{ url: ogImg, width: 1200, height: 630, alt: `${d.name} 분양정보` }, { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent(d.name)}&category=apt`, width: 630, height: 630, alt: `${d.name}` }] },
      twitter: { card: 'summary_large_image', title, description: desc, site: '@kadeora_app', images: [ogImg] },
      other: {
        'article:published_time': d.site?.created_at || d.sub?.fetched_at || '',
        'article:modified_time': d.site?.updated_at || new Date().toISOString(),
        'article:section': '부동산',
        'article:tag': `${d.name},${d.region},${d.site?.sigungu || ''},${tl[st] || '분양'},청약,분양가,분양가격,아파트,모집공고,입주자모집공고,견본주택,모델하우스,청약일정,당첨확률,가점,평면도,조감도,입주예정`,
        // Kakao/Facebook price display
        ...(d.site?.price_min ? { 'og:price:amount': String(d.site.price_min * 10000), 'og:price:currency': 'KRW' } : {}),
        // Naver specific
        'naver:written_time': (() => { const d8 = d.sub?.rcept_bgnde; if (d8 && d8.length === 8) return `${d8.slice(0,4)}-${d8.slice(4,6)}-${d8.slice(6,8)}`; return d.site?.updated_at || d.site?.created_at || ''; })(),
        'naver:updated_time': d.site?.updated_at || new Date().toISOString(),
        'naver:author': '카더라',
        'og:updated_time': d.site?.updated_at || new Date().toISOString(),
        // Daum
        'dg:plink': `${SITE_URL}/apt/${resolved.slug}`,
        // GEO (지역 검색 노출)
        ...((() => {
          const GEO: Record<string, { code: string; lat: string; lng: string }> = { '서울': { code: 'KR-11', lat: '37.5665', lng: '126.9780' }, '부산': { code: 'KR-26', lat: '35.1796', lng: '129.0756' }, '대구': { code: 'KR-27', lat: '35.8714', lng: '128.6014' }, '인천': { code: 'KR-28', lat: '37.4563', lng: '126.7052' }, '광주': { code: 'KR-29', lat: '35.1595', lng: '126.8526' }, '대전': { code: 'KR-30', lat: '36.3504', lng: '127.3845' }, '울산': { code: 'KR-31', lat: '35.5384', lng: '129.3114' }, '세종': { code: 'KR-36', lat: '36.4800', lng: '127.2600' }, '경기': { code: 'KR-41', lat: '37.4138', lng: '127.5183' }, '강원': { code: 'KR-42', lat: '37.8228', lng: '128.1555' }, '충북': { code: 'KR-43', lat: '36.6357', lng: '127.4917' }, '충남': { code: 'KR-44', lat: '36.5184', lng: '126.8000' }, '전북': { code: 'KR-45', lat: '35.8203', lng: '127.1088' }, '전남': { code: 'KR-46', lat: '34.8161', lng: '126.4629' }, '경북': { code: 'KR-47', lat: '36.4919', lng: '128.8889' }, '경남': { code: 'KR-48', lat: '35.4606', lng: '128.2132' }, '제주': { code: 'KR-50', lat: '33.4996', lng: '126.5312' } };
          // apt_sites에 latitude/longitude가 있으면 동적 좌표, 없으면 지역 코드 폴백
          if (d.site?.latitude && d.site?.longitude) {
            const g = Object.entries(GEO).find(([k]) => d.region?.includes(k));
            return {
              'geo.region': g?.[1]?.code || 'KR',
              'geo.placename': d.region + ' ' + (d.site?.sigungu || ''),
              'geo.position': `${d.site.latitude};${d.site.longitude}`,
              'ICBM': `${d.site.latitude}, ${d.site.longitude}`,
            } as Record<string, string>;
          }
          const g = Object.entries(GEO).find(([k]) => d.region?.includes(k));
          if (g) return {
            'geo.region': g[1].code,
            'geo.placename': d.region + ' ' + (d.site?.sigungu || ''),
            'geo.position': `${g[1].lat};${g[1].lng}`,
            'ICBM': `${g[1].lat}, ${g[1].lng}`,
          } as Record<string, string>;
          return {} as Record<string, string>;
        })()),
      },
    };
  } catch { return {}; }
}

function fmtAmount(n: number | null) { if (!n) return '-'; return n >= 10000 ? `${(n / 10000).toFixed(1)}억` : `${n.toLocaleString()}만`; }
function fmtYM(s: string | null) { if (!s) return null; return `${s.slice(0, 4)}년 ${parseInt(s.slice(4, 6))}월`; }

const ct: React.CSSProperties = { fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)', display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 8px' };
const rw: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-sm)', gap: 'var(--sp-sm)' };
const rl: React.CSSProperties = { color: 'var(--text-tertiary)', flexShrink: 0, whiteSpace: 'nowrap' };
const rv: React.CSSProperties = { color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right', wordBreak: 'keep-all', overflowWrap: 'break-word', minWidth: 0 };
const tLabel: Record<string, string> = { subscription: '분양', redevelopment: '재개발', unsold: '미분양', landmark: '랜드마크', complex: '기존단지', trade: '실거래' };
const tBg: Record<string, string> = { subscription: 'rgba(52,211,153,0.2)', redevelopment: 'rgba(183,148,255,0.15)', unsold: 'rgba(255,107,107,0.15)', landmark: 'rgba(56,189,248,0.15)', complex: 'rgba(56,189,248,0.15)', trade: 'rgba(251,191,36,0.15)' };
const tClr: Record<string, string> = { subscription: '#2EE8A5', redevelopment: '#B794FF', unsold: '#FF6B6B', landmark: '#38BDF8', complex: '#38BDF8', trade: '#FBBF24' };
const STAGES = ['정비구역지정', '조합설립', '사업시행인가', '관리처분', '착공', '준공'];

export default async function AptUnifiedPage({ params }: Props) {
  const { id } = await params;

  let resolved;
  try {
    resolved = await resolveParam(id);
  } catch {
    notFound();
  }
  if (!resolved) notFound();
  if (resolved!.type === 'redirect' && resolved!.slug) permanentRedirect(`/apt/${encodeURIComponent(resolved!.slug)}`);
  if (resolved!.type !== 'slug') notFound();

  let d;
  try {
    d = await fetchUnifiedData(resolved!.slug!);
  } catch {
    notFound();
  }
  if (!d) notFound();
  const { site, sub, unsold, redev, trades, relatedBlogs, relatedPosts, nearbySites, sameBuilderSites, regionBenchmark, regionTrades, complexProfiles, name, region, sigungu, slug, analysisText } = d!;
  const sType = site?.site_type || (sub ? 'subscription' : unsold ? 'unsold' : redev ? 'redevelopment' : trades.length > 0 ? 'trade' : 'subscription');
  const features = Array.isArray(site?.key_features) ? site.key_features : [];
  const dbFaq = Array.isArray(site?.faq_items) ? site.faq_items as { q: string; a: string }[] : [];
  // DB FAQ가 없으면 자동 생성 (네이버 FAQ 리치스니펫 확보)
  const faq: { q: string; a: string }[] = dbFaq.length > 0 ? dbFaq : [
    { q: `${name} 위치가 어디인가요?`, a: `${name}은(는) ${region} ${site?.sigungu || ''} ${site?.dong || site?.address || ''}에 위치해 있습니다. ${site?.nearby_station || sub?.nearest_station ? `최근접 역은 ${site?.nearby_station || sub?.nearest_station}입니다.` : ''}` },
    ...(sub?.rcept_bgnde ? [{ q: `${name} 청약 일정은 언제인가요?`, a: `${name}의 청약 접수 기간은 ${sub.rcept_bgnde} ~ ${sub.rcept_endde || ''}입니다. ${sub.przwner_presnatn_de ? `당첨자 발표일은 ${sub.przwner_presnatn_de}입니다.` : ''} ${sub.mvn_prearnge_ym ? `입주 예정은 ${fmtYM(sub.mvn_prearnge_ym)}입니다.` : ''}` }] : []),
    { q: `${name} 시공사(건설사)는 어디인가요?`, a: `${name}의 시공사는 ${site?.builder || sub?.constructor_nm || '미정'}입니다. ${site?.developer || sub?.developer_nm ? `시행사는 ${site?.developer || sub?.developer_nm}입니다.` : ''} ${sub?.total_households ? `총 ${sub.total_households}세대 규모이며, ` : ''}공급 ${site?.total_units || sub?.tot_supply_hshld_co || '미정'}세대입니다.` },
    ...(site?.price_min || site?.price_max ? [{ q: `${name} 분양가는 얼마인가요?`, a: `${name}의 분양가는 ${site?.price_min ? fmtAmount(site.price_min) : ''}${site?.price_min && site?.price_max ? ' ~ ' : ''}${site?.price_max ? fmtAmount(site.price_max) : ''} (최고분양가 기준)입니다. 타입별 상세 분양가는 아래 평형별 공급 테이블에서 확인하세요.` }] : []),
    ...(sub ? [{ q: `${name} 모집공고 핵심 내용은 무엇인가요?`, a: `${name}의 입주자모집공고 핵심 내용: ${sub.is_price_limit ? '분양가상한제 적용, ' : ''}${sub.constructor_nm || site?.builder ? `시공사 ${sub.constructor_nm || site?.builder}, ` : ''}총 ${sub.tot_supply_hshld_co || site?.total_units || '미정'}세대 공급. ${sub.mvn_prearnge_ym ? `입주 예정 ${fmtYM(sub.mvn_prearnge_ym)}.` : ''} 카더라에서 모집공고 핵심 요약을 확인하세요.` }] : []),
    ...(sub?.is_price_limit !== undefined ? [{ q: `${name}은 분양가상한제 적용 현장인가요?`, a: `${name}은(는) 분양가상한제 ${sub.is_price_limit ? '적용 현장입니다. 분양가상한제 적용 시 전매제한 및 거주의무 등의 규제가 적용될 수 있습니다.' : '미적용 현장입니다.'}` }] : []),
    ...(sub ? [{ q: `${name} 견본주택(모델하우스) 위치는 어디인가요?`, a: `${name}의 견본주택(모델하우스) ${sub.model_house_addr ? `주소는 ${sub.model_house_addr}입니다.` : '위치는 입주자모집공고문에서 확인할 수 있습니다.'} 청약홈에서 모집공고 원문을 확인하세요.` }] : []),
  ].filter(f => f.a.trim().length > 10);
  const redevStage = (site?.source_ids as Record<string, string>)?.redev_stage || redev?.stage;
  const noindex = site ? (site.content_score ?? 0) < 40 : false;

  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const subSt = sub ? (!sub.rcept_bgnde ? 'upcoming' : today >= sub.rcept_bgnde && today <= sub.rcept_endde ? 'open' : today < sub.rcept_bgnde ? 'upcoming' : 'closed') : null;
  const dDay = sub?.rcept_endde ? Math.ceil((new Date(sub.rcept_endde).getTime() - new Date(today).getTime()) / 86400000) : null;
  const SB: Record<string, { label: string; bg: string; color: string; border: string }> = {
    open: { label: '접수중', bg: 'rgba(52,211,153,0.2)', color: 'var(--accent-green)', border: 'var(--accent-green)' },
    upcoming: { label: '접수예정', bg: 'var(--accent-yellow-bg)', color: 'var(--accent-yellow)', border: 'var(--accent-yellow)' },
    closed: { label: '마감', bg: 'transparent', color: 'var(--text-tertiary)', border: 'var(--border)' },
  };
  let aptUser = null;
  try { const sbA = await createSupabaseServer(); const { data: { user } } = await sbA.auth.getUser(); aptUser = user; } catch {}
  const unsoldRate = unsold?.tot_supply_hshld_co ? Math.round(((unsold.tot_unsold_hshld_co ?? 0) / unsold.tot_supply_hshld_co) * 100) : null;

  return (
    <article style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }} itemScope itemType='https://schema.org/ApartmentComplex'>
      {noindex && <meta name="robots" content="noindex,follow" />}
      {site?.id && <AptViewTracker siteId={site.id} />}

      {/* JSON-LD 1: RealEstateListing */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'RealEstateListing', name, description: site?.description || `${region} ${name}`, url: `${SITE_URL}/apt/${slug}`, address: { '@type': 'PostalAddress', addressRegion: region, addressLocality: site?.sigungu || '', streetAddress: site?.address || sub?.hssply_adres || '', addressCountry: 'KR' }, ...(site?.total_units || sub?.tot_supply_hshld_co ? { numberOfRooms: site?.total_units || sub?.tot_supply_hshld_co } : {}), ...(site?.latitude && site?.longitude ? { geo: { '@type': 'GeoCoordinates', latitude: site.latitude, longitude: site.longitude } } : {}), ...(site?.builder || sub?.constructor_nm ? { brand: { '@type': 'Organization', name: site?.builder || sub?.constructor_nm } } : {}), ...(site?.price_min || site?.price_max ? { offers: { '@type': 'AggregateOffer', priceCurrency: 'KRW', ...(site?.price_min ? { lowPrice: site.price_min * 10000 } : {}), ...(site?.price_max ? { highPrice: site.price_max * 10000 } : {}), offerCount: site?.total_units || 1 } } : {}) }) }} />

      {/* JSON-LD 2: FAQ */}
      {faq.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }) }} />}

      {/* JSON-LD 3: Breadcrumb */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '부동산', item: `${SITE_URL}/apt` }, ...(region ? [{ '@type': 'ListItem', position: 3, name: region, item: `${SITE_URL}/apt/region/${encodeURIComponent(region)}` }] : []), { '@type': 'ListItem', position: region ? 4 : 3, name }] }) }} />

      {/* JSON-LD 4: Place + Residence (Google Maps + 네이버 지도 연동) */}
      {(site?.latitude || sub?.hssply_adres) && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Residence',
        name: name,
        description: site?.description || `${region} ${sigungu} ${name}`,
        url: `${SITE_URL}/apt/${slug}`,
        address: { '@type': 'PostalAddress', addressCountry: 'KR', addressRegion: region, addressLocality: sigungu || '', streetAddress: site?.address || sub?.hssply_adres || '' },
        ...(site?.latitude && site?.longitude ? { geo: { '@type': 'GeoCoordinates', latitude: site.latitude, longitude: site.longitude } } : {}),
        ...(site?.total_units ? { numberOfRooms: site.total_units } : {}),
        image: `${SITE_URL}/api/og?title=${encodeURIComponent(name)}&design=2&category=apt`,
      }) }} />}

      {/* JSON-LD 4b: Event */}
      {sub?.rcept_bgnde && new Date(sub.rcept_endde || sub.rcept_bgnde) >= new Date() && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Event', name: `${name} 청약 접수`, startDate: sub.rcept_bgnde, endDate: sub.rcept_endde, eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode', location: { '@type': 'VirtualLocation', url: `${SITE_URL}/apt/${slug}` }, organizer: { '@type': 'Organization', name: site?.builder || sub.constructor_nm || '청약홈', url: sub.pblanc_url || SITE_URL }, image: `${SITE_URL}/api/og?title=${encodeURIComponent(name)}&design=2&subtitle=${encodeURIComponent('청약 접수')}` }) }} />}

      {/* JSON-LD 5: Article + SpeakableSpecification (voice search, Google Discover) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: `${name} ${tLabel[sType] || '분양'} 정보`, description: site?.description || `${region} ${name}`, url: `${SITE_URL}/apt/${slug}`, datePublished: site?.created_at || sub?.fetched_at || new Date().toISOString(), dateModified: site?.updated_at || new Date().toISOString(), author: { '@type': 'Organization', name: '카더라', url: SITE_URL }, publisher: { '@type': 'Organization', name: '카더라', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icons/icon-192.png`, width: 192, height: 192 } }, image: [{ '@type': 'ImageObject', url: `${SITE_URL}/api/og?title=${encodeURIComponent(name)}&design=2&subtitle=${encodeURIComponent(region)}`, width: 1200, height: 630 }, { '@type': 'ImageObject', url: `${SITE_URL}/api/og-square?title=${encodeURIComponent(name)}&category=apt`, width: 630, height: 630 }, { '@type': 'ImageObject', url: `${SITE_URL}/api/og-chart?apt=${slug}`, width: 1200, height: 630, name: `${name} 분양가 인포그래픽` }], thumbnailUrl: `${SITE_URL}/api/og-square?title=${encodeURIComponent(name)}&category=apt`, mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/apt/${slug}` }, speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.site-description'] } }) }} />

      {/* JSON-LD 6: Product (price range → Google price chip in SERP) */}
      {/* Product 스키마 제거 — ApartmentComplex+RealEstateListing으로 대체됨 */}

      {/* JSON-LD 7: HowTo (청약 절차 → Google step-by-step rich results) */}
      {sub && subSt !== 'closed' && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org', '@type': 'HowTo',
          name: `${name} 청약 신청 방법`,
          description: `${name} 아파트 청약 접수 절차 안내`,
          step: [
            { '@type': 'HowToStep', name: '청약홈 접속', text: '청약홈(applyhome.co.kr) 사이트에 접속하여 로그인합니다.' },
            { '@type': 'HowToStep', name: '청약 신청', text: `${name} 청약 공고를 확인하고 신청합니다.` },
            { '@type': 'HowToStep', name: '당첨자 확인', text: `당첨자 발표일(${sub.przwner_presnatn_de || '미정'})에 결과를 확인합니다.` },
            { '@type': 'HowToStep', name: '계약 체결', text: `계약 기간(${sub.cntrct_cncls_bgnde || '미정'}~)에 계약을 체결합니다.` },
          ],
        }) }} />
      )}

      <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-md)', flexWrap: 'wrap' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>
        <span>›</span>
        <Link href="/apt" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>부동산</Link>
        {region && <><span>›</span><Link href={`/apt/region/${encodeURIComponent(region)}`} style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>{region}</Link></>}
        <span>›</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{name}</span>
      </nav>

      {/* 이미지 갤러리 — 워터마크 + 반응형 (모바일 스와이프 / 데스크탑 그리드) */}
      {(() => {
        const dbImages = Array.isArray(site?.images) ? site.images.slice(0, 7).map((img: any) => ({
          url: typeof img === 'string' ? img : img?.url || img?.link || '',
          caption: typeof img === 'string' ? undefined : img?.caption,
        })).filter((img: any) => img.url) : [];
        const ogUrl = `${SITE_URL}/api/og?title=${encodeURIComponent(name)}&design=2&category=apt&subtitle=${encodeURIComponent(region)}`;
        const badgeEl = (
          <div style={{ position: 'absolute', top: 10, left: 12, display: 'flex', gap: 'var(--sp-xs)', flexWrap: 'wrap', zIndex: 2 }}>
            {subSt && <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 'var(--radius-card)', background: SB[subSt].bg.replace('0.15', '0.85'), color: '#fff', fontWeight: 700 }}>{SB[subSt].label}{dDay !== null ? ` D${dDay > 0 ? '-' + dDay : dDay === 0 ? '-Day' : '+' + Math.abs(dDay)}` : ''}</span>}
            {sub?.is_price_limit && <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 'var(--radius-card)', background: 'rgba(139,92,246,0.85)', color: '#fff', fontWeight: 700 }}>상한제</span>}
            {redevStage && <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 'var(--radius-card)', background: 'rgba(251,191,36,0.85)', color: '#fff', fontWeight: 700 }}>{redevStage}</span>}
          </div>
        );
        return (
          <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
              '@context': 'https://schema.org', '@type': 'ImageGallery', name: `${name} ${tLabel[sType]} 이미지`,
              about: { '@type': 'ApartmentComplex', name, address: { '@type': 'PostalAddress', addressRegion: region } },
              image: dbImages.length > 0
                ? dbImages.map((img: any, i: number) => ({ '@type': 'ImageObject', url: img.url, name: img.caption || `${name} — ${region}`, position: i + 1 }))
                : [{ '@type': 'ImageObject', url: ogUrl, name: `${name} — ${region}`, width: 1200, height: 630, position: 1 }],
            })}} />
            {dbImages.length > 0 ? (
              <AptImageGallery images={dbImages} name={name} region={region} badges={badgeEl} />
            ) : (
              <div style={{
                position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 14,
                height: 140,
                background: 'linear-gradient(135deg, #0c1629 0%, #1a3050 50%, #1e3a8a 100%)',
              }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 'var(--sp-xs)' }}>{region} {site?.sigungu || ''}</div>
                  <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#fff', lineHeight: 1.2, wordBreak: 'keep-all' }}>{name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 'var(--sp-xs)' }}>{site?.builder || sub?.constructor_nm || ''}{(() => {
                    const totalU = site?.total_units || sub?.tot_supply_hshld_co;
                    if (!totalU) return '';
                    const types = Array.isArray(sub?.house_type_info) ? sub.house_type_info : [];
                    const gen = types.reduce((s: number, t: any) => s + (t.supply || 0), 0);
                    const spe = types.reduce((s: number, t: any) => s + (t.spsply_hshldco || 0), 0);
                    return gen > 0 ? ` · 총 ${totalU}세대(일반${gen}·특별${spe})` : ` · 총 ${totalU}세대`;
                  })()}</div>
                </div>
                {badgeEl}
              </div>
            )}
          </>
        );
      })()}

      {/* Header */}
      <div style={{ marginBottom: 'var(--sp-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-xl)', fontSize: 'var(--fs-xs)', fontWeight: 600, background: tBg[sType], color: tClr[sType], border: `1px solid ${tClr[sType]}33` }}>{tLabel[sType]}</span>
          {subSt && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '3px 9px', borderRadius: 'var(--radius-xl)', background: SB[subSt].bg, color: SB[subSt].color, border: `1px solid ${SB[subSt].border}` }}>{SB[subSt].label}</span>}
          {redevStage && <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-xl)', fontSize: 'var(--fs-xs)', fontWeight: 600, background: 'rgba(255,212,59,0.15)', color: '#FFD43B' }}>{redevStage}</span>}
          {sub?.competition_rate_1st && Number(sub.competition_rate_1st) > 0 && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--accent-purple)', background: 'rgba(99,102,241,0.1)', padding: '3px 8px', borderRadius: 'var(--radius-md)' }}>{Number(sub.competition_rate_1st).toFixed(1)}:1</span>}
        </div>
        <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: '6px 0 2px', lineHeight: 1.3, wordBreak: 'keep-all', overflowWrap: 'break-word' }}>{name}</h1>

        {/* 위치 + 시공사 통합 카드 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>📍 {[region, site?.sigungu, site?.dong].filter(Boolean).join(' ') || sub?.hssply_adres || ''}</span>
          {(site?.builder || sub?.constructor_nm) && <Link href={`/apt/builder/${encodeURIComponent(site?.builder || sub?.constructor_nm || '')}`} style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>🏗️ {site?.builder || sub?.constructor_nm}</Link>}
          {(site?.developer || sub?.developer_nm) && <span style={{ color: 'var(--text-tertiary)' }}>🏢 {site?.developer || sub?.developer_nm}</span>}
          {(site?.nearby_station || sub?.nearest_station) && <span style={{ color: 'var(--accent-blue)' }}>🚇 {site?.nearby_station || sub?.nearest_station}</span>}
        </div>
        {(sub?.ai_summary || site?.description) && (
          <div style={{ padding: 'var(--sp-md) var(--card-p)', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, var(--brand-bg), rgba(139,92,246,0.06))', border: '1px solid var(--brand-border)' }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--brand)', marginBottom: 3 }}>🤖 AI 분석</div>
            <div className="site-description" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', lineHeight: 1.6 }}>{sub?.ai_summary || site?.description}</div>
          </div>
        )}
      </div>


      {/* Share + Bookmark — 바이럴 액션 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--sp-md)', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, rgba(59,123,246,0.04), rgba(139,92,246,0.04))', border: '1px solid rgba(59,123,246,0.1)' }}>
        {/* 카카오톡 직접 공유 */}
        <KakaoDirectShare title={`${name} ${tLabel[sType]} — 분양가·청약일정·모집공고 한눈에`} description={`${region} ${name} 상세 정보를 카더라에서 확인하세요`} pagePath={`/apt/${slug}`} />
        <ShareButtons title={`${name} ${tLabel[sType]} — 분양가·청약일정·모집공고 한눈에`} contentType="apt" contentRef={slug} />
        <div style={{ flex: 1 }} />
        {sub?.id && <AptBookmarkButton aptId={String(sub.id)} aptName={name} />}
      </div>

      {/* Key metrics — 시각 강화 대시보드 */}
      {(() => {
        const totalUnits = Number(site?.total_units || sub?.tot_supply_hshld_co || 0);
        const types = Array.isArray(sub?.house_type_info) ? sub.house_type_info : [];
        const generalSupply = types.reduce((s: number, t: any) => s + (t.supply || 0), 0);
        const specialSupply = types.reduce((s: number, t: any) => s + (t.spsply_hshldco || 0), 0);
        const hasBreakdown = generalSupply > 0 || specialSupply > 0;
        const totalHouseholds = Number(sub?.total_households || 0);

        const commentCount = site?.comment_count || 0;
        const pageViews = site?.page_views || 0;
        const cards = [
          { l: totalHouseholds > 0 ? '총세대수' : '공급세대', v: totalHouseholds > 0 ? `${totalHouseholds.toLocaleString()}세대` : totalUnits > 0 ? `${totalUnits.toLocaleString()}세대` : '🔍 확인중', sub: totalHouseholds > 0 && totalHouseholds !== totalUnits && totalUnits > 0 ? `공급 ${totalUnits.toLocaleString()}세대` : totalHouseholds === 0 && (sub?.project_type === '재개발' || sub?.project_type === '재건축') ? '조합원분양 세대 확인중' : hasBreakdown ? `일반${generalSupply}·특별${specialSupply}` : '', c: totalHouseholds > 0 ? 'var(--text-primary)' : 'var(--brand)', icon: '🏢', bar: Math.min(((totalHouseholds || totalUnits) / 5000) * 100, 100), barColor: 'var(--brand)', scrollTo: 'supply-section' },
          { l: sub ? '분양가' : '시세', v: (() => {
            const pMin = site?.price_min || unsold?.sale_price_min || 0;
            const pMax = site?.price_max || 0;
            if (!pMin && !pMax) return '-';
            const fmt = (n: number) => n >= 10000 ? `${(n / 10000).toFixed(1)}억` : `${n.toLocaleString()}만`;
            if (pMin && pMax && pMin !== pMax) return `${fmt(pMin)}~\n${fmt(pMax)}`;
            return fmt(pMin || pMax);
          })(), sub: '', c: 'var(--brand)', icon: '💰', bar: 0, barColor: 'var(--brand)', scrollTo: 'price-section' },
          { l: '입주예정', v: fmtYM(site?.move_in_date || sub?.mvn_prearnge_ym) || '-', sub: (() => {
            const ym = site?.move_in_date || sub?.mvn_prearnge_ym;
            if (!ym || ym.length < 6) return '';
            const tY = parseInt(ym.slice(0, 4)); const tM = parseInt(ym.slice(4, 6));
            const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
            const diffM = (tY - now.getFullYear()) * 12 + (tM - (now.getMonth() + 1));
            if (diffM <= 0) return '';
            const y = Math.floor(diffM / 12); const m = diffM % 12;
            return y > 0 ? `약 ${y}년${m > 0 ? ` ${m}개월` : ''} 후` : `약 ${m}개월 후`;
          })(), c: 'var(--accent-green)', icon: '📅', bar: 0, barColor: 'var(--accent-green)', scrollTo: 'movein-section' },
          { l: '조회수', v: pageViews > 0 ? pageViews.toLocaleString() : '-', sub: '', c: '#22D3EE', icon: '👁️', bar: Math.min(pageViews / 5000 * 100, 100), barColor: '#22D3EE', scrollTo: 'stats-section' },
          { l: '댓글', v: commentCount > 0 ? `${commentCount}` : '0', sub: '클릭하여 작성', c: '#A78BFA', icon: '💬', bar: Math.min(commentCount / 50 * 100, 100), barColor: '#A78BFA', scrollTo: 'comment-section' },
          { l: unsold ? '미분양' : '관심', v: unsold ? `${(unsold.tot_unsold_hshld_co || 0).toLocaleString()}호` : formatInterestOrViews(site?.interest_count || 0, pageViews).value, sub: unsold ? '' : '클릭하여 등록', c: unsold ? 'var(--accent-red)' : '#FFD43B', icon: unsold ? '⚠️' : '❤️', bar: unsold ? Math.min((unsold.tot_unsold_hshld_co || 0) / 500 * 100, 100) : Math.min((pageViews || site?.interest_count || 1) / (Math.max(site?.total_units || sub?.tot_supply_hshld_co || 100, 100)) * 100, 100), barColor: unsold ? 'var(--accent-red)' : '#FFD43B', scrollTo: unsold ? null : 'interest-section' },
        ];

        return (
          <>
            <KpiCards cards={cards} />
            <div id="supply-section" style={{ scrollMarginTop: 60 }}>
            <ComplexScale
              totalHouseholds={totalHouseholds}
              supplyUnits={totalUnits}
              generalSupply={generalSupply}
              specialSupply={specialSupply}
              dongCount={Number(sub?.total_dong_count || sub?.total_dong_co || 0)}
              maxFloor={Number(sub?.max_floor || 0)}
              parkingCount={Number(sub?.parking_total || sub?.parking_co || 0)}
            />
            </div>
          </>
        );
      })()}

      {/* Features */}
      {features.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>{features.map((f: any, i: number) => <span key={i} style={{ padding: '4px 10px', borderRadius: 'var(--radius-lg)', fontSize: 'var(--fs-xs)', fontWeight: 600, background: 'rgba(59,123,246,0.1)', color: '#6CB4FF', border: '1px solid rgba(59,123,246,0.15)' }}>{String(f)}</span>)}</div>}

      {/* 분양가 범위 바 + D-day 위젯 */}
      {((site?.price_min && site?.price_max) || sub) && (
        <div id="price-section" style={{ display: 'grid', gridTemplateColumns: (site?.price_min && site?.price_max && sub) ? 'minmax(0,1fr) minmax(0,1fr)' : '1fr', gap: 6, marginBottom: 14, scrollMarginTop: 60 }}>
          {/* 분양가 범위 바 — 시각 강화 */}
          {site?.price_min && site?.price_max && (() => {
            const pMin = site.price_min;
            const pMax = site.price_max;
            const pAvg = Math.round((pMin + pMax) / 2);
            // 전용면적 기반 평당가 추정
            const pyeongPrice = sub?.price_per_pyeong_avg || Math.round(pAvg / 34);
            const ppMin = sub?.price_per_pyeong_min || 0;
            const ppMax = sub?.price_per_pyeong_max || 0;
            const isEstimated = sub?.price_source === 'estimated';
            // 가격 등급 (만원 단위)
            const tier = pAvg >= 120000 ? { label: '12억+', color: '#FF6B6B', emoji: '💎' } : pAvg >= 90000 ? { label: '9억대', color: '#FB923C', emoji: '🏅' } : pAvg >= 60000 ? { label: '6억대', color: '#FBBF24', emoji: '✨' } : pAvg >= 30000 ? { label: '3억대', color: 'var(--brand)', emoji: '🏠' } : { label: '3억 미만', color: 'var(--accent-green)', emoji: '🌱' };
            return (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>💰 분양가</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: tier.color, background: `${tier.color}15`, padding: '1px 6px', borderRadius: 4 }}>{tier.emoji} {tier.label}</span>
                </div>
                {/* 가격 범위 바 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 700, minWidth: 42 }}>{fmtAmount(pMin)}</span>
                  <div style={{ flex: 1, height: 10, borderRadius: 'var(--radius-sm)', background: 'linear-gradient(90deg, rgba(96,165,250,0.25), var(--brand), rgba(248,113,113,0.25))', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: -1, left: '50%', width: 12, height: 12, borderRadius: '50%', background: 'var(--brand)', border: '2px solid var(--bg-surface)', transform: 'translateX(-50%)', boxShadow: '0 0 4px rgba(59,123,246,0.5)' }} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--accent-red)', fontWeight: 700, minWidth: 42, textAlign: 'right' }}>{fmtAmount(pMax)}</span>
                </div>
                {/* 평균 + 평당가 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>평균 <strong style={{ color: 'var(--text-primary)' }}>{fmtAmount(pAvg)}</strong></span>
                  {pyeongPrice > 0 && <span style={{ color: 'var(--accent-purple)' }}>평당 <strong>{ppMin > 0 && ppMax > 0 ? `${ppMin.toLocaleString()}~${ppMax.toLocaleString()}만` : `${pyeongPrice.toLocaleString()}만`}</strong>{ppMin > 0 && ppMax > 0 ? <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 3 }}>(평균 {pyeongPrice.toLocaleString()}만)</span> : <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 3 }}>(최고가 기준)</span>}{isEstimated && <span style={{ fontSize: 10, marginLeft: 4, padding: '1px 4px', borderRadius: 4, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', fontWeight: 600 }}>추정</span>}</span>}
                </div>
              </div>
            );
          })()}
          {/* D-day 카운트다운 */}
          {sub && (() => {
            const now = new Date();
            const milestones = [
              { label: '청약접수', date: sub.rcept_bgnde },
              { label: '당첨발표', date: sub.przwner_presnatn_de },
              { label: '계약시작', date: sub.cntrct_cncls_bgnde },
              { label: '입주예정', date: sub.mvn_prearnge_ym ? `${sub.mvn_prearnge_ym.slice(0, 4)}-${sub.mvn_prearnge_ym.slice(4, 6)}-01` : null },
            ].filter(m => m.date);
            const next = milestones.find(m => m.date && new Date(m.date) >= now) || milestones[milestones.length - 1];
            if (!next?.date) return null;
            const dday = Math.ceil((new Date(next.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return (
              <div style={{ background: dday <= 7 ? 'rgba(248,113,113,0.06)' : dday <= 30 ? 'rgba(251,191,36,0.06)' : 'var(--bg-surface)', border: `1px solid ${dday <= 7 ? 'rgba(248,113,113,0.2)' : dday <= 30 ? 'rgba(251,191,36,0.2)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-xs)' }}>📅 {next.label}까지</div>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: dday <= 0 ? 'var(--accent-green)' : dday <= 7 ? 'var(--accent-red)' : dday <= 30 ? '#FBBF24' : 'var(--brand)' }}>
                  {dday <= 0 ? '진행중' : `D-${dday}`}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{next.date}</div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 규제 요약 — 전매/거주/재당첨 신호등 */}
      {sub && (sub.transfer_limit_years || sub.residence_obligation_years || sub.rewin_limit_years || sub.is_price_limit || sub.loan_rate) && (
        <div style={{ marginBottom: 14 }}>
          <RegulationBadges
            transferLimitYears={sub.transfer_limit_years}
            residenceYears={sub.residence_obligation_years}
            rewinLimitYears={sub.rewin_limit_years}
            isSpeculativeZone={sub.is_speculative_zone}
            isRegulatedArea={sub.is_regulated_area}
            isPriceLimit={sub.is_price_limit}
            loanRate={sub.loan_rate}
            contractDate={sub.cntrct_cncls_bgnde}
          />
        </div>
      )}

      {/* 실입주 총비용 시뮬레이터 */}
      {sub && Array.isArray(sub.house_type_info) && sub.house_type_info.length > 0 && sub.house_type_info.some((t: any) => t.lttot_top_amount > 0) && (
        <div style={{ marginBottom: 14 }}>
          <ContentLock title="실입주 비용 시뮬레이터" description="가입하면 총비용·취득세 계산을 무료로 이용할 수 있어요">
            <CostSimulator
              types={sub.house_type_info}
              options={Array.isArray(sub.options_list) ? sub.options_list : []}
              siteName={name}
              priceSource={sub.price_source}
            />
          </ContentLock>
        </div>
      )}

      {/* 납부 일정 — 모집공고 핵심 요약 섹션 내부로 통합 (중복 제거) */}

      {/* 🏫 입지 분석 — 학군·교통 */}
      {sub && ((Array.isArray(sub.schools) && sub.schools.length > 0) || (Array.isArray(sub.stations) && sub.stations.length > 0) || sub.nearest_school || sub.nearest_station) && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>🏫 입지 분석</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {/* 학군 */}
            <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.1)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6', marginBottom: 6 }}>🎒 학군</div>
              {Array.isArray(sub.schools) && sub.schools.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(sub.schools as { name: string; distance?: string }[]).slice(0, 3).map((s, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      <span style={{ fontWeight: 600 }}>{s.name}</span>
                      {s.distance && <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>{s.distance}</span>}
                    </div>
                  ))}
                </div>
              ) : sub.nearest_school ? (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{sub.nearest_school}</div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>정보 없음</div>
              )}
            </div>
            {/* 교통 */}
            <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.1)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#22C55E', marginBottom: 6 }}>🚇 교통</div>
              {Array.isArray(sub.stations) && sub.stations.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(sub.stations as { name: string; walk_min?: number }[]).slice(0, 3).map((s, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      <span style={{ fontWeight: 600 }}>{s.name}</span>
                      {s.walk_min && <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>도보 {s.walk_min}분</span>}
                    </div>
                  ))}
                </div>
              ) : sub.nearest_station ? (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{sub.nearest_station}</div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>정보 없음</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 📍 지역 시세 비교 — 이 현장이 지역에서 어디 위치하는지 */}
      {regionBenchmark && (site?.price_min || site?.price_max || trades.length > 0) && (() => {
        const myPrice = site?.price_min && site?.price_max 
          ? Math.round((site.price_min + site.price_max) / 2)
          : trades.length > 0 
            ? Math.round(trades.reduce((s: number, t: any) => s + Number(t.deal_amount), 0) / trades.length)
            : 0;
        if (myPrice <= 0) return null;
        const regionAvg = Math.round((regionBenchmark.avgMin + regionBenchmark.avgMax) / 2);
        const diff = regionAvg > 0 ? Math.round(((myPrice - regionAvg) / regionAvg) * 100) : 0;
        const regionRange = regionBenchmark.highest - regionBenchmark.lowest;
        const position = regionRange > 0 ? Math.min(Math.max(((myPrice - regionBenchmark.lowest) / regionRange) * 100, 2), 98) : 50;
        return (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>📍 {region} 시세 비교 ({regionBenchmark.count}개 현장)</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: diff > 10 ? '#F87171' : diff < -10 ? '#34D399' : 'var(--text-tertiary)', background: diff > 10 ? 'rgba(248,113,113,0.1)' : diff < -10 ? 'rgba(52,211,153,0.1)' : 'var(--bg-hover)', padding: '1px 6px', borderRadius: 4 }}>
                {diff > 0 ? `+${diff}%` : `${diff}%`} {diff > 10 ? '고가' : diff < -10 ? '저가' : '평균'}
              </span>
            </div>
            {/* 지역 범위 위치 바 */}
            <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'linear-gradient(90deg, rgba(52,211,153,0.2), rgba(251,191,36,0.2), rgba(248,113,113,0.2))', marginBottom: 'var(--sp-xs)' }}>
              {/* 지역 평균 마커 */}
              <div style={{ position: 'absolute', top: -2, left: '50%', width: 2, height: 12, background: 'var(--text-tertiary)', transform: 'translateX(-50%)', borderRadius: 1 }} />
              {/* 이 현장 위치 */}
              <div style={{ position: 'absolute', top: -3, left: `${position}%`, width: 14, height: 14, borderRadius: '50%', background: 'var(--brand)', border: '2px solid var(--bg-surface)', transform: 'translateX(-50%)', boxShadow: '0 0 6px rgba(59,123,246,0.5)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)' }}>
              <span>{fmtAmount(regionBenchmark.lowest)}</span>
              <span style={{ color: 'var(--text-secondary)' }}>평균 {fmtAmount(regionAvg)}</span>
              <span>{fmtAmount(regionBenchmark.highest)}</span>
            </div>
          </div>
        );
      })()}

      {/* 가격 없는 현장 — 지역 참고 시세 */}
      {!site?.price_min && !site?.price_max && trades.length === 0 && regionBenchmark && (
        <div style={{ background: 'rgba(59,123,246,0.03)', border: '1px dashed rgba(59,123,246,0.2)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)', marginBottom: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-xs)' }}>💰 분양가 미공개 · {region} 참고 시세</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--brand)' }}>
            {fmtAmount(regionBenchmark.avgMin)} ~ {fmtAmount(regionBenchmark.avgMax)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {region} {regionBenchmark.count}개 현장 평균 (실제 분양가와 다를 수 있음)
          </div>
        </div>
      )}
      {sub && (() => { 
        const steps = [
          { label: '특별공급', date: sub.spsply_rcept_bgnde, active: !!sub.spsply_rcept_bgnde },
          { label: '1순위', date: sub.rcept_bgnde, active: !!sub.rcept_bgnde },
          { label: '2순위', date: sub.rcept_endde, active: !!sub.rcept_endde && sub.rcept_endde !== sub.rcept_bgnde },
          { label: '당첨발표', date: sub.przwner_presnatn_de, active: !!sub.przwner_presnatn_de },
          { label: '계약', date: sub.cntrct_cncls_bgnde, active: !!sub.cntrct_cncls_bgnde },
          { label: '입주', date: sub.mvn_prearnge_ym ? fmtYM(sub.mvn_prearnge_ym) : null, active: !!sub.mvn_prearnge_ym },
        ].filter(s => s.active);
        const now = new Date().toISOString().slice(0, 10);
        const currentIdx = steps.findIndex(s => s.date && s.date >= now);
        const activeIdx = currentIdx >= 0 ? currentIdx : steps.length;
        const types = Array.isArray(sub.house_type_info) ? sub.house_type_info : [];
        const gen = types.reduce((s: number, t: any) => s + (t.supply || 0), 0);
        const spe = types.reduce((s: number, t: any) => s + (t.spsply_hshldco || 0), 0);
        const supplyStr = sub.tot_supply_hshld_co ? `${Number(sub.tot_supply_hshld_co).toLocaleString()}세대${gen > 0 ? ` (일반 ${gen} · 특별 ${spe})` : ''}` : null;
        const rows = [['분양유형', sub.mdatrgbn_nm], ['시행사', sub.developer_nm || site?.developer], ['시공사', sub.constructor_nm || site?.builder], ['특별공급', sub.spsply_rcept_bgnde ? `${sub.spsply_rcept_bgnde} ~ ${sub.spsply_rcept_endde || ''}` : null], ['1순위', sub.rcept_bgnde], ['2순위', sub.rcept_endde && sub.rcept_endde !== sub.rcept_bgnde ? sub.rcept_endde : null], ['당첨자발표', sub.przwner_presnatn_de], ['계약', sub.cntrct_cncls_bgnde ? `${sub.cntrct_cncls_bgnde} ~ ${sub.cntrct_cncls_endde}` : null], ['입주예정', fmtYM(sub.mvn_prearnge_ym)], ['총공급', supplyStr], ['분양가상한제', sub.is_price_limit ? '적용' : '미적용']].filter(r => r[1]);
        return (
          <div className="apt-card" id="movein-section" style={{ scrollMarginTop: 60 }}>
            <h2 style={ct}>📅 분양 일정</h2>
            {/* 비주얼 타임라인 */}
            {steps.length >= 2 && (
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--sp-lg)', padding: '0 4px', position: 'relative' }}>
                {/* 연결선 */}
                <div style={{ position: 'absolute', top: 8, left: 16, right: 16, height: 3, background: 'var(--bg-hover)', borderRadius: 4, zIndex: 0 }}>
                  <div style={{ height: '100%', borderRadius: 4, background: 'var(--brand)', width: `${(activeIdx / Math.max(steps.length - 1, 1)) * 100}%`, transition: 'width 0.5s' }} />
                </div>
                {steps.map((step, i) => {
                  const isPast = i < activeIdx;
                  const isCurrent = i === activeIdx;
                  return (
                    <div key={step.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1, flex: 1 }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: isPast ? 'var(--brand)' : isCurrent ? 'var(--accent-green)' : 'var(--bg-hover)', border: isCurrent ? '3px solid var(--accent-green)' : isPast ? '3px solid var(--brand)' : '3px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: (isPast || isCurrent) ? '#fff' : 'var(--text-tertiary)' }}>
                        {isPast ? '✓' : ''}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: (isPast || isCurrent) ? 700 : 400, color: isCurrent ? 'var(--accent-green)' : isPast ? 'var(--brand)' : 'var(--text-tertiary)', marginTop: 'var(--sp-xs)', textAlign: 'center', lineHeight: 1.2 }}>{step.label}</div>
                      {step.date && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{step.date.slice(5, 10).replace('-', '/')}</div>}
                    </div>
                  );
                })}
              </div>
            )}
            {/* 상세 행 */}
            {rows.map(([l, v], i) => <div key={l as string} style={{ ...rw, borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}><span style={rl}>{l}</span><span style={rv}>{v}</span></div>)}
          </div>
        ); 
      })()}

      {/* 💰 분양가 vs 실거래가 비교 (두 데이터 모두 있을 때) */}
      {site?.price_min && site?.price_max && trades.length > 0 && (() => {
        const amounts = trades.map((t: any) => Number(t.deal_amount)).filter((a: number) => a > 0);
        if (amounts.length < 2) return null;
        const tradeAvg = Math.round(amounts.reduce((s: number, a: number) => s + a, 0) / amounts.length);
        const tradeMax = Math.max(...amounts);
        const tradeMin = Math.min(...amounts);
        const supplyAvg = Math.round((site.price_min + site.price_max) / 2);
        const premium = tradeAvg > 0 && supplyAvg > 0 ? Math.round(((tradeAvg - supplyAvg) / supplyAvg) * 100) : 0;
        const allValues = [site.price_min, site.price_max, tradeMin, tradeMax];
        const chartMax = Math.max(...allValues);
        const chartMin = Math.min(...allValues);
        const range = chartMax - chartMin || 1;
        const pct = (v: number) => ((v - chartMin) / range * 80 + 10);

        return (
          <div className="apt-card" style={{ background: premium > 0 ? 'rgba(248,113,113,0.03)' : 'rgba(52,211,153,0.03)', border: `1px solid ${premium > 0 ? 'rgba(248,113,113,0.15)' : 'rgba(52,211,153,0.15)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h2 style={{ ...ct, margin: 0 }}>📊 분양가 vs 실거래가</h2>
              <span style={{ fontSize: 12, fontWeight: 800, color: premium > 0 ? 'var(--accent-red)' : '#34D399', background: premium > 0 ? 'rgba(248,113,113,0.1)' : 'rgba(52,211,153,0.1)', padding: '3px 8px', borderRadius: 'var(--radius-sm)' }}>
                {premium > 0 ? `+${premium}% 프리미엄` : premium < 0 ? `${premium}% 저평가` : '시세 동일'}
              </span>
            </div>
            {/* 비교 바 차트 */}
            <div style={{ position: 'relative', height: 80, marginBottom: 'var(--sp-sm)' }}>
              {/* 분양가 범위 */}
              <div style={{ position: 'absolute', top: 8, left: `${pct(site.price_min)}%`, width: `${pct(site.price_max) - pct(site.price_min)}%`, height: 20, borderRadius: 'var(--radius-xs)', background: 'rgba(59,123,246,0.2)', border: '1.5px solid var(--brand)' }}>
                <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 600, color: 'var(--brand)', whiteSpace: 'nowrap' }}>분양가</div>
              </div>
              {/* 실거래 범위 */}
              <div style={{ position: 'absolute', top: 44, left: `${pct(tradeMin)}%`, width: `${pct(tradeMax) - pct(tradeMin)}%`, height: 20, borderRadius: 'var(--radius-xs)', background: premium > 0 ? 'rgba(248,113,113,0.15)' : 'rgba(52,211,153,0.15)', border: `1.5px solid ${premium > 0 ? '#F87171' : '#34D399'}` }}>
                <div style={{ position: 'absolute', bottom: -14, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 600, color: premium > 0 ? '#F87171' : '#34D399', whiteSpace: 'nowrap' }}>실거래가</div>
              </div>
              {/* 분양 평균 마커 */}
              <div style={{ position: 'absolute', top: 4, left: `${pct(supplyAvg)}%`, width: 2, height: 28, background: 'var(--brand)', transform: 'translateX(-50%)' }} />
              {/* 실거래 평균 마커 */}
              <div style={{ position: 'absolute', top: 40, left: `${pct(tradeAvg)}%`, width: 2, height: 28, background: premium > 0 ? '#F87171' : '#34D399', transform: 'translateX(-50%)' }} />
            </div>
            {/* 수치 비교 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 6 }}>
              <div style={{ background: 'rgba(59,123,246,0.05)', borderRadius: 'var(--radius-xs)', padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--brand)', fontWeight: 600, marginBottom: 2 }}>분양가 평균</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>{fmtAmount(supplyAvg)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{fmtAmount(site.price_min)} ~ {fmtAmount(site.price_max)}</div>
              </div>
              <div style={{ background: premium > 0 ? 'rgba(248,113,113,0.05)' : 'rgba(52,211,153,0.05)', borderRadius: 'var(--radius-xs)', padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: premium > 0 ? '#F87171' : '#34D399', fontWeight: 600, marginBottom: 2 }}>실거래 평균 ({amounts.length}건)</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: premium > 0 ? '#F87171' : '#34D399' }}>{fmtAmount(tradeAvg)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{fmtAmount(tradeMin)} ~ {fmtAmount(tradeMax)}</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 📄 모집공고 핵심 요약 — 통합 카드 */}
      {sub && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '16px', marginBottom: 'var(--sp-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-md)' }}>
            <h2 style={{ ...ct, margin: 0 }}>📄 모집공고 핵심 요약</h2>
          </div>

          {/* AI 분석 — 상단 히어로에 이미 표시되므로 중복 제거 */}

          {/* 핵심 지표 시각 분석 — 기존 데이터 최대 활용 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 6, marginBottom: 'var(--sp-md)' }}>
            {/* 공급 규모 등급 */}
            {(() => {
              const units = sub.tot_supply_hshld_co || site?.total_units || 0;
              const grade = units >= 3000 ? { label: '메가단지', emoji: '🏙️', color: '#FF6B6B', desc: '3,000세대+' } : units >= 1000 ? { label: '대단지', emoji: '🏢', color: 'var(--accent-blue)', desc: '1,000세대+' } : units >= 300 ? { label: '중단지', emoji: '🏗️', color: 'var(--accent-green)', desc: '300세대+' } : units > 0 ? { label: '소단지', emoji: '🏠', color: '#FBBF24', desc: '300세대 미만' } : null;
              if (!grade) return null;
              return (
                <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 'var(--fs-xl)' }}>{grade.emoji}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: grade.color }}>{grade.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{units.toLocaleString()}세대 · {grade.desc}</div>
                  </div>
                </div>
              );
            })()}
            {/* 입주까지 남은 기간 */}
            {sub.mvn_prearnge_ym && (() => {
              const now = new Date();
              const mvnY = parseInt(sub.mvn_prearnge_ym.slice(0, 4));
              const mvnM = parseInt(sub.mvn_prearnge_ym.slice(4, 6)) || 1;
              const months = (mvnY - now.getFullYear()) * 12 + (mvnM - (now.getMonth() + 1));
              const years = Math.floor(months / 12);
              const remMonths = months % 12;
              const timeStr = months <= 0 ? '입주 완료/임박' : years > 0 ? `${years}년 ${remMonths > 0 ? `${remMonths}개월` : ''}` : `${months}개월`;
              const pct = Math.max(0, Math.min(100, 100 - (months / 60) * 100));
              return (
                <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3 }}>🏡 입주까지</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: months <= 6 ? '#34D399' : months <= 24 ? 'var(--brand)' : 'var(--text-primary)' }}>{timeStr}</div>
                  <div style={{ height: 3, borderRadius: 4, background: 'var(--border)', marginTop: 'var(--sp-xs)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: months <= 6 ? '#34D399' : months <= 24 ? 'var(--brand)' : 'var(--accent-purple)' }} />
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 시행 유형 뱃지 */}
          {(() => {
            const dev = sub.developer_nm || site?.developer || '';
            const isJohap = dev.includes('조합') || dev.includes('정비');
            const isPublic = dev.includes('공사') || dev.includes('LH') || dev.includes('SH');
            const devType = isJohap ? { label: '재개발/재건축 조합', icon: '🔄', color: '#FB923C' } : isPublic ? { label: '공공 시행', icon: '🏛️', color: 'var(--accent-green)' } : null;
            if (!devType) return null;
            return (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 'var(--sp-sm)', padding: '4px 10px', borderRadius: 'var(--radius-xs)', background: `${devType.color}12`, fontSize: 11 }}>
                <span>{devType.icon}</span>
                <span style={{ color: devType.color, fontWeight: 700 }}>{devType.label}</span>
              </div>
            );
          })()}

          {/* 분양 조건 — RegulationBadges 컴포넌트로 상단에 표시 (중복 제거) */}

          {/* 단지 개요 행 — 건물 스펙 (시공사/시행사는 상단 헤더에 표시) */}
          {(() => {
            const rows = [
              ['브랜드', sub.brand_name],
              ['사업유형', (sub as any).project_type],
              ['총세대수', sub.total_households ? `${Number(sub.total_households).toLocaleString()}세대 (단지 전체)` : null],
              ['공급세대', sub.tot_supply_hshld_co ? `${Number(sub.tot_supply_hshld_co).toLocaleString()}세대 (일반${sub.general_supply_total || '-'} · 특별${sub.special_supply_total || '-'})` : null],
              ['동수', (sub.total_dong_count || sub.total_dong_co) ? `${sub.total_dong_count || sub.total_dong_co}개 동` : null],
              ['층수', sub.max_floor ? `지상 ${sub.max_floor}층${sub.min_floor ? ` / 지하 ${sub.min_floor}층` : ''}` : null],
              ['주차', sub.parking_total || sub.parking_co ? `${Number(sub.parking_total || sub.parking_co).toLocaleString()}대${sub.parking_ratio ? ` (세대당 ${sub.parking_ratio}대)` : ''}` : null],
              ['난방', sub.heating_type],
              ['구조', sub.structure_type],
              ['외장재', sub.exterior_finish],
            ].filter(r => r[1]);
            if (!rows.length) return null;
            return (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                {rows.map(([l, v], i) => (
                  <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>{l}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', maxWidth: '60%' }}>{v}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* 면적/용적 정보 */}
          {(sub.land_area || sub.floor_area_ratio) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 4, marginTop: 8 }}>
              {sub.land_area > 0 && <div style={{ textAlign: 'center', padding: '6px 4px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-xs)' }}><div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>대지면적</div><div style={{ fontSize: 11, fontWeight: 700 }}>{Number(sub.land_area).toLocaleString()}㎡</div></div>}
              {sub.building_area > 0 && <div style={{ textAlign: 'center', padding: '6px 4px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-xs)' }}><div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>건축면적</div><div style={{ fontSize: 11, fontWeight: 700 }}>{Number(sub.building_area).toLocaleString()}㎡</div></div>}
              {sub.floor_area_ratio > 0 && <div style={{ textAlign: 'center', padding: '6px 4px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-xs)' }}><div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>용적률</div><div style={{ fontSize: 11, fontWeight: 700 }}>{sub.floor_area_ratio}%</div></div>}
              {sub.building_coverage > 0 && <div style={{ textAlign: 'center', padding: '6px 4px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-xs)' }}><div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>건폐율</div><div style={{ fontSize: 11, fontWeight: 700 }}>{sub.building_coverage}%</div></div>}
            </div>
          )}

          {/* 💰 납부일정 — 통합 (payment_schedule 우선, down_payment_pct 폴백) */}
          {(sub.payment_schedule || sub.down_payment_pct || sub.interim_count) && (() => {
            const fmtA = (n: number) => n >= 10000 ? `${(n / 10000).toFixed(1)}억` : `${n.toLocaleString()}만`;
            const colors: Record<string, string> = { deposit: '#3B82F6', interim: '#8B5CF6', balance: '#22C55E' };
            let steps: { key: string; label: string; pct: number; amount?: number; loan?: string }[] = [];

            if (sub.payment_schedule) {
              const ps = typeof sub.payment_schedule === 'string' ? JSON.parse(sub.payment_schedule) : sub.payment_schedule;
              steps = ['deposit', 'interim', 'balance'].map(k => ps[k] ? { key: k, label: ps[k].label, pct: ps[k].pct, amount: ps[k].amount, loan: ps[k].loan } : null).filter(Boolean) as typeof steps;
            } else {
              const down = sub.down_payment_pct || 10;
              const interim = sub.interim_count || 6;
              const interimPct = sub.balance_pct ? (100 - down - sub.balance_pct) : 60;
              const balance = sub.balance_pct || (100 - down - interimPct);
              steps = [
                { key: 'deposit', label: '계약금', pct: down },
                { key: 'interim', label: `중도금 (${interim}회)`, pct: interimPct },
                { key: 'balance', label: '잔금', pct: balance },
              ];
            }
            if (steps.length === 0) return null;
            return (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>💰 납부일정{sub.payment_schedule ? ' (최고 분양가 기준)' : ''}</div>
                <div style={{ display: 'flex', height: 22, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                  {steps.map((s, i) => (
                    <div key={s.key} style={{ flex: s.pct, background: colors[s.key] || '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700, borderRight: i < steps.length - 1 ? '2px solid var(--bg-surface)' : 'none' }}>
                      {s.pct}%
                    </div>
                  ))}
                </div>
                {steps.map(s => (
                  <div key={s.key} style={{ marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>{s.label} ({s.pct}%){s.loan ? ` — ${s.loan}` : ''}</span>
                      {s.amount && <span style={{ fontWeight: 700, color: colors[s.key] || 'var(--text-primary)' }}>{fmtA(s.amount)}</span>}
                    </div>
                    <div style={{ height: 3, borderRadius: 4, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${s.pct}%`, background: colors[s.key] || '#888', borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
                {sub.acquisition_tax_estimate > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4, padding: '4px 0', borderTop: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>예상 취득세</span>
                    <span style={{ fontWeight: 700, color: 'var(--accent-red)' }}>약 {fmtA(sub.acquisition_tax_estimate)}</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* 📋 청약 조건 (RegulationBadges에 없는 고유 항목만 표시) */}
          {(sub.savings_requirement || sub.priority_supply_area || sub.balcony_extension !== undefined) && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>📋 청약 조건</div>
              {[
                sub.balcony_extension !== undefined && ['🪟 발코니확장', sub.balcony_extension ? '가능' : '불가', sub.balcony_extension ? 'var(--accent-green)' : 'var(--text-tertiary)'],
                sub.savings_requirement && ['💰 청약저축', sub.savings_requirement, 'var(--brand)'],
                sub.priority_supply_area && ['📍 우선공급', sub.priority_supply_area, 'var(--accent-purple)'],
              ].filter(Boolean).map(([l, v, c]: any) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>{l}</span>
                  <span style={{ fontWeight: 700, color: c, textAlign: 'right', maxWidth: '60%' }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* 🏗️ 사업일정 */}
          {(sub.business_approval_date || sub.construction_start_date || sub.completion_date) && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>🏗️ 사업일정</div>
              {[
                sub.business_approval_date && ['사업승인', sub.business_approval_date],
                sub.construction_start_date && ['착공', sub.construction_start_date],
                sub.completion_date && ['준공예정', sub.completion_date],
              ].filter(Boolean).map(([l, v]: any) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>{l}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* 🏊 커뮤니티 시설 */}
          {(sub.community_facilities?.length > 0 || (Array.isArray(sub.community_list) && sub.community_list.length > 0)) && (() => {
            const categoryIcons: Record<string, string> = { fitness: '💪', sports: '⛳', kids: '👶', senior: '👴', common: '🏠' };
            const categoryLabels: Record<string, string> = { fitness: '피트니스', sports: '스포츠', kids: '키즈', senior: '경로', common: '공용' };
            const pdfList = Array.isArray(sub.community_list) ? sub.community_list as { name: string; category: string }[] : [];
            const oldList = sub.community_facilities || [];
            return (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>🏊 커뮤니티 시설</div>
                {pdfList.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 4 }}>
                    {pdfList.map((f, i) => (
                      <div key={i} style={{ padding: '6px 8px', borderRadius: 'var(--radius-sm)', background: f.category === 'fitness' ? 'rgba(239,68,68,0.06)' : f.category === 'kids' ? 'rgba(245,158,11,0.06)' : f.category === 'sports' ? 'rgba(34,197,94,0.06)' : 'var(--bg-hover)', border: '1px solid var(--border)', textAlign: 'center' }}>
                        <div style={{ fontSize: 14, marginBottom: 2 }}>{categoryIcons[f.category] || '🏠'}</div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>{f.name}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {oldList.map((f: string) => (
                      <span key={f} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-xs)', background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>{f}</span>
                    ))}
                  </div>
                )}
                {/* 핵심 시설 요약 뱃지 */}
                {(sub.has_fitness || sub.has_daycare) && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    {sub.has_fitness && <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.08)', color: '#EF4444', fontWeight: 600 }}>💪 피트니스 있음</span>}
                    {sub.has_daycare && <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.08)', color: '#F59E0B', fontWeight: 600 }}>👶 어린이집 있음</span>}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 견본주택 */}
          {sub.model_house_addr && (
            <div style={{ marginTop: 'var(--sp-sm)', padding: '8px 10px', borderRadius: 'var(--radius-xs)', background: 'var(--bg-hover)', fontSize: 12, color: 'var(--text-secondary)', wordBreak: 'keep-all' }}>
              🏠 견본주택: {sub.model_house_addr}
            </div>
          )}

          {/* 🏗️ 단지 스펙 */}
          {(sub.architect || sub.energy_grade || sub.ceiling_height || sub.entrance_type || sub.elevator_count || sub.estimated_mgmt_fee || sub.special_features || sub.landscape_designer) && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>🏗️ 단지 스펙</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6 }}>
                {sub.architect && (
                  <div style={{ padding: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>설계</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{sub.architect}</div>
                  </div>
                )}
                {sub.landscape_designer && (
                  <div style={{ padding: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>조경</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{sub.landscape_designer}</div>
                  </div>
                )}
                {sub.ceiling_height && (
                  <div style={{ padding: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>천장고</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: Number(sub.ceiling_height) >= 2.4 ? 'var(--accent-green)' : 'var(--text-primary)', marginTop: 2 }}>{sub.ceiling_height}m{Number(sub.ceiling_height) >= 2.5 ? ' 🎯' : ''}</div>
                  </div>
                )}
                {sub.entrance_type && (
                  <div style={{ padding: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>현관 구조</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: sub.entrance_type === '계단식' ? 'var(--accent-green)' : 'var(--text-primary)', marginTop: 2 }}>{sub.entrance_type}</div>
                  </div>
                )}
                {sub.energy_grade && (
                  <div style={{ padding: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>에너지 효율</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#22C55E', marginTop: 2 }}>{sub.energy_grade}</div>
                  </div>
                )}
                {sub.zero_energy_cert && (
                  <div style={{ padding: '8px', borderRadius: 'var(--radius-sm)', background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.15)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>제로에너지</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#22C55E', marginTop: 2 }}>🌿 {sub.zero_energy_cert}</div>
                  </div>
                )}
                {sub.estimated_mgmt_fee && (
                  <div style={{ padding: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>예상 관리비</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{Number(sub.estimated_mgmt_fee).toLocaleString()}원/월</div>
                  </div>
                )}
              </div>
              {sub.special_features && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--accent-purple)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', background: 'rgba(139,92,246,0.06)' }}>
                  ✨ 특화설계: {sub.special_features}
                </div>
              )}
            </div>
          )}

          {/* 평형별 공급 정보 — 정확한 데이터 테이블 */}
          {sub.house_type_info && (() => {
            const types = Array.isArray(sub.house_type_info) ? sub.house_type_info : [];
            if (!types.length) return null;
            const hasPrice = types.some((t: any) => Number(t.lttot_top_amount || 0) > 0);
            const totalGen = types.reduce((s: number, t: any) => s + Number(t.supply || 0), 0);
            const totalSpe = types.reduce((s: number, t: any) => s + Number(t.spsply_hshldco || 0), 0);
            return (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>📐 평형별 공급 · 분양가</span>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>총 {sub.tot_supply_hshld_co}세대 (일반{totalGen} · 특별{totalSpe})</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid var(--border)' }}>
                        <th style={{ padding: '5px 6px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>타입</th>
                        <th style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>전용(㎡)</th>
                        <th style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>공급(㎡)</th>
                        <th style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>일반</th>
                        <th style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>특별</th>
                        <th style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>합계</th>
                        {hasPrice && <th style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>최고분양가</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {types.map((t: any, i: number) => {
                        const typeLabel = t.type || '';
                        const exclusiveArea = parseFloat((typeLabel || '0').replace(/[A-Za-z]/g, ''));
                        const supplyArea = parseFloat(t.area || '0');
                        const supply = Number(t.supply || 0);
                        const spsply = Number(t.spsply_hshldco || 0);
                        const total = supply + spsply;
                        const price = Number(t.lttot_top_amount || 0);
                        const priceMin = Number(t.lttot_min_amount || 0);
                        const priceAvg = Number(t.lttot_avg_amount || 0);
                        const displayPrice = priceAvg || price;
                        const ppyeong = displayPrice > 0 && exclusiveArea > 10 ? Math.round(displayPrice / (exclusiveArea / 3.3058)) : 0;
                        const typeEstimated = !t.price_source || t.price_source !== 'regex';
                        const useRate = exclusiveArea > 0 && supplyArea > 0 ? Math.round(exclusiveArea / supplyArea * 100) : 0;
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '6px', fontWeight: 700, color: 'var(--text-primary)' }}>{typeLabel || '-'}</td>
                            <td style={{ padding: '6px', textAlign: 'right', color: 'var(--text-secondary)' }}>{exclusiveArea > 0 ? exclusiveArea.toFixed(1) : '-'}</td>
                            <td style={{ padding: '6px', textAlign: 'right', color: 'var(--text-tertiary)' }}>{supplyArea > 0 ? <>{supplyArea.toFixed(1)}{useRate > 0 && <div style={{ fontSize: 10, color: 'var(--accent-green)' }}>전용률 {useRate}%</div>}</> : '-'}</td>
                            <td style={{ padding: '6px', textAlign: 'right', color: 'var(--brand)', fontWeight: 600 }}>{supply}</td>
                            <td style={{ padding: '6px', textAlign: 'right', color: 'var(--accent-purple)' }}>{spsply}</td>
                            <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{total}</td>
                            {hasPrice && <td style={{ padding: '6px', textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{priceMin > 0 && priceMin !== price ? <><span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{priceMin >= 10000 ? `${(priceMin / 10000).toFixed(1)}억` : `${priceMin.toLocaleString()}`}~</span>{price >= 10000 ? `${(price / 10000).toFixed(1)}억` : `${price.toLocaleString()}만`}</> : price >= 10000 ? `${(price / 10000).toFixed(1)}억` : `${price.toLocaleString()}만`}</div>
                              {ppyeong > 0 && <div style={{ fontSize: 10, color: 'var(--accent-purple)' }}>평당 {ppyeong.toLocaleString()}만 <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>({priceAvg > 0 ? '평균' : '최고가'})</span>{priceMin > 0 && typeEstimated && sub?.price_source === 'estimated' ? <span style={{ fontSize: 7, marginLeft: 3, padding: '0px 3px', borderRadius: 4, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', fontWeight: 600 }}>추정</span> : null}</div>}
                            </td>}
                          </tr>
                        );
                      })}
                      <tr style={{ borderTop: '1.5px solid var(--brand)', background: 'var(--bg-hover)' }}>
                        <td style={{ padding: '6px', fontWeight: 800, color: 'var(--text-primary)' }}>합계</td>
                        <td></td>
                        <td></td>
                        <td style={{ padding: '6px', textAlign: 'right', fontWeight: 800, color: 'var(--brand)' }}>{totalGen}</td>
                        <td style={{ padding: '6px', textAlign: 'right', fontWeight: 800, color: 'var(--accent-purple)' }}>{totalSpe}</td>
                        <td style={{ padding: '6px', textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)' }}>{totalGen + totalSpe}</td>
                        {hasPrice && <td></td>}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>출처: 청약홈 모집공고 · 최고 분양가 기준 (만원)</div>
              </div>
            );
          })()}


          {/* 같은 시공사 분양가 비교 */}
          {sameBuilderSites.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>🏗️ {(sub.constructor_nm || site?.builder || '').split('(')[0].split('주식')[0].trim()} 분양가 비교</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xs)' }}>
                {sameBuilderSites.slice(0, 4).map((sb2: any) => {
                  const hti = Array.isArray(sb2.house_type_info) ? sb2.house_type_info : [];
                  const prices = hti.map((t: any) => Number(t.lttot_top_amount || 0)).filter((p: number) => p > 0);
                  const pMin = prices.length > 0 ? Math.min(...prices) : 0;
                  const pMax = prices.length > 0 ? Math.max(...prices) : 0;
                  return (
                  <Link key={sb2.id} href={`/apt/${sb2.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 'var(--radius-xs)', background: 'var(--bg-hover)', border: '1px solid var(--border)', textDecoration: 'none' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sb2.house_nm}</div>
                      <div style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{sb2.region_nm} · {sb2.tot_supply_hshld_co}세대</div>
                    </div>
                    {pMax > 0 && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-blue)', flexShrink: 0, marginLeft: 8 }}>{fmtAmount(pMin)}{pMax !== pMin ? `~${fmtAmount(pMax)}` : ''}</div>}
                  </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* 하단 CTA: 공유 + 청약홈 */}
          <div style={{ display: 'flex', gap: 6, marginTop: 'var(--sp-md)', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <SectionShareButton section="announcement" label={`${name} 모집공고 요약`} text={`${name} 입주자모집공고 핵심 요약 — ${sub.constructor_nm || site?.builder || ''} 시공, ${sub.tot_supply_hshld_co || site?.total_units || ''}세대`} pagePath={`/apt/${slug}`} />
            {sub.pblanc_url && <a href={sub.pblanc_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: 'var(--accent-green)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>🏠 청약홈 원문</a>}
          </div>
        </div>
      )}

      {/* Competition rate */}

      {/* 📊 인포그래픽 이미지 — 네이버/구글 이미지 검색 크롤링용 */}
      <figure style={{ margin: '0 0 var(--sp-md)', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <img
          src={`${SITE_URL}/api/og-chart?apt=${slug}`}
          alt={`${name} ${region} ${site?.sigungu || ''} 분양가 ${site?.price_min ? `${(site.price_min/10000).toFixed(1)}억` : ''} ${site?.price_max ? `${(site.price_max/10000).toFixed(1)}억` : ''} 세대수 ${site?.total_units || ''} 시공사 ${site?.builder || ''} 청약 분양 입주 인포그래픽 2026`}
          width={1200} height={630}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          loading="lazy"
        />
        <figcaption style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '6px 12px', background: 'var(--bg-surface)', textAlign: 'center' }}>
          {name} 분양 핵심 정보 · 카더라
        </figcaption>
      </figure>

      {/* 📊 AI 종합 분석 — SSR (봇=전체, 비로그인=블러) */}
      {analysisText && (
        <LoginGate feature="apt_analysis" title={`${name} 종합 분석`} description="이 단지의 시세 전망과 투자 분석을 확인하세요">
        <div className="apt-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <h2 style={ct}>📊 {name} 종합 분석</h2>
          <div className="apt-analysis-content" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.85 }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml((analysisText as string)
              .replace(/^## (.+)$/gm, '<h3 style="font-size:15px;font-weight:700;color:var(--text-primary);margin:18px 0 8px">$1</h3>')
              .replace(/^### (.+)$/gm, '<h4 style="font-size:14px;font-weight:600;color:var(--text-primary);margin:14px 0 6px">$1</h4>')
              .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>')
              .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:var(--brand);text-decoration:underline">$1</a>')
              .replace(/\n\n/g, '</p><p style="margin:0 0 10px">')
              .replace(/\n/g, '<br/>')
            )}}
          />
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            데이터: 국토교통부·청약홈·카더라 자체 수집
          </div>
        </div>
        </LoginGate>
      )}

      {/* 관심단지 등록 CTA — AI 분석 바로 아래 (노출 극대화) */}
      {/* 댓글 섹션 */}
      {site?.slug && <AptCommentSection slug={site.slug} siteName={name} />}

      <div id="interest-section" style={{ scrollMarginTop: 60 }}>
        {site?.id && <InterestRegistration siteId={site.id} siteName={name} interestCount={site.interest_count || 0} slug={slug} totalSupply={site?.total_units || sub?.tot_supply_hshld_co || null} />}
      </div>

      {/* Competition rate */}
      {sub?.competition_rate_1st && Number(sub.competition_rate_1st) > 0 && (
        <div className="apt-card" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <h2 style={ct}>🏆 청약 경쟁률</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-lg)', marginBottom: 'var(--sp-md)' }}>
            {/* 원형 게이지 */}
            <div style={{ position: 'relative', width: 70, height: 70, flexShrink: 0 }}>
              <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(99,102,241,0.15)" strokeWidth="3" />
                <circle cx="18" cy="18" r="16" fill="none" stroke="#8B5CF6" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${Math.min(Number(sub.competition_rate_1st) * 2, 100)} 100`} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-purple)', lineHeight: 1 }}>{Number(sub.competition_rate_1st).toFixed(1)}</span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>: 1</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>1순위 평균 경쟁률</div>
              <div style={{ fontSize: 12, color: Number(sub.competition_rate_1st) >= 30 ? 'var(--accent-red)' : Number(sub.competition_rate_1st) >= 10 ? 'var(--accent-orange)' : 'var(--accent-green)', fontWeight: 600 }}>
                {Number(sub.competition_rate_1st) >= 30 ? '🔥 초고경쟁' : Number(sub.competition_rate_1st) >= 10 ? '⚡ 높은 경쟁' : Number(sub.competition_rate_1st) >= 3 ? '📊 보통 경쟁' : '✅ 낮은 경쟁'}
              </div>
            </div>
          </div>
          {sub.total_apply_count && sub.supply_count && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-sm)' }}>총 지원 {Number(sub.total_apply_count).toLocaleString()}명 / 공급 {Number(sub.supply_count).toLocaleString()}세대</div>}
          {sub.house_type_info && Array.isArray(sub.house_type_info) && sub.house_type_info.length > 0 && (
            <div style={{ marginTop: 'var(--sp-md)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' as const }}>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 'var(--sp-sm)' }}>평형별 경쟁률</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)', minWidth: 300 }}>
                <thead><tr style={{ borderBottom: '2px solid var(--border)' }}><th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-tertiary)' }}>평형</th><th style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-tertiary)' }}>공급</th><th style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-tertiary)' }}>지원</th><th style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-tertiary)' }}>경쟁률</th></tr></thead>
                <tbody>{(sub.house_type_info as Record<string, number | string>[]).map((t: Record<string, number | string>, i: number) => <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--text-primary)' }}>{t.type || t.area || '-'}</td><td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{(t.supply || 0).toLocaleString()}</td><td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{(t.apply || 0).toLocaleString()}</td><td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: Number(t.rate || 0) >= 10 ? 'var(--accent-red)' : 'var(--accent-purple)' }}>{t.rate ? `${t.rate}:1` : '-'}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Unsold section */}
      {unsold && (
        <div className="apt-card" style={{ borderLeft: '4px solid var(--accent-red)', borderRadius: 0 }}>
          <h2 style={ct}>🏚️ 미분양 현황</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginBottom: 'var(--sp-sm)' }}>
            <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>미분양</div>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--accent-red)' }}>{(unsold.tot_unsold_hshld_co || 0).toLocaleString()}호</div>
            </div>
            <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>공급세대</div>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>{unsold.tot_supply_hshld_co ? unsold.tot_supply_hshld_co.toLocaleString() : '-'}</div>
            </div>
            <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>미분양률</div>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: unsoldRate && unsoldRate > 50 ? 'var(--accent-red)' : 'var(--accent-yellow)' }}>{unsoldRate !== null ? `${unsoldRate}%` : '-'}</div>
            </div>
          </div>
          {unsoldRate !== null && <div style={{ height: 6, background: 'var(--bg-hover)', borderRadius: 4, marginBottom: 6, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 4, width: `${Math.min(unsoldRate, 100)}%`, background: unsoldRate > 70 ? 'var(--accent-red)' : unsoldRate > 40 ? 'var(--accent-orange)' : 'var(--accent-yellow)' }} /></div>}
          {unsold.after_completion_unsold > 0 && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent-red)', fontWeight: 600, marginBottom: 4 }}>준공후(악성) 미분양 {unsold.after_completion_unsold}호</div>}
          {(unsold as any).ai_summary && <div style={{ padding: '6px 8px', borderLeft: '2px solid rgba(59,123,246,0.25)', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 6 }}>{(unsold as any).ai_summary}</div>}
        </div>
      )}

      {/* Redev section */}
      {redev && redevStage && (() => { const ci = STAGES.indexOf(redevStage) >= 0 ? STAGES.indexOf(redevStage) : STAGES.findIndex(s => redevStage.includes(s.slice(0, 2))); const pct = ci >= 0 ? Math.round(((ci + 1) / STAGES.length) * 100) : 0; return (
        <div className="apt-card"><h2 style={ct}>🏗️ 재개발 진행 현황</h2>
          <div className="apt-stages">{STAGES.map((s, i) => <div key={s} style={{ background: i <= ci ? (i === ci ? '#B794FF' : 'rgba(183,148,255,0.2)') : 'var(--bg-hover)', color: i === ci ? 'var(--bg-base)' : i < ci ? '#B794FF' : 'var(--text-tertiary)' }}>{s.replace('사업시행인가', '시행인가').replace('정비구역지정', '구역지정')}</div>)}</div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}><div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: '#B794FF' }} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}><span>구역지정</span><span style={{ color: '#B794FF', fontWeight: 700 }}>{redevStage} ({pct}%)</span><span>준공</span></div>
          {redev.ai_summary && <div style={{ marginTop: 10, padding: 'var(--sp-md) var(--card-p)', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, var(--accent-blue-bg), rgba(52,211,153,0.06))', border: '1px solid rgba(96,165,250,0.15)' }}><div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 3 }}>🤖 AI 분석</div><div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', lineHeight: 1.5 }}>{redev.ai_summary}</div></div>}
          {[redev.constructor && ['🏗️ 시공사', redev.constructor], redev.developer && ['🏢 시행사', redev.developer], redev.total_households && ['👥 세대수', `${redev.total_households.toLocaleString()}세대`], (redev as any).area_sqm && ['📐 면적', `${((redev as any).area_sqm / 1000).toFixed(0)}천m²`]].filter(Boolean).map(([l, v]: [string, string]) => <div key={l} style={{ ...rw, borderBottom: 'none' }}><span style={rl}>{l}</span><span style={rv}>{v}</span></div>)}
          {redev.notes && !redev.ai_summary && <div style={{ padding: '6px 8px', borderLeft: '2px solid rgba(183,148,255,0.25)', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 6 }}>{redev.notes}</div>}
        </div>); })()}

      {/* 주변 아파트 시세 비교 (단지백과 데이터) */}
      {complexProfiles.length > 0 && (site?.price_min || site?.price_max) && (() => {
        const avgPyeong = complexProfiles.filter((c: any) => c.avg_sale_price_pyeong > 0).reduce((s: number, c: any, _: number, a: any[]) => s + c.avg_sale_price_pyeong / a.length, 0);
        const avgJeonse = complexProfiles.filter((c: any) => c.jeonse_ratio && Number(c.jeonse_ratio) > 0);
        const avgJeonseRatio = avgJeonse.length > 0 ? Math.round(avgJeonse.reduce((s: number, c: any) => s + Number(c.jeonse_ratio), 0) / avgJeonse.length) : 0;
        const myPriceMax = site?.price_max || 0;
        const myPpyeong = (() => { const t = Array.isArray(sub?.house_type_info) ? sub.house_type_info : []; if (!t.length) return 0; const p = t[0]; const ea = parseFloat((p.type || '0').replace(/[A-Za-z]/g, '')); const usePrice = p.lttot_avg_amount || p.lttot_top_amount || 0; return usePrice > 0 && ea > 10 ? Math.round(usePrice / (ea / 3.3058)) : 0; })();
        return (
        <div className="apt-card">
          <h2 style={ct}>📊 {sigungu || region} 아파트 시세 비교</h2>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 8px' }}>단지백과 데이터 기반. 같은 지역 기존 아파트와 분양가를 비교합니다.</p>
          {/* 평당가 + 전세가율 KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 6, marginBottom: 10 }}>
            <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>지역 평당가 <span style={{ fontSize: 7 }}>(실거래 평균)</span></div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{avgPyeong > 0 ? `${Math.round(avgPyeong).toLocaleString()}만` : '-'}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>기존 아파트</div>
            </div>
            <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>이 분양 평당가 <span style={{ fontSize: 7 }}>(평균가)</span>{sub?.price_source === 'estimated' ? <span style={{ fontSize: 7, marginLeft: 2, padding: '0px 3px', borderRadius: 4, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', fontWeight: 600 }}>추정</span> : null}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: myPpyeong > avgPyeong ? 'var(--accent-red)' : 'var(--accent-green)' }}>{myPpyeong > 0 ? `${myPpyeong.toLocaleString()}만` : '-'}</div>
              <div style={{ fontSize: 10, color: myPpyeong > avgPyeong ? 'var(--accent-red)' : 'var(--accent-green)' }}>{avgPyeong > 0 && myPpyeong > 0 ? (myPpyeong > avgPyeong ? `+${Math.round((myPpyeong - avgPyeong) / avgPyeong * 100)}%` : `${Math.round((myPpyeong - avgPyeong) / avgPyeong * 100)}%`) : ''}</div>
            </div>
            <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>지역 전세가율</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: avgJeonseRatio >= 80 ? 'var(--accent-blue)' : 'var(--text-primary)' }}>{avgJeonseRatio > 0 ? `${avgJeonseRatio}%` : '-'}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>기존 아파트</div>
            </div>
          </div>
          {/* 개별 단지 비교 */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1.5px solid var(--border)' }}>
                <th style={{ padding: '4px 6px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>단지명</th>
                <th style={{ padding: '4px 6px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>준공</th>
                <th style={{ padding: '4px 6px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>매매가</th>
                <th style={{ padding: '4px 6px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>평당가<span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400 }}>(실거래)</span></th>
                <th style={{ padding: '4px 6px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>전세가율</th>
                <th style={{ padding: '4px 6px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>전년대비</th>
              </tr></thead>
              <tbody>
                {complexProfiles.slice(0, 6).map((c: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '5px 6px', fontWeight: 600, color: 'var(--text-primary)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.apt_name}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-tertiary)' }}>{c.built_year || '-'}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700, color: 'var(--accent-blue)' }}>{fmtAmount(c.latest_sale_price)}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-secondary)' }}>{c.avg_sale_price_pyeong ? `${c.avg_sale_price_pyeong.toLocaleString()}만` : '-'}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: Number(c.jeonse_ratio || 0) >= 80 ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}>{c.jeonse_ratio ? `${c.jeonse_ratio}%` : '-'}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 600, color: Number(c.price_change_1y || 0) > 0 ? 'var(--accent-red)' : Number(c.price_change_1y || 0) < 0 ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}>{c.price_change_1y ? `${Number(c.price_change_1y) > 0 ? '+' : ''}${c.price_change_1y}%` : '-'}</td>
                  </tr>
                ))}
                {myPriceMax > 0 && (
                  <tr style={{ borderTop: '1.5px solid var(--brand)', background: 'var(--bg-hover)' }}>
                    <td style={{ padding: '5px 6px', fontWeight: 800, color: 'var(--brand)' }}>{name}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-tertiary)' }}>분양중</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 800, color: 'var(--brand)' }}>{fmtAmount(myPriceMax)}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700, color: 'var(--brand)' }}>{myPpyeong > 0 ? `${myPpyeong.toLocaleString()}만` : '-'}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-tertiary)' }}>-</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-tertiary)' }}>-</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>출처: 단지백과 · 국토교통부 실거래가 공개시스템</div>
            <SectionShareButton section="apt-price-compare" label={`${name} vs ${sigungu || region} 아파트 시세 비교`} pagePath={`/apt/${slug}`} />
          </div>
        </div>
        );
      })()}

      {/* 같은 지역 최근 실거래 비교 */}
      {regionTrades.length > 0 && (site?.price_min || site?.price_max) && (
        <div className="apt-card">
          <h2 style={ct}>📊 {sigungu || region} 최근 실거래 비교</h2>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 8px' }}>같은 지역 아파트 최근 실거래가와 비교합니다.</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1.5px solid var(--border)' }}>
                <th style={{ padding: '5px 6px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>단지명</th>
                <th style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>거래일</th>
                <th style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>면적(㎡)</th>
                <th style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>거래가</th>
                <th style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>층</th>
              </tr></thead>
              <tbody>
                {regionTrades.slice(0, 8).map((t: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '5px 6px', fontWeight: 600, color: 'var(--text-primary)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.apt_name}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-tertiary)' }}>{t.deal_date}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-secondary)' }}>{t.exclusive_area}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700, color: 'var(--accent-blue)' }}>{fmtAmount(Number(t.deal_amount))}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-tertiary)' }}>{t.floor}층</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>출처: 국토교통부 실거래가 공개시스템</div>
            <SectionShareButton section="apt-trade-compare" label={`${sigungu || region} 최근 실거래 vs ${name} 분양가 비교`} pagePath={`/apt/${slug}`} />
          </div>
        </div>
      )}

      {/* 주변 시설 (nearby_facilities) — 크롤러 가시적 텍스트 */}
      {site?.nearby_facilities && Object.keys(site.nearby_facilities as Record<string, number>).length > 0 && (() => {
        const facilityLabels: Record<string, string> = { mart: '마트', park: '공원', school: '학교', subway: '지하철', hospital: '병원', bank: '은행', pharmacy: '약국', convenience: '편의점', library: '도서관', gym: '체육관' };
        const entries = Object.entries(site.nearby_facilities as Record<string, any>).filter(([k]) => k !== 'updated_at' && k !== 'created_at');
        if (entries.length === 0 || entries.every(([, v]) => Number(v) === 0)) return null;
        return (
        <div className="apt-card">
          <h2 style={ct}>🏪 주변 시설</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-sm)' }}>
            {entries.map(([facility, count]) => (
              <div key={facility} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', padding: '6px 12px', borderRadius: 'var(--radius-xl)', background: 'var(--bg-hover)', border: '1px solid var(--border)', fontSize: 'var(--fs-xs)' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{facilityLabels[facility] || facility}</span>
                <span style={{ color: 'var(--brand)', fontWeight: 700 }}>{count}개</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 'var(--sp-sm)', lineHeight: 1.6 }}>
            {name} 주변에는 {entries.map(([f, c]) => `${facilityLabels[f] || f} ${c}개`).join(', ')} 등의 편의시설이 있습니다.
          </p>
        </div>
        );
      })()}

      {/* 실거래 텍스트 요약 (서버 렌더링 — 크롤러용) */}
      {trades.length > 0 && (
        <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--card-p) var(--sp-lg)', marginBottom: 'var(--sp-md)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>📊 {name} 실거래 요약</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0, wordBreak: 'keep-all' }}>
            {name}의 최근 실거래 이력은 총 {trades.length}건입니다.
            {(() => {
              const amounts = trades.map((t: any) => Number(t.deal_amount)).filter((a: number) => a > 0);
              if (amounts.length === 0) return '';
              const min = Math.min(...amounts);
              const max = Math.max(...amounts);
              const avg = Math.round(amounts.reduce((s: number, a: number) => s + a, 0) / amounts.length);
              return ` 거래 금액은 ${fmtAmount(min)} ~ ${fmtAmount(max)} 범위이며, 평균 ${fmtAmount(avg)}입니다.`;
            })()}
            {trades[0]?.deal_date && ` 가장 최근 거래일은 ${trades[0].deal_date}입니다.`}
          </p>
        </section>
      )}

      {/* Transactions */}
      {trades.length > 0 && (
        <div className="apt-card"><h2 style={ct}>💰 실거래 이력 ({trades.length}건)</h2>
          {/* 서버 렌더링 통계 요약 (차트 로드 전 즉시 표시) */}
          {(() => {
            const amounts = trades.map((t: any) => Number(t.deal_amount)).filter((a: number) => a > 0);
            if (amounts.length < 2) return null;
            const avg = Math.round(amounts.reduce((s: number, a: number) => s + a, 0) / amounts.length);
            const mx = Math.max(...amounts);
            const mn = Math.min(...amounts);
            const latest = amounts[0] || 0;
            const trend = latest > avg ? '↑' : latest < avg ? '↓' : '→';
            const tColor = latest > avg ? '#34D399' : latest < avg ? '#F87171' : 'var(--text-tertiary)';
            return (
              <div className="kd-grid-4" style={{ gap: 'var(--sp-xs)', marginBottom: 10 }}>
                {[
                  { label: '최근', value: fmtAmount(latest), color: tColor, sub: trend },
                  { label: '평균', value: fmtAmount(avg), color: 'var(--brand)', sub: '' },
                  { label: '최저', value: fmtAmount(mn), color: 'var(--accent-green)', sub: '' },
                  { label: '최고', value: fmtAmount(mx), color: 'var(--accent-red)', sub: '' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-xs)', padding: '5px 6px', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: s.color }}>{s.value}{s.sub && <span style={{ marginLeft: 2 }}>{s.sub}</span>}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            );
          })()}
          {/* 층별 · 면적별 분석 */}
          {trades.length >= 5 && (() => {
            const vt = trades.filter((t: any) => Number(t.deal_amount) > 0 && Number(t.exclusive_area) > 0);
            if (vt.length < 5) return null;
            const fg: Record<string, any[]> = { '저층(1~5)': vt.filter((t: any) => t.floor >= 1 && t.floor <= 5), '중층(6~15)': vt.filter((t: any) => t.floor >= 6 && t.floor <= 15), '고층(16+)': vt.filter((t: any) => t.floor >= 16) };
            const ag: Record<string, any[]> = {};
            vt.forEach((t: any) => { const a = Number(t.exclusive_area); const k = a < 60 ? '소형(~59m²)' : a < 85 ? '중형(60~84)' : '대형(85+)'; if (!ag[k]) ag[k] = []; ag[k].push(t); });
            const avg = (arr: any[]) => arr.length > 0 ? Math.round(arr.reduce((s: number, t: any) => s + Number(t.deal_amount), 0) / arr.length) : 0;
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '8px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>층별 평균</div>
                  {Object.entries(fg).filter(([, a]) => a.length > 0).map(([k, arr]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>{k}</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmtAmount(avg(arr))}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '8px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>면적별 평균</div>
                  {Object.entries(ag).filter(([, a]) => a.length > 0).map(([k, arr]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>{k}</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmtAmount(avg(arr))}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          <AptPriceTrendChart aptName={name} region={region} />
          {(() => {
            const tradeAmts = trades.slice(0, 10).map((t: any) => Number(t.deal_amount));
            const tradeMax = Math.max(...tradeAmts.filter((a: number) => a > 0), 1);
            return trades.slice(0, 10).map((t: Record<string, any>, i: number) => (
              <div key={t.id || i} style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: i < Math.min(trades.length, 10) - 1 ? '1px solid var(--border)' : 'none', fontSize: 'var(--fs-sm)', gap: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{t.deal_date}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t.exclusive_area}㎡ · {t.floor}층</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 4, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${tradeMax > 0 ? (Number(t.deal_amount) / tradeMax) * 100 : 0}%`, borderRadius: 4, background: t.deal_amount >= 100000 ? 'rgba(248,113,113,0.5)' : t.deal_amount >= 50000 ? 'rgba(251,146,60,0.5)' : 'rgba(52,211,153,0.5)' }} />
                  </div>
                </div>
                <span style={{ fontWeight: 700, flexShrink: 0, color: t.deal_amount >= 100000 ? 'var(--accent-red)' : t.deal_amount >= 50000 ? 'var(--accent-orange)' : 'var(--accent-green)', minWidth: 48, textAlign: 'right' }}>{fmtAmount(t.deal_amount)}</span>
              </div>
            ));
          })()}
          <Link href={`/apt/complex/${encodeURIComponent(name)}`} style={{ display: 'block', textAlign: 'center', marginTop: 10, padding: '8px 0', borderRadius: 'var(--radius-sm)', background: 'var(--brand-bg)', color: 'var(--brand)', fontSize: 'var(--fs-sm)', fontWeight: 600, textDecoration: 'none' }}>전체 실거래 내역 보기 →</Link>
        </div>
      )}

      {/* Location */}
      <div className="apt-card"><h2 style={ct}>📍 위치 정보</h2>
        {(site?.address || sub?.hssply_adres || redev?.address) && <div style={rw}><span style={rl}>주소</span><span style={{ ...rv, fontSize: 'var(--fs-xs)', maxWidth: '70%' }}>{site?.address || sub?.hssply_adres || redev?.address}</span></div>}
        {(site?.nearby_station || sub?.nearest_station) && <div style={rw}><span style={rl}>최근접역</span><span style={{ ...rv, color: 'var(--accent-green)' }}>{site?.nearby_station || sub?.nearest_station}</span></div>}
        {(site?.school_district || sub?.nearest_school) && <div style={{ ...rw, borderBottom: redev?.notes ? undefined : 'none' }}><span style={rl}>학군</span><span style={rv}>{site?.school_district || sub?.nearest_school}</span></div>}
        {redev?.notes && <div style={{ ...rw, borderBottom: 'none' }}><span style={rl}>비고</span><span style={rv}>{redev.notes}</span></div>}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <a href={`https://map.kakao.com/?q=${encodeURIComponent(site?.address || sub?.hssply_adres || redev?.address || name)}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>🗺️ 카카오맵</a>
          <a href={`https://map.naver.com/p/search/${encodeURIComponent(site?.address || sub?.hssply_adres || redev?.address || name)}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>🗺️ 네이버지도</a>
        </div>
      </div>

      {/* 비로그인 가입 유도 CTA — InlineCTA */}
      {!aptUser && <RelatedContentCard type="apt" entityName={name} />}

      {/* Comments */}
      {sub && <div className="apt-card"><ContentLock title="한줄평 보기" description="가입하면 다른 사람들의 한줄평을 볼 수 있어요"><AptCommentInline houseKey={sub.house_manage_no || String(sub.id)} houseNm={name} houseType="sub" /></ContentLock></div>}

      {/* Related posts */}
      {relatedPosts.length > 0 && <div className="apt-card"><h2 style={ct}>💬 커뮤니티 게시글</h2>{relatedPosts.map((p: Record<string, any>) => <Link key={p.id} href={`/feed/${p.id}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit', fontSize: 'var(--fs-sm)' }}><span style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span><span style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 8, fontSize: 'var(--fs-xs)' }}>댓글 {p.comments_count || 0}</span></Link>)}</div>}

      {/* Related blogs */}
      {relatedBlogs.length > 0 && <div className="apt-card" id="stats-section" style={{ scrollMarginTop: 60 }}><h2 style={ct}>📰 관련 분석 블로그</h2>{relatedBlogs.map((b: Record<string, any>) => <Link key={b.slug} href={`/blog/${b.slug}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit', fontSize: 'var(--fs-sm)' }}><span style={{ color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span><span style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 8, fontSize: 'var(--fs-xs)' }}>👀 {(b.view_count || 0).toLocaleString()}</span></Link>)}</div>}

      {/* Nearby sites (internal linking SEO) */}
      {nearbySites.length > 0 && <div className="apt-card"><h2 style={ct}>🏗️ {region} 다른 현장</h2><div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--sp-sm)' }}>{nearbySites.map((ns: Record<string, any>) => <Link key={ns.slug} href={`/apt/${ns.slug}`} className="kd-card" style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: 10, textDecoration: 'none', color: 'inherit', overflow: 'hidden' }}><div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{ns.name}</div><div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ns.sigungu || ns.region} · {ns.total_units ? `${ns.total_units}세대` : ''} · {tLabel[ns.site_type]}</div></Link>)}</div></div>}

      {/* 지역 허브 내부 링크 */}
      {(region || sigungu) && <div className="apt-card" style={{ padding: '12px 14px' }}><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {region && <Link href={`/apt/region/${encodeURIComponent(region)}`} style={{ padding: '5px 12px', background: 'var(--bg-hover)', borderRadius: 20, textDecoration: 'none', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>📍 {region} 부동산</Link>}
        {region && sigungu && <Link href={`/apt/area/${encodeURIComponent(region)}/${encodeURIComponent(sigungu)}`} style={{ padding: '5px 12px', background: 'var(--bg-hover)', border: '1px solid var(--accent-blue)', borderRadius: 20, textDecoration: 'none', fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600 }}>{sigungu} 시세</Link>}
        {region && sigungu && site?.dong && <Link href={`/apt/area/${encodeURIComponent(region)}/${encodeURIComponent(sigungu)}/${encodeURIComponent(site.dong)}`} style={{ padding: '5px 12px', background: 'var(--bg-hover)', borderRadius: 20, textDecoration: 'none', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>{site.dong} 아파트</Link>}
      </div></div>}

      {/* FAQ */}
      {faq.length > 0 && <div className="apt-card"><h2 style={ct}>❓ 자주 묻는 질문</h2>{faq.map((f, i) => <details key={i} style={{ borderBottom: i < faq.length - 1 ? '1px solid var(--border)' : 'none', padding: '10px 0' }}><summary style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between' }}><span>{f.q}</span><span style={{ color: 'var(--text-tertiary)' }}>+</span></summary><p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '6px 0 0' }}>{f.a}</p></details>)}</div>}

      {/* 업데이트 시간 + 태그 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-md)', marginTop: 'var(--sp-md)', fontSize: 11, color: 'var(--text-tertiary)', flexWrap: 'wrap', gap: 6 }}>
        <time dateTime={site?.updated_at || sub?.fetched_at || new Date().toISOString()}>
          최종 업데이트: {new Date(site?.updated_at || sub?.fetched_at || Date.now()).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
        </time>
        <div style={{ display: 'flex', gap: 'var(--sp-xs)', flexWrap: 'wrap' }}>
          {[region, site?.sigungu, tLabel[sType], site?.builder || sub?.constructor_nm, '아파트'].filter(Boolean).slice(0, 4).map(tag => (
            <Link key={tag} href={`/search?q=${encodeURIComponent(String(tag))}`} style={{ padding: '3px 8px', borderRadius: 'var(--radius-card)', background: 'var(--bg-hover)', color: 'var(--text-tertiary)', fontSize: 10, textDecoration: 'none' }}>#{tag}</Link>
          ))}
        </div>
      </div>

      {/* 프로 업셀 — 결제 시스템 출시 전까지 비공개 */}

      <Disclaimer type="apt" />
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textAlign: 'center', margin: '8px 0 40px', lineHeight: 1.6 }}>📊 데이터 출처: 국토교통부 · 청약홈 · 한국부동산원 · 각 지자체</p>
    </article>
  );
}
