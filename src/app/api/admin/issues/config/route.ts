import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  // [S10-0] 자동발행 on/off·최소점수·차단 카테고리를 바꾸는 엔드포인트다.
  //   무인증이면 외부에서 블로그 자동발행 정책을 그대로 뒤집을 수 있다.
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

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
