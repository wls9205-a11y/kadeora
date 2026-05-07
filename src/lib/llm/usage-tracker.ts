// s239 Phase 0: LLM 사용량 추적 wrapper.
// fire-and-forget 로깅 — main flow 영향 0. 로깅 실패는 silent.
//
// 두 가지 진입점:
//   1) trackedAnthropicCreate(client, params, ctx) — @anthropic-ai/sdk 기반 caller
//   2) logAnthropicUsage(row) — fetch 기반 caller (기존 cron 다수가 직접 fetch 사용)

import type Anthropic from '@anthropic-ai/sdk';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type LLMTrackingContext = {
  cron_name: string;
  trigger?: 'cron' | 'admin' | 'api' | 'manual';
  metadata?: Record<string, any>;
};

interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface LogRow {
  cron_name: string;
  trigger: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  duration_ms: number;
  status: 'success' | 'error';
  error_code: string | null;
  metadata: Record<string, any> | null;
}

function fireLog(row: LogRow) {
  try {
    const sb = getSupabaseAdmin() as any;
    // 비동기, 결과 무시. main flow 와 분리 — promise reject 가 최상단으로 새지 않게 catch.
    void sb.from('llm_usage_logs').insert(row).then(
      () => {},
      () => {},
    );
  } catch {
    // 로깅 실패는 완전 silent
  }
}

/**
 * @anthropic-ai/sdk 의 messages.create 를 감싸 사용량을 자동 기록.
 * fire-and-forget — 실패해도 LLM 응답은 그대로 반환.
 */
export async function trackedAnthropicCreate(
  client: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming,
  context: LLMTrackingContext,
): Promise<Anthropic.Message> {
  const start = Date.now();
  let result: Anthropic.Message;
  try {
    result = await client.messages.create(params);
  } catch (err: any) {
    fireLog({
      cron_name: context.cron_name,
      trigger: context.trigger ?? 'cron',
      model: String(params.model),
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_tokens: 0,
      cache_read_tokens: 0,
      duration_ms: Date.now() - start,
      status: 'error',
      error_code: String(err?.status || err?.code || 'unknown'),
      metadata: { ...(context.metadata || {}), max_tokens: params.max_tokens },
    });
    throw err;
  }

  const usage = (result.usage || {}) as AnthropicUsage;
  fireLog({
    cron_name: context.cron_name,
    trigger: context.trigger ?? 'cron',
    model: String(params.model),
    input_tokens: usage.input_tokens || 0,
    output_tokens: usage.output_tokens || 0,
    cache_creation_tokens: usage.cache_creation_input_tokens || 0,
    cache_read_tokens: usage.cache_read_input_tokens || 0,
    duration_ms: Date.now() - start,
    status: 'success',
    error_code: null,
    metadata: { ...(context.metadata || {}), max_tokens: params.max_tokens },
  });

  return result;
}

/**
 * fetch 기반 caller 용 — 기존 fetch 호출 후 응답에서 usage 만 뽑아 로깅.
 * 호출 예 (issue-draft 등):
 *   const start = Date.now();
 *   const res = await fetch(ANTHROPIC_API, {...});
 *   const data = await res.json();
 *   logAnthropicUsage({
 *     cron_name: 'issue-draft', model: MODEL,
 *     usage: data?.usage,
 *     duration_ms: Date.now() - start,
 *     status: res.ok ? 'success' : 'error',
 *     error_code: res.ok ? null : String(res.status),
 *   });
 */
export function logAnthropicUsage(args: {
  cron_name: string;
  trigger?: LLMTrackingContext['trigger'];
  model: string;
  usage?: AnthropicUsage | null;
  duration_ms: number;
  status: 'success' | 'error';
  error_code?: string | null;
  metadata?: Record<string, any>;
}) {
  const u = args.usage || {};
  fireLog({
    cron_name: args.cron_name,
    trigger: args.trigger ?? 'cron',
    model: args.model,
    input_tokens: u.input_tokens || 0,
    output_tokens: u.output_tokens || 0,
    cache_creation_tokens: u.cache_creation_input_tokens || 0,
    cache_read_tokens: u.cache_read_input_tokens || 0,
    duration_ms: args.duration_ms,
    status: args.status,
    error_code: args.error_code ?? null,
    metadata: args.metadata ?? null,
  });
}
