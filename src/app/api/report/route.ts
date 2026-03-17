import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    const { target_id, target_type, reason } = await req.json();
    if (!target_id || !target_type || !reason) {
      return NextResponse.json({ error: '필수 항목이 누락됐습니다' }, { status: 400 });
    }
    await supabase.from('reports').insert({
      reporter_id: user.id,
      post_id: target_type === 'post' ? target_id : null,
      comment_id: target_type === 'comment' ? target_id : null,
      reason,
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
