import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET() {
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ symbols: [] });

    const { data } = await sb.from('stock_watchlist')
      .select('symbol')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return NextResponse.json({ symbols: (data || []).map((d) => d.symbol) });
  } catch { return NextResponse.json({ symbols: [] }); }
}

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    const { symbol, action } = await req.json();
    if (!symbol) return NextResponse.json({ error: 'symbol 필요' }, { status: 400 });

    if (action === 'remove') {
      await sb.from('stock_watchlist').delete().eq('user_id', user.id).eq('symbol', symbol);
      return NextResponse.json({ watched: false });
    }

    // Add (upsert)
    const { data: existing } = await sb.from('stock_watchlist')
      .select('id').eq('user_id', user.id).eq('symbol', symbol).maybeSingle();
    if (existing) return NextResponse.json({ watched: true });

    await sb.from('stock_watchlist').insert({ user_id: user.id, symbol });
    // 첫 미션: 관심 종목 등록 (직접 DB 업데이트)
    try {
      const { data: prof } = await (sb as any).from('profiles').select('first_mission_completed, first_mission_progress').eq('id', user.id).single();
      if (prof && !prof.first_mission_completed) {
        const prog = prof.first_mission_progress || {};
        if (!prog.watchlist) {
          prog.watchlist = true;
          await sb.rpc('award_points', { p_user_id: user.id, p_amount: 50, p_reason: '첫 미션: 관심종목' });
          const done = Object.values(prog).filter(Boolean).length;
          if (done >= 2 && !prof.first_mission_completed) {
            await sb.rpc('award_points', { p_user_id: user.id, p_amount: 200, p_reason: '첫 미션 보너스' });
          }
          await (sb as any).from('profiles').update({ first_mission_progress: prog, first_mission_completed: done >= 2 }).eq('id', user.id);
        }
      }
    } catch {}
    return NextResponse.json({ watched: true }, { status: 201 });
  } catch { return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
