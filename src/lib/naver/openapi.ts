/**
 * 네이버 오픈API(openapi.naver.com — 검색·데이터랩, X-Naver-Client-Id 헤더) 공용 관문 (B4 · 2026-09-17)
 *
 * ⛔ 왜 있나 — 「관측자 없는 공유 자원」. NAVER_CLIENT_ID 하나를 18곳이 나눠 쓰는데
 *    라우트별·일별 호출 원장이 없어서 일일 쿼터를 얼마나 쓰는지 아무도 몰랐다.
 *    그래서 순위 배치 캡(get_rank_targets_due 80)을 올릴 근거도 내릴 근거도 없었다.
 *
 * 규칙(CI: scripts/naver-openapi-gate.sh)
 *   · openapi.naver.com 을 부르는 fetch 는 이 파일 밖에 두지 않는다 → naverOpenApiFetch(route, url, init).
 *   · route 는 «호출부가 명시» 한다(예: 'cron/naver-sc-sync'). 공용 lib 는 호출 라우트를 인자로 받는다.
 *   · 대상 아님: 검색광고 API(api.searchad.naver.com), Search Advisor, 블로그 글쓰기(OAuth Bearer).
 *
 * 적재 — 원장 naver_openapi_usage_daily (KST 날짜 × route × endpoint)
 *   · 호출마다 DB 를 치지 않는다. 메모리에 모았다가 요청 종료 후(after) «한 번» RPC 로 올린다.
 *     160콜 라우트도 원장 쓰기는 1회다.
 *   · ⛔ 계측 실패가 원 호출을 깨면 안 된다 — 응답·예외는 계측과 무관하게 그대로 돌려준다.
 *     원장 적재 실패는 console.error 로 «잃은 수» 까지 남긴다(조용한 0 금지).
 *   · 계기는 자기 자신을 세지 않는다 — 원장 쓰기는 Supabase 로 나가고 네이버를 치지 않는다.
 */

import { after } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const HOST = 'openapi.naver.com';

type Counter = { date: string; route: string; endpoint: string; calls: number; http_429: number; http_other_err: number };

const buffer = new Map<string, Counter>();
let flushScheduled = false;

/** KST 날짜(YYYY-MM-DD). */
export function kstDate(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** '/v1/search/news.json' → 'search/news', '/v1/datalab/search' → 'datalab/search'. */
export function naverEndpointOf(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/^\/v\d+\//, '').replace(/^\//, '');
    return path.replace(/\.(json|xml)$/i, '') || 'unknown';
  } catch {
    return 'unknown';
  }
}

function record(route: string, endpoint: string, outcome: 'ok' | '429' | 'err'): void {
  const date = kstDate();
  const key = `${date}|${route}|${endpoint}`;
  let c = buffer.get(key);
  if (!c) {
    c = { date, route, endpoint, calls: 0, http_429: 0, http_other_err: 0 };
    buffer.set(key, c);
  }
  c.calls++;
  if (outcome === '429') c.http_429++;
  else if (outcome === 'err') c.http_other_err++;
  scheduleFlush();
}

function scheduleFlush(): void {
  if (flushScheduled) return;
  flushScheduled = true;
  try {
    // 요청 스코프 안: 응답이 나간 뒤 한 번. (Vercel 은 waitUntil 로 수명을 잡는다)
    after(flushNaverOpenApiUsage);
  } catch {
    // 요청 스코프 밖(테스트·스크립트 등): 같은 틱의 호출을 모아 곧바로 올린다.
    const t = setTimeout(() => void flushNaverOpenApiUsage(), 0);
    (t as any)?.unref?.();
  }
}

/** 모인 카운터를 원장에 올린다. 실패해도 throw 하지 않는다. */
export async function flushNaverOpenApiUsage(): Promise<void> {
  flushScheduled = false;
  if (buffer.size === 0) return;
  const rows = Array.from(buffer.values());
  buffer.clear();
  try {
    const { error } = await (getSupabaseAdmin() as any).rpc('naver_openapi_usage_incr', { p_rows: rows });
    if (error) throw new Error(error.message);
  } catch (e: any) {
    console.error('[naver-openapi] 원장 적재 실패 — 아래 호출 수가 naver_openapi_usage_daily 에서 빠졌다',
      e?.message ?? e, JSON.stringify(rows));
  }
}

/**
 * openapi.naver.com 호출 관문. fetch 와 같은 시그니처에 route 만 앞에 붙는다.
 * 응답(성공·실패)과 예외는 손대지 않고 그대로 돌려준다.
 */
export async function naverOpenApiFetch(route: string, url: string, init?: RequestInit): Promise<Response> {
  let endpoint = 'unknown';
  try {
    const u = new URL(url);
    if (u.hostname !== HOST) {
      console.error(`[naver-openapi] 관문은 ${HOST} 전용이다 — 원장 없이 통과: ${u.hostname} (${route})`);
      return fetch(url, init);
    }
    endpoint = naverEndpointOf(url);
  } catch {
    /* URL 파싱 실패는 fetch 가 알아서 던진다 — 아래에서 err 로 센다 */
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    safeRecord(route, endpoint, 'err');
    throw e;
  }
  safeRecord(route, endpoint, res.ok ? 'ok' : res.status === 429 ? '429' : 'err');
  return res;
}

function safeRecord(route: string, endpoint: string, outcome: 'ok' | '429' | 'err'): void {
  try {
    record(route, endpoint, outcome);
  } catch (e: any) {
    console.error('[naver-openapi] 계측 실패(호출은 정상 진행)', route, endpoint, outcome, e?.message ?? e);
  }
}

/** 테스트 전용 — 버퍼 상태 조회. */
export function __peekNaverOpenApiBuffer(): Counter[] {
  return Array.from(buffer.values());
}
