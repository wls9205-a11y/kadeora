// s262 Phase B — get_home_data RPC 응답 타입.

import type { StockIssueScore, AptIssueScore } from '@/lib/issue/types';

export type HeroIssue = {
  kind:          'issue' | 'stock';
  id:            string;
  title:         string;
  summary:       string;
  category:      string | null;
  published_at?: string;
  score?:        number;
};

export type HotBlog = {
  slug:         string;
  title:        string;
  excerpt:      string | null;
  cover_image:  string | null;
  view_count:   number | null;
  category:     string | null;
  published_at: string | null;
};

export type HomeData = {
  hero_issue:  HeroIssue | null;
  stock_top3:  StockIssueScore[];
  apt_top3:    AptIssueScore[];
  hot_blog:    HotBlog[];
  computed_at: string;
};
