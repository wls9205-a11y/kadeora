import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 30;

// POST /api/admin/fix-apt
// actions: fix_supply_mismatch, recalc_supply, verify_batch, update_household
export async function POST(req: NextRequest) {
  const sbServer = await createSupabaseServer();
  const { data: { user } } = await sbServer.auth.getUser();
  if (!user) return NextResponse.json({ error: 'login required' }, { status: 401 });
  const sb = getSupabaseAdmin();
  const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: 'admin only' }, { status: 403 });

  const body = await req.json();
  const { action, id, value } = body;

  // 개별 현장 총세대수 수정
  if (action === 'update_household' && id && value) {
    const hh = Number(value);
    if (!hh || hh <= 0) return NextResponse.json({ error: 'invalid value' }, { status: 400 });
    await (sb as any).from('apt_subscriptions').update({ total_households: hh }).eq('id', id);
    return NextResponse.json({ ok: true, id, total_households: hh });
  }

  // house_type_info에서 일반/특별 공급수 재계산
  if (action === 'recalc_supply') {
    const { data: targets } = await (sb as any).from('apt_subscriptions')
      .select('id, house_nm, tot_supply_hshld_co, general_supply_total, special_supply_total, house_type_info')
      .not('house_type_info', 'is', null)
      .limit(200);

    let fixed = 0;
    for (const t of (targets || [])) {
      const types = Array.isArray(t.house_type_info) ? t.house_type_info : [];
      if (!types.length) continue;
      const genSum = types.reduce((s: number, tt: any) => s + (Number(tt.supply) || 0), 0);
      const speSum = types.reduce((s: number, tt: any) => s + (Number(tt.spsply_hshldco) || 0), 0);
      const total = genSum + speSum;

      const updates: Record<string, any> = {};
      // general_supply_total이 비었거나 다르면 업데이트
      if (genSum > 0 && t.general_supply_total !== genSum) updates.general_supply_total = genSum;
      if (speSum > 0 && t.special_supply_total !== speSum) updates.special_supply_total = speSum;
      // tot_supply_hshld_co가 0이거나 합계와 다르면 업데이트
      if (total > 0 && (!t.tot_supply_hshld_co || Math.abs(t.tot_supply_hshld_co - total) > 2)) {
        updates.tot_supply_hshld_co = total;
      }

      if (Object.keys(updates).length > 0) {
        await (sb as any).from('apt_subscriptions').update(updates).eq('id', t.id);
        fixed++;
      }
    }
    return NextResponse.json({ ok: true, checked: (targets || []).length, fixed });
  }

  // 총세대 < 공급세대 비정상 데이터 수정 (총세대를 null로 리셋)
  if (action === 'fix_supply_mismatch') {
    const { data: mismatched } = await (sb as any).from('apt_subscriptions')
      .select('id, house_nm, tot_supply_hshld_co, total_households')
      .not('total_households', 'is', null)
      .not('tot_supply_hshld_co', 'is', null)
      .gt('tot_supply_hshld_co', 0)
      .gt('total_households', 0);

    let fixed = 0;
    for (const m of (mismatched || [])) {
      if (Number(m.total_households) < Number(m.tot_supply_hshld_co)) {
        // 총세대 < 공급세대 = 비정상 → 총세대를 null로 리셋 (재검증 대상)
        await (sb as any).from('apt_subscriptions').update({ total_households: null }).eq('id', m.id);
        fixed++;
      }
    }
    return NextResponse.json({ ok: true, checked: (mismatched || []).length, fixed });
  }

  // K-apt 자동검증 일괄 실행
  if (action === 'verify_batch') {
    try {
      const cronSecret = process.env.CRON_SECRET;
      const requestUrl = new URL(req.url);
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${requestUrl.protocol}//${requestUrl.host}`;
      const res = await fetch(`${baseUrl}/api/cron/auto-verify-households`, {
        headers: cronSecret ? { 'Authorization': `Bearer ${cronSecret}` } : {},
        signal: AbortSignal.timeout(60000),
      });
      const data = await res.json();
      return NextResponse.json({ ok: true, ...data });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e.message });
    }
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
