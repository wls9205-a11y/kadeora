/**
 * /api/calc/result — 계산기 결과 영구 URL 시스템
 *
 * POST: 결과 저장 → short_id 반환
 * GET ?shortId=xxx: 결과 조회 (view_count 자동 +1)
 */

import { NextRequest, NextResponse } from 'next/server';
import { saveCalcResult, getCalcResult } from '@/lib/calc/result-share';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getConfig } from '@/lib/app-config';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // 마스터 킬 체크
  const cfg = await getConfig('calc_seo', { auto_share_url: true });
  if (!cfg.auto_share_url) {
    return NextResponse.json({ error: 'share_url_disabled' }, { status: 503 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { calcSlug, calcCategory, inputs, result } = body;
  if (!calcSlug || !calcCategory || !inputs || !result) {
    return NextResponse.json({ error: 'missing_required_fields' }, { status: 400 });
  }

  // 옵셔널 유저 ID
  let userId: string | null = null;
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    userId = user?.id ?? null;
  } catch { /* 비로그인 OK */ }

  // 메타데이터 (referer / UA)
  const refererDomain = (() => {
    try { return new URL(req.headers.get('referer') || '').hostname || null; }
    catch { return null; }
  })();
  const ua = req.headers.get('user-agent') || '';
  const userAgentBrief = ua.slice(0, 80);

  try {
    const shortId = await saveCalcResult({
      calcSlug, calcCategory, inputs, result,
      userId, refererDomain, userAgentBrief,
    });
    return NextResponse.json({
      shortId,
      url: `/calc/${calcCategory}/${calcSlug}/r/${shortId}`,
      fullUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app'}/calc/${calcCategory}/${calcSlug}/r/${shortId}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'save_failed', detail: e?.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const shortId = req.nextUrl.searchParams.get('shortId');
  if (!shortId) return NextResponse.json({ error: 'shortId_required' }, { status: 400 });

  const result = await getCalcResult(shortId);
  if (!result) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json(result);
}
