/**
 * 외부 호출의 «실패를 세 갈래로 가른다» — 오늘(2026-08-29) 네 번 같은 병을 앓고 승격한 유틸.
 *
 * ── 왜 유틸인가 ─────────────────────────────────────────────────────────────
 * 같은 형태를 하루에 네 번 만났다. 전부 «null 하나» 로 접혀 원인을 못 찾았다:
 *   ① apt-enrich-location — 카카오 403 을 「근처에 없다」와 같은 칸에. **엿새 동안 success**
 *   ② apt-geocode         — 같은 403 을 「주소를 못 찾았다」와 같은 칸에. 41/41 실패의 원인 불명
 *   ③ verify-facts        — 검색 0건 · JSON 아님 · 호출 실패가 전부 null. 추출 실패 10/20 원인 불명
 *   ④ (그 밖) `.limit()` 서버 캡 — 「데이터가 그만큼」과 「캡을 봤다」가 같은 숫자로 보였다
 * ⛔ 네 번째면 개별 수리가 아니라 «공통 문제» 다.
 *
 * ── 세 갈래 ─────────────────────────────────────────────────────────────────
 *   no_result    호출은 성공했고 «결과가 없다» — 정상이다. 재시도하지 않는다
 *   bad_json     응답은 왔는데 «읽을 수 없다» — 파서나 스펙이 틀렸다. 재시도해도 같다
 *   call_failed  «닿지 못했다»(네트워크·5xx·타임아웃) — 재시도할 값어치가 있는 유일한 갈래
 * ⚠️ 자격 실패(401·403)는 call_failed 가 «아니다». 닿았고 거부당한 것이라 bad_json 쪽,
 *    즉 «재시도 금지» 다. 그래서 status 를 함께 남긴다.
 *
 * ⛔ 기존 3곳(enrich-location · geocode · verify-facts)을 «일괄 리팩터하지 않는다».
 *    각자 다음 수정 접점에서 교체한다 — 전수 치환은 그 자체가 사고 원인이다(S4-3 교훈).
 */
export type OutcomeKind = 'ok' | 'no_result' | 'bad_json' | 'call_failed';

export interface Outcome<T> {
  kind: OutcomeKind;
  value: T | null;
  /** HTTP 상태. 0 이면 닿지도 못했다. */
  status: number;
  /** 사람이 읽을 한 줄. 로그·리포트에 그대로 나간다. ⚠️ 자격 «값» 을 담지 않는다. */
  detail: string;
}

export const ok = <T>(value: T, status = 200): Outcome<T> => ({ kind: 'ok', value, status, detail: '' });
export const noResult = <T>(status = 200, detail = '결과 없음'): Outcome<T> => ({ kind: 'no_result', value: null, status, detail });
export const badJson = <T>(status: number, detail: string): Outcome<T> => ({ kind: 'bad_json', value: null, status, detail: detail.slice(0, 160) });
export const callFailed = <T>(status: number, detail: string): Outcome<T> => ({ kind: 'call_failed', value: null, status, detail: detail.slice(0, 160) });

/** 재시도할 값어치가 있는 유일한 갈래. */
export function isRetryable(o: Outcome<unknown>): boolean {
  return o.kind === 'call_failed';
}

export interface FetchJsonOpts {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  /** 파싱된 본문에서 «결과» 를 꺼낸다. null 을 주면 no_result 로 접힌다. */
  pick?: (json: unknown) => unknown;
}

/**
 * JSON 호출 한 곳. 세 갈래로 «갈라서» 돌려준다.
 * ⚠️ 4xx 는 재시도하지 않는다 — 닿았고 거부당한 것이라 같은 답이 온다.
 */
export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit = {},
  opts: FetchJsonOpts = {},
): Promise<Outcome<T>> {
  const { timeoutMs = 10_000, retries = 1, retryDelayMs = 400, pick } = opts;
  let last: Outcome<T> = callFailed<T>(0, 'NEVER_RAN');

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, retryDelayMs * attempt));
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      const text = await res.text();

      if (!res.ok) {
        // 4xx = 닿았고 거부당했다. 재시도해도 같은 답이라 bad_json 쪽으로 접는다.
        last = res.status < 500
          ? badJson<T>(res.status, `HTTP ${res.status} ${text.replace(/\s+/g, ' ').slice(0, 120)}`)
          : callFailed<T>(res.status, `HTTP ${res.status}`);
        if (!isRetryable(last)) return last;
        continue;
      }

      let parsed: unknown;
      try { parsed = JSON.parse(text); }
      catch { return badJson<T>(res.status, `JSON 아님: ${text.replace(/\s+/g, ' ').slice(0, 120)}`); }

      const picked = pick ? pick(parsed) : parsed;
      if (picked === null || picked === undefined) return noResult<T>(res.status);
      if (Array.isArray(picked) && picked.length === 0) return noResult<T>(res.status, '빈 배열');
      return ok<T>(picked as T, res.status);
    } catch (e) {
      last = callFailed<T>(0, String(e).slice(0, 120));
    }
  }
  return last;
}

/** 여러 호출의 갈래를 세는 집계기 — 응답·cron_logs 에 그대로 싣는다. */
export function tally() {
  const counts: Record<OutcomeKind, number> = { ok: 0, no_result: 0, bad_json: 0, call_failed: 0 };
  const samples: string[] = [];
  return {
    /** ⚠️ 제네릭이라야 호출부가 값의 «타입을 잃지 않는다». */
    add<T>(o: Outcome<T>, label?: string): Outcome<T> {
      counts[o.kind]++;
      if (o.kind !== 'ok' && o.kind !== 'no_result' && samples.length < 10) {
        samples.push(`${label ? label + ' ' : ''}${o.kind}(${o.status}) ${o.detail}`);
      }
      return o;
    },
    get counts() { return { ...counts }; },
    get samples() { return [...samples]; },
  };
}
