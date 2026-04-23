/**
 * 세션 146 — User-Agent 기반 봇 분류.
 * middleware.ts 수정 금지 (CSP 충돌) — page_views INSERT 지점에서 직접 호출.
 */
export type BotType = 'yeti' | 'googlebot' | 'bingbot' | 'naver' | 'daum' | 'other' | 'human';

export function classifyBot(userAgent: string | null | undefined): BotType {
  if (!userAgent) return 'human';
  const ua = userAgent.toLowerCase();
  if (/yeti/.test(ua)) return 'yeti';
  if (/googlebot|google-inspectiontool|storebot-google/.test(ua)) return 'googlebot';
  if (/bingbot|bingpreview|msnbot/.test(ua)) return 'bingbot';
  if (/naverbot|naver-searchadvisor|navercorp/.test(ua)) return 'naver';
  if (/daumoa|daumcrawler|daumapp/.test(ua)) return 'daum';
  if (/bot|crawler|spider|slurp|applebot|facebot|twitterbot|linkedinbot|ahrefsbot|semrushbot|dotbot|petalbot|yandex|baiduspider|kakaotalk-scrap|seznambot/.test(ua)) return 'other';
  return 'human';
}
