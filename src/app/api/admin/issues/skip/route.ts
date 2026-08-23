import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  // [S10-0] /api/admin/* 은 middleware 보호 대상이 아니다 — 라우트 가드 필수.
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const sb = getSupabaseAdmin();
  const { issue_id } = await req.json();
  if (!issue_id) return NextResponse.json({ error: 'issue_id required' }, { status: 400 });

  await (sb as any).from('issue_alerts').update({
    is_processed: true,
    publish_decision: 'skipped',
    processed_at: new Date().toISOString(),
  }).eq('id', issue_id);

  return NextResponse.json({ ok: true });
}
