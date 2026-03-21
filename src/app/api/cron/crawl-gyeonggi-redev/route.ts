import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

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
    const SERVICE_NAME = 'Ggcleanupbiz';
    const allRows: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const res = await fetch(
        `https://openapi.gg.go.kr/${SERVICE_NAME}?KEY=${apiKey}&Type=json&pIndex=${page}&pSize=100`
      );
      const data = await res.json();
      const rows = data?.[SERVICE_NAME]?.[1]?.row || [];
      if (rows.length === 0) { hasMore = false; } else { allRows.push(...rows); page++; }
      if (page > 20) break;
    }

    const stageMap: Record<string, string> = {
      '정비구역지정': '정비구역지정',
      '추진위원회승인': '조합설립', '조합설립인가': '조합설립',
      '사업시행인가': '사업시행인가',
      '관리처분계획인가': '관리처분',
      '착공': '착공', '준공': '준공',
    };

    const mapped = allRows.map(r => ({
      district_name: r.BIZPLC_NM || r.ZONE_NM || '미상',
      region: '경기',
      sigungu: r.SIGUN_NM || null,
      project_type: (r.BIZ_CL || '').includes('재건축') ? '재건축' : '재개발',
      stage: stageMap[r.STEP_NM] || '기타',
      total_households: r.BILDNG_HSHLD_CO ? parseInt(r.BILDNG_HSHLD_CO) : null,
      constructor: r.CMPNY_NM || null,
      address: r.ADRES || null,
      source: 'gyeonggi_opendata',
      is_active: true,
    }));

    await supabase.from('redevelopment_projects').delete().eq('source', 'gyeonggi_opendata');

    let inserted = 0;
    for (let i = 0; i < mapped.length; i += 100) {
      const batch = mapped.slice(i, i + 100);
      const { error } = await supabase.from('redevelopment_projects').insert(batch);
      if (!error) inserted += batch.length;
    }

    return NextResponse.json({
      message: 'Gyeonggi redevelopment data refreshed',
      total: allRows.length,
      inserted,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
