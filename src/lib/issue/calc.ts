// s262 Phase B — Issue weights 읽기 + 60s 인-메모리 캐시.
// 점수 계산은 mat view 가 SQL 안에서 수행 — 이 모듈은 가중치 표시/관리용.
// Architecture Rule #79 — 가중치는 weights 테이블만 변경.
// Architecture Rule #80 — mat view REFRESH 로 즉시 반영.

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { IssueWeight } from './types';

type WeightCache = {
  fetchedAt: number;
  rows: IssueWeight[];
};

const TTL_MS = 60 * 1000;
const cache: { stock: WeightCache | null; apt: WeightCache | null } = {
  stock: null,
  apt:   null,
};

async function fetchWeights(table: 'stock_issue_score_weights' | 'apt_issue_score_weights'): Promise<IssueWeight[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).from(table).select('*').order('weight', { ascending: false });
  if (error) {
    console.error(`[issue/calc] ${table} fetch failed:`, error.message);
    return [];
  }
  return (data ?? []) as IssueWeight[];
}

export async function getStockWeights(): Promise<IssueWeight[]> {
  const now = Date.now();
  if (cache.stock && now - cache.stock.fetchedAt < TTL_MS) return cache.stock.rows;
  const rows = await fetchWeights('stock_issue_score_weights');
  cache.stock = { fetchedAt: now, rows };
  return rows;
}

export async function getAptWeights(): Promise<IssueWeight[]> {
  const now = Date.now();
  if (cache.apt && now - cache.apt.fetchedAt < TTL_MS) return cache.apt.rows;
  const rows = await fetchWeights('apt_issue_score_weights');
  cache.apt = { fetchedAt: now, rows };
  return rows;
}

// 가중치 변경 후 즉시 강제 reload (어드민 패치 시).
export function invalidateWeightsCache(): void {
  cache.stock = null;
  cache.apt = null;
}

// 점수 → 0..100 표시값. 카드의 IssueScoreBadge 가 사용.
export function scoreToDisplay(score: number | null | undefined): number {
  if (score == null || Number.isNaN(score)) return 0;
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}
