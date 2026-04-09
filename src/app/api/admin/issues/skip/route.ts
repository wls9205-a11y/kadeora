import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
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
