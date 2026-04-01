import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 120;

const KAPT_KEY = process.env.KAPT_API_KEY || process.env.KAPT_APT_KEY || '';
const SIDO_CODE: Record<string, string> = {
  '서울':'11','부산':'26','대구':'27','인천':'28','광주':'29','대전':'30',
  '울산':'31','세종':'36','경기':'41','강원':'42','충북':'43','충남':'44',
  '전북':'45','전남':'46','경북':'47','경남':'48','제주':'50',
};

function parseAddr(addr: string) {
  const m = addr.match(/([가-힣]+(?:시|구|군))\s+(?:([가-힣]+구)\s+)?([가-힣]+(?:동|읍|면|리|가))/);
  return m ? { sigungu: m[2] ? `${m[1]} ${m[2]}` : m[1], dong: m[3] || '' } : null;
}

function sim(a: string, b: string): number {
  const n = (s: string) => s.replace(/\s+|아파트|단지|[0-9]/g, '');
  const na = n(a), nb = n(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  const set = new Set(na.split(''));
  return nb.split('').filter(c => set.has(c)).length / Math.max(na.length, nb.length);
}

async function fetchJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;
  return res.json();
}

async function getSigunguCode(sidoCode: string, sigunguName: string): Promise<string | null> {
  const data = await fetchJson(`https://apis.data.go.kr/1613000/AptListServiceV4/getSiGunGuListV4?serviceKey=${encodeURIComponent(KAPT_KEY)}&sidoCode=${sidoCode}&type=json`);
  if (!data) return null;
  const items = data?.response?.body?.items?.item || [];
  const list = Array.isArray(items) ? items : items ? [items] : [];
  const keyword = sigunguName.replace(/특별자치|광역/g, '').trim();
  for (const sg of list) {
    const name = sg.sigunguNm || '';
    if (name === keyword || name.includes(keyword) || keyword.includes(name)) return sg.sigunguCode || null;
  }
  const short = keyword.replace(/시|구|군/g, '');
  for (const sg of list) {
    if ((sg.sigunguNm || '').replace(/시|구|군/g, '').includes(short)) return sg.sigunguCode || null;
  }
  return null;
}

async function searchKapt(bjdCode: string): Promise<{ kaptCode: string; kaptName: string }[]> {
  const data = await fetchJson(`https://apis.data.go.kr/1613000/AptListServiceV4/getLegaldongAptListV4?serviceKey=${encodeURIComponent(KAPT_KEY)}&bjdCode=${bjdCode}&type=json&numOfRows=200`);
  if (!data) return [];
  const items = data?.response?.body?.items?.item || [];
  return (Array.isArray(items) ? items : items ? [items] : []).map((i: any) => ({ kaptCode: i.kaptCode, kaptName: i.kaptName }));
}

async function getKaptDetail(kaptCode: string) {
  const data = await fetchJson(`https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfoV4?serviceKey=${encodeURIComponent(KAPT_KEY)}&kaptCode=${kaptCode}&type=json`);
  if (!data) return null;
  const item = data?.response?.body?.item || data?.body?.item;
  if (!item) return null;
  return { hh: parseInt(item.kaptdaCnt) || 0, dong: parseInt(item.kaptDongCnt) || 0, name: item.kaptName || '' };
}

async function handler(_req: NextRequest) {
  const sb = getSupabaseAdmin();
  if (!KAPT_KEY) return { processed: 0, created: 0, updated: 0, failed: 0, metadata: { error: 'KAPT_API_KEY missing' } };

  const { data: targets } = await (sb.from('apt_subscriptions')
    .select('id, house_nm, hssply_adres, region_nm, tot_supply_hshld_co')
    .in('project_type', ['재개발', '재건축']).is('total_households', null)
    .not('hssply_adres', 'is', null)
    .order('tot_supply_hshld_co', { ascending: false }).limit(10) as any);

  if (!targets?.length) return { processed: 0, created: 0, updated: 0, failed: 0, metadata: { message: 'All verified' } };

  let updated = 0, failed = 0;
  const results: any[] = [];

  for (const t of targets) {
    await new Promise(r => setTimeout(r, 300));
    try {
      const sidoCode = SIDO_CODE[t.region_nm];
      if (!sidoCode) { results.push({ name: t.house_nm, s: 'no_sido' }); failed++; continue; }
      const parsed = parseAddr(t.hssply_adres || '');
      if (!parsed) { results.push({ name: t.house_nm, s: 'parse_fail' }); failed++; continue; }

      const sgCode = await getSigunguCode(sidoCode, parsed.sigungu);
      if (!sgCode) { results.push({ name: t.house_nm, sg: parsed.sigungu, s: 'sg_fail' }); failed++; continue; }

      const aptList = await searchKapt(sgCode);
      if (!aptList.length) { results.push({ name: t.house_nm, s: 'empty_list' }); failed++; continue; }

      let best = { code: '', name: '', score: 0 };
      for (const apt of aptList) {
        const score = sim(t.house_nm, apt.kaptName);
        if (score > best.score) best = { code: apt.kaptCode, name: apt.kaptName, score };
      }
      if (best.score < 0.4) { results.push({ name: t.house_nm, match: best.name, score: best.score.toFixed(2), s: 'low_sim' }); failed++; continue; }

      const detail = await getKaptDetail(best.code);
      if (!detail || detail.hh <= 0) { results.push({ name: t.house_nm, s: 'no_data' }); failed++; continue; }
      if (detail.hh < t.tot_supply_hshld_co) { results.push({ name: t.house_nm, hh: detail.hh, supply: t.tot_supply_hshld_co, s: 'hh<supply' }); failed++; continue; }

      const upd: Record<string, any> = { total_households: detail.hh };
      if (detail.dong > 0) upd.total_dong_count = detail.dong;
      await sb.from('apt_subscriptions').update(upd).eq('id', t.id);
      results.push({ name: t.house_nm, kapt: best.name, hh: detail.hh, s: 'ok' });
      updated++;
    } catch (err: any) {
      results.push({ name: t.house_nm, s: 'err', e: err?.message?.slice(0, 30) }); failed++;
    }
  }
  return { processed: targets.length, created: 0, updated, failed, metadata: { results } };
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const auth = req.headers.get('authorization');
  if (token !== process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await withCronLogging('auto-verify-households', () => handler(req));
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const result = await withCronLogging('auto-verify-households', () => handler(req));
  return NextResponse.json(result);
}
