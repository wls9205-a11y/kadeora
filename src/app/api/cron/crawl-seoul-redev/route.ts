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
    // 1) 전체 건수 파악
    const countRes = await fetch(
      `http://openapi.seoul.go.kr:8088/${apiKey}/json/CleanupBizInfo/1/1/`
    );
    const countData = await countRes.json();
    const totalCount = countData?.CleanupBizInfo?.list_total_count || 0;

    if (totalCount === 0) {
      return NextResponse.json({ message: 'No data from Seoul API', count: 0 });
    }

    // 2) 전체 데이터 (1000건씩 페이징)
    const allRows: any[] = [];
    for (let start = 1; start <= totalCount; start += 1000) {
      const end = Math.min(start + 999, totalCount);
      const res = await fetch(
        `http://openapi.seoul.go.kr:8088/${apiKey}/json/CleanupBizInfo/${start}/${end}/`
      );
      const data = await res.json();
      const rows = data?.CleanupBizInfo?.row || [];
      allRows.push(...rows);
    }

    // 3) 매핑
    const stageMap: Record<string, string> = {
      '기본계획': '정비구역지정', '정비구역지정': '정비구역지정',
      '추진위승인': '조합설립', '조합설립인가': '조합설립',
      '사업시행인가': '사업시행인가',
      '관리처분인가': '관리처분',
      '착공': '착공', '준공': '준공',
    };

    const typeMap: Record<string, string> = {
      '재개발사업': '재개발', '주택재개발사업': '재개발',
      '주거환경개선사업': '재개발', '도시환경정비사업': '재개발',
      '재건축사업': '재건축', '주택재건축사업': '재건축',
    };

    const mapped = allRows
      .filter(r => typeMap[r.BIZ_CL_NM] != null)
      .map(r => ({
        district_name: r.ZONE_NM || r.BIZ_NM || '미상',
        region: '서울',
        sigungu: r.GU_NM || null,
        project_type: typeMap[r.BIZ_CL_NM] || '재개발',
        stage: stageMap[r.STEP_SE_NM] || '기타',
        area_sqm: r.ZONE_AR ? parseFloat(r.ZONE_AR) : null,
        total_households: r.TOTAR_HSHLD_CO ? parseInt(r.TOTAR_HSHLD_CO) : null,
        constructor: r.CMPNY_NM || null,
        address: r.ZONE_ADRES || null,
        notes: r.BIZ_NM && r.BIZ_NM !== r.ZONE_NM ? r.BIZ_NM : null,
        source: 'seoul_opendata',
        is_active: true,
      }));

    // 4) Full refresh
    await supabase.from('redevelopment_projects').delete().eq('source', 'seoul_opendata');

    let inserted = 0;
    for (let i = 0; i < mapped.length; i += 100) {
      const batch = mapped.slice(i, i + 100);
      const { error } = await supabase.from('redevelopment_projects').insert(batch);
      if (!error) inserted += batch.length;
    }

    return NextResponse.json({
      message: 'Seoul redevelopment data refreshed',
      total_from_api: allRows.length,
      filtered: mapped.length,
      inserted,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
