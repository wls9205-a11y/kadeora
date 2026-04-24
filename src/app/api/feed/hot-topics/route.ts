import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

// 1분 캐시
export const revalidate = 60;
export const dynamic = 'force-dynamic'; // s168: 빌드타임 DB 호출 제거

export async function GET(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();
    const { data, error } = await (sb as any).rpc('get_hot_topics', { p_limit: 8 });
    if (error) return NextResponse.json({ topics: [] });
    return NextResponse.json({ topics: data ?? [] });
  } catch {
    return NextResponse.json({ topics: [] });
  }
}
