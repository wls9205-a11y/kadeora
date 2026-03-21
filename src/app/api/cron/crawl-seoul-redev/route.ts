import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.SEOUL_DATA_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'SEOUL_DATA_API_KEY not set' }, { status: 500 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 1) 첫 호출로 응답 구조 확인
    const countUrl = `http://openapi.seoul.go.kr:8088/${apiKey}/json/CleanupBizInfo/1/5/`;
    const countRes = await fetch(countUrl);
    const rawText = await countRes.text();
    let countData: any;
    try { countData = JSON.parse(rawText); } catch {
      return NextResponse.json({ error: 'Invalid JSON from Seoul API', raw: rawText.slice(0, 500) });
    }

    // 응답 키 탐색 — 서비스명이 다를 수 있음
    const topKeys = Object.keys(countData);
    const serviceKey = topKeys.find(k => countData[k]?.list_total_count != null) || topKeys[0];

    if (!serviceKey || !countData[serviceKey]) {
      return NextResponse.json({
        error: 'Cannot find service data in Seoul API response',
        topKeys,
        sample: rawText.slice(0, 500),
      });
    }

    const svc = countData[serviceKey];
    const totalCount = svc.list_total_count || 0;
    const sampleRows = svc.row || [];
    const sampleFieldNames = sampleRows.length > 0 ? Object.keys(sampleRows[0]) : [];

    if (totalCount === 0) {
      return NextResponse.json({
        message: 'No data from Seoul API',
        serviceKey,
        totalCount: 0,
        sampleFieldNames,
        resultCode: svc?.RESULT?.CODE,
        resultMsg: svc?.RESULT?.MESSAGE,
      });
    }

    // 2) 전체 데이터 (1000건씩 페이징)
    const allRows: any[] = [...sampleRows];
    if (totalCount > 5) {
      for (let start = 6; start <= totalCount; start += 1000) {
        const end = Math.min(start + 999, totalCount);
        const res = await fetch(
          `http://openapi.seoul.go.kr:8088/${apiKey}/json/${serviceKey === 'CleanupBizInfo' ? 'CleanupBizInfo' : serviceKey}/${start}/${end}/`
        );
        const data = await res.json();
        const rows = data?.[serviceKey]?.row || [];
        allRows.push(...rows);
      }
    }

    // 3) 매핑 — 필드명 자동 탐색
    const stageMap: Record<string, string> = {
      '기본계획': '정비구역지정', '정비구역지정': '정비구역지정',
      '추진위승인': '조합설립', '조합설립인가': '조합설립', '조합설립': '조합설립',
      '사업시행인가': '사업시행인가', '사업시행계획인가': '사업시행인가',
      '관리처분인가': '관리처분', '관리처분계획인가': '관리처분',
      '착공': '착공', '준공': '준공', '이전고시': '준공',
    };

    const typeMap: Record<string, string> = {
      '재개발사업': '재개발', '주택재개발사업': '재개발', '재개발': '재개발',
      '주거환경개선사업': '재개발', '도시환경정비사업': '재개발',
      '재건축사업': '재건축', '주택재건축사업': '재건축', '재건축': '재건축',
    };

    // 필드명 자동 탐색 (다양한 API 버전 대응)
    const findField = (row: any, candidates: string[]): string | null => {
      for (const c of candidates) {
        if (row[c] != null && row[c] !== '') return row[c];
      }
      return null;
    };

    const mapped = allRows
      .filter(r => {
        const bizType = findField(r, ['BIZ_CL_NM', 'BSNS_CL_NM', 'PROJECT_TYPE', 'biz_cl_nm']) || '';
        return typeMap[bizType] != null;
      })
      .map(r => {
        const bizType = findField(r, ['BIZ_CL_NM', 'BSNS_CL_NM', 'PROJECT_TYPE', 'biz_cl_nm']) || '';
        return {
          district_name: findField(r, ['ZONE_NM', 'BIZ_NM', 'GUYK_NM', 'zone_nm', 'biz_nm']) || '미상',
          region: '서울',
          sigungu: findField(r, ['GU_NM', 'SIGNGU_NM', 'gu_nm']) || null,
          project_type: typeMap[bizType] || '재개발',
          stage: stageMap[findField(r, ['STEP_SE_NM', 'STEP_NM', 'step_se_nm']) || ''] || '기타',
          area_sqm: (() => { const v = findField(r, ['ZONE_AR', 'zone_ar']); return v ? parseFloat(v) : null; })(),
          total_households: (() => { const v = findField(r, ['TOTAR_HSHLD_CO', 'TOT_HSHLD_CO', 'totar_hshld_co']); return v ? parseInt(v) : null; })(),
          constructor: findField(r, ['CMPNY_NM', 'BUILDER_NM', 'cmpny_nm']) || null,
          address: findField(r, ['ZONE_ADRES', 'ADRES', 'zone_adres']) || null,
          notes: (() => { const bn = findField(r, ['BIZ_NM', 'biz_nm']); const zn = findField(r, ['ZONE_NM', 'zone_nm']); return bn && bn !== zn ? bn : null; })(),
          source: 'seoul_opendata',
          is_active: true,
        };
      });

    // 4) Full refresh
    await supabase.from('redevelopment_projects').delete().eq('source', 'seoul_opendata');

    let inserted = 0;
    let insertErrors: string[] = [];
    for (let i = 0; i < mapped.length; i += 100) {
      const batch = mapped.slice(i, i + 100);
      const { error } = await supabase.from('redevelopment_projects').insert(batch);
      if (!error) inserted += batch.length;
      else insertErrors.push(error.message);
    }

    return NextResponse.json({
      message: 'Seoul redevelopment data refreshed',
      serviceKey,
      sampleFieldNames,
      total_from_api: allRows.length,
      filtered: mapped.length,
      inserted,
      ...(insertErrors.length > 0 ? { insertErrors: insertErrors.slice(0, 3) } : {}),
      ...(mapped.length === 0 ? { sampleRow: allRows[0] ? Object.entries(allRows[0]).slice(0, 10) : null } : {}),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
