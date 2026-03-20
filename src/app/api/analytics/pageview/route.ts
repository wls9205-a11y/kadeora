import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.visitor_id || !body?.path) return NextResponse.json({ ok: false });

  // Fire-and-forget: don't await
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  sb.from('page_views').insert({ visitor_id: body.visitor_id, path: body.path, referrer: body.referrer || null }).then(() => {}).catch(() => {});

  return NextResponse.json({ ok: true });
}
