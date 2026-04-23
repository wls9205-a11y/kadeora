/**
 * 세션 146 A5 — 백링크 동기화. GSC links API 우선, 주 1회.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) return new NextResponse('ok', { status: 200 });

  // GSC links API 는 access_token 필요. refreshAccessToken 재사용 대신 gsc-sync 와 후속 통합.
  // 현재는 placeholder: gsc_search_analytics 의 referrer 데이터로부터 external domain 을 backlink_sources 에 upsert.
  try {
    const sb = getSupabaseAdmin();
    const { data: rows } = await (sb as any).rpc('aggregate_external_referrers', { p_days: 7 }).catch(() => ({ data: null }));
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ ok: true, skipped: 'no_referrer_rpc' });
    }
    let upserted = 0;
    for (const r of rows) {
      const { error } = await (sb as any)
        .from('backlink_sources')
        .upsert(
          { domain: r.domain, url: r.url || null, anchor: r.anchor || null, source: 'referrer_log', last_seen: new Date().toISOString() },
          { onConflict: 'domain,url' }
        );
      if (!error) upserted++;
    }
    return NextResponse.json({ ok: true, upserted });
  } catch (e: any) {
    return NextResponse.json({ ok: true, skipped: 'exception', err: String(e?.message || '').slice(0, 120) });
  }
}

export const GET = handler;
export const POST = handler;
