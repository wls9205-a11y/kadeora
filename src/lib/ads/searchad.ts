/**
 * 네이버 검색광고 API — 서명·URL «구성만» 한다 (U-3층 ⑤).
 *
 * ⛔ 이 트랙의 범위는 «읽기» 뿐이다. 캠페인·그룹·키워드·입찰을 «바꾸는» 호출은
 *    P4(9/11) 소관이라 여기에 만들지 않는다 — 만들어 두면 언젠가 눌린다.
 *
 * ⚠️ RULES#143. 판정·구성은 여기, 호출과 출력은 scripts/라우트가 한다.
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

// ── StatReport (2026-08-29 실측 확정 · R-3) ─────────────────────────────────
/**
 * ⚠️ 지시서 §2-3 의 추정 셋이 실호출에서 전부 뒤집혔다:
 *   ① `ids` 는 JSON 배열이 «아니다» — ["nkw-…"] 는 400(11001). bare 쉼표구분이라야 200.
 *   ② `id`(단수)와 `ids`(복수)는 «다른 API» 다.
 *        id=  → 일자별 행 · 키워드 하나뿐(5,974 호출/일)
 *        ids= → 키워드별 «기간 합계» · timeIncrement 미지원
 *      ⛔ 그대로 쓰면 둘 다 못 쓴다. «기간을 하루로 좁히면 합계가 곧 일별 행» 이 된다.
 *   ③ 배치 한도는 «개수» 가 아니라 «URI 길이» 다 — 전량(5,974)은 414 URI Too Long.
 *
 * ⚠️ 그리고 ids 는 «노출 0 인 키워드의 행을 아예 주지 않는다»(100개 요청 → 26행).
 *    「행이 없다」는 «수집 실패가 아니다». 이 시스템의 API 들은 부재를 0 이 아니라
 *    «무행» 으로 말한다 — NO_CODE · EMPTY_BODY 에 이어 세 번째 동형이다.
 */
export const STATS_PATH = '/stats';
export const STATS_FIELDS = ['impCnt', 'clkCnt', 'salesAmt', 'ctr', 'cpc', 'avgRnk'] as const;
/** URI 여유. 300개(≈8.6KB)까지 200 을 확인했고, 그 아래로 잡아 둔다. */
export const STATS_URI_BUDGET = 6000;

/** 키워드 ID 를 «URI 길이» 로 끊는다. 개수로 끊으면 ID 형식이 바뀔 때 조용히 414 가 난다. */
export function chunkIdsByUri(ids: string[], budget = STATS_URI_BUDGET): string[][] {
  const out: string[][] = [];
  let cur: string[] = [];
  let len = 0;
  for (const id of ids) {
    const add = id.length + 1; // 쉼표 한 자
    if (cur.length && len + add > budget) { out.push(cur); cur = []; len = 0; }
    cur.push(id); len += add;
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * 하루치 배치 URL. ⚠️ 쉼표를 «인코딩하지 않는다» — 실호출로 통과를 확인한 형태 그대로다.
 * nkw- ID 는 영숫자+하이픈이라 그대로 실어도 안전하다.
 */
export function buildStatsUrl(ids: string[], date: string, fields: readonly string[] = STATS_FIELDS): string {
  const f = encodeURIComponent(JSON.stringify([...fields]));
  const tr = encodeURIComponent(JSON.stringify({ since: date, until: date }));
  return `${SEARCHAD_BASE}${STATS_PATH}?ids=${ids.join(',')}&fields=${f}&timeRange=${tr}`;
}

export interface AdStatRow {
  keyword_id: string;
  stat_date: string;
  imp_cnt: number;
  clk_cnt: number;
  sales_amt: number;
  ctr: number | null;
  cpc: number | null;
  avg_rnk: number | null;
  raw: Record<string, unknown>;
}

const int = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
};
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * 응답 → 적재 행. 판정 하나를 여기서 한다:
 * ⛔ 클릭 > 노출인 행은 «버리지 않고 갈라 낸다». DB 제약이 어차피 막지만,
 *    막힌 이유가 「어느 키워드였는지」 없이 UPSERT_FAIL 로만 남으면 원인을 못 찾는다.
 */
export function parseStatRows(body: string, date: string): { rows: AdStatRow[]; bad: string[]; parsed: boolean } {
  let j: { data?: unknown };
  try { j = JSON.parse(body); } catch { return { rows: [], bad: [], parsed: false }; }
  if (!Array.isArray(j?.data)) return { rows: [], bad: [], parsed: false };
  const rows: AdStatRow[] = [];
  const bad: string[] = [];
  for (const r of j.data as Array<Record<string, unknown>>) {
    const id = typeof r.id === 'string' ? r.id : '';
    if (!id) continue;
    const imp = int(r.impCnt), clk = int(r.clkCnt);
    if (clk > imp) { bad.push(`${id}:clk${clk}>imp${imp}`); continue; }
    rows.push({
      keyword_id: id,
      stat_date: date,
      imp_cnt: imp,
      clk_cnt: clk,
      sales_amt: int(r.salesAmt),
      ctr: num(r.ctr),
      cpc: num(r.cpc),
      avg_rnk: num(r.avgRnk),
      raw: r,
    });
  }
  return { rows, bad, parsed: true };
}

/**
 * 호출 한 곳. ⛔ 자격 실패(401·403)는 재시도하지 «않는다» — 같은 답이 오고 시간만 태운다.
 * ⚠️ 게이트와 크론이 «다른 규칙» 으로 부르면 게이트 결과가 크론을 대변하지 못한다.
 */
export async function fetchSearchAd(
  cred: SearchAdCred,
  method: string,
  path: string,
  query = '',
  opts: { retries?: number; throttleMs?: number; timeoutMs?: number } = {},
): Promise<SearchAdEnvelope & { calls: number }> {
  const retries = opts.retries ?? 2;
  const throttle = opts.throttleMs ?? SEARCHAD_THROTTLE_MS;
  const timeout = opts.timeoutMs ?? 20000;
  let calls = 0;
  let last: SearchAdEnvelope = { ok: false, status: 0, code: 'FETCH_FAIL', body: '' };
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (calls > 0 || attempt > 0) await new Promise((r) => setTimeout(r, throttle));
    calls++;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeout);
    try {
      const res = await fetch(SEARCHAD_BASE + path + (query ? `?${query}` : ''), {
        method,
        headers: searchAdHeaders(cred, method, path),
        signal: ac.signal,
      });
      const body = await res.text();
      last = { ok: res.ok, status: res.status, code: classifyStatus(res.status), body };
    } catch (e) {
      last = { ok: false, status: 0, code: 'FETCH_FAIL', body: String(e).slice(0, 200) };
    } finally {
      clearTimeout(t);
    }
    if (last.ok || !isRetryable(last.code)) break;
  }
  return { ...last, calls };
}

/** 자격을 env 에서 «읽기만» 한다. 값을 로그로 흘리지 않는다. */
export function credFromEnv(env: NodeJS.ProcessEnv = process.env): SearchAdCred {
  return {
    apiKey: env.SEARCHAD_API_KEY ?? '',
    secret: env.SEARCHAD_SECRET ?? '',
    customerId: env.SEARCHAD_CUSTOMER_ID ?? '',
  };
}
