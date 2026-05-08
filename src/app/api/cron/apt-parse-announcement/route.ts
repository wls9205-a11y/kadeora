import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { parseAnnouncementHtml, buildUpdateDict } from '@/lib/parse-announcement';

export const maxDuration = 120;

/**
 * 모집공고문 파싱 크론 (v4 — withCronLogging + 실패 재시도)
 * 배치 50건, 건당 300ms 대기, 4시간마다 실행
 * v4: fetch 실패 시 재시도 가능 (3회 실패 후 포기)
 */
export const GET = withCronAuth(async (_req: NextRequest) => {
  const result = await withCronLogging('apt-parse-announcement', async () => {
    const sb = getSupabaseAdmin();

    const { data: targets } = await (sb as any).from('apt_subscriptions')
      .select('id, house_manage_no, pblanc_url, house_nm, tot_supply_hshld_co, parse_fail_count')
      .is('announcement_parsed_at', null)
      .not('pblanc_url', 'is', null)
      .neq('pblanc_url', '')
      .order('rcept_bgnde', { ascending: false })
      .limit(50);

    if (!targets?.length) {
      return { processed: 0, created: 0, failed: 0, metadata: { message: '파싱 대상 없음' } };
    }

    let processed = 0, failed = 0;
    const errors: string[] = [];

    for (const apt of targets) {
      try {
        if (!apt.pblanc_url) { failed++; continue; }
        const res = await fetch(apt.pblanc_url, {
          signal: AbortSignal.timeout(10000),
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'ko-KR,ko;q=0.9' },
        });
        if (!res.ok) {
          failed++;
          const failCount = (apt.parse_fail_count || 0) + 1;
          const update: Record<string, any> = { parse_fail_count: failCount };
          if (failCount >= 3) update.announcement_parsed_at = new Date().toISOString();
          await (sb as any).from('apt_subscriptions').update(update).eq('id', apt.id);
          errors.push(`${apt.house_nm}: HTTP ${res.status}`);
          continue;
        }

        // s258 patch #5: content-type 분기 — PDF 가정 silent fail 방지
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        const isPdf = ct.includes('pdf') || apt.pblanc_url.endsWith('.pdf');
        const ud: Record<string, any> = {};
        if (isPdf) {
          // PDF 응답: parser.ts 의 parseAnnouncementDoc 사용 (별도 cron 책임)
          // 여기서는 raw_text 만 저장하고 parsed_at 마크 (다음 cron 이 파싱)
          ud.announcement_parsed_at = new Date().toISOString();
          ud.pdf_parse_version = 0; // 미파싱 상태 표시
        } else {
          // HTML: 기존 파서 그대로
          const html = await res.text();
          const parsed = parseAnnouncementHtml(html);
          Object.assign(ud, buildUpdateDict(parsed, apt.tot_supply_hshld_co));
        }
        await (sb as any).from('apt_subscriptions').update(ud).eq('id', apt.id);
        processed++;
      } catch (err: any) {
        failed++;
        const failCount = (apt.parse_fail_count || 0) + 1;
        errors.push(`${apt.house_nm}: ${err.message?.slice(0, 60)}`);
        const update: Record<string, any> = { parse_fail_count: failCount };
        if (failCount >= 3) update.announcement_parsed_at = new Date().toISOString();
        await (sb as any).from('apt_subscriptions').update(update).eq('id', apt.id);
      }
      await new Promise(r => setTimeout(r, 300));
    }

    return { processed, created: processed, failed, metadata: { batch: targets.length, errors: errors.slice(0, 5) } };
  });

  return NextResponse.json(result);
});
