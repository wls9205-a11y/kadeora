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
import AptBookmarkButton from '@/components/AptBookmarkButton';
import Disclaimer from '@/components/Disclaimer';
import { sanitizeSearchQuery } from '@/lib/sanitize';

const AptPriceTrendChart = dynamic(() => import('@/components/charts/AptPriceTrendChart'));
const AptReviewSection = dynamic(() => import('@/components/AptReviewSection'));
const InterestRegistration = dynamic(() => import('@/components/InterestRegistration'));

export const revalidate = 3600;
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
  // Phase 1: apt_sites (필수 — sourceIds 의존)
  const { data: site } = await sb.from('apt_sites')
    .select('id,slug,name,site_type,region,sigungu,dong,address,description,seo_title,seo_description,builder,developer,total_units,built_year,move_in_date,status,is_active,content_score,interest_count,page_views,images,key_features,faq_items,nearby_facilities,nearby_station,school_district,price_min,price_max,price_comparison,search_trend,latitude,longitude,source_ids,created_at,updated_at')
    .eq('slug', slug).maybeSingle();
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

  let sub = subResult.status === 'fulfilled' ? (subResult.value as any)?.data : null;
  const unsold = unsoldResult.status === 'fulfilled' ? (unsoldResult.value as any)?.data : null;
  const redev = redevResult.status === 'fulfilled' ? (redevResult.value as any)?.data : null;

  // sub 폴백: 이름 기반 검색
  if (!sub) {
    const nameGuess = site?.name || slug.replace(/-/g, ' ');
    const { data } = await sb.from('apt_subscriptions').select('*').ilike('house_nm', nameGuess).order('id', { ascending: false }).limit(1).maybeSingle();
    sub = data;
  }

  if (!site && !sub && !unsold && !redev) return null;

  const name = sub?.house_nm || site?.name || unsold?.house_nm || redev?.district_name || slug.replace(/-/g, ' ');
  const region = sub?.region_nm || site?.region || unsold?.region_nm || redev?.region || '';

  // Phase 3: 관련 데이터 전부 병렬 (trades + blogs + posts + nearby + view increment)
  const termBlog = sanitizeSearchQuery(name.length > 4 ? name.slice(0, 4) : name, 20);
  const termPost = sanitizeSearchQuery(name.length > 3 ? name.slice(0, 3) : name, 20);
  const rShort = sanitizeSearchQuery(region.slice(0, 2), 10);

  const [tradesR, blogsR, postsR, nearbyR] = await Promise.allSettled([
    sb.from('apt_transactions').select('id, apt_name, deal_date, deal_amount, exclusive_area, floor, built_year').eq('apt_name', name).order('deal_date', { ascending: false }).limit(30),
    termBlog ? sb.from('blog_posts').select('slug, title, view_count, published_at').eq('is_published', true).or(`title.ilike.%${termBlog}%,title.ilike.%${rShort} 청약%,title.ilike.%${rShort} 부동산%`).order('view_count', { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    termPost ? sb.from('posts').select('id, title, created_at, comments_count').eq('is_deleted', false).ilike('title', `%${termPost}%`).order('created_at', { ascending: false }).limit(3) : Promise.resolve({ data: [] }),
    region ? sb.from('apt_sites').select('slug, name, site_type, region, sigungu, total_units, status').eq('is_active', true).eq('region', region).neq('slug', slug).gte('content_score', 25).order('interest_count', { ascending: false }).limit(4) : Promise.resolve({ data: [] }),
  ]);

  const trades = tradesR.status === 'fulfilled' ? (tradesR.value as any)?.data || [] : [];
  const relatedBlogs = blogsR.status === 'fulfilled' ? (blogsR.value as any)?.data || [] : [];
  const relatedPosts = postsR.status === 'fulfilled' ? (postsR.value as any)?.data || [] : [];
  const nearbySites = nearbyR.status === 'fulfilled' ? (nearbyR.value as any)?.data || [] : [];

  // Fire-and-forget: 조회수 증가
  if (site?.id) { void sb.rpc('increment_site_view', { p_site_id: site.id }); }

  return { site, sub, unsold, redev, trades, relatedBlogs, relatedPosts, nearbySites, name, region, slug };
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
    const desc = d.site?.seo_description || `${d.region} ${d.site?.sigungu || ''} ${d.name} ${uStr} ${builder}. 청약일정, 실거래가, 주민리뷰까지 한눈에.`.trim();
    const ogImg = `${SITE_URL}/api/og?title=${encodeURIComponent(d.name)}&subtitle=${encodeURIComponent(`${d.region} ${d.site?.sigungu || ''} · ${uStr} ${builder}`.trim())}`;

    return {
      title, description: desc,
      alternates: { canonical: `${SITE_URL}/apt/${resolved.slug}` },
      robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const, 'max-video-preview': -1, googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const } },
      openGraph: { title, description: desc, url: `${SITE_URL}/apt/${resolved.slug}`, siteName: '카더라', locale: 'ko_KR', type: 'article', images: [{ url: ogImg, width: 1200, height: 630, alt: `${d.name} 분양정보` }] },
      twitter: { card: 'summary_large_image', title, description: desc, site: '@kadeora_app', images: [ogImg] },
      other: {
        'article:published_time': d.site?.created_at || d.sub?.fetched_at || '',
        'article:modified_time': d.site?.updated_at || new Date().toISOString(),
        'article:section': '부동산',
        'article:tag': `${d.name},${d.region},${tl[st] || '분양'},청약,분양가,아파트`,
        // Kakao/Facebook price display
        ...(d.site?.price_min ? { 'og:price:amount': String(d.site.price_min), 'og:price:currency': 'KRW' } : {}),
        // Naver specific
        'naver:written_time': d.site?.created_at || d.sub?.fetched_at || '',
        'naver:updated_time': d.site?.updated_at || new Date().toISOString(),
        // Daum
        'dg:plink': `${SITE_URL}/apt/${resolved.slug}`,
        // GEO (지역 검색 노출)
        ...((() => {
          const GEO: Record<string, string> = { '서울': 'KR-11', '부산': 'KR-26', '대구': 'KR-27', '인천': 'KR-28', '광주': 'KR-29', '대전': 'KR-30', '울산': 'KR-31', '세종': 'KR-36', '경기': 'KR-41', '강원': 'KR-42', '충북': 'KR-43', '충남': 'KR-44', '전북': 'KR-45', '전남': 'KR-46', '경북': 'KR-47', '경남': 'KR-48', '제주': 'KR-50' };
          const g = Object.entries(GEO).find(([k]) => d.region?.includes(k));
          if (g) return { 'geo.region': g[1], 'geo.placename': d.region + ' ' + (d.site?.sigungu || '') } as Record<string, string>;
          return {} as Record<string, string>;
        })()),
      },
    };
  } catch { return {}; }
}

function fmtAmount(n: number | null) { if (!n) return '-'; return n >= 10000 ? `${(n / 10000).toFixed(1)}억` : `${n.toLocaleString()}만`; }
function fmtYM(s: string | null) { if (!s) return null; return `${s.slice(0, 4)}년 ${parseInt(s.slice(4, 6))}월`; }

const ct: React.CSSProperties = { fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5, margin: '0 0 8px' };
const rw: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-sm)' };
const rl: React.CSSProperties = { color: 'var(--text-tertiary)' };
const rv: React.CSSProperties = { color: 'var(--text-primary)', fontWeight: 600 };
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
  const { site, sub, unsold, redev, trades, relatedBlogs, relatedPosts, nearbySites, name, region, slug } = d;
  const sType = site?.site_type || (sub ? 'subscription' : unsold ? 'unsold' : redev ? 'redevelopment' : trades.length > 0 ? 'trade' : 'subscription');
  const features = Array.isArray(site?.key_features) ? site.key_features : [];
  const faq = Array.isArray(site?.faq_items) ? site.faq_items as { q: string; a: string }[] : [];
  const redevStage = (site?.source_ids as any)?.redev_stage || redev?.stage;
  const noindex = site ? (site.content_score ?? 0) < 40 : false;

  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const subSt = sub ? (!sub.rcept_bgnde ? 'upcoming' : today >= sub.rcept_bgnde && today <= sub.rcept_endde ? 'open' : today < sub.rcept_bgnde ? 'upcoming' : 'closed') : null;
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

      {/* JSON-LD 4: Event */}
      {sub?.rcept_bgnde && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Event', name: `${name} 청약 접수`, startDate: sub.rcept_bgnde, endDate: sub.rcept_endde, eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode', location: { '@type': 'VirtualLocation', url: `${SITE_URL}/apt/${slug}` }, organizer: { '@type': 'Organization', name: site?.builder || sub.constructor_nm || '청약홈', url: sub.pblanc_url || SITE_URL }, image: `${SITE_URL}/api/og?title=${encodeURIComponent(name)}&subtitle=${encodeURIComponent('청약 접수')}` }) }} />}

      {/* JSON-LD 5: Article + SpeakableSpecification (voice search, Google Discover) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: `${name} ${tLabel[sType] || '분양'} 정보`, description: site?.description || `${region} ${name}`, url: `${SITE_URL}/apt/${slug}`, datePublished: site?.created_at || sub?.fetched_at || new Date().toISOString(), dateModified: site?.updated_at || new Date().toISOString(), author: { '@type': 'Organization', name: '카더라', url: SITE_URL }, publisher: { '@type': 'Organization', name: '카더라', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icons/icon-192.png` } }, image: `${SITE_URL}/api/og?title=${encodeURIComponent(name)}&subtitle=${encodeURIComponent(region)}`, mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/apt/${slug}` }, speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.site-description'] } }) }} />

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

      <Link href="/apt" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}>← 부동산</Link>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 'var(--fs-xs)', fontWeight: 700, background: tBg[sType], color: tClr[sType], border: `1px solid ${tClr[sType]}33` }}>{tLabel[sType]}</span>
          {subSt && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: SB[subSt].bg, color: SB[subSt].color, border: `1px solid ${SB[subSt].border}` }}>{SB[subSt].label}</span>}
          {redevStage && <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 'var(--fs-xs)', fontWeight: 700, background: 'rgba(255,212,59,0.15)', color: '#FFD43B' }}>{redevStage}</span>}
          {sub?.competition_rate_1st && Number(sub.competition_rate_1st) > 0 && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--accent-purple)', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: 10 }}>{Number(sub.competition_rate_1st).toFixed(1)}:1</span>}
        </div>
        <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: '6px 0 2px', lineHeight: 1.3 }}>{name}</h1>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', margin: '0 0 8px' }}>{[region, site?.sigungu, site?.dong].filter(Boolean).join(' ') || sub?.hssply_adres || ''}{(site?.builder || sub?.constructor_nm) ? ` · ${site?.builder || sub?.constructor_nm} 시공` : ''}</p>
        {(sub?.ai_summary || site?.description) && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(135deg, var(--brand-bg), rgba(139,92,246,0.06))', border: '1px solid var(--brand-border)' }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--brand)', marginBottom: 3 }}>🤖 AI 분석</div>
            <div className="site-description" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', lineHeight: 1.6 }}>{sub?.ai_summary || site?.description}</div>
          </div>
        )}
      </div>

      {/* Naver SEO: Crawlable Korean description paragraph */}
      <p style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }} aria-hidden="true">
        {`${region} ${site?.sigungu || ''} ${name} 아파트 분양 정보. ${site?.builder || sub?.constructor_nm || ''} 시공, 총 ${site?.total_units || sub?.tot_supply_hshld_co || ''}세대 규모. ${sub?.rcept_bgnde ? `청약 접수일 ${sub.rcept_bgnde}` : ''} ${sub?.mvn_prearnge_ym ? `입주예정 ${fmtYM(sub.mvn_prearnge_ym)}` : ''}. 분양가, 경쟁률, 실거래가, 주변 인프라 정보를 카더라에서 확인하세요.`}
      </p>

      {/* Share + Bookmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <ShareButtons title={`${name} ${tLabel[sType]}`} postId={slug} />
        {sub?.pblanc_url && <a href={sub.pblanc_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, background: 'rgba(96,165,250,0.1)', color: 'var(--accent-blue)', fontSize: 'var(--fs-sm)', fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(96,165,250,0.2)' }}>🏠 청약홈</a>}
        {sub && <AptBookmarkButton aptId={sub.id} isLoggedIn={!!aptUser} />}
      </div>

      {/* Key metrics */}
      <div className="apt-metrics-grid">
        {[
          { l: '세대수', v: (site?.total_units || sub?.tot_supply_hshld_co) ? `${Number(site?.total_units || sub?.tot_supply_hshld_co).toLocaleString()}` : '-', c: 'var(--text-primary)' },
          { l: sub ? '분양가' : '시세', v: (site?.price_min || site?.price_max) ? `${fmtAmount(site?.price_min)}~${fmtAmount(site?.price_max)}` : unsold?.sale_price_min ? `${fmtAmount(unsold.sale_price_min)}~` : '-', c: 'var(--brand)' },
          { l: '입주예정', v: (site?.move_in_date || sub?.mvn_prearnge_ym) ? (site?.move_in_date || sub?.mvn_prearnge_ym || '').slice(0, 7).replace('-', '.') : '-', c: 'var(--accent-green)' },
          { l: unsold ? '미분양' : '관심', v: unsold ? `${(unsold.tot_unsold_hshld_co || 0).toLocaleString()}호` : `${site?.interest_count || 0}명`, c: unsold ? 'var(--accent-red)' : '#FFD43B' },
        ].map(s => (
          <div key={s.l}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>{s.l}</div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Features */}
      {features.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>{features.map((f, i: number) => <span key={i} style={{ padding: '4px 10px', borderRadius: 16, fontSize: 'var(--fs-xs)', fontWeight: 600, background: 'rgba(59,123,246,0.1)', color: '#6CB4FF', border: '1px solid rgba(59,123,246,0.15)' }}>{String(f)}</span>)}</div>}

      {/* Schedule */}
      {sub && (() => { const rows = [['분양유형', sub.mdatrgbn_nm], ['청약접수', sub.rcept_bgnde && sub.rcept_endde ? `${sub.rcept_bgnde} ~ ${sub.rcept_endde}` : null], ['특별공급', sub.spsply_rcept_bgnde ? `${sub.spsply_rcept_bgnde} ~ ${sub.spsply_rcept_endde}` : null], ['당첨자발표', sub.przwner_presnatn_de], ['계약', sub.cntrct_cncls_bgnde ? `${sub.cntrct_cncls_bgnde} ~ ${sub.cntrct_cncls_endde}` : null], ['입주예정', fmtYM(sub.mvn_prearnge_ym)], ['총공급', sub.tot_supply_hshld_co ? `${Number(sub.tot_supply_hshld_co).toLocaleString()}세대` : null]].filter(r => r[1]); return (<div className="apt-card"><h2 style={ct}>📅 분양 일정</h2>{rows.map(([l, v], i) => <div key={l as string} style={{ ...rw, borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}><span style={rl}>{l}</span><span style={rv}>{v}</span></div>)}</div>); })()}

      {/* Overview */}
      {sub && (() => { const rows = [['시공사', sub.constructor_nm || site?.builder], ['시행사', sub.developer_nm || site?.developer], ['일반분양', sub.tot_supply_hshld_co ? `${Number(sub.tot_supply_hshld_co).toLocaleString()}세대` : null], ['동수', sub.total_dong_co ? `${sub.total_dong_co}개 동` : null], ['최고 층수', sub.max_floor ? `지상 ${sub.max_floor}층` : null], ['주차대수', sub.parking_co ? `${Number(sub.parking_co).toLocaleString()}대` : null], ['난방방식', sub.heating_type]].filter(r => r[1]); if (!rows.length) return null; return (<div className="apt-card"><h2 style={ct}>🏗️ 단지 개요</h2>{rows.map(([l, v], i) => <div key={l as string} style={{ ...rw, borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}><span style={rl}>{l}</span><span style={rv}>{v}</span></div>)}</div>); })()}

      {/* Conditions */}
      {sub && (sub.is_price_limit || sub.transfer_limit || sub.residence_obligation || sub.model_house_addr) && (
        <div className="apt-card"><h2 style={ct}>📋 분양 조건</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {sub.is_price_limit && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: 'var(--accent-purple-bg)', color: 'var(--accent-purple)' }}>✓ 분양가상한제</span>}
            {sub.transfer_limit && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: 'var(--accent-yellow-bg)', color: 'var(--accent-yellow)' }}>전매제한 {sub.transfer_limit}</span>}
            {sub.residence_obligation && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: 'var(--accent-red-bg)', color: 'var(--accent-red)' }}>거주의무 {sub.residence_obligation}</span>}
          </div>
          {sub.model_house_addr && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', padding: '8px 0', borderTop: '1px solid var(--border)' }}>🏠 견본주택: {sub.model_house_addr}</div>}
        </div>
      )}

      {/* Competition rate */}
      {sub?.competition_rate_1st && Number(sub.competition_rate_1st) > 0 && (
        <div className="apt-card" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <h2 style={ct}>🏆 청약 경쟁률</h2>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-purple)', marginBottom: 12 }}>{Number(sub.competition_rate_1st).toFixed(1)} : 1 <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', fontWeight: 400 }}>1순위 평균</span></div>
          {sub.total_apply_count && sub.supply_count && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 8 }}>총 지원 {Number(sub.total_apply_count).toLocaleString()}명 / 공급 {Number(sub.supply_count).toLocaleString()}세대</div>}
          {sub.house_type_info && Array.isArray(sub.house_type_info) && sub.house_type_info.length > 0 && (
            <div style={{ marginTop: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>평형별 경쟁률</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)', minWidth: 300 }}>
                <thead><tr style={{ borderBottom: '2px solid var(--border)' }}><th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-tertiary)' }}>평형</th><th style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-tertiary)' }}>공급</th><th style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-tertiary)' }}>지원</th><th style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-tertiary)' }}>경쟁률</th></tr></thead>
                <tbody>{(sub.house_type_info as any[]).map((t: any, i: number) => <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--text-primary)' }}>{t.type || t.area || '-'}</td><td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{(t.supply || 0).toLocaleString()}</td><td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{(t.apply || 0).toLocaleString()}</td><td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: (t.rate || 0) >= 10 ? 'var(--accent-red)' : 'var(--accent-purple)' }}>{t.rate ? `${t.rate}:1` : '-'}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Unsold section */}
      {unsold && (
        <div className="apt-card" style={{ borderLeft: '4px solid var(--accent-red)', borderRadius: 0 }}>
          <h2 style={ct}>🏚️ 미분양 현황</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
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
          {[redev.constructor && ['🏗️ 시공사', redev.constructor], redev.developer && ['🏢 시행사', redev.developer], redev.total_households && ['👥 세대수', `${redev.total_households.toLocaleString()}세대`]].filter(Boolean).map(([l, v]: any) => <div key={l} style={{ ...rw, borderBottom: 'none' }}><span style={rl}>{l}</span><span style={rv}>{v}</span></div>)}
        </div>); })()}

      {/* Transactions */}
      {trades.length > 0 && (
        <div className="apt-card"><h2 style={ct}>💰 실거래 이력 ({trades.length}건)</h2>
          <AptPriceTrendChart aptName={name} region={region} />
          {trades.slice(0, 10).map((t: any, i: number) => <div key={t.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < Math.min(trades.length, 10) - 1 ? '1px solid var(--border)' : 'none', fontSize: 'var(--fs-sm)' }}><div><span style={{ color: 'var(--text-tertiary)' }}>{t.deal_date}</span><span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>{t.exclusive_area}㎡ · {t.floor}층</span></div><span style={{ fontWeight: 700, color: t.deal_amount >= 100000 ? 'var(--accent-red)' : t.deal_amount >= 50000 ? 'var(--accent-orange)' : 'var(--accent-green)' }}>{fmtAmount(t.deal_amount)}</span></div>)}
          <Link href={`/apt/complex/${encodeURIComponent(name)}`} style={{ display: 'block', textAlign: 'center', marginTop: 10, padding: '8px 0', borderRadius: 8, background: 'var(--brand-bg)', color: 'var(--brand)', fontSize: 'var(--fs-sm)', fontWeight: 600, textDecoration: 'none' }}>전체 실거래 내역 보기 →</Link>
        </div>
      )}

      {/* Location */}
      <div className="apt-card"><h2 style={ct}>📍 위치 정보</h2>
        {(site?.address || sub?.hssply_adres) && <div style={rw}><span style={rl}>주소</span><span style={{ ...rv, fontSize: 'var(--fs-xs)' }}>{site?.address || sub?.hssply_adres}</span></div>}
        {(site?.nearby_station || sub?.nearest_station) && <div style={rw}><span style={rl}>최근접역</span><span style={{ ...rv, color: 'var(--accent-green)' }}>{site?.nearby_station || sub?.nearest_station}</span></div>}
        {(site?.school_district || sub?.nearest_school) && <div style={{ ...rw, borderBottom: 'none' }}><span style={rl}>학군</span><span style={rv}>{site?.school_district || sub?.nearest_school}</span></div>}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <a href={`https://map.kakao.com/?q=${encodeURIComponent(site?.address || sub?.hssply_adres || name)}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>🗺️ 카카오맵</a>
          <a href={`https://map.naver.com/p/search/${encodeURIComponent(site?.address || sub?.hssply_adres || name)}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>🗺️ 네이버지도</a>
        </div>
      </div>

      {/* 관심단지 등록 CTA */}
      {site?.id && <InterestRegistration siteId={site.id} siteName={name} interestCount={site.interest_count || 0} slug={slug} />}

      {/* Reviews */}
      <AptReviewSection aptName={name} region={region} />

      {/* Comments */}
      {sub && <div className="apt-card"><AptCommentInline houseKey={sub.house_manage_no || String(sub.id)} houseNm={name} houseType="sub" /></div>}

      {/* Related posts */}
      {relatedPosts.length > 0 && <div className="apt-card"><h2 style={ct}>💬 커뮤니티 게시글</h2>{relatedPosts.map((p: any) => <Link key={p.id} href={`/feed/${p.id}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit', fontSize: 'var(--fs-sm)' }}><span style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span><span style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 8, fontSize: 'var(--fs-xs)' }}>댓글 {p.comments_count || 0}</span></Link>)}</div>}

      {/* Related blogs */}
      {relatedBlogs.length > 0 && <div className="apt-card"><h2 style={ct}>📰 관련 분석 블로그</h2>{relatedBlogs.map((b: any) => <Link key={b.slug} href={`/blog/${b.slug}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit', fontSize: 'var(--fs-sm)' }}><span style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span><span style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 8, fontSize: 'var(--fs-xs)' }}>👀 {(b.view_count || 0).toLocaleString()}</span></Link>)}</div>}

      {/* Nearby sites (internal linking SEO) */}
      {nearbySites.length > 0 && <div className="apt-card"><h2 style={ct}>🏗️ {region} 다른 현장</h2><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{nearbySites.map((ns: any) => <Link key={ns.slug} href={`/apt/${ns.slug}`} className="kd-card" style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: 10, textDecoration: 'none', color: 'inherit' }}><div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{ns.name}</div><div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{ns.sigungu || ns.region} · {ns.total_units ? `${ns.total_units}세대` : ''} · {tLabel[ns.site_type]}</div></Link>)}</div></div>}

      {/* FAQ */}
      {faq.length > 0 && <div className="apt-card"><h2 style={ct}>❓ 자주 묻는 질문</h2>{faq.map((f, i) => <details key={i} style={{ borderBottom: i < faq.length - 1 ? '1px solid var(--border)' : 'none', padding: '10px 0' }}><summary style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between' }}><span>{f.q}</span><span style={{ color: 'var(--text-tertiary)' }}>+</span></summary><p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '6px 0 0' }}>{f.a}</p></details>)}</div>}

      <Disclaimer />
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textAlign: 'center', margin: '8px 0 40px', lineHeight: 1.6 }}>📊 데이터 출처: 국토교통부 · 청약홈 · 한국부동산원 · 각 지자체</p>
    </article>
  );
}
