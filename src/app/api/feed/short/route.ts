import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const { content, category = 'free', region_id = '' } = await req.json();
    if (!content?.trim() || content.trim().length < 2) {
      return NextResponse.json({ error: '내용을 2자 이상 입력하세요' }, { status: 400 });
    }

    const text = content.trim();
    const { data: post, error } = await sb.from('posts').insert({
      title: '',
      content: text,
      excerpt: text.slice(0, 100),
      category,
      region_id,
      author_id: user.id,
      post_type: 'short',
    }).select('id').single();

    if (error || !post) return NextResponse.json({ error: error?.message || '작성 실패' }, { status: 500 });

    await (sb as any).rpc('award_points', {
      p_user_id: user.id, p_amount: 5, p_reason: '한마디작성', p_meta: { ref_id: post.id },
    });

    return NextResponse.json({ success: true, post_id: post.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
