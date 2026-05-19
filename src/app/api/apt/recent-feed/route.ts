// s269d V2: V2 RPC 호출 + 에러 logging.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 10;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const region = sp.get('region') ?? '전국';
  const category = sp.get('category') ?? 'all';
  const limit = Math.min(Math.max(parseInt(sp.get('limit') ?? '20'), 1), 50);
  const cursor = sp.get('cursor');
  const cursorId = sp.get('cursor_id');

  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any).rpc('get_apt_recent_feed_v2', {
      p_region: region,
      p_category: category,
      p_limit: limit,
      p_cursor: cursor,
      p_cursor_id: cursorId,
    });
    if (error) {
      console.error('[recent-feed/v2] error:', JSON.stringify(error));
      return NextResponse.json({ items: [], error: error.message }, { status: 200 });
    }
    return NextResponse.json({ items: data ?? [] });
  } catch (e: any) {
    console.error('[recent-feed/v2] caught:', e?.message ?? String(e));
    return NextResponse.json({ items: [], error: e?.message ?? 'unknown' }, { status: 200 });
  }
}
