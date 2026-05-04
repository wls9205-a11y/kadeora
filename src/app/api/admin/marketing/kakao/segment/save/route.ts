import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/admin-auth';
import { errMsg } from '@/lib/error-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 5;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const description = typeof body?.description === 'string' ? body.description : null;
    const filter_json = body?.filter_json ?? {};

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const sb: any = getSupabaseAdmin();
    const { data, error } = await sb
      .from('marketing_segments')
      .insert({ name, description, filter_json })
      .select('id')
      .single();
    if (error) throw error;

    return NextResponse.json({ id: data?.id });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
