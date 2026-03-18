import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { log_id } = await req.json();
    if (!log_id) return NextResponse.json({ ok: false });
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data } = await admin.from('push_logs').select('click_count').eq('id', log_id).single();
    await admin.from('push_logs').update({ click_count: (data?.click_count ?? 0) + 1 }).eq('id', log_id);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ ok: false }); }
}
