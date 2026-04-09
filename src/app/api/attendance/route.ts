import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

function todayKST() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    .toISOString().split('T')[0];
}

function yesterdayKST() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export async function GET() {
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const { data } = await sb.from('attendance').select('user_id,streak,total_days,last_date,updated_at').eq('user_id', user.id).maybeSingle();
    const today = todayKST();
    return NextResponse.json({
      streak: data?.streak ?? 0,
      total_days: data?.total_days ?? 0,
      last_date: data?.last_date ?? null,
      already_today: data?.last_date === today,
    });
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const today = todayKST();
    const yesterday = yesterdayKST();
    const { data: existing } = await sb.from('attendance').select('user_id,streak,total_days,last_date,updated_at').eq('user_id', user.id).maybeSingle();

    if (existing?.last_date === today) {
      return NextResponse.json({ already: true, streak: existing.streak, total_days: existing.total_days, points_earned: 0 });
    }

    let streak = 1;
    let totalDays = 1;

    if (existing) {
      totalDays = (existing.total_days ?? 0) + 1;
      streak = existing.last_date === yesterday ? (existing.streak ?? 0) + 1 : 1;
      await sb.from('attendance').update({ streak, total_days: totalDays, last_date: today, updated_at: new Date().toISOString() }).eq('user_id', user.id);
    } else {
      await sb.from('attendance').insert({ user_id: user.id, streak: 1, total_days: 1, last_date: today });
    }

    let pointsEarned = 10;
    let bonus = null;

    if (streak === 7) { pointsEarned += 30; bonus = '7일 연속 보너스 +30P'; }
    if (streak === 30) { pointsEarned += 100; bonus = '30일 연속 보너스 +100P'; }

    // 포인트 이상 감지: 1시간 내 200P 이상 적립 시 차단
    const { data: recentPoints } = await sb
      .from('point_history')
      .select('amount')
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .gt('amount', 0)
    const total1h = recentPoints?.reduce((sum: number, r) => sum + (r.amount ?? 0), 0) ?? 0
    if (total1h >= 200) {
      console.warn('[point-anomaly] suspicious attendance:', user.id, 'total1h:', total1h)
      return NextResponse.json({ error: '잠시 후 다시 시도해주세요.' }, { status: 429 })
    }

    // 포인트 지급 (award_points RPC — 트리거 바이패스 + point_history 자동 기록)
    try {
      const reason = bonus ? '출석연속보너스' : '출석체크';
      await getSupabaseAdmin().rpc('award_points', { p_user_id: user.id, p_amount: pointsEarned, p_reason: reason, p_meta: null });
    } catch (e) { console.error(`[${new URL(req.url).pathname}]`, e); }

    // 알림
    try {
      const msg = bonus ? `출석 체크 완료! +${pointsEarned}P (${bonus})` : `출석 체크 완료! +10P 🌱`;
      await sb.from('notifications').insert({ user_id: user.id, type: 'system', content: msg });
    } catch (e) { console.error(`[${new URL(req.url).pathname}]`, e); }

    // 첫 미션: 출석 체크
    try {
      const { data: prof } = await (sb as any).from('profiles').select('first_mission_completed, first_mission_progress').eq('id', user.id).single();
      if (prof && !prof.first_mission_completed) {
        const prog = prof.first_mission_progress || {};
        if (!prog.attendance) {
          prog.attendance = true;
          const done = Object.values(prog).filter(Boolean).length;
          if (done >= 2) await getSupabaseAdmin().rpc('award_points', { p_user_id: user.id, p_amount: 200, p_reason: '첫 미션 보너스' });
          await (sb as any).from('profiles').update({ first_mission_progress: prog, first_mission_completed: done >= 2 }).eq('id', user.id);
        }
      }
    } catch {}

    return NextResponse.json({ streak, total_days: totalDays, points_earned: pointsEarned, bonus });
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
