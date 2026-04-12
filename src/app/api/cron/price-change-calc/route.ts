import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 120;

/**
 * price_change_1y 자동 계산 크론
 * 매주 월요일 06:30 (vercel.json)
 * apt_transactions 기반 1년 가격 변동률 JS 계산
 */
export async function GET() {
  const result = await withCronLogging('price-change-calc', async () => {
    const sb = getSupabaseAdmin();
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const recent3m = fmt(new Date(now.getTime() - 90 * 86400000));
    const recent6m = fmt(new Date(now.getTime() - 180 * 86400000));
    const past12m = fmt(new Date(now.getTime() - 365 * 86400000));
    const past15m = fmt(new Date(now.getTime() - 456 * 86400000));
    const past18m = fmt(new Date(now.getTime() - 548 * 86400000));

    // Phase 1: 최근 3개월 + 12~15개월 전
    const [{ data: rd }, { data: pd }] = await Promise.all([
      sb.from('apt_transactions').select('apt_name, deal_amount').gte('deal_date', recent3m).gt('deal_amount', 0),
      sb.from('apt_transactions').select('apt_name, deal_amount').gte('deal_date', past15m).lt('deal_date', past12m).gt('deal_amount', 0),
    ]);

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const group = (data: any[]) => {
      const m = new Map<string, number[]>();
      for (const t of data) { const a = m.get(t.apt_name) || []; a.push(t.deal_amount); m.set(t.apt_name, a); }
      return m;
    };

    const rMap = group(rd || []), pMap = group(pd || []);
    const updates: { name: string; change: number }[] = [];

    for (const [name, rp] of rMap) {
      if (rp.length < 2) continue;
      const pp = pMap.get(name);
      if (!pp || pp.length < 2) continue;
      const pAvg = avg(pp);
      if (pAvg <= 0) continue;
      const chg = Math.round((avg(rp) - pAvg) / pAvg * 1000) / 10;
      if (Math.abs(chg) < 200) updates.push({ name, change: chg });
    }

    // Phase 2: 완화 (6개월/18개월, 1건+) — Phase 1 미처리만
    const [{ data: r6d }, { data: p18d }] = await Promise.all([
      sb.from('apt_transactions').select('apt_name, deal_amount').gte('deal_date', recent6m).gt('deal_amount', 0),
      sb.from('apt_transactions').select('apt_name, deal_amount').gte('deal_date', past18m).lt('deal_date', past12m).gt('deal_amount', 0),
    ]);
    const r6 = group(r6d || []), p18 = group(p18d || []);
    const done = new Set(updates.map(u => u.name));

    for (const [name, rp] of r6) {
      if (done.has(name)) continue;
      const pp = p18.get(name);
      if (!pp || pp.length < 1) continue;
      const pAvg = avg(pp);
      if (pAvg <= 0) continue;
      const chg = Math.round((avg(rp) - pAvg) / pAvg * 1000) / 10;
      if (Math.abs(chg) < 200) updates.push({ name, change: chg });
    }

    // 배치 업데이트
    let updated = 0;
    for (let i = 0; i < updates.length; i += 50) {
      const batch = updates.slice(i, i + 50);
      const results = await Promise.allSettled(
        batch.map(u => (sb as any).from('apt_complex_profiles')
          .update({ price_change_1y: u.change, updated_at: new Date().toISOString() })
          .eq('apt_name', u.name))
      );
      updated += results.filter(r => r.status === 'fulfilled').length;
    }

    return { processed: updates.length, metadata: { updated, phase1: done.size, phase2: updates.length - done.size } };
  });

  return NextResponse.json({ ok: true, ...result });
}
