import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const { blogId } = await req.json();
    if (!blogId || typeof blogId !== 'string') return NextResponse.json({ error: 'Missing blogId' }, { status: 400 });
    const sb = getSupabaseAdmin();
    await sb.rpc('increment_blog_view', { p_blog_id: blogId });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
