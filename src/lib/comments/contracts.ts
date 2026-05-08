// s262 Phase B — Comments polymorphic contracts.
// entity_type 은 entity 종류. blog_posts 는 'post' (legacy backfill 동일).

export type CommentEntityType =
  | 'post'      // blog_posts (legacy)
  | 'stock'    // stock_quotes (entity_id = symbol)
  | 'apt'      // apt_subscriptions (entity_id = id::text)
  | 'redev'    // redevelopment_projects (entity_id = id::text)
  | 'unsold'   // unsold_apts (entity_id = id::text)
  | 'complex'  // apt_complex_profiles (entity_id = id 또는 apt_name)
  | 'issue'    // issue_alerts (entity_id = uuid)
  | 'feed';    // feed posts (entity_id = uuid)

export type EntityCommentStat = {
  entity_id: string;
  count: number;
  last_at: string | null;
  hot_score: number;
};

// CommentChip 의 hot 판정 임계값.
// hot_score 는 entity_comment_stats 컬럼 (V2 cron 이 채움).
// V1 fallback: 24h 내 신규 댓글 ≥ 2 건.
export const HOT_SCORE_THRESHOLD = 0.5;
export const HOT_FALLBACK_24H_COUNT = 2;
