import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 120;

const TIMEOUT_MS = 5000;

async function fetchT(url: string, headers: Record<string, string>): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    clearTimeout(timer);
    return res;
  } catch (err: any) {
    clearTimeout(timer);
    console.log(`[naver] ${err?.name === 'AbortError' ? 'timeout' : err?.message?.slice(0, 40)}: ${url.slice(0, 60)}`);
    return null;
  }
}

const H1 = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', Accept: 'application/json', Referer: 'https://new.land.naver.com/' };
const H2 = { ...H1, Referer: 'https://fin.land.naver.com/' };

async function searchComplex(keyword: string): Promise<{ complexNo: string; name: string } | null> {
  console.log(`[naver] search: ${keyword}`);
  // 1차: new.land
  let res = await fetchT(`https://new.land.naver.com/api/search?keyword=${encodeURIComponent(keyword)}`, H1);
  // 2차: fin.land
  if (!res || !res.ok) res = await fetchT(`https://fin.land.naver.com/front-api/v1/search/complex?keyword=${encodeURIComponent(keyword)}`, H2);
  if (!res || !res.ok) { console.log(`[naver] search fail: ${keyword}`); return null; }
  try {
    const data = await res.json();
    const list = data?.complexes || data?.result?.list || data?.result?.complexes || [];
    if (!list.length) return null;
    return { complexNo: list[0].complexNo || list[0].complexNumber || '', name: list[0].complexName || list[0].name || '' };
  } catch { return null; }
}

async function getDetail(complexNo: string) {
  console.log(`[naver] detail: ${complexNo}`);
  let res = await fetchT(`https://new.land.naver.com/api/complexes/${complexNo}?sameAddressGroup=false`, H1);
  if (!res || !res.ok) res = await fetchT(`https://fin.land.naver.com/front-api/v1/complex/overview?complexNumber=${complexNo}`, H2);
  if (!res || !res.ok) { console.log(`[naver] detail fail: ${complexNo}`); return null; }
  try {
    const data = await res.json();
    const d = data?.result || data;
    return {
      name: d.complexName || d.name || '',
      hh: Number(d.totalHouseholdCount || d.totalHouseHoldCount || d.householdCount || 0),
      dong: Number(d.totalDongCount || d.dongCount || 0),
      floor: Number(d.highFloor || d.maxFloor || 0),
      parking: d.parkingCountByHousehold ? parseFloat(d.parkingCountByHousehold) : 0,
    };
  } catch { return null; }
}

function sim(a: string, b: string): number {
  const na = a.replace(/[^가-힣a-zA-Z0-9]/g, '');
  const nb = b.replace(/[^가-힣a-zA-Z0-9]/g, '');
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  const s = new Set(na.split(''));
  return nb.split('').filter(c => s.has(c)).length / Math.max(na.length, nb.length);
}

async function handler(_req: NextRequest) {
  const sb = getSupabaseAdmin();
  console.log('[naver] start');

  const { data: targets } = await (sb.from('apt_subscriptions')
    .select('id, house_nm, region_nm, tot_supply_hshld_co, total_dong_count, max_floor')
    .in('project_type', ['재개발', '재건축']).is('total_households', null)
    .order('tot_supply_hshld_co', { ascending: false }).limit(3) as any);

  if (!targets?.length) return { processed: 0, created: 0, updated: 0, failed: 0, metadata: { message: 'No targets' } };
  console.log(`[naver] ${targets.length} targets (top: ${targets[0].house_nm})`);

  let updated = 0, failed = 0;
  const results: any[] = [];

  for (const t of targets) {
    await new Promise(r => setTimeout(r, 800));
    try {
      let sr = await searchComplex(t.house_nm);
      if (!sr) { const short = t.house_nm.split(' ').slice(0, 2).join(' '); sr = short !== t.house_nm ? await searchComplex(short) : null; }
      if (!sr) { results.push({ name: t.house_nm, status: 'search_fail' }); failed++; continue; }

      if (sim(t.house_nm, sr.name) < 0.4) { results.push({ name: t.house_nm, naver: sr.name, status: 'mismatch' }); failed++; continue; }

      await new Promise(r => setTimeout(r, 500));
      const d = await getDetail(sr.complexNo);
      if (!d || d.hh <= 0) { results.push({ name: t.house_nm, status: 'no_data' }); failed++; continue; }
      if (d.hh < t.tot_supply_hshld_co) { results.push({ name: t.house_nm, naver_hh: d.hh, supply: t.tot_supply_hshld_co, status: 'hh<supply' }); failed++; continue; }

      const upd: Record<string, any> = { total_households: d.hh };
      if (d.dong > 0 && !t.total_dong_count) upd.total_dong_count = d.dong;
      if (d.floor > 0 && !t.max_floor) upd.max_floor = d.floor;
      if (d.parking > 0) upd.parking_ratio = String(d.parking);

      await sb.from('apt_subscriptions').update(upd).eq('id', t.id);
      console.log(`[naver] ✅ ${t.house_nm} → ${d.hh}세대`);
      results.push({ name: t.house_nm, naver: d.name, hh: d.hh, supply: t.tot_supply_hshld_co, status: 'updated' });
      updated++;
    } catch (err: any) {
      console.log(`[naver] ❌ ${t.house_nm}: ${err?.message?.slice(0, 50)}`);
      results.push({ name: t.house_nm, error: err?.message?.slice(0, 50), status: 'error' });
      failed++;
    }
  }

  console.log(`[naver] done: ${updated} updated, ${failed} failed`);
  return { processed: targets.length, created: 0, updated, failed, metadata: { results } };
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const auth = req.headers.get('authorization');
  if (token !== process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await withCronLogging('naver-complex-sync', () => handler(req));
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await withCronLogging('naver-complex-sync', () => handler(req));
  return NextResponse.json(result);
}
