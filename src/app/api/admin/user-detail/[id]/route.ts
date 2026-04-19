import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** GET /api/admin/user-detail/{id} — get_admin_user_detail(p_user_id) RPC */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const admin = auth.admin as any;
  const { data, error } = await admin.rpc('get_admin_user_detail', { p_user_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ detail: data ?? null });
}
