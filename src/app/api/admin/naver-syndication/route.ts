import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * 네이버 발행 관리 API (admin only)
 * GET: 목록 조회 + 오늘 발행 잔여 한도
 * POST: 수동 상태 업데이트 (mark_blog_published, skip, retry)
 *
 * [§7] 네이버 블로그에는 «공개 발행 API 가 없다.» 자동 발행 워커는 존재한 적이 없고
 *   구조상 만들 수도 없다 — 크론이 naver_html 을 만들어 큐에 넣고, 사람이 어드민에서
 *   복사해 네이버 블로그에 붙여넣는 흐름이다. 그래서 "워커 재가동" 이 아니라
 *   «사람이 한 번에 밀어버리지 못하게 막는 것» 이 여기서의 일 상한이다.
 */

/**
 * [§7-3] 일 발행 상한. 큐에 81건이 밀려 있어 한 번에 올리면 스팸 판정 위험이 크다.
 *   생성 쪽 크론도 BATCH_SIZE=3 이라 정상 흐름에서는 하루 3건씩 쌓인다.
 */
const DAILY_PUBLISH_CAP = 3;

export async function GET() {
  const auth = await requireAdmin(); if ('error' in auth) return auth.error;
  const sb = getSupabaseAdmin();

  const { data: items } = await (sb as any).from('naver_syndication')
    .select('id, blog_slug, blog_post_id, original_title, naver_title, naver_tags, category, target, blog_status, cafe_status, cafe_article_id, cafe_retry_count, cafe_error, cafe_published_at, published_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  // 오늘(KST) 이미 발행한 건수 — 잔여 한도 계산용.
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const kstToday = kstNow.toISOString().slice(0, 10);
  const { count: publishedToday } = await (sb as any).from('naver_syndication')
    .select('id', { count: 'exact', head: true })
    .eq('blog_status', 'published')
    .gte('published_at', `${kstToday}T00:00:00+09:00`)
    .lte('published_at', `${kstToday}T23:59:59+09:00`);

  const usedToday = publishedToday || 0;
  const remainingToday = Math.max(0, DAILY_PUBLISH_CAP - usedToday);

  // 카페는 폐지됐다. pending/published/failed 는 블로그 상태만으로 센다.
  const pending = (items || []).filter((i: any) => i.blog_status === 'pending').length;
  const published = (items || []).filter((i: any) => i.blog_status === 'published').length;
  const failed = (items || []).filter((i: any) => i.blog_status === 'failed').length;

  return NextResponse.json({
    ok: true,
    items: items || [],
    stats: { pending, published, failed, total: (items || []).length },
    dailyCap: { cap: DAILY_PUBLISH_CAP, usedToday, remainingToday, date: kstToday },
  });
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
    // [§7-3] 일 상한을 «서버에서» 강제한다. UI 배지만으로는 실수로 연타하면 그대로 넘어간다.
    const kstToday = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { count } = await (sb as any).from('naver_syndication')
      .select('id', { count: 'exact', head: true })
      .eq('blog_status', 'published')
      .gte('published_at', `${kstToday}T00:00:00+09:00`)
      .lte('published_at', `${kstToday}T23:59:59+09:00`);
    if ((count || 0) >= DAILY_PUBLISH_CAP) {
      return NextResponse.json({
        ok: false,
        error: 'daily_cap_reached',
        message: `오늘 발행 한도(${DAILY_PUBLISH_CAP}건)를 채웠습니다. 큐 81건을 한 번에 올리면 네이버 스팸 판정 위험이 있어 막아둡니다.`,
        cap: DAILY_PUBLISH_CAP,
        usedToday: count || 0,
      }, { status: 429 });
    }
    await (sb as any).from('naver_syndication')
      .update({ blog_status: 'published', published_at: new Date().toISOString() })
      .eq('id', id);
  } else if (action === 'skip') {
    await (sb as any).from('naver_syndication')
      .update({ blog_status: 'skipped', cafe_status: 'skipped' })
      .eq('id', id);
  } else if (action === 'retry') {
    // [§7 / §2-4] 카페 발행 워커는 폐지됐다(라우트 파일 없음). retry 는 블로그만 되돌린다.
    //   구 `retry_cafe` 액션은 cafe_status 를 pending 으로 되살려 큐를 다시 묶어버리므로 제거한다.
    await (sb as any).from('naver_syndication')
      .update({ blog_status: 'pending', published_at: null, cafe_status: 'skipped' })
      .eq('id', id);
  } else {
    return NextResponse.json({ ok: false, error: 'unknown_action' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
