import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || null;
  const filter = searchParams.get('filter') || 'all';
  const sort = searchParams.get('sort') || 'created_desc';
  const page = parseInt(searchParams.get('page') || '1', 10) || 1;
  const perPage = Math.min(parseInt(searchParams.get('per_page') || '50', 10) || 50, 100);

  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
    const sb: any = getSupabaseAdmin();
    const { data, error } = await sb.rpc('admin_user_list', {
      p_search: search,
      p_filter: filter,
      p_sort: sort,
      p_page: page,
      p_per_page: perPage,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 200 });
  }
}
