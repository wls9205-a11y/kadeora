import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isBudgetChoice, isCallTimeChoice, leadPilotArm } from '@/lib/apt/lead-pilot';

/**
 * E-12 리드폼 파일럿 — 스위치 조회(GET) · 선택 입력 저장(POST).
 * ⚠️ 스위치는 DB(app_config e12.pilot_enabled)가 정본이다. 자동 회수(fn_e12_pilot_guard)가 끄면 60초 안에 폼에서 사라진다.
 * ⚠️ 저장은 «실험군 현장 · 스위치 켜짐 · 선택지 안의 값» 만. 이름·연락처는 받지 않는다(leads 와 leadRef 로만 잇는다).
 */
export const dynamic = 'force-dynamic';

async function pilotEnabled(): Promise<boolean> {
  try {
    const { data } = await (getSupabaseAdmin() as any).from('app_config').select('value').eq('namespace', 'e12').eq('key', 'pilot_enabled').maybeSingle();
    return data?.value === true;
  } catch {
    return false;
  }
}

export async function GET() {
  return NextResponse.json({ enabled: await pilotEnabled() }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' } });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const leadRef = String(body?.leadRef ?? '').slice(0, 80);
    const siteSlug = String(body?.siteSlug ?? '').slice(0, 200);
    const budget = isBudgetChoice(body?.budget) ? body.budget : null;
    const callTime = isCallTimeChoice(body?.callTime) ? body.callTime : null;
    if (!leadRef || !siteSlug || (!budget && !callTime)) return NextResponse.json({ ok: true, skipped: 'empty' });
    if (leadPilotArm(siteSlug) !== 'exp') return NextResponse.json({ ok: true, skipped: 'not_experiment_arm' });
    if (!(await pilotEnabled())) return NextResponse.json({ ok: true, skipped: 'pilot_off' });
    const { error } = await (getSupabaseAdmin() as any).from('lead_pilot_extras')
      .upsert({ lead_ref: leadRef, site_slug: siteSlug, arm: 'exp', budget_range: budget, call_time: callTime }, { onConflict: 'lead_ref', ignoreDuplicates: true });
    if (error) return NextResponse.json({ ok: false }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
