import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function DELETE(req: NextRequest) {
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const target = searchParams.get('target') || 'all';
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    if (target === 'likes' || target === 'all') {
      await admin.from('post_likes').delete().like('user_id', 'aaaaaaaa%');
    }
    if (target === 'comments' || target === 'all') {
      await admin.from('comments').delete().like('author_id', 'aaaaaaaa%');
    }
    if (target === 'posts' || target === 'all') {
      const { data: seedPosts } = await admin.from('posts').select('id').like('author_id', 'aaaaaaaa%');
      const ids = (seedPosts || []).map(p => p.id);
      if (ids.length) {
        await admin.from('post_likes').delete().in('post_id', ids);
        await admin.from('comments').delete().in('post_id', ids);
      }
      await admin.from('posts').delete().like('author_id', 'aaaaaaaa%');
    }
    if (target === 'users' || target === 'all') {
      await admin.from('profiles').delete().like('id', 'aaaaaaaa%');
    }

    return NextResponse.json({ ok: true, target });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'error' }, { status: 500 });
  }
}
