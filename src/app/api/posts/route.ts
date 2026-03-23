import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sanitizePostInput } from '@/lib/sanitize'
import { containsBannedWord } from '@/lib/nickname-filter'
import { generateEnglishSlug } from '@/lib/slug-utils'
import { PostCreateSchema, parseBody } from '@/lib/validations'

export async function GET(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const supabase = await createSupabaseServer();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const category = searchParams.get('category');
    let query = supabase.from('posts').select(`id, title, content, created_at, category, likes_count, comments_count, view_count, author_id, images, is_anonymous, tag, slug, author:profiles!posts_author_id_fkey(id, nickname, avatar_url)`, { count: 'exact' }).eq('is_deleted', false).order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1);
    if (category) query = query.eq('category', category);
    const { data, error, count } = await query;
    if (error) { console.error('[Posts GET]', error); return NextResponse.json({ error: '게시글을 불러올 수 없습니다.' }, { status: 500 }); }
    return NextResponse.json({ posts: data || [], total: count || 0, page, limit, hasMore: (count || 0) > page * limit });
  } catch (err) { console.error('[Posts GET]', err); return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    const body = await req.json();
    const { data: parsed, error: zodErr } = parseBody(PostCreateSchema, body);
    if (zodErr) return NextResponse.json({ error: zodErr }, { status: 400 });
    const { title, content, category, tag } = sanitizePostInput(parsed!);
    if (containsBannedWord(title) || containsBannedWord(content)) return NextResponse.json({ error: '부적절한 표현이 포함되어 있습니다.' }, { status: 400 });
    const regionId = (category === 'local' && parsed!.region_id) ? parsed!.region_id : 'all';

    // 게시글 INSERT (유저 세션 — 본인 데이터)
    const images = parsed!.images ?? [];
    const tags = parsed!.tags ?? [];
    const slug = generateEnglishSlug(title, String(Date.now()));
    const { data, error } = await supabase.from('posts').insert({ title, content, category, author_id: user.id, is_anonymous: body.is_anonymous ?? false, tag, region_id: regionId, images, tags, slug }).select().single();
    if (error) { console.error('[Posts POST]', error); return NextResponse.json({ error: '게시글 작성에 실패했습니다.' }, { status: 500 }); }

    try { revalidatePath('/feed'); } catch {}

    // 포인트 적립 (award_points RPC — 트리거 바이패스)
    try {
      await getSupabaseAdmin().rpc('award_points', { p_user_id: user.id, p_amount: 10, p_reason: '게시글작성', p_meta: null });
    } catch {}

    return NextResponse.json({ post: data }, { status: 201 });
  } catch (err) { console.error('[Posts POST]', err); return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
