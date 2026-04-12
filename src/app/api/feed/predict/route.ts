import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const { title, target, direction, deadline, category = 'stock', region_id = '' } = await req.json();
    if (!title?.trim() || !target?.trim() || !['up', 'down'].includes(direction) || !deadline) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 });
    }

    const { data: post, error: postErr } = await sb.from('posts').insert({
      title: title.trim(),
      content: `${title.trim()} — ${direction === 'up' ? '📈' : '📉'} ${target} (${deadline}까지)`,
      excerpt: title.trim().slice(0, 100),
      category, region_id, author_id: user.id, post_type: 'predict',
    }).select('id').single();
    if (postErr || !post) return NextResponse.json({ error: '글 생성 실패' }, { status: 500 });

    const { error: predErr } = await (sb as any).from('predictions').insert({
      post_id: post.id, target: target.trim(), direction, deadline,
    });
    if (predErr) return NextResponse.json({ error: predErr.message }, { status: 500 });

    await (sb as any).rpc('award_points', {
      p_user_id: user.id, p_amount: 10, p_reason: '예측생성', p_meta: { ref_id: post.id },
    });

    return NextResponse.json({ success: true, post_id: post.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
