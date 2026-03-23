import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 120;

/**
 * 청약 상세 필드 백필 크론
 * - constructor_nm이 NULL인 레코드 대상
 * - 공공데이터 API에서 house_manage_no로 상세 정보 재조회
 * - 주 1회 실행 (수요일 05:00 KST)
 */

function extractDetails(item: Record<string, any>) {
  return {
    constructor_nm: item.CNSTRCT_ENTRPS_NM || item.cnstrctEntrpsNm || null,
    developer_nm: item.BSNS_MBY_NM || item.bsnsMbyNm || null,
    total_dong_co: parseInt(item.TOT_DONG_CO || '0') || null,
    max_floor: parseInt(item.HGHST_GRND_FL_CO || '0') || null,
    parking_co: parseInt(item.PARKNG_CO || '0') || null,
    heating_type: item.HTN_FRMLA_DS_CD_NM || item.htnFrmlaDsCdNm || null,
    is_price_limit: (item.PARCPRC_ULS_AT || '') === 'Y' ? true : undefined,
    transfer_limit: item.RESIDE_SECD_NM || null,
    model_house_addr: item.MDL_HOUSE_ADRES || item.mdlHouseAdres || null,
  };
}

export const GET = withCronAuth(async (req: NextRequest) => {
  const APT_API_KEY = process.env.APT_DATA_API_KEY;
  if (!APT_API_KEY) return NextResponse.json({ ok: true, error: 'APT_DATA_API_KEY not set' });

  const sb = getSupabaseAdmin();

  // 1. 상세 필드가 비어있는 청약 레코드 조회
  const { data: missing } = await sb.from('apt_subscriptions')
    .select('id, house_manage_no, house_nm')
    .is('constructor_nm', null)
    .not('house_manage_no', 'is', null)
    .order('rcept_bgnde', { ascending: false })
    .limit(200);

  if (!missing?.length) {
    return NextResponse.json({ ok: true, message: '백필 대상 없음 (전체 상세 필드 완료)', updated: 0 });
  }

  const missingMap = new Map<string, string>();
  for (const m of missing) {
    if (m.house_manage_no) missingMap.set(m.house_manage_no, String(m.id));
  }

  let updated = 0;
  let scanned = 0;

  // 2. API에서 전체 데이터 페이지네이션하며 매칭
  for (let page = 1; page <= 20; page++) {
    if (missingMap.size === 0) break;
    try {
      const url = `https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail?serviceKey=${encodeURIComponent(APT_API_KEY)}&page=${page}&perPage=500`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) break;
      const json = await res.json();
      const items = json?.data || [];
      if (!Array.isArray(items) || items.length === 0) break;

      scanned += items.length;

      for (const item of items) {
        const houseNo = item.HOUSE_MANAGE_NO || item.houseManageNo || '';
        if (!houseNo || !missingMap.has(houseNo)) continue;

        const details = extractDetails(item);
        // 유의미한 데이터가 1개라도 있으면 업데이트
        const hasData = Object.values(details).some(v => v !== null && v !== undefined);
        if (!hasData) continue;

        // undefined 제거
        const cleanDetails = Object.fromEntries(
          Object.entries(details).filter(([, v]) => v !== undefined)
        );

        const { error } = await sb.from('apt_subscriptions')
          .update({ ...cleanDetails, updated_at: new Date().toISOString() })
          .eq('house_manage_no', houseNo);
        if (!error) {
          updated++;
          missingMap.delete(houseNo);
        }
      }

      if (items.length < 500) break; // 마지막 페이지
    } catch { break; }
  }

  // 3. 무순위/잔여세대도 시도
  if (missingMap.size > 0) {
    try {
      const url2 = `https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getRemndrLttotPblancDetail?serviceKey=${encodeURIComponent(APT_API_KEY)}&page=1&perPage=500`;
      const res2 = await fetch(url2, { signal: AbortSignal.timeout(10000) });
      if (res2.ok) {
        const json2 = await res2.json();
        const items2 = json2?.data || [];
        for (const item of items2) {
          const houseNo = item.HOUSE_MANAGE_NO || item.houseManageNo || '';
          if (!houseNo || !missingMap.has(houseNo)) continue;
          const details = extractDetails(item);
          const hasData = Object.values(details).some(v => v !== null && v !== undefined);
          if (!hasData) continue;
          const cleanDetails = Object.fromEntries(
            Object.entries(details).filter(([, v]) => v !== undefined)
          );
          const { error } = await sb.from('apt_subscriptions')
            .update({ ...cleanDetails, updated_at: new Date().toISOString() })
            .eq('house_manage_no', houseNo);
          if (!error) { updated++; missingMap.delete(houseNo); }
        }
      }
    } catch {}
  }

  console.info(`[apt-backfill-details] scanned=${scanned} updated=${updated} remaining=${missingMap.size}`);

  return NextResponse.json({
    ok: true,
    scanned,
    updated,
    remaining: missingMap.size,
    total_missing: missing.length,
  });
});
