import { cachedJson } from '@/lib/api-cache';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export const revalidate = 300;
export const dynamic = 'force-dynamic'; // s168: 빌드타임 DB 호출 제거

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();
    const { data, error } = await sb.from('stock_themes')
      .select('id,theme_name,change_pct,description,related_symbols,is_hot,date')
      .order('change_pct', { ascending: false })
      .limit(10);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return cachedJson({ themes: data || [] }, 300);
  } catch { return cachedJson({ themes: [] }, 300); }
}
