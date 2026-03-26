import { errMsg } from '@/lib/error-utils';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { sanitizeText } from '@/lib/sanitize';

export async function GET(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const { data, error } = await getSupabaseAdmin().rpc('get_portfolio_summary', { p_user_id: user.id });
    if (error) {
      // RPC 없으면 직접 조인
      const { data: holdings } = await getSupabaseAdmin().from('portfolio_holdings')
        .select('id,symbol,quantity,buy_price,buy_date,memo,created_at').eq('user_id', user.id).order('created_at', { ascending: false });
      if (!holdings?.length) return NextResponse.json({ holdings: [], summary: { totalInvested: 0, totalCurrent: 0, totalPnl: 0, pnlPct: 0 } });

      const symbols = holdings.map(h => h.symbol);
      const { data: stocks } = await getSupabaseAdmin().from('stock_quotes')
        .select('symbol,name,price,market,currency').in('symbol', symbols);
      const stockMap = new Map(stocks?.map(s => [s.symbol, s]) || []);

      const enriched = holdings.map(h => {
        const s = stockMap.get(h.symbol);
        const currentPrice = s?.price || 0;
        const pnl = (currentPrice - h.buy_price) * h.quantity;
        const pnlPct = h.buy_price > 0 ? ((currentPrice - h.buy_price) / h.buy_price * 100) : 0;
        return { ...h, current_price: currentPrice, name: s?.name || h.symbol, market: s?.market, currency: s?.currency, pnl, pnl_pct: pnlPct };
      });

      const totalInvested = enriched.reduce((s, h) => s + h.buy_price * h.quantity, 0);
      const totalCurrent = enriched.reduce((s, h) => s + h.current_price * h.quantity, 0);

      return NextResponse.json({
        holdings: enriched,
        summary: {
          totalInvested, totalCurrent,
          totalPnl: totalCurrent - totalInvested,
          pnlPct: totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested * 100) : 0,
        }
      });
    }

    // RPC 성공
    const totalInvested = (data || []).reduce((s: number, h: any) => s + (h.buy_price || 0) * (h.quantity || 0), 0);
    const totalCurrent = (data || []).reduce((s: number, h: any) => s + (h.current_price || 0) * (h.quantity || 0), 0);

    return NextResponse.json({
      holdings: data || [],
      summary: {
        totalInvested, totalCurrent,
        totalPnl: totalCurrent - totalInvested,
        pnlPct: totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested * 100) : 0,
      }
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const body = await req.json();
    const { symbol, buy_price, quantity, memo } = body;
    if (!symbol || !buy_price || !quantity) {
      return NextResponse.json({ error: '종목, 매수가, 수량은 필수입니다' }, { status: 400 });
    }
    if (Number(buy_price) <= 0 || Number(quantity) <= 0) {
      return NextResponse.json({ error: '매수가와 수량은 0보다 커야 합니다' }, { status: 400 });
    }
    if (String(symbol).length > 20) {
      return NextResponse.json({ error: '종목코드가 너무 깁니다' }, { status: 400 });
    }

    // 최대 50종목
    const { count } = await getSupabaseAdmin().from('portfolio_holdings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if ((count || 0) >= 50) {
      return NextResponse.json({ error: '포트폴리오는 최대 50종목까지 가능합니다' }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin().from('portfolio_holdings').insert({
      user_id: user.id, symbol: String(symbol).toUpperCase().trim(),
      buy_price: Number(buy_price), quantity: Number(quantity),
      memo: memo ? sanitizeText(String(memo)).slice(0, 200) : null,
    }).select().single();

    if (error) throw error;
    return NextResponse.json({ holding: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

    await getSupabaseAdmin().from('portfolio_holdings').delete().eq('id', id).eq('user_id', user.id);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
