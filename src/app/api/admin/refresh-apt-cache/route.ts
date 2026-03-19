import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Auth check
    const authHeader = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { data: { user } } = await supabase.auth.getUser(authHeader);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Fetch from 청약홈 API
    const APT_API_KEY = process.env.APT_DATA_API_KEY;
    if (!APT_API_KEY) {
      return NextResponse.json({ success: false, error: 'APT_DATA_API_KEY not configured' }, { status: 500 });
    }

    const apiUrl =
      'https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail?serviceKey=' +
      encodeURIComponent(APT_API_KEY) +
      '&page=1&perPage=100';

    const apiRes = await fetch(apiUrl);
    if (!apiRes.ok) {
      return NextResponse.json({ success: false, error: `API error: ${apiRes.status}` }, { status: 502 });
    }

    const json = await apiRes.json();
    const items = json?.data || json?.response?.body?.items?.item || [];

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'No data from API' });
    }

    // UPSERT to apt_cache
    const { error: upsertErr } = await supabase.from('apt_cache').upsert(
      {
        cache_type: 'apt_subscriptions',
        data: items,
        refreshed_at: new Date().toISOString(),
        refreshed_by: user.id,
      },
      { onConflict: 'cache_type' }
    );

    if (upsertErr) {
      return NextResponse.json({ success: false, error: upsertErr.message }, { status: 500 });
    }

    // Also sync to apt_subscriptions table as before
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

    await supabase
      .from('apt_subscriptions')
      .upsert(items.map(mapItem), { onConflict: 'house_manage_no' });

    return NextResponse.json({ success: true, count: items.length });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
