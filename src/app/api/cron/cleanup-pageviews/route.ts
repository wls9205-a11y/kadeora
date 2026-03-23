import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await admin
      .from('page_views')
      .delete()
      .lt('created_at', cutoff)
      .select('id');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 200 });
    }

    const deleted = data?.length ?? 0;
    return NextResponse.json({ ok: true, deleted });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 200 });
  }
}
