import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.BUSAN_DATA_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'BUSAN_DATA_API_KEY not set' }, { status: 500 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
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
      return NextResponse.json({ message: 'No data or check API response structure', totalCount: 0 });
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

    const mapped = allRows
      .filter(r => r && typeof r === 'object')
      .map(r => {
        const bizType = r.bsnsTp || r.bsnsSe || r.projectType || '';
        const isRebuild = bizType.includes('재건축');
        return {
          district_name: r.guynm || r.bsnsNm || r.zoneName || '미상',
          region: '부산',
          sigungu: r.guNm || r.sggNm || null,
          project_type: isRebuild ? '재건축' : '재개발',
          stage: stageMap[r.stepSe || r.bsnsStep || ''] || '기타',
          total_households: r.totHshldCo ? parseInt(r.totHshldCo) : null,
          constructor: r.cnstrctEntrps || r.builder || null,
          address: r.adres || r.lcAdres || null,
          notes: r.rm || null,
          source: 'busan_opendata',
          is_active: true,
        };
      });

    // 4) Full refresh
    await supabase.from('redevelopment_projects').delete().eq('source', 'busan_opendata');

    let inserted = 0;
    for (let i = 0; i < mapped.length; i += 100) {
      const batch = mapped.slice(i, i + 100);
      const { error } = await supabase.from('redevelopment_projects').insert(batch);
      if (!error) inserted += batch.length;
    }

    return NextResponse.json({
      message: 'Busan redevelopment data refreshed',
      total_from_api: allRows.length,
      inserted,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
