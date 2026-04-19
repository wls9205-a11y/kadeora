/**
 * [CI-v1] thumbnail-fallback — 엔티티별 썸네일 URL fallback 체인
 *
 * DB 상 NULL 은 backfill 로 0 건이 된 상태지만, 프론트가 어떤 SELECT 조합이든
 * 안전한 URL 을 얻도록 공용 유틸 제공.
 *
 * 공통 최종 fallback: `${SITE}/api/og?title=<...>&design=2`
 */

import { SITE_URL } from '@/lib/constants';

const SITE = SITE_URL.replace(/\/$/, '') || 'https://kadeora.app';
const DEFAULT_DESIGN = 2;

function ogFallback(title: string, design: number = DEFAULT_DESIGN): string {
  const t = (title || 'kadeora').slice(0, 60);
  return `${SITE}/api/og?title=${encodeURIComponent(t)}&design=${design}`;
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
  satellite_image_url?: string | null;
  og_image_url?: string | null;
  images?: unknown;
  name?: string | null;
}

/** apt_sites: satellite > og > images[0] > OG generator */
export function aptSiteThumb(row: AptSiteThumbRow | null | undefined): string {
  if (!row) return ogFallback('아파트');
  return (
    (row.satellite_image_url && row.satellite_image_url.length > 10 ? row.satellite_image_url : null)
    ?? (row.og_image_url && row.og_image_url.length > 10 ? row.og_image_url : null)
    ?? firstImageUrl(row.images)
    ?? ogFallback(row.name || '아파트')
  );
}

export interface AptComplexThumbRow {
  images?: unknown;
  og_image_url?: string | null;
  apt_name?: string | null;
}

/** apt_complex_profiles: images[0] > og > OG generator */
export function aptComplexThumb(row: AptComplexThumbRow | null | undefined): string {
  if (!row) return ogFallback('단지');
  return (
    firstImageUrl(row.images)
    ?? (row.og_image_url && row.og_image_url.length > 10 ? row.og_image_url : null)
    ?? ogFallback(row.apt_name || '단지')
  );
}

export interface UnsoldThumbRow {
  thumbnail_url?: string | null;
  house_nm?: string | null;
}

/** unsold_apts */
export function unsoldThumb(row: UnsoldThumbRow | null | undefined): string {
  if (!row) return ogFallback('미분양');
  return (
    (row.thumbnail_url && row.thumbnail_url.length > 10 ? row.thumbnail_url : null)
    ?? ogFallback(row.house_nm || '미분양')
  );
}

export interface RedevThumbRow {
  thumbnail_url?: string | null;
  district_name?: string | null;
}

/** redevelopment_projects */
export function redevThumb(row: RedevThumbRow | null | undefined): string {
  if (!row) return ogFallback('재개발');
  return (
    (row.thumbnail_url && row.thumbnail_url.length > 10 ? row.thumbnail_url : null)
    ?? ogFallback(row.district_name || '재개발')
  );
}

export interface BlogThumbRow {
  cover_image?: string | null;
  title?: string | null;
}

/** blog_posts */
export function blogThumb(row: BlogThumbRow | null | undefined): string {
  if (!row) return ogFallback('카더라');
  return (
    (row.cover_image && row.cover_image.length > 10 ? row.cover_image : null)
    ?? ogFallback(row.title || '카더라')
  );
}

/** 임의 대상 — title 기반 OG fallback URL 만 필요할 때 */
export function ogFor(title?: string | null, design: number = DEFAULT_DESIGN): string {
  return ogFallback(title || 'kadeora', design);
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
