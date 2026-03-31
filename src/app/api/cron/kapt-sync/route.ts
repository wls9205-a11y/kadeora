import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 300;
export const runtime = 'nodejs';

const KAPT_KEY = process.env.KAPT_API_KEY || '';
const BASE_URL = 'https://apis.data.go.kr/1613000/AptBasisInfoServiceV4';

interface KaptItem {
  kaptCode: string;
  kaptName: string;
  kaptAddr: string;
  kaptDongCnt: string;
  kaptdaCnt: string;   // 세대수
  kaptBcompany: string; // 시공사
  kaptAcompany: string; // 시행사
  codeHeatNm: string;  // 난방방식
  kaptUsedate: string;  // 사용승인일
  kaptTarea: string;    // 연면적
  doroJuso: string;     // 도로명주소
  bjdCode: string;      // 법정동코드
}

async function fetchKaptInfo(kaptCode: string): Promise<KaptItem | null> {
  try {
    const url = `${BASE_URL}/getAphusBassInfoV4?serviceKey=${encodeURIComponent(KAPT_KEY)}&kaptCode=${kaptCode}&type=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.response?.body?.item || data?.body?.item || data?.item;
    if (!item) return null;
    return item as KaptItem;
  } catch { return null; }
}

async function searchKaptByBjdCode(bjdCode: string): Promise<{ kaptCode: string; kaptName: string }[]> {
  try {
    // 단지 목록 API (V4)
    const url = `https://apis.data.go.kr/1613000/AptListServiceV4/getLegaldongAptListV4?serviceKey=${encodeURIComponent(KAPT_KEY)}&bjdCode=${bjdCode}&type=json&numOfRows=100&pageNo=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    const items = data?.response?.body?.items?.item || data?.body?.items?.item || [];
    if (!Array.isArray(items)) return items ? [items] : [];
    return items.map((i: any) => ({ kaptCode: i.kaptCode, kaptName: i.kaptName }));
  } catch { return []; }
}

// 이름 유사도 (간단 매칭)
function nameSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.replace(/\s+|아파트|단지|1차|2차|3차|주공|재건축|재개발/g, '').toLowerCase();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  // 공통 글자 비율
  const set = new Set(na.split(''));
  let match = 0;
  for (const c of nb) if (set.has(c)) match++;
  return match / Math.max(na.length, nb.length);
}

async function handler(_req: NextRequest) {
  if (!KAPT_KEY) return NextResponse.json({ error: 'KAPT_API_KEY not set' }, { status: 500 });

  const sb = getSupabaseAdmin();

  // apt_complex_profiles에서 total_households 미보유 단지
  const { data: targets } = await (sb as any).from('apt_complex_profiles')
    .select('id, apt_name, sigungu, total_households')
    .or('total_households.is.null,total_households.eq.0')
    .not('sigungu', 'is', null)
    .limit(50);

  // 재건축/재개발 분양 단지 중 총세대수 = 공급세대수인 것 (K-apt에서 보정 가능)
  const { data: subTargets } = await (sb as any).from('apt_subscriptions')
    .select('id, house_nm, hssply_adres, tot_supply_hshld_co, total_households, project_type')
    .in('project_type', ['재건축', '재개발'])
    .filter('total_households', 'eq', 'tot_supply_hshld_co')
    .not('hssply_adres', 'is', null)
    .limit(50);

  let processed = 0, updated = 0, failed = 0;
  const results: string[] = [];

  // 1) apt_complex_profiles 업데이트
  if (targets?.length) {
    for (const t of targets) {
      try {
        const bjd = t.bjd_code?.toString().slice(0, 10) || '';
        if (bjd.length < 5) continue;

        const aptList = await searchKaptByBjdCode(bjd);
        if (!aptList.length) { processed++; continue; }

        // 이름 매칭
        let best = { code: '', score: 0 };
        for (const apt of aptList) {
          const score = nameSimilarity(t.apt_name, apt.kaptName);
          if (score > best.score) best = { code: apt.kaptCode, score };
        }

        if (best.score >= 0.5 && best.code) {
          const info = await fetchKaptInfo(best.code);
          if (info?.kaptdaCnt) {
            const hh = parseInt(info.kaptdaCnt) || 0;
            if (hh > 0) {
              const ud: Record<string, any> = { total_households: hh };
              if (info.kaptDongCnt) ud.dong_count = parseInt(info.kaptDongCnt) || undefined;
              if (info.codeHeatNm) ud.heating_type = info.codeHeatNm;
              if (info.kaptBcompany) ud.builder = info.kaptBcompany;

              await (sb as any).from('apt_complex_profiles').update(ud).eq('id', t.id);
              updated++;
              results.push(`[프로필] ${t.apt_name}: ${hh}세대`);
            }
          }
        }
        processed++;
        // Rate limit: 100ms 간격
        await new Promise(r => setTimeout(r, 100));
      } catch { failed++; }
    }
  }

  // 2) apt_subscriptions 보정 (재건축/재개발)
  if (subTargets?.length) {
    for (const s of subTargets) {
      try {
        // 주소에서 동 추출
        const addr = s.hssply_adres || '';
        const dongMatch = addr.match(/([가-힣]+(?:동|읍|면|리))\s/);
        if (!dongMatch) { processed++; continue; }

        // 간략 주소로 검색 시도
        // 주소 기반 kaptCode는 단지 목록 API 필요 — bjdCode 필요
        // 여기서는 skip (apt_complex_profiles에서 커버)
        processed++;
      } catch { failed++; }
    }
  }

  return { processed, updated, failed, results: results.slice(0, 20) };
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const authHeader = req.headers.get('authorization');
  if (token !== process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return withCronLogging('kapt-sync', () => handler(req));
}

export async function POST(req: NextRequest) {
  return withCronLogging('kapt-sync', () => handler(req));
}
