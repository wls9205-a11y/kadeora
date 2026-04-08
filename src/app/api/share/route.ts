import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/** GET /api/share?post_id=xxx — 공유 횟수 조회 */
export async function GET(req: NextRequest) {
  const postId = req.nextUrl.searchParams.get('post_id');
  if (!postId) return NextResponse.json({ count: 0 });
  try {
    const sb = getSupabaseAdmin();
    const { count } = await sb.from('share_logs')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', parseInt(postId, 10) || 0);
    return NextResponse.json({ count: count ?? 0 });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const { post_id, platform } = await req.json();
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    await sb.from('share_logs').insert({ post_id, platform, user_id: user?.id || null });

    // 로그인 유저만 공유 포인트 (1일 1회, 최대 5포인트)
    if (user?.id) {
      try {
        const admin = getSupabaseAdmin();
        const today = new Date().toISOString().slice(0, 10);
        const { count } = await admin.from('share_logs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', `${today}T00:00:00Z`);
        if ((count ?? 0) <= 1) {
          const points = ['naver-blog', 'naver-cafe', 'daum-cafe'].includes(platform) ? 10 : 5;
          await admin.rpc('award_points', { p_user_id: user.id, p_amount: points, p_reason: platform === 'naver-blog' ? '네이버 블로그 공유' : '공유', p_meta: null });
        }
      } catch (e) { console.error(`[${new URL(req.url).pathname}]`, e); }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
