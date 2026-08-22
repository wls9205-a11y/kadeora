// r4-P5 — 블로그 월별 아카이브 공용 로직.
//
// 페이지와 사이트맵이 같은 함수를 써야 색인 기준이 갈리지 않는다.
// 페이지 파일에서 export 하면 라우트 핸들러가 페이지 모듈을 import 하게 되는데,
// 그 의존은 번들 경계를 넘나들어 다루기 나쁘다 — 그래서 lib 으로 뺀다.

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { fetchBatched } from '@/lib/db/fetchBatched';
import { isIndexable } from '@/lib/apt/indexable';

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** 조회수 표기 임계값 (실측, 2026-08-22): p90=182 / p75=35 / 중앙값 18 */
export const VIEW_P90 = 182;
export const VIEW_P75 = 35;

export interface ArchiveRow {
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  published_at: string | null;
  view_count: number | null;
  cover_image: string | null;
  image_alt: string | null;
}

export function monthBounds(month: string) {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function fetchMonth(month: string): Promise<ArchiveRow[]> {
  const { start, end } = monthBounds(month);
  const sb = getSupabaseAdmin();
  const { data } = await (sb as any)
    .from('blog_posts')
    .select('slug, title, excerpt, category, published_at, view_count, cover_image, image_alt')
    .eq('is_published', true)
    .not('published_at', 'is', null)
    .gte('published_at', start)
    .lt('published_at', end)
    .order('view_count', { ascending: false, nullsFirst: false })
    .limit(300);
  return ((data ?? []) as ArchiveRow[]).filter((r) => r.slug && r.title);
}

/**
 * 발행 이력이 있는 월 중 색인 기준(INDEX_MIN)을 넘는 월 목록. 최신순.
 *
 * PostgREST 기본 db-max-rows=1000 이라 limit(20000) 을 걸어도 1000행만 온다.
 * 배치로 다 긁지 않으면 최신 4개월만 잡혀 아카이브 26개월이 사라진다.
 */
export async function listArchiveMonths(): Promise<string[]> {
  try {
    const sb = getSupabaseAdmin();
    const rows = await fetchBatched<{ published_at: string }>(
      (off, lim) =>
        (sb as any)
          .from('blog_posts')
          .select('published_at')
          .eq('is_published', true)
          .not('published_at', 'is', null)
          .order('published_at', { ascending: false })
          .range(off, off + lim - 1),
      80000,
    );
    const counts = new Map<string, number>();
    for (const r of rows) {
      const m = String(r.published_at).slice(0, 7);
      if (!MONTH_RE.test(m)) continue;
      counts.set(m, (counts.get(m) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, n]) => isIndexable(n))
      .map(([m]) => m)
      .sort()
      .reverse();
  } catch (err) {
    console.error('[blog/archive months]', err);
    return [];
  }
}
