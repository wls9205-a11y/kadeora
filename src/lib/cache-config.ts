// 캐시 통합 관리 — 환경변수 NEXT_PUBLIC_CACHE_VERSION 하나로 전체 캐시 무효화
export const CACHE_VERSION = process.env.NEXT_PUBLIC_CACHE_VERSION || '20260318';

/** Redis 키에 버전 prefix 추가 */
export function versionedKey(key: string): string {
  return `v${CACHE_VERSION}:${key}`;
}

/** revalidate TTL 중앙 관리 (초) */
export const CACHE_TTL = {
  /** 피드, 댓글 등 자주 바뀌는 데이터 */
  short: 60,
  /** 트렌딩, 검색 결과 */
  medium: 300,
  /** 청약 정보, 주식 메타 등 느리게 바뀌는 데이터 */
  long: 3600,
} as const;
