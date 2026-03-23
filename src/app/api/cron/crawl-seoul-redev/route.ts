import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';

const SERVICE_NAME = 'upisRebuild';

const TYPE_MAP: Record<string, string> = {
  '재개발사업지구': '재개발',
  '주택재개발사업지구': '재개발',
  '도시환경정비사업지구': '재개발',
  '주거환경개선사업지구': '재개발',
  '재건축사업지구': '재건축',
  '주택재건축사업지구': '재건축',
};

function guessStage(row: Record<string, any>): string {
  // 여러 필드에서 단계 추정
  const text = [
    row.STEP_SE_NM, row.STTUS_NM, row.BSNS_STEP_NM, row.PRGRS_STTUS,
    row.STEP_SE, row.BSNS_STTUS, row.RPTT_STTUS,
  ].filter(Boolean).join(' ');

  if (!text) {
    // text가 없으면 날짜 필드로 추정
    if (row.COMPT_DE || row.USE_APRV_DE) return '준공';
    if (row.CNSTRN_BGN_DE || row.CONSRT_BGNDE) return '착공';
    if (row.DSPSL_PLANPSS_DE || row.MGT_DSPSL_DE) return '관리처분';
    if (row.BSNS_ATHZ_DE || row.BSNS_PMS_DE) return '사업시행인가';
    if (row.UNION_FNDTN_DE || row.ASSTN_APRVL_DE) return '조합설립';
    return '정비구역지정';
  }

  if (/준공|완료|입주|사용승인/.test(text)) return '준공';
  if (/착공|공사|시공/.test(text)) return '착공';
  if (/관리처분/.test(text)) return '관리처분';
  if (/사업시행|시행인가/.test(text)) return '사업시행인가';
  if (/조합설립|조합인가/.test(text)) return '조합설립';
  if (/구역지정|정비구역|안전진단/.test(text)) return '정비구역지정';
  return '정비구역지정';
}

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
  if (!apiKey) return NextResponse.json({ error: 'SEOUL_DATA_API_KEY not set' }, { status: 200 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const result = await withCronLogging('crawl-seoul-redev', async () => {
    const baseUrl = `http://openapi.seoul.go.kr:8088/${apiKey}/json/${SERVICE_NAME}`;

    // 1) 전체 건수 파악
    const countRes = await fetch(`${baseUrl}/1/1/`);
    const countText = await countRes.text();
    let countData: any;
    try { countData = JSON.parse(countText); } catch {
      throw new Error('Invalid JSON from Seoul API: ' + countText.slice(0, 300));
    }

    const totalCount = countData?.[SERVICE_NAME]?.list_total_count || 0;
    if (totalCount === 0) {
      return { processed: 0, created: 0, failed: 0, metadata: { api_name: 'seoul_opendata', api_calls: 1, filtered: 0, deduped: 0 } };
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
      stage: guessStage(r),
      total_households: (() => { const v = r.TOT_HSHLD_CO || r.HSHLD_CO || r.PLAN_HSHLD_CO || r.HO_CNT || null; const n = v ? parseInt(v) : null; return n && n > 0 && n < 100000 ? n : null; })(),
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

    return {
      processed: allRows.length,
      created: inserted,
      failed: insertErrors.length,
      metadata: { api_name: 'seoul_opendata', api_calls: Math.ceil(totalCount / 1000) + 1, filtered: filtered.length, deduped: unique.length },
    };
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 200 });
  }
  return NextResponse.json({ ok: true, ...result });
}
