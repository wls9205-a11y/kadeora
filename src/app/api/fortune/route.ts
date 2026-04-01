import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    
    const body = await req.json();
    const { birth_year, zodiac_animal, fortune_text } = body;
    
    if (!birth_year || !zodiac_animal) {
      return NextResponse.json({ error: 'birth_year and zodiac_animal required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // 로그인 유저 → profiles에 birth_year/zodiac_animal 저장
    if (user?.id) {
      await (admin as any).from('profiles').update({ 
        birth_year: Number(birth_year),
        zodiac_animal,
      }).eq('id', user.id);

      // fortune_views 로그 저장 (하루 1회만)
      const today = new Date().toISOString().slice(0, 10);
      const { data: existing } = await (admin as any).from('fortune_views')
        .select('id')
        .eq('user_id', user.id)
        .eq('view_date', today)
        .limit(1);

      if (!existing || existing.length === 0) {
        await (admin as any).from('fortune_views').insert({
          user_id: user.id,
          birth_year: Number(birth_year),
          zodiac_animal,
          fortune_text: fortune_text?.slice(0, 500),
          view_date: today,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // 에러도 200 (UX 차단 안 함)
  }
}
