import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const { prediction_id, agree } = await req.json();
    if (!prediction_id || typeof agree !== 'boolean') {
      return NextResponse.json({ error: 'prediction_id, agree(boolean) 필요' }, { status: 400 });
    }

    const { data: existing } = await (sb as any).from('prediction_votes')
      .select('id').eq('prediction_id', prediction_id).eq('user_id', user.id).maybeSingle();
    if (existing) return NextResponse.json({ error: '이미 참여했습니다' }, { status: 409 });

    const { error } = await (sb as any).from('prediction_votes').insert({
      prediction_id, user_id: user.id, agree,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await (sb as any).rpc('award_points', {
      p_user_id: user.id, p_amount: 5, p_reason: '예측참여', p_meta: { ref_id: prediction_id },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
