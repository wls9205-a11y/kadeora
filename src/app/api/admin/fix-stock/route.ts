import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 30;

// POST /api/admin/fix-stock
// body: { action, symbol?, symbols? }
// actions: refresh_single, deactivate, delete, refresh_stale, fix_zero_price, refresh_market_cap
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const sbServer = await createSupabaseServer();
  const { data: { user } } = await sbServer.auth.getUser();
  if (!user) return NextResponse.json({ error: 'login required' }, { status: 401 });
  const sb = getSupabaseAdmin();
  const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: 'admin only' }, { status: 403 });

  const body = await req.json();
  const { action, symbol, symbols } = body;

  // 단일 종목 네이버 시세 갱신
  if (action === 'refresh_single' && symbol) {
    try {
      const res = await fetch(`https://m.stock.naver.com/api/stock/${symbol}/basic`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (iPhone)', 'Referer': 'https://m.stock.naver.com/' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return NextResponse.json({ ok: false, error: `Naver API ${res.status}` });
      const j = await res.json();
      const price = parseInt(String(j?.closePrice ?? '0').replace(/,/g, ''));
      if (!price) return NextResponse.json({ ok: false, error: 'price=0' });
      const updates: Record<string, any> = {
        price,
        change_pct: Math.max(-30, Math.min(30, parseFloat(String(j?.fluctuationsRatio ?? '0')))),
        change_amt: parseInt(String(j?.compareToPreviousClosePrice ?? '0').replace(/,/g, '')),
        volume: parseInt(String(j?.accumulatedTradingVolume ?? '0').replace(/,/g, '')),
        updated_at: new Date().toISOString(),
      };
      const mc = parseInt(String(j?.marketCap ?? '0').replace(/,/g, ''));
      if (mc > 0) updates.market_cap = mc;
      await sb.from('stock_quotes').update(updates).eq('symbol', symbol);
      return NextResponse.json({ ok: true, price, market_cap: mc || 'unchanged', change_pct: updates.change_pct });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e.message });
    }
  }

  // 종목 비활성화
  if (action === 'deactivate' && symbol) {
    await sb.from('stock_quotes').update({ is_active: false }).eq('symbol', symbol);
    return NextResponse.json({ ok: true, deactivated: symbol });
  }

  // 여러 종목 비활성화
  if (action === 'deactivate_batch' && symbols?.length) {
    await sb.from('stock_quotes').update({ is_active: false }).in('symbol', symbols);
    return NextResponse.json({ ok: true, deactivated: symbols.length });
  }

  // 미갱신 종목 일괄 갱신 (3일+)
  if (action === 'refresh_stale') {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    const { data: stale } = await sb.from('stock_quotes')
      .select('symbol, market').eq('is_active', true).lt('updated_at', threeDaysAgo).limit(30);
    let success = 0;
    for (const s of (stale || [])) {
      try {
        const isKR = s.market === 'KOSPI' || s.market === 'KOSDAQ';
        const url = isKR
          ? `https://m.stock.naver.com/api/stock/${s.symbol}/basic`
          : `https://api.stock.naver.com/stock/${s.symbol}${s.market === 'NASDAQ' ? '.O' : '.N'}/basic`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (iPhone)', 'Referer': 'https://m.stock.naver.com/' },
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const j = await res.json();
          const price = parseFloat(String(j?.closePrice ?? '0').replace(/,/g, ''));
          if (price > 0) {
            await sb.from('stock_quotes').update({
              price, change_pct: Math.max(-30, Math.min(30, parseFloat(String(j?.fluctuationsRatio ?? '0')))),
              updated_at: new Date().toISOString(),
            }).eq('symbol', s.symbol);
            success++;
          }
        }
      } catch { /* skip */ }
    }
    return NextResponse.json({ ok: true, refreshed: success, total: (stale || []).length });
  }

  // 가격 0원 종목 일괄 비활성화
  if (action === 'fix_zero_price') {
    const { data: zeros, count } = await sb.from('stock_quotes')
      .select('symbol', { count: 'exact' }).eq('is_active', true).eq('price', 0);
    if (zeros?.length) {
      await sb.from('stock_quotes').update({ is_active: false }).in('symbol', zeros.map((s: any) => s.symbol));
    }
    return NextResponse.json({ ok: true, deactivated: count || 0 });
  }

  // 시총 0인 종목 네이버에서 시총 갱신
  if (action === 'refresh_market_cap') {
    const { data: noMc } = await sb.from('stock_quotes')
      .select('symbol').eq('is_active', true).in('market', ['KOSPI', 'KOSDAQ'])
      .or('market_cap.is.null,market_cap.eq.0').limit(50);
    let success = 0;
    for (const s of (noMc || [])) {
      try {
        const res = await fetch(`https://m.stock.naver.com/api/stock/${s.symbol}/basic`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (iPhone)', 'Referer': 'https://m.stock.naver.com/' },
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const j = await res.json();
          const mc = parseInt(String(j?.marketCap ?? '0').replace(/,/g, ''));
          if (mc > 0) {
            await sb.from('stock_quotes').update({ market_cap: mc }).eq('symbol', s.symbol);
            success++;
          }
        }
      } catch { /* skip */ }
    }
    return NextResponse.json({ ok: true, updated: success, total: (noMc || []).length });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
