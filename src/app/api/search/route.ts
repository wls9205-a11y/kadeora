import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() ?? '';
    const category = searchParams.get('category') ?? 'all';
    const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50);
    const offset = Number(searchParams.get('offset') ?? '0');

    if (!q || q.length < 2) return NextResponse.json({ results: [], total: 0, query: q });

    const sb = await createSupabaseServer();
    let query = sb.from('posts')
      .select('*, profiles(id,nickname,avatar_url,grade)', { count: 'exact' })
      .eq('is_deleted', false)
      .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category !== 'all') query = query.eq('category', category);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ results: data ?? [], total: count ?? 0, query: q });
  } catch (e: unknown) {
    console.error('[GET /api/search]', e);
    return NextResponse.json({ error: '검색 중 오류가 발생했습니다' }, { status: 500 });
  }
}
