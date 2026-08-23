/**
 * 세션 146 — User-Agent 기반 봇 분류.
 * middleware.ts 수정 금지 (CSP 충돌) — page_views INSERT 지점에서 직접 호출.
 *
 * [S10-1] 정본 규약: 사람 = bot_type === 'human'. 빈 문자열/NULL 을 사람으로 판정하는 코드·뷰를 새로 만들지 말 것.
 *   이 함수는 사람에게도 반드시 문자열 'human' 을 기록한다 (아래 두 return 지점).
 *   어드민 뷰가 COALESCE(bot_type,'')='' 를 사람으로 보다가 7일 사람 PV 544건을 0으로 표시한 사고가 있었다.
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
