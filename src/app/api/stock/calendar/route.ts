import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export const revalidate = 600;

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await sb.from('invest_calendar')
      .select('id,title,event_type,event_date,description,importance,country')
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .limit(20);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ events: data || [] });
  } catch { return NextResponse.json({ events: [] }); }
}
