import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GYEONGGI_DATA_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'GYEONGGI_DATA_API_KEY not set' }, { status: 500 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 여러 서비스명 후보 시도
    const SERVICE_CANDIDATES = ['Ggcleanupbiz', 'UrbanMntncBizInfo', 'URBMNTNCBIZ', 'GgClnupBsnsSttus'];
    let allRows: any[] = [];
    let usedService = '';
    let debugInfo: any = {};

    for (const svc of SERVICE_CANDIDATES) {
      try {
        const testUrl = `https://openapi.gg.go.kr/${svc}?KEY=${apiKey}&Type=json&pIndex=1&pSize=5`;
        const testRes = await fetch(testUrl);
        const testText = await testRes.text();
        let testData: any;
        try { testData = JSON.parse(testText); } catch { continue; }

        // 경기도 API 응답 구조: { 서비스명: [{ head: [...] }, { row: [...] }] }
        const svcData = testData?.[svc];
        if (!svcData || !Array.isArray(svcData)) {
          debugInfo[svc] = { keys: Object.keys(testData), sample: testText.slice(0, 300) };
          continue;
        }

        const head = svcData[0]?.head;
        const rows = svcData[1]?.row || [];
        if (rows.length > 0) {
          usedService = svc;
          allRows = [...rows];
          debugInfo[svc] = { status: 'found', headCount: head?.[0]?.list_total_count, sampleFields: Object.keys(rows[0]) };

          // 나머지 페이지 가져오기
          const totalCount = head?.[0]?.list_total_count || rows.length;
          if (totalCount > 5) {
            let page = 2;
            while (allRows.length < totalCount && page <= 50) {
              const res = await fetch(`https://openapi.gg.go.kr/${svc}?KEY=${apiKey}&Type=json&pIndex=${page}&pSize=100`);
              const data = await res.json();
              const moreRows = data?.[svc]?.[1]?.row || [];
              if (moreRows.length === 0) break;
              allRows.push(...moreRows);
              page++;
            }
          }
          break;
        } else {
          debugInfo[svc] = { status: 'empty_rows', keys: Object.keys(testData) };
        }
      } catch (e: any) {
        debugInfo[svc] = { error: e.message };
      }
    }

    if (allRows.length === 0) {
      return NextResponse.json({
        message: 'No data found from Gyeonggi API',
        triedServices: SERVICE_CANDIDATES,
        debugInfo,
      });
    }

    const stageMap: Record<string, string> = {
      '정비구역지정': '정비구역지정', '정비구역 지정': '정비구역지정',
      '추진위원회승인': '조합설립', '조합설립인가': '조합설립', '조합설립': '조합설립',
      '사업시행인가': '사업시행인가', '사업시행계획인가': '사업시행인가',
      '관리처분계획인가': '관리처분', '관리처분인가': '관리처분',
      '착공': '착공', '준공': '준공',
    };

    const findField = (row: any, candidates: string[]): string | null => {
      for (const c of candidates) {
        if (row[c] != null && row[c] !== '') return String(row[c]);
      }
      return null;
    };

    const mapped = allRows.map(r => {
      const bizType = findField(r, ['BIZ_CL', 'BSNS_CL_NM', 'BIZ_CL_NM', 'PJCT_SE_NM']) || '';
      return {
        district_name: findField(r, ['BIZPLC_NM', 'ZONE_NM', 'BSNS_NM', 'GUYK_NM']) || '미상',
        region: '경기',
        sigungu: findField(r, ['SIGUN_NM', 'SGG_NM']) || null,
        project_type: bizType.includes('재건축') ? '재건축' : '재개발',
        stage: stageMap[findField(r, ['STEP_NM', 'BSNS_STEP_NM', 'PRGRS_STTUS']) || ''] || '기타',
        total_households: (() => { const v = findField(r, ['BILDNG_HSHLD_CO', 'TOT_HSHLD_CO', 'HSHLD_CO']); return v ? parseInt(v) : null; })(),
        constructor: findField(r, ['CMPNY_NM', 'CNSTRCT_ENTRPS']) || null,
        address: findField(r, ['ADRES', 'REFINE_LOTNO_ADDR', 'REFINE_ROADNM_ADDR']) || null,
        source: 'gyeonggi_opendata',
        is_active: true,
      };
    });

    await supabase.from('redevelopment_projects').delete().eq('source', 'gyeonggi_opendata');

    let inserted = 0;
    let insertErrors: string[] = [];
    for (let i = 0; i < mapped.length; i += 100) {
      const batch = mapped.slice(i, i + 100);
      const { error } = await supabase.from('redevelopment_projects').insert(batch);
      if (!error) inserted += batch.length;
      else insertErrors.push(error.message);
    }

    return NextResponse.json({
      message: 'Gyeonggi redevelopment data refreshed',
      usedService,
      sampleFields: allRows[0] ? Object.keys(allRows[0]) : [],
      total: allRows.length,
      inserted,
      ...(insertErrors.length > 0 ? { insertErrors: insertErrors.slice(0, 3) } : {}),
      ...(inserted === 0 ? { debugInfo, sampleRow: allRows[0] } : {}),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
