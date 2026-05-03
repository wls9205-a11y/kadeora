import LoginGate from '@/components/LoginGate';
import { createSupabaseServer } from '@/lib/supabase-server';
import { SITE_URL } from '@/lib/constants';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import AptImageGallery from '@/components/AptImageGallery';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import type { Metadata } from 'next';
import { fmtAmount } from '@/lib/format';
import { sanitizeSearchQuery } from '@/lib/sanitize';
import dynamic from 'next/dynamic';
import ShareButtons from '@/components/ShareButtons';
import AptNearbyCompare from '@/components/AptNearbyCompare';
import AptBookmarkButton from '@/components/AptBookmarkButton';
import EngageRow from '@/components/EngageRow';

const AptPriceTrendChart = dynamic(() => import('@/components/charts/AptPriceTrendChart'));
const AptReviewSection = dynamic(() => import('@/components/AptReviewSection'));

export const maxDuration = 30;
export const revalidate = 3600;

interface Props { params: Promise<{ name: string }> }

async function getProfile(decoded: string) {
  const sb = await createSupabaseServer();
  const { data } = await (sb as any).from('apt_complex_profiles')
    .select('*')
    .eq('apt_name', decoded)
    .limit(1)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const p = await getProfile(decoded);

  const region = p?.region_nm || '';
  const sigungu = p?.sigungu || '';
  const ageGroup = p?.age_group || '';
  const salePrice = p?.latest_sale_price ? fmtAmount(p.latest_sale_price) : '';
  const jeonsePrice = p?.latest_jeonse_price ? fmtAmount(p.latest_jeonse_price) : '';

  const builtYear = p?.built_year;
  const householdCount = p?.total_households;
  const pricePerPyeong = p?.avg_sale_price_pyeong ? `평당 ${fmtAmount(p.avg_sale_price_pyeong)}` : '';
  const jeonseRatio = p?.jeonse_ratio ? `전세가율 ${Number(p.jeonse_ratio).toFixed(0)}%` : '';
  const yearFragment = builtYear ? `${builtYear}년 준공` : '';
  const metaParts = [salePrice ? `매매 ${salePrice}` : '', pricePerPyeong, jeonseRatio, yearFragment].filter(Boolean).join(' · ');

  // s212 P0-B: template 가 '| 카더라' 자동 추가 — fallback 에서 explicit 표기 제거
  const title = p?.seo_title || `${decoded} 실거래가·시세·전세가율·평당가 ${new Date().getFullYear()} — ${region} ${sigungu}`;
  const description = p?.seo_description || `${decoded} 아파트 ${metaParts ? metaParts + '. ' : ''}실거래가 이력, 전세·월세 시세, 평당가 추이, 면적별 비교, 학군 정보를 카더라에서 무료로 확인하세요.`;
  const ogSubtitle = salePrice ? `매매 ${salePrice}${jeonsePrice ? ` · 전세 ${jeonsePrice}` : ''}` : '실거래가·시세 분석';
  // 실제 현장 이미지 조회 (apt_sites에서)
  let realImg: string | null = null;
  let siteEngage = { views: 0, comments: 0, interest: 0 };
  try {
    const sb = (await import('@/lib/supabase-server')).createSupabaseServer;
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
    const admin = getSupabaseAdmin();
    const { data: siteRow } = await (admin as any).from('apt_sites').select('images, page_views, comment_count, interest_count, slug').eq('name', decoded).not('images', 'is', null).limit(1).maybeSingle();
    if (Array.isArray(siteRow?.images) && (siteRow.images[0] as any)?.url) realImg = ((siteRow.images[0] as any).thumbnail || (siteRow.images[0] as any).url).replace(/^http:\/\//, 'https://');
    if (siteRow) siteEngage = { views: siteRow.page_views || 0, comments: siteRow.comment_count || 0, interest: siteRow.interest_count || 0 };
  } catch {}
  const ogUrl = realImg || `${SITE_URL}/api/og?title=${encodeURIComponent(decoded)}&design=2&category=apt&subtitle=${encodeURIComponent(ogSubtitle)}&author=${encodeURIComponent('카더라')}`;
  const ogSquareUrl = `${SITE_URL}/api/og-square?title=${encodeURIComponent(decoded)}&category=apt&subtitle=${encodeURIComponent(ogSubtitle)}`;
  const keywords = [decoded, '실거래가', '시세', '아파트', region, sigungu, ageGroup, '전세', '월세', '매매', '평당가', '전세가율', '시세조회', '학군', '재건축', '분양가', '입주', '조감도', '평면도'].filter(Boolean);

  // 세션 157 A: apt_complex_profiles.metadata.noindex=true 이면 robots meta 반영
  const isNoindex = p && (p as any).metadata && typeof (p as any).metadata === 'object' && (p as any).metadata.noindex === true;
  const meta: Metadata = {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/apt/complex/${name}` },
    robots: isNoindex
      ? { index: false, follow: true }
      : { index: true, follow: true, 'max-snippet': -1 as const, 'max-image-preview': 'large' as const },
    openGraph: {
      title: `${decoded} 실거래가·시세·평당가 — ${region} ${sigungu}`,
      description: metaParts ? `${metaParts} — ${region} ${sigungu}` : `실거래가·시세 분석 — ${region} ${sigungu}`,
      url: `${SITE_URL}/apt/complex/${name}`,
      siteName: '카더라',
      locale: 'ko_KR',
      type: 'article',
      images: [
        { url: ogUrl, width: 1200, height: 630, alt: `${decoded} 아파트 실거래가 시세` },
        { url: ogSquareUrl, width: 630, height: 630, alt: `${decoded} 실거래가` },
      ],
    },
    twitter: { card: 'summary_large_image', title: `${decoded} 실거래가·시세·전세가율`, description: metaParts || ogSubtitle },
    other: {
      'naver:written_time': p?.created_at || new Date(Date.now() - 86400000 * 7).toISOString(),
      'naver:updated_time': p?.updated_at || new Date().toISOString(),
      'naver:author': '카더라',
      'naver:site_name': '카더라',
      'og:updated_time': p?.updated_at || new Date().toISOString(),
      'article:section': '부동산',
      'article:tag': keywords.join(','),
      'article:published_time': p?.created_at || new Date(Date.now() - 86400000 * 30).toISOString(),
      'article:modified_time': p?.updated_at || new Date().toISOString(),
      'dg:plink': `${SITE_URL}/apt/complex/${name}`,
    },
  };

  // Geo 메타 (좌표 있을 때)
  if (p?.latitude && p?.longitude) {
    (meta.other as any)['geo.position'] = `${p.latitude};${p.longitude}`;
    (meta.other as any)['geo.placename'] = `${decoded} 아파트`;
    (meta.other as any)['geo.region'] = 'KR';
    (meta.other as any)['ICBM'] = `${p.latitude}, ${p.longitude}`;
  }

  return meta;
}

export default async function ComplexDetailPage({ params }: Props) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const sb = await createSupabaseServer();

  // 프로필 조회 (좌표, SEO 데이터 포함)
  const profile = await getProfile(decoded);

  const { data: trades } = await sb.from('apt_transactions')
    .select('id, apt_name, region_nm, sigungu, dong, deal_date, deal_amount, exclusive_area, floor, built_year, trade_type')
    .eq('apt_name', decoded)
    .order('deal_date', { ascending: false })
    .limit(200) as { data: Record<string, any>[] | null };

  if (!trades?.length) notFound();
  const tradeList = trades!;

  const region = tradeList[0].region_nm || '';
  const dong = tradeList[0].dong || '';
  const sigungu = tradeList[0].sigungu || '';

  // 관련 블로그 + 전월세 + 사이트이미지 — 병렬 조회
  const searchTerm = sanitizeSearchQuery(decoded.length > 4 ? decoded.slice(0, 4) : decoded, 20);
  const [blogsR, rentR, siteR, relatedR] = await Promise.allSettled([
    sb.from('blog_posts').select('slug,title,view_count,published_at')
      .eq('is_published', true).or(`title.ilike.%${searchTerm}%,title.ilike.%${region.slice(0,2)} 부동산%`)
      .order('view_count', { ascending: false }).limit(3),
    (sb as any).from('apt_rent_transactions')
      .select('rent_type, deposit, monthly_rent, deal_date, exclusive_area, floor')
      .eq('apt_name', decoded)
      .order('deal_date', { ascending: false })
      .limit(100),
    (sb as any).from('apt_sites').select('slug, images, page_views, comment_count, interest_count')
      .ilike('name', `%${decoded}%`).eq('is_active', true).limit(1).maybeSingle(),
    // 같은 지역 관련 단지 (내부 링크 강화)
    (sb as any).from('apt_complex_profiles')
      .select('apt_name, latest_sale_price, built_year, total_households')
      .eq('sigungu', sigungu)
      .neq('apt_name', decoded)
      .not('latest_sale_price', 'is', null)
      .order('sale_count_1y', { ascending: false })
      .limit(8),
  ]);

  const relatedBlogs: Record<string, any>[] = blogsR.status === 'fulfilled' ? (blogsR.value?.data || []) : [];
  const rentTrades: Record<string, any>[] = rentR.status === 'fulfilled' ? (rentR.value?.data || []) : [];
  let siteImages: {url: string; caption?: string}[] = [];
  let siteSlug: string | null = null;
  if (siteR.status === 'fulfilled' && siteR.value?.data) {
    const site = siteR.value.data;
    if (site?.images && Array.isArray(site.images)) {
      siteImages = site.images.filter((img: any) => typeof img === 'string' || img?.url).map((img: any) => ({
        url: typeof img === 'string' ? img : img.url,
        caption: typeof img === 'string' ? undefined : img?.caption,
      })).slice(0, 7);
    }
    if (site?.slug) siteSlug = site.slug;
  }
  const siteEngage = siteR.status === 'fulfilled' && siteR.value?.data ? { views: siteR.value.data.page_views || 0, comments: siteR.value.data.comment_count || 0, interest: siteR.value.data.interest_count || 0 } : { views: 0, comments: 0, interest: 0 };
  const relatedComplexes: Record<string,any>[] = relatedR.status === 'fulfilled' ? (relatedR.value?.data || []) : [];

  // 통계 계산
  const amounts = tradeList.filter(t => t.deal_amount > 0).map(t => t.deal_amount);
  const avgPrice = amounts.length ? Math.round(amounts.reduce((s, a) => s + a, 0) / amounts.length) : 0;
  const maxPrice = amounts.length ? Math.max(...amounts) : 0;
  const minPrice = amounts.length ? Math.min(...amounts) : 0;
  const latestPrice = tradeList.length > 0 ? (tradeList[0]?.deal_amount || 0) : 0;

  // 전월세 요약
  const latestJeonse = rentTrades.find(r => r.rent_type === 'jeonse');
  const latestMonthly = rentTrades.find(r => r.rent_type === 'monthly');
  const jeonseRatio = latestJeonse && latestPrice > 0 ? Math.round((latestJeonse.deposit / latestPrice) * 100) : null;

  // 면적별 그룹핑
  const areaMap = new Map<string, { count: number; avg: number; tradeList: Record<string, any>[] }>();
  tradeList.forEach(t => {
    const area = `${Math.round(t.exclusive_area)}㎡`;
    const cur = areaMap.get(area) || { count: 0, avg: 0, tradeList: [] };
    cur.count++;
    cur.tradeList.push(t);
    areaMap.set(area, cur);
  });
  areaMap.forEach((v) => {
    const amts = v.tradeList.filter((t: Record<string, any>) => t.deal_amount > 0).map((t: Record<string, any>) => t.deal_amount);
    v.avg = amts.length ? Math.round(amts.reduce((s: number, a: number) => s + a, 0) / amts.length) : 0;
  });
  const areaStats = Array.from(areaMap.entries())
    .map(([area, data]) => ({ area, ...data }))
    .sort((a, b) => b.count - a.count);

  // 연도별 평균가 추이
  const yearMap = new Map<string, { sum: number; cnt: number }>();
  tradeList.forEach(t => {
    if (!t.deal_date || !t.deal_amount) return;
    const ym = t.deal_date.slice(0, 7);
    const cur = yearMap.get(ym) || { sum: 0, cnt: 0 };
    cur.sum += t.deal_amount;
    cur.cnt++;
    yearMap.set(ym, cur);
  });
  const monthlyTrend = [...yearMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([ym, d]) => ({ ym, avg: Math.round(d.sum / d.cnt), cnt: d.cnt }));

  const builtYear = tradeList[0]?.built_year || profile?.built_year || 0;
  const hasCoords = profile?.latitude && profile?.longitude;

  // [COMPLEX-CARD] big_event_registry 역연결 조회 — apt_complex_profile_id 또는 이름 매칭
  let bigEvent: Record<string, any> | null = null;
  let pillarSlug: string | null = null;
  try {
    if (profile?.id) {
      const { data: be } = await (sb as any).from('big_event_registry')
        .select('id, slug, name, stage, scale_before, scale_after, key_constructors, new_brand_name, constructor_status, event_type, pillar_blog_post_id, is_active')
        .eq('apt_complex_profile_id', profile.id)
        .eq('is_active', true)
        .maybeSingle();
      if (be) bigEvent = be;
    }
    if (!bigEvent) {
      const { data: be } = await (sb as any).from('big_event_registry')
        .select('id, slug, name, stage, scale_before, scale_after, key_constructors, new_brand_name, constructor_status, event_type, pillar_blog_post_id, is_active')
        .eq('name', decoded).eq('is_active', true).maybeSingle();
      if (be) bigEvent = be;
    }
    if (bigEvent?.pillar_blog_post_id) {
      const { data: pillar } = await sb.from('blog_posts').select('slug').eq('id', bigEvent.pillar_blog_post_id).maybeSingle();
      pillarSlug = pillar?.slug || null;
    }
  } catch {}

  // 재건축 후보 배지 (big_event 없지만 1990 이전 + 500세대+)
  const isRedevCandidate = !bigEvent && builtYear > 0 && builtYear < 1990 && (profile?.total_households ?? 0) >= 500;

  return (
    <article style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      {/* JSON-LD: Place + GeoCoordinates */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Place', 'speakable': { '@type': 'SpeakableSpecification', 'cssSelector': ['h1', '.complex-summary'] },
        name: `${decoded} 아파트`,
        description: `${region} ${sigungu} ${dong} 소재 아파트${builtYear ? ` (${builtYear}년 준공)` : ''}`,
        address: { '@type': 'PostalAddress', addressRegion: region, addressLocality: `${sigungu} ${dong}`, addressCountry: 'KR' },
        ...(hasCoords ? {
          geo: { '@type': 'GeoCoordinates', latitude: Number(profile.latitude), longitude: Number(profile.longitude) },
          hasMap: `https://map.kakao.com/?q=${encodeURIComponent(decoded + ' 아파트')}`,
        } : {}),
        ...(builtYear ? { foundingDate: `${builtYear}` } : {}),
        mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/apt/complex/${encodeURIComponent(decoded)}` },
        image: [
          { '@type': 'ImageObject', url: `${SITE_URL}/api/og?title=${encodeURIComponent(decoded)}&design=2&category=apt`, width: 1200, height: 630 },
          { '@type': 'ImageObject', url: `${SITE_URL}/api/og-square?title=${encodeURIComponent(decoded)}&category=apt`, width: 630, height: 630 },
        ],
        thumbnailUrl: `${SITE_URL}/api/og-square?title=${encodeURIComponent(decoded)}&category=apt`,
      })}} />

      {/* JSON-LD: Product + AggregateOffer (SERP 가격 칩) + 조건부 AggregateRating */}
      {latestPrice > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Product',
        name: `${decoded} 아파트`,
        description: `${region} ${sigungu} ${dong} ${decoded} 아파트 매매·전세 시세 정보`,
        brand: { '@type': 'Brand', name: region },
        offers: {
          '@type': 'AggregateOffer',
          lowPrice: String(minPrice * 10000),
          highPrice: String(maxPrice * 10000),
          priceCurrency: 'KRW',
          offerCount: tradeList.length,
          availability: 'https://schema.org/InStock',
        },
        ...(profile?.review_count > 0 && profile?.avg_rating > 0 ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: String(profile.avg_rating),
            bestRating: '5',
            ratingCount: String(profile.review_count),
          },
        } : {}),
        ...(areaStats.length > 0 ? { additionalProperty: areaStats.slice(0,3).map(a => ({ '@type': 'PropertyValue', name: `${a.area} 평균 매매가`, value: fmtAmount(a.avg) })) } : {}),
      }) }} />}

      {/* JSON-LD: Dataset (실거래 데이터셋) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Dataset',
        name: `${decoded} 아파트 실거래가 데이터`,
        description: `${decoded} 아파트의 매매·전세·월세 실거래 데이터 ${tradeList.length + rentTrades.length}건`,
        url: `${SITE_URL}/apt/complex/${encodeURIComponent(decoded)}`,
        keywords: [decoded, '실거래가', '아파트 시세', region, sigungu],
        creator: { '@type': 'Organization', name: '카더라', url: SITE_URL },
        dateModified: new Date().toISOString(),
        spatialCoverage: { '@type': 'Place', name: `${region} ${sigungu}` },
        temporalCoverage: tradeList.length > 0 ? `${tradeList[tradeList.length-1]?.deal_date || ''}/${tradeList[0]?.deal_date || ''}` : '',
        distribution: { '@type': 'DataDownload', contentUrl: `${SITE_URL}/apt/complex/${encodeURIComponent(decoded)}`, encodingFormat: 'text/html' },
      })}} />

      {/* JSON-LD: BreadcrumbList */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: '부동산', item: `${SITE_URL}/apt` },
          { '@type': 'ListItem', position: 3, name: '단지백과', item: `${SITE_URL}/apt/complex` },
          { '@type': 'ListItem', position: 4, name: `${region} ${sigungu}`, item: `${SITE_URL}/apt/complex?region=${encodeURIComponent(region)}` },
          { '@type': 'ListItem', position: 5, name: decoded },
        ],
      })}} />

      {/* JSON-LD: FAQPage (SERP 아코디언) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: `${decoded} 최근 실거래가는?`, acceptedAnswer: { '@type': 'Answer', text: `${decoded}의 최근 매매가는 ${latestPrice > 0 ? fmtAmount(latestPrice) : '정보 없음'}이며, 평균 ${fmtAmount(avgPrice)}입니다. ${region} ${sigungu} ${dong} 소재${builtYear ? `, ${builtYear}년 준공` : ''}입니다.` } },
          { '@type': 'Question', name: `${decoded} 전세·월세 시세는?`, acceptedAnswer: { '@type': 'Answer', text: `${decoded}의 전세가는 ${latestJeonse ? fmtAmount(latestJeonse.deposit) : '정보 없음'}${jeonseRatio ? ` (전세가율 ${jeonseRatio}%)` : ''}이며, 월세는 ${latestMonthly ? `보증금 ${fmtAmount(latestMonthly.deposit)}/월 ${latestMonthly.monthly_rent}만원` : '정보 없음'}입니다.` } },
          { '@type': 'Question', name: `${decoded} 평당가는 얼마인가요?`, acceptedAnswer: { '@type': 'Answer', text: `${decoded}의 평당 매매가는 ${profile?.avg_sale_price_pyeong ? fmtAmount(profile.avg_sale_price_pyeong) : fmtAmount(Math.round(avgPrice / (tradeList[0]?.exclusive_area || 84) * 3.3))}입니다.` } },
          { '@type': 'Question', name: `${decoded} 준공연도와 세대수는?`, acceptedAnswer: { '@type': 'Answer', text: `${decoded}은 ${builtYear ? `${builtYear}년에 준공` : '준공 정보 미상'}되었으며, ${profile?.total_households ? `총 ${profile.total_households.toLocaleString()}세대` : '세대수 정보 미상'}입니다.` } },
          { '@type': 'Question', name: `${decoded} 전세가율은?`, acceptedAnswer: { '@type': 'Answer', text: `${decoded}의 전세가율은 ${jeonseRatio ? `${jeonseRatio}%` : '정보 없음'}입니다.${jeonseRatio && jeonseRatio > 70 ? ' 전세가율이 높아 갭투자 시 주의가 필요합니다.' : jeonseRatio && jeonseRatio < 50 ? ' 전세가율이 낮아 매매 대비 전세가 저렴한 편입니다.' : ''}` } },
          { '@type': 'Question', name: `${decoded} 최근 거래량은?`, acceptedAnswer: { '@type': 'Answer', text: `${decoded}의 최근 거래 건수는 총 ${tradeList.length}건이며, 면적별로 ${areaStats.slice(0,3).map(a => `${a.area} ${a.count}건`).join(', ')}입니다.` } },
          { '@type': 'Question', name: `${decoded} 어떤 면적이 있나요?`, acceptedAnswer: { '@type': 'Answer', text: `${decoded}에는 ${areaStats.map(a => a.area).join(', ')} 면적의 세대가 있으며, 가장 거래가 활발한 면적은 ${areaStats[0]?.area || '정보 없음'}입니다.` } },
          { '@type': 'Question', name: `${decoded} 가격 추이는?`, acceptedAnswer: { '@type': 'Answer', text: `${decoded}의 ${monthlyTrend.length > 0 ? `최근 ${monthlyTrend.length}개월 추이: 최저 ${fmtAmount(Math.min(...monthlyTrend.map(m => m.avg)))}에서 최고 ${fmtAmount(Math.max(...monthlyTrend.map(m => m.avg)))}` : '가격 추이 정보가 없습니다'}.${profile?.price_change_1y ? ` 1년 변동률 ${Number(profile.price_change_1y) > 0 ? '+' : ''}${profile.price_change_1y}%.` : ''}` } },
          { '@type': 'Question', name: `${decoded} 면적별 평당가는?`, acceptedAnswer: { '@type': 'Answer', text: `${decoded}에는 ${areaStats.length}개 면적 타입이 있으며, 면적별 평당가와 거래 이력을 카더라에서 비교 분석할 수 있습니다.` } },
          { '@type': 'Question', name: `${decoded} 입주 연차는?`, acceptedAnswer: { '@type': 'Answer', text: builtYear ? `${decoded}은 ${builtYear}년 준공으로 현재 ${2026 - builtYear}년차(${profile?.age_group || ''})입니다.` : `${decoded}의 준공 연도 정보는 확인되지 않았습니다.` } },
        ],
      })}} />

      {/* JSON-LD: ImageGallery (이미지 캐러셀 — 항상 노출) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'ImageGallery',
        name: `${decoded} 아파트 이미지·차트`,
        description: `${decoded} 아파트 실거래가 차트, 조감도, 평면도 등`,
        url: `${SITE_URL}/apt/complex/${encodeURIComponent(decoded)}`,
        image: [
          ...siteImages.map(img => ({
            '@type': 'ImageObject',
            url: img.url.startsWith('http') ? img.url : `https:${img.url}`,
            name: `${decoded} 아파트`,
            description: `${region} ${sigungu} ${decoded} 아파트`,
          })),
          { '@type': 'ImageObject', url: `${SITE_URL}/api/og?title=${encodeURIComponent(decoded)}&design=2&category=apt&subtitle=${encodeURIComponent(latestPrice > 0 ? `매매 ${fmtAmount(latestPrice)}` : '실거래가 분석')}`, width: 1200, height: 630, name: `${decoded} 실거래가`, caption: `${decoded} 매매·전세 시세` },
          { '@type': 'ImageObject', url: `${SITE_URL}/api/og-square?title=${encodeURIComponent(decoded)}&category=apt`, width: 630, height: 630, name: `${decoded} 아파트 정보` },
        ],
      })}} />

      <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-md)', flexWrap: 'wrap' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>
        <span>›</span>
        <Link href="/apt" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>부동산</Link>
        <span>›</span>
        <Link href="/apt/complex" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>단지백과</Link>
        <span>›</span>
        <Link href={`/apt/complex?region=${encodeURIComponent(region)}`} style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>{region}</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{decoded}</span>
      </nav>

      {/* 이미지 갤러리 (apt_sites 이미지 있을 때) — 클릭 확대 지원 */}
      {siteImages.length > 0 && (
        <div style={{ marginBottom: 'var(--sp-md)' }}>
          <AptImageGallery images={siteImages} name={decoded} region={`${region} ${sigungu}`} />
        </div>
      )}

      {/* 세션 138: apt_complex_profiles.images 갤러리 (ImageLightbox + zoom) — stock/[symbol]과 동일 UX */}
      {(() => {
        const raw = Array.isArray(profile?.images) ? profile.images : [];
        const complexImages = raw
          .map((img: any) => {
            if (!img) return null;
            if (typeof img === 'string') return { url: img.replace(/^http:\/\//, 'https://'), caption: null, alt: null };
            if (img.url) return {
              url: String(img.url).replace(/^http:\/\//, 'https://'),
              caption: img.caption ?? null,
              alt: img.alt_text ?? null,
            };
            return null;
          })
          .filter((x: any): x is { url: string; caption: string | null; alt: string | null } => !!x);
        if (complexImages.length === 0) return null;
        return (
          <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--card-p) var(--sp-lg)', marginBottom: 'var(--sp-md)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>
              🖼️ {decoded} 관련 이미지 · {complexImages.length}장
            </h2>
            <ImageLightbox images={complexImages} columns={3} />
          </section>
        );
      })()}

      {/* 세션 158 B: hero 이미지 실사진 우선, 없으면 OG + "실사진 준비 중" 라벨 */}
      {(() => {
        const profileImages = Array.isArray(profile?.images) ? (profile.images as any[]) : [];
        const realHero = profileImages
          .map((im) => typeof im === 'string' ? im : im?.url)
          .find((u) => typeof u === 'string' && u.length > 10 && !u.includes('/api/og'));
        const ogHeroUrl = `/api/og?title=${encodeURIComponent(decoded)}&design=2&category=apt&subtitle=${encodeURIComponent(latestPrice > 0 ? `매매 ${fmtAmount(latestPrice)}${latestJeonse ? ` · 전세 ${fmtAmount(latestJeonse.deposit)}` : ''}` : '실거래가 시세')}&author=${encodeURIComponent('카더라')}`;
        const heroSrc = realHero
          ? (typeof realHero === 'string' ? realHero : '').replace(/^http:\/\//, 'https://')
          : ogHeroUrl;
        const isPlaceholder = heroSrc.includes('/api/og');
        return (
          <div style={{ position: 'relative', marginBottom: 'var(--sp-md)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroSrc}
              alt={`${decoded} 아파트 ${region} ${sigungu} 실거래가 시세 ${latestPrice > 0 ? fmtAmount(latestPrice) : ''}`}
              width={1200}
              height={630}
              style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', filter: isPlaceholder ? 'blur(1px) brightness(0.8)' : undefined }}
              loading="lazy"
            />
            {isPlaceholder && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', pointerEvents: 'none' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '3px 10px', borderRadius: 12 }}>
                  📷 실사진 준비 중
                </span>
              </div>
            )}
          </div>
        );
      })()}
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>{decoded}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <time dateTime={new Date().toISOString()} style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date().toLocaleDateString('ko-KR')} 기준</time>
        {profile?.age_group && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: profile.age_group === '신축' ? 'rgba(59,123,246,0.1)' : 'var(--bg-hover)', color: profile.age_group === '신축' ? 'var(--brand)' : 'var(--text-secondary)' }}>{profile.age_group}</span>}
        {builtYear > 0 && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{builtYear}년 준공</span>}
      </div>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', margin: '0 0 8px' }}>{region} {sigungu} {dong} · 매매 {tradeList.length}건{rentTrades.length > 0 ? ` · 전월세 ${rentTrades.length}건` : ''}</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 'var(--sp-md)' }}>
        {profile?.id && <AptBookmarkButton aptId={String(profile.id)} aptName={decoded} />}
        <ShareButtons title={`${decoded} 아파트 실거래가·시세 — ${region} ${sigungu}`} contentType="apt-complex" contentRef={name} />
      </div>

      {/* [COMPLEX-CARD] big_event 역연결 하이라이트 카드 */}
      {bigEvent && (
        <section
          aria-label={`${decoded} ${bigEvent.event_type || '재건축'} 핵심 정보`}
          style={{
            marginBottom: 'var(--sp-lg)',
            padding: '14px 16px',
            borderRadius: 'var(--radius-card)',
            background: 'linear-gradient(135deg, rgba(59,123,246,0.08), rgba(168,85,247,0.05))',
            border: '1px solid rgba(59,123,246,0.25)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18 }}>🏗️</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
              {bigEvent.new_brand_name
                ? `${bigEvent.new_brand_name} ${bigEvent.event_type || '재건축'}`
                : `${bigEvent.event_type || '재건축'} 진행 중`}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(59,123,246,0.18)', color: 'var(--brand)' }}>
              Stage {bigEvent.stage ?? '-'} / 7
            </span>
            {bigEvent.constructor_status && bigEvent.constructor_status !== 'confirmed' && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'var(--warning-bg)', color: 'var(--warning, #eab308)' }}>
                {bigEvent.constructor_status === 'likely' ? '수주 유력' : '수주 미확정'}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
            {bigEvent.scale_before ?? '?'}세대 → <strong style={{ color: 'var(--text-primary)' }}>{bigEvent.scale_after ?? '?'}+세대</strong>
            {Array.isArray(bigEvent.key_constructors) && bigEvent.key_constructors.length > 0 && (
              <> · 시공사 {bigEvent.key_constructors.join(', ')}</>
            )}
          </div>
          {pillarSlug && (
            <Link
              href={`/blog/${pillarSlug}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--brand)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              상세 분석 보기 →
            </Link>
          )}
        </section>
      )}

      {/* [COMPLEX-CARD] 재건축 후보 배지 — big_event 미등록 + 노후 단지 */}
      {!bigEvent && isRedevCandidate && (
        <section
          aria-label="재건축 후보 단지"
          style={{
            marginBottom: 'var(--sp-md)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--warning-bg, rgba(234,179,8,0.08))',
            border: '1px dashed rgba(234,179,8,0.3)',
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: 'var(--text-primary)' }}>🏘️ 재건축 후보 단지</strong> · {builtYear}년 준공 · {profile?.total_households?.toLocaleString() ?? '?'}세대 — 카더라는 정비사업 진입 시 이 단지 전용 분석 글을 발행합니다.
        </section>
      )}

      {/* SEO 가시적 텍스트 (확장) */}
      <section className="site-description" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)', marginBottom: 14 }}>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0, wordBreak: 'keep-all' }}>
          {decoded}은 {region} {sigungu} {dong} 소재{builtYear ? ` ${builtYear}년 준공 (${profile?.age_group || ''})` : ''} 아파트입니다.
          {avgPrice > 0 && <> 최근 매매 평균가 {fmtAmount(avgPrice)}, 최고가 {fmtAmount(maxPrice)}, 최저가 {fmtAmount(minPrice)}.</>}
          {latestJeonse && <> 전세가 {fmtAmount(latestJeonse.deposit)}{jeonseRatio ? ` (전세가율 ${jeonseRatio}%)` : ''}.</>}
          {latestMonthly && <> 월세 보증금 {fmtAmount(latestMonthly.deposit)}/월 {latestMonthly.monthly_rent}만원.</>}
          {areaStats.length > 0 && <> {areaStats.length}개 면적 타입에서 {tradeList.length}건의 거래가 확인됩니다.</>}
        </p>
      </section>

      {/* ═══ 핵심 시세 요약 — 히어로 카드 ═══ */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10, marginBottom: 'var(--sp-lg)',
      }}>
        {/* 매매 메인 카드 */}
        <div style={{
          gridColumn: '1 / -1', borderRadius: 'var(--radius-lg)', padding: '18px 20px',
          background: 'linear-gradient(135deg, rgba(15,27,62,0.95) 0%, rgba(37,99,235,0.85) 100%)',
          border: '1px solid rgba(59,123,246,0.2)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(59,123,246,0.15)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 'var(--sp-xs)' }}>최근 매매가</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>{fmtAmount(latestPrice)}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 'var(--sp-xs)' }}>평균 {fmtAmount(avgPrice)} · 최고 {fmtAmount(maxPrice)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {jeonseRatio && (
                <div style={{
                  background: jeonseRatio > 80 ? 'rgba(239,68,68,0.2)' : jeonseRatio > 60 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)',
                  color: jeonseRatio > 80 ? '#fca5a5' : jeonseRatio > 60 ? '#fde047' : '#86efac',
                  padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 800, display: 'inline-block',
                }}>전세가율 {jeonseRatio}%</div>
              )}
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 'var(--sp-xs)' }}>거래 {tradeList.length}건</div>
            </div>
          </div>
        </div>

        {/* 전세 카드 */}
        <div style={{
          borderRadius: 'var(--radius-card)', padding: 'var(--card-p) var(--sp-lg)',
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderLeft: '3px solid #3b82f6',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 'var(--sp-xs)' }}>💙 전세</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: '#3b82f6' }}>
            {latestJeonse ? fmtAmount(latestJeonse.deposit) : '—'}
          </div>
          {latestJeonse && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{latestJeonse.exclusive_area}㎡ · {latestJeonse.deal_date}</div>}
        </div>

        {/* 월세 카드 */}
        <div style={{
          borderRadius: 'var(--radius-card)', padding: 'var(--card-p) var(--sp-lg)',
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderLeft: '3px solid #f97316',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 'var(--sp-xs)' }}>🧡 월세</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: '#f97316' }}>
            {latestMonthly ? `${latestMonthly.monthly_rent}만` : '—'}
          </div>
          {latestMonthly && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>보증 {fmtAmount(latestMonthly.deposit)}</div>}
        </div>
      </div>

      {/* 📈 월별 시세 추이 — 향상된 SVG */}
      {monthlyTrend.length >= 3 && (() => {
        const data = monthlyTrend.slice(-12);
        const maxVal = Math.max(...data.map(d => d.avg));
        const minVal = Math.min(...data.map(d => d.avg));
        const range = maxVal - minVal || 1;
        const w = 100; const h = 40;
        const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - ((d.avg - minVal) / range) * (h - 4) - 2}`).join(' ');
        const lastAvg = data[data.length - 1].avg;
        const firstAvg = data[0].avg;
        const trendPct = Math.round(((lastAvg - firstAvg) / firstAvg) * 100);
        const isUp = trendPct >= 0;
        const color = isUp ? '#ef4444' : '#3b82f6';
        return (
          <div style={{
            borderRadius: 'var(--radius-lg)', padding: '18px 20px', marginBottom: 'var(--sp-lg)',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-md)' }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>📈 월별 시세 추이</span>
              <div style={{
                fontSize: 12, fontWeight: 800, color,
                background: `${color}15`, padding: '4px 12px', borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)',
              }}>
                <span style={{ fontSize: 14 }}>{isUp ? '▲' : '▼'}</span>
                {Math.abs(trendPct)}%
                <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.7 }}>({data.length}개월)</span>
              </div>
            </div>
            <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 100 }} preserveAspectRatio="none">
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <polygon points={`0,${h} ${pts} ${w},${h}`} fill="url(#trendFill)" />
              <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {/* 최근값 점 */}
              {(() => {
                const lastPt = pts.split(' ').pop()?.split(',') || ['100','20'];
                return <circle cx={lastPt[0]} cy={lastPt[1]} r="2.5" fill={color} stroke="#fff" strokeWidth="1" />;
              })()}
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, marginTop: 6 }}>
              <span style={{ color: 'var(--text-tertiary)' }}>{data[0].ym}</span>
              <div style={{ display: 'flex', gap: 'var(--sp-md)' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>최저 {fmtAmount(minVal)}</span>
                <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>최근 {fmtAmount(lastAvg)}</span>
              </div>
              <span style={{ color: 'var(--text-tertiary)' }}>{data[data.length - 1].ym}</span>
            </div>
          </div>
        );
      })()}

      {/* 🏘️ 주변 단지 비교 */}
      <AptNearbyCompare aptName={decoded} sigungu={sigungu} />

      {/* 📐 면적별 비교 — 그라데이션 바 + 카드 */}
      {areaStats.length > 1 && (() => {
        const maxAvg = Math.max(...areaStats.map(a => a.avg));
        const colors = ['#3b82f6','#8b5cf6','#06b6d4','#f59e0b','#ef4444','#ec4899','#10b981','#6366f1'];
        return (
        <div style={{ borderRadius: 'var(--radius-lg)', padding: '18px 20px', marginBottom: 'var(--sp-lg)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 14px' }}>📐 면적별 비교</h2>
          <div style={{ marginBottom: 14 }}>
            {areaStats.slice(0, 6).map((a, i) => {
              const pct = maxAvg > 0 ? (a.avg / maxAvg) * 100 : 0;
              const c = colors[i % colors.length];
              return (
                <div key={a.area} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-sm)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c, minWidth: 48, textAlign: 'right' }}>{a.area}</span>
                  <div style={{ flex: 1, height: 24, borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 'var(--radius-sm)', background: `linear-gradient(90deg, ${c}, ${c}80)`, boxShadow: `0 2px 6px ${c}30`, transition: 'width 0.6s ease' }} />
                    {a.avg > 0 && <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 800, color: pct > 50 ? '#fff' : 'var(--text-primary)' }}>{fmtAmount(a.avg)}</span>}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', minWidth: 28, textAlign: 'right', fontWeight: 600 }}>{a.count}건</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--sp-sm)' }}>
            {areaStats.slice(0, 8).map((a, i) => {
              const c = colors[i % colors.length];
              return (
                <div key={a.area} style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)', borderLeft: `3px solid ${c}` }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{a.area}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>평균 <span style={{ fontWeight: 700, color: c }}>{fmtAmount(a.avg)}</span></div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.count}건 거래</div>
                  {a.tradeList[0]?.exclusive_area > 0 && a.avg > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 700, marginTop: 3 }}>
                      평당 {fmtAmount(Math.round(a.avg / (a.tradeList[0].exclusive_area / 3.3058)))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>);
      })()}

      {/* 가격 추이 차트 */}
      <AptPriceTrendChart aptName={decoded} region={region} />

      {/* 📋 매매 거래 이력 — 테이블 스타일 */}
      <div style={{ borderRadius: 'var(--radius-lg)', padding: '18px 20px', marginBottom: 'var(--sp-lg)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>📋 매매 거래 이력</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>{tradeList.length}건</span>
        </div>
        {/* 헤더 */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 70px', gap: 'var(--sp-sm)', padding: '6px 0', borderBottom: '2px solid var(--border)', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
          <span>날짜</span><span>면적 · 층</span><span style={{ textAlign: 'right' }}>금액</span>
        </div>
        {tradeList.slice(0, 50).map((t, i) => {
          const amt = t.deal_amount || 0;
          const color = amt >= 100000 ? '#ef4444' : amt >= 50000 ? '#f97316' : amt >= 30000 ? '#3b82f6' : '#22c55e';
          return (
            <div key={t.id || i} style={{
              display: 'grid', gridTemplateColumns: '90px 1fr 70px', gap: 'var(--sp-sm)',
              padding: '10px 0', borderBottom: '1px solid var(--border)',
              fontSize: 13, alignItems: 'center',
            }}>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{t.deal_date}</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {Math.round(t.exclusive_area)}㎡
                <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>({Math.round(t.exclusive_area / 3.3058)}평)</span>
                <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>· {t.floor}층</span>
              </span>
              <span style={{ fontWeight: 800, color, textAlign: 'right' }}>{fmtAmount(amt)}</span>
            </div>
          );
        })}
        {tradeList.length > 50 && (
          <div style={{ textAlign: 'center', padding: '14px 0', color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 600 }}>
            +{tradeList.length - 50}건 더 있음
          </div>
        )}
      </div>

      {/* 🏠 전월세 거래 이력 */}
      {rentTrades.length > 0 && (
        <div style={{ borderRadius: 'var(--radius-lg)', padding: '18px 20px', marginBottom: 'var(--sp-lg)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>🏠 전월세 이력</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>{rentTrades.length}건</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto', gap: 'var(--sp-sm)', padding: '6px 0', borderBottom: '2px solid var(--border)', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)' }}>
            <span>날짜</span><span>면적 · 층</span><span style={{ textAlign: 'right' }}>유형 · 금액</span>
          </div>
          {rentTrades.slice(0, 30).map((r, i) => {
            const isJeonse = r.rent_type === 'jeonse';
            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '90px 1fr auto', gap: 'var(--sp-sm)',
                padding: '10px 0', borderBottom: '1px solid var(--border)',
                fontSize: 13, alignItems: 'center',
              }}>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{r.deal_date}</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {Math.round(r.exclusive_area)}㎡ · {r.floor}층
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    padding: '3px 8px', borderRadius: 'var(--radius-xs)', fontSize: 10, fontWeight: 800,
                    background: isJeonse ? 'rgba(59,130,246,0.1)' : 'rgba(249,115,22,0.1)',
                    color: isJeonse ? '#3b82f6' : '#f97316',
                  }}>{isJeonse ? '전세' : '월세'}</span>
                  <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                    {fmtAmount(r.deposit)}{!isJeonse && r.monthly_rent > 0 ? <span style={{ color: '#f97316' }}>/{r.monthly_rent}만</span> : ''}
                  </span>
                </div>
              </div>
            );
          })}
          {rentTrades.length > 30 && (
            <div style={{ textAlign: 'center', padding: '14px 0', color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 600 }}>
              +{rentTrades.length - 30}건 더 있음
            </div>
          )}
        </div>
      )}

      {/* 주민 리뷰 */}
      <AptReviewSection aptName={decoded} region={region} />

      {/* 🔗 외부 링크 — 아이콘 카드 */}
      <div className={siteSlug ? 'kd-grid-4' : 'kd-grid-3'} style={{ gap: 'var(--sp-sm)', marginBottom: 'var(--sp-lg)' }}>
        {[
          ...(siteSlug ? [{ emoji: '🏗️', label: '현장 정보', href: `/apt/${siteSlug}`, ext: false }] : []),
          { emoji: '🗺️', label: '카카오맵', href: `https://map.kakao.com/?q=${encodeURIComponent(decoded + ' ' + dong)}`, ext: true },
          { emoji: '🗺️', label: '네이버지도', href: `https://map.naver.com/p/search/${encodeURIComponent(decoded + ' ' + dong)}`, ext: true },
          { emoji: '🔍', label: '실거래 검색', href: `/apt/search?q=${encodeURIComponent(decoded)}`, ext: false },
        ].map(l => {
          const Tag = l.ext ? 'a' : Link;
          const extraProps = l.ext ? { target: '_blank', rel: 'noopener noreferrer' } : {};
          return (
            <Tag key={l.label} href={l.href} {...(extraProps as any)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-xs)',
              padding: '14px 8px', borderRadius: 'var(--radius-card)',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', textDecoration: 'none',
              transition: 'border-color 0.12s',
            }}>
              <span style={{ fontSize: 'var(--fs-xl)' }}>{l.emoji}</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{l.label}</span>
            </Tag>
          );
        })}
      </div>

      {/* 조회·댓글·관심 */}
      <EngageRow views={siteEngage.views} comments={siteEngage.comments} interest={siteEngage.interest} style={{ borderTop: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--sp-lg)', background: 'var(--bg-surface)' }} />

      {/* 📰 관련 분석 */}
      {relatedBlogs.length > 0 && (
        <div style={{ borderRadius: 'var(--radius-lg)', padding: '18px 20px', marginBottom: 'var(--sp-lg)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--sp-md)' }}>📰 관련 분석</div>
          {relatedBlogs.map((b: Record<string, any>) => (
            <Link key={b.slug} href={`/blog/${b.slug}`} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0', borderBottom: '1px solid var(--border)',
              textDecoration: 'none', color: 'inherit', transition: 'opacity 0.12s',
            }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{b.title}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 8, background: 'var(--bg-hover)', padding: '3px 8px', borderRadius: 4 }}>👀 {b.view_count || 0}</span>
            </Link>
          ))}
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', margin: '16px 0 8px' }}>
        📊 국토교통부 실거래가 공개시스템 기준 · 카더라 자체 분석
      </p>

      {/* SSR 자동 분석 텍스트 — Featured Snippet / AI Overview 타겟 */}
      <section className="complex-analysis" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)', marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>{decoded} 실거래가 분석</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
          {decoded}은 {region} {sigungu} {dong}에 위치한{builtYear ? ` ${builtYear}년 준공` : ''}{profile?.total_households ? ` ${profile.total_households.toLocaleString()}세대 규모의` : ''} 아파트입니다.
          {latestPrice > 0 && ` 최근 매매 실거래가는 ${fmtAmount(latestPrice)}이며, 평균 매매가 ${fmtAmount(avgPrice)}, 최고가 ${fmtAmount(maxPrice)}, 최저가 ${fmtAmount(minPrice)}입니다.`}
          {latestJeonse && ` 전세 시세는 ${fmtAmount(latestJeonse.deposit)}${jeonseRatio ? ` (전세가율 ${jeonseRatio}%)` : ''}이며,`}
          {latestMonthly && ` 월세는 보증금 ${fmtAmount(latestMonthly.deposit)}/월 ${latestMonthly.monthly_rent}만원입니다.`}
          {profile?.price_change_1y && ` 최근 1년 가격 변동률은 ${Number(profile.price_change_1y) > 0 ? '+' : ''}${profile.price_change_1y}%입니다.`}
          {areaStats.length > 0 && ` 거래가 가장 활발한 면적은 ${areaStats[0].area}(${areaStats[0].count}건, 평균 ${fmtAmount(areaStats[0].avg)})입니다.`}
          {` 총 ${tradeList.length}건의 매매 거래와 ${rentTrades.length}건의 전월세 거래가 기록되어 있습니다.`}
        </p>
      </section>

      {/* 지역 허브 내부 링크 — SEO 계층 구조 */}
      {(region || sigungu) && (
        <section style={{ marginBottom: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {region && <Link href={`/apt/region/${encodeURIComponent(region)}`} style={{ padding: '6px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20, textDecoration: 'none', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>{region} 부동산</Link>}
          {region && sigungu && <Link href={`/apt/area/${encodeURIComponent(region)}/${encodeURIComponent(sigungu)}`} style={{ padding: '6px 12px', background: 'var(--bg-surface)', border: '1px solid var(--accent-blue)', borderRadius: 20, textDecoration: 'none', fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600 }}>{sigungu} 시세 분석</Link>}
          {region && sigungu && dong && <Link href={`/apt/area/${encodeURIComponent(region)}/${encodeURIComponent(sigungu)}/${encodeURIComponent(dong)}`} style={{ padding: '6px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20, textDecoration: 'none', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>{dong} 아파트</Link>}
        </section>
      )}

      {/* 관련 단지 — 내부 링크 강화 (크롤링 심도 개선) */}
      {relatedComplexes.length > 0 && (
        <section style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>{sigungu} 주요 아파트</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {relatedComplexes.slice(0, 6).map((rc: any, i: number) => (
              <Link key={i} href={`/apt/complex/${encodeURIComponent(rc.apt_name)}`} style={{
                display: 'block', padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', textDecoration: 'none', transition: 'border-color 0.15s',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rc.apt_name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {rc.latest_sale_price ? fmtAmount(rc.latest_sale_price) : '시세 미상'}
                  {rc.built_year ? ` · ${rc.built_year}년` : ''}
                  {rc.total_households ? ` · ${rc.total_households}세대` : ''}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 비교하기 CTA */}
      {relatedComplexes.length > 0 && relatedComplexes[0]?.apt_name && (
        <Link href={`/apt/compare/${encodeURIComponent(decoded)}-vs-${encodeURIComponent(relatedComplexes[0].apt_name)}`} style={{
          display: 'block', textAlign: 'center', padding: '12px', marginBottom: 8,
          borderRadius: 'var(--radius-sm)', fontWeight: 700, textDecoration: 'none', fontSize: 13,
          background: 'var(--bg-surface)', border: '1px solid var(--accent-blue)', color: 'var(--accent-blue)',
        }}>
          ⚖️ {decoded} vs {relatedComplexes[0].apt_name} 비교
        </Link>
      )}

      {/* CTA */}
      <Link href={siteSlug ? `/apt/${siteSlug}` : `/apt/search?q=${encodeURIComponent(decoded)}`} style={{
        display: 'block', textAlign: 'center', padding: '16px', marginBottom: 40,
        borderRadius: 'var(--radius-lg)', fontWeight: 800, textDecoration: 'none', fontSize: 14,
        background: 'linear-gradient(135deg, #0F1B3E 0%, #2563EB 100%)',
        color: '#fff', boxShadow: '0 4px 16px rgba(37,99,235,0.3)',
        transition: 'transform 0.15s ease',
      }}>
        🏗️ {siteSlug ? '단지 전체 정보 보기' : '실거래 검색에서 보기'} →
      </Link>
      {/* LoginGate 기능 게이팅 (세션 108) */}
      <LoginGate feature="apt_trade_alert" blurHeight={80}>
        <div style={{ padding: "8px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", color: "var(--text-tertiary)" }}><span>실거래 변동</span><span>알림 설정</span></div>
        </div>
      </LoginGate>
    </article>
  );
}
