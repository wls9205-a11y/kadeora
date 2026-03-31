import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { parseAnnouncementHtml, buildUpdateDict } from '@/lib/parse-announcement';

export const maxDuration = 120;

/**
 * 모집공고문 파싱 크론 (v3 — 공유 파서 모듈 사용)
 * 배치 50건, 건당 300ms 대기, 4시간마다 실행
 */
export const GET = withCronAuth(async (_req: NextRequest) => {
  const sb = getSupabaseAdmin();

  const { data: targets } = await (sb as any).from('apt_subscriptions')
    .select('id, house_manage_no, pblanc_url, house_nm, tot_supply_hshld_co')
    .is('announcement_parsed_at', null)
    .not('pblanc_url', 'is', null)
    .neq('pblanc_url', '')
    .order('rcept_bgnde', { ascending: false })
    .limit(50);

  if (!targets?.length) return NextResponse.json({ ok: true, message: '파싱 대상 없음', processed: 0 });

  let processed = 0, failed = 0;
  const errors: string[] = [];

  for (const apt of targets) {
    try {
      if (!apt.pblanc_url) { failed++; continue; }
      const res = await fetch(apt.pblanc_url, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'ko-KR,ko;q=0.9' },
      });
      if (!res.ok) { failed++; await (sb as any).from('apt_subscriptions').update({ announcement_parsed_at: new Date().toISOString() }).eq('id', apt.id); continue; }

      const html = await res.text();
      const parsed = parseAnnouncementHtml(html);
      const ud = buildUpdateDict(parsed, apt.tot_supply_hshld_co);

      await (sb as any).from('apt_subscriptions').update(ud).eq('id', apt.id);
      processed++;
    } catch (err: any) {
      failed++;
      errors.push(`${apt.house_nm}: ${err.message?.slice(0, 60)}`);
      await (sb as any).from('apt_subscriptions').update({ announcement_parsed_at: new Date().toISOString() }).eq('id', apt.id);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.info(`[apt-parse-announcement] processed=${processed} failed=${failed}`);
  return NextResponse.json({ ok: true, processed, failed, batch: targets.length, errors: errors.slice(0, 5) });
});
