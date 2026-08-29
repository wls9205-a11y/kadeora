/**
 * 네이버 검색광고 API — 서명·URL «구성만» 한다 (U-3층 ⑤).
 *
 * ⛔ 이 트랙의 범위는 «읽기» 뿐이다. 캠페인·그룹·키워드·입찰을 «바꾸는» 호출은
 *    P4(9/11) 소관이라 여기에 만들지 않는다 — 만들어 두면 언젠가 눌린다.
 *
 * ⚠️ Rule #116. 판정·구성은 여기, 호출과 출력은 scripts/라우트가 한다.
 *    이 파일이 실행되는 첫 순간은 «키가 들어온 뒤» 라, 여기서 깨지면 가장 비싸다.
 *
 * ── 서명 (8/26 검증 패턴) ──────────────────────────────────────────────────
 *   message   = `${timestamp}.${METHOD}.${PATH}`     ⚠️ PATH 는 «쿼리스트링 제외»
 *   signature = base64( HMAC-SHA256(message, SECRET) )
 *   헤더        X-Timestamp · X-API-KEY · X-Customer · X-Signature
 */
import { createHmac } from 'node:crypto';

export const SEARCHAD_BASE = 'https://api.searchad.naver.com';

export interface SearchAdCred {
  apiKey: string;
  secret: string;
  customerId: string;
}

export interface SearchAdEnvelope {
  ok: boolean;
  status: number;
  /** 실패 원인 분류 — 「서명이 틀렸다」와 「권한이 없다」와 「경로가 없다」는 다른 사실이다. */
  code: 'OK' | 'SIGNATURE' | 'FORBIDDEN' | 'NOT_FOUND' | 'RATE_LIMIT' | 'SERVER' | 'FETCH_FAIL' | 'UNKNOWN';
  body: string;
}

/**
 * 서명 원문. ⚠️ 쿼리스트링을 «넣지 않는다» — 넣으면 같은 경로가 파라미터마다
 * 다른 서명을 만들어 401 이 나고, 그때 「키가 틀렸다」로 오독하게 된다.
 */
export function signatureMessage(timestamp: string, method: string, path: string): string {
  const p = path.split('?')[0];
  return `${timestamp}.${method.toUpperCase()}.${p}`;
}

export function signSearchAd(secret: string, timestamp: string, method: string, path: string): string {
  return createHmac('sha256', secret).update(signatureMessage(timestamp, method, path)).digest('base64');
}

export function searchAdHeaders(
  cred: SearchAdCred,
  method: string,
  path: string,
  now = Date.now(),
): Record<string, string> {
  const timestamp = String(now);
  return {
    'X-Timestamp': timestamp,
    'X-API-KEY': cred.apiKey,
    'X-Customer': String(cred.customerId),
    'X-Signature': signSearchAd(cred.secret, timestamp, method, path),
    'Content-Type': 'application/json; charset=UTF-8',
  };
}

/**
 * 자격 3종을 «읽기만» 하고 모양을 본다.
 * ⚠️ 값을 돌려주지 않는다. 로그·리포트에 평문이 새는 경로를 애초에 만들지 않는다(§6).
 */
export function describeCred(cred: Partial<SearchAdCred>): { ready: boolean; note: string } {
  const miss = (['apiKey', 'secret', 'customerId'] as const).filter((k) => !cred[k]);
  if (miss.length) return { ready: false, note: `누락: ${miss.join(', ')}` };
  const bad: string[] = [];
  if (!/^[0-9a-f]{32,}$/i.test(cred.apiKey!)) bad.push('apiKey 형식(hex 아님)');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cred.secret!)) bad.push('secret 형식(base64 아님)');
  if (!/^\d+$/.test(cred.customerId!)) bad.push('customerId 형식(숫자 아님)');
  // ⚠️ 스크린샷 경유 전사에서 흔한 사고 — I/l · O/0 혼동은 «형식» 으로만 잡힌다.
  return bad.length
    ? { ready: false, note: `모양 이상 — ${bad.join(' · ')} (전사 오류 의심)` }
    : { ready: true, note: `apiKey ${cred.apiKey!.length}자 · secret ${cred.secret!.length}자 · customer ${cred.customerId!.length}자리` };
}

/** HTTP 상태를 «사실» 로 분류한다. 코드를 세기만 하면 무엇이었는지 모른다. */
export function classifyStatus(status: number): SearchAdEnvelope['code'] {
  if (status >= 200 && status < 300) return 'OK';
  if (status === 401) return 'SIGNATURE';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 429) return 'RATE_LIMIT';
  if (status >= 500) return 'SERVER';
  return 'UNKNOWN';
}

/** 재시도할 값어치가 있는 것만. ⛔ 401·403 은 재시도하지 않는다 — 같은 답이 온다. */
const RETRYABLE = new Set<SearchAdEnvelope['code']>(['RATE_LIMIT', 'SERVER', 'FETCH_FAIL']);
export const SEARCHAD_THROTTLE_MS = 250;

export function isRetryable(code: SearchAdEnvelope['code']): boolean {
  return RETRYABLE.has(code);
}

/** 절대 URL. path 는 서명과 «같은 문자열» 을 써야 한다(쿼리는 여기서만 붙인다). */
export function searchAdUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const u = new URL(path, SEARCHAD_BASE);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== '') u.searchParams.set(k, String(v));
  }
  return u.toString();
}

/** YYYY-MM-DD (KST 기준). 전일 확정치를 부르므로 날짜 경계가 어긋나면 하루가 빈다. */
export function kstDate(d = new Date(), offsetDays = 0): string {
  const kst = new Date(d.getTime() + 9 * 3600_000 + offsetDays * 86_400_000);
  return kst.toISOString().slice(0, 10);
}

/** 최근 N일(오늘 포함) — 전일 데이터는 익일 확정되므로 기본 3일 재수집한다. */
export function recentDates(days = 3, now = new Date()): string[] {
  return Array.from({ length: days }, (_, i) => kstDate(now, -i)).reverse();
}
