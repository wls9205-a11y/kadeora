import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * 재개발 세대수 검증 수집 크론
 * - total_households가 NULL인 프로젝트 대상
 * - 서울 URIS API / 부산 API / 전국 data.go.kr에서 세대수 재수집
 * - 공식 출처 데이터만 반영 (STATUS.md 주의사항 준수)
 * 
 * 주 1회 실행 (매주 화요일 04:00 KST)
 */

export const maxDuration = 120;

// 서울 URIS API에서 세대수 조회
async function fetchSeoulHouseholds(districtName: string): Promise<number | null> {
  try {
    const apiKey = process.env.SEOUL_API_KEY || process.env.BUSAN_DATA_API_KEY;
    if (!apiKey) return null;
    const encoded = encodeURIComponent(districtName.replace(/\s/g, ''));
    const url = `http://openapi.seoul.go.kr:8088/${apiKey}/json/upisRebuild/1/5/${encoded}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const items = data?.upisRebuild?.row;
    if (!items?.length) return null;
    // 최신 항목에서 세대수 추출
    const item = items[0];
    const households = parseInt(item.TOTAR_HSHLD_CO || item.PLNNG_HSHLD_CO || '0');
    return households > 0 ? households : null;
  } catch { return null; }
}

// data.go.kr 정비사업정보서비스에서 세대수 조회
async function fetchNationwideHouseholds(districtName: string, sigunguCode?: string): Promise<number | null> {
  try {
    const apiKey = process.env.BUSAN_DATA_API_KEY || process.env.MOLIT_STAT_API_KEY;
    if (!apiKey) return null;
    const url = `https://apis.data.go.kr/1613000/MntncBizInfoSvc/getMntncBizList?serviceKey=${encodeURIComponent(apiKey)}&numOfRows=10&pageNo=1&resultType=json${sigunguCode ? `&sigunguCd=${sigunguCode}` : ''}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    const items = data?.response?.body?.items?.item;
    if (!items) return null;
    const list = Array.isArray(items) ? items : [items];
    // 이름 매칭
    const match = list.find((item: any) => {
      const name = item.bsnNm || item.pjtNm || '';
      return name.includes(districtName) || districtName.includes(name);
    });
    if (!match) return null;
    const households = parseInt(match.totHshldCo || '0');
    return households > 0 ? households : null;
  } catch { return null; }
}

export const GET = withCronAuth(async (_req: NextRequest) => {
  const sb = getSupabaseAdmin();
  
  // NULL 세대수 프로젝트 조회
  const { data: projects } = await sb.from('redevelopment_projects')
    .select('id, district_name, region, sigungu')
    .eq('is_active', true)
    .is('total_households', null)
    .limit(30); // 한번에 30건씩 (API 부하 방지)

  if (!projects?.length) {
    return NextResponse.json({ ok: true, message: '검증 대상 없음 (전체 세대수 확인 완료)', updated: 0 });
  }

  let updated = 0;
  let failed = 0;
  const results: { name: string; region: string; households: number | null }[] = [];

  for (const p of projects) {
    let households: number | null = null;

    if (p.region === '서울') {
      households = await fetchSeoulHouseholds(p.district_name);
    }

    // 서울 실패 시 또는 다른 지역 → 전국 API 시도
    if (!households) {
      households = await fetchNationwideHouseholds(p.district_name);
    }

    results.push({ name: p.district_name, region: p.region, households });

    if (households && households > 0) {
      const { error } = await sb.from('redevelopment_projects')
        // @ts-expect-error supabase update type
        .update({ total_households: households })
        .eq('id', p.id);
      if (!error) updated++;
      else failed++;
    }

    // API 과부하 방지
    await new Promise(r => setTimeout(r, 300));
  }

  console.info(`[redev-verify-households] scanned=${projects.length} updated=${updated} failed=${failed}`);

  return NextResponse.json({
    ok: true,
    scanned: projects.length,
    updated,
    failed,
    results: results.slice(0, 10), // 상위 10건만 응답
  });
});
