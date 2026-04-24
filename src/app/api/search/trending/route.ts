import { cachedJson } from '@/lib/api-cache';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

// Cache: 600s — 트렌딩 검색어
export const revalidate = 600;

const withTimeout = <T>(p: PromiseLike<T>, ms = 3000): Promise<T | null> =>
  Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();

    const logsResult = await withTimeout(sb.rpc('get_trending_searches').limit(8));
    const logs = (logsResult as { data: unknown[] | null })?.data;
    if (logs && logs.length > 0) {
      return cachedJson({ keywords: logs }, 300);
    }

    const kwResult = await withTimeout(
      sb.from('trending_keywords').select('keyword, heat_score').order('heat_score', { ascending: false }).limit(10)
    );
    const data = (kwResult as { data: unknown[] | null })?.data;
    return cachedJson({ keywords: data ?? [] }, 300);
  } catch {
    return cachedJson({ keywords: [] }, 300);
  }
}
