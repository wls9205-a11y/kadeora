/**
 * 이미지 URL sanitizer — 서버 컴포넌트 안전 (onError 이벤트 핸들러 금지).
 *
 * 세션 142 P0: 화이트리스트 → 블랙리스트 전환.
 *  - 이전(세션 140 P1): SAFE_IMG_HOSTS 화이트리스트 → DB 의 legitimate 외부 CDN 이미지
 *    (imgnews.naver / pstatic / lottecastle 등 수만건) 전부 /api/og 로 치환 → 사용자 불만
 *  - 현재(세션 142): 알려진 문제 호스트만 block, 나머지 https 는 통과
 *
 * 서버 컴포넌트 원칙 유지:
 *  - JSX onError={...} 금지 (세션 140 교훈)
 *  - URL 문자열 레벨 필터만 (순수 함수)
 */

// 명시적으로 차단할 호스트 (스팸 / 관련 없는 공공기관 / 깨진 도메인).
// 추가 발견 시 여기에만 append.
export const BLOCKED_IMG_HOSTS: readonly string[] = [
  'hc.go.kr', // 합천군청 (apt_complex 이미지에 잘못 들어감)
];

// 패턴 기반 차단 (http 혼합 콘텐츠 등).
const BLOCKED_PATTERNS: readonly RegExp[] = [
  /^http:\/\//i, // Next.js https 강제
];

export function isSafeImg(url: string | null | undefined): boolean {
  if (!url) return false;

  // 블랙리스트 체크
  if (BLOCKED_IMG_HOSTS.some((d) => url.includes(d))) return false;
  if (BLOCKED_PATTERNS.some((p) => p.test(url))) return false;

  // 자체 경로 (/api/og, /images/* 등) 허용
  if (url.startsWith('/')) return true;

  // https URL 허용 (외부 CDN 포함)
  if (url.startsWith('https://')) return true;

  return false;
}

export function safeImg(
  url: string | null | undefined,
  fallback: { title: string; category?: string; design?: number; subtitle?: string },
): string {
  if (isSafeImg(url)) return url!;
  const t = encodeURIComponent(fallback.title || '카더라');
  const c = fallback.category || 'blog';
  const d = fallback.design ?? 2;
  const sub = fallback.subtitle ? `&subtitle=${encodeURIComponent(fallback.subtitle)}` : '';
  return `/api/og?title=${t}&category=${c}&design=${d}${sub}`;
}
