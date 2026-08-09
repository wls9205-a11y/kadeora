import { errMsg } from '@/lib/error-utils';
export const maxDuration = 30;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();

    // s274: 보존 기간을 90일로 통일.
    //
    // 이 라우트는 30일, /api/cron/cleanup 은 90일로 같은 테이블에 서로 다른
    // 보존 정책을 적용하고 있었다. 현재 vercel.json 에는 100 cron 한도 때문에
    // (s192) 이 라우트가 등록돼 있지 않지만, /api/admin/god-mode 에서 수동
    // 실행이 가능하고 한도가 풀리면 다시 등록될 예정이다. 그 순간 60일치
    // page_views 가 조용히 사라진다 — 개선 전후 비교의 기준선이 날아간다.
    //
    // 두 값이 갈라져 있는 것 자체가 사고 원인이므로 cleanup 쪽 90일에 맞춘다.
    const RETENTION_DAYS = 90;
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await admin
      .from('page_views')
      .delete()
      .lt('created_at', cutoff)
      .select('id');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 200 });
    }

    const deleted = data?.length ?? 0;
    return NextResponse.json({ ok: true, deleted });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 200 });
  }
}
