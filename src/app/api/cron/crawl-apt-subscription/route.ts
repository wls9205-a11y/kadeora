import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 60;

/**
 * 청약 정보 자동 수집 크론
 * 소스: 공공데이터포털 청약홈 분양정보 API (api.odcloud.kr)
 * - APT 분양정보 상세
 * - APT 무순위/잔여세대 정보
 * 매일 06시 실행 → 새 청약 정보 자동 upsert
 */

function mapItem(item: Record<string, string>) {
  const totSupply = parseInt(item.TOT_SUPLY_HSHLDCO || item.totSuplyHshldco || '0') || 0;
  const _area = parseFloat(item.EXCLUSE_AR || item.excluseAr || '0') || 0;
  const _price = parseInt(item.LTTOT_TOP_AMOUNT || item.lttotTopAmount || '0') || 0;
  return {
    house_manage_no: item.HOUSE_MANAGE_NO || item.houseManageNo || '',
    house_nm: item.HOUSE_NM || item.houseNm || '',
    region_cd: item.SUBSCRPT_AREA_CODE || item.subscrptAreaCode || '',
    region_nm: item.SUBSCRPT_AREA_CODE_NM || item.subscrptAreaCodeNm || '',
    supply_addr: item.HSSPLY_ADRES || item.hssplyAdres || '',
    tot_supply_hshld_co: totSupply,
    // T1-3(2026-08-27) — 모집공고일. 청약홈이 주는데 «저장을 안 하고 있었다».
    //   목록 정렬의 «올바른» 키다. rcept_bgnde(청약 접수 시작일)는 대용품일 뿐이다.
    //   ⚠️ text 로 둔다('YYYY-MM-DD'). 나머지 날짜 필드와 형식을 맞춘다 —
    //      여기만 date 로 바꾸면 비교·정렬에서 형식이 갈린다.
    announcement_date: item.RCRIT_PBLANC_DE || item.rcritPblancDe || null,
    rcept_bgnde: item.RCEPT_BGNDE || item.rceptBgnde || '',
    rcept_endde: item.RCEPT_ENDDE || item.rceptEndde || '',
    spsply_rcept_bgnde: item.SPSPLY_RCEPT_BGNDE || item.spsplyRceptBgnde || null,
    spsply_rcept_endde: item.SPSPLY_RCEPT_ENDDE || item.spsplyRceptEndde || null,
    przwner_presnatn_de: item.PRZWNER_PRESNATN_DE || item.przwnerPresnatnDe || null,
    cntrct_cncls_bgnde: item.CNTRCT_CNCLS_BGNDE || item.cntrctCnclsBgnde || null,
    cntrct_cncls_endde: item.CNTRCT_CNCLS_ENDDE || item.cntrctCnclsEndde || null,
    mdatrgbn_nm: item.MDATRGBN_NM || item.mdatrgbnNm || '',
    hssply_adres: item.HSSPLY_ADRES || item.hssplyAdres || '',
    mvn_prearnge_ym: item.MVN_PREARNGE_YM || item.mvnPrearngeYm || null,
    pblanc_url: item.PBLANC_URL || item.pblancUrl || null,
    // 신규 상세 필드
    constructor_nm: item.CNSTRCT_ENTRPS_NM || item.cnstrctEntrpsNm || null,
    developer_nm: item.BSNS_MBY_NM || item.bsnsMbyNm || null,
    total_dong_co: parseInt(item.TOT_DONG_CO || '0') || null,
    max_floor: parseInt(item.HGHST_GRND_FL_CO || '0') || null,
    parking_co: parseInt(item.PARKNG_CO || '0') || null,
    heating_type: item.HTN_FRMLA_DS_CD_NM || item.htnFrmlaDsCdNm || null,
    is_price_limit: (item.PARCPRC_ULS_AT || '') === 'Y',
    transfer_limit: item.RESIDE_SECD_NM || null,
    model_house_addr: item.MDL_HOUSE_ADRES || item.mdlHouseAdres || null,
    fetched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const APT_API_KEY = process.env.APT_DATA_API_KEY;
  if (!APT_API_KEY) return NextResponse.json({ success: true, error: 'APT_DATA_API_KEY not set' });

  const result = await withCronLogging('crawl-apt-subscription', async () => {
    const supabase = getSupabaseAdmin();
    let totalSynced = 0;

    // 1. APT 분양정보 상세 — 페이지별 최대 500건씩
    for (let page = 1; page <= 10; page++) {
      try {
        const url = `https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail?serviceKey=${encodeURIComponent(APT_API_KEY)}&page=${page}&perPage=500`;
        const res = await fetch(url);
        if (!res.ok) break;
        const json = await res.json();
        const items = json?.data || json?.response?.body?.items?.item || [];
        if (!Array.isArray(items) || items.length === 0) break;

        const mapped = items.map(mapItem).filter((m: Record<string, any>) => m.house_manage_no);
        if (mapped.length === 0) break;

        const { data, error } = await supabase
          .from('apt_subscriptions')
          .upsert(mapped, { onConflict: 'house_manage_no' })
          .select('id');
        if (error) console.error('[crawl-apt-subscription] insert fail', error.message?.slice(0, 200));
        else totalSynced += data?.length || mapped.length;

        // 마지막 페이지면 중단
        if (items.length < 500) break;
      } catch { break; }
    }

    // 2. 무순위/잔여세대 정보도 수집 시도
    try {
      const url2 = `https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getRemndrLttotPblancDetail?serviceKey=${encodeURIComponent(APT_API_KEY)}&page=1&perPage=200`;
      const res2 = await fetch(url2);
      if (res2.ok) {
        const json2 = await res2.json();
        const items2 = json2?.data || [];
        if (Array.isArray(items2) && items2.length > 0) {
          const mapped2 = items2.map(mapItem).filter((m: Record<string, any>) => m.house_manage_no);
          const { data: d2 } = await supabase
            .from('apt_subscriptions')
            .upsert(mapped2, { onConflict: 'house_manage_no' })
            .select('id');
          totalSynced += d2?.length || 0;
        }
      }
    } catch {}

    // 3. 만료된 청약 status='closed' 업데이트
    const today = new Date().toISOString().slice(0, 10);
    await supabase
      .from('apt_subscriptions')
      .update({ status: 'closed' })
      .lt('rcept_endde', today)
      .is('status', null);

    // 4. ⛔ issue-preempt 트리거를 제거했다 (T1-3, 2026-08-27).
    //    A1 이 vercel.json 에서 issue-preempt 를 뺐다(1,167회 감지 → 6건 발행).
    //    그런데 이 크론이 «코드로» 직접 부르고 있었다. 게다가 이번에 주기를
    //    하루 1회 → 3시간마다로 올린다. 그대로 뒀으면 A1 이 끈 것이 오히려
    //    «8배로 늘어난다». 라우트 파일은 남아 있어 수동 호출은 가능하다.

    return {
      processed: totalSynced,
      created: totalSynced,
      failed: 0,
      metadata: { api_name: 'odcloud_applyhome', today },
    };
  });

  if (!result.success) {
    return NextResponse.json({ success: true, error: result.error });
  }
  return NextResponse.json({ ok: true, ...result });
}
