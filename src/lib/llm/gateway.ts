/**
 * LB-1/LB-3 — LLM 호출 «단일 관문» (2026-09-08).
 *
 * ── 왜 관문인가 ─────────────────────────────────────────────────────────────
 * 실측: Anthropic 직접 호출부 55파일 중 원장(`llm_usage_logs`)을 거치는 것은 4개뿐이었다.
 * 그래서 2026-09-08 크레딧 소진 때 「48h 성공 0건」이라는 판독이 나왔지만 그건 «그 4곳» 의
 * 이야기였고, 나머지 51곳의 침묵은 아무 데도 남지 않았다.
 * 관측이 없으면 사고는 조용하다 — RULES#145 가 적은 것과 같은 병이다.
 *
 * ── 왜 fetch 호환 시그니처인가 ──────────────────────────────────────────────
 * 호출부 55곳의 응답 처리 방식이 제각각이다(`res.ok`·`res.json()`·try/catch).
 * 관문이 fetch 와 «같은 모양» 이면 호출부는 함수 이름만 바뀌고 나머지 코드는 그대로다.
 * 기계 치환이 안전해지는 지점이 여기다.
 *
 * ⛔ 쿼터 초과를 «예외로 던지지 않는다». 합성 429 Response 를 돌려주면 기존 `if (res.ok)`
 *    분기가 그대로 skip 으로 동작한다. 호출부를 한 줄도 안 고치고 1:9 가 집행된다.
 * ⛔ batch «poll»(GET /v1/messages/batches/{id})은 이 관문을 쓰지 않는다 —
 *    크레딧을 태우지 않는 조회라 원장에 넣으면 「성공 0 스트릭」 파수꾼이 눈을 잃는다.
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { callFailed, fetchJson, type FetchJsonOpts, type Outcome } from '@/lib/net/outcome';

export type LLMCategory = 'realestate' | 'stock' | 'finance' | 'infra';

export interface LLMCallCtx {
  /** 크론·라우트 이름. 원장의 `cron_name` 으로 들어간다. */
  caller: string;
  /** ⚠️ 호출부가 «명시» 한다. 경로로 추정하지 않는다 — 추정은 조용히 틀린다. */
  category: LLMCategory;
  apiKind?: 'messages' | 'batch_submit';
  siteId?: string | null;
  postId?: number | null;
  trigger?: 'cron' | 'admin' | 'api' | 'manual';
  metadata?: Record<string, unknown>;
}

/**
 * 콘텐츠 카테고리(`issue_alerts.category`·`blog_posts.category`)를 원장 카테고리로 옮긴다.
 *
 * ⚠️ economy·tax·life·general 을 «쿼터 밖» 에 두지 않는다. 1:9 의 취지는
 *    「크레딧의 9할을 부동산에」이므로, 부동산이 아닌 콘텐츠를 예외로 빼면 그 취지가 샌다.
 *    지시서가 명시하지 않은 자리라 여기에 판단을 적어 둔다 — 바꾸려면 이 줄을 고친다.
 */
export function llmCategoryOfContent(c?: string | null): LLMCategory {
  if (c === 'apt' || c === 'realestate' || c === 'unsold') return 'realestate';
  if (c === 'stock') return 'stock';
  return 'finance';
}

/**
 * 주식계열 상한. ⚠️ 내림(floor)이라 예산이 작을 때 주식 몫이 0 이 될 수 있다 —
 * 그것이 의도다. 「9할을 부동산에」가 목표이지 「1할을 주식에 보장」이 아니다.
 */
export function stockCap(budget: number, share: number): number {
  return Math.max(0, Math.floor(budget * share));
}

/** 상한에 «도달하면» 막는다(>=). 상한이 0 이면 첫 호출부터 막힌다. */
export function quotaBlocked(used: number, cap: number): boolean {
  return used >= cap;
}

/** 주식 계열 — 1:9 의 「1」. */
const STOCK_SIDE: ReadonlySet<LLMCategory> = new Set<LLMCategory>(['stock', 'finance']);

interface QuotaConfig {
  budget: number;
  stockShare: number;
  enabled: boolean;
}

let cfgCache: { at: number; cfg: QuotaConfig } | null = null;
const CFG_TTL_MS = 60_000;

async function loadConfig(): Promise<QuotaConfig> {
  if (cfgCache && Date.now() - cfgCache.at < CFG_TTL_MS) return cfgCache.cfg;
  const fallback: QuotaConfig = { budget: 200, stockShare: 0.1, enabled: true };
  try {
    const sb = getSupabaseAdmin() as any;
    const { data } = await sb.from('app_config').select('key, value').eq('namespace', 'llm');
    const m = new Map<string, any>(((data ?? []) as any[]).map((r) => [r.key, r.value]));
    const cfg: QuotaConfig = {
      budget: Number(m.get('daily_budget_calls') ?? fallback.budget),
      stockShare: Number(m.get('stock_share') ?? fallback.stockShare),
      // ⚠️ 값이 «없으면» 켜진 것으로 본다. 설정 조회 실패로 쿼터가 조용히 풀리면
      //    1:9 가 무너진 것을 아무도 모른다.
      enabled: m.get('quota_enabled') !== false,
    };
    cfgCache = { at: Date.now(), cfg };
    return cfg;
  } catch {
    return fallback;
  }
}

/** KST 자정 이후 시작. ⚠️ 롤링 24h 가 아니다 — 아래 주석이 그 이유를 든다. */
function kstDayStartIso(): string {
  const k = new Date(Date.now() + 9 * 3600_000);
  const midnightUtcMs = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()) - 9 * 3600_000;
  return new Date(midnightUtcMs).toISOString();
}

/**
 * 오늘 «실제로 크레딧을 태운» 호출 수.
 *
 * ⛔ 실패(error)를 세지 않는다. 4xx/5xx 는 과금되지 않는데, 세면 «장애가 예산을 잠근다».
 *    2026-09-08 실측이 정확히 그랬다 — 크레딧 사망기의 실패 204건이 롤링 24h 창에 남아
 *    예산 200 을 통째로 먹었고, 회복된 뒤에도 새 호출이 전부 막혔다.
 *    폭주하는 실패는 예산이 아니라 파수꾼(fn_llm_silence_watch)이 잡는 몫이다.
 * ⛔ 창을 롤링 24h 가 아니라 «KST 달력일» 로 둔다. 롤링이면 어제의 사고가 오늘을 계속
 *    잠그고, 「일 예산」이라는 말과도 어긋난다.
 * ⚠️ skipped 는 애초에 쏘지 않은 것이라 당연히 세지 않는다.
 */
async function spentToday(category?: 'stock_side' | 'all'): Promise<number> {
  try {
    const sb = getSupabaseAdmin() as any;
    const since = kstDayStartIso();
    let q = sb
      .from('llm_usage_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)
      .eq('status', 'success');
    if (category === 'stock_side') q = q.in('category', ['stock', 'finance']);
    const { count } = await q;
    return count ?? 0;
  } catch {
    // ⛔ 셀 수 없으면 «막지 않는다». 계측 실패로 생성이 멈추면 그날 콘텐츠가 통째로 사라진다.
    return 0;
  }
}

function fireLog(row: Record<string, unknown>): void {
  try {
    const sb = getSupabaseAdmin() as any;
    void sb.from('llm_usage_logs').insert(row).then(() => {}, () => {});
  } catch {
    /* 로깅 실패는 완전 silent — main flow 에 영향 0 */
  }
}

function quotaResponse(reason: string): Response {
  return new Response(JSON.stringify({ error: { type: 'kadeora_quota', message: reason } }), {
    status: 429,
    headers: { 'content-type': 'application/json', 'x-kadeora-quota': reason },
  });
}

/**
 * Anthropic 호출의 유일한 문. `fetch` 와 같은 모양이라 호출부는 이름만 바꾸면 된다.
 *
 * @example
 *   const res = await anthropicFetch('https://api.anthropic.com/v1/messages',
 *     { method: 'POST', headers, body },
 *     { caller: 'blog-stock-v2', category: 'stock' });
 *   if (res.ok) { … }   // ← 이 아래는 한 줄도 안 바뀐다
 */
export async function anthropicFetch(
  url: string,
  init: RequestInit,
  ctx: LLMCallCtx,
): Promise<Response> {
  const apiKind = ctx.apiKind ?? 'messages';
  const cfg = await loadConfig();
  const base = {
    cron_name: ctx.caller,
    trigger: ctx.trigger ?? 'cron',
    category: ctx.category,
    api_kind: apiKind,
    site_id: ctx.siteId ?? null,
    post_id: ctx.postId ?? null,
    metadata: (ctx.metadata ?? null) as any,
  };

  // ── 쿼터 (LB-3) ─────────────────────────────────────────────────────────
  if (cfg.enabled) {
    const usedAll = await spentToday('all');
    if (usedAll >= cfg.budget) {
      fireLog({
        ...base, model: 'n/a', input_tokens: 0, output_tokens: 0,
        cache_creation_tokens: 0, cache_read_tokens: 0, duration_ms: 0,
        status: 'skipped', error_code: 'quota_daily',
      });
      return quotaResponse(`일 예산 소진 ${usedAll}/${cfg.budget}`);
    }
    if (STOCK_SIDE.has(ctx.category)) {
      const cap = stockCap(cfg.budget, cfg.stockShare);
      const usedStock = await spentToday('stock_side');
      if (quotaBlocked(usedStock, cap)) {
        // ⚠️ 버려지는 것이 아니다. 이 자리를 비우면 그날 예산의 나머지가 부동산 큐 차례가 된다.
        fireLog({
          ...base, model: 'n/a', input_tokens: 0, output_tokens: 0,
          cache_creation_tokens: 0, cache_read_tokens: 0, duration_ms: 0,
          status: 'skipped', error_code: 'quota_stock',
        });
        return quotaResponse(`주식계열 몫 소진 ${usedStock}/${cap} (1:9)`);
      }
    }
  }

  // ── 실호출 ──────────────────────────────────────────────────────────────
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    fireLog({
      ...base, model: 'unknown', input_tokens: 0, output_tokens: 0,
      cache_creation_tokens: 0, cache_read_tokens: 0,
      duration_ms: Date.now() - started, status: 'error',
      error_code: `network:${String(e).slice(0, 80)}`,
    });
    throw e;
  }

  // ⚠️ body 를 여기서 읽으면 호출부가 다시 못 읽는다. 반드시 clone 을 읽는다.
  let usage: any = null;
  let model = 'unknown';
  let errCode: string | null = null;
  try {
    const peek: any = await res.clone().json();
    usage = peek?.usage ?? null;
    model = peek?.model ?? model;
    if (!res.ok) errCode = `${res.status}:${peek?.error?.type ?? 'http'}`;
  } catch {
    if (!res.ok) errCode = `${res.status}:unreadable`;
  }

  fireLog({
    ...base,
    model,
    input_tokens: Number(usage?.input_tokens ?? 0),
    output_tokens: Number(usage?.output_tokens ?? 0),
    cache_creation_tokens: Number(usage?.cache_creation_input_tokens ?? 0),
    cache_read_tokens: Number(usage?.cache_read_input_tokens ?? 0),
    duration_ms: Date.now() - started,
    status: res.ok ? 'success' : 'error',
    error_code: errCode,
  });

  return res;
}

/**
 * Messages 응답에서 text 블록을 꺼낸다. 없으면 «왜 없는지» 를 함께 돌려준다.
 *
 * ⚠️ 2026-09-09 실측 — cvn-name-watch 침묵의 진짜 사인이 여기 있었다.
 *    21:10Z 회전은 크래시하지 않았다. 200 으로 완주했고 콜도 성공(success)이었는데
 *    `output_tokens 4000 / max_tokens 4000` — thinking 이 상한을 통째로 먹어 text 블록에
 *    닿지 못했다. 입력은 6,220자뿐이었다.
 * ⛔ 그런데 로그에 남은 것은 「text 블록 없음」 한 줄이 전부였다. 그 한 줄로는
 *    「모델이 할 말이 없었다」와 「지면이 모자랐다」가 구분되지 않는다 —
 *    outcome.ts 가 세 갈래로 가른 것과 같은 병이고, 같은 처방을 쓴다.
 *    stop_reason·블록 종류·output_tokens 를 함께 적으면 다음 사고는 한 줄로 읽힌다.
 */
export function textBlockOf(body: any): { text: string | null; why: string } {
  const blocks: any[] = Array.isArray(body?.content) ? body.content : [];
  const text = blocks.find((b) => b?.type === 'text')?.text;
  if (typeof text === 'string' && text) return { text, why: '' };
  const kinds = blocks.map((b) => String(b?.type ?? '?')).join(',') || '블록 0개';
  const stop = String(body?.stop_reason ?? '?');
  const out = Number(body?.usage?.output_tokens ?? 0);
  return { text: null, why: `text 블록 없음 (stop_reason=${stop} · 블록=${kinds} · output=${out})` };
}

/** 쿼터 때문에 막힌 응답인가 — 호출부가 「모델이 거절함」과 구분하고 싶을 때 쓴다. */
export const isQuotaBlocked = (res: Response): boolean =>
  res.status === 429 && res.headers.get('x-kadeora-quota') !== null;

/**
 * 배치 «조회» 전용 문 — 원장에 적지 않고 쿼터도 걸지 않는다.
 *
 * `GET /v1/messages/batches/{id}` 와 결과 파일 다운로드는 **크레딧을 태우지 않는다**.
 * ⛔ 이걸 원장에 넣으면 「최근 6h 시도 ≥10 인데 성공 0」 파수꾼이 poll 성공을 성공으로 세어
 *    침묵을 놓친다 — 2026-09-08 크레딧 사고가 48시간 조용했던 것과 같은 실명(失明)이다.
 *
 * ⚠️ 그런데도 «이 문을 지나가게» 하는 이유는 규율을 하나로 두기 위해서다.
 *    「api.anthropic.com 을 직접 fetch 하지 않는다」 한 줄이면 CI 게이트가 성립한다.
 *    예외를 grep 패턴으로 표현하려 들면 그 패턴이 곧 구멍이 된다.
 */
export function anthropicPollFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, init);
}

/**
 * `fetchJson` 판(版) 관문 — Outcome 을 쓰는 호출부용.
 *
 * ⚠️ `fetchJson` 을 버리고 생짜 fetch 로 내리지 않는다. 그쪽에 재시도·타임아웃·상태 분류가
 *    이미 들어 있고, 그걸 잃는 것은 계측을 얻자고 신뢰성을 파는 일이다.
 *    그래서 관문이 그것을 «감싼다».
 *
 * ⛔ 쿼터 초과는 예외가 아니라 `call_failed` Outcome 이다 — 호출부의 기존
 *    `if (call.kind !== 'ok')` 분기가 그대로 skip 으로 동작한다.
 */
export async function anthropicJson<T = unknown>(
  url: string,
  init: RequestInit,
  ctx: LLMCallCtx,
  opts?: FetchJsonOpts,
): Promise<Outcome<T>> {
  const cfg = await loadConfig();
  const base = {
    cron_name: ctx.caller,
    trigger: ctx.trigger ?? 'cron',
    category: ctx.category,
    api_kind: ctx.apiKind ?? 'messages',
    site_id: ctx.siteId ?? null,
    post_id: ctx.postId ?? null,
    metadata: (ctx.metadata ?? null) as any,
  };
  const zero = {
    model: 'n/a', input_tokens: 0, output_tokens: 0,
    cache_creation_tokens: 0, cache_read_tokens: 0, duration_ms: 0,
  };

  if (cfg.enabled) {
    const usedAll = await spentToday('all');
    if (usedAll >= cfg.budget) {
      fireLog({ ...base, ...zero, status: 'skipped', error_code: 'quota_daily' });
      return callFailed<T>(429, `일 예산 소진 ${usedAll}/${cfg.budget}`);
    }
    if (STOCK_SIDE.has(ctx.category)) {
      const cap = stockCap(cfg.budget, cfg.stockShare);
      const usedStock = await spentToday('stock_side');
      if (quotaBlocked(usedStock, cap)) {
        fireLog({ ...base, ...zero, status: 'skipped', error_code: 'quota_stock' });
        return callFailed<T>(429, `주식계열 몫 소진 ${usedStock}/${cap} (1:9)`);
      }
    }
  }

  const started = Date.now();
  const out = await fetchJson<T>(url, init, opts);
  const body: any = out.kind === 'ok' ? out.value : null;
  fireLog({
    ...base,
    model: body?.model ?? 'unknown',
    input_tokens: Number(body?.usage?.input_tokens ?? 0),
    output_tokens: Number(body?.usage?.output_tokens ?? 0),
    cache_creation_tokens: Number(body?.usage?.cache_creation_input_tokens ?? 0),
    cache_read_tokens: Number(body?.usage?.cache_read_input_tokens ?? 0),
    duration_ms: Date.now() - started,
    status: out.kind === 'ok' ? 'success' : 'error',
    error_code: out.kind === 'ok' ? null : `${out.kind}:${out.status}`,
  });
  return out;
}

/**
 * SDK(`@anthropic-ai/sdk`) 판 관문.
 *
 * ⚠️ 이 경로는 URL 문자열이 코드에 없어서 «grep 으로 안 보인다». 2026-09-08 실측에서
 *    `api.anthropic.com` 으로 55곳을 셌는데 SDK 를 쓰는 `apt-summary-gen` 이 빠져 있었다 —
 *    56번째였고, 원장에도 쿼터에도 잡히지 않는 완전한 사각이었다.
 *    게이트가 SDK import 까지 보는 이유가 이것이다.
 */
export async function anthropicCreate<T = any>(
  create: (params: any) => Promise<T>,
  params: any,
  ctx: LLMCallCtx,
): Promise<T | null> {
  const cfg = await loadConfig();
  const base = {
    cron_name: ctx.caller, trigger: ctx.trigger ?? 'cron', category: ctx.category,
    api_kind: ctx.apiKind ?? 'messages', site_id: ctx.siteId ?? null,
    post_id: ctx.postId ?? null, metadata: (ctx.metadata ?? null) as any,
  };
  const zero = {
    model: String(params?.model ?? 'unknown'), input_tokens: 0, output_tokens: 0,
    cache_creation_tokens: 0, cache_read_tokens: 0, duration_ms: 0,
  };

  if (cfg.enabled) {
    const usedAll = await spentToday('all');
    if (usedAll >= cfg.budget) {
      fireLog({ ...base, ...zero, status: 'skipped', error_code: 'quota_daily' });
      return null;   // ⛔ 던지지 않는다 — 호출부의 null 처리로 자연히 skip 된다
    }
    if (STOCK_SIDE.has(ctx.category)) {
      const cap = stockCap(cfg.budget, cfg.stockShare);
      if (quotaBlocked(await spentToday('stock_side'), cap)) {
        fireLog({ ...base, ...zero, status: 'skipped', error_code: 'quota_stock' });
        return null;
      }
    }
  }

  const started = Date.now();
  try {
    const out: any = await create(params);
    fireLog({
      ...base,
      model: String(out?.model ?? params?.model ?? 'unknown'),
      input_tokens: Number(out?.usage?.input_tokens ?? 0),
      output_tokens: Number(out?.usage?.output_tokens ?? 0),
      cache_creation_tokens: Number(out?.usage?.cache_creation_input_tokens ?? 0),
      cache_read_tokens: Number(out?.usage?.cache_read_input_tokens ?? 0),
      duration_ms: Date.now() - started,
      status: 'success', error_code: null,
    });
    return out as T;
  } catch (e) {
    fireLog({
      ...base, ...zero, duration_ms: Date.now() - started,
      status: 'error', error_code: String(e).slice(0, 120),
    });
    throw e;
  }
}
