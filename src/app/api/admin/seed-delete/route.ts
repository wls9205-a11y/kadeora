import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const target = searchParams.get('target') || 'all';
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.rpc('delete_seed_data', { target_type: target });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, target });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'error' }, { status: 500 });
  }
}
