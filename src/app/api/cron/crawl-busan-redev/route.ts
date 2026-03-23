import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.BUSAN_DATA_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'BUSAN_DATA_API_KEY not set' }, { status: 200 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const result = await withCronLogging('crawl-busan-redev', async () => {
    const BASE_URL = 'https://apis.data.go.kr/6260000/MaintenanceBusinessStatus1/getMaintenanceBusiness1';

    // 1) 전체 건수 파악
    const firstRes = await fetch(
      `${BASE_URL}?serviceKey=${encodeURIComponent(apiKey)}&pageNo=1&numOfRows=1&resultType=json`
    );
    const firstData = await firstRes.json();
    const totalCount = firstData?.response?.body?.totalCount ||
                       firstData?.getMaintenanceBusiness1?.body?.totalCount || 0;

    if (totalCount === 0) {
      console.log('[crawl-busan-redev] first response:', JSON.stringify(firstData).slice(0, 500));
      return { processed: 0, created: 0, failed: 0, metadata: { api_name: 'busan_opendata', api_calls: 1, sampleFields: [], sampleRow: null } };
    }

    // 2) 전체 데이터 (100건씩 페이징)
    const allRows: any[] = [];
    const totalPages = Math.ceil(totalCount / 100);

    for (let page = 1; page <= totalPages && page <= 50; page++) {
      const res = await fetch(
        `${BASE_URL}?serviceKey=${encodeURIComponent(apiKey)}&pageNo=${page}&numOfRows=100&resultType=json`
      );
      const data = await res.json();
      const items = data?.response?.body?.items?.item ||
                    data?.getMaintenanceBusiness1?.body?.items?.item || [];
      const rows = Array.isArray(items) ? items : items ? [items] : [];
      allRows.push(...rows);
    }

    // 3) 매핑
    const stageMap: Record<string, string> = {
      '정비구역지정': '정비구역지정',
      '추진위원회승인': '조합설립', '조합설립인가': '조합설립',
      '사업시행인가': '사업시행인가',
      '관리처분계획인가': '관리처분', '관리처분인가': '관리처분',
      '착공': '착공', '준공': '준공',
    };

    // 첫 행의 모든 키를 응답에 포함 (디버깅용)
    const sampleFields = allRows[0] ? Object.keys(allRows[0]) : [];

    // 필드 탐색 헬퍼
    const find = (row: any, candidates: string[]): string | null => {
      for (const c of candidates) {
        if (row[c] != null && String(row[c]).trim() !== '') return String(row[c]).trim();
      }
      return null;
    };

    const mapped = allRows
      .filter(r => r && typeof r === 'object')
      .map(r => {
        const bizType = find(r, ['bsnsTp', 'bsnsSe', 'projectType', 'bsnsClNm', 'bsnsCl']) || '';
        const isRebuild = bizType.includes('재건축');
        return {
          district_name: find(r, ['guynm', 'guyNm', 'bsnsNm', 'bsnsnm', 'zoneName', 'zoneNm', 'sbjctNm', 'nm']) || find(r, Object.keys(r).filter(k => typeof r[k] === 'string' && r[k].length > 2 && r[k].length < 50)) || '미상',
          region: '부산',
          sigungu: find(r, ['guNm', 'sggNm', 'gu', 'gugun']) || null,
          project_type: isRebuild ? '재건축' : '재개발',
          stage: stageMap[find(r, ['stepSe', 'bsnsStep', 'stepNm', 'sttusSe']) || ''] || '기타',
          total_households: (() => { const v = find(r, ['totHshldCo', 'hshldCo', 'planHshldCo', 'houseCnt', 'totalHouseCnt', 'totHo', 'planHo', 'planCo', 'hoCnt']); const n = v ? parseInt(v) : null; return n && n > 0 && n < 100000 ? n : null; })(),
          constructor: r.cnstrctEntrps || r.builder || null,
          address: r.adres || r.lcAdres || null,
          notes: r.rm || null,
          source: 'busan_opendata',
          is_active: true,
        };
      });

    // 3.5) Fix misplaced district_name values (address-like patterns)
    for (const item of mapped) {
      if (item.district_name && (item.district_name.includes('번길') || /로\s/.test(item.district_name) || /구\s/.test(item.district_name))) {
        // district_name looks like an address - move it and generate a name
        if (!item.address) {
          item.address = item.district_name;
        }
        const sigungu = item.sigungu || '부산';
        item.district_name = `${sigungu} ${item.project_type} 정비사업`;
      }
    }

    // 4) Full refresh
    await supabase.from('redevelopment_projects').delete().eq('source', 'busan_opendata');

    let inserted = 0;
    for (let i = 0; i < mapped.length; i += 100) {
      const batch = mapped.slice(i, i + 100);
      const { error } = await supabase.from('redevelopment_projects').insert(batch);
      if (!error) inserted += batch.length;
    }

    return {
      processed: allRows.length,
      created: inserted,
      failed: 0,
      metadata: {
        api_name: 'busan_opendata',
        api_calls: Math.ceil(totalCount / 100) + 1,
        sampleFields: allRows[0] ? Object.keys(allRows[0]) : [],
        sampleRow: allRows[0] || null,
      },
    };
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 200 });
  }
  return NextResponse.json({ ok: true, ...result });
}
