import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

// POST /api/feed/vs — VS 생성
export async function POST(req: NextRequest) {
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const { question, option_a, option_b, category = 'free', region_id = '' } = await req.json();
    if (!question?.trim() || !option_a?.trim() || !option_b?.trim()) {
      return NextResponse.json({ error: '질문과 두 선택지 필요' }, { status: 400 });
    }

    const { data: post, error: postErr } = await sb.from('posts').insert({
      title: question.trim(),
      content: `${option_a.trim()} vs ${option_b.trim()}`,
      excerpt: question.trim().slice(0, 100),
      category, region_id, author_id: user.id, post_type: 'vs',
    }).select('id').single();
    if (postErr || !post) return NextResponse.json({ error: '글 생성 실패' }, { status: 500 });

    const { data: battle, error: vsErr } = await (sb as any).from('vs_battles').insert({
      post_id: post.id, option_a: option_a.trim(), option_b: option_b.trim(),
    }).select('id').single();
    if (vsErr) return NextResponse.json({ error: vsErr.message }, { status: 500 });

    await (sb as any).rpc('award_points', {
      p_user_id: user.id, p_amount: 10, p_reason: 'VS생성', p_meta: { ref_id: post.id },
    });

    return NextResponse.json({ success: true, post_id: post.id, battle_id: battle.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
