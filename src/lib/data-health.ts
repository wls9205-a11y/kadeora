import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { cache } from 'react';

/**
 * data_contracts · data_health 기반 섹션 차단 조회.
 *
 * 계약이 깨진(ok=false) 항목 중 is_blocking 인 것의 ui_section 집합을 돌려준다.
 * 소비처는 P5·P6 에서 해당 블록이 생길 때 붙인다 — 여기서는 함수만 제공한다.
 *
 * fail-open: 감시가 고장나도 사이트가 비면 안 된다. 조회 실패는 빈 집합이다.
 */
export const getUnhealthySections = cache(async (): Promise<Set<string>> => {
  try {
    const { data } = await (getSupabaseAdmin() as any)
      .from('data_health')
      .select('key, ok, data_contracts!inner(ui_section, is_blocking)')
      .eq('ok', false);
    return new Set(
      (data ?? [])
        .filter((r: any) => r.data_contracts?.is_blocking && r.data_contracts?.ui_section)
        .map((r: any) => r.data_contracts.ui_section as string),
    );
  } catch {
    return new Set();
  }
});

export async function isSectionHealthy(section: string): Promise<boolean> {
  return !(await getUnhealthySections()).has(section);
}
