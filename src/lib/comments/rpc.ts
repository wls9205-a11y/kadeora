// s262 Phase B — get_entity_comment_counts wrapper + hot 판정 헬퍼.
// 카드 리스트 렌더 시 batch 호출 (N+1 방지).

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  HOT_SCORE_THRESHOLD,
  HOT_FALLBACK_24H_COUNT,
  type CommentEntityType,
  type EntityCommentStat,
} from './contracts';

// batch RPC. ids 가 비면 빈 Map 반환 (RPC 호출 skip).
export async function getEntityCommentCounts(
  entityType: CommentEntityType,
  ids: string[],
): Promise<Map<string, EntityCommentStat>> {
  const out = new Map<string, EntityCommentStat>();
  if (!ids || ids.length === 0) return out;
  // 중복 제거
  const uniqueIds = Array.from(new Set(ids));
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).rpc('get_entity_comment_counts', {
    p_entity_type: entityType,
    p_entity_ids:  uniqueIds,
  });
  if (error) {
    console.error('[comments/rpc] get_entity_comment_counts failed:', error.message);
    return out;
  }
  for (const row of (data ?? []) as EntityCommentStat[]) {
    out.set(row.entity_id, row);
  }
  return out;
}

// hot 판정. mat view 의 hot_score 우선, 없으면 24h 내 댓글 수로 fallback.
// last_at 이 24h 내 + count 임계값 이상이면 hot.
export function isHotComment(stat: EntityCommentStat | null | undefined): boolean {
  if (!stat) return false;
  if ((stat.hot_score ?? 0) >= HOT_SCORE_THRESHOLD) return true;
  if (!stat.last_at) return false;
  const last = new Date(stat.last_at).getTime();
  const ageH = (Date.now() - last) / (3600 * 1000);
  return ageH <= 24 && stat.count >= HOT_FALLBACK_24H_COUNT;
}

// CommentChip props 만들기 — stat 없으면 count=0 으로 표시 (안 그려도 OK).
export function commentChipProps(stat: EntityCommentStat | null | undefined): {
  count: number;
  hot: boolean;
} {
  if (!stat) return { count: 0, hot: false };
  return { count: stat.count, hot: isHotComment(stat) };
}
