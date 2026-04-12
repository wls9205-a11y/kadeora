import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const { battle_id, choice } = await req.json();
    if (!battle_id || !['A', 'B'].includes(choice)) {
      return NextResponse.json({ error: 'battle_id, choice(A/B) 필요' }, { status: 400 });
    }

    const { data: existing } = await (sb as any).from('vs_votes')
      .select('id').eq('battle_id', battle_id).eq('user_id', user.id).maybeSingle();
    if (existing) return NextResponse.json({ error: '이미 투표했습니다' }, { status: 409 });

    const { error } = await (sb as any).from('vs_votes').insert({
      battle_id, user_id: user.id, choice,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await (sb as any).rpc('award_points', {
      p_user_id: user.id, p_amount: 5, p_reason: 'VS참여', p_meta: { ref_id: battle_id },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
