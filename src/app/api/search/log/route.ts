import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    const body = await req.json();
    const query = body.query?.trim();
    if (!query) return NextResponse.json({ ok: false });

    await sb.from('search_logs').insert({
      user_id: user?.id ?? null,
      query,
      results_count: body.results_count ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
