import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.MOLIT_STAT_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'MOLIT_STAT_API_KEY not set' }, { status: 500 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const result = await withCronLogging('crawl-unsold-molit', async () => {
    // 최신 월 데이터 (보통 2~3개월 전까지 제공)
    const now = new Date();
    const attempts = [2, 3, 4]; // 2개월 전, 3개월 전, 4개월 전 순서로 시도
    let formList: any[] = [];
    let usedMonth = '';

    for (const monthsAgo of attempts) {
      const target = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
      const yyyymm = `${target.getFullYear()}${String(target.getMonth() + 1).padStart(2, '0')}`;
      const url = `http://stat.molit.go.kr/portal/openapi/service/rest/getList.do?key=${apiKey}&form_id=2082&style_num=128&start_dt=${yyyymm}&end_dt=${yyyymm}`;

      const res = await fetch(url);
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { continue; }

      if (data?.result_data?.formList?.length > 0) {
        formList = data.result_data.formList;
        usedMonth = yyyymm;
        break;
      }
    }

    if (formList.length === 0) {
      return { processed: 0, created: 0, failed: 0, metadata: { api_name: 'molit_stat', api_calls: attempts.length, month: '', summaryStored: false } };
    }

    // 시군구별 미분양 매핑 (합계 행 제외, 0세대 제외)
    const mapped = formList
      .filter((r: any) => r['시군구'] && r['시군구'] !== '계' && r['시군구'] !== '소계')
      .filter((r: any) => {
        const val = parseInt(String(r['미분양현황'] || '0').replace(/,/g, ''));
        return val > 0;
      })
      .map((r: any) => ({
        region_nm: (r['구분'] || '').replace(/특별시|광역시|특별자치시|특별자치도/g, '').trim(),
        sigungu_nm: r['시군구'],
        house_nm: `${(r['구분'] || '').replace(/특별시|광역시|특별자치시|특별자치도/g, '').trim()} ${r['시군구']} 미분양`,
        tot_unsold_hshld_co: parseInt(String(r['미분양현황'] || '0').replace(/,/g, '')),
        source: 'molit_stat',
        is_active: true,
        fetched_at: new Date().toISOString(),
      }));

    // Full refresh (molit_stat 소스만)
    await supabase.from('unsold_apts').delete().eq('source', 'molit_stat');

    let inserted = 0;
    for (let i = 0; i < mapped.length; i += 100) {
      const batch = mapped.slice(i, i + 100);
      const { error } = await supabase.from('unsold_apts').insert(batch);
      if (error) {
        console.error('[crawl-unsold-molit] insert error:', error.message);
      } else {
        inserted += batch.length;
      }
    }

    // 종합 데이터도 가져와서 캐시에 저장
    let summaryStored = false;
    try {
      const year = String(now.getFullYear() - 1); // 전년도 연간 데이터
      const summaryUrl = `http://stat.molit.go.kr/portal/openapi/service/rest/getList.do?key=${apiKey}&form_id=2086&style_num=713&start_dt=${year}&end_dt=${year}`;
      const summaryRes = await fetch(summaryUrl);
      const summaryText = await summaryRes.text();
      let summaryData: any;
      try { summaryData = JSON.parse(summaryText); } catch { summaryData = null; }

      const summaryList = summaryData?.result_data?.formList || [];
      if (summaryList.length > 0) {
        const lastCol = Object.keys(summaryList[0]).find(k => k.includes('월기준') || k.includes('12월'));
        const getVal = (item: any) => {
          if (!item) return 0;
          const val = lastCol ? item[lastCol] : Object.values(item).pop();
          return parseInt(String(val || '0').replace(/,/g, ''));
        };

        const byRegion = summaryList
          .filter((r: any) => r['대분류'] === '시도별미분양현황' && !['전국', '수도권', '지방'].includes(r['구분']))
          .map((r: any) => ({ name: r['구분'], value: getVal(r) }));

        const summary = {
          total: getVal(summaryList.find((r: any) => r['대분류'] === '시도별미분양현황' && r['구분'] === '전국')),
          after_completion: getVal(summaryList.find((r: any) => r['구분']?.includes('준공후'))),
          capital: getVal(summaryList.find((r: any) => r['구분'] === '수도권')),
          local: getVal(summaryList.find((r: any) => r['구분'] === '지방')),
          by_region: byRegion,
          year,
          month: usedMonth,
        };

        await supabase.from('apt_cache').upsert({
          cache_type: 'unsold_summary',
          data: summary,
          refreshed_at: new Date().toISOString(),
        }, { onConflict: 'cache_type' });
        summaryStored = true;
      }
    } catch (e) {
      console.error('[crawl-unsold-molit] summary error:', e);
    }

    return {
      processed: formList.length,
      created: inserted,
      updated: 0,
      failed: formList.length - mapped.length,
      metadata: { api_name: 'molit_stat', api_calls: attempts.length + 1, month: usedMonth, summaryStored },
    };
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...result });
}
