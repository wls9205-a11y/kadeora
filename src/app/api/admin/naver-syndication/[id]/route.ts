import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/** GET /api/admin/naver-syndication/[id] — 특정 발행 콘텐츠의 전체 HTML 반환 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // [S10-0] 무인증이면 신디케이션 콘텐츠 전문이 그대로 노출된다.
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const { id } = await params;
  const sb = getSupabaseAdmin();

  const { data } = await (sb as any).from('naver_syndication')
    .select('*')
    .eq('id', Number(id))
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data });
}
