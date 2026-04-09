import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const body = await req.json();

  const updates: Record<string, any> = {};
  if (typeof body.auto_publish_enabled === 'boolean') updates.auto_publish_enabled = body.auto_publish_enabled;
  if (typeof body.auto_publish_min_score === 'number') updates.auto_publish_min_score = body.auto_publish_min_score;
  if (Array.isArray(body.auto_publish_blocked_categories)) updates.auto_publish_blocked_categories = body.auto_publish_blocked_categories;

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'no updates' }, { status: 400 });

  await sb.from('blog_publish_config').update(updates).eq('id', 1);
  return NextResponse.json({ ok: true, updates });
}
