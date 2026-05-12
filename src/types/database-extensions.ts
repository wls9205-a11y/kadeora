import type { Database } from './database';

export type PostWithProfile = Database['public']['Tables']['posts']['Row'] & {
  profiles?: {
    id?: string;
    nickname: string | null;
    avatar_url: string | null;
    grade: number | null;
  } | null;
  // 세션 49 추가
  bookmarks_count?: number;
  is_pinned?: boolean;
  tags?: string[] | null;
  stock_tags?: string[];
  apt_tags?: string[];
  // 피드 리뉴얼: post_type (migration 후 DB 타입 재생성 전까지)
  post_type?: 'post' | 'short' | 'poll' | 'vs' | 'predict' | string;
};

export type CommentWithProfile = Database['public']['Tables']['comments']['Row'] & {
  profiles?: {
    id?: string;
    nickname: string | null;
    avatar_url: string | null;
    grade: number | null;
  } | null;
};

// Poll 타입 (post_polls 테이블 신설)
export interface PostPoll {
  id: number;
  post_id: number;
  question: string;
  options: string[];
  ends_at: string | null;
  created_at: string;
}

export interface PostPollVote {
  id: number;
  poll_id: number;
  user_id: string;
  option_index: number;
  created_at: string;
}

export interface PollResult extends PostPoll {
  counts: number[];
  total: number;
  myVote: number | null;
  expired: boolean;
}
