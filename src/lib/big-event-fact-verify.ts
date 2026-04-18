/**
 * [FACT-VERIFIER] big_event_registry 팩트 신뢰도 점수
 *
 * 점수 산정 (0-100):
 *  - fact_sources ≥ 3                    : +30
 *  - 최근 30일 news_detected ≥ 2건        : +20
 *  - stage_updated_at < 180일             : +20
 *  - constructor_status='confirmed'       : +20
 *  - constructor_status='likely'          : +10
 *  - new_brand_name != NULL               : +10
 *  - 기타                                  : 0 (base 50 이하로 떨어질 수 있음)
 *
 * 60 미만 이벤트는 Pillar/Spoke 자동 발행 차단 (publish gate).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface FactConfidenceBreakdown {
  event_id: number;
  score: number;
  fact_sources_count: number;
  recent_news_30d: number;
  stage_age_days: number | null;
  constructor_status: string | null;
  new_brand_name: string | null;
  reasons: string[];
}

export const FACT_CONFIDENCE_PUBLISH_MIN = 60;

export async function computeFactConfidence(
  sb: SupabaseClient,
  eventId: number,
): Promise<FactConfidenceBreakdown | null> {
  const { data: event } = await (sb as any)
    .from('big_event_registry')
    .select('id, stage_updated_at, constructor_status, new_brand_name, fact_sources')
    .eq('id', eventId)
    .maybeSingle();
  if (!event) return null;

  const factSources: string[] = Array.isArray(event.fact_sources) ? event.fact_sources : [];
  const factSourcesCount = factSources.filter((s) => typeof s === 'string' && s.length > 0).length;

  // 최근 30일 news_detected
  const since30d = new Date(Date.now() - 30 * 24 * 3600000).toISOString();
  const { count: recentNewsCount } = await (sb as any)
    .from('big_event_milestones')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('milestone_type', 'news_detected')
    .gte('created_at', since30d);

  const recentNews = typeof recentNewsCount === 'number' ? recentNewsCount : 0;

  // stage_updated_at 최신도
  let stageAgeDays: number | null = null;
  if (event.stage_updated_at) {
    const diff = Date.now() - new Date(event.stage_updated_at).getTime();
    stageAgeDays = Math.round(diff / (24 * 3600000));
  }

  let score = 0;
  const reasons: string[] = [];

  if (factSourcesCount >= 3) {
    score += 30;
    reasons.push(`fact_sources≥3(+30)`);
  } else if (factSourcesCount >= 1) {
    score += factSourcesCount * 5;
    reasons.push(`fact_sources=${factSourcesCount}(+${factSourcesCount * 5})`);
  }

  if (recentNews >= 2) {
    score += 20;
    reasons.push(`news30d≥2(+20)`);
  } else if (recentNews === 1) {
    score += 8;
    reasons.push(`news30d=1(+8)`);
  }

  if (stageAgeDays !== null && stageAgeDays < 180) {
    score += 20;
    reasons.push(`stage<180d(+20)`);
  } else if (stageAgeDays !== null && stageAgeDays < 365) {
    score += 8;
    reasons.push(`stage<365d(+8)`);
  }

  if (event.constructor_status === 'confirmed') {
    score += 20;
    reasons.push(`constructor=confirmed(+20)`);
  } else if (event.constructor_status === 'likely') {
    score += 10;
    reasons.push(`constructor=likely(+10)`);
  }

  if (event.new_brand_name && String(event.new_brand_name).trim().length > 0) {
    score += 10;
    reasons.push(`brand✓(+10)`);
  }

  score = Math.max(0, Math.min(100, score));

  return {
    event_id: eventId,
    score,
    fact_sources_count: factSourcesCount,
    recent_news_30d: recentNews,
    stage_age_days: stageAgeDays,
    constructor_status: event.constructor_status || null,
    new_brand_name: event.new_brand_name || null,
    reasons,
  };
}

/**
 * 전체 big_event_registry의 fact_confidence_score를 일괄 갱신.
 * 반환: { updated, failed, rows }
 */
export async function refreshAllFactConfidence(sb: SupabaseClient): Promise<{
  updated: number;
  failed: number;
  rows: { id: number; score: number; reasons: string[] }[];
}> {
  const { data: events } = await (sb as any)
    .from('big_event_registry')
    .select('id')
    .eq('is_active', true);

  const rows: { id: number; score: number; reasons: string[] }[] = [];
  let updated = 0;
  let failed = 0;

  for (const row of (events || []) as { id: number }[]) {
    try {
      const breakdown = await computeFactConfidence(sb, row.id);
      if (!breakdown) {
        failed++;
        continue;
      }
      const { error } = await (sb as any)
        .from('big_event_registry')
        .update({ fact_confidence_score: breakdown.score, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) {
        failed++;
      } else {
        updated++;
        rows.push({ id: row.id, score: breakdown.score, reasons: breakdown.reasons });
      }
    } catch {
      failed++;
    }
  }

  return { updated, failed, rows };
}

/**
 * 주어진 blog_posts id에 연결된 big_event 이벤트의 신뢰도로 publish gate 판정.
 * 연결 없는 글은 true (통과). 이벤트 신뢰도 60 미만이면 false.
 */
export async function shouldBlockBlogPublishForFact(
  sb: SupabaseClient,
  blogPostId: number,
): Promise<{ blocked: boolean; reason?: string; score?: number }> {
  const { data: event } = await (sb as any)
    .from('big_event_registry')
    .select('id, name, fact_confidence_score')
    .or(`pillar_blog_post_id.eq.${blogPostId},spoke_blog_post_ids.cs.{${blogPostId}}`)
    .maybeSingle();

  if (!event) return { blocked: false };

  const score = Number(event.fact_confidence_score ?? 0);
  if (score < FACT_CONFIDENCE_PUBLISH_MIN) {
    return {
      blocked: true,
      reason: `big_event_fact_confidence_score=${score} < ${FACT_CONFIDENCE_PUBLISH_MIN} (${event.name})`,
      score,
    };
  }

  return { blocked: false, score };
}
