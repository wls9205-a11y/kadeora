/**
 * 계산기 결과 영구 URL 시스템
 * 
 * SEO 핵심 무기: 사용자가 계산하면 결과를 영구 URL로 저장 → 카카오톡 공유 시 OG 이미지로 결과값 노출 → 자연 백링크
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { customAlphabet } from 'nanoid';

// ambiguous 문자 (0/O, 1/l/I) 제외
const nanoid = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 8);

export interface CalcResultPayload {
  calcSlug: string;
  calcCategory: string;
  inputs: Record<string, any>;
  result: any;  // CalcResult 형태 (main + details)
  userId?: string | null;
  refererDomain?: string | null;
  userAgentBrief?: string | null;
}

/**
 * 결과 저장 → short_id 반환
 */
export async function saveCalcResult(p: CalcResultPayload): Promise<string> {
  const sb = getSupabaseAdmin();

  // 충돌 회피: 최대 5번 재시도
  for (let attempt = 0; attempt < 5; attempt++) {
    const shortId = nanoid();
    try {
      const { error } = await (sb as any).from('calc_results').insert({
        short_id: shortId,
        calc_slug: p.calcSlug,
        calc_category: p.calcCategory,
        inputs: p.inputs,
        result: p.result,
        user_id: p.userId || null,
        referer_domain: p.refererDomain || null,
        user_agent_brief: p.userAgentBrief?.slice(0, 200) || null,
      });
      if (!error) return shortId;
      if (error.code !== '23505') {  // PK 충돌 외 에러
        throw error;
      }
    } catch (e: any) {
      if (e?.code !== '23505') throw e;
    }
  }
  throw new Error('Failed to generate unique short_id after 5 attempts');
}

/**
 * 결과 조회
 */
export async function getCalcResult(shortId: string): Promise<{
  short_id: string;
  calc_slug: string;
  calc_category: string;
  inputs: Record<string, any>;
  result: any;
  view_count: number;
  share_count: number;
  created_at: string;
} | null> {
  const sb = getSupabaseAdmin();
  const { data } = await (sb as any).from('calc_results')
    .select('short_id, calc_slug, calc_category, inputs, result, view_count, share_count, created_at')
    .eq('short_id', shortId)
    .maybeSingle();
  return data || null;
}

/**
 * 인기 결과 조회 (사이트맵, "다른 사람들의 결과" 위젯용)
 */
export async function getPopularResults(opts: {
  calcSlug?: string;
  limit?: number;
  minViewCount?: number;
}): Promise<Array<{
  short_id: string;
  calc_slug: string;
  calc_category: string;
  result: any;
  view_count: number;
  created_at: string;
}>> {
  const sb = getSupabaseAdmin();
  let q = (sb as any).from('calc_results')
    .select('short_id, calc_slug, calc_category, result, view_count, created_at')
    .gte('view_count', opts.minViewCount ?? 5)
    .gt('expires_at', new Date().toISOString())
    .order('view_count', { ascending: false })
    .limit(opts.limit ?? 10);
  if (opts.calcSlug) q = q.eq('calc_slug', opts.calcSlug);
  const { data } = await q;
  return data || [];
}

/**
 * Referer 도메인 추출 (분석용)
 */
export function extractRefererDomain(headerValue: string | null | undefined): string | null {
  if (!headerValue) return null;
  try {
    const u = new URL(headerValue);
    return u.hostname;
  } catch {
    return null;
  }
}
