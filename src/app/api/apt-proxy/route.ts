import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ALLOWED_HOSTS = ['api.odcloud.kr', 'apis.data.go.kr'];

function isAllowedUrl(urlStr: string): boolean {
  try { const url = new URL(urlStr); return ALLOWED_HOSTS.includes(url.hostname); }
  catch { return false; }
}

function mapToSubscription(item: Record<string, string>) {
  return {
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
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    if (!action || action === 'list') {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data, error } = await supabase.from('apt_subscriptions').select('*').order('rcept_endde', { ascending: false }).limit(50);
      if (error) throw error;
      return NextResponse.json({ success: true, data, count: data?.length || 0 });
    }
    if (action === 'sync') {
      const APT_API_KEY = process.env.APT_DATA_API_KEY;
      if (!APT_API_KEY) return NextResponse.json({ success: false, error: 'APT_DATA_API_KEY ?袁⑹뒄' }, { status: 500 });
      const apiUrl = `https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail?serviceKey=${encodeURIComponent(APT_API_KEY)}&pageNo=1&numOfRows=30&type=json`;
      if (!isAllowedUrl(apiUrl.split('?')[0])) return NextResponse.json({ success: false, error: 'SSRF 筌△뫀?? }, { status: 403 });
      const apiRes = await fetch(apiUrl, { next: { revalidate: 3600 } });
      if (!apiRes.ok) return NextResponse.json({ success: false, error: `API ??살첒: ${apiRes.status}` }, { status: 502 });
      const json = await apiRes.json();
      const items = json?.response?.body?.items?.item || [];
      if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ success: true, synced: 0 });
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data, error } = await supabase.from('apt_subscriptions').upsert(items.map(mapToSubscription), { onConflict: 'house_manage_no' }).select();
      if (error) throw error;
      return NextResponse.json({ success: true, synced: data?.length || 0 });
    }
    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
