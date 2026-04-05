import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createSupabaseServer } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/admin-auth';

// 네이버 API 응답 구조 확인용 테스트 엔드포인트
// GET /api/admin/naver-test?symbol=005930
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const sb = getSupabaseAdmin();
  const sbServer = await createSupabaseServer();
  const { data: { user } } = await sbServer.auth.getUser();
  
  if (user) {
    const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: 'admin only' }, { status: 403 });
  } else {
    return NextResponse.json({ error: 'login required' }, { status: 401 });
  }

  const symbol = req.nextUrl.searchParams.get('symbol') || '005930';
  const results: Record<string, any> = { symbol };

  // 1. Naver 폴링 API
  try {
    const res = await fetch(`https://polling.finance.naver.com/api/realtime/domestic/stock/${symbol}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://finance.naver.com/' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = await res.json();
      const d = json?.result?.datas?.[0];
      results.polling = {
        allKeys: d ? Object.keys(d) : [],
        marketCapRelated: d ? Object.fromEntries(
          Object.entries(d).filter(([k]) => 
            k.toLowerCase().includes('market') || k.toLowerCase().includes('cap') || 
            k.toLowerCase().includes('total') || k.toLowerCase().includes('시가')
          )
        ) : {},
        price: d?.closePriceRaw,
        changePct: d?.fluctuationsRatioRaw,
      };
    }
  } catch (e: any) { results.polling_error = e.message; }

  // 2. Naver 모바일 basic API
  try {
    const res = await fetch(`https://m.stock.naver.com/api/stock/${symbol}/basic`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone)', 'Referer': 'https://m.stock.naver.com/' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = await res.json();
      results.mobile_basic = {
        allKeys: Object.keys(json),
        marketCapRelated: Object.fromEntries(
          Object.entries(json).filter(([k]) => 
            k.toLowerCase().includes('market') || k.toLowerCase().includes('cap') || 
            k.toLowerCase().includes('total') || k.toLowerCase().includes('시가')
          )
        ),
        closePrice: json?.closePrice,
        fluctuationsRatio: json?.fluctuationsRatio,
      };
    }
  } catch (e: any) { results.mobile_error = e.message; }

  // 3. Naver integration API  
  try {
    const res = await fetch(`https://m.stock.naver.com/api/stock/${symbol}/integration`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone)', 'Referer': 'https://m.stock.naver.com/' },
      signal: AbortSignal.timeout(5000),
    });
    results.integration_status = res.status;
    if (res.ok) {
      const json = await res.json();
      results.integration = {
        allKeys: Object.keys(json),
        totalInfos: json?.totalInfos,
        marketCap: json?.marketCap,
      };
    }
  } catch (e: any) { results.integration_error = e.message; }

  // 4. Naver overview API (다른 엔드포인트 시도)
  try {
    const res = await fetch(`https://m.stock.naver.com/api/stock/${symbol}/overview`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone)', 'Referer': 'https://m.stock.naver.com/' },
      signal: AbortSignal.timeout(5000),
    });
    results.overview_status = res.status;
    if (res.ok) {
      const json = await res.json();
      results.overview = {
        allKeys: Object.keys(json),
        marketCapRelated: Object.fromEntries(
          Object.entries(json).filter(([k]) => 
            k.toLowerCase().includes('market') || k.toLowerCase().includes('cap') || 
            k.toLowerCase().includes('total') || k.toLowerCase().includes('시가')
          )
        ),
      };
    }
  } catch (e: any) { results.overview_error = e.message; }

  // 5. DB 현재값
  const { data: dbStock } = await sb.from('stock_quotes').select('symbol, name, price, change_pct, market_cap, volume, updated_at').eq('symbol', symbol).single();
  results.db = dbStock;

  return NextResponse.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
