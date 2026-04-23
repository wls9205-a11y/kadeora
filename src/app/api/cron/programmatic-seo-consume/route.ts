/**
 * 세션 146 E3 — programmatic_seo_queue 소비 크론.
 * pending row 10개 pick → content_ready=true 로 marking (실제 콘텐츠는 별도 생성).
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 120;

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) return new NextResponse('ok', { status: 200 });
  try {
    const sb = getSupabaseAdmin();
    const { data: rows } = await (sb as any)
      .from('programmatic_seo_queue')
      .select('id, slug, page_type, params, priority')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .limit(10);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

    // 본격 콘텐츠 생성은 /guide/[region]/[keyword] 라우트가 SSR 렌더.
    // 큐는 단순히 "승인 → ready" 트랜지션만 담당.
    let activated = 0;
    for (const r of rows as any[]) {
      const { error } = await (sb as any)
        .from('programmatic_seo_queue')
        .update({ status: 'ready', content_ready: true, completed_at: new Date().toISOString() })
        .eq('id', r.id);
      if (!error) activated++;
    }
    return NextResponse.json({ ok: true, activated });
  } catch {
    return new NextResponse('ok', { status: 200 });
  }
}

export const GET = handler;
export const POST = handler;
