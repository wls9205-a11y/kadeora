import { NextRequest, NextResponse } from 'next/server';
import { sanitizeText } from '@/lib/sanitize';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'auth'))) return rateLimitResponse();

  try {
    const body = await req.json(); const message = sanitizeText(body.message, 1000); const category = sanitizeText(body.category, 50); const rating = Number(body.rating) || 0;
    if (!message?.trim()) return NextResponse.json({ error: '내용을 입력해주세요' }, { status: 400 });
    if (message.trim().length > 2000) return NextResponse.json({ error: '2000자 이하로 입력해주세요' }, { status: 400 });

    // 로그인 유저 확인 (선택)
    let userId = null;
    try {
      const cookieStore = await cookies();
      const sb = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
      );
      const { data: { user } } = await sb.auth.getUser();
      userId = user?.id || null;
    } catch {}

    const admin = getSupabaseAdmin();
    const ua = req.headers.get('user-agent') || '';

    const { error } = await admin.from('user_feedback').insert({
      user_id: userId,
      message: message.trim(),
      category: category || null,
      page: req.headers.get('referer') || null,
      device: /Mobile|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop',
      rating: rating || null,
    });

    if (error) return NextResponse.json({ error: '저장 실패' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
