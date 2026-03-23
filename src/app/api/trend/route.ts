import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServer } from '@/lib/supabase-server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from('trending_keywords').select('keyword, heat_score').order('heat_score', { ascending: false }).limit(10);
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const authSb = await createSupabaseServer();
    const { data: { user } } = await authSb.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
    const sb = getSupabaseAdmin();
    const { error } = await sb.rpc('refresh_trending_keywords');
    if (error) { console.error('[Trend]', error); return NextResponse.json({ error: '트렌딩 갱신 실패' }, { status: 500 }); }
    return NextResponse.json({ success: true });
  } catch (err) { console.error('[Trend]', err); return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
