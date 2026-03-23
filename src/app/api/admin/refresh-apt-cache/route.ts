import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    // Auth check — Supabase session token
    const authHeader = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: '인증 토큰이 없습니다. 다시 로그인해주세요.' }, { status: 401 });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !user) {
      return NextResponse.json({ success: false, error: '세션이 만료되었습니다. 다시 로그인해주세요.' }, { status: 401 });
    }
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const APT_API_KEY = process.env.APT_DATA_API_KEY;
    if (!APT_API_KEY) {
      return NextResponse.json({ success: false, error: 'APT_DATA_API_KEY not configured' }, { status: 500 });
    }

    // 과거 1년 ~ 미래 6개월 날짜 범위
    const now = new Date();
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const sixMonthsLater = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
    const fromDate = yearAgo.toISOString().slice(0, 10).replace(/-/g, '');
    const toDate = sixMonthsLater.toISOString().slice(0, 10).replace(/-/g, '');

    // 여러 페이지 수집 (최대 3페이지 = 300건)
    const allItems: any[] = [];
    for (let page = 1; page <= 3; page++) {
      const apiUrl =
        'https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail?serviceKey=' +
        encodeURIComponent(APT_API_KEY) +
        `&page=${page}&perPage=100` +
        `&cond[RCEPT_BGNDE::GTE]=${fromDate}` +
        `&cond[RCEPT_ENDDE::LTE]=${toDate}`;

      try {
        const apiRes = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
        if (!apiRes.ok) break;
        const json = await apiRes.json();
        const items = json?.data || json?.response?.body?.items?.item || [];
        if (!Array.isArray(items) || items.length === 0) break;
        allItems.push(...items);
        if (items.length < 100) break; // 마지막 페이지
      } catch { break; }
    }

    // 날짜 조건 없이도 시도 (API가 조건 파라미터 미지원하는 경우 fallback)
    if (allItems.length === 0) {
      try {
        const fallbackUrl =
          'https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail?serviceKey=' +
          encodeURIComponent(APT_API_KEY) + '&page=1&perPage=100';
        const apiRes = await fetch(fallbackUrl, { signal: AbortSignal.timeout(10000) });
        if (apiRes.ok) {
          const json = await apiRes.json();
          const items = json?.data || json?.response?.body?.items?.item || [];
          if (Array.isArray(items)) allItems.push(...items);
        }
      } catch {}
    }

    if (allItems.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'No data from API' });
    }

    // UPSERT to apt_cache
    await supabase.from('apt_cache').upsert(
      { cache_type: 'apt_subscriptions', data: allItems, refreshed_at: new Date().toISOString(), refreshed_by: user.id },
      { onConflict: 'cache_type' }
    );

    // Sync to apt_subscriptions (UPSERT on house_manage_no)
    const mapItem = (item: Record<string, string>) => ({
      house_manage_no: item.HOUSE_MANAGE_NO || item.houseManageNo || '',
      house_nm: item.HOUSE_NM || item.houseNm || '',
      region_cd: item.SUBSCRPT_AREA_CODE || item.subscrptAreaCode || '',
      region_nm: item.SUBSCRPT_AREA_CODE_NM || item.subscrptAreaCodeNm || '',
      supply_addr: item.HSSPLY_ADRES || item.hssplyAdres || '',
      tot_supply_hshld_co: item.TOT_SUPLY_HSHLDCO || item.totSuplyHshldco || '',
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
      fetched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const mapped = allItems.filter(i => (i.HOUSE_MANAGE_NO || i.houseManageNo)).map(mapItem);
    if (mapped.length > 0) {
      await supabase.from('apt_subscriptions').upsert(mapped as any, { onConflict: 'house_manage_no' });
    }

    try { revalidatePath('/apt'); revalidatePath('/'); } catch {}
    return NextResponse.json({ success: true, count: allItems.length, message: `${allItems.length}건 갱신 완료` });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
