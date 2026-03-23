import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();

  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

    const { id } = await params;
    const admin = getSupabaseAdmin();

    // 리뷰 존재 확인
    const { data: review } = await admin.from('apt_reviews')
      .select('id, likes_count')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (!review) return NextResponse.json({ error: '리뷰를 찾을 수 없습니다' }, { status: 404 });

    // 좋아요 토글
    try {
      const { data: existing } = await admin.from('apt_review_likes')
        .select('id')
        .eq('review_id', id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        await admin.from('apt_review_likes').delete().eq('id', existing.id);
        const newCount = Math.max(0, (review.likes_count ?? 0) - 1);
        await admin.from('apt_reviews').update({ likes_count: newCount }).eq('id', id);
        return NextResponse.json({ liked: false, likes_count: newCount });
      }

      await admin.from('apt_review_likes').insert({ review_id: id, user_id: user.id });
      const newCount = (review.likes_count ?? 0) + 1;
      await admin.from('apt_reviews').update({ likes_count: newCount }).eq('id', id);
      return NextResponse.json({ liked: true, likes_count: newCount });
    } catch {
      // apt_review_likes 테이블 미존재 시 단순 증가
      const newCount = (review.likes_count ?? 0) + 1;
      await admin.from('apt_reviews').update({ likes_count: newCount }).eq('id', id);
      return NextResponse.json({ liked: true, likes_count: newCount });
    }
  } catch (err) {
    console.error('[Review Like]', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
