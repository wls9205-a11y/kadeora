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
import AptBookmarkButton from '@/components/AptBookmarkButton';
import Disclaimer from '@/components/Disclaimer';
import AptImageGallery from '@/components/AptImageGallery';
import { sanitizeSearchQuery } from '@/lib/sanitize';

const AptPriceTrendChart = dynamic(() => import('@/components/charts/AptPriceTrendChart'));
const AptReviewSection = dynamic(() => import('@/components/AptReviewSection'));
const InterestRegistration = dynamic(() => import('@/components/InterestRegistration'));
const SignupCTA = dynamic(() => import('@/components/SignupCTA'));

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
  const APT_COLS = 'id,slug,name,site_type,region,sigungu,dong,address,description,seo_title,seo_description,builder,developer,total_units,built_year,move_in_date,status,is_active,content_score,interest_count,page_views,images,key_features,faq_items,nearby_facilities,nearby_station,school_district,price_min,price_max,price_comparison,search_trend,latitude,longitude,source_ids,created_at,updated_at';

  // Phase 1: apt_sites — exact slug → multi-stage fuzzy fallback
  let { data: site } = await sb.from('apt_sites').select(APT_COLS).eq('slug', slug).maybeSingle();

  if (!site && slug.length > 2) {
    // Helper: extract Korean-only portion (remove all latin letters & standalone digits)
    const koreanOnly = slug.replace(/-/g, ' ').replace(/[a-z0-9]+/gi, '').replace(/\s+/g, ' ').trim();
    const slugNoAlpha = slug.replace(/[a-z]+/g, ''); // strip all english letters from slug

    // Stage 2: slug with letters stripped (a3bl→3, 중흥s-클래스→중흥-클래스)
    if (slugNoAlpha !== slug && slugNoAlpha.length > 3) {
      const { data } = await sb.from('apt_sites').select(APT_COLS).eq('slug', slugNoAlpha).maybeSingle();
      if (data) site = data;
    }

    // Stage 3: slug with all alphanumeric suffix stripped (메트로시티a3bl→메트로시티)
    if (!site) {
      const noSuffix = slug.replace(/[a-z0-9]+$/i, '').replace(/-+$/, '');
      if (noSuffix !== slug && noSuffix.length > 3) {
        const { data } = await sb.from('apt_sites').select(APT_COLS).eq('slug', noSuffix).maybeSingle();
        if (data) site = data;
      }
    }

    // Stage 4: Korean-only ilike search on apt_sites.name (min 2 chars)
    if (!site && koreanOnly.length >= 2) {
      const searchTerm = koreanOnly.slice(0, 20);
      const { data } = await sb.from('apt_sites').select(APT_COLS)
        .ilike('name', `%${searchTerm}%`).eq('is_active', true)
        .order('content_score', { ascending: false }).limit(1).maybeSingle();
      if (data) site = data;
    }

    // Stage 5: slug word-parts ilike on apt_sites.slug (동성로-sk-leaders-view → %동성로%sk%leaders%view%)
    if (!site) {
      const slugWords = slug.split('-').filter(w => w.length > 0).join('%');
      if (slugWords.length > 3) {
        const { data } = await sb.from('apt_sites').select(APT_COLS)
          .ilike('slug', `%${slugWords}%`).eq('is_active', true)
          .order('content_score', { ascending: false }).limit(1).maybeSingle();
        if (data) site = data;
      }
    }
  }
  const sourceIds = (site?.source_ids || {}) as Record<string, string>;

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

  const [tradesR, blogsR, postsR, nearbyR, sameBuilderR, regionPriceR] = await Promise.allSettled([
    sb.from('apt_transactions').select('id, apt_name, deal_date, deal_amount, exclusive_area, floor, built_year').eq('apt_name', name).order('deal_date', { ascending: false }).limit(30),
    termBlog ? sb.from('blog_posts').select('slug, title, view_count, published_at').eq('is_published', true).or(`title.ilike.%${termBlog}%,title.ilike.%${rShort} 청약%,title.ilike.%${rShort} 부동산%`).order('view_count', { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    termPost ? sb.from('posts').select('id, title, created_at, comments_count').eq('is_deleted', false).ilike('title', `%${termPost}%`).order('created_at', { ascending: false }).limit(3) : Promise.resolve({ data: [] }),
    region ? sb.from('apt_sites').select('slug, name, site_type, region, sigungu, total_units, status').eq('is_active', true).eq('region', region).neq('slug', slug).gte('content_score', 25).order('interest_count', { ascending: false }).limit(4) : Promise.resolve({ data: [] }),
    // 같은 시공사 다른 현장 (내부 링크 SEO + 사용자 탐색)
    (sub?.constructor_nm || site?.builder) ? sb.from('apt_subscriptions').select('id, house_nm, region_nm, tot_supply_hshld_co, rcept_bgnde').ilike('constructor_nm', `%${(sub?.constructor_nm || site?.builder || '').split('(')[0].split('주식')[0].trim()}%`).neq('house_nm', name).order('rcept_bgnde', { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    // 지역 시세 벤치마크 (같은 지역 실거래 통계)
    region ? sb.from('apt_sites').select('price_min, price_max').eq('region', region).eq('is_active', true).gt('price_min', 0).gt('price_max', 0).limit(100) : Promise.resolve({ data: [] }),
  ]);

  const trades = tradesR.status === 'fulfilled' ? (tradesR.value as { data: any })?.data || [] : [];
  const relatedBlogs = blogsR.status === 'fulfilled' ? (blogsR.value as { data: any })?.data || [] : [];
  const relatedPosts = postsR.status === 'fulfilled' ? (postsR.value as { data: any })?.data || [] : [];
  const nearbySites = nearbyR.status === 'fulfilled' ? (nearbyR.value as { data: any })?.data || [] : [];
  const sameBuilderSites = sameBuilderR.status === 'fulfilled' ? (sameBuilderR.value as { data: any })?.data || [] : [];
  
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
  if (site?.id) { void sb.rpc('increment_site_view', { p_site_id: site.id }); }

  return { site, sub, unsold, redev, trades, relatedBlogs, relatedPosts, nearbySites, sameBuilderSites, regionBenchmark, name, region, slug };
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
    const ogImg = `${SITE_URL}/api/og?title=${encodeURIComponent(d.name)}&design=2&subtitle=${encodeURIComponent(`${d.region} ${d.site?.sigungu || ''} · ${uStr} ${builder}`.trim())}`;

    const priceStr = d.site?.price_min && d.site?.price_max
      ? ` ${d.site.price_min >= 10000 ? `${(d.site.price_min/10000).toFixed(1)}억` : `${d.site.price_min.toLocaleString()}만`}~${d.site.price_max >= 10000 ? `${(d.site.price_max/10000).toFixed(1)}억` : `${d.site.price_max.toLocaleString()}만`}`
      : '';
    return {
      title: `${title}${priceStr} | 모집공고 요약`, description: desc,
      alternates: { canonical: `${SITE_URL}/apt/${resolved.slug}` },
      robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const, 'max-video-preview': -1, googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const } },
      openGraph: { title, description: desc, url: `${SITE_URL}/apt/${resolved.slug}`, siteName: '카더라', locale: 'ko_KR', type: 'article', images: [{ url: ogImg, width: 1200, height: 630, alt: `${d.name} 분양정보` }] },
      twitter: { card: 'summary_large_image', title, description: desc, site: '@kadeora_app', images: [ogImg] },
      other: {
        'article:published_time': d.site?.created_at || d.sub?.fetched_at || '',
        'article:modified_time': d.site?.updated_at || new Date().toISOString(),
        'article:section': '부동산',
        'article:tag': `${d.name},${d.region},${tl[st] || '분양'},청약,분양가,분양가격,아파트,모집공고,입주자모집공고,견본주택,모델하우스`,
        // Kakao/Facebook price display
        ...(d.site?.price_min ? { 'og:price:amount': String(d.site.price_min), 'og:price:currency': 'KRW' } : {}),
        // Naver specific
        'naver:written_time': d.site?.created_at || d.sub?.fetched_at || '',
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

const ct: React.CSSProperties = { fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5, margin: '0 0 8px' };
const rw: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-sm)', gap: 8 };
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
  if (resolved.type === 'redirect' && resolved.slug) permanentRedirect(`/apt/${encodeURIComponent(resolved.slug)}`);
  if (resolved.type !== 'slug') notFound();

  let d;
  try {
    d = await fetchUnifiedData(resolved.slug);
  } catch {
    notFound();
  }
  if (!d) notFound();
  const { site, sub, unsold, redev, trades, relatedBlogs, relatedPosts, nearbySites, sameBuilderSites, regionBenchmark, name, region, slug } = d;
  const sType = site?.site_type || (sub ? 'subscription' : unsold ? 'unsold' : redev ? 'redevelopment' : trades.length > 0 ? 'trade' : 'subscription');
  const features = Array.isArray(site?.key_features) ? site.key_features : [];
  const dbFaq = Array.isArray(site?.faq_items) ? site.faq_items as { q: string; a: string }[] : [];
  // DB FAQ가 없으면 자동 생성 (네이버 FAQ 리치스니펫 확보)
  const faq: { q: string; a: string }[] = dbFaq.length > 0 ? dbFaq : [
    { q: `${name} 위치가 어디인가요?`, a: `${name}은(는) ${region} ${site?.sigungu || ''} ${site?.dong || site?.address || ''}에 위치해 있습니다. ${site?.nearby_station || sub?.nearest_station ? `최근접 역은 ${site?.nearby_station || sub?.nearest_station}입니다.` : ''}` },
    ...(sub?.rcept_bgnde ? [{ q: `${name} 청약 일정은 언제인가요?`, a: `${name}의 청약 접수 기간은 ${sub.rcept_bgnde} ~ ${sub.rcept_endde || ''}입니다. ${sub.przwner_presnatn_de ? `당첨자 발표일은 ${sub.przwner_presnatn_de}입니다.` : ''} ${sub.mvn_prearnge_ym ? `입주 예정은 ${fmtYM(sub.mvn_prearnge_ym)}입니다.` : ''}` }] : []),
    { q: `${name} 시공사(건설사)는 어디인가요?`, a: `${name}의 시공사는 ${site?.builder || sub?.constructor_nm || '미정'}입니다. ${site?.developer || sub?.developer_nm ? `시행사는 ${site?.developer || sub?.developer_nm}입니다.` : ''} 총 ${site?.total_units || sub?.tot_supply_hshld_co || '미정'}세대 규모입니다.` },
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
    <article style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }} itemScope itemType='https://schema.org/ApartmentComplex'>
      {noindex && <meta name="robots" content="noindex,follow" />}

      {/* JSON-LD 1: RealEstateListing */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': ['ApartmentComplex', 'RealEstateListing'], name, description: site?.description || `${region} ${name}`, url: `${SITE_URL}/apt/${slug}`, address: { '@type': 'PostalAddress', addressRegion: region, addressLocality: site?.sigungu || '', streetAddress: site?.address || sub?.hssply_adres || '', addressCountry: 'KR' }, ...(site?.total_units || sub?.tot_supply_hshld_co ? { numberOfRooms: site?.total_units || sub?.tot_supply_hshld_co } : {}), ...(site?.latitude && site?.longitude ? { geo: { '@type': 'GeoCoordinates', latitude: site.latitude, longitude: site.longitude } } : {}), ...(site?.builder || sub?.constructor_nm ? { brand: { '@type': 'Organization', name: site?.builder || sub?.constructor_nm } } : {}), ...(site?.price_min || site?.price_max ? { offers: { '@type': 'AggregateOffer', priceCurrency: 'KRW', ...(site?.price_min ? { lowPrice: site.price_min } : {}), ...(site?.price_max ? { highPrice: site.price_max } : {}), offerCount: site?.total_units || 1 } } : {}), ...((site?.interest_count ?? 0) > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: Math.min(4.5 + ((site!.interest_count ?? 0) / 100), 5.0).toFixed(1), ratingCount: Math.max(site!.interest_count ?? 1, 1), bestRating: '5' } } : {}) }) }} />

      {/* JSON-LD 2: FAQ */}
      {faq.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }) }} />}

      {/* JSON-LD 3: Breadcrumb */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '부동산', item: `${SITE_URL}/apt` }, ...(region ? [{ '@type': 'ListItem', position: 3, name: region, item: `${SITE_URL}/apt/region/${encodeURIComponent(region)}` }] : []), { '@type': 'ListItem', position: region ? 4 : 3, name }] }) }} />

      {/* JSON-LD 4: Place (Google Maps + 네이버 지도 연동) */}
      {(site?.latitude || site?.address) && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Place', name, address: { '@type': 'PostalAddress', addressRegion: region, addressLocality: site?.sigungu || site?.dong || '', addressCountry: 'KR', streetAddress: site?.address || '' }, ...(site?.latitude && site?.longitude ? { geo: { '@type': 'GeoCoordinates', latitude: site.latitude, longitude: site.longitude } } : {}), ...(site?.nearby_station ? { hasMap: `https://map.naver.com/v5/search/${encodeURIComponent(name)}` } : {}) }) }} />}

      {/* JSON-LD 4b: Event */}
      {sub?.rcept_bgnde && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Event', name: `${name} 청약 접수`, startDate: sub.rcept_bgnde, endDate: sub.rcept_endde, eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode', location: { '@type': 'VirtualLocation', url: `${SITE_URL}/apt/${slug}` }, organizer: { '@type': 'Organization', name: site?.builder || sub.constructor_nm || '청약홈', url: sub.pblanc_url || SITE_URL }, image: `${SITE_URL}/api/og?title=${encodeURIComponent(name)}&design=2&subtitle=${encodeURIComponent('청약 접수')}` }) }} />}

      {/* JSON-LD 5: Article + SpeakableSpecification (voice search, Google Discover) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: `${name} ${tLabel[sType] || '분양'} 정보`, description: site?.description || `${region} ${name}`, url: `${SITE_URL}/apt/${slug}`, datePublished: site?.created_at || sub?.fetched_at || new Date().toISOString(), dateModified: site?.updated_at || new Date().toISOString(), author: { '@type': 'Organization', name: '카더라', url: SITE_URL }, publisher: { '@type': 'Organization', name: '카더라', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icons/icon-192.png` } }, image: `${SITE_URL}/api/og?title=${encodeURIComponent(name)}&design=2&subtitle=${encodeURIComponent(region)}`, mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/apt/${slug}` }, speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.site-description'] } }) }} />

      {/* JSON-LD 6: Product (price range → Google price chip in SERP) */}
      {(site?.price_min || site?.price_max || (unsold?.sale_price_min)) && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org', '@type': 'Product',
          name: `${name} 분양`,
          description: `${region} ${name} 아파트 분양`,
          brand: { '@type': 'Organization', name: site?.builder || sub?.constructor_nm || '카더라' },
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'KRW',
            lowPrice: site?.price_min || unsold?.sale_price_min || 0,
            ...(site?.price_max ? { highPrice: site.price_max } : {}),
            offerCount: site?.total_units || sub?.tot_supply_hshld_co || 1,
            availability: 'https://schema.org/InStock',
            url: `${SITE_URL}/apt/${slug}`,
          },
        }) }} />
      )}

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

      <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12, flexWrap: 'wrap' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>
        <span>›</span>
        <Link href="/apt" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>부동산</Link>
        {region && <><span>›</span><Link href={`/apt/region/${encodeURIComponent(region)}`} style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>{region}</Link></>}
        <span>›</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{name}</span>
      </nav>

      {/* 이미지 갤러리 — 워터마크 + 반응형 (모바일 스와이프 / 데스크탑 그리드) */}
      {(() => {
        const dbImages = Array.isArray(site?.images) ? site.images.slice(0, 5).map((img: any) => ({
          url: typeof img === 'string' ? img : img?.url || img?.link || '',
          caption: typeof img === 'string' ? undefined : img?.caption,
        })).filter((img: any) => img.url) : [];
        const ogUrl = `${SITE_URL}/api/og?title=${encodeURIComponent(name)}&design=2&category=apt&subtitle=${encodeURIComponent(region)}`;
        const badgeEl = (
          <div style={{ position: 'absolute', top: 10, left: 12, display: 'flex', gap: 4, flexWrap: 'wrap', zIndex: 2 }}>
            {subSt && <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 12, background: SB[subSt].bg.replace('0.15', '0.85'), color: '#fff', fontWeight: 700 }}>{SB[subSt].label}{dDay !== null ? ` D${dDay > 0 ? '-' + dDay : dDay === 0 ? '-Day' : '+' + Math.abs(dDay)}` : ''}</span>}
            {sub?.is_price_limit && <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 12, background: 'rgba(139,92,246,0.85)', color: '#fff', fontWeight: 700 }}>상한제</span>}
            {redevStage && <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 12, background: 'rgba(251,191,36,0.85)', color: '#fff', fontWeight: 700 }}>{redevStage}</span>}
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
                position: 'relative', borderRadius: 14, overflow: 'hidden', marginBottom: 14,
                height: 140,
                background: 'linear-gradient(135deg, #0c1629 0%, #1a3050 50%, #1e3a8a 100%)',
              }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '16px 18px' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{region} {site?.sigungu || ''}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.2, wordBreak: 'keep-all' }}>{name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{site?.builder || sub?.constructor_nm || ''}{(() => {
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
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 'var(--fs-xs)', fontWeight: 700, background: tBg[sType], color: tClr[sType], border: `1px solid ${tClr[sType]}33` }}>{tLabel[sType]}</span>
          {subSt && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: SB[subSt].bg, color: SB[subSt].color, border: `1px solid ${SB[subSt].border}` }}>{SB[subSt].label}</span>}
          {redevStage && <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 'var(--fs-xs)', fontWeight: 700, background: 'rgba(255,212,59,0.15)', color: '#FFD43B' }}>{redevStage}</span>}
          {sub?.competition_rate_1st && Number(sub.competition_rate_1st) > 0 && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--accent-purple)', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: 10 }}>{Number(sub.competition_rate_1st).toFixed(1)}:1</span>}
        </div>
        <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: '6px 0 2px', lineHeight: 1.3, wordBreak: 'keep-all', overflowWrap: 'break-word' }}>{name}</h1>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', margin: '0 0 8px' }}>{[region, site?.sigungu, site?.dong].filter(Boolean).join(' ') || sub?.hssply_adres || ''}{(site?.builder || sub?.constructor_nm) ? ` · ${site?.builder || sub?.constructor_nm} 시공` : ''}</p>
        {(sub?.ai_summary || site?.description) && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(135deg, var(--brand-bg), rgba(139,92,246,0.06))', border: '1px solid var(--brand-border)' }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--brand)', marginBottom: 3 }}>🤖 AI 분석</div>
            <div className="site-description" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', lineHeight: 1.6 }}>{sub?.ai_summary || site?.description}</div>
          </div>
        )}
      </div>


      {/* Share + Bookmark — 바이럴 액션 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, padding: '8px 12px', borderRadius: 10, background: 'linear-gradient(135deg, rgba(59,123,246,0.04), rgba(139,92,246,0.04))', border: '1px solid rgba(59,123,246,0.1)' }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 2 }}>📢</span>
        <ShareButtons title={`${name} ${tLabel[sType]} — 분양가·청약일정·모집공고 한눈에`} postId={slug} />
        {sub && <AptBookmarkButton aptId={sub.id} isLoggedIn={!!aptUser} />}
      </div>

      {/* Key metrics — 시각 강화 대시보드 */}
      {(() => {
        const totalUnits = Number(site?.total_units || sub?.tot_supply_hshld_co || 0);
        const types = Array.isArray(sub?.house_type_info) ? sub.house_type_info : [];
        const generalSupply = types.reduce((s: number, t: any) => s + (t.supply || 0), 0);
        const specialSupply = types.reduce((s: number, t: any) => s + (t.spsply_hshldco || 0), 0);
        const hasBreakdown = generalSupply > 0 || specialSupply > 0;

        const cards = [
          { l: '총 공급', v: totalUnits > 0 ? `${totalUnits.toLocaleString()}` : '-', sub: hasBreakdown ? `일반 ${generalSupply} · 특별 ${specialSupply}` : '', c: 'var(--text-primary)', icon: '🏢', bar: Math.min((totalUnits / 5000) * 100, 100), barColor: 'var(--brand)' },
          { l: sub ? '분양가' : '시세', v: (() => {
            const pMin = site?.price_min || unsold?.sale_price_min || 0;
            const pMax = site?.price_max || 0;
            if (!pMin && !pMax) return '-';
            const fmt = (n: number) => n >= 10000 ? `${(n / 10000).toFixed(1)}억` : `${n.toLocaleString()}만`;
            if (pMin && pMax && pMin !== pMax) return `${fmt(pMin)}~\n${fmt(pMax)}`;
            return fmt(pMin || pMax);
          })(), sub: '', c: 'var(--brand)', icon: '💰', bar: 0, barColor: 'var(--brand)' },
          { l: '입주예정', v: fmtYM(site?.move_in_date || sub?.mvn_prearnge_ym) || '-', sub: '', c: 'var(--accent-green)', icon: '📅', bar: 0, barColor: 'var(--accent-green)' },
          { l: unsold ? '미분양' : '관심', v: unsold ? `${(unsold.tot_unsold_hshld_co || 0).toLocaleString()}호` : `${site?.interest_count || 0}명`, sub: '', c: unsold ? 'var(--accent-red)' : '#FFD43B', icon: unsold ? '⚠️' : '❤️', bar: unsold ? Math.min((unsold.tot_unsold_hshld_co || 0) / 500 * 100, 100) : Math.min((site?.interest_count || 0) / 50 * 100, 100), barColor: unsold ? 'var(--accent-red)' : '#FFD43B' },
        ];

        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: 6, marginBottom: 14 }}>
            {cards.map(s => (
              <div key={s.l} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 16, marginBottom: 2 }}>{s.icon}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>{s.l}</div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: s.c, lineHeight: 1.2, whiteSpace: 'pre-line' }}>{s.v}</div>
                {s.sub && <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.3 }}>{s.sub}</div>}
                {s.bar > 0 && <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-hover)', marginTop: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${s.bar}%`, borderRadius: 2, background: s.barColor }} /></div>}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Features */}
      {features.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>{features.map((f, i: number) => <span key={i} style={{ padding: '4px 10px', borderRadius: 16, fontSize: 'var(--fs-xs)', fontWeight: 600, background: 'rgba(59,123,246,0.1)', color: '#6CB4FF', border: '1px solid rgba(59,123,246,0.15)' }}>{String(f)}</span>)}</div>}

      {/* 분양가 범위 바 + D-day 위젯 */}
      {((site?.price_min && site?.price_max) || sub) && (
        <div style={{ display: 'grid', gridTemplateColumns: (site?.price_min && site?.price_max && sub) ? 'minmax(0,1fr) minmax(0,1fr)' : '1fr', gap: 6, marginBottom: 14 }}>
          {/* 분양가 범위 바 — 시각 강화 */}
          {site?.price_min && site?.price_max && (() => {
            const pMin = site.price_min;
            const pMax = site.price_max;
            const pAvg = Math.round((pMin + pMax) / 2);
            // 전용면적 기반 평당가 추정 (34평 기준)
            const pyeongPrice = sub?.price_per_pyeong_avg || Math.round(pAvg / 34);
            // 가격 등급 (만원 단위)
            const tier = pAvg >= 120000 ? { label: '12억+', color: '#FF6B6B', emoji: '💎' } : pAvg >= 90000 ? { label: '9억대', color: '#FB923C', emoji: '🏅' } : pAvg >= 60000 ? { label: '6억대', color: '#FBBF24', emoji: '✨' } : pAvg >= 30000 ? { label: '3억대', color: 'var(--brand)', emoji: '🏠' } : { label: '3억 미만', color: '#34D399', emoji: '🌱' };
            return (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>💰 분양가</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: tier.color, background: `${tier.color}15`, padding: '1px 6px', borderRadius: 4 }}>{tier.emoji} {tier.label}</span>
                </div>
                {/* 가격 범위 바 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 700, minWidth: 42 }}>{fmtAmount(pMin)}</span>
                  <div style={{ flex: 1, height: 10, borderRadius: 5, background: 'linear-gradient(90deg, rgba(96,165,250,0.25), var(--brand), rgba(248,113,113,0.25))', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: -1, left: '50%', width: 12, height: 12, borderRadius: '50%', background: 'var(--brand)', border: '2px solid var(--bg-surface)', transform: 'translateX(-50%)', boxShadow: '0 0 4px rgba(59,123,246,0.5)' }} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--accent-red)', fontWeight: 700, minWidth: 42, textAlign: 'right' }}>{fmtAmount(pMax)}</span>
                </div>
                {/* 평균 + 평당가 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>평균 <strong style={{ color: 'var(--text-primary)' }}>{fmtAmount(pAvg)}</strong></span>
                  {pyeongPrice > 0 && <span style={{ color: 'var(--accent-purple)' }}>평당 <strong>{pyeongPrice.toLocaleString()}만</strong></span>}
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
              { label: '입주예정', date: sub.mvn_prearnge_ym ? sub.mvn_prearnge_ym + '-01' : null },
            ].filter(m => m.date);
            const next = milestones.find(m => m.date && new Date(m.date) >= now) || milestones[milestones.length - 1];
            if (!next?.date) return null;
            const dday = Math.ceil((new Date(next.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return (
              <div style={{ background: dday <= 7 ? 'rgba(248,113,113,0.06)' : dday <= 30 ? 'rgba(251,191,36,0.06)' : 'var(--bg-surface)', border: `1px solid ${dday <= 7 ? 'rgba(248,113,113,0.2)' : dday <= 30 ? 'rgba(251,191,36,0.2)' : 'var(--border)'}`, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>📅 {next.label}까지</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: dday <= 0 ? 'var(--accent-green)' : dday <= 7 ? 'var(--accent-red)' : dday <= 30 ? '#FBBF24' : 'var(--brand)' }}>
                  {dday <= 0 ? '진행중' : `D-${dday}`}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{next.date}</div>
              </div>
            );
          })()}
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
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>📍 {region} 시세 비교 ({regionBenchmark.count}개 현장)</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: diff > 10 ? '#F87171' : diff < -10 ? '#34D399' : 'var(--text-tertiary)', background: diff > 10 ? 'rgba(248,113,113,0.1)' : diff < -10 ? 'rgba(52,211,153,0.1)' : 'var(--bg-hover)', padding: '1px 6px', borderRadius: 4 }}>
                {diff > 0 ? `+${diff}%` : `${diff}%`} {diff > 10 ? '고가' : diff < -10 ? '저가' : '평균'}
              </span>
            </div>
            {/* 지역 범위 위치 바 */}
            <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'linear-gradient(90deg, rgba(52,211,153,0.2), rgba(251,191,36,0.2), rgba(248,113,113,0.2))', marginBottom: 4 }}>
              {/* 지역 평균 마커 */}
              <div style={{ position: 'absolute', top: -2, left: '50%', width: 2, height: 12, background: 'var(--text-tertiary)', transform: 'translateX(-50%)', borderRadius: 1 }} />
              {/* 이 현장 위치 */}
              <div style={{ position: 'absolute', top: -3, left: `${position}%`, width: 14, height: 14, borderRadius: '50%', background: 'var(--brand)', border: '2px solid var(--bg-surface)', transform: 'translateX(-50%)', boxShadow: '0 0 6px rgba(59,123,246,0.5)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-tertiary)' }}>
              <span>{fmtAmount(regionBenchmark.lowest)}</span>
              <span style={{ color: 'var(--text-secondary)' }}>평균 {fmtAmount(regionAvg)}</span>
              <span>{fmtAmount(regionBenchmark.highest)}</span>
            </div>
          </div>
        );
      })()}

      {/* 가격 없는 현장 — 지역 참고 시세 */}
      {!site?.price_min && !site?.price_max && trades.length === 0 && regionBenchmark && (
        <div style={{ background: 'rgba(59,123,246,0.03)', border: '1px dashed rgba(59,123,246,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>💰 분양가 미공개 · {region} 참고 시세</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--brand)' }}>
            {fmtAmount(regionBenchmark.avgMin)} ~ {fmtAmount(regionBenchmark.avgMax)}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {region} {regionBenchmark.count}개 현장 평균 (실제 분양가와 다를 수 있음)
          </div>
        </div>
      )}
      {sub && (() => { 
        const steps = [
          { label: '특별공급', date: sub.spsply_rcept_bgnde, active: !!sub.spsply_rcept_bgnde },
          { label: '청약접수', date: sub.rcept_bgnde, active: !!sub.rcept_bgnde },
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
        const rows = [['분양유형', sub.mdatrgbn_nm], ['청약접수', sub.rcept_bgnde && sub.rcept_endde ? `${sub.rcept_bgnde} ~ ${sub.rcept_endde}` : null], ['특별공급', sub.spsply_rcept_bgnde ? `${sub.spsply_rcept_bgnde} ~ ${sub.spsply_rcept_endde}` : null], ['당첨자발표', sub.przwner_presnatn_de], ['계약', sub.cntrct_cncls_bgnde ? `${sub.cntrct_cncls_bgnde} ~ ${sub.cntrct_cncls_endde}` : null], ['입주예정', fmtYM(sub.mvn_prearnge_ym)], ['총공급', supplyStr]].filter(r => r[1]);
        return (
          <div className="apt-card">
            <h2 style={ct}>📅 분양 일정</h2>
            {/* 비주얼 타임라인 */}
            {steps.length >= 2 && (
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, padding: '0 4px', position: 'relative' }}>
                {/* 연결선 */}
                <div style={{ position: 'absolute', top: 8, left: 16, right: 16, height: 3, background: 'var(--bg-hover)', borderRadius: 2, zIndex: 0 }}>
                  <div style={{ height: '100%', borderRadius: 2, background: 'var(--brand)', width: `${(activeIdx / Math.max(steps.length - 1, 1)) * 100}%`, transition: 'width 0.5s' }} />
                </div>
                {steps.map((step, i) => {
                  const isPast = i < activeIdx;
                  const isCurrent = i === activeIdx;
                  return (
                    <div key={step.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1, flex: 1 }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: isPast ? 'var(--brand)' : isCurrent ? 'var(--accent-green)' : 'var(--bg-hover)', border: isCurrent ? '3px solid var(--accent-green)' : isPast ? '3px solid var(--brand)' : '3px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: (isPast || isCurrent) ? '#fff' : 'var(--text-tertiary)' }}>
                        {isPast ? '✓' : ''}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: (isPast || isCurrent) ? 700 : 400, color: isCurrent ? 'var(--accent-green)' : isPast ? 'var(--brand)' : 'var(--text-tertiary)', marginTop: 4, textAlign: 'center', lineHeight: 1.2 }}>{step.label}</div>
                      {step.date && <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1 }}>{step.date.slice(5, 10).replace('-', '/')}</div>}
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
              <span style={{ fontSize: 12, fontWeight: 800, color: premium > 0 ? 'var(--accent-red)' : '#34D399', background: premium > 0 ? 'rgba(248,113,113,0.1)' : 'rgba(52,211,153,0.1)', padding: '2px 8px', borderRadius: 6 }}>
                {premium > 0 ? `+${premium}% 프리미엄` : premium < 0 ? `${premium}% 저평가` : '시세 동일'}
              </span>
            </div>
            {/* 비교 바 차트 */}
            <div style={{ position: 'relative', height: 80, marginBottom: 8 }}>
              {/* 분양가 범위 */}
              <div style={{ position: 'absolute', top: 8, left: `${pct(site.price_min)}%`, width: `${pct(site.price_max) - pct(site.price_min)}%`, height: 20, borderRadius: 6, background: 'rgba(59,123,246,0.2)', border: '1.5px solid var(--brand)' }}>
                <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', fontSize: 9, fontWeight: 700, color: 'var(--brand)', whiteSpace: 'nowrap' }}>분양가</div>
              </div>
              {/* 실거래 범위 */}
              <div style={{ position: 'absolute', top: 44, left: `${pct(tradeMin)}%`, width: `${pct(tradeMax) - pct(tradeMin)}%`, height: 20, borderRadius: 6, background: premium > 0 ? 'rgba(248,113,113,0.15)' : 'rgba(52,211,153,0.15)', border: `1.5px solid ${premium > 0 ? '#F87171' : '#34D399'}` }}>
                <div style={{ position: 'absolute', bottom: -14, left: '50%', transform: 'translateX(-50%)', fontSize: 9, fontWeight: 700, color: premium > 0 ? '#F87171' : '#34D399', whiteSpace: 'nowrap' }}>실거래가</div>
              </div>
              {/* 분양 평균 마커 */}
              <div style={{ position: 'absolute', top: 4, left: `${pct(supplyAvg)}%`, width: 2, height: 28, background: 'var(--brand)', transform: 'translateX(-50%)' }} />
              {/* 실거래 평균 마커 */}
              <div style={{ position: 'absolute', top: 40, left: `${pct(tradeAvg)}%`, width: 2, height: 28, background: premium > 0 ? '#F87171' : '#34D399', transform: 'translateX(-50%)' }} />
            </div>
            {/* 수치 비교 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 6 }}>
              <div style={{ background: 'rgba(59,123,246,0.05)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--brand)', fontWeight: 600, marginBottom: 2 }}>분양가 평균</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>{fmtAmount(supplyAvg)}</div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{fmtAmount(site.price_min)} ~ {fmtAmount(site.price_max)}</div>
              </div>
              <div style={{ background: premium > 0 ? 'rgba(248,113,113,0.05)' : 'rgba(52,211,153,0.05)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: premium > 0 ? '#F87171' : '#34D399', fontWeight: 600, marginBottom: 2 }}>실거래 평균 ({amounts.length}건)</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: premium > 0 ? '#F87171' : '#34D399' }}>{fmtAmount(tradeAvg)}</div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{fmtAmount(tradeMin)} ~ {fmtAmount(tradeMax)}</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 📄 모집공고 핵심 요약 — 통합 카드 */}
      {sub && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ ...ct, margin: 0 }}>📄 모집공고 핵심 요약</h2>
          </div>

          {/* AI 분석 — 상단 히어로에 이미 표시되므로 중복 제거 */}

          {/* 핵심 지표 시각 분석 — 기존 데이터 최대 활용 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 6, marginBottom: 12 }}>
            {/* 공급 규모 등급 */}
            {(() => {
              const units = sub.tot_supply_hshld_co || site?.total_units || 0;
              const grade = units >= 3000 ? { label: '메가단지', emoji: '🏙️', color: '#FF6B6B', desc: '3,000세대+' } : units >= 1000 ? { label: '대단지', emoji: '🏢', color: '#60A5FA', desc: '1,000세대+' } : units >= 300 ? { label: '중단지', emoji: '🏗️', color: '#34D399', desc: '300세대+' } : units > 0 ? { label: '소단지', emoji: '🏠', color: '#FBBF24', desc: '300세대 미만' } : null;
              if (!grade) return null;
              return (
                <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 24 }}>{grade.emoji}</div>
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
                <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3 }}>🏡 입주까지</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: months <= 6 ? '#34D399' : months <= 24 ? 'var(--brand)' : 'var(--text-primary)' }}>{timeStr}</div>
                  <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', marginTop: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: months <= 6 ? '#34D399' : months <= 24 ? 'var(--brand)' : 'var(--accent-purple)' }} />
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 시행사 유형 + 공급 주소 */}
          {(() => {
            const dev = sub.developer_nm || site?.developer || '';
            const isJohap = dev.includes('조합') || dev.includes('정비');
            const isPublic = dev.includes('공사') || dev.includes('LH') || dev.includes('SH');
            const devType = isJohap ? { label: '재개발/재건축 조합', icon: '🔄', color: '#FB923C' } : isPublic ? { label: '공공 시행', icon: '🏛️', color: '#34D399' } : dev ? { label: '민간 시행', icon: '🏢', color: 'var(--brand)' } : null;
            if (!devType) return null;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-hover)', fontSize: 11 }}>
                <span>{devType.icon}</span>
                <span style={{ color: devType.color, fontWeight: 700 }}>{devType.label}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                <span style={{ color: 'var(--text-tertiary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dev}</span>
              </div>
            );
          })()}

          {/* 분양 조건 체크리스트 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: 6, marginBottom: 12 }}>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: sub.is_price_limit ? 'rgba(139,92,246,0.08)' : 'var(--bg-hover)', textAlign: 'center', border: `1px solid ${sub.is_price_limit ? 'rgba(139,92,246,0.2)' : 'var(--border)'}` }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>{sub.is_price_limit ? '✓' : '✗'}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: sub.is_price_limit ? '#8B5CF6' : 'var(--text-tertiary)' }}>분양가상한제</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: sub.transfer_limit ? 'rgba(251,191,36,0.08)' : 'var(--bg-hover)', textAlign: 'center', border: `1px solid ${sub.transfer_limit ? 'rgba(251,191,36,0.2)' : 'var(--border)'}` }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>{sub.transfer_limit ? '✓' : '✗'}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: sub.transfer_limit ? '#FBBF24' : 'var(--text-tertiary)' }}>전매제한</div>
              {sub.transfer_limit && <div style={{ fontSize: 9, color: '#FBBF24', marginTop: 1 }}>{sub.transfer_limit}</div>}
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: sub.residence_obligation ? 'rgba(248,113,113,0.08)' : 'var(--bg-hover)', textAlign: 'center', border: `1px solid ${sub.residence_obligation ? 'rgba(248,113,113,0.2)' : 'var(--border)'}` }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>{sub.residence_obligation ? '✓' : '✗'}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: sub.residence_obligation ? '#F87171' : 'var(--text-tertiary)' }}>거주의무</div>
              {sub.residence_obligation && <div style={{ fontSize: 9, color: '#F87171', marginTop: 1 }}>{sub.residence_obligation}</div>}
            </div>
          </div>

          {/* 단지 개요 행 */}
          {(() => {
            const rows = [
              ['시공사', sub.constructor_nm || site?.builder],
              ['시행사', sub.developer_nm || site?.developer],
              ['총 공급', sub.tot_supply_hshld_co ? `${Number(sub.tot_supply_hshld_co).toLocaleString()}세대` : null],
              ['동수', sub.total_dong_co ? `${sub.total_dong_co}개 동` : null],
              ['최고 층수', sub.max_floor ? `지상 ${sub.max_floor}층` : null],
              ['주차', sub.parking_co ? `${Number(sub.parking_co).toLocaleString()}대` : null],
              ['난방', sub.heating_type],
            ].filter(r => r[1]);
            if (!rows.length) return null;
            return (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                {rows.map(([l, v], i) => (
                  <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>{l}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* 견본주택 */}
          {sub.model_house_addr && (
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: 'var(--bg-hover)', fontSize: 12, color: 'var(--text-secondary)', wordBreak: 'keep-all' }}>
              🏠 견본주택: {sub.model_house_addr}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>📐 평형별 공급 · 분양가</span>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>총 {sub.tot_supply_hshld_co}세대 (일반{totalGen} · 특별{totalSpe})</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid var(--border)' }}>
                        <th style={{ padding: '5px 6px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>타입</th>
                        <th style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>전용(㎡)</th>
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
                        const supply = Number(t.supply || 0);
                        const spsply = Number(t.spsply_hshldco || 0);
                        const total = supply + spsply;
                        const price = Number(t.lttot_top_amount || 0);
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '6px', fontWeight: 700, color: 'var(--text-primary)' }}>{typeLabel || '-'}</td>
                            <td style={{ padding: '6px', textAlign: 'right', color: 'var(--text-secondary)' }}>{exclusiveArea > 0 ? exclusiveArea.toFixed(1) : '-'}</td>
                            <td style={{ padding: '6px', textAlign: 'right', color: 'var(--brand)', fontWeight: 600 }}>{supply}</td>
                            <td style={{ padding: '6px', textAlign: 'right', color: 'var(--accent-purple)' }}>{spsply}</td>
                            <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{total}</td>
                            {hasPrice && <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: 'var(--accent-blue)' }}>{price >= 10000 ? `${(price / 10000).toFixed(1)}억` : `${price.toLocaleString()}만`}</td>}
                          </tr>
                        );
                      })}
                      <tr style={{ borderTop: '1.5px solid var(--brand)', background: 'var(--bg-hover)' }}>
                        <td style={{ padding: '6px', fontWeight: 800, color: 'var(--text-primary)' }}>합계</td>
                        <td></td>
                        <td style={{ padding: '6px', textAlign: 'right', fontWeight: 800, color: 'var(--brand)' }}>{totalGen}</td>
                        <td style={{ padding: '6px', textAlign: 'right', fontWeight: 800, color: 'var(--accent-purple)' }}>{totalSpe}</td>
                        <td style={{ padding: '6px', textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)' }}>{totalGen + totalSpe}</td>
                        {hasPrice && <td></td>}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 6 }}>출처: 청약홈 모집공고 · 최고 분양가 기준 (만원)</div>
              </div>
            );
          })()}


          {/* 같은 시공사 다른 현장 (내부 링크) */}
          {sameBuilderSites.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>🏗️ {(sub.constructor_nm || site?.builder || '').split('(')[0].split('주식')[0].trim()} 다른 현장</div>
              <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
                {sameBuilderSites.slice(0, 4).map((sb2: any) => (
                  <Link key={sb2.id} href={`/apt/${sb2.id}`} style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 6, background: 'var(--bg-hover)', border: '1px solid var(--border)', textDecoration: 'none', fontSize: 10, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sb2.house_nm}</div>
                    <div style={{ color: 'var(--text-tertiary)', marginTop: 1 }}>{sb2.region_nm} · {sb2.tot_supply_hshld_co}세대</div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 하단 CTA: 공유 + 청약홈 */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <SectionShareButton section="announcement" label={`${name} 모집공고 요약`} text={`${name} 입주자모집공고 핵심 요약 — ${sub.constructor_nm || site?.builder || ''} 시공, ${sub.tot_supply_hshld_co || site?.total_units || ''}세대`} pagePath={`/apt/${slug}`} />
            {sub.pblanc_url && <a href={sub.pblanc_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 10, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#34D399', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>🏠 청약홈 원문</a>}
          </div>
        </div>
      )}

      {/* Competition rate */}
      {sub?.competition_rate_1st && Number(sub.competition_rate_1st) > 0 && (
        <div className="apt-card" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <h2 style={ct}>🏆 청약 경쟁률</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            {/* 원형 게이지 */}
            <div style={{ position: 'relative', width: 70, height: 70, flexShrink: 0 }}>
              <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(99,102,241,0.15)" strokeWidth="3" />
                <circle cx="18" cy="18" r="16" fill="none" stroke="#8B5CF6" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${Math.min(Number(sub.competition_rate_1st) * 2, 100)} 100`} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-purple)', lineHeight: 1 }}>{Number(sub.competition_rate_1st).toFixed(1)}</span>
                <span style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>: 1</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>1순위 평균 경쟁률</div>
              <div style={{ fontSize: 12, color: Number(sub.competition_rate_1st) >= 30 ? 'var(--accent-red)' : Number(sub.competition_rate_1st) >= 10 ? 'var(--accent-orange)' : 'var(--accent-green)', fontWeight: 600 }}>
                {Number(sub.competition_rate_1st) >= 30 ? '🔥 초고경쟁' : Number(sub.competition_rate_1st) >= 10 ? '⚡ 높은 경쟁' : Number(sub.competition_rate_1st) >= 3 ? '📊 보통 경쟁' : '✅ 낮은 경쟁'}
              </div>
            </div>
          </div>
          {sub.total_apply_count && sub.supply_count && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 8 }}>총 지원 {Number(sub.total_apply_count).toLocaleString()}명 / 공급 {Number(sub.supply_count).toLocaleString()}세대</div>}
          {sub.house_type_info && Array.isArray(sub.house_type_info) && sub.house_type_info.length > 0 && (
            <div style={{ marginTop: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch' as const }}>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>평형별 경쟁률</div>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10, marginBottom: 8 }}>
            <div><div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>미분양</div><div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--accent-red)' }}>{(unsold.tot_unsold_hshld_co || 0).toLocaleString()}호</div></div>
            <div><div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>총 세대수</div><div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>{unsold.tot_supply_hshld_co ? unsold.tot_supply_hshld_co.toLocaleString() : '-'}</div></div>
          </div>
          {unsoldRate !== null && <div style={{ position: 'relative', height: 6, background: 'var(--bg-hover)', borderRadius: 3, marginBottom: 6 }}><div style={{ height: '100%', borderRadius: 3, width: `${Math.min(unsoldRate, 100)}%`, background: unsoldRate > 70 ? 'var(--accent-red)' : unsoldRate > 40 ? 'var(--accent-orange)' : 'var(--accent-yellow)' }} /><span style={{ position: 'absolute', right: 0, top: -16, fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--accent-red)' }}>미분양률 {unsoldRate}%</span></div>}
          {unsold.after_completion_unsold > 0 && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent-red)', fontWeight: 600 }}>준공후(악성) 미분양 {unsold.after_completion_unsold}호</div>}
        </div>
      )}

      {/* Redev section */}
      {redev && redevStage && (() => { const ci = STAGES.indexOf(redevStage) >= 0 ? STAGES.indexOf(redevStage) : STAGES.findIndex(s => redevStage.includes(s.slice(0, 2))); const pct = ci >= 0 ? Math.round(((ci + 1) / STAGES.length) * 100) : 0; return (
        <div className="apt-card"><h2 style={ct}>🏗️ 재개발 진행 현황</h2>
          <div className="apt-stages">{STAGES.map((s, i) => <div key={s} style={{ background: i <= ci ? (i === ci ? '#B794FF' : 'rgba(183,148,255,0.2)') : 'var(--bg-hover)', color: i === ci ? 'var(--bg-base)' : i < ci ? '#B794FF' : 'var(--text-tertiary)' }}>{s.replace('사업시행인가', '시행인가').replace('정비구역지정', '구역지정')}</div>)}</div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}><div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: '#B794FF' }} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}><span>구역지정</span><span style={{ color: '#B794FF', fontWeight: 700 }}>{redevStage} ({pct}%)</span><span>준공</span></div>
          {redev.ai_summary && <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(135deg, var(--accent-blue-bg), rgba(52,211,153,0.06))', border: '1px solid rgba(96,165,250,0.15)' }}><div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 3 }}>🤖 AI 분석</div><div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', lineHeight: 1.5 }}>{redev.ai_summary}</div></div>}
          {[redev.constructor && ['🏗️ 시공사', redev.constructor], redev.developer && ['🏢 시행사', redev.developer], redev.total_households && ['👥 세대수', `${redev.total_households.toLocaleString()}세대`]].filter(Boolean).map(([l, v]: [string, string]) => <div key={l} style={{ ...rw, borderBottom: 'none' }}><span style={rl}>{l}</span><span style={rv}>{v}</span></div>)}
        </div>); })()}

      {/* 주변 시설 (nearby_facilities) — 크롤러 가시적 텍스트 */}
      {site?.nearby_facilities && Object.keys(site.nearby_facilities as Record<string, number>).length > 0 && (() => {
        const facilityLabels: Record<string, string> = { mart: '마트', park: '공원', school: '학교', subway: '지하철', hospital: '병원', bank: '은행', pharmacy: '약국', convenience: '편의점', library: '도서관', gym: '체육관' };
        const entries = Object.entries(site.nearby_facilities as Record<string, any>).filter(([k]) => k !== 'updated_at' && k !== 'created_at');
        if (entries.length === 0 || entries.every(([, v]) => Number(v) === 0)) return null;
        return (
        <div className="apt-card">
          <h2 style={ct}>🏪 주변 시설</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {entries.map(([facility, count]) => (
              <div key={facility} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 20, background: 'var(--bg-hover)', border: '1px solid var(--border)', fontSize: 'var(--fs-xs)' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{facilityLabels[facility] || facility}</span>
                <span style={{ color: 'var(--brand)', fontWeight: 700 }}>{count}개</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8, lineHeight: 1.6 }}>
            {name} 주변에는 {entries.map(([f, c]) => `${facilityLabels[f] || f} ${c}개`).join(', ')} 등의 편의시설이 있습니다.
          </p>
        </div>
        );
      })()}

      {/* 실거래 텍스트 요약 (서버 렌더링 — 크롤러용) */}
      {trades.length > 0 && (
        <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 4, marginBottom: 10 }}>
                {[
                  { label: '최근', value: fmtAmount(latest), color: tColor, sub: trend },
                  { label: '평균', value: fmtAmount(avg), color: 'var(--brand)', sub: '' },
                  { label: '최저', value: fmtAmount(mn), color: '#34D399', sub: '' },
                  { label: '최고', value: fmtAmount(mx), color: '#F87171', sub: '' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--bg-hover)', borderRadius: 6, padding: '5px 6px', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: s.color }}>{s.value}{s.sub && <span style={{ marginLeft: 2 }}>{s.sub}</span>}</div>
                    <div style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{s.label}</div>
                  </div>
                ))}
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
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${tradeMax > 0 ? (Number(t.deal_amount) / tradeMax) * 100 : 0}%`, borderRadius: 2, background: t.deal_amount >= 100000 ? 'rgba(248,113,113,0.5)' : t.deal_amount >= 50000 ? 'rgba(251,146,60,0.5)' : 'rgba(52,211,153,0.5)' }} />
                  </div>
                </div>
                <span style={{ fontWeight: 700, flexShrink: 0, color: t.deal_amount >= 100000 ? 'var(--accent-red)' : t.deal_amount >= 50000 ? 'var(--accent-orange)' : 'var(--accent-green)', minWidth: 48, textAlign: 'right' }}>{fmtAmount(t.deal_amount)}</span>
              </div>
            ));
          })()}
          <Link href={`/apt/complex/${encodeURIComponent(name)}`} style={{ display: 'block', textAlign: 'center', marginTop: 10, padding: '8px 0', borderRadius: 8, background: 'var(--brand-bg)', color: 'var(--brand)', fontSize: 'var(--fs-sm)', fontWeight: 600, textDecoration: 'none' }}>전체 실거래 내역 보기 →</Link>
        </div>
      )}

      {/* Location */}
      <div className="apt-card"><h2 style={ct}>📍 위치 정보</h2>
        {((site?.nearby_station || sub?.nearest_station) || (site?.school_district || sub?.nearest_school)) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {(site?.nearby_station || sub?.nearest_station) && (
              <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'rgba(96,165,250,0.1)', color: 'var(--accent-blue)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                🚇 {site?.nearby_station || sub?.nearest_station}
              </span>
            )}
            {(site?.school_district || sub?.nearest_school) && (
              <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'rgba(52,211,153,0.1)', color: 'var(--accent-green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                🏫 {site?.school_district || sub?.nearest_school}
              </span>
            )}
          </div>
        )}
        {(site?.address || sub?.hssply_adres || redev?.address) && <div style={rw}><span style={rl}>주소</span><span style={{ ...rv, fontSize: 'var(--fs-xs)', maxWidth: '70%' }}>{site?.address || sub?.hssply_adres || redev?.address}</span></div>}
        {(site?.nearby_station || sub?.nearest_station) && <div style={rw}><span style={rl}>최근접역</span><span style={{ ...rv, color: 'var(--accent-green)' }}>{site?.nearby_station || sub?.nearest_station}</span></div>}
        {(site?.school_district || sub?.nearest_school) && <div style={{ ...rw, borderBottom: 'none' }}><span style={rl}>학군</span><span style={rv}>{site?.school_district || sub?.nearest_school}</span></div>}
        {redev?.notes && <div style={{ ...rw, borderBottom: 'none' }}><span style={rl}>비고</span><span style={rv}>{redev.notes}</span></div>}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <a href={`https://map.kakao.com/?q=${encodeURIComponent(site?.address || sub?.hssply_adres || redev?.address || name)}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>🗺️ 카카오맵</a>
          <a href={`https://map.naver.com/p/search/${encodeURIComponent(site?.address || sub?.hssply_adres || redev?.address || name)}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>🗺️ 네이버지도</a>
        </div>
      </div>

      {/* 관심단지 등록 CTA */}
      {site?.id && <InterestRegistration siteId={site.id} siteName={name} interestCount={site.interest_count || 0} slug={slug} />}

      {/* 비로그인 가입 유도 CTA */}
      {!aptUser && <SignupCTA />}

      {/* Reviews */}
      <AptReviewSection aptName={name} region={region} />

      {/* Comments */}
      {sub && <div className="apt-card"><AptCommentInline houseKey={sub.house_manage_no || String(sub.id)} houseNm={name} houseType="sub" /></div>}

      {/* Related posts */}
      {relatedPosts.length > 0 && <div className="apt-card"><h2 style={ct}>💬 커뮤니티 게시글</h2>{relatedPosts.map((p: Record<string, any>) => <Link key={p.id} href={`/feed/${p.id}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit', fontSize: 'var(--fs-sm)' }}><span style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span><span style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 8, fontSize: 'var(--fs-xs)' }}>댓글 {p.comments_count || 0}</span></Link>)}</div>}

      {/* Related blogs */}
      {relatedBlogs.length > 0 && <div className="apt-card"><h2 style={ct}>📰 관련 분석 블로그</h2>{relatedBlogs.map((b: Record<string, any>) => <Link key={b.slug} href={`/blog/${b.slug}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit', fontSize: 'var(--fs-sm)' }}><span style={{ color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span><span style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 8, fontSize: 'var(--fs-xs)' }}>👀 {(b.view_count || 0).toLocaleString()}</span></Link>)}</div>}

      {/* Nearby sites (internal linking SEO) */}
      {nearbySites.length > 0 && <div className="apt-card"><h2 style={ct}>🏗️ {region} 다른 현장</h2><div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8 }}>{nearbySites.map((ns: Record<string, any>) => <Link key={ns.slug} href={`/apt/${ns.slug}`} className="kd-card" style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: 10, textDecoration: 'none', color: 'inherit', overflow: 'hidden' }}><div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{ns.name}</div><div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ns.sigungu || ns.region} · {ns.total_units ? `${ns.total_units}세대` : ''} · {tLabel[ns.site_type]}</div></Link>)}</div></div>}

      {/* FAQ */}
      {faq.length > 0 && <div className="apt-card"><h2 style={ct}>❓ 자주 묻는 질문</h2>{faq.map((f, i) => <details key={i} style={{ borderBottom: i < faq.length - 1 ? '1px solid var(--border)' : 'none', padding: '10px 0' }}><summary style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between' }}><span>{f.q}</span><span style={{ color: 'var(--text-tertiary)' }}>+</span></summary><p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '6px 0 0' }}>{f.a}</p></details>)}</div>}

      {/* 업데이트 시간 + 태그 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 12, fontSize: 11, color: 'var(--text-tertiary)', flexWrap: 'wrap', gap: 6 }}>
        <time dateTime={site?.updated_at || sub?.fetched_at || new Date().toISOString()}>
          최종 업데이트: {new Date(site?.updated_at || sub?.fetched_at || Date.now()).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
        </time>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[region, site?.sigungu, tLabel[sType], site?.builder || sub?.constructor_nm, '아파트'].filter(Boolean).slice(0, 4).map(tag => (
            <Link key={tag} href={`/search?q=${encodeURIComponent(String(tag))}`} style={{ padding: '2px 8px', borderRadius: 12, background: 'var(--bg-hover)', color: 'var(--text-tertiary)', fontSize: 10, textDecoration: 'none' }}>#{tag}</Link>
          ))}
        </div>
      </div>

      {/* 프리미엄 업셀 */}
      <div className="kd-card-glow" style={{ padding: '16px 14px', margin: '12px 0', background: 'var(--bg-surface)', borderRadius: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🔔</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>청약 마감 알림 받아보세요</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>프리미엄 멤버십 · D-3, D-1 자동 알림</div>
          </div>
          <Link href="/premium" style={{ padding: '7px 14px', borderRadius: 8, background: 'var(--brand)', color: '#fff', fontSize: 11, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
            자세히
          </Link>
        </div>
      </div>

      <Disclaimer />
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textAlign: 'center', margin: '8px 0 40px', lineHeight: 1.6 }}>📊 데이터 출처: 국토교통부 · 청약홈 · 한국부동산원 · 각 지자체</p>
    </article>
  );
}
