import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const SERVICE_NAME = 'upisRebuild';

const TYPE_MAP: Record<string, string> = {
  '재개발사업지구': '재개발',
  '주택재개발사업지구': '재개발',
  '도시환경정비사업지구': '재개발',
  '주거환경개선사업지구': '재개발',
  '재건축사업지구': '재건축',
  '주택재건축사업지구': '재건축',
};

function extractGu(pstn: string | null): string | null {
  if (!pstn) return null;
  const match = pstn.match(/([\uAC00-\uD7AF]+구)/);
  return match ? match[1] : null;
}

function getProjectType(sclsf: string): string | null {
  for (const [key, val] of Object.entries(TYPE_MAP)) {
    if (sclsf.includes(key)) return val;
  }
  return null;
}

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
    const baseUrl = `http://openapi.seoul.go.kr:8088/${apiKey}/json/${SERVICE_NAME}`;

    // 1) 전체 건수 파악
    const countRes = await fetch(`${baseUrl}/1/1/`);
    const countText = await countRes.text();
    let countData: any;
    try { countData = JSON.parse(countText); } catch {
      return NextResponse.json({ error: 'Invalid JSON', raw: countText.slice(0, 300) });
    }

    const totalCount = countData?.[SERVICE_NAME]?.list_total_count || 0;
    if (totalCount === 0) {
      return NextResponse.json({
        message: 'No data from Seoul API',
        keys: Object.keys(countData),
        sample: countText.slice(0, 300),
      });
    }

    // 2) 전체 데이터 (1000건씩 페이징)
    const allRows: any[] = [];
    for (let start = 1; start <= totalCount; start += 1000) {
      const end = Math.min(start + 999, totalCount);
      const res = await fetch(`${baseUrl}/${start}/${end}/`);
      const data = await res.json();
      const rows = data?.[SERVICE_NAME]?.row || [];
      allRows.push(...rows);
    }

    // 3) 재개발/재건축만 필터 + PRJC_CD 기준 중복 제거 (최신 건 유지)
    const filtered = allRows.filter(r => getProjectType(r.SCLSF || '') !== null);

    // PRJC_CD 기준 중복 제거 — 같은 사업코드에서 마지막 건만 유지
    const deduped = new Map<string, any>();
    for (const r of filtered) {
      const key = r.PRJC_CD || r.RGN_NM || r.PSTN_NM || Math.random().toString();
      deduped.set(key, r); // 뒤에 오는 건이 덮어씀 (최신)
    }
    const unique = Array.from(deduped.values());

    // 4) 매핑
    const mapped = unique.map(r => ({
      district_name: r.RGN_NM || r.PSTN_NM || '미상',
      region: '서울',
      sigungu: extractGu(r.PSTN_NM),
      project_type: getProjectType(r.SCLSF || '') || '재개발',
      stage: '기타',
      area_sqm: parseFloat(r.AREA_CHG_AFTR || r.AREA_EXS || '0') || null,
      address: r.PSTN_NM || null,
      notes: r.SCLSF || null,
      source: 'seoul_opendata',
      is_active: true,
    }));

    // 5) Full refresh
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
      total_from_api: allRows.length,
      filtered: filtered.length,
      deduped: unique.length,
      inserted,
      ...(insertErrors.length > 0 ? { insertErrors: insertErrors.slice(0, 3) } : {}),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
