/**
 * [CI-v1] thumbnail-fallback — 엔티티별 썸네일 URL fallback 체인
 *
 * DB 상 NULL 은 backfill 로 0 건이 된 상태지만, 프론트가 어떤 SELECT 조합이든
 * 안전한 URL 을 얻도록 공용 유틸 제공.
 *
 * s214 변경: 최종 fallback 을 `/api/og` 에서 `/api/og-square` 로 전환.
 *   /api/og 가 prod 에서 간헐 timeout — og-square 는 정사각 가벼운 카드 (DB 호출 없음).
 */

import { SITE_URL } from '@/lib/constants';

const SITE = SITE_URL.replace(/\/$/, '') || 'https://kadeora.app';

function ogFallback(title: string, category: string = 'blog'): string {
  const t = (title || 'kadeora').slice(0, 60);
  return `${SITE}/api/og-square?title=${encodeURIComponent(t)}&category=${category}`;
}

/** images jsonb 첫 번째 URL 안전 추출 */
function firstImageUrl(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0] as any;
  if (typeof first === 'string' && first.length > 0) return first;
  if (first && typeof first === 'object' && typeof first.url === 'string' && first.url.length > 0) {
    return first.url;
  }
  return null;
}

export interface AptSiteThumbRow {
  cover_image_url?: string | null;       // s214 C4: 5컬럼군 100% NULL — backfill 시 우선 사용
  satellite_image_url?: string | null;
  og_image_url?: string | null;
  images?: unknown;
  name?: string | null;
}

/** apt_sites: cover > satellite > og > images[0] > OG generator */
export function aptSiteThumb(row: AptSiteThumbRow | null | undefined): string {
  if (!row) return ogFallback('아파트', 'apt');
  return (
    (row.cover_image_url && row.cover_image_url.length > 10 ? row.cover_image_url : null)
    ?? (row.satellite_image_url && row.satellite_image_url.length > 10 ? row.satellite_image_url : null)
    ?? (row.og_image_url && row.og_image_url.length > 10 ? row.og_image_url : null)
    ?? firstImageUrl(row.images)
    ?? ogFallback(row.name || '아파트', 'apt')
  );
}

export interface AptComplexThumbRow {
  images?: unknown;
  og_image_url?: string | null;
  apt_name?: string | null;
}

/** apt_complex_profiles: images[0] > og > OG generator */
export function aptComplexThumb(row: AptComplexThumbRow | null | undefined): string {
  if (!row) return ogFallback('단지', 'apt');
  return (
    firstImageUrl(row.images)
    ?? (row.og_image_url && row.og_image_url.length > 10 ? row.og_image_url : null)
    ?? ogFallback(row.apt_name || '단지', 'apt')
  );
}

export interface UnsoldThumbRow {
  thumbnail_url?: string | null;
  house_nm?: string | null;
}

/** unsold_apts */
export function unsoldThumb(row: UnsoldThumbRow | null | undefined): string {
  if (!row) return ogFallback('미분양', 'unsold');
  return (
    (row.thumbnail_url && row.thumbnail_url.length > 10 ? row.thumbnail_url : null)
    ?? ogFallback(row.house_nm || '미분양', 'unsold')
  );
}

export interface RedevThumbRow {
  thumbnail_url?: string | null;
  district_name?: string | null;
}

/** redevelopment_projects */
export function redevThumb(row: RedevThumbRow | null | undefined): string {
  if (!row) return ogFallback('재개발', 'apt');
  return (
    (row.thumbnail_url && row.thumbnail_url.length > 10 ? row.thumbnail_url : null)
    ?? ogFallback(row.district_name || '재개발', 'apt')
  );
}

// s214 M6: constructors.logo_url 100% NULL — letter avatar 데이터 + clearbit 도메인 시도 fallback.
// 컴포넌트는 constructorLogo(row) 로 URL 받고 fallback 은 CSS letter-avatar 로 처리.
const CONSTRUCTOR_DOMAINS: Record<string, string> = {
  '삼성물산': 'samsungcnt.com',
  '현대건설': 'hdec.kr',
  '대우건설': 'daewooenc.com',
  'GS건설': 'gsconst.co.kr',
  '롯데건설': 'lottecon.co.kr',
  'DL이앤씨': 'dlconstruction.co.kr',
  '포스코건설': 'poscoenc.com',
  'HDC현대산업개발': 'hdc-icd.co.kr',
  'SK에코플랜트': 'skecoplant.com',
  '두산건설': 'doosanenc.com',
};

export interface ConstructorThumbRow {
  logo_url?: string | null;
  name?: string | null;
}

/** constructors.logo_url 100% NULL fallback — DB > clearbit > null (컴포넌트 letter avatar) */
export function constructorLogo(row: ConstructorThumbRow | null | undefined): string | null {
  if (!row) return null;
  if (row.logo_url && row.logo_url.length > 10) return row.logo_url;
  const name = (row.name || '').trim();
  if (!name) return null;
  const dom = CONSTRUCTOR_DOMAINS[name];
  return dom ? `https://logo.clearbit.com/${dom}` : null;
}

export interface BlogThumbRow {
  cover_image?: string | null;
  title?: string | null;
}

/** blog_posts */
export function blogThumb(row: BlogThumbRow | null | undefined): string {
  if (!row) return ogFallback('카더라', 'blog');
  return (
    (row.cover_image && row.cover_image.length > 10 ? row.cover_image : null)
    ?? ogFallback(row.title || '카더라', 'blog')
  );
}

/** 임의 대상 — title 기반 OG fallback URL 만 필요할 때 */
export function ogFor(title?: string | null, category: string = 'blog'): string {
  return ogFallback(title || 'kadeora', category);
}

/** next/image onError 핸들러 생성기 — 알트 텍스트 기반 OG 로 대체 */
export function createImgErrorHandler(alt?: string | null) {
  const fallback = ogFallback(alt || 'kadeora');
  return (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    // 무한 루프 방지: 이미 fallback 이면 stop
    if (img.dataset.fbApplied === '1') return;
    img.dataset.fbApplied = '1';
    img.src = fallback;
  };
}
