// s225-P1: /api/track → /api/events/cta 으로 통합.
// rate limit (Redis incr) 차단으로 navigation 직후 click 이벤트가 INSERT 실패하던 회귀 fix.
// 기존 호출처 (analytics.ts trackCTA, lib/track-conversion.ts, blog 인라인 HTML 등) 자동 회복.
// /api/events/cta 는 sendBeacon (text/plain) 호환 + rate limit 없음.
export { POST } from '../events/cta/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 5;
