import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 300;
export const runtime = 'nodejs';

/**
 * 배치 PDF 재파싱 — 누락 필드 보강
 * 
 * 타겟: max_floor IS NULL인 레코드 (2,695건)
 * 추출: max_floor, parking_total, nearest_station, total_dong_count, min_floor,
 *       heating_type, structure_type, exterior_finish, announcement_raw_text
 * 
 * 호출: GET /api/admin/batch-reparse-v2?token=CRON_SECRET
 * GOD MODE에서 실행 가능
 */

const num = (s: string): number | null => {
  const n = parseInt(s.replace(/[^0-9]/g, ''));
  return isNaN(n) ? null : n;
};

async function reparseSingle(
  apt: { id: number; house_nm: string; announcement_pdf_url: string; tot_supply_hshld_co: number; total_dong_count: number | null; parking_total: number | null; nearest_station: string | null },
  pdfParse: any,
  sb: any
): Promise<{ ok: boolean; fields: number; name: string }> {
  try {
    const res = await fetch(apt.announcement_pdf_url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!res.ok) {
      await (sb as any).from('apt_subscriptions').update({ announcement_raw_text: 'FETCH_FAILED' }).eq('id', apt.id);
      return { ok: false, fields: 0, name: apt.house_nm };
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const pdf = await pdfParse(buf, { max: 10 });
    const text: string = pdf.text || '';
    if (text.length < 50) {
      await (sb as any).from('apt_subscriptions').update({ announcement_raw_text: 'EMPTY_PDF' }).eq('id', apt.id);
      return { ok: false, fields: 0, name: apt.house_nm };
    }

    const ud: Record<string, any> = {};
    let f = 0;

    // ═══ 원문 텍스트 저장 (5,000자 제한) ═══
    ud.announcement_raw_text = text.slice(0, 5000);

    // ═══ 최고층 (확장 패턴 9개) ═══
    const floorPats = [
      /지상\s*(\d{1,3})\s*층\s*~?\s*(?:지상\s*)?(\d{1,3})\s*층/i,
      /최고\s*(\d{1,3})\s*층/i,
      /(\d{1,3})\s*층\s*이하/i,
      /규모\s*[:\s]*지하\s*\d+\s*층?\s*[~,·/]?\s*지상\s*(\d{1,3})\s*층/i,
      /지하\s*\d+\s*층?\s*[~,·/]\s*지상\s*(\d{1,3})\s*층/i,
      /지상\s*(\d{1,3})\s*층\s*[\(（]/i,
      /지상\s*(\d{1,3})\s*층\s*(?:규모|아파트|건물|공동주택)/i,
      /(?:아파트|공동주택)\s*(?:\d+동\s*)?\s*지상\s*(\d{1,3})\s*층/i,
      /지상\s*(\d{1,3})\s*층/i,
    ];
    for (const pat of floorPats) {
      const m = text.match(pat);
      if (m) {
        const v2 = m[2] ? num(m[2]) : null;
        const v1 = num(m[1]);
        const v = (v2 && v2 > (v1 || 0)) ? v2 : v1;
        if (v && v > 2 && v <= 100) { ud.max_floor = v; f++; break; }
      }
    }

    // ═══ 지하 층수 ═══
    const minFlM = text.match(/지하\s*(\d{1,2})\s*층/i);
    if (minFlM) { const v = num(minFlM[1]); if (v && v > 0 && v <= 10) { ud.min_floor = v; f++; } }

    // ═══ 주차 대수 (확장 패턴 8개) ═══
    if (!apt.parking_total) {
      const parkPats = [
        /주차\s*(?:대수|장|시설)?\s*[:\s]*(?:총\s*)?([0-9,]+)\s*대/i,
        /주차\s*(?:대수|장)?\s*[:\s]*([0-9,]+)\s*면/i,
        /([0-9,]+)\s*대\s*\(\s*세대\s*당/i,
        /주차\s*([0-9,]+)\s*대/i,
        /총\s*주차\s*(?:대수)?\s*[:\s]*([0-9,]+)/i,
        /주차\s*(?:계획|면수)\s*[:\s]*([0-9,]+)/i,
        /주차장\s*(?:총)?\s*([0-9,]+)\s*(?:대|면|주)/i,
        /(?:자주식|기계식)(?:\s*\+?\s*(?:자주식|기계식))?\s*(?:합계\s*)?([0-9,]+)\s*대/i,
      ];
      for (const pat of parkPats) {
        const m = text.match(pat);
        if (m) { const v = num(m[1]); if (v && v > 10) { ud.parking_total = v; f++; break; } }
      }
      // 세대당 비율에서 역산
      if (!ud.parking_total && apt.tot_supply_hshld_co > 0) {
        const ratioM = text.match(/(?:세대\s*당|세대당)\s*([0-9.]+)\s*대/i) || text.match(/주차\s*비율?\s*[:\s]*(?:세대당\s*)?([0-9.]+)\s*대/i);
        if (ratioM) {
          const ratio = parseFloat(ratioM[1]);
          if (ratio > 0.5 && ratio < 5) {
            ud.parking_total = Math.round(ratio * apt.tot_supply_hshld_co);
            ud.parking_ratio = ratio;
            f++;
          }
        }
      }
      if (ud.parking_total && !ud.parking_ratio && apt.tot_supply_hshld_co > 0) {
        ud.parking_ratio = parseFloat((ud.parking_total / apt.tot_supply_hshld_co).toFixed(2));
      }
    }

    // ═══ 동 수 (없는 경우만) ═══
    if (!apt.total_dong_count) {
      const dongPats = [
        /(\d{1,3})\s*개?\s*동\s*[\(（,·/]/i,
        /총\s*(\d{1,3})\s*개?\s*동/i,
        /동\s*수\s*[:\s]*(\d{1,3})/i,
        /(\d{1,3})\s*개\s*동\s*(?:규모|으로)/i,
        /아파트\s*(\d{1,3})\s*개?\s*동/i,
        /(\d{1,3})\s*개?\s*동\s*(?:지상|지하)/i,
      ];
      for (const pat of dongPats) {
        const m = text.match(pat);
        if (m) { const v = num(m[1]); if (v && v > 0 && v <= 200) { ud.total_dong_count = v; f++; break; } }
      }
    }

    // ═══ 최근접 역 ═══
    if (!apt.nearest_station) {
      const staPats = [
        /(\S{2,10}역)\s*(?:에서\s*)?(?:도보\s*)?(?:약?\s*)?(\d{1,3})\s*분/i,
        /(?:지하철|전철|호선)\s*(\S{2,10}역)\s*(?:도보\s*)?(\d{1,3})?\s*분?/i,
        /(\S{2,10}역)\s*(?:인접|도보권|역세권)/i,
        /(?:최근접\s*역|인근\s*역|가까운\s*역)\s*[:\s]*(\S{2,10}역)/i,
        /(\d)\s*호선\s*(\S{2,8}역)/i,
      ];
      for (const pat of staPats) {
        const m = text.match(pat);
        if (m) {
          const name = m[1].endsWith('역') ? m[1] : (m[2]?.endsWith('역') ? m[2] : null);
          if (name && name.length >= 3 && name.length <= 12 && !/[0-9]역/.test(name.slice(0, -1))) {
            const dist = m[2] && /\d/.test(m[2]) ? `${name} 도보 ${m[2]}분` : name;
            ud.nearest_station = dist.slice(0, 50);
            f++;
            break;
          }
        }
      }
    }

    // ═══ 난방 방식 ═══
    const heatM = text.match(/(개별\s*난방|중앙\s*난방|지역\s*난방)\s*[\(（]?\s*(도시가스|LNG|심야전기|열병합|가스)?/i);
    if (heatM) { ud.heating_type = [heatM[1].replace(/\s/g, ''), heatM[2]].filter(Boolean).join(' '); f++; }

    // ═══ 구조 ═══
    const structM = text.match(/(철근\s*콘크리트|철골\s*철근|철골\s*콘크리트|RC조?|벽식\s*구조|라멘\s*구조|무량판)/i);
    if (structM) { ud.structure_type = structM[1].replace(/\s/g, ''); f++; }

    // ═══ 면적 ═══
    const landM = text.match(/대지\s*면적\s*[:\s]*([0-9,]+(?:\.\d+)?)\s*(?:㎡|m²)/i);
    if (landM) { ud.land_area = parseFloat(landM[1].replace(/,/g, '')); f++; }
    const farM = text.match(/용적\s*률\s*[:\s]*([0-9.]+)\s*%/i);
    if (farM) { ud.floor_area_ratio = parseFloat(farM[1]); f++; }
    const bcrM = text.match(/건폐\s*률\s*[:\s]*([0-9.]+)\s*%/i);
    if (bcrM) { ud.building_coverage = parseFloat(bcrM[1]); f++; }

    // DB 업데이트 (null이 아닌 필드만)
    const cleanUd: Record<string, any> = {};
    for (const [k, v] of Object.entries(ud)) {
      if (v != null && v !== '') cleanUd[k] = v;
    }

    if (Object.keys(cleanUd).length > 0) {
      await (sb as any).from('apt_subscriptions').update(cleanUd).eq('id', apt.id);
    }

    return { ok: true, fields: f, name: apt.house_nm };
  } catch (e: any) {
    // 실패한 레코드 마킹 (재시도 방지)
    try { await (sb as any).from('apt_subscriptions').update({ announcement_raw_text: 'PARSE_FAILED' }).eq('id', apt.id); } catch {}
    return { ok: false, fields: 0, name: apt.house_nm };
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const authHeader = req.headers.get('authorization');
  const isAuthed = token === process.env.CRON_SECRET || authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isAuthed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse');
  const sb = getSupabaseAdmin();

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 200);

  // announcement_raw_text가 없는 레코드 타겟 (PDF URL 있는 것만)
  const { data: targets } = await (sb as any).from('apt_subscriptions')
    .select('id, house_nm, announcement_pdf_url, tot_supply_hshld_co, total_dong_count, parking_total, nearest_station')
    .not('announcement_pdf_url', 'is', null).neq('announcement_pdf_url', '')
    .or('announcement_raw_text.is.null,announcement_raw_text.eq.')
    .order('id', { ascending: false })
    .limit(limit);

  if (!targets?.length) {
    return NextResponse.json({ ok: true, message: '재파싱 대상 없음 (전부 처리됨)', remaining: 0 });
  }

  const { count: remaining } = await (sb as any).from('apt_subscriptions')
    .select('id', { count: 'exact', head: true })
    .not('announcement_pdf_url', 'is', null)
    .or('announcement_raw_text.is.null,announcement_raw_text.eq.');

  let processed = 0, failed = 0, totalFields = 0;
  const fieldStats = { max_floor: 0, parking: 0, station: 0, dong: 0, raw_text: 0 };

  // 8개씩 병렬 처리
  const BATCH = 8;
  for (let i = 0; i < targets.length; i += BATCH) {
    const chunk = targets.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      chunk.map((apt: any) => reparseSingle(apt, pdfParse, sb))
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.ok) {
        processed++;
        totalFields += r.value.fields;
      } else {
        failed++;
      }
    }
  }

  // 파싱 안 된 레코드에 max_floor = 0 마킹 (다음 배치에서 제외)
  // → 삭제: max_floor NULL 유지해서 재시도 가능하도록

  return NextResponse.json({
    ok: true,
    processed,
    failed,
    totalFields,
    batch: targets.length,
    remaining: Math.max(0, (remaining || 0) - targets.length),
  });
}

// GOD MODE에서 POST로 호출됨
export async function POST(req: NextRequest) {
  return GET(req);
}
