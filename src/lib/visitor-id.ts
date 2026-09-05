/**
 * 방문자 식별자 정본 — kd_vid 1st-party 쿠키.
 *
 * ── 왜 이 파일이 생겼나 (SU B-1 · 2026-09-05) ────────────────────────────────
 * 저장이 «두 벌» 이었다.
 *   · analytics.ts   → localStorage `kd_visitor_id` (crypto.randomUUID) → user_events
 *   · cta-track.ts   → cookie      `kd_vid`         (base36-rand)       → conversion_events
 * 그래서 같은 사람이 표마다 다른 id 를 갖고, 무엇보다 «서버가 둘 다 못 읽었다».
 * 그 막다른 골목에서 auth/callback 은 손에 있던 유일한 식별자, 즉 user.id 를
 * visitor_id 자리에 넣었다 — 최근 14일 cta_complete 11/11 이 UUID 인 오염의 발원지다.
 * 식별자를 쿠키로 올리면 서버가 읽을 수 있고, 그러면 그 자리를 메울 이유가 사라진다.
 *
 * 정본 = 쿠키. 승격 순서는 «기존 값 보존» 이 목적이다:
 *   쿠키 → localStorage kd_vid → localStorage kd_visitor_id → (최후) 새 값
 * localStorage 두 키에 계속 미러링한다 — 구버전 탭이 아직 그 키를 읽는다.
 *
 * ⛔ 새 id 를 UUID 로 만들지 않는다. user.id 도 UUID 라서, 오염 재발을 «형태로»
 *    가려낼 수 있는 성질을 잃는다. base36-rand 는 그 자체가 판별자다.
 */
export const VISITOR_COOKIE = 'kd_vid';
const LS_KEY = 'kd_vid';
const LS_LEGACY_KEY = 'kd_visitor_id';
const ONE_YEAR = 60 * 60 * 24 * 365;

function readCookie(name: string): string {
  if (typeof document === 'undefined') return '';
  try {
    const hit = document.cookie.split('; ').find((c) => c.startsWith(name + '='));
    return hit ? decodeURIComponent(hit.split('=')[1] || '') : '';
  } catch { return ''; }
}

function writeCookie(name: string, value: string): void {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${ONE_YEAR}; Path=/; SameSite=Lax`;
  } catch { /* 쿠키 차단 환경 */ }
}

function lsGet(key: string): string {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* 차단 환경 */ }
}

function mint(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 방문자 id. 없으면 승격·발급하고 쿠키·localStorage 양쪽에 남긴다. 실패는 빈 문자열. */
export function getVisitorId(): string {
  if (typeof document === 'undefined') return '';
  const id = readCookie(VISITOR_COOKIE) || lsGet(LS_KEY) || lsGet(LS_LEGACY_KEY) || mint();
  if (!id) return '';
  if (readCookie(VISITOR_COOKIE) !== id) writeCookie(VISITOR_COOKIE, id);
  if (lsGet(LS_KEY) !== id) lsSet(LS_KEY, id);
  if (lsGet(LS_LEGACY_KEY) !== id) lsSet(LS_LEGACY_KEY, id);
  return id;
}
