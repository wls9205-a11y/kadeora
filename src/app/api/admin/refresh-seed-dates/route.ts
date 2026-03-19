import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // 시드 게시글 중 랜덤 10개 선택
    const { data: seedPosts } = await admin
      .from('posts')
      .select('id')
      .like('author_id', 'aaaaaaaa%')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!seedPosts || seedPosts.length === 0) {
      return NextResponse.json({ updated: 0, message: 'No seed posts found' });
    }

    // 랜덤 10개 선택
    const shuffled = seedPosts.sort(() => Math.random() - 0.5).slice(0, 10);
    let updated = 0;

    for (const post of shuffled) {
      // now() - random 0~2hours
      const offset = Math.floor(Math.random() * 2 * 60 * 60 * 1000);
      const newDate = new Date(Date.now() - offset).toISOString();
      const { error } = await admin
        .from('posts')
        .update({ created_at: newDate })
        .eq('id', post.id);
      if (!error) updated++;
    }

    return NextResponse.json({ updated, message: `${updated}개 시드 게시글 날짜 갱신 완료` });
  } catch (e: any) {
    console.error('[refresh-seed-dates]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
