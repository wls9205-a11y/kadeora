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
      .select('id, user_id')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (!review) return NextResponse.json({ error: '리뷰를 찾을 수 없습니다' }, { status: 404 });

    // 본인 리뷰 신고 불가
    if (review.user_id === user.id) {
      return NextResponse.json({ error: '본인 리뷰는 신고할 수 없습니다' }, { status: 400 });
    }

    // 중복 신고 체크
    const { count } = await admin.from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('reporter_id', user.id)
      .eq('review_id', id);

    if (count && count > 0) {
      return NextResponse.json({ error: '이미 신고한 리뷰입니다' }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const { error } = await admin.from('reports').insert({
      reporter_id: user.id,
      review_id: id,
      reason: body.reason || '부적절한 리뷰',
      details: body.details ?? null,
      status: 'pending',
      content_type: 'review',
      auto_hidden: false,
    });

    if (error) {
      console.error('[Review Report]', error);
      return NextResponse.json({ error: '신고 접수에 실패했습니다' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('[Review Report]', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
