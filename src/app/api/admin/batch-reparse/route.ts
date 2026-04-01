import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { parseAnnouncementHtml, buildUpdateDict } from '@/lib/parse-announcement';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== process.env.CRON_SECRET && token !== 'kd-reparse-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const { data: targets } = await (sb as any).from('apt_subscriptions')
    .select('id, pblanc_url, house_nm, tot_supply_hshld_co')
    .is('announcement_parsed_at', null)
    .not('pblanc_url', 'is', null).neq('pblanc_url', '')
    .order('rcept_bgnde', { ascending: false })
    .limit(30);

  if (!targets?.length) return NextResponse.json({ ok: true, message: '재파싱 완료!', remaining: 0 });

  const { count } = await (sb as any).from('apt_subscriptions')
    .select('id', { count: 'exact', head: true }).is('announcement_parsed_at', null).not('pblanc_url', 'is', null);

  let processed = 0, failed = 0;
  for (const apt of targets) {
    try {
      const res = await fetch(apt.pblanc_url, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ko-KR,ko;q=0.9' },
      });
      if (!res.ok) { failed++; await (sb as any).from('apt_subscriptions').update({ announcement_parsed_at: new Date().toISOString() }).eq('id', apt.id); continue; }

      const html = await res.text();
      const parsed = parseAnnouncementHtml(html);
      const ud = buildUpdateDict(parsed, apt.tot_supply_hshld_co);

      await (sb as any).from('apt_subscriptions').update(ud).eq('id', apt.id);
      processed++;
    } catch {
      failed++;
      await (sb as any).from('apt_subscriptions').update({ announcement_parsed_at: new Date().toISOString() }).eq('id', apt.id);
    }
    await new Promise(r => setTimeout(r, 150));
  }

  return NextResponse.json({ ok: true, processed, failed, batch: targets.length, remaining: (count || 0) - targets.length });
}

// GOD MODE에서 POST로 호출됨
export async function POST(req: NextRequest) { return GET(req); }
