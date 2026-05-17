// s269: /apt 통합 피드 페이지네이션 API.
// Architecture Rule #16: maxDuration=10. Rule #18: vercel.json catch-all override 주의.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 10;
export const dynamic = 'force-dynamic';

const ALLOWED_CATEGORIES = new Set(['all', 'subscription', 'unsold', 'redev']);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const region    = (sp.get('region') ?? '전국').trim() || '전국';
  const category  = (sp.get('category') ?? 'all').trim();
  const cursor    = sp.get('cursor');
  const cursorId  = sp.get('cursor_id');
  const limitRaw  = Number(sp.get('limit') ?? '20');
  const limit    = Math.min(50, Math.max(5, Number.isFinite(limitRaw) ? limitRaw : 20));

  if (!ALLOWED_CATEGORIES.has(category)) {
    return NextResponse.json({ items: [], hasMore: false, error: 'invalid category' }, { status: 400 });
  }

  try {
    const sb = getSupabaseAdmin();
    // Architecture Rule #13: 타입 미정의 RPC.
    const { data, error } = await (sb as any).rpc('get_apt_recent_feed', {
      p_region:    region,
      p_category:  category,
      p_limit:     limit,
      p_cursor:    cursor || null,
      p_cursor_id: cursorId || null,
    });

    if (error) {
      return NextResponse.json({ items: [], hasMore: false, error: error.message }, { status: 502 });
    }
    const items = Array.isArray(data) ? data : [];
    return NextResponse.json(
      { items, hasMore: items.length >= limit },
      { headers: { 'Cache-Control': 'private, max-age=10' } }
    );
  } catch (e: any) {
    return NextResponse.json({ items: [], hasMore: false, error: e?.message ?? 'unknown' }, { status: 500 });
  }
}
