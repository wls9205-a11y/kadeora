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

    // 로그인 유저 → profiles에 birth_year/zodiac_animal/birth_date 저장
    if (user?.id) {
      const updates: Record<string, any> = {
        birth_year: Number(birth_year),
        zodiac_animal,
      };
      // birth_date가 없으면 birth_year 기준으로 1월 1일로 설정 (연도만 알 때)
      updates.birth_date = `${birth_year}-01-01`;
      
      await (admin as any).from('profiles').update(updates).eq('id', user.id);

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
