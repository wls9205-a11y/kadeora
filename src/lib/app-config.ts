/**
 * app-config — 모든 운영 설정 통합 헬퍼
 * 
 * 원칙: 코드에 magic number 박지 말고 여기서 읽어라
 * 캐싱: 1분 (어드민 변경 즉시 반영용 짧게 설정)
 * Fallback: DB 미설정 시 defaults 사용
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin';

interface CacheEntry { value: Record<string, any>; ts: number; }
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

/**
 * Namespace별 설정 일괄 조회
 * @param namespace 'naver_cafe', 'calc_seo', 'ai_models', 'cron_limits' 등
 * @param defaults DB 미설정 시 폴백
 */
export async function getConfig<T extends Record<string, any>>(
  namespace: string,
  defaults: T
): Promise<T> {
  const cacheKey = `${namespace}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return { ...defaults, ...cached.value } as T;
  }

  try {
    const sb = getSupabaseAdmin();
    const { data } = await (sb as any)
      .from('app_config')
      .select('key, value')
      .eq('namespace', namespace);

    const dbValues: Record<string, any> = {};
    for (const row of data || []) {
      dbValues[row.key] = row.value;
    }
    cache.set(cacheKey, { value: dbValues, ts: Date.now() });
    return { ...defaults, ...dbValues } as T;
  } catch (e) {
    console.warn('[app-config] failed to load', namespace, e);
    return defaults;
  }
}

/**
 * 단일 설정 변경 (어드민 UI에서 호출)
 */
export async function setConfig(
  namespace: string,
  key: string,
  value: any,
  description?: string,
  updatedBy?: string
): Promise<void> {
  const sb = getSupabaseAdmin();
  await (sb as any).from('app_config').upsert({
    namespace,
    key,
    value,
    description: description ?? undefined,
    updated_by: updatedBy ?? undefined,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'namespace,key' });
  cache.delete(namespace);
}

/**
 * Namespace 전체 캐시 무효화
 */
export function invalidateConfig(namespace: string): void {
  cache.delete(namespace);
}

/**
 * 모든 namespace 조회 (어드민 ConfigTab용)
 */
export async function listConfig(): Promise<Record<string, Record<string, any>>> {
  const sb = getSupabaseAdmin();
  const { data } = await (sb as any).from('app_config').select('namespace, key, value, description, updated_at');
  const out: Record<string, Record<string, any>> = {};
  for (const row of data || []) {
    if (!out[row.namespace]) out[row.namespace] = {};
    out[row.namespace][row.key] = {
      value: row.value,
      description: row.description,
      updated_at: row.updated_at,
    };
  }
  return out;
}

/**
 * 자주 쓰는 ai-models 헬퍼 — 어디서나 호출 가능
 */
export async function getAIModel(tier: 'haiku' | 'sonnet' | 'opus' = 'haiku'): Promise<string> {
  const cfg = await getConfig('ai_models', {
    default_haiku: 'claude-haiku-4-5-20251001',
    default_sonnet: 'claude-sonnet-4-6',
    default_opus: 'claude-opus-4-7',
  });
  return cfg[`default_${tier}`] || cfg.default_haiku;
}

export async function shouldUsePromptCache(): Promise<boolean> {
  const cfg = await getConfig('ai_models', { use_prompt_cache: true });
  return !!cfg.use_prompt_cache;
}
