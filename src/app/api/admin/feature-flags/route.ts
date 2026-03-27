import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { admin } = auth;

  const { data } = await admin.from('feature_flags').select('*').order('key');
  return NextResponse.json({ flags: data || [] });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { admin, user } = auth;

  const { key, enabled } = await req.json();
  if (!key) return NextResponse.json({ error: 'key 필수' }, { status: 400 });

  const { error } = await admin.from('feature_flags')
    .update({ enabled, updated_at: new Date().toISOString(), updated_by: user.id })
    .eq('key', key);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
