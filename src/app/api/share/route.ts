import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/** GET /api/share?content_type=blog&content_ref=slug 또는 ?post_id=123 — 공유 횟수 조회 */
export async function GET(req: NextRequest) {
  const contentType = req.nextUrl.searchParams.get('content_type');
  const contentRef = req.nextUrl.searchParams.get('content_ref');
  const postId = req.nextUrl.searchParams.get('post_id');
  
  try {
    const sb = getSupabaseAdmin();
    let query = sb.from('share_logs').select('id', { count: 'exact', head: true });
    
    if (contentType && contentRef) {
      query = query.eq('content_type', contentType).eq('content_ref', contentRef);
    } else if (postId) {
      const numId = parseInt(postId, 10);
      if (numId) {
        query = query.eq('content_type', 'post').eq('content_ref', String(numId));
      } else {
        return NextResponse.json({ count: 0 });
      }
    } else {
      return NextResponse.json({ count: 0 });
    }
    
    const { count } = await query;
    return NextResponse.json({ count: count ?? 0 });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const body = await req.json();
    const { platform, content_type, content_ref, post_id } = body;
    
    if (!platform) return NextResponse.json({ ok: false });
    
    const ct = content_type || (post_id ? 'post' : 'unknown');
    const cr = content_ref || (post_id ? String(post_id) : null);
    const numPostId = typeof post_id === 'number' ? post_id : (typeof post_id === 'string' ? parseInt(post_id, 10) || null : null);
    
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    const admin = getSupabaseAdmin();
    
    await (admin as any).from('share_logs').insert({
      post_id: numPostId,
      platform,
      user_id: user?.id || null,
      content_type: ct,
      content_ref: cr,
    });

    // 로그인 유저만 공유 포인트 (1일 1회)
    if (user?.id) {
      try {
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
