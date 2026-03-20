import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST() {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;

    const supabase = getSupabaseAdmin();

    // 시드 게시글 중 랜덤 10개 선택
    const { data: seedPosts } = await supabase
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
      const { error } = await supabase
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
