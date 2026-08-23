// V13 A-3 — 현장 진행 이력 데이터 레이어.
//
// 청약홈에도 아실에도 없는 정보다. "사직5구역, 세대수는 줄고 층수는 올랐다" —
// 그 판단의 재료가 이 이력이다.
//
// 원본은 apt_site_events. lifecycle_stage 가 바뀌면 경로와 무관하게 트리거가 자동 기록한다
// (크론·어드민·DART 어디서 바뀌든). 그래서 여기서 별도로 insert 하지 않는다.

import { getSupabaseAdmin } from '@/lib/supabase-admin';

/** 화면에 낼 이력 상한. 이보다 길어지면 타임라인이 아니라 로그가 된다. */
export const SITE_EVENT_LIMIT = 20;

export type SiteEventType = 'stage_change' | 'constructor' | 'units' | 'price' | 'note';
export type SiteEventConfidence = 'confirmed' | 'estimated' | 'rumor';

export interface AptSiteEvent {
  id: string;
  event_type: string;
  from_value: string | null;
  to_value: string | null;
  /** confirmed(고시·공시 원문) · estimated(복수 언론) · rumor(업계·조합 전언) */
  confidence: string | null;
  source: string | null;
  source_url: string | null;
  note: string | null;
  occurred_at: string;
}

/**
 * 현장 이력을 최신순으로. 없으면 빈 배열 —
 * 호출부는 length 0 이면 섹션을 아예 렌더하지 않는다 (지금은 대부분 0건이다).
 */
export async function fetchSiteEvents(
  siteId: string | null | undefined,
  limit = SITE_EVENT_LIMIT,
): Promise<AptSiteEvent[]> {
  if (!siteId) return [];
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any)
      .from('apt_site_events')
      .select('id, event_type, from_value, to_value, confidence, source, source_url, note, occurred_at')
      .eq('site_id', siteId)
      .order('occurred_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('[apt/site-events]', JSON.stringify(error));
      return [];
    }
    return (data ?? []) as AptSiteEvent[];
  } catch (e: any) {
    console.error('[apt/site-events] caught:', e?.message ?? String(e));
    return [];
  }
}

/**
 * G-1 — 광고 랜딩에서는 confirmed 만 남긴다.
 * 미확인 정보가 리드폼과 같은 화면에 있으면 표시·광고법 문제로 직결되고,
 * 네이버 검색광고 심사는 광고 내용과 랜딩 일치를 본다. 심사 반려 한 번이면 계정이 묶인다.
 */
export function confirmedOnly(events: AptSiteEvent[]): AptSiteEvent[] {
  return events.filter((e) => (e.confidence ?? 'confirmed') === 'confirmed');
}
