import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * 네이버 발행 관리 API (admin only)
 * GET: 목록 조회 (pending/published)
 * POST: 수동 상태 업데이트 (mark_blog_published, skip, retry, retry_cafe)
 */

export async function GET() {
  const auth = await requireAdmin(); if ('error' in auth) return auth.error;
  const sb = getSupabaseAdmin();

  const { data: items } = await (sb as any).from('naver_syndication')
    .select('id, blog_slug, blog_post_id, original_title, naver_title, naver_tags, category, target, blog_status, cafe_status, cafe_article_id, cafe_retry_count, cafe_error, cafe_published_at, published_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const pending = (items || []).filter((i: any) => i.blog_status === 'pending' || i.cafe_status === 'pending').length;
  const published = (items || []).filter((i: any) => i.blog_status === 'published' || i.cafe_status === 'published').length;
  const failed = (items || []).filter((i: any) => i.blog_status === 'failed' || i.cafe_status === 'failed').length;

  return NextResponse.json({ ok: true, items: items || [], stats: { pending, published, failed, total: (items || []).length } });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(); if ('error' in auth) return auth.error;
  const sb = getSupabaseAdmin();
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  const { id, action } = body;

  if (!id || !action) {
    return NextResponse.json({ ok: false, error: 'id_and_action_required' }, { status: 400 });
  }

  if (action === 'mark_blog_published') {
    await (sb as any).from('naver_syndication')
      .update({ blog_status: 'published', published_at: new Date().toISOString() })
      .eq('id', id);
  } else if (action === 'skip') {
    await (sb as any).from('naver_syndication')
      .update({ blog_status: 'skipped', cafe_status: 'skipped' })
      .eq('id', id);
  } else if (action === 'retry' || action === 'retry_cafe') {
    await (sb as any).from('naver_syndication')
      .update({ cafe_status: 'pending', cafe_error: null, cafe_retry_count: 0 })
      .eq('id', id);
  } else {
    return NextResponse.json({ ok: false, error: 'unknown_action' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
