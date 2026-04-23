import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const admin = auth.admin as any;

  const { count, error } = await admin
    .from('v_admin_whale_unconverted')
    .select('*', { count: 'exact', head: true });

  if (error) return NextResponse.json({ count: 0, error: error.message }, { status: 200 });
  return NextResponse.json({ count: count || 0 });
}
