import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * 네이버 발행 관리 API
 * GET: 목록 조회 (pending/published)
 * POST: 수동 상태 업데이트 (blog_status → published 등)
 */

export async function GET() {
  const sb = getSupabaseAdmin();

  const { data: items } = await (sb as any).from('naver_syndication')
    .select('id, blog_slug, original_title, naver_title, naver_tags, category, target, blog_status, cafe_status, cafe_article_id, published_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const pending = (items || []).filter((i: any) => i.blog_status === 'pending' || i.cafe_status === 'pending').length;
  const published = (items || []).filter((i: any) => i.blog_status === 'published' || i.cafe_status === 'published').length;

  return NextResponse.json({ ok: true, items: items || [], stats: { pending, published, total: (items || []).length } });
}

export async function POST(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const body = await req.json();
  const { id, action } = body;

  if (!id || !action) {
    return NextResponse.json({ ok: false, error: 'id and action required' }, { status: 400 });
  }

  if (action === 'mark_blog_published') {
    await (sb as any).from('naver_syndication')
      .update({ blog_status: 'published', published_at: new Date().toISOString() })
      .eq('id', id);
  } else if (action === 'skip') {
    await (sb as any).from('naver_syndication')
      .update({ blog_status: 'skipped', cafe_status: 'skipped' })
      .eq('id', id);
  } else if (action === 'retry_cafe') {
    await (sb as any).from('naver_syndication')
      .update({ cafe_status: 'pending' })
      .eq('id', id);
  }

  return NextResponse.json({ ok: true });
}
