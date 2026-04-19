/**
 * 이미지 URL sanitizer — 서버 컴포넌트 안전 (onError 이벤트 핸들러 금지).
 *
 * 세션 140 P1 배경:
 *  - 01adc843 (revert 됨) 에서 server component 에 onError={(e)=>...} 붙여 RSC 빌드 실패
 *  - DB 일괄 UPDATE 중 빌드 트리거 → static HTML 에 에러 상태 베이킹 → /blog /stock 500
 *
 * 대안:
 *  - DB 건드리지 않고 **서버 렌더 시점에 URL 화이트리스트 필터** 적용
 *  - 안전 호스트 아니면 /api/og 로 치환 (브라우저 onerror 필요 없음)
 */

export const SAFE_IMG_HOSTS: readonly string[] = [
  '/api/og',
  'kadeora.app',
  'supabase.co',
  'vercel-storage.com',
  'upload.wikimedia.org',
];

export function isSafeImg(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith('/api/og')) return true;
  return SAFE_IMG_HOSTS.some((d) => url.includes(d));
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
