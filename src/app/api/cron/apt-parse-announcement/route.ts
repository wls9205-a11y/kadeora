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

    let processed = 0, failed = 0, emptyParse = 0, writeFailed = 0;
    const errors: string[] = [];
    // 파싱이 비었을 때 HTML 앞부분을 남긴다 — 구조가 어떻게 바뀌었는지 알 방법이
    // 지금까지 «전혀» 없었다. 최대 2건만.
    const htmlSamples: string[] = [];

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

          // buildUpdateDict 는 항상 announcement_parsed_at 을 넣는다.
          // 그것 «말고» 아무것도 못 뽑았으면 파싱 실패로 센다.
          if (Object.keys(ud).filter(k => k !== 'announcement_parsed_at').length === 0) {
            emptyParse++;
            const failCount = (apt.parse_fail_count || 0) + 1;
            const upd: Record<string, any> = { parse_fail_count: failCount };
            // 빈 파싱에도 3회 기준을 적용한다 — 안 그러면 같은 50건을 영원히 다시 잡는다.
            if (failCount >= 3) upd.announcement_parsed_at = new Date().toISOString();
            await (sb as any).from('apt_subscriptions').update(upd).eq('id', apt.id);
            errors.push(`${apt.house_nm}: 빈 파싱 (fail ${failCount})`);
            if (htmlSamples.length < 2) htmlSamples.push(`${apt.house_manage_no}: ${html.slice(0, 500)}`);
            continue;
          }
        }

        // ⚠️ 영향 행 수를 «반드시» 확인한다.
        //   .select() 없이 update 만 던지면 PostgREST 오류(없는 컬럼 → PGRST204 등)가
        //   조용히 삼켜지고 processed++ 가 그대로 돈다. 실제로 4/28 이후 133건이
        //   그렇게 «8,950건 처리, 결과 0건» 으로 보고됐다. 원인은 contact_tel 컬럼
        //   부재였고, 없는 컬럼 하나가 update 전체를 원자적으로 실패시켰다.
        const { data: updated, error: upErr } = await (sb as any)
          .from('apt_subscriptions').update(ud).eq('id', apt.id).select('id');

        if (upErr || !updated || updated.length === 0) {
          writeFailed++;
          const failCount = (apt.parse_fail_count || 0) + 1;
          const upd: Record<string, any> = { parse_fail_count: failCount };
          if (failCount >= 3) upd.announcement_parsed_at = new Date().toISOString();
          await (sb as any).from('apt_subscriptions').update(upd).eq('id', apt.id);
          errors.push(`${apt.house_nm}: 저장 실패 ${upErr?.code || ''} ${(upErr?.message || '영향 0행').slice(0, 80)}`);
          continue;
        }
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

    // processed 는 «실제로 저장된» 건수다. 빈 파싱·저장 실패는 여기 안 들어간다.
    return {
      processed,
      created: processed,
      failed: failed + emptyParse + writeFailed,
      metadata: {
        batch: targets.length,
        saved: processed,
        empty_parse: emptyParse,
        write_failed: writeFailed,
        fetch_failed: failed,
        errors: errors.slice(0, 5),
        html_samples: htmlSamples,
      },
    };
  });

  return NextResponse.json(result);
});
