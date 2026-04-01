import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

const NAVER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://new.land.naver.com/',
};

interface NaverComplex {
  complexNo: string;
  complexName: string;
  totalHouseholdCount?: number;
  totalDongCount?: number;
  highFloor?: number;
  lowFloor?: number;
  useApproveYmd?: string;
  heatMethodTypeCode?: string;
  parkingCountByHousehold?: number;
}

// 1. 네이버 부동산에서 단지 검색 → complexNo 획득
async function searchComplex(keyword: string): Promise<{ complexNo: string; name: string } | null> {
  try {
    const url = `https://new.land.naver.com/api/search?keyword=${encodeURIComponent(keyword)}`;
    const res = await fetch(url, { headers: NAVER_HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    // complexes 배열에서 첫 번째 결과
    const complexes = data?.complexes || [];
    if (!complexes.length) return null;
    return { complexNo: complexes[0].complexNo, name: complexes[0].complexName };
  } catch {
    return null;
  }
}

// 2. complexNo로 단지 상세 조회 → 총세대수 등
async function getComplexOverview(complexNo: string): Promise<NaverComplex | null> {
  try {
    const url = `https://new.land.naver.com/api/complexes/${complexNo}?sameAddressGroup=false`;
    const res = await fetch(url, { headers: NAVER_HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      complexNo,
      complexName: data.complexName,
      totalHouseholdCount: Number(data.totalHouseholdCount) || 0,
      totalDongCount: Number(data.totalDongCount) || 0,
      highFloor: Number(data.highFloor) || 0,
      lowFloor: Number(data.lowFloor) || 0,
      useApproveYmd: data.useApproveYmd,
      heatMethodTypeCode: data.heatMethodTypeCode,
      parkingCountByHousehold: data.parkingCountByHousehold ? parseFloat(data.parkingCountByHousehold) : 0,
    };
  } catch {
    return null;
  }
}

// 단지명 유사도 (fuzzy match)
function similarity(a: string, b: string): number {
  const na = a.replace(/[^가-힣a-zA-Z0-9]/g, '').toLowerCase();
  const nb = b.replace(/[^가-힣a-zA-Z0-9]/g, '').toLowerCase();
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  // 공통 문자 비율
  const set = new Set(na.split(''));
  const match = nb.split('').filter(c => set.has(c)).length;
  return match / Math.max(na.length, nb.length);
}

async function handler(_req: NextRequest) {
  const sb = getSupabaseAdmin();

  // 대상: 재개발/재건축이면서 total_households가 NULL인 건 (우선 대형 순)
  const { data: targets } = await (sb
    .from('apt_subscriptions')
    .select('id, house_nm, region_nm, tot_supply_hshld_co, total_dong_count, max_floor, constructor_nm')
    .in('project_type', ['재개발', '재건축'])
    .is('total_households', null)
    .order('tot_supply_hshld_co', { ascending: false })
    .limit(15) as any); // rate limit 고려 배치 15건

  if (!targets?.length) {
    return { processed: 0, created: 0, updated: 0, failed: 0, metadata: { message: 'No targets' } };
  }

  let updated = 0;
  let failed = 0;
  const results: any[] = [];

  for (const t of targets) {
    // rate limit: 요청 간 1초 대기
    await new Promise(r => setTimeout(r, 1000));

    try {
      // 1. 검색
      let searchResult = await searchComplex(t.house_nm);
      if (!searchResult) {
        // 단지명 축약해서 재시도
        const shortName = t.house_nm.split(' ').slice(0, 2).join(' ');
        const retry = shortName !== t.house_nm ? await searchComplex(shortName) : null;
        if (!retry) {
          results.push({ id: t.id, name: t.house_nm, status: 'search_fail' });
          failed++;
          continue;
        }
        searchResult = retry;
      }

      // 유사도 검증
      const sim = similarity(t.house_nm, searchResult.name);
      if (sim < 0.4) {
        results.push({ id: t.id, name: t.house_nm, naver: searchResult.name, sim: sim.toFixed(2), status: 'name_mismatch' });
        failed++;
        continue;
      }

      // 2. 상세 조회
      await new Promise(r => setTimeout(r, 500));
      const overview = await getComplexOverview(searchResult.complexNo);
      if (!overview || !overview.totalHouseholdCount || overview.totalHouseholdCount <= 0) {
        results.push({ id: t.id, name: t.house_nm, complexNo: searchResult.complexNo, status: 'no_household_data' });
        failed++;
        continue;
      }

      // 3. 검증: 네이버 총세대수가 공급세대수보다 작으면 이상
      if (overview.totalHouseholdCount < t.tot_supply_hshld_co) {
        results.push({ id: t.id, name: t.house_nm, naver_hh: overview.totalHouseholdCount, supply: t.tot_supply_hshld_co, status: 'naver_less_than_supply' });
        failed++;
        continue;
      }

      // 4. DB 업데이트
      const updateData: Record<string, any> = {
        total_households: overview.totalHouseholdCount,
      };
      // 동수/최고층/주차 등 보충
      if ((overview.totalDongCount ?? 0) > 0 && (!t.total_dong_count || t.total_dong_count === 0)) {
        updateData.total_dong_count = overview.totalDongCount;
      }
      if ((overview.highFloor ?? 0) > 0 && (!t.max_floor || t.max_floor === 0)) {
        updateData.max_floor = overview.highFloor;
      }
      if ((overview.parkingCountByHousehold ?? 0) > 0) {
        updateData.parking_ratio = String(overview.parkingCountByHousehold);
      }

      await sb.from('apt_subscriptions').update(updateData).eq('id', t.id);

      results.push({
        id: t.id, name: t.house_nm,
        naver_name: overview.complexName,
        naver_hh: overview.totalHouseholdCount,
        supply: t.tot_supply_hshld_co,
        ratio: (overview.totalHouseholdCount / t.tot_supply_hshld_co).toFixed(2),
        extras: Object.keys(updateData).filter(k => k !== 'total_households'),
        status: 'updated',
      });
      updated++;

    } catch (err: any) {
      results.push({ id: t.id, name: t.house_nm, error: err?.message?.slice(0, 50), status: 'error' });
      failed++;
    }
  }

  return {
    processed: targets.length,
    created: 0,
    updated,
    failed,
    metadata: { results: results.slice(0, 20) },
  };
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const authHeader = req.headers.get('authorization');
  if (token !== process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await withCronLogging('naver-complex-sync', () => handler(req));
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const result = await withCronLogging('naver-complex-sync', () => handler(req));
  return NextResponse.json(result);
}
